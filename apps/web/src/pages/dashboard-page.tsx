import { useEffect, useState } from "react";
import { AlertCircle, Filter } from "lucide-react";
import { fetchCompanies, fetchOverview, type CompanyListResponse } from "@/lib/api";
import type { Overview } from "@/types";
import { CompanyCard } from "@/components/company-card";
import { OverviewCharts } from "@/components/overview-charts";
import { SectionCards } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  search: string;
};

export function DashboardPage({ search }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companiesData, setCompaniesData] = useState<CompanyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [onlyWithCreditors, setOnlyWithCreditors] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [creditMinInput, setCreditMinInput] = useState("");
  const [creditMaxInput, setCreditMaxInput] = useState("");
  const [creditMinApplied, setCreditMinApplied] = useState<number | null>(null);
  const [creditMaxApplied, setCreditMaxApplied] = useState<number | null>(null);
  const [homologFrom, setHomologFrom] = useState("");
  const [homologTo, setHomologTo] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("all");

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
  }, [search, page, onlyWithCreditors]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const min = parseMoneyInput(creditMinInput);
      const max = parseMoneyInput(creditMaxInput);
      setCreditMinApplied(min);
      setCreditMaxApplied(max);
    }, 250);
    return () => clearTimeout(timeout);
  }, [creditMinInput, creditMaxInput]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Recuperação Judicial</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Prospects qualificados por score · Classe I · Lei 11.101/2005</p>
      </div>

      <SectionCards overview={overview} />
      <OverviewCharts overview={overview} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Empresas e grupos econômicos</h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={onlyWithCreditors} onCheckedChange={(value) => setOnlyWithCreditors(Boolean(value))} />
            Apenas com prospects mapeados
          </label>
        </div>

        <div className="rounded-lg border bg-background/70 p-3">
          <div className="mb-2 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Filter className="size-3" />
            Filtros rápidos
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Empresa ou grupo</p>
              <Input
                placeholder="Nome da empresa"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">Valor do crédito (R$)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="mín (R$)"
                  value={creditMinInput}
                  onChange={(event) => setCreditMinInput(event.target.value.replace(/[^\d.,]/g, ""))}
                />
                <Input
                  placeholder="máx (R$)"
                  value={creditMaxInput}
                  onChange={(event) => setCreditMaxInput(event.target.value.replace(/[^\d.,]/g, ""))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Homologação de</p>
              <Input
                placeholder="dd/mm/aaaa"
                value={homologFrom}
                onChange={(event) => setHomologFrom(maskBrDate(event.target.value))}
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Homologação até</p>
              <Input
                placeholder="dd/mm/aaaa"
                value={homologTo}
                onChange={(event) => setHomologTo(maskBrDate(event.target.value))}
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Grupo econômico</p>
              <Select value={grupoFilter} onValueChange={setGrupoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Grupo econômico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {(companiesData?.items ?? [])
                    .map((item) => item.grupoEconomico)
                    .filter((item, index, array) => Boolean(item) && array.indexOf(item) === index)
                    .sort((a, b) => a.localeCompare(b))
                    .map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="size-4 text-destructive" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando empresas...</p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
          {(companiesData?.items ?? [])
            .filter((company) => {
              if (nameFilter.trim()) {
                const value = nameFilter.trim().toLowerCase();
                const haystack = `${company.nomeEmpresa} ${company.grupoEconomico}`.toLowerCase();
                if (!haystack.includes(value)) {
                  return false;
                }
              }

              if (grupoFilter !== "all" && company.grupoEconomico !== grupoFilter) {
                return false;
              }

              if (creditMinApplied !== null && company.totalCredito < creditMinApplied) {
                return false;
              }
              if (creditMaxApplied !== null && company.totalCredito > creditMaxApplied) {
                return false;
              }

              if (homologFrom) {
                const homologIso = toIsoDate(company.dataHomologacao);
                if (!homologIso || homologIso < homologFrom) {
                  return false;
                }
              }
              if (homologTo) {
                const homologIso = toIsoDate(company.dataHomologacao);
                if (!homologIso || homologIso > homologTo) {
                  return false;
                }
              }
              return true;
            })
            .map((company) => (
              <CompanyCard key={company.slug} company={company} />
            ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {companiesData?.page ?? 1} de {companiesData?.totalPages ?? 1}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((current) => current + 1)}
              disabled={!companiesData || page >= companiesData.totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function parseMoneyInput(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(brDate: string): string {
  const match = brDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return "";
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function maskBrDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
