import {
  buildCredorScoreDimension,
  type DetailScoreBreakdown,
  type DetailScoreDimension,
  hasValidDocument,
  inferDocType,
  loadCompanyPgfnContext,
  loadProspectDetails,
  type ProspectDetails,
} from "./prospect-enrichment.js";
import { loadPhonesByContacts, normalizeNameForMatch, queryRows, toNumber } from "./redshift.js";

type NullableString = string | null;

type CompanySummaryRow = {
  nome_da_empresa: string;
  grupo_economico: NullableString;
  administrador_judicial: NullableString;
  link_credores: NullableString;
  arquivo_origem: NullableString;
  data_do_documento: NullableString;
  data_homologacao: NullableString;
  data_referencia_iso: NullableString;
  total_credito: number | string;
  quantidade_credores: number | string;
  quantidade_pf: number | string;
  quantidade_pj: number | string;
  loaded_at: NullableString;
};

type RawCreditorRow = {
  row_hash: string;
  nome: string;
  cpf_cnpj: string | null;
  classe: string | null;
  valor: string | number;
  moeda: string | null;
  extra: string | null;
};

export type ProspectStatus = "qualificado" | "marginal" | "rejeitado";

export type CreditorItem = {
  rowHash: string;
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  classe: string;
  valor: number;
  moeda: string;
  extra: string;
  telefones: string[];
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: ProspectStatus;
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: {
    ativo: { classe: number; documento: number; sinais: number; total: number };
    devedor: { faixa: number; total: number };
    credor: { tipoPessoa: number; valor: number; total: number };
  };
};

export type CredorRJDetail = {
  rowHash: string;
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  classe: string;
  valor: number;
  moeda: string;
  extra: string;
  telefones: string[];
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: ProspectStatus;
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: DetailScoreBreakdown;
  prospectDetails: ProspectDetails;
  empresa: {
    nomeEmpresa: string;
    grupoEconomico: string;
    administradorJudicial: string;
    dataHomologacao: string;
    dataDocumento: string;
    linkCredores: string;
    slug: string;
  };
  outrasEmpresas: Array<{
    nomeEmpresa: string;
    grupoEconomico: string;
    slug: string;
    valor: number;
    classe: string;
    rowHash: string;
  }>;
};

export type CompanyItem = {
  id: number;
  slug: string;
  administradorJudicial: string;
  nomeEmpresa: string;
  grupoEconomico: string;
  dataDocumento: string;
  dataHomologacao: string;
  dataReferenciaIso: string;
  linkCredores: string;
  arquivoCredores: string;
  totalCredito: number;
  quantidadeCredores: number;
  quantidadePF: number;
  quantidadePJ: number;
  valorMediano: number;
  scoreMedio: number;
  capitalSocialEstimado: null;
};

export type CompanyDetail = {
  company: CompanyItem;
  ranking: CreditorItem[];
  credores: CreditorItem[];
  distributionByClasse: Array<{ classe: string; total: number; quantidade: number }>;
};

export type ClasseBreakdownItem = {
  classe: string;
  quantidade: number;
  valorTotal: number;
  empresas: number;
};

export type OverviewData = {
  loadedAt: string;
  totalEmpresas: number;
  totalEmpresasComCredores: number;
  totalGruposEconomicos: number;
  valorTotalCredito: number;
  mediaValorPorEmpresa: number;
  medianaValorPorEmpresa: number;
  topAdministradoresJudiciais: Array<{ nome: string; empresas: number }>;
  topClasses: Array<{ classe: string; quantidade: number }>;
  topEmpresasPorCredito: Array<{ nome: string; totalCredito: number }>;
  classeBreakdown: ClasseBreakdownItem[];
};

const SALARIO_MINIMO = Number.parseFloat(process.env.SALARIO_MINIMO ?? "1518");
const MAX_SALARIOS_TRABALHISTA = 15;
const MAX_CREDITO_TRABALHISTA = SALARIO_MINIMO * MAX_SALARIOS_TRABALHISTA;

function cleanGrupoEconomicoSql(expression: string): string {
  return `
    CASE
      WHEN ${expression} IS NULL THEN ''
      WHEN LOWER(TRIM(${expression})) IN ('', 'nan', 'null', 'none') THEN ''
      ELSE ${expression}
    END
  `;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim() || "registro";
}

function buildCompanySlug(nomeEmpresa: string, grupoEconomico: string): string {
  return `rj-${slugify(nomeEmpresa)}-${slugify(grupoEconomico || "sem-grupo")}`;
}

function parseDocType(cpfCnpj: string): "PF" | "PJ" | "OUTRO" {
  return inferDocType(cpfCnpj);
}

