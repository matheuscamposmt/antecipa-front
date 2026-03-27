import { useEffect, useState, type ComponentType } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Building2, ExternalLink, FileText, Scale, Users, Wallet } from "lucide-react";
import { fetchCompanyDetail } from "@/lib/api";
import { brl, integer } from "@/lib/format";
import type { CompanyDetail } from "@/types";
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
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-7 w-80" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-40" />
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
            <Skeleton className="h-8 w-full" />
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
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="size-4 text-destructive" />
          {error || "Empresa não encontrada"}
        </div>
      </div>
    );
  }

  const { company } = detail;
  const qualificados = detail.credores.filter((c) => c.status === "qualificado").length;
  const marginais = detail.credores.filter((c) => c.status === "marginal").length;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="pb-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Empresa em Recuperação Judicial</p>
        <h1 className="mt-1 text-xl font-semibold leading-tight">{company.nomeEmpresa}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{company.grupoEconomico || "Sem grupo econômico"}</Badge>
          <Badge variant="outline">AJ: {company.administradorJudicial}</Badge>
          {qualificados > 0 && (
            <Badge className="bg-green-600 text-white hover:bg-green-700">
              {qualificados} qualificado{qualificados !== 1 ? "s" : ""}
            </Badge>
          )}
          {marginais > 0 && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-600">
              {marginais} marginal{marginais !== 1 ? "is" : ""}
            </Badge>
          )}
          {company.linkCredores ? (
            <a
              href={company.linkCredores}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              <FileText className="size-3" />
              Documento fonte
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Wallet} label="Valor total de créditos" value={brl(company.totalCredito)} />
        <MetricCard icon={Scale} label="Prospects mapeados" value={integer(company.quantidadeCredores)} />
        <MetricCard
          icon={Users}
          label="PF / PJ"
          value={`${integer(company.quantidadePF)} / ${integer(company.quantidadePJ)}`}
        />
        <MetricCard icon={Building2} label="Data homologação" value={company.dataHomologacao || "Não informado"} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-base">Relação de prospects desta empresa</CardTitle>
              <p className="text-xs text-muted-foreground">
                Apenas créditos Classe I (trabalhistas) com valor de até 15 salários mínimos são elegíveis para o FIDC-NP.
              </p>
            </CardHeader>
            <CardContent>
              <CreditorsTable data={detail.credores} />
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-4">
          <RankingList ranking={detail.ranking} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-primary/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-primary/80" />
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
