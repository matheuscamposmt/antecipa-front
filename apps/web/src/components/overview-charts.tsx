import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Overview } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Props = {
  overview: Overview | null;
};

const classChartConfig = {
  quantidade: {
    label: "Credores",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const companiesChartConfig = {
  totalCredito: {
    label: "Crédito total",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

function formatMillions(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export function OverviewCharts({ overview }: Props) {
  const classes = overview?.topClasses ?? [];
  const topEmpresas = overview?.topEmpresasPorCredito ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="border-border">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium">
            Credores por classe de crédito
          </CardTitle>
          <p className="text-xs text-muted-foreground">Lei 11.101/2005</p>
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

      <Card className="border-border">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium">
            Top 10 empresas por volume de crédito
          </CardTitle>
          <p className="text-xs text-muted-foreground">Credores Classe I elegíveis mapeados</p>
        </CardHeader>
        <CardContent className="pt-4">
          <ChartContainer config={companiesChartConfig} className="h-72 w-full">
            <BarChart
              accessibilityLayer
              data={topEmpresas}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatMillions}
              />
              <YAxis
                dataKey="nome"
                type="category"
                tickLine={false}
                axisLine={false}
                width={140}
                tickFormatter={(value: string) =>
                  value.length > 20 ? `${value.slice(0, 19)}…` : value
                }
                style={{ fontSize: "11px" }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(Number(value))
                    }
                  />
                }
              />
              <Bar dataKey="totalCredito" fill="var(--color-totalCredito)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
