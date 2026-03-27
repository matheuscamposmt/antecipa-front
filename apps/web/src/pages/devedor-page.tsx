import { useEffect, useState, type ComponentType } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, AlertTriangle, BadgeCheck, Building2, ExternalLink, FileText, Landmark } from "lucide-react";
import { fetchDevedorDetail } from "@/lib/api";
import { brl, integer, percent } from "@/lib/format";
import type { DevedorDetail } from "@/types";
import { PrecatoriosTable } from "@/components/precatorios-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DevedorPage() {
  const { slug = "" } = useParams();
  const [detail, setDetail] = useState<DevedorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError("");
        const response = await fetchDevedorDetail(slug);
        if (!cancelled) {
          setDetail(response);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar devedor.");
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
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-4 w-40" />
              {[0, 1, 2].map((j) => <Skeleton key={j} className="h-14 w-full" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="size-4 text-destructive" />
          {error || "Devedor não encontrado"}
        </div>
      </div>
    );
  }

  const { devedor } = detail;
  const pctPago = devedor.valorTotalPrecatorio > 0
    ? (devedor.valorTotalPago / devedor.valorTotalPrecatorio) * 100
    : 0;
  const isRegimeEspecial = /especial/i.test(devedor.regime ?? "");

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="pb-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Devedor público · Precatório trabalhista</p>
        <h1 className="mt-1 text-xl font-semibold leading-tight">{devedor.nomeEmpresa}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{devedor.tribunal}</Badge>
          {devedor.regime ? (
            <Badge variant={isRegimeEspecial ? "destructive" : "outline"} className={isRegimeEspecial ? "opacity-80" : ""}>
              {devedor.regime}
            </Badge>
          ) : null}
          {devedor.cnpj ? <Badge variant="outline">CNPJ: {devedor.cnpj}</Badge> : null}
          {devedor.origemUrl ? (
            <a
              href={devedor.origemUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              <FileText className="size-3" />
              Fonte
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </section>

      {/* EC 136/2025 alert */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800">Atenção: impacto da EC 136/2025</p>
            <p className="text-xs text-amber-700">
              A Emenda Constitucional 136/2025 eliminou o prazo final de quitação dos precatórios, limitou pagamentos
              anuais a <strong>1–5% da RCL</strong> do ente e alterou a correção para{" "}
              <strong>IPCA + 2% a.a.</strong> (teto Selic). Entes com estoque elevado vs. RCL podem ter prazo de
              recebimento significativamente ampliado. Analise o regime de pagamento e a capacidade fiscal antes de
              realizar oferta.
            </p>
            {isRegimeEspecial ? (
              <p className="text-xs font-semibold text-amber-800">
                Este devedor está em <u>regime especial</u> — histórico de dificuldades de pagamento. Seletividade elevada recomendada.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Landmark} label="Valor total nominal" value={brl(devedor.valorTotalPrecatorio)} />
        <MetricCard icon={BadgeCheck} label="Valor pago" value={brl(devedor.valorTotalPago)} />
        <MetricCard icon={Building2} label="% pago vs. nominal" value={percent(pctPago)} />
        <MetricCard icon={FileText} label="Quantidade de precatórios" value={integer(devedor.quantidadePrecatorios)} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ContactsCard
          title="Credores do processo"
          items={detail.contatosProcesso.credores.map((item) => ({
            nome: item.nome,
            descricao: item.numerosProcesso.join(", "),
            telefones: item.telefones,
          }))}
        />
        <ContactsCard
          title="Advogados do processo"
          items={detail.contatosProcesso.advogados.map((item) => ({
            nome: item.nome,
            descricao: [item.numeroOab ? `OAB ${item.numeroOab}/${item.ufOab}` : "", item.numerosProcesso.join(", ")]
              .filter(Boolean)
              .join(" · "),
            telefones: item.telefones,
          }))}
        />
      </section>

      <PrecatoriosTable detail={detail} />
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

function ContactsCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ nome: string; descricao: string; telefones: string[] }>;
}) {
  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contato identificado.</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.nome}-${item.descricao}`} className="rounded-lg border border-border/70 p-3">
              <p className="font-medium">{item.nome}</p>
              {item.descricao ? <p className="mt-1 text-xs text-muted-foreground">{item.descricao}</p> : null}
              <p className="mt-2 text-sm">
                {item.telefones.length > 0 ? item.telefones.join(", ") : "Sem telefone encontrado"}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
