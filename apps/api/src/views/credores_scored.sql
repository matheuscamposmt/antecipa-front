-- Materialized view that joins administradores_judiciais.credores with
-- enrichment tables (renda, benefícios sociais, localização) and pre-computes
-- all score components. Mirrors the TypeScript scoring logic in
-- prospect-enrichment.ts so that the bulk creditors list and the creditor
-- detail page share a single formula.
--
-- Score dimensions (total 0–100):
--   Ativo   (0–40): classe trabalhista + documento válido + sem contestação
--   Devedor (0–35): faixa de ticket (proxy; detail page adds PGFN + plano)
--   Credor  (0–25):
--     PF com dados reais → renda mensal(7) + benefícios(2) + CEP(3) + ticket(13)
--     PF sem dados       → tipoPessoa(10) + ticket(15)
--     PJ                 → tipoPessoa(6)  + ticket(15)
--
-- Ajuste inflacionário: IPCA 5,5% a.a. conservador
--   Renda PF:           anoRef → 2026  → POWER(1.055, 2026 - ano_ref)
--   Renda per capita:   censo 2010 → 2026 → POWER(1.055, 16)
--
-- Refresh:
--   REFRESH MATERIALIZED VIEW administradores_judiciais.credores_scored;

DROP MATERIALIZED VIEW IF EXISTS administradores_judiciais.credores_scored;

CREATE MATERIALIZED VIEW administradores_judiciais.credores_scored
AUTO REFRESH NO
AS
WITH

-- ── Base: limpeza de CPF/CNPJ ──────────────────────────────────────────────
base AS (
  SELECT
    row_hash,
    nome_da_empresa,
    nome,
    cpf_cnpj,
    classe,
    valor::NUMERIC                                                        AS valor,
    moeda,
    extra,
    REGEXP_REPLACE(COALESCE(cpf_cnpj, ''), '\\D', '')                    AS doc_digits
  FROM administradores_judiciais.credores
),

-- ── Tipo de pessoa por comprimento do documento ────────────────────────────
typed AS (
  SELECT
    *,
    CASE
      WHEN LENGTH(doc_digits) = 11 THEN 'PF'
      WHEN LENGTH(doc_digits) = 14 THEN 'PJ'
      ELSE 'OUTRO'
    END AS tipo_pessoa
  FROM base
),

-- ── Localização PF (uma linha por CPF) ────────────────────────────────────
rf_pf AS (
  SELECT cpf,
         REGEXP_REPLACE(COALESCE(cep, ''), '\\D', '') AS cep_digits,
         municipio,
         uf
  FROM (
    SELECT cpf, cep, municipio, uf,
           ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY cpf) AS rn
    FROM receita_federal.pessoa_fisica
  ) t
  WHERE rn = 1
),

-- ── Renda anual mais recente por CPF ──────────────────────────────────────
renda_pf AS (
  SELECT cpf,
         ganho::NUMERIC AS ganho,
         ano::INT       AS ano
  FROM (
    SELECT cpf, ganho, ano,
           ROW_NUMBER() OVER (
             PARTITION BY cpf
             ORDER BY ano::INT DESC, ganho::NUMERIC DESC
           ) AS rn
    FROM renda.ganho_anual_pf_emprego
    WHERE ganho IS NOT NULL
  ) t
  WHERE rn = 1
),

-- ── Benefícios sociais (ano mais recente por CPF) ─────────────────────────
beneficios_pf AS (
  SELECT cpf,
         CASE WHEN MAX(ano_referencia) IS NOT NULL THEN TRUE ELSE FALSE END AS is_beneficiario
  FROM transparencia.beneficiarios_sociais_resultado_por_ano
  GROUP BY cpf
),

-- ── Renda per capita do CEP (censo 2010) ──────────────────────────────────
cep_renda AS (
  SELECT cep,
         renda_per_capita::NUMERIC AS renda_per_capita
  FROM renda.renda_cep
  WHERE renda_per_capita IS NOT NULL
),

-- ── Flag: tem telefone cadastrado em telecom.contatos ─────────────────────
phones AS (
  SELECT DISTINCT REGEXP_REPLACE(COALESCE(documento, ''), '\\D', '') AS doc_digits
  FROM telecom.contatos
  WHERE telefone IS NOT NULL
    AND documento IS NOT NULL
),

-- ── Join de enriquecimento ────────────────────────────────────────────────
enriched AS (
  SELECT
    t.*,
    r.ganho                                            AS renda_anual,
    r.ano                                              AS renda_ano_ref,
    bv.is_beneficiario,
    cr.renda_per_capita,
    CASE WHEN ph.doc_digits IS NOT NULL THEN TRUE ELSE FALSE END AS has_telefone
  FROM typed t
  LEFT JOIN rf_pf         pf ON t.doc_digits = pf.cpf            AND t.tipo_pessoa = 'PF'
  LEFT JOIN renda_pf      r  ON t.doc_digits = r.cpf             AND t.tipo_pessoa = 'PF'
  LEFT JOIN beneficios_pf bv ON t.doc_digits = bv.cpf            AND t.tipo_pessoa = 'PF'
  LEFT JOIN cep_renda     cr ON pf.cep_digits = cr.cep
  LEFT JOIN phones        ph ON t.doc_digits = ph.doc_digits
),

