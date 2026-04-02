import { type ReactNode, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { brl } from "@/lib/format";
import type { ProspectDetails, ProspectStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

export function whatsappUrl(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

export function parseDesagioRange(str: string): [number, number] | null {
  const range = str.match(/(\d+)[–\-](\d+)%/);
  if (range) return [Number.parseInt(range[1], 10), Number.parseInt(range[2], 10)];
  const single = str.match(/(\d+)%/);
  if (single) {
    const n = Number.parseInt(single[1], 10);
    return [n, n];
  }
  return null;
}

const PHONE_VISIBLE_LIMIT = 3;

function PhoneChip({ raw }: { raw: string }) {
  const formatted = formatPhone(raw);
  const waUrl = whatsappUrl(raw);
  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
    >
      <Phone className="size-3.5 shrink-0" />
      {formatted}
      <ArrowUpRight className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export function PhonesSection({
  telefones,
  loading,
  nome,
}: {
  telefones: string[];
  loading: boolean;
  nome: string;
}) {
  if (loading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
    );
  }

  if (telefones.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum telefone encontrado para este credor.</p>;
  }

  const visible = telefones.slice(0, PHONE_VISIBLE_LIMIT);
  const overflow = telefones.slice(PHONE_VISIBLE_LIMIT);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((tel) => (
        <PhoneChip key={tel} raw={tel} />
      ))}

      {overflow.length > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              +{overflow.length} mais
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle className="text-base">Todos os telefones</SheetTitle>
              <p className="text-xs text-muted-foreground">{nome}</p>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2">
              {telefones.map((tel) => (
                <PhoneChip key={tel} raw={tel} />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Send className="size-3.5" />
            Iniciar abordagem
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>Abordagem ativa</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {telefones.length} número{telefones.length !== 1 ? "s" : ""} encontrado{telefones.length !== 1 ? "s" : ""} para {nome}
            </p>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <p className="text-xs text-muted-foreground">
              Clique em um número para abrir o WhatsApp e iniciar a prospecção individualmente.
            </p>
            <div className="space-y-2">
              {telefones.map((tel, i) => (
                <div key={tel} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm">{formatPhone(tel)}</span>
                  </div>
                  <a
                    href={whatsappUrl(tel)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    WhatsApp
                    <ArrowUpRight className="size-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 65) return { text: "text-primary", bg: "bg-primary/5", ring: "border-primary/20" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning/5", ring: "border-warning/20" };
  return { text: "text-muted-foreground", bg: "bg-muted/30", ring: "border-border" };
}

function scoreLabelText(score: number) {
  if (score >= 75) return "Excelente";
  if (score >= 65) return "Bom";
  if (score >= 50) return "Regular";
  if (score >= 35) return "Fraco";
  return "Muito fraco";
}

function Dimension({
  label,
  description,
  value,
  max,
  items,
  note,
}: {
  label: string;
  description: string;
  value: number;
  max: number;
  items: Array<{ label: string; pts: number; max: number }>;
  note?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm font-semibold">{label}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{description}</span>
        </div>
        <span className="text-xs font-bold tabular-nums">
          {value}
          <span className="font-normal text-muted-foreground">/{max}</span>
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <dl className="space-y-1 pl-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[11px]">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="tabular-nums font-medium">
              {item.pts}
              <span className="font-normal text-muted-foreground">/{item.max}</span>
            </dd>
          </div>
        ))}
      </dl>
      {note ? (
        <p className="text-[10px] italic text-muted-foreground/60">{note}</p>
      ) : null}
    </div>
  );
}

export function OriginationScoreCard({
  score,
  dimensions,
  tone = "default",
}: {
  score: number;
  desagioRec?: string;
  dimensions: Array<{
    label: string;
    description: string;
    value: number;
    max: number;
    items: Array<{ label: string; pts: number; max: number }>;
    note?: string;
  }>;
  tone?: "default" | "emerald";
}) {
  const [open, setOpen] = useState(false);
  const { text, bg, ring } = tone === "emerald" ? emeraldScoreColor(score) : scoreColor(score);

  return (
    <Card className={`border ${ring} ${bg}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Score de originação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score prominente */}
        <div className="flex items-end gap-3">
          <span className={`text-6xl font-bold leading-none tabular-nums ${text}`}>{score}</span>
          <div className="mb-1 space-y-0.5">
            <p className="text-sm leading-none text-muted-foreground">/100</p>
            <p className={`text-sm font-semibold ${text}`}>{scoreLabelText(score)}</p>
          </div>
        </div>

        {/* Barras resumidas das 3 dimensões */}
        <div className="space-y-1.5">
          {dimensions.map((d) => {
            const pct = d.max > 0 ? Math.round((d.value / d.max) * 100) : 0;
            return (
              <div key={d.label} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{d.label}</span>
                <Progress value={pct} className="h-1.5 flex-1" />
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {d.value}/{d.max}
                </span>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Collapsible com breakdown detalhado */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Ver composição do score</span>
              <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            {dimensions.map((dimension) => (
              <Dimension key={dimension.label} {...dimension} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function emeraldScoreColor(score: number) {
  if (score >= 65) return { text: "text-emerald-700", bg: "bg-emerald-50/80", ring: "border-emerald-200/80" };
  if (score >= 50) return { text: "text-teal-700", bg: "bg-teal-50/80", ring: "border-teal-200/80" };
  return { text: "text-slate-600", bg: "bg-slate-50/80", ring: "border-slate-200/80" };
}

export function ProspectStatusBadge({
  status,
  elegivel,
}: {
  status: ProspectStatus;
  elegivel: boolean;
}) {
  if (!elegivel) return <Badge variant="secondary">Fora do critério</Badge>;
  if (status === "qualificado") {
    return (
      <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
        <ShieldCheck className="mr-1 size-3" />
        Qualificado
      </Badge>
    );
  }
  if (status === "marginal") {
    return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Marginal</Badge>;
  }
  return <Badge variant="secondary">Rejeitado</Badge>;
}

export function InfoField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm font-medium ${valueClassName ?? ""}`}>{value}</dd>
    </div>
  );
}

export function ProspectDetailsCard({
  details,
  tone = "default",
}: {
  details: ProspectDetails;
  tone?: "default" | "emerald";
}) {
  const borderClass = tone === "emerald" ? "border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white" : "border-border";
  const riskClass =
    details.homonimo.risco === "alto"
      ? "text-destructive"
      : details.homonimo.risco === "medio"
        ? "text-warning"
        : "text-primary";

  return (
    <Card className={borderClass}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className={`size-4 ${tone === "emerald" ? "text-emerald-700" : "text-primary/70"}`} />
          Perfil socioeconômico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoField
            label="Renda anual estimada"
            value={
              details.rendaAnualEstimada !== null
                ? `${brl(details.rendaAnualEstimada)}${details.rendaAnoReferencia ? ` · ${details.rendaAnoReferencia}` : ""}`
                : "Não disponível"
            }
          />
          <InfoField
            label="Programas sociais"
            value={
              details.beneficiarioProgramaSocial === null
                ? "Sem dado confiável"
                : details.beneficiarioProgramaSocial
                  ? details.programaSocialDescricao || "Beneficiário"
                  : "Não identificado"
            }
          />
          <InfoField
            label="Localização"
            value={
              [details.localizacao.municipio, details.localizacao.uf]
                .filter(Boolean)
                .join(" / ") || "Não disponível"
            }
          />
          <InfoField
            label="Renda per capita do CEP"
            value={
              details.localizacao.rendaPerCapita !== null
                ? brl(details.localizacao.rendaPerCapita)
                : "Não disponível"
            }
          />
          <InfoField label="Bairro" value={details.localizacao.bairro || "—"} />
          <InfoField label="CEP" value={details.localizacao.cep || "—"} />
          <InfoField
            label="Risco de homônimo"
            value={`${details.homonimo.risco.toUpperCase()}${details.homonimo.quantidade > 0 ? ` · ${details.homonimo.quantidade} ocorrência(s)` : ""}`}
            valueClassName={riskClass}
          />
          <InfoField label="Critério de match" value={details.homonimo.criterio.replace(/_/g, " ")} />
        </dl>
        <p className="text-xs text-muted-foreground">{details.homonimo.observacao}</p>
      </CardContent>
    </Card>
  );
}
