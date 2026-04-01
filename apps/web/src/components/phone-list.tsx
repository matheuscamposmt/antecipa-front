import { Phone } from "lucide-react";

type Props = {
  telefones: string[];
  loading?: boolean;
  emptyLabel?: string;
};

export function PhoneList({ telefones, loading = false, emptyLabel = "Sem telefone encontrado" }: Props) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Buscando telefones…</p>;
  }

  if (telefones.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {telefones.map((tel) => (
        <a
          key={tel}
          href={`tel:${tel.replace(/\D/g, "")}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
        >
          <Phone className="size-3.5" />
          {tel}
        </a>
      ))}
    </div>
  );
}
