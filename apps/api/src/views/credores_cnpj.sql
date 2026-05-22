-- Materialized view that extends administradores_judiciais.credores with the
-- CNPJ of the empresa resolved by matching nome_da_empresa against
-- receita_federal.pessoa_juridica entries that contain both "RECUPERACAO" and
-- "JUDICIAL" in their razao_social.
--
-- Normalization (both sides):
--   UPPER → strip all non-alphanumeric, non-space chars → collapse whitespace.
--   No accent translation; accented characters are simply removed.
--
-- Match: word-order LIKE — all words of nome appear in order inside razao_social
--   (spaces replaced by '%' in the pattern). Conservative because all tokens
--   must be present in the same order; only gaps between words are tolerated.
--   The RECUPERACAO + JUDICIAL pre-filter keeps false positives minimal.
--
-- When multiple records match, exact substring is preferred over word-order;
-- ties broken by cnpj ASC.
--
-- Refresh:
--   REFRESH MATERIALIZED VIEW administradores_judiciais.credores_cnpj;

CREATE MATERIALIZED VIEW administradores_judiciais.credores_cnpj
AUTO REFRESH NO
AS
WITH empresa_nomes AS (
  SELECT DISTINCT
    nome_da_empresa,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(UPPER(COALESCE(nome_da_empresa, '')), '[^A-Z0-9 ]', ''),
      '\\s+', ' '
    )) AS nome_normalizado
  FROM administradores_judiciais.credores
),
pj_candidatas AS (
  SELECT
    cnpj,
    cnpj_basico,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(UPPER(COALESCE(razao_social, '')), '[^A-Z0-9 ]', ''),
      '\\s+', ' '
    )) AS razao_normalizada
  FROM receita_federal.pessoa_juridica
  WHERE UPPER(razao_social) LIKE '%RECUPERACAO%'
    AND UPPER(razao_social) LIKE '%JUDICIAL%'
    AND identificador_matriz_filial = '1'
),
matches AS (
  SELECT
    e.nome_da_empresa,
    pj.cnpj        AS cnpj_empresa,
    pj.cnpj_basico AS cnpj_basico_empresa,
    ROW_NUMBER() OVER (
      PARTITION BY e.nome_da_empresa
      ORDER BY
        CASE
          WHEN pj.razao_normalizada LIKE '%' || e.nome_normalizado || '%' THEN 1
          ELSE 2
        END,
        pj.cnpj
    ) AS rn
  FROM empresa_nomes e
  JOIN pj_candidatas pj
    ON pj.razao_normalizada LIKE '%' || REPLACE(e.nome_normalizado, ' ', '%') || '%'
),
best_match AS (
  SELECT nome_da_empresa, cnpj_empresa, cnpj_basico_empresa
  FROM matches
  WHERE rn = 1
)
SELECT
  c.row_hash,
  c.pdf_sha256,
  c.nome_da_empresa,
  c.nome,
  c.cpf_cnpj,
  c.classe,
  c.valor,
  c.moeda,
  c.extra,
  bm.cnpj_empresa,
  bm.cnpj_basico_empresa
FROM administradores_judiciais.credores c
LEFT JOIN best_match bm ON bm.nome_da_empresa = c.nome_da_empresa;
