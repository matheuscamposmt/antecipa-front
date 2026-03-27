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
      title: "Valor total mapeado",
      value: brl(overview?.valorTotalCredito ?? 0),
      icon: Landmark,
    },
    {
      title: "Empresas com prospects",
      value: integer(overview?.totalEmpresasComCredores ?? 0),
      icon: Building2,
    },
    {
      title: "Total em recuperação judicial",
      value: integer(overview?.totalEmpresas ?? 0),
      icon: Scale,
    },
    {
      title: "Ticket médio por empresa",
      value: brl(overview?.mediaValorPorEmpresa ?? 0),
      icon: WalletCards,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="animate-enter border-primary/10 bg-white/70 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className="size-4 text-primary/80" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
