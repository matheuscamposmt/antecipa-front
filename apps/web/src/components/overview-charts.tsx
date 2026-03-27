import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Overview } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Props = {
  overview: Overview | null;
};

const classChartConfig = {
  quantidade: {
    label: "Prospects",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const ajChartConfig = {
  empresas: {
    label: "Empresas",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function OverviewCharts({ overview }: Props) {
  const classes = overview?.topClasses ?? [];
  const ajs = overview?.topAdministradoresJudiciais?.slice(0, 6) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="border-primary/10">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Prospects por classe de crédito (Lei 11.101/2005)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={classChartConfig} className="h-72 w-full">
            <BarChart accessibilityLayer data={classes}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="classe" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Administradores Judiciais com mais empresas</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={ajChartConfig} className="h-72 w-full">
            <BarChart accessibilityLayer data={ajs} layout="vertical" margin={{ left: 20, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                dataKey="nome"
                type="category"
                tickLine={false}
                axisLine={false}
                width={130}
                tickFormatter={(value) => String(value).slice(0, 18)}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="empresas" fill="var(--color-empresas)" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
