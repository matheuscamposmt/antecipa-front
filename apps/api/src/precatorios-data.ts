import {
  buildCredorScoreDimension,
  type DetailScoreBreakdown,
  type DetailScoreDimension,
  inferDocType,
  loadProspectDetails,
  type ProspectDetails,
} from "./prospect-enrichment.js";
import { loadPhonesByContacts, loadPhonesByNames, normalizeNameForMatch, queryRows, toNumber } from "./redshift.js";

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeProcessoScore(params: {
  valorTotal: number;
  naturezas: string[];
  temPrioritario: boolean;
  algumSuspenso: boolean;
  todosSuspensos: boolean;
  temCredoresComTelefone: boolean;
  temAdvogadosComTelefone: boolean;
  enrichmentOk: boolean;
}): { score: number; label: string } {
  let score = 0;

  // Valor total nominal (0–30 pts)
  if (params.valorTotal >= 1_000_000) score += 30;
  else if (params.valorTotal >= 500_000) score += 20;
  else if (params.valorTotal >= 100_000) score += 10;
  else score += 5;

  // Natureza do crédito (0–20 pts)
  const total = params.naturezas.length;
  const alimentares = params.naturezas.filter((n) => /aliment/i.test(n)).length;
  if (total > 0) {
    if (alimentares === total) score += 20;
    else if (alimentares > 0) score += 12;
    else score += 5;
  }

  // Pagamento prioritário (0–15 pts)
  if (params.temPrioritario) score += 15;

  // Não suspenso (0–15 pts)
  if (!params.algumSuspenso) score += 15;
  else if (!params.todosSuspensos) score += 5;

  // Contatos com telefone (0–10 pts)
  if (params.temCredoresComTelefone) score += 5;
  if (params.temAdvogadosComTelefone) score += 5;

  // Enriquecimento bem-sucedido (0–10 pts)
  if (params.enrichmentOk) score += 10;
  else score += 3;

  const final = Math.min(100, score);
  const label =
    final >= 75 ? "Alta prioridade"
    : final >= 50 ? "Média prioridade"
    : final >= 25 ? "Baixa prioridade"
    : "Desqualificado";

  return { score: final, label };
}

const LATEST_PRECATORIOS_CTE = `
  WITH ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY id_precatorio
        ORDER BY processed_at DESC
      ) AS rn
    FROM precatorios.lista_cronologica
  ),
  atual AS (
    SELECT * FROM ranked WHERE rn = 1
  )
`;

type DebtorSummaryRow = {
  trt: string;
  devedor: string;
  cnpj_devedor: string | null;
  tipo_devedor: string | null;
  quantidade_precatorios: string | number;
  valor_total_precatorio: string | number;
  valor_total_pago: string | number;
  data_referencia: string | null;
};

type PrecatorioLineRow = {
  numero_precatorio: string | null;
  numero_processo: string | null;
  natureza: string | null;
  pagamento_prioritario: boolean | null;
  data_vencimento: string | null;
  data_requisicao: string | null;
  data_ultima_atualizacao: string | null;
  valor_nominal: string | number;
  valor_pago: string | number;
  exequente_index: string | number;
  suspenso: boolean | null;
  enrichment_status: string | null;
};

type ProcessoLineRow = {
  numero_precatorio: string | null;
  natureza: string | null;
  pagamento_prioritario: boolean | null;
  data_vencimento: string | null;
  data_requisicao: string | null;
  valor_nominal: string | number;
  valor_pago: string | number;
  suspenso: boolean | null;
  enrichment_status: string | null;
  devedor: string | null;
  cnpj_devedor: string | null;
  trt: string | null;
  tipo_devedor: string | null;
};

type CredorProcessoRow = {
  numero_processo: string;
  credor_nome: string;
};

type AdvogadoProcessoRow = {
  numero_processo: string;
  advogado_nome: string;
  numero_oab: string | null;
  uf_oab: string | null;
};

type CredorDevedorViewRow = {
  credor_nome: string | null;
  credor_documento: string | null;
  numero_processo: string | null;
  numero_precatorio: string | null;
  valor_nominal: string | number;
  natureza: string | null;
  suspenso: boolean | null;
  pagamento_prioritario: boolean | null;
};

