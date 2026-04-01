import { CircleHelp, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import type { Creditor } from "@/types";
import { brl } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  ranking: Creditor[];
  companySlug?: string;
};

const TOOLTIP_CLASS =
  "max-w-72 rounded-md border border-border/70 bg-card px-3 py-2 text-[11px] text-card-foreground shadow-sm";

export function RankingList({ ranking, companySlug }: Props) {
  const top = ranking.slice(0, 10);

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="text-base">Ranking de credores qualificados</CardTitle>
        <p className="text-xs text-muted-foreground">
          Classe I · valor até 15 salários mínimos · score ≥ 50
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem credores elegíveis para calcular ranking.</p>
        ) : null}

        <TooltipProvider delayDuration={120}>
          {top.map((creditor, index) => (
            <div key={`${creditor.rowHash}-${index}`} className="rounded-lg border p-3 transition-colors hover:bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Position + name */}
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-sm font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Link
                      to={`/credor/rj/${creditor.rowHash}`}
                      state={companySlug ? { backTo: `/empresa/${companySlug}`, backLabel: "Voltar para a empresa" } : undefined}
                      className="line-clamp-2 text-sm font-semibold leading-tight text-primary hover:underline"
                    >
                      {creditor.nome}
                    </Link>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span>{tipoPessoaPorExtenso(creditor.tipoPessoa)}</span>
                    <span>•</span>
                    <span>Classe {creditor.classe}</span>
                    <span>•</span>
                    <span className="font-medium text-foreground">{brl(creditor.valor)}</span>
                  </div>

                  {/* Status + deságio */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip status={creditor.status} elegivel={creditor.elegivel} />
                    {creditor.desagioRec !== "Não recomendado" && (
                      <span className="text-[11px] text-muted-foreground">
                        Deságio rec.: <strong>{creditor.desagioRec}</strong>
                      </span>
                    )}
                  </div>

                  {/* Phones */}
                  {creditor.telefones.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {creditor.telefones.slice(0, 2).map((tel) => (
                        <a
                          key={tel}
                          href={`tel:${tel.replace(/\D/g, "")}`}
                          className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-800 hover:bg-green-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="size-2.5" />
                          {tel}
                        </a>
                      ))}
                      {creditor.telefones.length > 2 ? (
                        <span className="text-[11px] text-muted-foreground">+{creditor.telefones.length - 2}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Score */}
                <div className="shrink-0 space-y-1">
                  <div className="flex items-center justify-end gap-1.5">
                    <ScoreChip score={creditor.score} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Decomposição do score"
                        >
                          <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className={TOOLTIP_CLASS}>
                        <ScoreExplanation creditor={creditor} />
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ScoreMiniBar value={creditor.score} />
                </div>
              </div>
            </div>
          ))}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

function ScoreChip({ score }: { score: number }) {
  const variant =
    score >= 65 ? "bg-green-100 text-green-800 border-green-200" :
    score >= 50 ? "bg-warning/10 text-warning border-warning/30" :
    "bg-muted text-muted-foreground border-border";

  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${variant}`}>
      {score}
    </span>
  );
}

function StatusChip({ status, elegivel }: { status: Creditor["status"]; elegivel: boolean }) {
  if (!elegivel) return null;
  const classes =
    status === "qualificado"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "marginal"
      ? "bg-warning/10 text-warning border-warning/30"
      : "bg-muted text-muted-foreground border-border";
  const label =
    status === "qualificado" ? "Qualificado" : status === "marginal" ? "Marginal" : "Rejeitado";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${classes}`}>
      {label}
    </span>
  );
}

function ScoreMiniBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="w-16">
      <Progress value={safe} className="h-1.5" />
    </div>
  );
}

function ScoreExplanation({ creditor }: { creditor: Creditor }) {
  const { ativo, devedor, credor } = creditor.scoreBreakdown;
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold">Score {creditor.score}/100</p>

      <div className="space-y-1">
        <div className="flex justify-between font-medium text-[11px]">
          <span>Ativo</span>
          <span>{ativo.total}/40</span>
        </div>
        <Progress value={(ativo.total / 40) * 100} className="h-1" />
        <div className="pl-2 space-y-0.5 text-[10px] text-muted-foreground">
          <div className="flex justify-between"><span>Classe</span><span>{ativo.classe}/20</span></div>
          <div className="flex justify-between"><span>Documento</span><span>{ativo.documento}/12</span></div>
          <div className="flex justify-between"><span>Sem riscos</span><span>{ativo.sinais}/8</span></div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between font-medium text-[11px]">
          <span>Devedor</span>
          <span>{devedor.total}/35</span>
        </div>
        <Progress value={(devedor.total / 35) * 100} className="h-1" />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between font-medium text-[11px]">
          <span>Credor</span>
          <span>{credor.total}/25</span>
        </div>
        <Progress value={(credor.total / 25) * 100} className="h-1" />
        <div className="pl-2 space-y-0.5 text-[10px] text-muted-foreground">
          <div className="flex justify-between"><span>Tipo de pessoa</span><span>{credor.tipoPessoa}/10</span></div>
          <div className="flex justify-between"><span>Valor</span><span>{credor.valor}/15</span></div>
        </div>
      </div>
    </div>
  );
}

function tipoPessoaPorExtenso(tipoPessoa: Creditor["tipoPessoa"]): string {
  if (tipoPessoa === "PF") return "Pessoa Física";
  if (tipoPessoa === "PJ") return "Pessoa Jurídica";
  return "Não identificado";
}
