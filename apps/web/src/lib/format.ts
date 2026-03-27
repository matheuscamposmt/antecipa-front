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
