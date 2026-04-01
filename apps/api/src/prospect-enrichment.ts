import { buildNameNormalizationSql, normalizeNameForMatch, queryRows, toNumber } from "./redshift.js";

export type DocType = "PF" | "PJ" | "OUTRO";

export type ProspectDetails = {
  rendaAnualEstimada: number | null;
  rendaAnoReferencia: number | null;
  beneficiarioProgramaSocial: boolean | null;
  programaSocialDescricao: string;
  programaSocialAnoReferencia: number | null;
  localizacao: {
    uf: string;
    municipio: string;
    bairro: string;
    cep: string;
    rendaPerCapita: number | null;
  };
  homonimo: {
    risco: "baixo" | "medio" | "alto";
    quantidade: number;
    criterio: string;
    observacao: string;
  };
};

export type ScoreBreakdownItem = {
  label: string;
  pts: number;
  max: number;
};

export type DetailScoreDimension = {
  total: number;
  method: string;
  note: string;
  items: ScoreBreakdownItem[];
};

export type DetailScoreBreakdown = {
  ativo: DetailScoreDimension;
  devedor: DetailScoreDimension;
  credor: DetailScoreDimension;
};

export type CompanyPgfnContext = {
  cnpjBasico: string;
  matchMethod: "razao_social_exata";
  quantidadeInscricoes: number;
  valorConsolidado: number;
};

type ReceitaPfRow = {
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
};

type ReceitaPjRow = {
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
};

type RendaPfRow = {
  ganho: string | number;
  ano: string | number;
};

type BenefitYearRow = {
  ano_referencia: string | number | null;
};

type BenefitNamesRow = {
  beneficios: string | null;
};

type CepIncomeRow = {
  renda_per_capita: string | number | null;
};

type CountRow = {
  total: string | number;
};

type CnpjBasicoRow = {
  cnpj_basico: string | null;
};

type PgfnRow = {
  quantidade_inscricoes: string | number;
  valor_consolidado: string | number | null;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function inferDocType(documento: string): DocType {
  const digits = onlyDigits(documento);
  if (digits.length === 11) return "PF";
  if (digits.length === 14) return "PJ";
  return "OUTRO";
}

export function hasValidDocument(documento: string): boolean {
  const digits = onlyDigits(documento);
  return digits.length === 11 || digits.length === 14;
}

function rendaScore(value: number | null): number | null {
  if (value === null) return null;
  if (value <= 24_000) return 10;
  if (value <= 60_000) return 8;
  if (value <= 120_000) return 5;
  return 2;
}

function benefitsScore(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 8 : 2;
}

function locationScore(rendaPerCapita: number | null): number | null {
  if (rendaPerCapita === null) return null;
  if (rendaPerCapita <= 900) return 7;
  if (rendaPerCapita <= 1_800) return 5;
  if (rendaPerCapita <= 3_000) return 3;
  return 1;
}

function proxyTipoPessoaScore(tipoPessoa: DocType): number {
  if (tipoPessoa === "PF") return 10;
  if (tipoPessoa === "PJ") return 6;
  return 2;
}

function proxyValorScore(valor: number): number {
  if (valor > 500_000) return 15;
  if (valor >= 100_000) return 12;
  if (valor >= 50_000) return 8;
  if (valor >= 10_000) return 5;
  return 2;
}

async function loadRendaPerCapitaByCep(cep: string): Promise<number | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) {
    return null;
  }

  const rows = await queryRows<CepIncomeRow>(
    `
      SELECT renda_per_capita
      FROM renda.renda_cep
      WHERE cep = $1
      LIMIT 1
    `,
    [digits],
  );
  return rows.length > 0 ? toNumber(rows[0]?.renda_per_capita) : null;
}

async function countHomonyms(name: string, tipoPessoa: DocType): Promise<number> {
  const normalized = normalizeNameForMatch(name);
  if (!normalized) {
    return 0;
  }

  if (tipoPessoa === "PF") {
    const rows = await queryRows<CountRow>(
      `
        SELECT COUNT(*) AS total
        FROM receita_federal.pessoa_fisica
        WHERE ${buildNameNormalizationSql("nome")} = $1
      `,
      [normalized],
    );
    return Number.parseInt(String(rows[0]?.total ?? 0), 10) || 0;
  }

  if (tipoPessoa === "PJ") {
    const rows = await queryRows<CountRow>(
      `
        SELECT COUNT(DISTINCT cnpj_basico) AS total
        FROM receita_federal.pessoa_juridica
        WHERE ${buildNameNormalizationSql("razao_social")} = $1
      `,
      [normalized],
    );
    return Number.parseInt(String(rows[0]?.total ?? 0), 10) || 0;
  }

  return 0;
}

