import { ArrowUpRight, BadgeCheck, Building2, Landmark, Scale, Shield } from "lucide-react";
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
  return (
    <Card className="h-full border-primary/10 bg-card/90">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
              {debtor.tribunal}
            </Badge>
            <CardTitle className="line-clamp-2 text-base leading-snug">{debtor.nomeEmpresa}</CardTitle>
          </div>
          <Building2 className="mt-1 size-4 text-primary/70" />
        </div>
        <div className="flex flex-wrap gap-2">
          {debtor.regime ? <Badge variant="outline">{debtor.regime}</Badge> : null}
          {debtor.cnpj ? <Badge variant="outline">{debtor.cnpj}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat icon={Scale} label="Precatórios" value={integer(debtor.quantidadePrecatorios)} />
          <MiniStat icon={BadgeCheck} label="Pago" value={brl(debtor.valorTotalPago)} />
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Landmark className="size-3.5" />
            Valor mapeado
          </div>
          <div className="text-lg font-semibold">{brl(debtor.valorTotalPrecatorio)}</div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button asChild size="sm" className="gap-1">
          <Link to={`/devedor/${debtor.slug}`}>
            Ver detalhe
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Shield className="size-3.5" />
          origem judicial
        </div>
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
      <div className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