function hasValidCpfCnpj(cpfCnpj: string): boolean {
  return hasValidDocument(cpfCnpj);
}

function normalizeClasse(classe: string): string {
  const normalized = normalizeNameForMatch(classe);
  const classMatch = normalized.match(/\bCLASSE\s+(I|II|III|IV)\b/);
  if (classMatch?.[1]) {
    return classMatch[1];
  }
  if (/\bTRABALHISTA(S)?\b/.test(normalized)) {
    return "I";
  }
  const tokenMatch = normalized.match(/\b(I|II|III|IV)\b/);
  return tokenMatch?.[1] ?? normalized;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
}

function desagioFromScore(score: number): string {
  if (score >= 80) return "15–20%";
  if (score >= 65) return "20–30%";
  if (score >= 50) return "30–40%";
  return "Não recomendado";
}

function statusFromScore(score: number): ProspectStatus {
  if (score >= 65) return "qualificado";
  if (score >= 50) return "marginal";
  return "rejeitado";
}

function computeAtivoDimension(creditor: {
  classe: string;
  cpfCnpj: string;
  extra: string;
}): DetailScoreDimension {
  const classeNorm = normalizeClasse(creditor.classe);
  const documentoValido = hasValidCpfCnpj(creditor.cpfCnpj);
  const extraNorm = normalizeNameForMatch(creditor.extra || "");
  const hasRisco = /(IMPUGN|DIVERGEN|CONTEST|RESERVA|SUB JUDICE|RETIFIC)/.test(extraNorm);

  const classeScore = classeNorm === "I" ? 20 : 0;
  const documentoScore = documentoValido ? 12 : 0;
  const sinaisScore = hasRisco ? 0 : 8;

  return {
    total: classeScore + documentoScore + sinaisScore,
    method: "regras_rj",
    note: "Classe, documento e observações do AJ.",
    items: [
      { label: "Classe Trabalhista", pts: classeScore, max: 20 },
      { label: "Documento válido", pts: documentoScore, max: 12 },
      { label: "Sem contestação (AJ)", pts: sinaisScore, max: 8 },
    ],
  };
}

function computeFaixaFallback(valor: number): number {
  const idealValue = MAX_CREDITO_TRABALHISTA / 2;
  const distanceFromIdeal = Math.abs(valor - idealValue) / idealValue;
  return Math.round(Math.max(0, 5 * (1 - Math.min(distanceFromIdeal, 1))));
}

async function computeRJDevedorDimension(params: {
  nomeEmpresa: string;
  dataHomologacao: string;
  valor: number;
}): Promise<DetailScoreDimension> {
  const homologacaoScore = params.dataHomologacao ? 18 : 4;
  const pgfnContext = await Promise.race<Awaited<ReturnType<typeof loadCompanyPgfnContext>>>([
    loadCompanyPgfnContext(params.nomeEmpresa),
    new Promise((resolve) => setTimeout(() => resolve(null), 1_500)),
  ]);
  const pgfnScore =
    !pgfnContext ? 8 :
    pgfnContext.quantidadeInscricoes === 0 ? 12 :
    pgfnContext.valorConsolidado <= 100_000 ? 8 :
    pgfnContext.valorConsolidado <= 1_000_000 ? 5 :
    2;
  const faixaFallback = computeFaixaFallback(params.valor);

  return {
    total: homologacaoScore + pgfnScore + faixaFallback,
    method: pgfnContext ? "parcial_real_com_pgfn" : "parcial_real_sem_pgfn",
    note: pgfnContext
      ? "Homologação e PGFN inferida por razão social exata; coobrigados ainda pendentes."
      : "Homologação real e complemento neutro; PGFN depende de match exato da razão social.",
    items: [
      { label: "Plano homologado", pts: homologacaoScore, max: 18 },
      { label: "PGFN do devedor", pts: pgfnScore, max: 12 },
      { label: "Faixa do crédito (fallback)", pts: faixaFallback, max: 5 },
    ],
  };
}

