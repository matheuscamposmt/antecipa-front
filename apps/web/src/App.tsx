import { Navigate, Route, Routes } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CompanyPage } from "@/pages/company-page";
import { CredorPrecatorioPage } from "@/pages/credor-precatorio-page";
import { CredorRJPage } from "@/pages/credor-rj-page";
import { DevedorPage } from "@/pages/devedor-page";
import { ProcessoPage } from "@/pages/processo-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { PrecatoriosPage } from "@/pages/precatorios-page";

function App() {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/precatorios" element={<PrecatoriosPage />} />
          <Route path="/devedor/:slug" element={<DevedorPage />} />
          <Route path="/processo/:numero" element={<ProcessoPage />} />
          <Route path="/empresa/:slug" element={<CompanyPage />} />
          <Route path="/credor/precatorio/:numeroProcesso/:credorNome" element={<CredorPrecatorioPage />} />
          <Route path="/credor/rj/:hash" element={<CredorRJPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
