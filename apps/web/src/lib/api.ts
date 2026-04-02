import type {
  Company,
  CompanyDetail,
  CredorPrecatorioDetail,
  CredorRJDetail,
  DevedorDetail,
  Overview,
  PrecatorioDebtor,
  PrecatorioOverview,
  ProcessoDetail,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchOverview(): Promise<Overview> {
  return getJson<Overview>("/api/overview");
}

export type CompanyListResponse = {
  items: Company[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function fetchCompanies(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  onlyWithCreditors?: boolean;
  creditMin?: number | null;
  creditMax?: number | null;
}): Promise<CompanyListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  query.set("search", params.search ?? "");
  query.set("onlyWithCreditors", String(params.onlyWithCreditors ?? false));
  if (params.creditMin != null) query.set("creditMin", String(params.creditMin));
  if (params.creditMax != null) query.set("creditMax", String(params.creditMax));
  return getJson<CompanyListResponse>(`/api/companies?${query.toString()}`);
}

export async function fetchCompanyDetail(slug: string): Promise<CompanyDetail> {
  return getJson<CompanyDetail>(`/api/companies/${slug}`);
}

export async function fetchDevedorDetail(slug: string): Promise<DevedorDetail> {
  return getJson<DevedorDetail>(`/api/devedores/${slug}`);
}

export async function fetchProcessoDetail(numeroProcesso: string): Promise<ProcessoDetail> {
  return getJson<ProcessoDetail>(`/api/processos/${encodeURIComponent(numeroProcesso)}`);
}

export async function fetchCredorRJDetail(hash: string): Promise<CredorRJDetail> {
  return getJson<CredorRJDetail>(`/api/credores/rj/${hash}`);
}

export async function fetchCredorRJPhones(hash: string): Promise<string[]> {
  const result = await getJson<{ telefones: string[] }>(`/api/credores/rj/${hash}/phones`);
  return result.telefones;
}

export async function fetchCredorPrecatorioDetail(
  numeroProcesso: string,
  credorNome: string,
): Promise<CredorPrecatorioDetail> {
  return getJson<CredorPrecatorioDetail>(
    `/api/credores/precatorio/${encodeURIComponent(numeroProcesso)}/${encodeURIComponent(credorNome)}`,
  );
}

export type PrecatorioListResponse = {
  items: PrecatorioDebtor[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function fetchPrecatorioOverview(): Promise<PrecatorioOverview> {
  return getJson<PrecatorioOverview>("/api/precatorios/overview");
}

export async function fetchPrecatorios(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PrecatorioListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("pageSize", String(params.pageSize ?? 24));
  query.set("search", params.search ?? "");
  return getJson<PrecatorioListResponse>(`/api/precatorios?${query.toString()}`);
}