async function scoreCredorRJDetail(creditor: {
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  classe: string;
  valor: number;
  extra: string;
  empresa: {
    nomeEmpresa: string;
    dataHomologacao: string;
  };
}): Promise<{
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  status: ProspectStatus;
  desagioRec: string;
  elegivel: boolean;
  scoreBreakdown: DetailScoreBreakdown;
  prospectDetails: ProspectDetails;
}> {
  const classeNorm = normalizeClasse(creditor.classe);
  const elegivel = classeNorm === "I" && creditor.valor > 0 && creditor.valor <= MAX_CREDITO_TRABALHISTA;

  if (!elegivel) {
    const prospectDetails = await loadProspectDetails({
      nome: creditor.nome,
      documento: creditor.cpfCnpj,
      tipoPessoa: creditor.tipoPessoa,
    });

    return {
      score: 0,
      scoreAtivo: 0,
      scoreDevedor: 0,
      scoreCredit: 0,
      status: "rejeitado",
      desagioRec: "Não recomendado",
      elegivel: false,
      scoreBreakdown: {
        ativo: {
          total: 0,
          method: "fora_criterio",
          note: "Somente créditos trabalhistas elegíveis entram no score de originação.",
          items: [
            { label: "Classe Trabalhista", pts: 0, max: 20 },
            { label: "Documento válido", pts: 0, max: 12 },
            { label: "Sem contestação (AJ)", pts: 0, max: 8 },
          ],
        },
        devedor: {
          total: 0,
          method: "fora_criterio",
          note: "Prospect fora do recorte operacional atual.",
          items: [
            { label: "Plano homologado", pts: 0, max: 18 },
            { label: "PGFN do devedor", pts: 0, max: 12 },
            { label: "Faixa do crédito (fallback)", pts: 0, max: 5 },
          ],
        },
        credor: {
          total: 0,
          method: "fora_criterio",
          note: "Prospect fora do recorte operacional atual.",
          items: [
            { label: "Tipo de pessoa", pts: 0, max: 10 },
            { label: "Faixa de valor", pts: 0, max: 15 },
          ],
        },
      },
      prospectDetails,
    };
  }

  const prospectDetails = await loadProspectDetails({
    nome: creditor.nome,
    documento: creditor.cpfCnpj,
    tipoPessoa: creditor.tipoPessoa,
  });
  const [ativo, devedor] = await Promise.all([
    Promise.resolve(computeAtivoDimension(creditor)),
    computeRJDevedorDimension({
      nomeEmpresa: creditor.empresa.nomeEmpresa,
      dataHomologacao: creditor.empresa.dataHomologacao,
      valor: creditor.valor,
    }),
  ]);
  const credorDimension = buildCredorScoreDimension({
    tipoPessoa: creditor.tipoPessoa,
    valor: creditor.valor,
    prospect: prospectDetails,
  });

  const scoreAtivo = ativo.total;
  const scoreDevedor = devedor.total;
  const scoreCredit = credorDimension.total;
  const score = Math.min(100, Math.max(0, scoreAtivo + scoreDevedor + scoreCredit));

  return {
    score,
    scoreAtivo,
    scoreDevedor,
    scoreCredit,
    status: statusFromScore(score),
    desagioRec: desagioFromScore(score),
    elegivel: true,
    scoreBreakdown: {
      ativo,
      devedor,
      credor: credorDimension,
    },
    prospectDetails,
  };
}

