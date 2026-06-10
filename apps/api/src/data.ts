import {
  buildCredorScoreDimension,
  type DetailScoreBreakdown,
  type DetailScoreDimension,
  hasValidDocument,
  inferDocType,
  loadProspectDetails,
  type ProspectDetails,
} from "./prospect-enrichment.js";
import { loadPhonesByDocuments, normalizeNameForMatch, queryRows, toNumber } from "./redshift.js";
import { ticketQualificationPoints } from "./scoring.js";
import { clearAllCaches, createCache, DEFAULT_TTL_MS } from "./cache.js";

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

type ScoredCreditorRow = RawCreditorRow & {
  tipo_pessoa: string;
  score: string | number;
  score_ativo: string | number;
  score_devedor: string | number;
  score_credor: string | number;
  has_telefone: boolean | null;
  renda_mensal_aj: string | number | null;
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
  hasTelefone: boolean;
  rendaMensalEstimada: number | null;
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

function computeDevedorDimension(valor: number): DetailScoreDimension {
  const pts = ticketQualificationPoints(valor, 35);
  return {
    total: pts,
    method: "proxy_ticket",
    note: "Faixa de valor do crédito como proxy de risco.",
    items: [{ label: "Faixa de valor do crédito", pts, max: 35 }],
  };
}

async function scoreCredorRJDetail(creditor: {
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "PF" | "PJ" | "OUTRO";
  classe: string;
  valor: number;
  extra: string;
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
  const elegivel = classeNorm === "I" && creditor.valor > 0;

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
          note: "Somente créditos trabalhistas elegíveis entram no índice de originação.",
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
          items: [{ label: "Faixa de valor do crédito", pts: 0, max: 35 }],
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
  const ativo = computeAtivoDimension(creditor);
  const devedor = computeDevedorDimension(creditor.valor);
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
  return creditors.map((creditor) => {
    const classeNorm = normalizeClasse(creditor.classe);
    const elegivel = classeNorm === "I" && creditor.valor > 0;
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

    // Score do Ativo (0–40): certeza jurídica e liquidez
    const classeScore = 20; // Classe I qualifies
    const documentoScore = hasValidDoc ? 12 : 0;
    const sinaisScore = hasRisco ? 0 : 8;
    const scoreAtivo = classeScore + documentoScore + sinaisScore;

    // Score do Devedor (0–35): faixa de ticket comercial, não menor-valor-primeiro
    // TODO: replace with real company health metrics (RCL, homologação, coobrigados)
    const scoreDevedor = ticketQualificationPoints(creditor.valor, 35);

    // Score do Credor (0–25): propensão a ceder
    // TODO: enrich with telecom.contatos (renda, localização, benefícios sociais)
    const tipoPessoaScore = creditor.tipoPessoa === "PF" ? 10 : creditor.tipoPessoa === "PJ" ? 6 : 2;
    const valorPartial = ticketQualificationPoints(creditor.valor, 15);
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

// Caches em memória (TTL curto) no caminho quente. Os dados só mudam quando
// documentos são reprocessados no Redshift; /api/reload limpa todos via
// clearAllCaches(). Veja cache.ts para o racional (1 instância → RAM basta).
const summariesCache = createCache<CompanyItem[]>(DEFAULT_TTL_MS, 1);
const companyDetailCache = createCache<CompanyDetail | null>(DEFAULT_TTL_MS);
const credorDetailCache = createCache<CredorRJDetail | null>(DEFAULT_TTL_MS);
const credorPhonesCache = createCache<string[]>(DEFAULT_TTL_MS);
const credorParentesCache = createCache<ParentesResult | null>(DEFAULT_TTL_MS);
const overviewCache = createCache<OverviewData>(DEFAULT_TTL_MS, 1);

async function loadCompanySummaries(): Promise<CompanyItem[]> {
  return summariesCache.get("all", fetchCompanySummaries);
}

async function fetchCompanySummaries(): Promise<CompanyItem[]> {
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
          SUM(
            CASE
              WHEN COALESCE(d.data_do_documento, d.data_homologacao, d.processed_at::date) >= DATE '2025-06-01'
               AND REGEXP_REPLACE(COALESCE(c.cpf_cnpj, ''), '\\\\D', '') ~ '^\\\\d{11}$'
               AND (
                 UPPER(TRIM(COALESCE(c.classe, ''))) IN ('I', 'CLASSE I')
                 OR UPPER(TRIM(COALESCE(c.classe, ''))) LIKE '%TRABALH%'
                 OR UPPER(TRIM(COALESCE(c.classe, ''))) LIKE 'CLASSE I %'
                 OR UPPER(TRIM(COALESCE(c.classe, ''))) LIKE 'CLASSE I-%'
                 OR UPPER(TRIM(COALESCE(c.classe, ''))) LIKE 'CLASSE I/%'
               )
              THEN 1
              ELSE 0
            END
          ) AS prioridade_credores_trabalhistas_cpf,
          MAX(
            CASE
              WHEN COALESCE(d.data_do_documento, d.data_homologacao, d.processed_at::date) >= DATE '2025-06-01'
              THEN 1
              ELSE 0
            END
          ) AS prioridade_relacao_recente,
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
      ORDER BY
        agg.prioridade_relacao_recente DESC,
        agg.prioridade_credores_trabalhistas_cpf DESC,
        meta.data_referencia_iso DESC,
        agg.total_credito DESC,
        agg.nome_da_empresa ASC
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

function mapScoredRow(row: ScoredCreditorRow): CreditorItem {
  const classeNorm = normalizeClasse(row.classe ?? "");
  const valor = toNumber(row.valor);
  const elegivel = classeNorm === "I" && valor > 0;
  const rawScore = elegivel ? Math.min(100, Math.max(0, toNumber(row.score))) : 0;
  const scoreAtivo = elegivel ? toNumber(row.score_ativo) : 0;
  const scoreDevedor = elegivel ? toNumber(row.score_devedor) : 0;
  const scoreCredit = elegivel ? toNumber(row.score_credor) : 0;
  return {
    rowHash: row.row_hash,
    nome: row.nome || "Credor não identificado",
    cpfCnpj: row.cpf_cnpj ?? "",
    tipoPessoa: row.tipo_pessoa === "PF" || row.tipo_pessoa === "PJ" ? row.tipo_pessoa : "OUTRO",
    classe: row.classe ?? "N/A",
    valor,
    moeda: row.moeda ?? "BRL",
    extra: row.extra ?? "",
    telefones: [],
    hasTelefone: row.has_telefone === true,
    rendaMensalEstimada: row.renda_mensal_aj != null ? toNumber(row.renda_mensal_aj) : null,
    score: rawScore,
    scoreAtivo,
    scoreDevedor,
    scoreCredit,
    status: elegivel ? statusFromScore(rawScore) : "rejeitado",
    desagioRec: elegivel ? desagioFromScore(rawScore) : "Não recomendado",
    elegivel,
    scoreBreakdown: {
      ativo: { classe: 0, documento: 0, sinais: 0, total: scoreAtivo },
      devedor: { faixa: scoreDevedor, total: scoreDevedor },
      credor: { tipoPessoa: 0, valor: 0, total: scoreCredit },
    },
  };
}

async function loadCompanyCreditors(company: CompanyItem): Promise<CreditorItem[]> {
  try {
    const rows = await queryRows<ScoredCreditorRow>(
      `
        SELECT
          row_hash,
          nome,
          cpf_cnpj,
          tipo_pessoa,
          classe,
          valor::text AS valor,
          moeda,
          extra,
          has_telefone,
          renda_mensal_aj,
          score,
          score_ativo,
          score_devedor,
          score_credor
        FROM administradores_judiciais.credores_scored
        WHERE nome_da_empresa = $1
        ORDER BY score DESC, valor DESC, nome ASC
      `,
      [company.nomeEmpresa],
    );
    return rows.map(mapScoredRow);
  } catch {
    // view not yet materialized — fall back to proxy scoring
    const rows = await queryRows<RawCreditorRow>(
      `
        SELECT row_hash, nome, cpf_cnpj, classe, valor::text AS valor, moeda, extra
        FROM administradores_judiciais.credores
        WHERE nome_da_empresa = $1
        ORDER BY valor DESC, nome ASC
      `,
      [company.nomeEmpresa],
    );
    const unscored = rows.map((row) => ({
      rowHash: row.row_hash,
      nome: row.nome || "Credor não identificado",
      cpfCnpj: row.cpf_cnpj ?? "",
      tipoPessoa: parseDocType(row.cpf_cnpj ?? ""),
      classe: row.classe ?? "N/A",
      valor: toNumber(row.valor),
      moeda: row.moeda ?? "BRL",
      extra: row.extra ?? "",
      telefones: [],
      hasTelefone: false,
      rendaMensalEstimada: null,
    }));
    return scoreCreditors(unscored);
  }
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
  return overviewCache.get("all", fetchOverview);
}

async function fetchOverview(): Promise<OverviewData> {
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
  return loadCompanySummaries();
}

export async function loadCompanyDetail(slug: string): Promise<CompanyDetail | null> {
  return companyDetailCache.get(slug, () => fetchCompanyDetail(slug));
}

async function fetchCompanyDetail(slug: string): Promise<CompanyDetail | null> {
  const companies = await loadCompanies();
  const company = companies.find((item) => item.slug === slug);
  if (!company) {
    return null;
  }

  const scoredCreditors = await loadCompanyCreditors(company);
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
  return credorDetailCache.get(hash, () => fetchCredorRJDetail(hash));
}

async function fetchCredorRJDetail(hash: string): Promise<CredorRJDetail | null> {
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
  return credorPhonesCache.get(hash, () => fetchCredorPhones(hash));
}

async function fetchCredorPhones(hash: string): Promise<string[]> {
  const rows = await queryRows<{ nome: string; cpf_cnpj: string | null }>(
    `SELECT nome, cpf_cnpj FROM administradores_judiciais.credores WHERE row_hash = $1 LIMIT 1`,
    [hash],
  );
  if (rows.length === 0) return [];
  const cpfCnpj = rows[0]!.cpf_cnpj ?? "";
  const documentKey = cpfCnpj.replace(/\D/g, "");
  if (documentKey.length !== 11 && documentKey.length !== 14) {
    return [];
  }
  const phoneMap = await loadPhonesByDocuments([documentKey]).catch(() => new Map<string, string[]>());
  return phoneMap.get(documentKey) ?? [];
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
  return credorParentesCache.get(hash, () => fetchCredorParentes(hash));
}

async function fetchCredorParentes(hash: string): Promise<ParentesResult | null> {
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

  // 3. Fetch income + social program for ALL relatives in two batched queries.
  // Antes eram 2×N queries paralelas (até 40 por request), o que sozinho
  // esgotava o pool de conexões e travava o sistema sob concorrência.
  const relCpfs = Array.from(new Set(relRows.map((rel) => rel.cpf.replace(/\D/g, "")))).filter(
    (cpf) => cpf.length === 11,
  );

  const rendaByCpf = new Map<string, { ganho: string | number; ano: string | number }>();
  const benefitByCpf = new Map<string, { ano_referencia: string | number | null; beneficios: string | null }>();

  if (relCpfs.length > 0) {
    const placeholders = relCpfs.map((_, index) => `$${index + 1}`).join(", ");

    const [rendaRows, benefitRows] = await Promise.all([
      queryRows<{ cpf: string; ganho: string | number; ano: string | number }>(
        `
          SELECT cpf, ganho, ano
          FROM (
            SELECT cpf, ganho, ano,
                   ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY ano DESC, ganho DESC) AS rn
            FROM renda.ganho_anual_pf_emprego
            WHERE cpf IN (${placeholders})
          ) t
          WHERE rn = 1
        `,
        relCpfs,
      ).catch(() => [] as Array<{ cpf: string; ganho: string | number; ano: string | number }>),
      queryRows<{ cpf: string; ano_referencia: string | number | null; beneficios: string | null }>(
        `
          WITH latest AS (
            SELECT cpf, MAX(ano_referencia) AS max_ano
            FROM transparencia.beneficiarios_sociais_resultado_por_ano
            WHERE cpf IN (${placeholders})
            GROUP BY cpf
          )
          SELECT b.cpf,
                 l.max_ano AS ano_referencia,
                 LISTAGG(DISTINCT b.nome_beneficio, ', ') WITHIN GROUP (ORDER BY b.nome_beneficio) AS beneficios
          FROM transparencia.beneficiarios_sociais_resultado_por_ano b
          JOIN latest l ON l.cpf = b.cpf AND b.ano_referencia = l.max_ano
          GROUP BY b.cpf, l.max_ano
        `,
        relCpfs,
      ).catch(() => [] as Array<{ cpf: string; ano_referencia: string | number | null; beneficios: string | null }>),
    ]);

    for (const row of rendaRows) {
      rendaByCpf.set(String(row.cpf).replace(/\D/g, ""), { ganho: row.ganho, ano: row.ano });
    }
    for (const row of benefitRows) {
      benefitByCpf.set(String(row.cpf).replace(/\D/g, ""), {
        ano_referencia: row.ano_referencia,
        beneficios: row.beneficios,
      });
    }
  }

  const parentes: ParenteItem[] = relRows.map((rel) => {
    const relCpf = rel.cpf.replace(/\D/g, "");
    const renda = rendaByCpf.get(relCpf);
    const benefit = benefitByCpf.get(relCpf);
    const isBeneficiary = benefit != null && benefit.ano_referencia != null;

    return {
      nome: rel.nome,
      cpfMasked: maskCpf(relCpf),
      municipio: rel.municipio ?? "",
      uf: rel.uf ?? "",
      rendaAnualEstimada: renda ? toNumber(renda.ganho) : null,
      rendaAnoReferencia: renda ? Number.parseInt(String(renda.ano ?? 0), 10) || null : null,
      beneficiarioProgramaSocial: isBeneficiary,
      programaSocialDescricao: (benefit?.beneficios ?? "").trim(),
    };
  });

  return { credorNome, parentes };
}

export function invalidateCaches(): void {
  clearAllCaches();
}

export { buildCompanySlug };
