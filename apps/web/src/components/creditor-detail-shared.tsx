import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeAlert,
  Banknote,
  CheckCircle2,
  Clock3,
  HandHeart,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { ajustarInflacao, brl } from "@/lib/format";
import type { ProspectDetails, ProspectStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

      <ApproachDialog telefones={telefones} nome={nome} />
    </div>
  );
}

function ApproachDialog({ telefones, nome }: { telefones: string[]; nome: string }) {
  const [open, setOpen] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const total = telefones.length;
  const progress = total > 0 ? Math.round((sentCount / total) * 100) : 0;
  const complete = sentCount >= total;

  useEffect(() => {
    if (!open) {
      setSentCount(0);
      return;
    }

    setSentCount(0);
    const timers = telefones.map((_, index) =>
      window.setTimeout(() => setSentCount(index + 1), 450 + index * 520),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [open, telefones]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 bg-transparent shadow-none">
          <Send className="size-3.5" />
          Iniciar abordagem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="relative border-b bg-primary/[0.04] p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 size-44 rounded-full bg-primary/10 blur-3xl" />
          <DialogHeader className="relative pr-8">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
              <Send className="size-3.5" />
              Disparo de mensagens
            </div>
            <DialogTitle>Abordagem iniciada</DialogTitle>
            <DialogDescription>
              Enviando mensagem inicial para {total} número{total !== 1 ? "s" : ""} de {nome}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6 pt-5">
          <div className="rounded-xl border bg-background/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{complete ? "Mensagens enviadas" : "Envio em andamento"}</p>
                  <p className="text-xs text-muted-foreground">
                    {sentCount} de {total} mensagem{total !== 1 ? "s" : ""} concluída{total !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {telefones.map((tel, index) => {
              const sent = index < sentCount;
              return (
                <div
                  key={tel}
                  className={`animate-enter rounded-xl border bg-card p-3 transition-colors ${sent ? "border-primary/20" : "border-border/80"}`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${sent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {sent ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4 animate-pulse" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold tabular-nums">{formatPhone(tel)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sent ? "Mensagem inicial enviada" : "Na fila de envio"}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sent ? "border-primary/20 text-primary" : "border-border text-muted-foreground"}`}>
                      {sent ? "Enviado" : "Fila"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function scoreTextColor(score: number): string {
  if (score >= 65) return "text-primary";
  if (score >= 50) return "text-warning";
  return "text-muted-foreground";
}

export function scoreLabelText(score: number): string {
  if (score >= 75) return "Excelente";
  if (score >= 65) return "Bom";
  if (score >= 50) return "Regular";
  if (score >= 35) return "Fraco";
  return "Muito fraco";
}

type ScoreDimension = {
  label: string;
  description: string;
  value: number;
  max: number;
  items: Array<{ label: string; pts: number; max: number }>;
  note?: string;
};

export function ScoreBreakdown({ dimensions }: { dimensions: ScoreDimension[] }) {
  return (
    <div className="space-y-3">
      {dimensions.map((d) => {
        const pct = d.max > 0 ? Math.round((d.value / d.max) * 100) : 0;
        return (
          <div key={d.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold">{d.label}</span>
                <span className="ml-1.5 text-[11px] text-muted-foreground">{d.description}</span>
              </div>
              <span className="text-xs tabular-nums font-medium">
                {d.value}<span className="font-normal text-muted-foreground">/{d.max}</span>
              </span>
            </div>
            <Progress value={pct} className="h-1" />
            <dl className="space-y-0.5">
              {d.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[11px]">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="tabular-nums font-medium">
                    {item.pts}<span className="font-normal text-muted-foreground">/{item.max}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {d.note ? <p className="text-[10px] italic text-muted-foreground/60">{d.note}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function ProspectStatusBadge({
  status,
  elegivel,
}: {
  status: ProspectStatus;
  elegivel: boolean;
}) {
  if (!elegivel) {
    return (
      <Badge variant="secondary">
        <BadgeAlert className="mr-1 size-3" />
        Fora do critério
      </Badge>
    );
  }
  if (status === "qualificado") {
    return (
      <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
        <ShieldCheck className="mr-1 size-3" />
        Qualificado
      </Badge>
    );
  }
  if (status === "marginal") {
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
        <BadgeAlert className="mr-1 size-3" />
        Marginal
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <BadgeAlert className="mr-1 size-3" />
      Rejeitado
    </Badge>
  );
}

export function InfoField({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex gap-2">
      {icon ? <div className="mt-0.5 text-primary/60 [&_svg]:size-3.5">{icon}</div> : null}
      <div className="min-w-0 space-y-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`break-words text-sm font-medium ${valueClassName ?? ""}`}>{value}</dd>
      </div>
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
  const rendaAjustada =
    details.rendaAnualEstimada !== null
      ? ajustarInflacao(details.rendaAnualEstimada, details.rendaAnoReferencia, 0.055)
      : null;
  const rendaValue = rendaAjustada !== null ? brl(rendaAjustada) : "Não disponível";
  const programaValue =
    details.beneficiarioProgramaSocial === null
      ? "Sem dado confiável"
      : details.beneficiarioProgramaSocial
        ? details.programaSocialDescricao || "Beneficiário"
        : "Não identificado";
  const localizacaoValue =
    [details.localizacao.municipio, details.localizacao.uf]
      .filter(Boolean)
      .join(" / ") || "Não disponível";
  // IPCA acumulado 2010→2026 ≈ 2,8×
  const IPCA_2010_2026 = 2.8;
  const rendaPerCapitaValue =
    details.localizacao.rendaPerCapita !== null
      ? `${brl(details.localizacao.rendaPerCapita * IPCA_2010_2026)} (~2026)`
      : "Não disponível";
  const observation = details.homonimo.observacao
    .replace(/enriquecimento feito com cpf\/cnpj\.?/gi, "")
    .replace(/enriquecimento feito com documento\.?/gi, "")
    .trim();

  return (
    <Card className={borderClass}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className={`size-4 ${tone === "emerald" ? "text-emerald-700" : "text-primary/70"}`} />
          Perfil socioeconômico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Banknote className="size-3.5 text-primary/60" />
              Renda mensal estimada
            </div>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {rendaAjustada !== null ? `~${brl(rendaAjustada / 12)}` : "—"}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Banknote className="size-3.5 text-primary/60" />
              Renda anual estimada
            </div>
            <p className="mt-1 text-xl font-semibold tracking-tight text-muted-foreground">{rendaValue}</p>
          </div>
        </div>

        <Separator />

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <InfoField icon={<HandHeart />} label="Programas sociais" value={programaValue} />
          <InfoField
            icon={<BadgeAlert />}
            label="Risco de homônimo"
            value={`${details.homonimo.risco.toUpperCase()}${details.homonimo.quantidade > 0 ? ` · ${details.homonimo.quantidade} ocorrência(s)` : ""}`}
            valueClassName={riskClass}
          />
          <InfoField icon={<MapPin />} label="Localização" value={localizacaoValue} />
          <InfoField icon={<Banknote />} label="Renda per capita do CEP" value={rendaPerCapitaValue} />
          <InfoField icon={<Home />} label="Bairro" value={details.localizacao.bairro || "—"} />
          <InfoField icon={<MapPin />} label="CEP" value={details.localizacao.cep || "—"} />
        </dl>

        {observation ? (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
            <div>{observation}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