type AdvogadoDevedorRow = {
  advogado_nome: string;
  numero_oab: string | null;
  uf_oab: string | null;
};

type CredorPrecatorioDetailRow = {
  credor_nome: string | null;
  credor_documento: string | null;
  numero_processo: string | null;
  numero_precatorio: string | null;
  valor_nominal: string | number;
  valor_pago: string | number;
  natureza: string | null;
  suspenso: boolean | null;
  pagamento_prioritario: boolean | null;
  data_vencimento: string | null;
  data_requisicao: string | null;
  devedor: string | null;
  cnpj_devedor: string | null;
  trt: string | null;
  tipo_devedor: string | null;
};

export type PrecatorioDebtorItem = {
  slug: string;
  tribunal: string;
  nomeEmpresa: string;
  cnpj: string;
  regime: string;
  quantidadePrecatorios: number;
  valorTotalPrecatorio: number;
  valorTotalPago: number;
  dataReferencia: string;
  origemUrl: string;
};

export type PrecatorioLine = {
  ordemCronologica: string;
  numeroPrecatorio: string;
  numeroProcesso: string;
  numeroRp: string;
  naturezaCredito: string;
  pagamentoPreferencial: string;
  vencimento: string;
  dataRecebimento: string;
  dataUltimaAtualizacao: string;
  valorPrecatorio: number;
  valorPagamento: number;
  suspenso: boolean;
};

export type ProcessoCredorContato = {
  nome: string;
  numerosProcesso: string[];
  telefones: string[];
};

export type ProcessoAdvogadoContato = {
  nome: string;
  numeroOab: string;
  ufOab: string;
  numerosProcesso: string[];
  telefones: string[];
};

export type CredorPrecatorio = {
  credorNome: string;
  credorDocumento: string;
  numeroProcesso: string;
  numeroPrecatorio: string;
  valor: number;
  natureza: string;
  suspenso: boolean;
  pagamentoPrioritario: boolean;
  telefones: string[];
};

export type AdvogadoDevedorItem = {
  nome: string;
  numeroOab: string;
  ufOab: string;
  telefones: string[];
};

export type PrecatorioDebtorDetail = {
  devedor: PrecatorioDebtorItem;
  credores: CredorPrecatorio[];
  advogados: AdvogadoDevedorItem[];
  precatorios: PrecatorioLine[];
};

export type ProcessoCredorSimples = {
  nome: string;
  telefones: string[];
};

export type ProcessoAdvogadoSimples = {
  nome: string;
  numeroOab: string;
  ufOab: string;
  telefones: string[];
};

export type ProcessoPrecatorioItem = {
  numeroPrecatorio: string;
  natureza: string;
  pagamentoPreferencial: string;
  vencimento: string;
  dataRecebimento: string;
  valorPrecatorio: number;
  valorPagamento: number;
  suspenso: boolean;
};

export type ProcessoDetail = {
  numeroProcesso: string;
  devedor: string;
  cnpj: string;
  tribunal: string;
  score: number;
  scoreLabel: string;
  valorTotal: number;
  valorPago: number;
  quantidadePrecatorios: number;
  temPrioritario: boolean;
  algumSuspenso: boolean;
  naturezaDominante: string;
  precatorios: ProcessoPrecatorioItem[];
  credores: ProcessoCredorSimples[];
  advogados: ProcessoAdvogadoSimples[];
};

export type PrecatorioOverview = {
  loadedAt: string;
  totalDevedores: number;
  totalComCnpj: number;
  totalPrecatorios: number;
  valorTotalPrecatorio: number;
  valorTotalPago: number;
};

