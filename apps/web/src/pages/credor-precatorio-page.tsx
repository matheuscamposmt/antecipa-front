import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  AlertCircle,
  BanknoteArrowDown,
  ChevronDown,
  ExternalLink,
  FileText,
  Landmark,
  Scale,
  ShieldCheck,
  ShieldAlert,
  User,
} from "lucide-react";
import { fetchCredorPrecatorioDetail } from "@/lib/api";
import { brl, percent } from "@/lib/format";
import type { CredorPrecatorioDetail } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InfoField,
  PhonesSection,
  ProspectDetailsCard,
  ProspectStatusBadge,
  ScoreBreakdown,
  scoreLabelText,
  scoreTextColor,
  parseDesagioRange,
} from "@/components/creditor-detail-shared";

export function CredorPrecatorioPage() {
  const location = useLocation();
  const { numeroProcesso = "", credorNome = "" } = useParams();
  const [detail, setDetail] = useState<CredorPrecatorioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchCredorPrecatorioDetail(numeroProcesso, credorNome);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar credor.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [numeroProcesso, credorNome]);

  if (loading) return <CredorPrecatorioSkeleton />;

  if (error || !detail) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error || "Credor não encontrado."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const desagioRange = parseDesagioRange(detail.desagioRec);
  const hasRisco = detail.precatorios.some((item) => item.suspenso);
  const processBackTo = (location.state as { processBackTo?: string; processBackLabel?: string } | null)?.processBackTo;
  const processBackLabel = (location.state as { processBackTo?: string; processBackLabel?: string } | null)?.processBackLabel;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Credor · Precatório
        </p>
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold leading-tight text-emerald-950 lg:text-3xl">{detail.credorNome}</h1>
            <div className="h-8 w-px shrink-0 bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted"
                >
                  <span className={`text-5xl font-bold tabular-nums leading-none ${scoreTextColor(detail.score)}`}>
                    {detail.score}
                  </span>
                  <div className="text-left">
                    <p className="text-[10px] leading-none text-muted-foreground">/100</p>
                    <p className={`text-xs font-semibold ${scoreTextColor(detail.score)}`}>{scoreLabelText(detail.score)}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-3">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Composição do score</p>
                <ScoreBreakdown dimensions={[
                  {
                    label: "Ativo",
                    description: "Certeza jurídica e liquidez",
                    value: detail.scoreAtivo,
                    max: 40,
                    items: detail.scoreBreakdown.ativo.items,
                    note: detail.scoreBreakdown.ativo.note,
                  },
                  {
                    label: "Devedor",
                    description: "Capacidade de pagamento",
                    value: detail.scoreDevedor,
                    max: 35,
                    items: detail.scoreBreakdown.devedor.items,
                    note: detail.scoreBreakdown.devedor.note,
                  },
                  {
                    label: "Credor",
                    description: "Propensão à cessão",
                    value: detail.scoreCredit,
                    max: 25,
                    items: detail.scoreBreakdown.credor.items,
                    note: detail.scoreBreakdown.credor.note,
                  },
                ]} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={detail.tipoPessoa === "PF" ? "default" : "secondary"} className={detail.tipoPessoa === "PF" ? "bg-emerald-700 text-white" : ""}>
            <User className="mr-1 size-3" />
            {detail.tipoPessoa === "PF"
              ? "Pessoa Física"
              : detail.tipoPessoa === "PJ"
                ? "Pessoa Jurídica"
                : "Não identificado"}
          </Badge>
          {detail.credorDocumento ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{detail.credorDocumento}</Badge> : null}
          {detail.precatorios[0]?.natureza ? <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">{detail.precatorios[0].natureza}</Badge> : null}
          <ProspectStatusBadge status={detail.status} elegivel={detail.elegivel} />
        </div>
        <PhonesSection telefones={detail.telefones} loading={false} nome={detail.credorNome} />
      </section>

      <div className="grid grid-cols-1 gap-4">
        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BanknoteArrowDown className="size-4 text-emerald-700" />
              Ficha do crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/60 bg-white/85 p-4">
                <p className="text-xs text-muted-foreground">Valor nominal consolidado</p>
                <p className="text-3xl font-bold tracking-tight">{brl(detail.valorTotal)}</p>
              </div>
              <div className="rounded-xl border border-teal-200/60 bg-white/85 p-4">
                <p className="text-xs text-muted-foreground">% pago do processo</p>
                <p className="text-3xl font-bold tracking-tight text-teal-700">{percent(detail.processo.percentualPago)}</p>
              </div>
              {desagioRange ? (
                <div className="rounded-xl border border-emerald-200/60 bg-white/85 p-4 md:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Deságio recomendado:{" "}
                    <span className="font-semibold text-foreground">{detail.desagioRec}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Valor líquido estimado: </span>
                    <span className="font-semibold text-emerald-700">
                      {desagioRange[0] === desagioRange[1]
                        ? brl(detail.valorTotal * (1 - desagioRange[0] / 100))
                        : `${brl(detail.valorTotal * (1 - desagioRange[0] / 100))} – ${brl(detail.valorTotal * (1 - desagioRange[1] / 100))}`}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  label: "Tipo de pessoa",
                  value:
                    detail.tipoPessoa === "PF"
                      ? "Pessoa Física"
                      : detail.tipoPessoa === "PJ"
                        ? "Pessoa Jurídica"
                        : "—",
                },
                { label: "CPF / CNPJ", value: detail.credorDocumento || "Não informado" },
                { label: "Processo", value: detail.processo.numeroProcesso || "—" },
                { label: "Devedor público", value: detail.processo.devedor || "—" },
                { label: "Tribunal", value: detail.processo.tribunal || "—" },
                { label: "Regime", value: detail.processo.regime || "—" },
                {
                  label: "Elegível FIDC-NP",
                  value: detail.elegivel ? "Sim" : "Não",
                  valueClassName: detail.elegivel ? "font-semibold text-emerald-700" : "text-muted-foreground",
                },
                {
                  label: "Pagamento prioritário",
                  value: detail.precatorios.some((item) => item.pagamentoPrioritario) ? "Sim" : "Não",
                },
                {
                  label: "Suspensão",
                  value: detail.precatorios.some((item) => item.suspenso) ? "Com suspensão" : "Sem suspensão",
                  valueClassName: detail.precatorios.some((item) => item.suspenso) ? "text-amber-700" : "text-emerald-700",
                },
              ].map((field) => (
                <div key={field.label} className="rounded-xl border border-emerald-200/60 bg-white/85 p-4">
                  <InfoField label={field.label} value={field.value} valueClassName={field.valueClassName} />
                </div>
              ))}
            </div>

            {hasRisco ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">Atenção: crédito com suspensão</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Há pelo menos um precatório deste credor marcado como suspenso no processo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-emerald-700" />
                Nenhum precatório suspenso para este credor dentro do processo
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <ProspectDetailsCard details={detail.prospectDetails} tone="emerald" />

      <Card className="border-teal-200/60 bg-gradient-to-br from-teal-50/35 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4 text-teal-700" />
            Processo relacionado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <InfoField label="Processo" value={detail.processo.numeroProcesso} />
            <InfoField label="Devedor" value={detail.processo.devedor} />
            <InfoField label="Tribunal" value={detail.processo.tribunal || "—"} />
            <InfoField label="Regime" value={detail.processo.regime || "—"} />
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/processo/${encodeURIComponent(detail.processo.numeroProcesso)}`}
              state={{
                backTo: processBackTo ?? "/precatorios",
                backLabel: processBackLabel ?? "Voltar aos precatórios",
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100"
            >
              <FileText className="size-3.5" />
              Ver processo
            </Link>
            {detail.processo.origemUrl ? (
              <a
                href={detail.processo.origemUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
                Documento fonte
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-emerald-700" />
            Precatórios do credor neste processo
            <Badge variant="secondary" className="ml-1">{detail.precatorios.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {detail.precatorios.map((item, index) => (
              <div key={`${item.numeroPrecatorio}-${index}`} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium">{item.numeroPrecatorio || "Precatório sem número"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.natureza || "Natureza não informada"}
                    {item.pagamentoPrioritario ? " · Prioritário" : ""}
                    {item.suspenso ? " · Suspenso" : ""}
                  </p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-semibold">{brl(item.valor)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CredorPrecatorioSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-white p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-20 rounded-xl md:col-span-2" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-white p-5 space-y-4">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className="rounded-xl border border-teal-200/60 bg-gradient-to-br from-teal-50/40 to-white p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      </div>
    </div>
  );
}