function scoreCreditors(creditors: Omit<CreditorItem, "score" | "scoreAtivo" | "scoreDevedor" | "scoreCredit" | "status" | "desagioRec" | "elegivel" | "scoreBreakdown">[]): CreditorItem[] {
  const eligibleValues = creditors
    .filter((c) => normalizeClasse(c.classe) === "I" && c.valor > 0 && c.valor <= MAX_CREDITO_TRABALHISTA)
    .map((c) => c.valor);

  const avg = mean(eligibleValues);
  const deviation = stdDev(eligibleValues, avg);
  const idealValue = MAX_CREDITO_TRABALHISTA / 2;

  return creditors.map((creditor) => {
    const classeNorm = normalizeClasse(creditor.classe);
    const elegivel = classeNorm === "I" && creditor.valor > 0 && creditor.valor <= MAX_CREDITO_TRABALHISTA;
    const hasValidDoc = hasValidCpfCnpj(creditor.cpfCnpj);
    const extraNorm = normalizeNameForMatch(creditor.extra || "");
    const hasRisco = /(IMPUGN|DIVERGEN|CONTEST|RESERVA|SUB JUDICE|RETIFIC)/.test(extraNorm);

    if (!elegivel) {
      return {
        ...creditor,
        score: 0,
        scoreAtivo: 0,
        scoreDevedor: 0,
        scoreCredit: 0,
        status: "rejeitado" as const,
        desagioRec: "Não recomendado",
        elegivel: false,
        scoreBreakdown: {
          ativo: { classe: 0, documento: 0, sinais: 0, total: 0 },
          devedor: { faixa: 0, total: 0 },
          credor: { tipoPessoa: 0, valor: 0, total: 0 },
        },
      };
    }

    // Value z-score (relative to eligible pool)
    const z = deviation > 0 ? Math.abs((creditor.valor - avg) / deviation) : 0;
    const rawValorScore = Math.max(0, 45 * (1 - Math.min(z, 3) / 3));

    // Faixa: distance from ideal value
    const distanceFromIdeal = Math.abs(creditor.valor - idealValue) / idealValue;
    const faixaScore = Math.max(0, 15 * (1 - Math.min(distanceFromIdeal, 1)));

    // Score do Ativo (0–40): certeza jurídica e liquidez
    const classeScore = 20; // Classe I qualifies
    const documentoScore = hasValidDoc ? 12 : 0;
    const sinaisScore = hasRisco ? 0 : 8;
    const scoreAtivo = classeScore + documentoScore + sinaisScore;

    // Score do Devedor (0–35): proxy from faixa distribution
    // TODO: replace with real company health metrics (RCL, homologação, coobrigados)
    const scoreDevedor = Math.round((faixaScore / 15) * 35);

    // Score do Credor (0–25): propensão a ceder
    // TODO: enrich with telecom.contatos (renda, localização, benefícios sociais)
    const tipoPessoaScore = creditor.tipoPessoa === "PF" ? 10 : creditor.tipoPessoa === "PJ" ? 6 : 2;
    const valorPartial = Math.round((rawValorScore / 45) * 15);
    const scoreCredit = tipoPessoaScore + valorPartial;

    const score = Math.min(100, Math.max(0, scoreAtivo + scoreDevedor + scoreCredit));

    return {
      ...creditor,
      score,
      scoreAtivo,
      scoreDevedor,
      scoreCredit,
      status: statusFromScore(score),
      desagioRec: desagioFromScore(score),
      elegivel: true,
      scoreBreakdown: {
        ativo: { classe: classeScore, documento: documentoScore, sinais: sinaisScore, total: scoreAtivo },
        devedor: { faixa: scoreDevedor, total: scoreDevedor },
        credor: { tipoPessoa: tipoPessoaScore, valor: valorPartial, total: scoreCredit },
      },
    };
  });
}

async function loadLoadedAt(): Promise<string> {
  const rows = await queryRows<{ loaded_at: string | null }>(
    "SELECT COALESCE(MAX(processed_at)::text, CURRENT_TIMESTAMP::text) AS loaded_at FROM administradores_judiciais.documentos",
  );
  return rows[0]?.loaded_at ?? new Date().toISOString();
}

async function loadCompanySummaries(): Promise<CompanyItem[]> {
  const rows = await queryRows<CompanySummaryRow>(
    `
      WITH docs AS (
        SELECT
          pdf_sha256,
          nome_da_empresa,
          ${cleanGrupoEconomicoSql("grupo_economico")} AS grupo_economico,
          administrador_judicial,
          link_credores,
          arquivo_origem,
          data_do_documento,
          data_homologacao,
          processed_at
        FROM administradores_judiciais.documentos
      ),
      agg AS (
        SELECT
          d.nome_da_empresa,
          d.grupo_economico,
          COALESCE(SUM(c.valor), 0) AS total_credito,
          COUNT(c.row_hash) AS quantidade_credores,
          SUM(CASE WHEN REGEXP_REPLACE(COALESCE(c.cpf_cnpj, ''), '\\\\D', '') ~ '^\\\\d{11}$' THEN 1 ELSE 0 END) AS quantidade_pf,
          SUM(CASE WHEN REGEXP_REPLACE(COALESCE(c.cpf_cnpj, ''), '\\\\D', '') ~ '^\\\\d{14}$' THEN 1 ELSE 0 END) AS quantidade_pj,
          MAX(d.processed_at)::text AS loaded_at
        FROM docs d
        LEFT JOIN administradores_judiciais.credores c
          ON c.pdf_sha256 = d.pdf_sha256
        GROUP BY 1, 2
      ),
      meta AS (
        SELECT
          nome_da_empresa,
          grupo_economico,
          administrador_judicial,
          link_credores,
          arquivo_origem,
          COALESCE(data_do_documento::text, '') AS data_do_documento,
          COALESCE(data_homologacao::text, '') AS data_homologacao,
          COALESCE(data_do_documento::text, data_homologacao::text, processed_at::date::text, '') AS data_referencia_iso,
          ROW_NUMBER() OVER (
            PARTITION BY nome_da_empresa, grupo_economico
            ORDER BY COALESCE(data_do_documento, data_homologacao, processed_at::date) DESC, processed_at DESC, arquivo_origem DESC
          ) AS rn
        FROM docs
      )
      SELECT
        agg.nome_da_empresa,
        agg.grupo_economico,
        meta.administrador_judicial,
        meta.link_credores,
        meta.arquivo_origem,
        meta.data_do_documento,
        meta.data_homologacao,
        meta.data_referencia_iso,
        agg.total_credito,
        agg.quantidade_credores,
        agg.quantidade_pf,
        agg.quantidade_pj,
        agg.loaded_at
      FROM agg
      JOIN meta
        ON meta.nome_da_empresa = agg.nome_da_empresa
       AND meta.grupo_economico = agg.grupo_economico
       AND meta.rn = 1
      ORDER BY agg.total_credito DESC, agg.nome_da_empresa ASC
    `,
  );

  return rows.map((row, index) => ({
    id: index + 1,
    slug: buildCompanySlug(row.nome_da_empresa, row.grupo_economico ?? ""),
    administradorJudicial: row.administrador_judicial?.trim() || "Não informado",
    nomeEmpresa: row.nome_da_empresa,
    grupoEconomico: row.grupo_economico ?? "",
    dataDocumento: row.data_do_documento ?? "",
    dataHomologacao: row.data_homologacao ?? "",
    dataReferenciaIso: row.data_referencia_iso ?? "",
    linkCredores: row.link_credores ?? "",
    arquivoCredores: row.arquivo_origem ?? "",
    totalCredito: toNumber(row.total_credito),
    quantidadeCredores: Number.parseInt(String(row.quantidade_credores ?? 0), 10) || 0,
    quantidadePF: Number.parseInt(String(row.quantidade_pf ?? 0), 10) || 0,
    quantidadePJ: Number.parseInt(String(row.quantidade_pj ?? 0), 10) || 0,
    valorMediano: 0,
    scoreMedio: 0,
    capitalSocialEstimado: null,
  }));
}

