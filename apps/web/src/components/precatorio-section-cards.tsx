import { BadgeCheck, Building2, Landmark, Scale } from "lucide-react";
import type { PrecatorioOverview } from "@/types";
import { brl, integer } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  overview: PrecatorioOverview | null;
};

export function PrecatorioSectionCards({ overview }: Props) {
  const cards = [
    {
      title: "Valor total de precatórios",
      value: brl(overview?.valorTotalPrecatorio ?? 0),
      icon: Landmark,
    },
    {
      title: "Devedores mapeados",
      value: integer(overview?.totalDevedores ?? 0),
      icon: Building2,
    },
    {
      title: "Total de precatórios",
      value: integer(overview?.totalPrecatorios ?? 0),
      icon: Scale,
    },
    {
      title: "Valor total pago",
      value: brl(overview?.valorTotalPago ?? 0),
      icon: BadgeCheck,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-primary/10 bg-white/70 backdrop-blur">
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
