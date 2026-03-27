import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export function SiteHeader({ searchValue, onSearchChange }: Props) {
  const location = useLocation();
  const isCompanyPage = location.pathname.startsWith("/empresa/");
  const isDevedorPage = location.pathname.startsWith("/devedor/");
  const backHref = isDevedorPage ? "/precatorios" : "/";
  const placeholder = location.pathname.startsWith("/precatorios")
    ? "Buscar devedor, tribunal ou CNPJ"
    : "Buscar empresa, grupo ou AJ";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
      <SidebarTrigger />
      {isCompanyPage || isDevedorPage ? (
        <Link
          to={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
      ) : null}
      <div className="ml-auto w-full max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            className="pl-8"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
    </header>
  );
}
