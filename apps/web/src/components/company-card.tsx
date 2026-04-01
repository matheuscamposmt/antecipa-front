import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, CalendarDays, CircleHelp, FileText, Landmark, Scale, Users } from "lucide-react";
import type { Company } from "@/types";
import { brl, integer } from "@/lib/format";
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
    <Card className="animate-enter flex h-full flex-col border-border bg-card">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-base leading-snug">{company.nomeEmpresa}</CardTitle>
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary/60" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2">
          <DateStat
            icon={CalendarDays}
            label="Relação de credores"
            value={company.dataDocumento || "—"}
            tooltip="Data da relação de credores usada como base."
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatBadge icon={Users} label="Credores" value={integer(company.quantidadeCredores)} />
          <StatBadge icon={Building2} label="PJ" value={integer(company.quantidadePJ)} />
          <StatBadge icon={Scale} label="PF" value={integer(company.quantidadePF)} />
        </div>

        <div className="mt-auto space-y-0.5">
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Landmark className="size-3.5" />
            Crédito total
          </p>
          <p className="text-xl font-semibold tracking-tight">{brl(company.totalCredito)}</p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 pt-0">
        <Button asChild size="sm" className="gap-1">
          <Link to={`/empresa/${company.slug}`}>
            Ver credores
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
        {company.linkCredores ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={company.linkCredores} target="_blank" rel="noreferrer" className="gap-1 text-muted-foreground">
              <FileText className="size-3.5" />
              Fonte
            </a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function DateStat({
  icon: Icon,
  label,
  value,
  tooltip,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div className="rounded-md border border-border/60 p-2">
      <p className="mb-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground" aria-label={tooltip}>
                <CircleHelp className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className={TOOLTIP_CLASS}>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </p>
      <p className="text-sm font-medium leading-tight">{value}</p>
    </div>
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
    <div className="flex flex-col rounded-md border border-border/60 px-2 py-1.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
        <Icon className="size-3 text-primary/60" />
        {value}
      </span>
    </div>
  );
}
