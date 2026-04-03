import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Search, Tag } from "lucide-react";
import { fetchCompanies, fetchOverview, type CompanyListResponse } from "@/lib/api";
import type { Overview } from "@/types";
import { CompanyCard } from "@/components/company-card";
import { OverviewCharts } from "@/components/overview-charts";
import { SectionCards } from "@/components/section-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companiesData, setCompaniesData] = useState<CompanyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [onlyWithCreditors, setOnlyWithCreditors] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [creditMinInput, setCreditMinInput] = useState("");
  const [creditMaxInput, setCreditMaxInput] = useState("");
  const [creditMin, setCreditMin] = useState<number | null>(null);
  const [creditMax, setCreditMax] = useState<number | null>(null);
  const [homologFrom, setHomologFrom] = useState("");
  const [homologTo, setHomologTo] = useState("");
  const [classeFilter, setClasseFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const [overviewData, companies] = await Promise.all([
          fetchOverview(),
          fetchCompanies({
            page,
            pageSize: 30,
            search,
            onlyWithCreditors,
            creditMin,
            creditMax,
          }),
        ]);
        if (!cancelled) {
          setOverview(overviewData);
          setCompaniesData(companies);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar dados.");
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
  }, [search, page, onlyWithCreditors, creditMin, creditMax]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCreditMin(parseMoneyInput(creditMinInput));
      setCreditMax(parseMoneyInput(creditMaxInput));
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [creditMinInput, creditMaxInput]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recuperação Judicial</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Credores trabalhistas mapeados por score · Lei 11.101/2005
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tag className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground hidden sm:inline">Classe:</span>
          <Select value={classeFilter} onValueChange={setClasseFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as classes</SelectItem>
              <SelectItem value="I">Trabalhista (I)</SelectItem>
              <SelectItem value="II">Classe II</SelectItem>
              <SelectItem value="III">Classe III</SelectItem>
              <SelectItem value="IV">Classe IV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && !overview ? <DashboardOverviewSkeleton /> : <SectionCards overview={overview} classeFilter={classeFilter} />}
      {loading && !overview ? <DashboardChartsSkeleton /> : <OverviewCharts overview={overview} />}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Empresas e grupos econômicos</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={onlyWithCreditors}
              onCheckedChange={(value) => setOnlyWithCreditors(Boolean(value))}
            />
            Apenas com credores mapeados
          </label>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa, grupo ou AJ"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Valor mín."
              value={creditMinInput}
              onChange={(e) => setCreditMinInput(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            <Input
              placeholder="Valor máx."
              value={creditMaxInput}
              onChange={(e) => setCreditMaxInput(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </div>
          <Input
            placeholder="Rel. credores de (dd/mm/aa)"
            value={homologFrom}
            onChange={(e) => setHomologFrom(maskBrDate(e.target.value))}
            maxLength={10}
          />
          <Input
            placeholder="Rel. credores até (dd/mm/aa)"
            value={homologTo}
            onChange={(e) => setHomologTo(maskBrDate(e.target.value))}
            maxLength={10}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Erro ao carregar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <DashboardCardsSkeleton />
        ) : (
          (() => {
            const filteredCompanies = (companiesData?.items ?? []).filter((company) => {
              if (creditMinApplied !== null && company.totalCredito < creditMinApplied) return false;
              if (creditMaxApplied !== null && company.totalCredito > creditMaxApplied) return false;
              if (homologFrom) {
                const homologIso = toIsoDate(company.dataDocumento);
                if (!homologIso || homologIso < homologFrom) return false;
              }
              if (homologTo) {
                const homologIso = toIsoDate(company.dataDocumento);
                if (!homologIso || homologIso > homologTo) return false;
              }
              return true;
            });

            if (filteredCompanies.length === 0) {
              return (
                <Alert>
                  <AlertCircle className="size-4" />
                  <AlertTitle>Nenhuma empresa encontrada</AlertTitle>
                  <AlertDescription>
                    Ajuste os filtros aplicados para visualizar empresas e grupos econômicos.
                  </AlertDescription>
                </Alert>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
                {filteredCompanies.map((company) => (
                  <CompanyCard key={company.slug} company={company} />
                ))}
              </div>
            );
          })()
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página <span className="font-medium text-foreground">{companiesData?.page ?? 1}</span> de{" "}
            <span className="font-medium text-foreground">{companiesData?.totalPages ?? 1}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={!companiesData || page >= companiesData.totalPages}
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function parseMoneyInput(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(brDate: string): string {
  const match = brDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function maskBrDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function DashboardOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-4 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-28" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3, 4].map((bar) => (
              <div key={bar} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-4 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-12 rounded-md" />
            ))}
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
