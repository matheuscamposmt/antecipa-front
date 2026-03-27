import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { fetchCredorRJDetail } from "@/lib/api";
import { brl } from "@/lib/format";
import type { CredorRJDetail, ProspectStatus, ScoreBreakdown } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function CredorRJPage() {
  const { hash = "" } = useParams();
  const [detail, setDetail] = useState<CredorRJDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offerSent, setOfferSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchCredorRJDetail(hash);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar prospect.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [hash]);

  if (loading) return <CredorSkeleton />;

  if (error || !detail) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="size-4 text-destructive" />
          {error || "Prospect não encontrado"}
        </div>
      </div>
    );
  }

  const hasRisco = /(IMPUGN|DIVERGEN|CONTEST|RESERVA|SUB JUDICE|RETIFIC)/i.test(detail.extra);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Link
        to={`/empresa/${detail.empresa.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para {detail.empresa.nomeEmpresa}
      </Link>

      {/* Header */}
      <section className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Prospect · Recuperação Judicial</p>
            <h1 className="text-xl font-semibold leading-tight">{detail.nome}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={detail.tipoPessoa === "PF" ? "default" : "secondary"}>
                <User className="mr-1 size-3" />
                {detail.tipoPessoa === "PF" ? "Pessoa Física" : detail.tipoPessoa === "PJ" ? "Pessoa Jurídica" : "Não identificado"}
              </Badge>
              {detail.cpfCnpj ? <Badge variant="outline">{detail.cpfCnpj}</Badge> : null}
              <Badge variant="outline">Classe {detail.classe}</Badge>
              <StatusBadge status={detail.status} elegivel={detail.elegivel} />
            </div>
          </div>

          <ScorePanel
            score={detail.score}
            scoreAtivo={detail.scoreAtivo}
            scoreDevedor={detail.scoreDevedor}
            scoreCredit={detail.scoreCredit}
            desagioRec={detail.desagioRec}
          />
        </div>

        {/* Phones */}
        {detail.telefones.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.telefones.map((tel) => (
              <a
                key={tel}
                href={`tel:${tel.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
              >
                <Phone className="size-3.5" />
                {tel}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum telefone encontrado para este prospect.</p>
        )}

        {/* Offer scaffold */}
        {detail.elegivel && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {offerSent ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800">
                <BadgeCheck className="size-4" />
                Oferta registrada com sucesso
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOfferSent(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
              >
                Registrar oferta
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Deságio mínimo absoluto: <strong>15%</strong>. Deságio recomendado: <strong>{detail.desagioRec}</strong>.
            </p>
            <div className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
              <Info className="size-3" />
              Registro de oferta completo requer infraestrutura de banco — ver TODO.md
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Crédito */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Valor do crédito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{brl(detail.valor)}</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Classe</span>
                <span className="font-medium text-foreground">{detail.classe}</span>
              </div>
              <div className="flex justify-between">
                <span>Moeda</span>
                <span className="font-medium text-foreground">{detail.moeda}</span>
              </div>
              <div className="flex justify-between">
                <span>Deságio recomendado</span>
                <span className={`font-semibold ${detail.elegivel ? "text-foreground" : "text-muted-foreground"}`}>
                  {detail.desagioRec}
                </span>
              </div>
              {detail.extra ? (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground">Observação do AJ</p>
                  <p className="mt-0.5 text-xs">{detail.extra}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Risco */}
        <Card className={`border-primary/10 ${hasRisco ? "border-orange-200 bg-orange-50/30" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              {hasRisco ? (
                <ShieldAlert className="size-4 text-orange-500" />
              ) : (
                <ShieldCheck className="size-4 text-green-600" />
              )}
              Avaliação de risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className={`text-base font-semibold ${hasRisco ? "text-orange-700" : "text-green-700"}`}>
                {hasRisco ? "Sinais de risco detectados" : "Sem sinais de risco"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasRisco
                  ? "Campo de observações do AJ contém termos de impugnação, divergência, contestação ou reserva."
                  : "Nenhum termo de alerta identificado nas observações do Administrador Judicial."}
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Elegível FIDC-NP</span>
                <span className={`font-medium ${detail.elegivel ? "text-green-700" : "text-muted-foreground"}`}>
                  {detail.elegivel ? "Sim" : "Não"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prioridade legal</span>
                <span className="font-medium text-foreground">
                  {detail.classe === "I" ? "Alta — Trabalhista/Acidentário" : detail.classe === "II" ? "Média — Garantia Real" : "Baixa"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score breakdown */}
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Decomposição do score</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreBreakdownPanel breakdown={detail.scoreBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Empresa */}
      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary/70" />
            Empresa em recuperação judicial (devedor)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoField label="Empresa" value={detail.empresa.nomeEmpresa} />
            <InfoField label="Grupo econômico" value={detail.empresa.grupoEconomico || "Sem grupo"} />
            <InfoField label="Administrador Judicial" value={detail.empresa.administradorJudicial} />
            <InfoField label="Data de homologação" value={detail.empresa.dataHomologacao || "Não informado"} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/empresa/${detail.empresa.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <FileText className="size-3.5" />
              Ver todos os prospects desta empresa
              <ChevronRight className="size-3.5" />
            </Link>
            {detail.empresa.linkCredores ? (
              <a
                href={detail.empresa.linkCredores}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <ExternalLink className="size-3.5" />
                Documento fonte (AJ)
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Outros processos */}
      {detail.outrasEmpresas.length > 0 ? (
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-4 text-primary/70" />
              Aparece em outros processos ({detail.outrasEmpresas.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Mesmo prospect identificado em outras recuperações judiciais por nome ou CPF/CNPJ — possível credor serial.
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {detail.outrasEmpresas.map((outra) => (
                <div key={outra.rowHash} className="flex items-center justify-between py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-medium">{outra.nomeEmpresa}</p>
                    {outra.grupoEconomico ? (
                      <p className="text-xs text-muted-foreground">{outra.grupoEconomico}</p>
                    ) : null}
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{brl(outra.valor)}</p>
                      <p className="text-xs text-muted-foreground">Classe {outra.classe}</p>
                    </div>
                    <Link
                      to={`/credor/rj/${outra.rowHash}`}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
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

function StatusBadge({ status, elegivel }: { status: ProspectStatus; elegivel: boolean }) {
  if (!elegivel) {
    return <Badge variant="secondary">Fora do critério</Badge>;
  }
  if (status === "qualificado") {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-700">
        <ShieldCheck className="mr-1 size-3" />
        Qualificado
      </Badge>
    );
  }
  if (status === "marginal") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-600">
        Marginal
      </Badge>
    );
  }
  return <Badge variant="secondary">Rejeitado</Badge>;
}

function ScorePanel({
  score,
  scoreAtivo,
  scoreDevedor,
  scoreCredit,
  desagioRec,
}: {
  score: number;
  scoreAtivo: number;
  scoreDevedor: number;
  scoreCredit: number;
  desagioRec: string;
}) {
  const color = score >= 65 ? "text-green-700" : score >= 50 ? "text-amber-700" : "text-muted-foreground";
  const bg = score >= 65 ? "bg-green-50 border-green-200" : score >= 50 ? "bg-amber-50 border-amber-200" : "bg-muted/40 border-border";

  return (
    <div className={`rounded-xl border px-5 py-4 ${bg} min-w-[180px]`}>
      <div className="flex items-baseline gap-1">
        <p className={`text-4xl font-bold ${color}`}>{score}</p>
        <p className="text-sm text-muted-foreground">/100</p>
      </div>
      <p className="text-xs text-muted-foreground">score final</p>
      <div className="mt-3 space-y-1.5 text-xs">
        <MiniScore label="Ativo" value={scoreAtivo} max={40} />
        <MiniScore label="Devedor" value={scoreDevedor} max={35} />
        <MiniScore label="Credor" value={scoreCredit} max={25} />
      </div>
      {desagioRec !== "Não recomendado" && (
        <div className="mt-3 border-t pt-2">
          <p className="text-[11px] text-muted-foreground">Deságio rec.</p>
          <p className="font-semibold text-sm">{desagioRec}</p>
        </div>
      )}
    </div>
  );
}

function MiniScore({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value}
        <span className="text-muted-foreground">/{max}</span>
      </span>
    </div>
  );
}

function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="space-y-4">
      <DimensionBlock
        label="Score do Ativo"
        subtitle="Certeza jurídica e liquidez do título (máx 40)"
        total={breakdown.ativo.total}
        max={40}
        items={[
          { label: "Classe do crédito (I)", value: breakdown.ativo.classe, max: 20 },
          { label: "Documento válido", value: breakdown.ativo.documento, max: 12 },
          { label: "Ausência de riscos (AJ)", value: breakdown.ativo.sinais, max: 8 },
        ]}
      />
      <DimensionBlock
        label="Score do Devedor"
        subtitle="Capacidade de pagamento — proxy por distribuição de valores"
        total={breakdown.devedor.total}
        max={35}
        items={[
          { label: "Faixa de valor no plano", value: breakdown.devedor.faixa, max: 35 },
        ]}
        note="Score do devedor real requer RCL, homologação e coobrigados — ver TODO."
      />
      <DimensionBlock
        label="Score do Credor"
        subtitle="Propensão à cessão — proxy por tipo de pessoa e valor"
        total={breakdown.credor.total}
        max={25}
        items={[
          { label: "Tipo de pessoa", value: breakdown.credor.tipoPessoa, max: 10 },
          { label: "Valor (z-score)", value: breakdown.credor.valor, max: 15 },
        ]}
        note="Score do credor real requer renda, localização e benefícios — ver TODO."
      />
    </div>
  );
}

function DimensionBlock({
  label,
  subtitle,
  total,
  max,
  items,
  note,
}: {
  label: string;
  subtitle: string;
  total: number;
  max: number;
  items: Array<{ label: string; value: number; max: number }>;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold">{label}</p>
        <span className="text-xs font-bold">
          {total}
          <span className="font-normal text-muted-foreground">/{max}</span>
        </span>
      </div>
      <Progress value={(total / max) * 100} className="h-2" />
      <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      <div className="space-y-1.5 pl-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-0.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value}/{item.max}</span>
            </div>
            <Progress value={item.max > 0 ? (item.value / item.max) * 100 : 0} className="h-1" />
          </div>
        ))}
      </div>
      {note ? (
        <p className="inline-flex items-center gap-1 text-[10px] text-amber-600">
          <Info className="size-3" />
          {note}
        </p>
      ) : null}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function CredorSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Skeleton className="h-4 w-40" />
      <div className="rounded-xl border p-5 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
