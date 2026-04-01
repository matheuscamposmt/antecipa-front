import { ArrowUpRight, BadgeCheck, Building2, Landmark, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import type { PrecatorioDebtor } from "@/types";
import { brl, integer } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  debtor: PrecatorioDebtor;
};

export function PrecatorioCard({ debtor }: Props) {
  const isRegimeEspecial = /especial/i.test(debtor.regime ?? "");

  return (
    <Card className="flex h-full flex-col border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white shadow-sm">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Badge
              variant="secondary"
              className={`rounded-full px-2 py-0.5 text-[11px] ${isRegimeEspecial ? "border-warning/30 bg-warning/10 text-warning" : ""}`}
            >
              {debtor.tribunal}
            </Badge>
            <CardTitle className="line-clamp-2 text-base leading-snug">{debtor.nomeEmpresa}</CardTitle>
          </div>
          <Building2 className="mt-1 size-4 shrink-0 text-emerald-700" />
        </div>
        {(debtor.regime || debtor.cnpj) && (
          <div className="flex flex-wrap gap-1.5">
            {debtor.regime ? (
              <Badge
                variant={isRegimeEspecial ? "outline" : "outline"}
                className={isRegimeEspecial ? "border-amber-300 text-amber-700" : "border-emerald-200 text-emerald-700"}
              >
                {debtor.regime}
              </Badge>
            ) : null}
            {debtor.cnpj ? <Badge variant="outline">{debtor.cnpj}</Badge> : null}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat icon={Scale} label="Precatórios" value={integer(debtor.quantidadePrecatorios)} />
          <MiniStat icon={BadgeCheck} label="Valor pago" value={brl(debtor.valorTotalPago)} />
        </div>
        <div className="mt-auto rounded-lg border border-emerald-200/60 bg-white/80 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Landmark className="size-3.5" />
            Volume nominal
          </p>
          <p className="text-xl font-semibold tracking-tight">{brl(debtor.valorTotalPrecatorio)}</p>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild size="sm" className="gap-1 bg-emerald-700 text-white hover:bg-emerald-800">
          <Link to={`/devedor/${debtor.slug}`}>
            Ver precatórios
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scale;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-2.5">
      <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
