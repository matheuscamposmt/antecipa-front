import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Building2, ExternalLink, FileText, Scale, Users, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchCompanyDetail } from "@/lib/api";
import { brl, formatDate, integer } from "@/lib/format";
import type { CompanyDetail } from "@/types";
import { MetricCard } from "@/components/metric-card";
import { CreditorsTable } from "@/components/creditors-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanyPage() {
  const { slug = "" } = useParams();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const response = await fetchCompanyDetail(slug);
        if (!cancelled) {
          setDetail(response);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar empresa.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[90rem] space-y-6 p-4 lg:p-6">
        <section className="space-y-3 pb-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-11 w-full max-w-6xl" />
          <Skeleton className="h-8 w-24" />
        </section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="w-full rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-full max-w-2xl" />
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <Skeleton className="h-10 w-full md:col-span-2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="w-full overflow-auto rounded-lg border">
            <div className="grid min-w-[1160px] grid-cols-[minmax(320px,1.6fr)_minmax(170px,0.8fr)_minmax(130px,0.65fr)_minmax(170px,0.85fr)_minmax(110px,0.5fr)_minmax(150px,0.7fr)] gap-4 border-b bg-muted/30 p-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
            </div>
            <div className="min-w-[1160px] divide-y">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                <div key={row} className="grid grid-cols-[minmax(320px,1.6fr)_minmax(170px,0.8fr)_minmax(130px,0.65fr)_minmax(170px,0.85fr)_minmax(110px,0.5fr)_minmax(150px,0.7fr)] gap-4 p-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="size-9 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
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
          <AlertDescription>{error || "Empresa não encontrada."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { company } = detail;

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-6 p-4 lg:p-6">
      <section className="space-y-3 pb-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Recuperação Judicial
        </p>
        <div className="space-y-2">
          <h1 className="font-body max-w-5xl text-3xl font-bold leading-tight tracking-tight text-foreground lg:text-4xl">
            {company.nomeEmpresa}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {company.linkCredores ? (
            <a
              href={company.linkCredores}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <FileText className="size-3" />
              Fonte
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Wallet} label="Crédito total" value={brl(company.totalCredito)} />
        <MetricCard icon={Scale} label="Credores mapeados" value={integer(company.quantidadeCredores)} />
        <MetricCard
          icon={Users}
          label="PF / PJ"
          value={`${integer(company.quantidadePF)} / ${integer(company.quantidadePJ)}`}
        />
        <MetricCard icon={Building2} label="Relação de credores" value={formatDate(company.dataDocumento)} />
      </section>

      <section>
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg">Credores mapeados</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tabela completa com filtros por status, classe, valor e índice de qualificação.
            </p>
          </CardHeader>
          <CardContent>
            <CreditorsTable data={detail.credores} companySlug={company.slug} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