export async function loadProspectDetails(params: {
  nome: string;
  documento: string;
  tipoPessoa: DocType;
}): Promise<ProspectDetails> {
  const documento = onlyDigits(params.documento);
  const documentoValido = hasValidDocument(documento);
  const tipoPessoa = params.tipoPessoa;

  const base: ProspectDetails = {
    rendaAnualEstimada: null,
    rendaAnoReferencia: null,
    beneficiarioProgramaSocial: null,
    programaSocialDescricao: "",
    programaSocialAnoReferencia: null,
    localizacao: {
      uf: "",
      municipio: "",
      bairro: "",
      cep: "",
      rendaPerCapita: null,
    },
    homonimo: {
      risco: "baixo",
      quantidade: 0,
      criterio: documentoValido ? "documento" : "nome_exato",
      observacao: documentoValido
        ? "Enriquecimento feito com CPF/CNPJ."
        : "Sem CPF/CNPJ confiável, o enriquecimento por nome foi bloqueado para evitar mistura de homônimos.",
    },
  };

  if (!documentoValido) {
    const quantidade = await countHomonyms(params.nome, tipoPessoa);
    return {
      ...base,
      homonimo: {
        risco: quantidade > 10 ? "alto" : quantidade > 1 ? "medio" : "baixo",
        quantidade,
        criterio: "nome_exato",
        observacao:
          quantidade > 1
            ? "Nome potencialmente comum; sem documento confiável, a plataforma evita anexar enriquecimento de terceiros."
            : "Sem documento confiável; nenhum enriquecimento externo foi anexado.",
      },
    };
  }

  if (tipoPessoa === "PF") {
    const [pfRows, rendaRows, benefitYearRows] = await Promise.all([
      queryRows<ReceitaPfRow>(
        `
          SELECT bairro, cep, municipio, uf
          FROM receita_federal.pessoa_fisica
          WHERE cpf = $1
          LIMIT 1
        `,
        [documento],
      ),
      queryRows<RendaPfRow>(
        `
          SELECT ganho, ano
          FROM renda.ganho_anual_pf_emprego
          WHERE cpf = $1
          ORDER BY ano DESC, ganho DESC
          LIMIT 1
        `,
        [documento],
      ),
      queryRows<BenefitYearRow>(
        `
          SELECT MAX(ano_referencia) AS ano_referencia
          FROM transparencia.beneficiarios_sociais_resultado_por_ano
          WHERE cpf = $1
        `,
        [documento],
      ),
    ]);

    const latestBenefitYear = benefitYearRows[0]?.ano_referencia
      ? Number.parseInt(String(benefitYearRows[0].ano_referencia), 10) || null
      : null;

    const benefitNamesRows =
      latestBenefitYear === null
        ? []
        : await queryRows<BenefitNamesRow>(
            `
              SELECT LISTAGG(nome_beneficio, ', ') WITHIN GROUP (ORDER BY nome_beneficio) AS beneficios
              FROM (
                SELECT DISTINCT nome_beneficio
                FROM transparencia.beneficiarios_sociais_resultado_por_ano
                WHERE cpf = $1 AND ano_referencia = $2
              ) beneficios
            `,
            [documento, latestBenefitYear],
          );

    const pf = pfRows[0];
    const cep = cleanText(pf?.cep);
    const rendaPerCapita = await loadRendaPerCapitaByCep(cep);

    return {
      rendaAnualEstimada: rendaRows.length > 0 ? toNumber(rendaRows[0]?.ganho) : null,
      rendaAnoReferencia: rendaRows.length > 0 ? Number.parseInt(String(rendaRows[0]?.ano ?? 0), 10) || null : null,
      beneficiarioProgramaSocial: latestBenefitYear !== null,
      programaSocialDescricao: cleanText(benefitNamesRows[0]?.beneficios),
      programaSocialAnoReferencia: latestBenefitYear,
      localizacao: {
        uf: cleanText(pf?.uf),
        municipio: cleanText(pf?.municipio),
        bairro: cleanText(pf?.bairro),
        cep,
        rendaPerCapita,
      },
      homonimo: base.homonimo,
    };
  }

  if (tipoPessoa === "PJ") {
    const pjRows = await queryRows<ReceitaPjRow>(
      `
        SELECT bairro, cep, municipio, uf
        FROM receita_federal.pessoa_juridica
        WHERE cnpj = $1
        LIMIT 1
      `,
      [documento],
    );
    const pj = pjRows[0];
    const cep = cleanText(pj?.cep);
    const rendaPerCapita = await loadRendaPerCapitaByCep(cep);

    return {
      ...base,
      localizacao: {
        uf: cleanText(pj?.uf),
        municipio: cleanText(pj?.municipio),
        bairro: cleanText(pj?.bairro),
        cep,
        rendaPerCapita,
      },
    };
  }

  return base;
}