async function loadTopClasses(): Promise<Array<{ classe: string; quantidade: number }>> {
  const rows = await queryRows<{ classe: string | null; quantidade: string | number }>(
    `
      SELECT classe, COUNT(*) AS quantidade
      FROM administradores_judiciais.credores
      GROUP BY classe
      ORDER BY quantidade DESC, classe ASC
      LIMIT 8
    `,
  );
  return rows.map((row) => ({
    classe: row.classe ?? "N/A",
    quantidade: Number.parseInt(String(row.quantidade ?? 0), 10) || 0,
  }));
}

async function loadCompanyCreditors(company: CompanyItem): Promise<Omit<CreditorItem, "score" | "scoreAtivo" | "scoreDevedor" | "scoreCredit" | "status" | "desagioRec" | "elegivel" | "scoreBreakdown">[]> {
  const rows = await queryRows<RawCreditorRow>(
    `
      SELECT
        row_hash,
        nome,
        cpf_cnpj,
        classe,
        valor::text AS valor,
        moeda,
        extra
      FROM administradores_judiciais.credores
      WHERE nome_da_empresa = $1
      ORDER BY valor DESC, nome ASC
    `,
    [company.nomeEmpresa],
  );

  return rows.map((row) => ({
    rowHash: row.row_hash,
    nome: row.nome || "Credor não identificado",
    cpfCnpj: row.cpf_cnpj ?? "",
    tipoPessoa: parseDocType(row.cpf_cnpj ?? ""),
    classe: row.classe ?? "N/A",
    valor: toNumber(row.valor),
    moeda: row.moeda ?? "BRL",
    extra: row.extra ?? "",
    telefones: [],
  }));
}

