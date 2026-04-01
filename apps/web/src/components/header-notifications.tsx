import { BellRing, Database, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notice = {
  title: string;
  body: string;
  icon: typeof Database;
  tone: string;
};

export function HeaderNotifications() {
  const location = useLocation();
  const notices = buildNotices(location.pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2 rounded-full px-3">
          <BellRing className="size-4" />
          Central
          <span className="flex size-2 rounded-full bg-emerald-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 rounded-xl p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações operacionais</p>
            <p className="text-xs text-muted-foreground">Componente inspirado em padrões shadcn</p>
          </div>
          <Badge variant="secondary">{notices.length}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-2 p-3">
          {notices.map((notice) => (
            <div key={notice.title} className={`rounded-xl border p-3 ${notice.tone}`}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white/70 p-2 shadow-sm">
                  <notice.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{notice.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{notice.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildNotices(pathname: string): Notice[] {
  const isPrecatorio = pathname.startsWith("/precatorios") || pathname.startsWith("/devedor/") || pathname.startsWith("/processo/") || pathname.startsWith("/credor/precatorio/");

  if (isPrecatorio) {
    return [
      {
        title: "Fluxo de navegação",
        body: "Credor de precatório retorna ao processo, e o processo retorna ao devedor quando a navegação veio da tabela.",
        icon: Sparkles,
        tone: "border-emerald-200/70 bg-emerald-50/70",
      },
      {
        title: "Sinalização visual",
        body: "A seção de precatórios usa um verde mais frio e ícones de ente público para diferenciar da RJ.",
        icon: ShieldCheck,
        tone: "border-teal-200/70 bg-teal-50/70",
      },
      {
        title: "Fonte principal",
        body: "Redshift segue como source of truth para processos, credores e cronologia de precatórios.",
        icon: Database,
        tone: "border-slate-200/80 bg-slate-50/80",
      },
    ];
  }

  return [
    {
      title: "Busca por página",
      body: "Os filtros e a busca da recuperação judicial ficam no conteúdo da página, não mais na barra superior.",
      icon: Sparkles,
      tone: "border-emerald-200/70 bg-emerald-50/70",
    },
    {
      title: "Prioridade operacional",
      body: "A recuperação judicial mantém score, ranking e qualificação como foco principal de originação.",
      icon: ShieldCheck,
      tone: "border-lime-200/70 bg-lime-50/70",
    },
    {
      title: "Fonte principal",
      body: "Redshift segue como fonte primária para RJ; artefatos locais continuam apenas como legado.",
      icon: Database,
      tone: "border-slate-200/80 bg-slate-50/80",
    },
  ];
}
