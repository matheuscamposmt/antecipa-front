export function ticketQualificationScore(valor: number): number {
  if (valor <= 0) return 0;
  if (valor < 25_000) return 20;
  if (valor < 75_000) return 75;
  if (valor < 250_000) return 100;
  if (valor <= 1_000_000) return 85;
  return 60;
}

export function ticketQualificationPoints(valor: number, max: number): number {
  return Math.round((ticketQualificationScore(valor) / 100) * max);
}