async function loadClasseBreakdown(): Promise<ClasseBreakdownItem[]> {
  const rows = await queryRows<{
    classe: string | null;
    quantidade: string | number;
    valor_total: string | number;
    empresas: string | number;
  }>(
    `
      SELECT
        classe,
        COUNT(*) AS quantidade,
        COALESCE(SUM(valor), 0) AS valor_total,
        COUNT(DISTINCT nome_da_empresa) AS empresas
      FROM administradores_judiciais.credores
      GROUP BY classe
    `,
  );

  // Normalize classe labels in JS (reuses existing normalizeClasse logic)
  const map = new Map<string, ClasseBreakdownItem>();
  for (const row of rows) {
    const key = normalizeClasse(row.classe ?? "");
    const existing = map.get(key) ?? { classe: key, quantidade: 0, valorTotal: 0, empresas: 0 };
    existing.quantidade += Number.parseInt(String(row.quantidade ?? 0), 10) || 0;
    existing.valorTotal += toNumber(row.valor_total);
    // empresas is a distinct count per raw classe — approximate by taking max
    existing.empresas = Math.max(existing.empresas, Number.parseInt(String(row.empresas ?? 0), 10) || 0);
    map.set(key, existing);
  }

  return Array.from(map.values())
    .filter((item) => ["I", "II", "III", "IV"].includes(item.classe))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

export async function loadOverview(): Promise<OverviewData> {
  const [loadedAt, companies, topClasses, classeBreakdown] = await Promise.all([
    loadLoadedAt(),
    loadCompanySummaries(),
    loadTopClasses(),
    loadClasseBreakdown(),
  ]);
  const companiesWithCreditors = companies.filter((company) => company.quantidadeCredores > 0);
  const totalCreditAllCompanies = companiesWithCreditors.reduce((acc, company) => acc + company.totalCredito, 0);
  const totalPerCompany = companiesWithCreditors.map((item) => item.totalCredito).filter((value) => value > 0);
  const ajCounter = new Map<string, number>();
  const groupCounter = new Set<string>();
  for (const company of companies) {
    if (company.grupoEconomico) {
      groupCounter.add(company.grupoEconomico);
    }
    ajCounter.set(company.administradorJudicial, (ajCounter.get(company.administradorJudicial) ?? 0) + 1);
  }

  return {
    loadedAt,
    totalEmpresas: companies.length,
    totalEmpresasComCredores: companiesWithCreditors.length,
    totalGruposEconomicos: groupCounter.size,
    valorTotalCredito: totalCreditAllCompanies,
    mediaValorPorEmpresa: companiesWithCreditors.length > 0 ? totalCreditAllCompanies / companiesWithCreditors.length : 0,
    medianaValorPorEmpresa: median(totalPerCompany),
    topAdministradoresJudiciais: Array.from(ajCounter.entries())
      .map(([nome, empresas]) => ({ nome, empresas }))
      .sort((a, b) => b.empresas - a.empresas)
      .slice(0, 8),
    topClasses,
    topEmpresasPorCredito: companiesWithCreditors
      .sort((a, b) => b.totalCredito - a.totalCredito)
      .slice(0, 10)
      .map((c) => ({ nome: c.nomeEmpresa, totalCredito: c.totalCredito })),
    classeBreakdown,
  };
}

export async function loadCompanies(): Promise<CompanyItem[]> {
  const companies = await loadCompanySummaries();
  return companies.sort((a, b) => b.totalCredito - a.totalCredito || a.nomeEmpresa.localeCompare(b.nomeEmpresa));
}

export async function loadCompanyDetail(slug: string): Promise<CompanyDetail | null> {
  const companies = await loadCompanies();
  const company = companies.find((item) => item.slug === slug);
  if (!company) {
    return null;
  }

  const scoredCreditors = scoreCreditors(await loadCompanyCreditors(company));
  const values = scoredCreditors.map((item) => item.valor);
  const ranking = [...scoredCreditors]
    .filter((creditor) => creditor.score > 0)
    .sort((a, b) => b.score - a.score || b.valor - a.valor)
    .slice(0, 30);

  const distributionMap = new Map<string, { total: number; quantidade: number }>();
  for (const creditor of scoredCreditors) {
    const classe = creditor.classe || "N/A";
    const current = distributionMap.get(classe) ?? { total: 0, quantidade: 0 };
    current.total += creditor.valor;
    current.quantidade += 1;
    distributionMap.set(classe, current);
  }

  const distributionByClasse = Array.from(distributionMap.entries())
    .map(([classe, metrics]) => ({
      classe,
      total: metrics.total,
      quantidade: metrics.quantidade,
    }))
    .sort((a, b) => b.total - a.total);

  const eligibleCreditors = scoredCreditors.filter((c) => c.elegivel);
  const enrichedCompany: CompanyItem = {
    ...company,
    valorMediano: median(values),
    scoreMedio:
      eligibleCreditors.length > 0
        ? eligibleCreditors.reduce((acc, item) => acc + item.score, 0) / eligibleCreditors.length
        : 0,
  };

  return {
    company: enrichedCompany,
    ranking,
    credores: scoredCreditors,
    distributionByClasse,
  };
}

export async function loadCredorRJDetail(hash: string): Promise<CredorRJDetail | null> {
  type CredorRow = {
    row_hash: string;
    nome: string;
    cpf_cnpj: string | null;
    classe: string | null;
    valor: string;
    moeda: string | null;
    extra: string | null;
    nome_da_empresa: string;
    grupo_economico: string | null;
    administrador_judicial: string | null;
    data_do_documento: string | null;
    data_homologacao: string | null;
    link_credores: string | null;
  };

  const rows = await queryRows<CredorRow>(
    `
      SELECT
        c.row_hash,
        c.nome,
        c.cpf_cnpj,
        c.classe,
        c.valor::text AS valor,
        c.moeda,
        c.extra,
        d.nome_da_empresa,
        ${cleanGrupoEconomicoSql("d.grupo_economico")} AS grupo_economico,
        d.administrador_judicial,
        d.data_do_documento::text AS data_do_documento,
        d.data_homologacao::text AS data_homologacao,
        d.link_credores
      FROM administradores_judiciais.credores c
      JOIN administradores_judiciais.documentos d ON d.pdf_sha256 = c.pdf_sha256
      WHERE c.row_hash = $1
      LIMIT 1
    `,
    [hash],
  );

  if (rows.length === 0) return null;
  const row = rows[0]!;

  const cpfCnpj = row.cpf_cnpj ?? "";

  type OutraEmpresaRow = {
    nome_da_empresa: string;
    grupo_economico: string | null;
    classe: string | null;
    valor: string;
    row_hash: string;
  };

  const outrasPromise = queryRows<OutraEmpresaRow>(
    `
      SELECT DISTINCT
        d.nome_da_empresa,
        ${cleanGrupoEconomicoSql("d.grupo_economico")} AS grupo_economico,
        c.classe,
        c.valor::text AS valor,
        c.row_hash
      FROM administradores_judiciais.credores c
      JOIN administradores_judiciais.documentos d ON d.pdf_sha256 = c.pdf_sha256
      WHERE c.row_hash != $1
        AND (c.nome = $2 OR ($3 != '' AND c.cpf_cnpj = $3))
      ORDER BY c.valor DESC
      LIMIT 20
    `,
    [hash, row.nome, hasValidCpfCnpj(cpfCnpj) ? cpfCnpj : ""],
  );

  const outrasRows = await outrasPromise;

  const empresa = {
    nomeEmpresa: row.nome_da_empresa,
    grupoEconomico: row.grupo_economico ?? "",
    administradorJudicial: row.administrador_judicial?.trim() || "Não informado",
    dataHomologacao: row.data_homologacao ?? "",
    dataDocumento: row.data_do_documento ?? "",
    linkCredores: row.link_credores ?? "",
    slug: buildCompanySlug(row.nome_da_empresa, row.grupo_economico ?? ""),
  };

  const baseCreditor = {
    rowHash: row.row_hash,
    nome: row.nome,
    cpfCnpj,
    tipoPessoa: parseDocType(cpfCnpj),
    classe: row.classe ?? "N/A",
    valor: toNumber(row.valor),
    moeda: row.moeda ?? "BRL",
    extra: row.extra ?? "",
    telefones: [],
    empresa: {
      nomeEmpresa: empresa.nomeEmpresa,
      dataHomologacao: empresa.dataHomologacao,
    },
  };
  const scored = await scoreCredorRJDetail(baseCreditor);

  return {
    rowHash: baseCreditor.rowHash,
    nome: baseCreditor.nome,
    cpfCnpj: baseCreditor.cpfCnpj,
    tipoPessoa: baseCreditor.tipoPessoa,
    classe: baseCreditor.classe,
    valor: baseCreditor.valor,
    moeda: baseCreditor.moeda,
    extra: baseCreditor.extra,
    telefones: [],
    score: scored.score,
    scoreAtivo: scored.scoreAtivo,
    scoreDevedor: scored.scoreDevedor,
    scoreCredit: scored.scoreCredit,
    status: scored.status,
    desagioRec: scored.desagioRec,
    elegivel: scored.elegivel,
    scoreBreakdown: scored.scoreBreakdown,
    prospectDetails: scored.prospectDetails,
    empresa,
    outrasEmpresas: outrasRows.map((r) => ({
      nomeEmpresa: r.nome_da_empresa,
      grupoEconomico: r.grupo_economico ?? "",
      slug: buildCompanySlug(r.nome_da_empresa, r.grupo_economico ?? ""),
      valor: toNumber(r.valor),
      classe: r.classe ?? "N/A",
      rowHash: r.row_hash,
    })),
  };
}

export async function loadCredorPhones(hash: string): Promise<string[]> {
  const rows = await queryRows<{ nome: string; cpf_cnpj: string | null }>(
    `SELECT nome, cpf_cnpj FROM administradores_judiciais.credores WHERE row_hash = $1 LIMIT 1`,
    [hash],
  );
  if (rows.length === 0) return [];
  const nome = rows[0]!.nome;
  const cpfCnpj = rows[0]!.cpf_cnpj ?? "";
  const phoneMap = await loadPhonesByContacts([{ name: nome, document: cpfCnpj }]).catch(() => new Map<string, string[]>());
  return phoneMap.get(normalizeNameForMatch(nome)) ?? [];
}

export type ParenteItem = {
  nome: string;
  cpfMasked: string;
  municipio: string;
  uf: string;
  rendaAnualEstimada: number | null;
  rendaAnoReferencia: number | null;
  beneficiarioProgramaSocial: boolean;
  programaSocialDescricao: string;
};

export type ParentesResult = {
  credorNome: string;
  parentes: ParenteItem[];
};

// Extract last word of a name as the surname for matching
function extractSobrenome(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "***.***.***-**";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export async function loadCredorParentes(hash: string): Promise<ParentesResult | null> {
  const credorRows = await queryRows<{ nome: string; cpf_cnpj: string | null }>(
    `SELECT nome, cpf_cnpj FROM administradores_judiciais.credores WHERE row_hash = $1 LIMIT 1`,
    [hash],
  );
  if (credorRows.length === 0) return null;

  const credorNome = credorRows[0]!.nome;
  const cpf = (credorRows[0]!.cpf_cnpj ?? "").replace(/\D/g, "");

  // Only PF (11-digit CPF) has reliable family data
  if (cpf.length !== 11) {
    return { credorNome, parentes: [] };
  }

  // 1. Get creditor's address from Receita Federal
  const pfRows = await queryRows<{ cep: string | null; municipio: string | null; uf: string | null }>(
    `SELECT cep, municipio, uf FROM receita_federal.pessoa_fisica WHERE cpf = $1 LIMIT 1`,
    [cpf],
  ).catch(() => []);

  const cep = (pfRows[0]?.cep ?? "").replace(/\D/g, "");
  const municipio = pfRows[0]?.municipio ?? "";

  if (!cep && !municipio) {
    return { credorNome, parentes: [] };
  }

  const sobrenome = normalizeNameForMatch(extractSobrenome(credorNome));
  if (!sobrenome || sobrenome.length < 3) {
    return { credorNome, parentes: [] };
  }

  // 2. Find people at same address with same surname (potential family)
  type PfRelRow = { cpf: string; nome: string; municipio: string | null; uf: string | null };
  const condition = cep
    ? `REGEXP_REPLACE(COALESCE(cep, ''), '\\\\D', '') = $2`
    : `UPPER(TRIM(municipio)) = UPPER(TRIM($2))`;
  const conditionValue = cep || municipio;

  const relRows = await queryRows<PfRelRow>(
    `
      SELECT cpf, nome, municipio, uf
      FROM receita_federal.pessoa_fisica
      WHERE cpf != $1
        AND ${condition}
        AND UPPER(TRIM(nome)) LIKE '%' || $3 || '%'
      LIMIT 20
    `,
    [cpf, conditionValue, sobrenome],
  ).catch(() => [] as PfRelRow[]);

  if (relRows.length === 0) {
    return { credorNome, parentes: [] };
  }

  // 3. For each relative, fetch income and social program in parallel
  const parentes: ParenteItem[] = await Promise.all(
    relRows.map(async (rel) => {
      const relCpf = rel.cpf.replace(/\D/g, "");

      const [rendaRows, benefitRows] = await Promise.all([
        queryRows<{ ganho: string | number; ano: string | number }>(
          `SELECT ganho, ano FROM renda.ganho_anual_pf_emprego WHERE cpf = $1 ORDER BY ano DESC LIMIT 1`,
          [relCpf],
        ).catch(() => []),
        queryRows<{ ano_referencia: string | number | null; beneficios: string | null }>(
          `
            SELECT MAX(ano_referencia) AS ano_referencia,
                   LISTAGG(DISTINCT nome_beneficio, ', ') WITHIN GROUP (ORDER BY nome_beneficio) AS beneficios
            FROM transparencia.beneficiarios_sociais_resultado_por_ano
            WHERE cpf = $1
              AND ano_referencia = (SELECT MAX(ano_referencia) FROM transparencia.beneficiarios_sociais_resultado_por_ano WHERE cpf = $1)
          `,
          [relCpf],
        ).catch(() => []),
      ]);

      const isBeneficiary = benefitRows.length > 0 && benefitRows[0]?.ano_referencia != null;

      return {
        nome: rel.nome,
        cpfMasked: maskCpf(relCpf),
        municipio: rel.municipio ?? "",
        uf: rel.uf ?? "",
        rendaAnualEstimada: rendaRows.length > 0 ? toNumber(rendaRows[0]?.ganho) : null,
        rendaAnoReferencia: rendaRows.length > 0 ? Number.parseInt(String(rendaRows[0]?.ano ?? 0), 10) || null : null,
        beneficiarioProgramaSocial: isBeneficiary,
        programaSocialDescricao: (benefitRows[0]?.beneficios ?? "").trim(),
      };
    }),
  );

  return { credorNome, parentes };
}

export { buildCompanySlug };
