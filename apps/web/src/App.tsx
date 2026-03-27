import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CompanyPage } from "@/pages/company-page";
import { CredorRJPage } from "@/pages/credor-rj-page";
import { DevedorPage } from "@/pages/devedor-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { PrecatoriosPage } from "@/pages/precatorios-page";

function App() {
  const [searchInput, setSearchInput] = useState("");

  const search = useMemo(() => searchInput.trim(), [searchInput]);

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader searchValue={searchInput} onSearchChange={setSearchInput} />
        <Routes>
          <Route path="/" element={<DashboardPage search={search} />} />
          <Route path="/precatorios" element={<PrecatoriosPage search={search} />} />
          <Route path="/devedor/:slug" element={<DevedorPage />} />
          <Route path="/empresa/:slug" element={<CompanyPage />} />
          <Route path="/credor/rj/:hash" element={<CredorRJPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