-- ── Valores ajustados pela inflação ───────────────────────────────────────
adjusted AS (
  SELECT
    *,
    -- Renda mensal ajustada de anoRef até 2026 (IPCA 5,5% a.a.)
    CASE WHEN renda_anual IS NOT NULL THEN
      renda_anual
      * POWER(1.055, GREATEST(0, 2026 - COALESCE(renda_ano_ref, 2026)))
      / 12.0
    END AS renda_mensal_aj,
    -- Renda per capita do CEP: censo 2010 → 2026 (16 anos)
    CASE WHEN renda_per_capita IS NOT NULL THEN
      renda_per_capita * POWER(1.055, 16)
    END AS cep_renda_aj
  FROM enriched
),

-- ── Sinais brutos (escala original, antes de ponderar) ────────────────────
signals AS (
  SELECT
    *,
    -- Ticket score 0–100 (base compartilhada devedor e credor proxy)
    CASE
      WHEN valor <= 0       THEN 0
      WHEN valor < 25000    THEN 20
      WHEN valor < 75000    THEN 75
      WHEN valor < 250000   THEN 100
      WHEN valor <= 1000000 THEN 85
      ELSE                       60
    END AS ticket_pct,

    -- Renda mensal: inverso — menor renda → maior propensão à cessão (0–10)
    CASE
      WHEN renda_mensal_aj IS NULL   THEN NULL
      WHEN renda_mensal_aj <= 1518   THEN 10  -- ≤ salário mínimo 2026
      WHEN renda_mensal_aj <= 3000   THEN 8
      WHEN renda_mensal_aj <= 6000   THEN 5
      WHEN renda_mensal_aj <= 12000  THEN 2
      ELSE                                1
    END AS renda_sig,

    -- Benefício social (0–8)
    CASE
      WHEN is_beneficiario IS NULL  THEN NULL
      WHEN is_beneficiario          THEN 8
      ELSE                               2
    END AS beneficio_sig,

    -- Localização / renda per capita do CEP (0–7)
    CASE
      WHEN cep_renda_aj IS NULL     THEN NULL
      WHEN cep_renda_aj <= 2000     THEN 7
      WHEN cep_renda_aj <= 4000     THEN 5
      WHEN cep_renda_aj <= 7000     THEN 3
      ELSE                               1
    END AS localizacao_sig

  FROM adjusted
),

-- ── Componentes de score ──────────────────────────────────────────────────
components AS (
  SELECT
    *,

    -- ATIVO (0–40)
    -- Classe trabalhista: normalização cobre 'I', 'TRABALHISTA', 'CLASSE I ...'
    CASE WHEN
      UPPER(REGEXP_REPLACE(COALESCE(classe, ''), '[^A-Z0-9 ]', '')) SIMILAR TO '%(TRABALHISTA|CLASSE I)%'
      OR TRIM(UPPER(classe)) = 'I'
    THEN 20 ELSE 0 END
    + CASE WHEN LENGTH(doc_digits) IN (11, 14) THEN 12 ELSE 0 END
    + CASE WHEN UPPER(COALESCE(extra, '')) SIMILAR TO
        '%(IMPUGN|DIVERGEN|CONTEST|RESERVA|SUB JUDICE|RETIFIC)%'
      THEN 0 ELSE 8 END
    AS score_ativo,

    -- DEVEDOR (0–35): faixa de ticket proxy
    ROUND(ticket_pct * 35.0 / 100.0)::INT AS score_devedor,

    -- CREDOR (0–25)
    CASE
      -- PF com pelo menos um sinal real
      WHEN tipo_pessoa = 'PF'
        AND (renda_sig IS NOT NULL OR beneficio_sig IS NOT NULL OR localizacao_sig IS NOT NULL)
      THEN
        ROUND(COALESCE(renda_sig,      5) / 10.0 * 7)::INT
        + ROUND(COALESCE(beneficio_sig,  4) /  8.0 * 2)::INT
        + ROUND(COALESCE(localizacao_sig, 3) / 7.0 * 3)::INT
        + ROUND(ticket_pct * 13.0 / 100.0)::INT
      -- PF sem dados: proxy
      WHEN tipo_pessoa = 'PF' THEN 10 + ROUND(ticket_pct * 15.0 / 100.0)::INT
      -- PJ proxy: peso reduzido (tipoPessoa 4 + ticket max 10)
      WHEN tipo_pessoa = 'PJ' THEN  4 + ROUND(ticket_pct * 10.0 / 100.0)::INT
      -- Desconhecido
      ELSE                           2 + ROUND(ticket_pct * 15.0 / 100.0)::INT
    END AS score_credor

  FROM signals
)

SELECT
  row_hash,
  nome_da_empresa,
  nome,
  cpf_cnpj,
  tipo_pessoa,
  classe,
  valor,
  moeda,
  extra,
  renda_anual,
  renda_ano_ref,
  is_beneficiario,
  has_telefone,
  renda_mensal_aj,
  cep_renda_aj,
  score_ativo,
  score_devedor,
  score_credor,
  LEAST(100, GREATEST(0, score_ativo + score_devedor + score_credor))::INT AS score
FROM components;
