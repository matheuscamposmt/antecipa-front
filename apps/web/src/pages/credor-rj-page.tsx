import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Users,
  User,
} from "lucide-react";
import { fetchCredorParentes, fetchCredorRJDetail, fetchCredorRJPhones, type CredorParentesResponse } from "@/lib/api";
import { brl } from "@/lib/format";
import type { CredorRJDetail, DetailScoreBreakdown } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InfoField,
  OriginationScoreCard,
  PhonesSection,
  ProspectDetailsCard,
  ProspectStatusBadge,
} from "@/components/creditor-detail-shared";

// ── Main page ─────────────────────────────────────────────────────────────────

export function CredorRJPage() {
  const { hash = "" } = useParams();
  const [detail, setDetail] = useState<CredorRJDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [telefones, setTelefones] = useState<string[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(false);
  const [parentes, setParentes] = useState<CredorParentesResponse | null>(null);
  const [parentesLoading, setParentesLoading] = useState(false);
  const [parentesTriggered, setParentesTriggered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        setTelefones([]);
        const data = await fetchCredorRJDetail(hash);
        if (!cancelled) {
          setDetail(data);
          setLoading(false);
          setPhonesLoading(true);
          try {
            const phones = await fetchCredorRJPhones(hash);
            if (!cancelled) setTelefones(phones);
          } catch {
            // phones unavailable — not fatal
          } finally {
            if (!cancelled) setPhonesLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar credor.");
          setLoading(false);
        }
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [hash]);

  async function handleLoadParentes() {
    if (parentesTriggered) return;
    setParentesTriggered(true);
    setParentesLoading(true);
    try {
      const result = await fetchCredorParentes(hash);
      setParentes(result);
    } catch {
      // non-fatal
    } finally {
      setParentesLoading(false);
    }
  }

  if (loading) return <CredorSkeleton />;

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

  const hasRisco = /(IMPUGN|DIVERGEN|CONTEST|RESERVA|SUB JUDICE|RETIFIC)/i.test(detail.extra);

  const extraFields: Array<{ label: string; value: string }> = (() => {
    const raw = detail.extra?.trim() ?? "";
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.entries(parsed as Record<string, unknown>)
          .filter(([key]) => !/^(coluna|valor)/i.test(key))
          .map(([key, val]) => ({
            label: key.replace(/_/g, " "),
            value: String(val ?? "").replace(/\n/g, " ").trim() || "—",
          }));
      }
    } catch {
      // not JSON — ignore
    }
    return [];
  })();

  const classeLabel = detail.classe === "I" ? "Trabalhista" : `Classe ${detail.classe}`;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* ── Header ── */}
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Credor · Recuperação Judicial
        </p>
        <h1 className="text-2xl font-bold leading-tight lg:text-3xl">{detail.nome}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={detail.tipoPessoa === "PF" ? "default" : "secondary"}>
            <User className="mr-1 size-3" />
            {detail.tipoPessoa === "PF"
              ? "Pessoa Física"
              : detail.tipoPessoa === "PJ"
              ? "Pessoa Jurídica"
              : "Não identificado"}
          </Badge>
          {detail.cpfCnpj ? <Badge variant="outline">{detail.cpfCnpj}</Badge> : null}
          <Badge variant="outline">{classeLabel}</Badge>
          <ProspectStatusBadge status={detail.status} elegivel={detail.elegivel} />
        </div>
      </section>

      {/* ── Score (full width — produto principal) ── */}
      <ScoreCard
        score={detail.score}
        scoreAtivo={detail.scoreAtivo}
        scoreDevedor={detail.scoreDevedor}
        scoreCredit={detail.scoreCredit}
        breakdown={detail.scoreBreakdown}
      />

      {/* ── Contatos ── */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4 text-primary/70" />
            Telefones e contato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PhonesSection telefones={telefones} loading={phonesLoading} nome={detail.nome} />
        </CardContent>
      </Card>

      {/* ── Ficha do crédito ── */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-primary/70" />
            Ficha do crédito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-xs text-muted-foreground">Valor nominal do crédito</p>
            <p className="text-3xl font-bold tracking-tight">{brl(detail.valor)}</p>
          </div>

          <Separator />

          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <InfoField
              label="Tipo de pessoa"
              value={
                detail.tipoPessoa === "PF" ? "Pessoa Física" :
                detail.tipoPessoa === "PJ" ? "Pessoa Jurídica" : "—"
              }
            />
            <InfoField label="CPF / CNPJ" value={detail.cpfCnpj || "Não informado"} />
            <InfoField label="Classe do crédito" value={classeLabel} />
            <InfoField label="Moeda" value={detail.moeda || "BRL"} />
            <InfoField
              label="Elegível FIDC-NP"
              value={detail.elegivel ? "Sim" : "Não"}
              valueClassName={detail.elegivel ? "text-primary font-semibold" : "text-muted-foreground"}
            />
            <InfoField
              label="Prioridade legal"
              value={
                detail.classe === "I" ? "Alta — Trabalhista" :
                detail.classe === "II" ? "Média — Garantia Real" : "Baixa"
              }
            />
            {extraFields.map(({ label, value }) => (
              <InfoField key={label} label={label} value={value} />
            ))}
          </dl>

          {hasRisco && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-warning">Atenção: sinais de contestação</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A observação do AJ contém termos de impugnação, contestação ou reserva. Avaliar com cautela.
                </p>
              </div>
            </div>
          )}

          {!hasRisco && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Sem sinais de contestação nas observações do Administrador Judicial
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Perfil socioeconômico ── */}
      <ProspectDetailsCard details={detail.prospectDetails} />

      {/* ── Vínculos familiares ── */}
      {detail.tipoPessoa === "PF" && (
        <ParentesSection
          parentes={parentes}
          loading={parentesLoading}
          triggered={parentesTriggered}
          onLoad={handleLoadParentes}
        />
      )}

      {/* ── Empresa ── */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary/70" />
            Empresa em recuperação judicial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <InfoField label="Empresa" value={detail.empresa.nomeEmpresa} />
            <InfoField label="Administrador Judicial" value={detail.empresa.administradorJudicial} />
            <InfoField label="Relação de credores" value={detail.empresa.dataDocumento || "—"} />
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/empresa/${detail.empresa.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <FileText className="size-3.5" />
              Ver todos os credores
              <ChevronRight className="size-3.5" />
            </Link>
            {detail.empresa.linkCredores ? (
              <a
                href={detail.empresa.linkCredores}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
                Documento fonte (AJ)
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ── Outros processos ── */}
      {detail.outrasEmpresas.length > 0 ? (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-4 text-primary/70" />
              Aparece em outros processos
              <Badge variant="secondary" className="ml-1">{detail.outrasEmpresas.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mesmo credor identificado em outras recuperações judiciais — possível credor serial.
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {detail.outrasEmpresas.map((outra) => (
                <div key={outra.rowHash} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium">{outra.nomeEmpresa}</p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{brl(outra.valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {outra.classe === "I" ? "Trabalhista" : `Classe ${outra.classe}`}
                      </p>
                    </div>
                    <Link
                      to={`/credor/rj/${outra.rowHash}`}
                      className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      Ver
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ParentesSection({
  parentes,
  loading,
  triggered,
  onLoad,
}: {
  parentes: CredorParentesResponse | null;
  loading: boolean;
  triggered: boolean;
  onLoad: () => void;
}) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary/70" />
          Vínculos familiares
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Consulta por pessoas com mesmo sobrenome e endereço — beneficiários sociais e renda estimada.
        </p>
      </CardHeader>
      <CardContent>
        {!triggered && (
          <button
            type="button"
            onClick={onLoad}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Users className="size-3.5" />
            Consultar vínculos familiares
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Consultando base de dados — isso pode levar alguns segundos…
          </div>
        )}

        {!loading && triggered && parentes && parentes.parentes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum vínculo familiar identificado pelo endereço e sobrenome.
          </p>
        )}

        {!loading && parentes && parentes.parentes.length > 0 && (
          <div className="divide-y">
            {parentes.parentes.map((p) => (
              <div key={p.cpfMasked} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.cpfMasked} · {[p.municipio, p.uf].filter(Boolean).join(" / ")}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  {p.rendaAnualEstimada != null && (
                    <p className="text-sm font-semibold">
                      {brl(p.rendaAnualEstimada)}
                      {p.rendaAnoReferencia ? <span className="ml-1 text-xs font-normal text-muted-foreground">/{p.rendaAnoReferencia}</span> : null}
                    </p>
                  )}
                  {p.beneficiarioProgramaSocial ? (
                    <span className="inline-flex items-center rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                      {p.programaSocialDescricao || "Beneficiário social"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Sem benefício social</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCard({
  score,
  scoreAtivo,
  scoreDevedor,
  scoreCredit,
  breakdown,
}: {
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  breakdown: DetailScoreBreakdown;
}) {
  return (
    <OriginationScoreCard
      score={score}
      dimensions={[
        {
          label: "Ativo",
          description: "Certeza jurídica e liquidez",
          value: scoreAtivo,
          max: 40,
          items: breakdown.ativo.items,
          note: breakdown.ativo.note,
        },
        {
          label: "Devedor",
          description: "Capacidade de pagamento",
          value: scoreDevedor,
          max: 35,
          items: breakdown.devedor.items,
          note: breakdown.devedor.note,
        },
        {
          label: "Credor",
          description: "Propensão à cessão",
          value: scoreCredit,
          max: 25,
          items: breakdown.credor.items,
          note: breakdown.credor.note,
        },
      ]}
    />
  );
}

function CredorSkeleton() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-16 w-24" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