export function buildCredorScoreDimension(params: {
  tipoPessoa: DocType;
  valor: number;
  prospect: ProspectDetails;
}): DetailScoreDimension {
  const { tipoPessoa, valor, prospect } = params;
  const rendaPts = rendaScore(prospect.rendaAnualEstimada);
  const beneficiosPts = benefitsScore(prospect.beneficiarioProgramaSocial);
  const localizacaoPts = locationScore(prospect.localizacao.rendaPerCapita);
  const realSignals = [rendaPts, beneficiosPts, localizacaoPts].filter((value) => value !== null).length;

  if (tipoPessoa !== "PF") {
    const tipoPessoaPts = proxyTipoPessoaScore(tipoPessoa);
    const valorPts = proxyValorScore(valor);
    return {
      total: tipoPessoaPts + valorPts,
      method: tipoPessoa === "PJ" ? "proxy_pj" : "proxy_outro",
      note: "Renda e benefício social entraram só para pessoa física nesta etapa.",
      items: [
        { label: "Tipo de pessoa", pts: tipoPessoaPts, max: 10 },
        { label: "Faixa de valor", pts: valorPts, max: 15 },
      ],
    };
  }

  if (realSignals === 0) {
    const tipoPessoaPts = proxyTipoPessoaScore(tipoPessoa);
    const valorPts = proxyValorScore(valor);
    return {
      total: tipoPessoaPts + valorPts,
      method: "proxy_pf",
      note: "Sem renda, benefício ou localização confiáveis; score do credor manteve o proxy legado.",
      items: [
        { label: "Tipo de pessoa", pts: tipoPessoaPts, max: 10 },
        { label: "Faixa de valor", pts: valorPts, max: 15 },
      ],
    };
  }

  const rendaFinal = rendaPts ?? 5;
  const beneficiosFinal = beneficiosPts ?? 4;
  const localizacaoFinal = localizacaoPts ?? 3;
  return {
    total: rendaFinal + beneficiosFinal + localizacaoFinal,
    method: realSignals === 3 ? "real_pf" : "hibrido_pf",
    note:
      realSignals === 3
        ? "Score do credor baseado em renda, benefícios sociais e renda per capita do CEP."
        : "Score híbrido: sinais reais disponíveis completados com pontos neutros quando faltou dado confiável.",
    items: [
      { label: "Renda anual estimada", pts: rendaFinal, max: 10 },
      { label: "Programas sociais", pts: beneficiosFinal, max: 8 },
      { label: "Localização / CEP", pts: localizacaoFinal, max: 7 },
    ],
  };
}

export async function loadCompanyPgfnContext(companyName: string): Promise<CompanyPgfnContext | null> {
  if (!normalizeNameForMatch(companyName)) {
    return null;
  }

  const matches = await queryRows<CnpjBasicoRow>(
    `
      SELECT DISTINCT cnpj_basico
      FROM receita_federal.pessoa_juridica
      WHERE (
        razao_social = $1
        OR UPPER(TRIM(razao_social)) = UPPER(TRIM($2))
      )
        AND cnpj_basico IS NOT NULL
      LIMIT 2
    `,
    [companyName, companyName],
  );

  if (matches.length !== 1 || !matches[0]?.cnpj_basico) {
    return null;
  }

  const cnpjBasico = matches[0].cnpj_basico;
  const pgfnRows = await queryRows<PgfnRow>(
    `
      SELECT
        COUNT(*) AS quantidade_inscricoes,
        COALESCE(SUM(valor_consolidado), 0) AS valor_consolidado
      FROM transparencia.pgfn_devedor
      WHERE LEFT(REGEXP_REPLACE(COALESCE(cpf_cnpj, ''), '\\\\D', ''), 8) = $1
    `,
    [cnpjBasico],
  );

  return {
    cnpjBasico,
    matchMethod: "razao_social_exata",
    quantidadeInscricoes: Number.parseInt(String(pgfnRows[0]?.quantidade_inscricoes ?? 0), 10) || 0,
    valorConsolidado: toNumber(pgfnRows[0]?.valor_consolidado),
  };
}
