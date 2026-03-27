import { buildParameterList, loadPhonesByNames, normalizeNameForMatch, queryRows, toNumber } from "./redshift.js";

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
  numeroRp: string;
  naturezaCredito: string;
  pagamentoPreferencial: string;
  vencimento: string;
  dataRecebimento: string;
  dataUltimaAtualizacao: string;
  valorPrecatorio: number;
  valorPagamento: number;
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

export type PrecatorioDebtorDetail = {
  devedor: PrecatorioDebtorItem;
  precatorios: PrecatorioLine[];
  contatosProcesso: {
    credores: ProcessoCredorContato[];
    advogados: ProcessoAdvogadoContato[];
  };
};

export type PrecatorioOverview = {
  loadedAt: string;
  totalDevedores: number;
  totalComCnpj: number;
  totalPrecatorios: number;
  valorTotalPrecatorio: number;
  valorTotalPago: number;
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

  // Filter pushed inside the CTE so Redshift windows only matching rows.
  const lineRows = await queryRows<PrecatorioLineRow>(
    `
      WITH ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (PARTITION BY id_precatorio ORDER BY processed_at DESC) AS rn
        FROM precatorios.lista_cronologica
        WHERE trt = $1
          AND devedor = $2
          AND COALESCE(cnpj_devedor, '') = $3
      )
      SELECT
        numero_precatorio,
        numero_processo,
        natureza,
        pagamento_prioritario,
        data_vencimento::text AS data_vencimento,
        data_requisicao::text AS data_requisicao,
        data_ultima_atualizacao::text AS data_ultima_atualizacao,
        valor_nominal,
        valor_pago,
        exequente_index
      FROM ranked
      WHERE rn = 1
      ORDER BY valor_nominal DESC, numero_precatorio ASC
    `,
    [devedor.tribunal, devedor.nomeEmpresa, devedor.cnpj],
  );

  const processNumbers = Array.from(
    new Set(lineRows.map((row) => row.numero_processo ?? "").filter(Boolean)),
  );
  const processPlaceholders = buildParameterList(processNumbers.length);

  const [credorRows, advogadoRows] = await Promise.all([
    processNumbers.length > 0
      ? queryRows<CredorProcessoRow>(
          `SELECT numero_processo, credor_nome FROM precatorios.processos_credores WHERE numero_processo IN (${processPlaceholders}) ORDER BY credor_nome ASC`,
          processNumbers,
        )
      : Promise.resolve([]),
    processNumbers.length > 0
      ? queryRows<AdvogadoProcessoRow>(
          `SELECT numero_processo, advogado_nome, numero_oab, uf_oab FROM precatorios.processos_advogados WHERE numero_processo IN (${processPlaceholders}) ORDER BY advogado_nome ASC`,
          processNumbers,
        )
      : Promise.resolve([]),
  ]);

  const phoneMap = await loadPhonesByNames([
    ...credorRows.map((row) => row.credor_nome),
    ...advogadoRows.map((row) => row.advogado_nome),
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

  const enrichedDevedor: PrecatorioDebtorItem = {
    ...devedor,
    quantidadePrecatorios: totals.count,
    valorTotalPrecatorio: totals.valorTotal,
    valorTotalPago: totals.valorPago,
  };

  return {
    devedor: enrichedDevedor,
    precatorios: lineRows.map((row) => ({
      ordemCronologica: String((Number.parseInt(String(row.exequente_index ?? 0), 10) || 0) + 1),
      numeroPrecatorio: row.numero_precatorio ?? "",
      numeroRp: "",
      naturezaCredito: row.natureza ?? "",
      pagamentoPreferencial: row.pagamento_prioritario ? "Sim" : "Não",
      vencimento: row.data_vencimento ?? "",
      dataRecebimento: row.data_requisicao ?? "",
      dataUltimaAtualizacao: row.data_ultima_atualizacao ?? "",
      valorPrecatorio: toNumber(row.valor_nominal),
      valorPagamento: toNumber(row.valor_pago),
    })),
    contatosProcesso: {
      credores: groupCredorContacts(credorRows, phoneMap),
      advogados: groupAdvogadoContacts(advogadoRows, phoneMap),
    },
  };
}