export type CredorPrecatorioDetail = {
  credorNome: string;
  credorDocumento: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  valorTotal: number;
  valorPago: number;
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: "qualificado" | "marginal" | "rejeitado";
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: DetailScoreBreakdown;
  prospectDetails: ProspectDetails;
  telefones: string[];
  processo: {
    numeroProcesso: string;
    devedor: string;
    cnpj: string;
    tribunal: string;
    regime: string;
    percentualPago: number;
    origemUrl: string;
  };
  precatorios: Array<{
    numeroPrecatorio: string;
    natureza: string;
    pagamentoPrioritario: boolean;
    suspenso: boolean;
    valor: number;
    valorPago: number;
    vencimento: string;
    dataRecebimento: string;
  }>;
  advogados: ProcessoAdvogadoSimples[];
};

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim() || "registro";
}

function buildPrecatorioSlug(nomeEmpresa: string, tribunal: string, cnpj: string): string {
  return `precatorio-${slugify(tribunal)}-${slugify(nomeEmpresa)}-${slugify(cnpj || "sem-cnpj")}`;
}

function inferTipoPessoa(documento: string): "PF" | "PJ" | "OUTRO" {
  return inferDocType(documento);
}

function buildPrecatorioAtivoDimension(params: {
  naturezaPrincipal: string;
  temPrioritario: boolean;
  algumSuspenso: boolean;
}): DetailScoreDimension {
  const natureza = params.naturezaPrincipal.toLowerCase();
  const naturezaPts = natureza.includes("aliment") ? 20 : natureza ? 8 : 4;
  const suspensaoPts = params.algumSuspenso ? 0 : 12;
  const prioridadePts = params.temPrioritario ? 8 : 0;

  return {
    total: naturezaPts + suspensaoPts + prioridadePts,
    method: "regras_precatorio",
    note: "Natureza, suspensão e prioridade do crédito.",
    items: [
      { label: "Natureza do crédito", pts: naturezaPts, max: 20 },
      { label: "Sem suspensão", pts: suspensaoPts, max: 12 },
      { label: "Pagamento prioritário", pts: prioridadePts, max: 8 },
    ],
  };
}

function buildPrecatorioDevedorDimension(params: {
  regime: string;
  percentualPago: number;
}): DetailScoreDimension {
  const regime = params.regime.toLowerCase();
  const regimePts = regime.includes("especial") ? 5 : regime ? 20 : 10;
  const pago = params.percentualPago;
  const percentualPagoPts =
    pago > 50 ? 15 :
    pago >= 25 ? 10 :
    pago >= 5 ? 5 :
    2;
  return {
    total: regimePts + percentualPagoPts,
    method: "parcial_real",
    note: "Regime e histórico de pagamento entram; RCL e adimplência histórica ainda dependem do ETL.",
    items: [
      { label: "Regime do devedor", pts: regimePts, max: 20 },
      { label: "% pago vs. nominal", pts: percentualPagoPts, max: 15 },
    ],
  };
}

async function loadLoadedAt(): Promise<string> {
  const rows = await queryRows<{ loaded_at: string | null }>(
    "SELECT COALESCE(MAX(processed_at)::text, CURRENT_TIMESTAMP::text) AS loaded_at FROM precatorios.lista_cronologica",
  );
  return rows[0]?.loaded_at ?? new Date().toISOString();
}

async function loadPublicDebtors(): Promise<PrecatorioDebtorItem[]> {
  const rows = await queryRows<DebtorSummaryRow>(
    `
      ${LATEST_PRECATORIOS_CTE}
      SELECT
        trt,
        devedor,
        cnpj_devedor,
        tipo_devedor,
        COUNT(DISTINCT id_precatorio) AS quantidade_precatorios,
        SUM(valor_nominal) AS valor_total_precatorio,
        SUM(valor_pago) AS valor_total_pago,
        COALESCE(MAX(data_ultima_atualizacao)::text, MAX(processed_at::date)::text, '') AS data_referencia
      FROM atual
      GROUP BY trt, devedor, cnpj_devedor, tipo_devedor
      ORDER BY valor_total_precatorio DESC, devedor ASC
    `,
  );

  return rows.map((row) => {
    const tribunal = row.trt ?? "";
    const nomeEmpresa = row.devedor ?? "";
    const cnpj = row.cnpj_devedor ?? "";
    return {
      slug: buildPrecatorioSlug(nomeEmpresa, tribunal, cnpj),
      tribunal,
      nomeEmpresa,
      cnpj,
      regime: row.tipo_devedor ?? "",
      quantidadePrecatorios: Number.parseInt(String(row.quantidade_precatorios ?? 0), 10) || 0,
      valorTotalPrecatorio: toNumber(row.valor_total_precatorio),
      valorTotalPago: toNumber(row.valor_total_pago),
      dataReferencia: row.data_referencia ?? "",
      origemUrl: "",
    };
  });
}

