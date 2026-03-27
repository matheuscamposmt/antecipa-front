import { loadPhonesByNames, normalizeNameForMatch, queryRows, toNumber } from "./redshift.js";

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
  scoreBreakdown: {
    ativo: { classe: number; documento: number; sinais: number; total: number };
    devedor: { faixa: number; total: number };
    credor: { tipoPessoa: number; valor: number; total: number };
  };
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
  const digits = cpfCnpj.replace(/\D/g, "");
  if (digits.length === 11) {
    return "PF";
  }
  if (digits.length === 14) {
    return "PJ";
  }
  if (cpfCnpj.includes("/")) {
    return "PJ";
  }
  if (cpfCnpj.includes("-")) {
    return "PF";
  }
  return "OUTRO";
}

function hasValidCpfCnpj(cpfCnpj: string): boolean {
  const digits = cpfCnpj.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
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

export async function loadOverview(): Promise<OverviewData> {
  const [loadedAt, companies, topClasses] = await Promise.all([loadLoadedAt(), loadCompanySummaries(), loadTopClasses()]);
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

  const phoneMap = await loadPhonesByNames([row.nome]);
  const telefones = phoneMap.get(normalizeNameForMatch(row.nome)) ?? [];

  const cpfCnpj = row.cpf_cnpj ?? "";
  const baseCreditor = {
    rowHash: row.row_hash,
    nome: row.nome,
    cpfCnpj,
    tipoPessoa: parseDocType(cpfCnpj),
    classe: row.classe ?? "N/A",
    valor: toNumber(row.valor),
    moeda: row.moeda ?? "BRL",
    extra: row.extra ?? "",
    telefones,
  };
  const [scored] = scoreCreditors([baseCreditor]);
  if (!scored) return null;

  type OutraEmpresaRow = {
    nome_da_empresa: string;
    grupo_economico: string | null;
    classe: string | null;
    valor: string;
    row_hash: string;
  };

  const outrasRows = await queryRows<OutraEmpresaRow>(
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

  const empresa = {
    nomeEmpresa: row.nome_da_empresa,
    grupoEconomico: row.grupo_economico ?? "",
    administradorJudicial: row.administrador_judicial?.trim() || "Não informado",
    dataHomologacao: row.data_homologacao ?? "",
    dataDocumento: row.data_do_documento ?? "",
    linkCredores: row.link_credores ?? "",
    slug: buildCompanySlug(row.nome_da_empresa, row.grupo_economico ?? ""),
  };

  return {
    rowHash: scored.rowHash,
    nome: scored.nome,
    cpfCnpj: scored.cpfCnpj,
    tipoPessoa: scored.tipoPessoa,
    classe: scored.classe,
    valor: scored.valor,
    moeda: scored.moeda,
    extra: scored.extra,
    telefones,
    score: scored.score,
    scoreAtivo: scored.scoreAtivo,
    scoreDevedor: scored.scoreDevedor,
    scoreCredit: scored.scoreCredit,
    status: scored.status,
    desagioRec: scored.desagioRec,
    elegivel: scored.elegivel,
    scoreBreakdown: scored.scoreBreakdown,
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

export { buildCompanySlug };
