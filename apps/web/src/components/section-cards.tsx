import { Building2, Landmark, Scale, WalletCards } from "lucide-react";
import type { Overview } from "@/types";
import { brl, integer } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  overview: Overview | null;
};

export function SectionCards({ overview }: Props) {
  const cards = [
    {
      title: "Volume mapeado",
      value: brl(overview?.valorTotalCredito ?? 0),
      icon: Landmark,
      sub: "créditos Classe I elegíveis",
    },
    {
      title: "Empresas com credores",
      value: integer(overview?.totalEmpresasComCredores ?? 0),
      icon: Building2,
      sub: `de ${integer(overview?.totalEmpresas ?? 0)} em recuperação judicial`,
    },
    {
      title: "Total em recuperação",
      value: integer(overview?.totalEmpresas ?? 0),
      icon: Scale,
      sub: "empresas monitoradas",
    },
    {
      title: "Ticket médio",
      value: brl(overview?.mediaValorPorEmpresa ?? 0),
      icon: WalletCards,
      sub: "por empresa com credores mapeados",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="animate-enter border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className="size-4 text-primary/70" />
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
