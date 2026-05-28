export function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function integer(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

export function percent(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

export function ajustarInflacao(valor: number, anoRef: number | null, taxaAnual = 0.06): number {
  const anos = anoRef ? 2026 - anoRef : 0;
  return valor * Math.pow(1 + taxaAnual, anos);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function documentId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return value || "—";
}