function groupCredorContacts(rows: CredorProcessoRow[], phoneMap: Map<string, string[]>): ProcessoCredorContato[] {
  const grouped = new Map<string, ProcessoCredorContato>();
  for (const row of rows) {
    const key = normalizeNameForMatch(row.credor_nome);
    if (!key) {
      continue;
    }
    const current = grouped.get(key) ?? {
      nome: row.credor_nome,
      numerosProcesso: [],
      telefones: phoneMap.get(key) ?? [],
    };
    if (!current.numerosProcesso.includes(row.numero_processo)) {
      current.numerosProcesso.push(row.numero_processo);
    }
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

function groupAdvogadoContacts(rows: AdvogadoProcessoRow[], phoneMap: Map<string, string[]>): ProcessoAdvogadoContato[] {
  const grouped = new Map<string, ProcessoAdvogadoContato>();
  for (const row of rows) {
    const nameKey = normalizeNameForMatch(row.advogado_nome);
    const key = `${nameKey}|${row.numero_oab ?? ""}|${row.uf_oab ?? ""}`;
    if (!nameKey) {
      continue;
    }
    const current = grouped.get(key) ?? {
      nome: row.advogado_nome,
      numeroOab: row.numero_oab ?? "",
      ufOab: row.uf_oab ?? "",
      numerosProcesso: [],
      telefones: phoneMap.get(nameKey) ?? [],
    };
    if (!current.numerosProcesso.includes(row.numero_processo)) {
      current.numerosProcesso.push(row.numero_processo);
    }
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function loadPrecatorioOverview(): Promise<PrecatorioOverview> {
  const [loadedAt, debtors] = await Promise.all([loadLoadedAt(), loadPublicDebtors()]);
  return {
    loadedAt,
    totalDevedores: debtors.length,
    totalComCnpj: debtors.filter((item) => item.cnpj.trim().length > 0).length,
    totalPrecatorios: debtors.reduce((acc, item) => acc + item.quantidadePrecatorios, 0),
    valorTotalPrecatorio: debtors.reduce((acc, item) => acc + item.valorTotalPrecatorio, 0),
    valorTotalPago: debtors.reduce((acc, item) => acc + item.valorTotalPago, 0),
  };
}

export async function loadPrecatorioDebtors(): Promise<PrecatorioDebtorItem[]> {
  return loadPublicDebtors();
}

// Extracts the 14-digit CNPJ from the end of a slug when present.
function extractCnpjFromSlug(slug: string): string | null {
  const match = slug.match(/(\d{14})$/);
  return match?.[1] ?? null;
}

type DevedorMetaRow = {
  trt: string;
  devedor: string;
  cnpj_devedor: string | null;
  tipo_devedor: string | null;
  data_referencia: string | null;
};

// Finds the devedor by slug without scanning the whole table.
// For CNPJ slugs: filters directly by cnpj_devedor (highly selective).
// For sem-cnpj slugs: scans only the null-CNPJ subset (much smaller).
async function findDevedorBySlug(slug: string): Promise<PrecatorioDebtorItem | null> {
  const cnpj = extractCnpjFromSlug(slug);

  const rows = await queryRows<DevedorMetaRow>(
    cnpj
      ? `
          SELECT
            trt, devedor, cnpj_devedor, tipo_devedor,
            COALESCE(MAX(data_ultima_atualizacao)::text, MAX(processed_at::date)::text, '') AS data_referencia
          FROM precatorios.lista_cronologica
          WHERE cnpj_devedor = $1
          GROUP BY trt, devedor, cnpj_devedor, tipo_devedor
        `
      : `
          SELECT
            trt, devedor, cnpj_devedor, tipo_devedor,
            COALESCE(MAX(data_ultima_atualizacao)::text, MAX(processed_at::date)::text, '') AS data_referencia
          FROM precatorios.lista_cronologica
          WHERE COALESCE(cnpj_devedor, '') = ''
          GROUP BY trt, devedor, cnpj_devedor, tipo_devedor
        `,
    cnpj ? [cnpj] : [],
  );

  for (const row of rows) {
    const tribunal = row.trt ?? "";
    const nomeEmpresa = row.devedor ?? "";
    const cnpjValue = row.cnpj_devedor ?? "";
    const item: PrecatorioDebtorItem = {
      slug: buildPrecatorioSlug(nomeEmpresa, tribunal, cnpjValue),
      tribunal,
      nomeEmpresa,
      cnpj: cnpjValue,
      regime: row.tipo_devedor ?? "",
      quantidadePrecatorios: 0,
      valorTotalPrecatorio: 0,
      valorTotalPago: 0,
      dataReferencia: row.data_referencia ?? "",
      origemUrl: "",
    };
    if (item.slug === slug) return item;
  }
  return null;
}

export async function loadPrecatorioDetail(slug: string): Promise<PrecatorioDebtorDetail | null> {
  const devedor = await findDevedorBySlug(slug);
  if (!devedor) return null;

  const params = [devedor.tribunal, devedor.nomeEmpresa, devedor.cnpj];

  const [credorViewRows, advogadoRows, lineRows] = await Promise.all([
    queryRows<CredorDevedorViewRow>(
      `SELECT credor_nome, credor_documento, numero_processo, numero_precatorio,
              valor_nominal, natureza, suspenso, pagamento_prioritario
       FROM precatorios.vm_credores_devedor
       WHERE trt = $1 AND devedor = $2 AND cnpj_devedor = $3
       ORDER BY valor_nominal DESC, numero_precatorio ASC`,
      params,
    ),
    queryRows<AdvogadoDevedorRow>(
      `SELECT DISTINCT pa.advogado_nome, pa.numero_oab, pa.uf_oab
       FROM precatorios.processos_advogados pa
       WHERE pa.numero_processo IN (
         SELECT DISTINCT numero_processo
         FROM precatorios.vm_credores_devedor
         WHERE trt = $1 AND devedor = $2 AND cnpj_devedor = $3
       )
       ORDER BY pa.advogado_nome ASC`,
      params,
    ),
    queryRows<PrecatorioLineRow>(
      `WITH ranked AS (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY id_precatorio ORDER BY processed_at DESC) AS rn
         FROM precatorios.lista_cronologica
         WHERE trt = $1 AND devedor = $2 AND COALESCE(cnpj_devedor, '') = $3
       )
       SELECT numero_precatorio, numero_processo, natureza, pagamento_prioritario,
              data_vencimento::text AS data_vencimento, data_requisicao::text AS data_requisicao,
              data_ultima_atualizacao::text AS data_ultima_atualizacao,
              valor_nominal, valor_pago, exequente_index, suspenso, enrichment_status
       FROM ranked WHERE rn = 1
       ORDER BY valor_nominal DESC, numero_precatorio ASC`,
      params,
    ),
  ]);

  const phoneMap = await loadPhonesByContacts([
    ...credorViewRows.map((row) => ({
      name: row.credor_nome ?? "",
      document: row.credor_documento ?? "",
    })),
    ...advogadoRows.map((row) => ({
      name: row.advogado_nome,
      document: "",
    })),
  ]);

  const totals = lineRows.reduce(
    (acc, row) => {
      acc.valorTotal += toNumber(row.valor_nominal);
      acc.valorPago += toNumber(row.valor_pago);
      acc.count += 1;
      return acc;
    },
    { valorTotal: 0, valorPago: 0, count: 0 },
  );

  return {
    devedor: {
      ...devedor,
      quantidadePrecatorios: totals.count,
      valorTotalPrecatorio: totals.valorTotal,
      valorTotalPago: totals.valorPago,
    },
    credores: credorViewRows
      .filter((r) => r.credor_nome)
      .map((row) => ({
        credorNome: row.credor_nome ?? "",
        credorDocumento: row.credor_documento ?? "",
        numeroProcesso: row.numero_processo ?? "",
        numeroPrecatorio: row.numero_precatorio ?? "",
        valor: toNumber(row.valor_nominal),
        natureza: row.natureza ?? "",
        suspenso: row.suspenso === true,
        pagamentoPrioritario: row.pagamento_prioritario === true,
        telefones: phoneMap.get(normalizeNameForMatch(row.credor_nome ?? "")) ?? [],
      })),
    advogados: advogadoRows.map((row) => ({
      nome: row.advogado_nome,
      numeroOab: row.numero_oab ?? "",
      ufOab: row.uf_oab ?? "",
      telefones: phoneMap.get(normalizeNameForMatch(row.advogado_nome)) ?? [],
    })),
    precatorios: lineRows.map((row) => ({
      ordemCronologica: String((Number.parseInt(String(row.exequente_index ?? 0), 10) || 0) + 1),
      numeroPrecatorio: row.numero_precatorio ?? "",
      numeroProcesso: row.numero_processo ?? "",
      numeroRp: "",
      naturezaCredito: row.natureza ?? "",
      pagamentoPreferencial: row.pagamento_prioritario ? "Sim" : "Não",
      vencimento: row.data_vencimento ?? "",
      dataRecebimento: row.data_requisicao ?? "",
      dataUltimaAtualizacao: row.data_ultima_atualizacao ?? "",
      valorPrecatorio: toNumber(row.valor_nominal),
      valorPagamento: toNumber(row.valor_pago),
      suspenso: row.suspenso === true,
    })),
  };
}

export async function loadCredorPrecatorioDetail(
  numeroProcesso: string,
  credorNome: string,
): Promise<CredorPrecatorioDetail | null> {
  const [credorRows, lineRows] = await Promise.all([
    queryRows<CredorPrecatorioDetailRow>(
      `
        SELECT
          credor_nome,
          credor_documento,
          numero_processo,
          numero_precatorio,
          valor_nominal,
          natureza,
          suspenso,
          pagamento_prioritario,
          devedor,
          cnpj_devedor,
          trt
        FROM precatorios.vm_credores_devedor
        WHERE numero_processo = $1 AND credor_nome = $2
        ORDER BY valor_nominal DESC, numero_precatorio ASC
      `,
      [numeroProcesso, credorNome],
    ),
    queryRows<ProcessoLineRow>(
      `
        WITH ranked AS (
          SELECT
            *,
            ROW_NUMBER() OVER (PARTITION BY id_precatorio ORDER BY processed_at DESC) AS rn
          FROM precatorios.lista_cronologica
          WHERE numero_processo = $1
        )
        SELECT
          numero_precatorio,
          natureza,
          pagamento_prioritario,
          data_vencimento::text AS data_vencimento,
          data_requisicao::text AS data_requisicao,
          valor_nominal,
          valor_pago,
          suspenso,
          enrichment_status,
          devedor,
          cnpj_devedor,
          trt,
          tipo_devedor
        FROM ranked
        WHERE rn = 1
        ORDER BY valor_nominal DESC, numero_precatorio ASC
      `,
      [numeroProcesso],
    ),
  ]);

  if (credorRows.length === 0) return null;

  const first = credorRows[0];
  const phoneMap = await loadPhonesByContacts([
    {
      name: first.credor_nome ?? credorNome,
      document: first.credor_documento ?? "",
    },
  ]);
  const processFirst = lineRows[0];
  const valorTotal = credorRows.reduce((acc, row) => acc + toNumber(row.valor_nominal), 0);
  const valorTotalProcesso = lineRows.reduce((acc, row) => acc + toNumber(row.valor_nominal), 0);
  const valorPagoProcesso = lineRows.reduce((acc, row) => acc + toNumber(row.valor_pago), 0);
  const percentualPago = valorTotalProcesso > 0 ? (valorPagoProcesso / valorTotalProcesso) * 100 : 0;
  const pagamentosPorPrecatorio = new Map(
    lineRows.map((row) => [row.numero_precatorio ?? "", toNumber(row.valor_pago)]),
  );
  const valorPago = credorRows.reduce(
    (acc, row) => acc + (pagamentosPorPrecatorio.get(row.numero_precatorio ?? "") ?? 0),
    0,
  );
  const temPrioritario = credorRows.some((row) => row.pagamento_prioritario === true);
  const algumSuspenso = credorRows.some((row) => row.suspenso === true);

  const naturezaCount = new Map<string, number>();
  for (const row of credorRows) {
    const natureza = row.natureza ?? "";
    if (!natureza) continue;
    naturezaCount.set(natureza, (naturezaCount.get(natureza) ?? 0) + 1);
  }
  const naturezaPrincipal = [...naturezaCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const tipoPessoa = inferTipoPessoa(first.credor_documento ?? "");
  const prospectDetails = await loadProspectDetails({
    nome: first.credor_nome ?? credorNome,
    documento: first.credor_documento ?? "",
    tipoPessoa,
  });
  const ativo = buildPrecatorioAtivoDimension({
    naturezaPrincipal,
    temPrioritario,
    algumSuspenso,
  });
  const devedor = buildPrecatorioDevedorDimension({
    regime: processFirst?.tipo_devedor ?? "",
    percentualPago,
  });
  const credor = buildCredorScoreDimension({
    tipoPessoa,
    valor: valorTotal,
    prospect: prospectDetails,
  });
  const scoreAtivo = ativo.total;
  const scoreDevedor = devedor.total;
  const scoreCredit = credor.total;
  const score = Math.min(100, scoreAtivo + scoreDevedor + scoreCredit);
  const status =
    score >= 65 ? "qualificado" :
    score >= 50 ? "marginal" :
    "rejeitado";
  const desagioRec =
    score >= 75 ? "10–15%" :
    score >= 60 ? "15–20%" :
    score >= 45 ? "20–30%" :
    score >= 30 ? "30–40%" :
    "Não recomendado";
  const elegivel = score >= 40 && !algumSuspenso;

  return {
    credorNome: first.credor_nome ?? credorNome,
    credorDocumento: first.credor_documento ?? "",
    tipoPessoa,
    valorTotal,
    valorPago,
    score,
    scoreAtivo,
    scoreDevedor,
    scoreCredit,
    status,
    desagioRec,
    elegivel,
    scoreBreakdown: {
      ativo,
      devedor,
      credor,
    },
    prospectDetails,
    telefones: phoneMap.get(normalizeNameForMatch(credorNome)) ?? [],
    processo: {
      numeroProcesso,
      devedor: processFirst?.devedor ?? first.devedor ?? "",
      cnpj: processFirst?.cnpj_devedor ?? first.cnpj_devedor ?? "",
      tribunal: processFirst?.trt ?? first.trt ?? "",
      regime: processFirst?.tipo_devedor ?? "",
      percentualPago,
      origemUrl: "",
    },
    precatorios: credorRows.map((row) => ({
      numeroPrecatorio: row.numero_precatorio ?? "",
      natureza: row.natureza ?? "",
      pagamentoPrioritario: row.pagamento_prioritario === true,
      suspenso: row.suspenso === true,
      valor: toNumber(row.valor_nominal),
      valorPago: pagamentosPorPrecatorio.get(row.numero_precatorio ?? "") ?? 0,
      vencimento: "",
      dataRecebimento: "",
    })),
    advogados: [],
  };
}

export async function loadProcessoDetail(numeroProcesso: string): Promise<ProcessoDetail | null> {
  const lineRows = await queryRows<ProcessoLineRow>(
    `
      WITH ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (PARTITION BY id_precatorio ORDER BY processed_at DESC) AS rn
        FROM precatorios.lista_cronologica
        WHERE numero_processo = $1
      )
      SELECT
        numero_precatorio,
        natureza,
        pagamento_prioritario,
        data_vencimento::text AS data_vencimento,
        data_requisicao::text AS data_requisicao,
        valor_nominal,
        valor_pago,
        suspenso,
        enrichment_status,
        devedor,
        cnpj_devedor,
        trt
      FROM ranked
      WHERE rn = 1
      ORDER BY valor_nominal DESC, numero_precatorio ASC
    `,
    [numeroProcesso],
  );

  if (lineRows.length === 0) return null;

  const [credorRows, advogadoRows] = await Promise.all([
    queryRows<CredorProcessoRow>(
      `SELECT numero_processo, credor_nome FROM precatorios.processos_credores WHERE numero_processo = $1 ORDER BY credor_nome ASC`,
      [numeroProcesso],
    ),
    queryRows<AdvogadoProcessoRow>(
      `SELECT numero_processo, advogado_nome, numero_oab, uf_oab FROM precatorios.processos_advogados WHERE numero_processo = $1 ORDER BY advogado_nome ASC`,
      [numeroProcesso],
    ),
  ]);

  const phoneMap = await loadPhonesByNames([
    ...credorRows.map((r) => r.credor_nome),
    ...advogadoRows.map((r) => r.advogado_nome),
  ]);

  const firstRow = lineRows[0];
  const valorTotal = lineRows.reduce((acc, row) => acc + toNumber(row.valor_nominal), 0);
  const valorPago = lineRows.reduce((acc, row) => acc + toNumber(row.valor_pago), 0);
  const naturezas = lineRows.map((r) => r.natureza ?? "").filter(Boolean);
  const temPrioritario = lineRows.some((r) => r.pagamento_prioritario === true);
  const algumSuspenso = lineRows.some((r) => r.suspenso === true);
  const todosSuspensos = lineRows.length > 0 && lineRows.every((r) => r.suspenso === true);
  const enrichmentOk = lineRows.some((r) => r.enrichment_status === "success");

  const credores: ProcessoCredorSimples[] = credorRows.map((r) => ({
    nome: r.credor_nome,
    telefones: phoneMap.get(normalizeNameForMatch(r.credor_nome)) ?? [],
  }));
  const advogados: ProcessoAdvogadoSimples[] = advogadoRows.map((r) => ({
    nome: r.advogado_nome,
    numeroOab: r.numero_oab ?? "",
    ufOab: r.uf_oab ?? "",
    telefones: phoneMap.get(normalizeNameForMatch(r.advogado_nome)) ?? [],
  }));

  const temCredoresComTelefone = credores.some((c) => c.telefones.length > 0);
  const temAdvogadosComTelefone = advogados.some((a) => a.telefones.length > 0);

  const { score, label: scoreLabel } = computeProcessoScore({
    valorTotal,
    naturezas,
    temPrioritario,
    algumSuspenso,
    todosSuspensos,
    temCredoresComTelefone,
    temAdvogadosComTelefone,
    enrichmentOk,
  });

  // Natureza dominante
  const naturezaCount = new Map<string, number>();
  for (const n of naturezas) {
    naturezaCount.set(n, (naturezaCount.get(n) ?? 0) + 1);
  }
  const naturezaDominante = [...naturezaCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  return {
    numeroProcesso,
    devedor: firstRow.devedor ?? "",
    cnpj: firstRow.cnpj_devedor ?? "",
    tribunal: firstRow.trt ?? "",
    score,
    scoreLabel,
    valorTotal,
    valorPago,
    quantidadePrecatorios: lineRows.length,
    temPrioritario,
    algumSuspenso,
    naturezaDominante,
    precatorios: lineRows.map((row) => ({
      numeroPrecatorio: row.numero_precatorio ?? "",
      natureza: row.natureza ?? "",
      pagamentoPreferencial: row.pagamento_prioritario ? "Sim" : "Não",
      vencimento: row.data_vencimento ?? "",
      dataRecebimento: row.data_requisicao ?? "",
      valorPrecatorio: toNumber(row.valor_nominal),
      valorPagamento: toNumber(row.valor_pago),
      suspenso: row.suspenso === true,
    })),
    credores,
    advogados,
  };
}
