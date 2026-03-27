import { Pool } from "pg";

const connectionString = process.env.REDSHIFT_DSN ?? "";

const pool =
  connectionString
    ? new Pool({
        connectionString,
        ssl: process.env.REDSHIFT_SSLMODE === "disable" ? false : { rejectUnauthorized: false },
      })
    : null;

const TRANSLATE_FROM = "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç";
const TRANSLATE_TO = "AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc";

export function hasRedshiftConfigured(): boolean {
  return Boolean(pool);
}

export async function queryRows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) {
    throw new Error("REDSHIFT_DSN não configurado.");
  }
  const client = await pool.connect();
  try {
    const result = await client.query(sql, values);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export function normalizeNameForMatch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNameNormalizationSql(expression: string): string {
  return `REGEXP_REPLACE(UPPER(TRIM(TRANSLATE(COALESCE(${expression}, ''), '${TRANSLATE_FROM}', '${TRANSLATE_TO}'))), '\\\\s+', ' ')`;
}

export function buildParameterList(count: number, startAt = 1): string {
  return Array.from({ length: count }, (_, index) => `$${index + startAt}`).join(", ");
}

export async function loadPhonesByNames(names: string[]): Promise<Map<string, string[]>> {
  const normalized = Array.from(
    new Set(
      names
        .map((name) => normalizeNameForMatch(name))
        .filter((name) => name.length > 0),
    ),
  );
  if (normalized.length === 0) {
    return new Map();
  }

  const placeholders = buildParameterList(normalized.length);
  const rows = await queryRows<{ proprietario_telefone: string | null; telefone: string | null }>(
    `
      SELECT proprietario_telefone, telefone
      FROM telecom.contatos
      WHERE telefone IS NOT NULL
        AND ${buildNameNormalizationSql("proprietario_telefone")} IN (${placeholders})
    `,
    normalized,
  );

  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const key = normalizeNameForMatch(row.proprietario_telefone ?? "");
    const phone = (row.telefone ?? "").trim();
    if (!key || !phone) {
      continue;
    }
    const current = grouped.get(key) ?? [];
    if (!current.includes(phone)) {
      current.push(phone);
      grouped.set(key, current);
    }
  }
  return grouped;
}

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}
