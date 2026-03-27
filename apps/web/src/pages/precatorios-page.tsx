import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { fetchPrecatorios, fetchPrecatorioOverview, type PrecatorioListResponse } from "@/lib/api";
import type { PrecatorioOverview } from "@/types";
import { PrecatorioCard } from "@/components/precatorio-card";
import { PrecatorioSectionCards } from "@/components/precatorio-section-cards";
import { Button } from "@/components/ui/button";

type Props = {
  search: string;
};

export function PrecatoriosPage({ search }: Props) {
  const [overview, setOverview] = useState<PrecatorioOverview | null>(null);
  const [debtorsData, setDebtorsData] = useState<PrecatorioListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");
        const [overviewData, debtors] = await Promise.all([
          fetchPrecatorioOverview(),
          fetchPrecatorios({
            page,
            pageSize: 24,
            search,
          }),
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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Precatórios Trabalhistas</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Devedores públicos — TRT-1 a TRT-24 · EC 136/2025 em vigor</p>
      </div>

      <PrecatorioSectionCards overview={overview} />

      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="size-4 text-destructive" />
          {error}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Carregando devedores...</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(debtorsData?.items ?? []).map((debtor) => (
          <PrecatorioCard key={debtor.slug} debtor={debtor} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página {debtorsData?.page ?? 1} de {debtorsData?.totalPages ?? 1}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
            Anterior
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage((current) => current + 1)}
            disabled={!debtorsData || page >= debtorsData.totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
