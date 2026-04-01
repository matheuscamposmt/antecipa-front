import { useEffect, useState, type ComponentType } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  FileText,
  Landmark,
  Scale,
  Star,
  Users,
} from "lucide-react";
import { fetchProcessoDetail } from "@/lib/api";
import { brl, integer, percent } from "@/lib/format";
import type { ProcessoDetail } from "@/types";
import { MetricCard } from "@/components/metric-card";
import { PhoneList } from "@/components/phone-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ProcessoPage() {
  const { numero = "" } = useParams();
  const [detail, setDetail] = useState<ProcessoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProcessoDetail(decodeURIComponent(numero));
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar processo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [numero]);

  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-60 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error || "Processo não encontrado."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const pctPago = detail.valorTotal > 0 ? (detail.valorPago / detail.valorTotal) * 100 : 0;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <section className="pb-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Processo Judicial · Precatório Trabalhista</p>
        <h1 className="mt-1 font-mono text-lg font-semibold leading-tight">{detail.numeroProcesso}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{detail.devedor}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{detail.tribunal}</Badge>
          {detail.cnpj ? <Badge variant="outline">CNPJ: {detail.cnpj}</Badge> : null}
          {detail.naturezaDominante ? <Badge variant="outline">{detail.naturezaDominante}</Badge> : null}
          {detail.temPrioritario ? <Badge variant="secondary">Prioritário</Badge> : null}
          {detail.algumSuspenso ? (
            <Badge variant="destructive" className="opacity-80">Suspenso</Badge>
          ) : null}
        </div>
      </section>

      {/* Score */}
      <ScoreCard detail={detail} />

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Landmark} label="Valor total nominal" value={brl(detail.valorTotal)} />
        <MetricCard icon={BadgeCheck} label="Valor pago" value={brl(detail.valorPago)} />
        <MetricCard icon={Building2} label="% pago vs. nominal" value={percent(pctPago)} />
        <MetricCard icon={FileText} label="Precatórios no processo" value={integer(detail.quantidadePrecatorios)} />
      </section>

      {/* Credores + Advogados */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ContactCard
          title="Credores"
          icon={Users}
          items={detail.credores.map((c) => ({
            nome: c.nome,
            descricao: "",
            telefones: c.telefones,
          }))}
        />
        <ContactCard
          title="Advogados"
          icon={Scale}
          items={detail.advogados.map((a) => ({
            nome: a.nome,
            descricao: a.numeroOab ? `OAB ${a.numeroOab}/${a.ufOab}` : "",
            telefones: a.telefones,
          }))}
        />
      </section>

      {/* Precatórios table */}
      <Card className="border-primary/10">
        <CardHeader>
          <CardTitle className="text-base">Precatórios neste processo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Precatório</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead>Preferencial</TableHead>
                  <TableHead>Suspenso</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Recebimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.precatorios.length > 0 ? (
                  detail.precatorios.map((row, i) => (
                    <TableRow key={`${row.numeroPrecatorio}-${i}`}>
                      <TableCell className="font-mono text-xs">{row.numeroPrecatorio || "-"}</TableCell>
                      <TableCell>{row.natureza || "-"}</TableCell>
                      <TableCell>{row.pagamentoPreferencial}</TableCell>
                      <TableCell>
                        {row.suspenso ? (
                          <Badge variant="destructive" className="text-xs opacity-80">Sim</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não</span>
                        )}
                      </TableCell>
                      <TableCell>{row.vencimento || "-"}</TableCell>
                      <TableCell>{row.dataRecebimento || "-"}</TableCell>
                      <TableCell className="text-right">{brl(row.valorPrecatorio)}</TableCell>
                      <TableCell className="text-right">{brl(row.valorPagamento)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">
                      Nenhum precatório vinculado a este processo.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

function scoreBadgeColor(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800 border-green-200";
  if (score >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (score >= 25) return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function ScoreCard({ detail }: { detail: ProcessoDetail }) {
  const items: Array<{ label: string; pts: number; max: number; desc: string }> = [
    {
      label: "Valor nominal",
      pts: detail.valorTotal >= 1_000_000 ? 30 : detail.valorTotal >= 500_000 ? 20 : detail.valorTotal >= 100_000 ? 10 : 5,
      max: 30,
      desc: brl(detail.valorTotal),
    },
    {
      label: "Natureza do crédito",
      pts: /aliment/i.test(detail.naturezaDominante) ? 20 : detail.naturezaDominante ? 5 : 0,
      max: 20,
      desc: detail.naturezaDominante || "Desconhecida",
    },
    {
      label: "Pag. prioritário",
      pts: detail.temPrioritario ? 15 : 0,
      max: 15,
      desc: detail.temPrioritario ? "Sim" : "Não",
    },
    {
      label: "Não suspenso",
      pts: !detail.algumSuspenso ? 15 : 5,
      max: 15,
      desc: detail.algumSuspenso ? "Algum suspenso" : "Nenhum suspenso",
    },
    {
      label: "Contatos c/ telefone",
      pts:
        (detail.credores.some((c) => c.telefones.length > 0) ? 5 : 0) +
        (detail.advogados.some((a) => a.telefones.length > 0) ? 5 : 0),
      max: 10,
      desc: [
        `${detail.credores.filter((c) => c.telefones.length > 0).length} credor(es)`,
        `${detail.advogados.filter((a) => a.telefones.length > 0).length} adv.`,
      ].join(", "),
    },
    {
      label: "Enriquecimento",
      pts: detail.credores.length > 0 || detail.advogados.length > 0 ? 10 : 3,
      max: 10,
      desc: detail.credores.length > 0 ? "Credores identificados" : "Sem dados",
    },
  ];

  const badgeClass = scoreBadgeColor(detail.score);

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-primary/80" />
            Score do processo
          </CardTitle>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${badgeClass}`}>
            {detail.score}/100 · {detail.scoreLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="grid grid-cols-[10rem_1fr_3rem_8rem] items-center gap-3">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary/70 transition-all"
                  style={{ width: `${(item.pts / item.max) * 100}%` }}
                />
              </div>
              <span className="text-right text-xs font-medium">{item.pts}/{item.max}</span>
              <span className="truncate text-right text-xs text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Contact card ─────────────────────────────────────────────────────────────

function ContactCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: Array<{ nome: string; descricao: string; telefones: string[] }>;
}) {
  const withPhone = items.filter((i) => i.telefones.length > 0).length;

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary/80" />
          {title}
          {items.length > 0 && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {items.length} identificado{items.length !== 1 ? "s" : ""}
              {withPhone > 0 && ` · ${withPhone} com telefone`}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum {title.toLowerCase().slice(0, -1)} identificado.</p>
        ) : (
          <div className="divide-y">
            {items.map((item, i) => (
              <div key={`${item.nome}-${i}`} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{item.nome}</p>
                  {item.descricao ? (
                    <p className="text-xs text-muted-foreground">{item.descricao}</p>
                  ) : null}
                </div>
                <PhoneList telefones={item.telefones} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
