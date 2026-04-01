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
      title: "Volume total",
      value: brl(overview?.valorTotalPrecatorio ?? 0),
      icon: Landmark,
      sub: "valor nominal dos precatórios",
    },
    {
      title: "Devedores públicos",
      value: integer(overview?.totalDevedores ?? 0),
      icon: Building2,
      sub: "entes monitorados (TRT 1–24)",
    },
    {
      title: "Precatórios",
      value: integer(overview?.totalPrecatorios ?? 0),
      icon: Scale,
      sub: "registros na lista cronológica",
    },
    {
      title: "Total pago",
      value: brl(overview?.valorTotalPago ?? 0),
      icon: BadgeCheck,
      sub: "quitados pelos entes devedores",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className="size-4 text-emerald-700" />
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
