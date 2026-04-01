import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { fetchPrecatorios, fetchPrecatorioOverview, type PrecatorioListResponse } from "@/lib/api";
import type { PrecatorioOverview } from "@/types";
import { PrecatorioCard } from "@/components/precatorio-card";
import { PrecatorioSectionCards } from "@/components/precatorio-section-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function PrecatoriosPage() {
  const [overview, setOverview] = useState<PrecatorioOverview | null>(null);
  const [debtorsData, setDebtorsData] = useState<PrecatorioListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");
        const [overviewData, debtors] = await Promise.all([
          fetchPrecatorioOverview(),
          fetchPrecatorios({ page, pageSize: 24, search }),
        ]);
        if (!cancelled) {
          setOverview(overviewData);
          setDebtorsData(debtors);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar precatórios.");
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
  }, [page, search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Precatórios</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Devedores públicos · TRT 1–24
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="pl-9"
          placeholder="Buscar devedor, tribunal ou CNPJ"
        />
      </div>

      {loading && !overview ? <PrecatoriosOverviewSkeleton /> : <PrecatorioSectionCards overview={overview} />}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <PrecatoriosCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(debtorsData?.items ?? []).map((debtor) => (
            <PrecatorioCard key={debtor.slug} debtor={debtor} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página <span className="font-medium text-foreground">{debtorsData?.page ?? 1}</span> de{" "}
          <span className="font-medium text-foreground">{debtorsData?.totalPages ?? 1}</span>
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
            disabled={!debtorsData || page >= debtorsData.totalPages}
          >
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrecatoriosOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-4 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PrecatoriosCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-white p-4 space-y-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="size-4 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
          <div className="rounded-lg border border-emerald-200/60 bg-white/80 p-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-32" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
