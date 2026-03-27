import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, CalendarCheck2, CalendarDays, CircleHelp, FileText, Landmark, Scale, Users } from "lucide-react";
import type { Company } from "@/types";
import { brl, integer } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  company: Company;
};

const TOOLTIP_CLASS =
  "max-w-72 rounded-md border border-border/70 bg-card px-3 py-2 text-[11px] text-card-foreground shadow-sm";

export function CompanyCard({ company }: Props) {
  return (
    <Card className="animate-enter h-full border-primary/10 bg-card/90">
      <CardHeader className="space-y-2 pb-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base leading-snug">{company.nomeEmpresa}</CardTitle>
          <Building2 className="mt-1 size-4 text-primary/70" />
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {company.grupoEconomico || "Sem grupo econômico"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md p-2">
            <p className="mb-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
              <CalendarCheck2 className="size-3.5" />
              Data de homologação
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/80 transition-colors hover:text-foreground" aria-label="Explicação da data de homologação">
                      <CircleHelp className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className={TOOLTIP_CLASS}>Data da homologação judicial do plano de recuperação.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
            <p className="text-[15px] font-medium leading-tight">{company.dataHomologacao || "Não informado"}</p>
          </div>
          <div className="rounded-md p-2">
            <p className="mb-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
              <CalendarDays className="size-3.5" />
              Data do documento
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/80 transition-colors hover:text-foreground" aria-label="Explicação da data do documento de credores">
                      <CircleHelp className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className={TOOLTIP_CLASS}>Data da relação de credores usada como base mais recente.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
            <p className="text-[15px] font-medium leading-tight">{company.dataDocumento || "Não informado"}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <StatBadge icon={Users} label="Credores" value={integer(company.quantidadeCredores)} />
          <StatBadge icon={Building2} label="Pessoas Jurídicas" value={integer(company.quantidadePJ)} />
          <StatBadge icon={Scale} label="Pessoas Físicas" value={integer(company.quantidadePF)} />
        </div>
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
            <Landmark className="size-3.5" />
            Valor total do crédito
          </p>
          <p className="text-lg font-semibold">{brl(company.totalCredito)}</p>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Button asChild size="sm" className="gap-1">
          <Link to={`/empresa/${company.slug}`}>
            Ver credores
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        {company.linkCredores ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={company.linkCredores} target="_blank" rel="noreferrer" className="gap-1">
              <FileText className="size-4" />
              Fonte
            </a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Badge variant="outline" className="h-auto items-start justify-start gap-1.5 rounded-md px-2 py-1.5">
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 text-[12px] leading-tight text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-medium">{value}</span>
    </Badge>
  );
}
