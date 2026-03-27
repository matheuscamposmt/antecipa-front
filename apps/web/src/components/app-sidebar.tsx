import { Building2, Landmark, Wallet } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ITEMS = [
  { to: "/", label: "Recuperação Judicial", icon: Building2 },
  { to: "/precatorios", label: "Precatórios TRT", icon: Landmark },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Wallet className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Antecipa</span>
                  <span className="truncate text-xs text-muted-foreground">
                    FIDC-NP · originação judicial
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {ITEMS.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                <Link to={item.to}>
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-1 text-[11px] text-sidebar-foreground/70">v0.2 · mar 2026</div>
      </SidebarFooter>
    </Sidebar>
  );
}
