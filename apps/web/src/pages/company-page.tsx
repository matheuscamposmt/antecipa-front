import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Building2, ExternalLink, FileText, Scale, Users, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchCompanyDetail } from "@/lib/api";
import { brl, integer } from "@/lib/format";
import type { CompanyDetail } from "@/types";
import { MetricCard } from "@/components/metric-card";
import { CreditorsTable } from "@/components/creditors-table";
import { RankingList } from "@/components/ranking-list";
import { Badge } from "@/components/ui/badge";
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
      <div className="space-y-6 p-4 lg:p-6">
        <div className="rounded-xl border p-5 space-y-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-96" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-20" />
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          </div>
          <div className="xl:col-span-4 rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-40" />
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
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
  const qualificados = detail.credores.filter((c) => c.status === "qualificado").length;
  const marginais = detail.credores.filter((c) => c.status === "marginal").length;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="pb-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Recuperação Judicial
        </p>
        <h1 className="mt-1 text-xl font-semibold leading-tight">{company.nomeEmpresa}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {company.administradorJudicial && (
            <Badge variant="outline">AJ: {company.administradorJudicial}</Badge>
          )}
          {qualificados > 0 && (
            <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
              {qualificados} qualificado{qualificados !== 1 ? "s" : ""}
            </Badge>
          )}
          {marginais > 0 && (
            <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
              {marginais} marginal{marginais !== 1 ? "is" : ""}
            </Badge>
          )}
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
        <MetricCard icon={Building2} label="Relação de credores" value={company.dataDocumento || "—"} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-base">Credores mapeados</CardTitle>
              <p className="text-xs text-muted-foreground">
                Elegíveis: Classe I (trabalhistas) com valor de até 15 salários mínimos.
              </p>
            </CardHeader>
            <CardContent>
              <CreditorsTable data={detail.credores} companySlug={company.slug} />
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-4">
          <RankingList ranking={detail.ranking} companySlug={company.slug} />
        </div>
      </section>
    </div>
  );
}
