import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { HeaderNotifications } from "@/components/header-notifications";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";

type HeaderNavState = {
  backTo?: string;
  backLabel?: string;
};

export function SiteHeader() {
  const location = useLocation();
  const back = getBackConfig(location.pathname, location.state as HeaderNavState | null);
  const crumbs = getBreadcrumbs(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
      <SidebarTrigger />
      {back ? (
        <Link
          to={back.href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      ) : null}
      {crumbs.length > 0 ? (
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <BreadcrumbItem key={`${crumb.label}-${index}`}>
                {index < crumbs.length - 1 ? (
                  <>
                    <BreadcrumbLink asChild>
                      <Link to={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                    <BreadcrumbSeparator />
                  </>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <HeaderNotifications />
      </div>
    </header>
  );
}

function getBackConfig(pathname: string, state: HeaderNavState | null): { href: string; label: string } | null {
  if (state?.backTo) {
    return { href: state.backTo, label: state.backLabel ?? "Voltar" };
  }
  if (pathname.startsWith("/empresa/")) return { href: "/", label: "Voltar ao dashboard" };
  if (pathname.startsWith("/credor/rj/")) return { href: "/", label: "Voltar ao dashboard" };
  if (pathname.startsWith("/devedor/")) return { href: "/precatorios", label: "Voltar aos precatórios" };
  if (pathname.startsWith("/processo/")) return { href: "/precatorios", label: "Voltar aos precatórios" };
  if (pathname.startsWith("/credor/precatorio/")) return { href: "/precatorios", label: "Voltar aos precatórios" };
  return null;
}

function getBreadcrumbs(pathname: string): Array<{ href: string; label: string }> {
  if (pathname === "/") return [];
  if (pathname === "/precatorios") return [{ href: "/precatorios", label: "Precatórios" }];
  if (pathname.startsWith("/empresa/")) {
    return [
      { href: "/", label: "Dashboard" },
      { href: pathname, label: "Empresa" },
    ];
  }
  if (pathname.startsWith("/credor/rj/")) {
    return [
      { href: "/", label: "Dashboard" },
      { href: pathname, label: "Credor" },
    ];
  }
  if (pathname.startsWith("/devedor/")) {
    return [
      { href: "/precatorios", label: "Precatórios" },
      { href: pathname, label: "Devedor" },
    ];
  }
  if (pathname.startsWith("/processo/")) {
    return [
      { href: "/precatorios", label: "Precatórios" },
      { href: pathname, label: "Processo" },
    ];
  }
  if (pathname.startsWith("/credor/precatorio/")) {
    return [
      { href: "/precatorios", label: "Precatórios" },
      { href: pathname, label: "Credor" },
    ];
  }
  return [];
}
