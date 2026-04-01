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

const PHONES_TIMEOUT_MS = 6_000;

function normalizeDocumentForMatch(input: string): string {
  return input.replace(/\D/g, "");
}

function mergePhones(target: Map<string, string[]>, key: string, phones: string[]) {
  if (!key || phones.length === 0) {
    return;
  }
  const current = target.get(key) ?? [];
  for (const phone of phones) {
    if (!current.includes(phone)) {
      current.push(phone);
    }
  }
  target.set(key, current);
}

async function loadPhonesByDocuments(documents: string[]): Promise<Map<string, string[]>> {
  const normalized = Array.from(
    new Set(
      documents
        .map((document) => normalizeDocumentForMatch(document))
        .filter((document) => document.length === 11 || document.length === 14),
    ),
  );
  if (normalized.length === 0) {
    return new Map();
  }

  const placeholders = buildParameterList(normalized.length);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("phone lookup timeout")), PHONES_TIMEOUT_MS),
  );
  const rows = await Promise.race([
    queryRows<{ documento: string | null; telefone: string | null }>(
      `
        SELECT documento, telefone
        FROM telecom.contatos
        WHERE telefone IS NOT NULL
          AND REGEXP_REPLACE(COALESCE(documento, ''), '\\\\D', '') IN (${placeholders})
      `,
      normalized,
    ),
    timeout,
  ]);

  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const key = normalizeDocumentForMatch(row.documento ?? "");
    const phone = (row.telefone ?? "").trim();
    if (!key || !phone) {
      continue;
    }
    mergePhones(grouped, key, [phone]);
  }
  return grouped;
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
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("phone lookup timeout")), PHONES_TIMEOUT_MS),
  );
  const rows = await Promise.race([
    queryRows<{ proprietario_telefone: string | null; telefone: string | null }>(
      `
        SELECT proprietario_telefone, telefone
        FROM telecom.contatos
        WHERE telefone IS NOT NULL
          AND proprietario_telefone IN (${placeholders})
      `,
      normalized,
    ),
    timeout,
  ]);

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

export async function loadPhonesByContacts(
  contacts: Array<{ name?: string | null; document?: string | null }>,
): Promise<Map<string, string[]>> {
  const normalizedContacts = contacts
    .map((contact) => ({
      nameKey: normalizeNameForMatch(contact.name ?? ""),
      documentKey: normalizeDocumentForMatch(contact.document ?? ""),
    }))
    .filter((contact) => contact.nameKey.length > 0);

  if (normalizedContacts.length === 0) {
    return new Map();
  }

  const phonesByName = new Map<string, string[]>();
  const phonesByDocument = await loadPhonesByDocuments(normalizedContacts.map((contact) => contact.documentKey)).catch(() => new Map());
  const fallbackNames = new Set<string>();

  for (const contact of normalizedContacts) {
    const documentPhones =
      contact.documentKey.length > 0 ? (phonesByDocument.get(contact.documentKey) ?? []) : [];
    if (documentPhones.length > 0) {
      mergePhones(phonesByName, contact.nameKey, documentPhones);
      continue;
    }
    fallbackNames.add(contact.nameKey);
  }

  if (fallbackNames.size > 0) {
    const fallbackPhones = await loadPhonesByNames(Array.from(fallbackNames)).catch(() => new Map());
    for (const [nameKey, phones] of fallbackPhones.entries()) {
      if ((phonesByName.get(nameKey) ?? []).length === 0) {
        mergePhones(phonesByName, nameKey, phones);
      }
    }
  }

  return phonesByName;
}

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}
