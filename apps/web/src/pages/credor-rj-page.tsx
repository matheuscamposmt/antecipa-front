import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Building2,
  CircleDollarSign,
  Coins,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  HandHeart,
  IdCard,
  Loader2,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Users,
  User,
  WalletCards,
} from "lucide-react";
import { fetchCredorParentes, fetchCredorRJDetail, fetchCredorRJPhones, type CredorParentesResponse } from "@/lib/api";
import { ajustarInflacao, brl, documentId, formatDate } from "@/lib/format";
import type { CredorRJDetail } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InfoField,
  PhonesSection,
  ProspectDetailsCard,
  ProspectStatusBadge,
  ScoreBreakdown,
  scoreLabelText,
  scoreTextColor,
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

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        setTelefones([]);
        setParentes(null);
        const data = await fetchCredorRJDetail(hash);
        if (!cancelled) {
          setDetail(data);
          setLoading(false);

          // phones in background
          setPhonesLoading(true);
          fetchCredorRJPhones(hash)
            .then((phones) => { if (!cancelled) setTelefones(phones); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setPhonesLoading(false); });

          // parentes in background (PF only)
          if (data.tipoPessoa === "PF") {
            setParentesLoading(true);
            fetchCredorParentes(hash)
              .then((result) => { if (!cancelled) setParentes(result); })
              .catch(() => {})
              .finally(() => { if (!cancelled) setParentesLoading(false); });
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
    <div className="mx-auto w-full max-w-[90rem] space-y-4 p-4 lg:p-6">
      {/* ── Header ── */}
      <section className="space-y-2">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Credor · Recuperação Judicial
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-body min-w-0 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">{detail.nome}</h1>
            <div className="hidden h-8 w-px shrink-0 bg-border sm:block" />
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
                <p className="mb-3 text-xs font-medium text-muted-foreground">Composição do índice</p>
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
            <div className="hidden h-8 w-px shrink-0 bg-border lg:block" />
            <div className="min-w-0 basis-full space-y-2 lg:basis-auto">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground lg:hidden">
                <Phone className="size-3" />
                Telefones e contato
              </p>
              <PhonesSection telefones={telefones} loading={phonesLoading} nome={detail.nome} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={detail.tipoPessoa === "PF" ? "default" : "secondary"}>
              <User className="mr-1 size-3" />
              {detail.tipoPessoa === "PF"
                ? "Pessoa Física"
                : detail.tipoPessoa === "PJ"
                ? "Pessoa Jurídica"
                : "Não identificado"}
            </Badge>
            {detail.cpfCnpj ? (
              <Badge variant="outline">
                <IdCard className="mr-1 size-3" />
                {documentId(detail.cpfCnpj)}
              </Badge>
            ) : null}
            <Badge variant="outline">
              <FileText className="mr-1 size-3" />
              {classeLabel}
            </Badge>
            <ProspectStatusBadge status={detail.status} elegivel={detail.elegivel} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
              <InfoField
                icon={<User />}
                label="Tipo de pessoa"
                value={
                  detail.tipoPessoa === "PF" ? "Pessoa Física" :
                  detail.tipoPessoa === "PJ" ? "Pessoa Jurídica" : "—"
                }
              />
              <InfoField icon={<IdCard />} label="CPF / CNPJ" value={documentId(detail.cpfCnpj)} />
              <InfoField icon={<BadgeCheck />} label="Classe do crédito" value={classeLabel} />
              <InfoField icon={<Coins />} label="Moeda" value={detail.moeda || "BRL"} />
              <InfoField
                icon={<ShieldCheck />}
                label="Elegível FIDC-NP"
                value={detail.elegivel ? "Sim" : "Não"}
                valueClassName={detail.elegivel ? "text-primary font-semibold" : "text-muted-foreground"}
              />
              <InfoField
                icon={<CircleDollarSign />}
                label="Prioridade legal"
                value={
                  detail.classe === "I" ? "Alta — Trabalhista" :
                  detail.classe === "II" ? "Média — Garantia Real" : "Baixa"
                }
              />
              {extraFields.map(({ label, value }) => (
                <InfoField key={label} icon={<FileText />} label={label} value={value} />
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
      </section>

      <section className={`grid grid-cols-1 gap-4 ${detail.tipoPessoa === "PF" ? "xl:grid-cols-2" : ""}`}>
        {/* ── Vínculos familiares ── */}
        {detail.tipoPessoa === "PF" && (
          <ParentesSection
            parentes={parentes}
            loading={parentesLoading}
          />
        )}

        {/* ── Processos e relacionados ── */}
        <ProcessosCard empresa={detail.empresa} outrasEmpresas={detail.outrasEmpresas} />
      </section>
    </div>
  );
}

function ProcessosCard({
  empresa,
  outrasEmpresas,
}: {
  empresa: CredorRJDetail["empresa"];
  outrasEmpresas: CredorRJDetail["outrasEmpresas"];
}) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-primary/70" />
          Processos e relacionados
          {outrasEmpresas.length > 0 && (
            <Badge variant="secondary" className="ml-1">{outrasEmpresas.length + 1}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Processo principal */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate font-medium">{empresa.nomeEmpresa}</p>
            {empresa.dataDocumento && (
              <p className="text-xs text-muted-foreground">Relação de credores · {formatDate(empresa.dataDocumento)}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to={`/empresa/${empresa.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <FileText className="size-3.5" />
              Ver todos os credores
              <ChevronRight className="size-3.5" />
            </Link>
            {empresa.linkCredores ? (
              <a
                href={empresa.linkCredores}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
                Documento fonte
              </a>
            ) : null}
          </div>
        </div>

        {/* Outros processos */}
        {outrasEmpresas.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Aparece também em {outrasEmpresas.length} outro{outrasEmpresas.length !== 1 ? "s" : ""} processo{outrasEmpresas.length !== 1 ? "s" : ""}
              </p>
              <div className="divide-y">
                {outrasEmpresas.map((outra) => (
                  <div key={outra.rowHash} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">{outra.nomeEmpresa}</p>
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


function ParenteRow({ p }: { p: CredorParentesResponse["parentes"][number] }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium truncate">{p.nome}</p>
        <p className="text-xs text-muted-foreground">
          {p.cpfMasked} · {[p.municipio, p.uf].filter(Boolean).join(" / ")}
        </p>
      </div>
      <div className="shrink-0 text-right space-y-1">
        {p.rendaAnualEstimada != null && (
          <p className="inline-flex items-center justify-end gap-1 text-sm font-semibold">
            <Banknote className="size-3.5 shrink-0 text-muted-foreground" />
            ~{brl(ajustarInflacao(p.rendaAnualEstimada, p.rendaAnoReferencia) / 12)}
          </p>
        )}
        <div>
          {p.beneficiarioProgramaSocial ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">
              <HandHeart className="size-3 shrink-0" />
              {p.programaSocialDescricao || "Beneficiário social"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <HandHeart className="size-3 shrink-0 opacity-40" />
              Sem benefício
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ParentesSection({
  parentes,
  loading,
}: {
  parentes: CredorParentesResponse | null;
  loading: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const preview = parentes?.parentes.slice(0, 2) ?? [];
  const rest = parentes?.parentes.slice(2) ?? [];

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary/70" />
            Vínculos familiares
            {parentes && parentes.parentes.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {parentes.parentes.length}
              </span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Consulta por pessoas com mesmo sobrenome e endereço — beneficiários sociais e renda estimada.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col">
          <div className="min-h-[7.5rem] flex-1">
            {loading && (
              <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Consultando vínculos familiares…
              </div>
            )}

            {!loading && parentes && parentes.parentes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum vínculo familiar identificado pelo endereço e sobrenome.
              </p>
            )}

            {!loading && preview.length > 0 && (
              <div className="divide-y">
                {preview.map((p) => (
                  <ParenteRow key={p.cpfMasked} p={p} />
                ))}
              </div>
            )}
          </div>

          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="size-3.5" />
              Ver mais {rest.length} {rest.length === 1 ? "familiar" : "familiares"}
            </button>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary/70" />
              Vínculos familiares
            </DialogTitle>
          </DialogHeader>
          <div className="divide-y">
            {parentes?.parentes.map((p) => (
              <ParenteRow key={p.cpfMasked} p={p} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


function CredorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-4 p-4 lg:p-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-40" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-12 min-w-80 flex-1" />
            <Skeleton className="h-14 w-28" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <div className="space-y-2 xl:w-[36rem] xl:pt-5">
          <Skeleton className="h-3 w-36" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-44 rounded-lg" />
            <Skeleton className="h-9 w-44 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="min-h-[21rem] rounded-xl border bg-card p-6 space-y-5">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-12 w-full max-w-xl" />
            <Skeleton className="h-px w-full" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-2">
                  <Skeleton className="size-4 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-xl border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-full max-w-md" />
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="rounded-xl border bg-card p-6">
        <Skeleton className="h-5 w-56" />
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2 md:justify-end">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
