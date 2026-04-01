import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, BadgeCheck, Building2, FileText, Landmark, Scale } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchDevedorDetail } from "@/lib/api";
import { brl, integer, percent } from "@/lib/format";
import type { DevedorDetail } from "@/types";
import { MetricCard } from "@/components/metric-card";
import { CredoresPrecatorioTable } from "@/components/credores-precatorio-table";
import { PrecatoriosTable } from "@/components/precatorios-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function DevedorPage() {
  const { slug = "" } = useParams();
  const [detail, setDetail] = useState<DevedorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const response = await fetchDevedorDetail(slug);
        if (!cancelled) setDetail(response);
      } catch (fetchError) {
        if (!cancelled)
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar devedor.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-white p-5 space-y-4">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-80" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white p-4 space-y-3">
          <Skeleton className="h-4 w-56" />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error || "Devedor não encontrado."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { devedor } = detail;
  const pctPago = devedor.valorTotalPrecatorio > 0
    ? (devedor.valorTotalPago / devedor.valorTotalPrecatorio) * 100
    : 0;
  const isRegimeEspecial = /especial/i.test(devedor.regime ?? "");

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="pb-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Devedor Público · Precatório
        </p>
        <h1 className="mt-1 text-xl font-semibold leading-tight text-emerald-950">{devedor.nomeEmpresa}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{devedor.tribunal}</Badge>
          {devedor.regime ? (
            <Badge
              variant={isRegimeEspecial ? "destructive" : "outline"}
              className={isRegimeEspecial ? "opacity-80" : "border-teal-200 bg-teal-50 text-teal-700"}
            >
              {devedor.regime}
            </Badge>
          ) : null}
          {devedor.cnpj ? <Badge variant="outline">CNPJ: {devedor.cnpj}</Badge> : null}
          {devedor.origemUrl ? (
            <a
              href={devedor.origemUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              <FileText className="size-3" />
              Fonte
            </a>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Landmark} label="Valor total nominal" value={brl(devedor.valorTotalPrecatorio)} cardClassName="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white" iconClassName="size-4 text-emerald-700" />
        <MetricCard icon={BadgeCheck} label="Valor pago" value={brl(devedor.valorTotalPago)} cardClassName="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white" iconClassName="size-4 text-emerald-700" />
        <MetricCard icon={Building2} label="% pago vs. nominal" value={percent(pctPago)} cardClassName="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white" iconClassName="size-4 text-emerald-700" />
        <MetricCard icon={Scale} label="Precatórios" value={integer(devedor.quantidadePrecatorios)} cardClassName="border-emerald-200/60 bg-gradient-to-br from-emerald-50/35 to-white" iconClassName="size-4 text-emerald-700" />
      </section>

      <CredoresPrecatorioTable credores={detail.credores} devedorSlug={slug} />

      <PrecatoriosTable detail={detail} devedorSlug={slug} />
    </div>
  );
}
