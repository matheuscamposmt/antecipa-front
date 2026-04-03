-- Materialized view that extends administradores_judiciais.credores with the
-- CNPJ of the empresa resolved by matching nome_da_empresa against
-- receita_federal.pessoa_juridica entries that contain both "RECUPERACAO" and
-- "JUDICIAL" in their razao_social — the Receita Federal denomination for
-- companies under judicial recovery. When multiple records match, the matriz
-- (identificador_matriz_filial = '1') is chosen; ties broken by cnpj ASC.

CREATE MATERIALIZED VIEW administradores_judiciais.credores_cnpj
AUTO REFRESH NO
AS
WITH empresa_nomes AS (
  SELECT DISTINCT
    nome_da_empresa,
    REGEXP_REPLACE(
      UPPER(TRIM(TRANSLATE(
        COALESCE(nome_da_empresa, ''),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
      ))),
      '\\s+', ' '
    ) AS nome_normalizado
  FROM administradores_judiciais.credores
),
matches AS (
  SELECT
    e.nome_da_empresa,
    pj.cnpj        AS cnpj_empresa,
    pj.cnpj_basico AS cnpj_basico_empresa,
    ROW_NUMBER() OVER (
      PARTITION BY e.nome_da_empresa
      ORDER BY pj.cnpj
    ) AS rn
  FROM empresa_nomes e
  JOIN receita_federal.pessoa_juridica pj
    ON REGEXP_REPLACE(
         UPPER(TRIM(TRANSLATE(
           COALESCE(pj.razao_social, ''),
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
           'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
         ))),
         '\\s+', ' '
       ) LIKE '%' || e.nome_normalizado || '%'
    AND UPPER(pj.razao_social) LIKE '%RECUPERACAO%'
    AND UPPER(pj.razao_social) LIKE '%JUDICIAL%'
    AND pj.identificador_matriz_filial = '1'
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
