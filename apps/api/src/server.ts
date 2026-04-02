import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { loadCompanies, loadCompanyDetail, loadCredorPhones, loadCredorRJDetail, loadOverview, type CompanyItem } from "./data.js";
import { hasRedshiftConfigured } from "./redshift.js";
import { loadCredorPrecatorioDetail, loadPrecatorioDebtors, loadPrecatorioDetail, loadPrecatorioOverview, loadProcessoDetail } from "./precatorios-data.js";

const server = Fastify({ logger: true });
await server.register(cors, { origin: true });

function filterCompanies(
  companies: CompanyItem[],
  search: string,
  onlyWithCreditors: boolean,
  creditMin?: number | null,
  creditMax?: number | null,
): CompanyItem[] {
  const query = search.trim().toLowerCase();
  return companies.filter((item) => {
    if (onlyWithCreditors && item.quantidadeCredores === 0) return false;
    if (creditMin != null && item.totalCredito < creditMin) return false;
    if (creditMax != null && item.totalCredito > creditMax) return false;
    if (!query) return true;
    return (
      item.nomeEmpresa.toLowerCase().includes(query) ||
      item.grupoEconomico.toLowerCase().includes(query) ||
      item.administradorJudicial.toLowerCase().includes(query)
    );
  });
}

server.get("/api/health", async () => {
  return {
    ok: true,
    redshiftConfigured: hasRedshiftConfigured(),
    loadedAt: new Date().toISOString(),
  };
});

server.get("/api/reload", async () => {
  return { ok: true, message: "API sem cache em memória; nada para recarregar." };
});

server.get("/api/overview", async () => loadOverview());

server.get("/api/companies", async (request) => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(24),
    search: z.string().default(""),
    onlyWithCreditors: z.coerce.boolean().default(false),
    creditMin: z.coerce.number().positive().optional(),
    creditMax: z.coerce.number().positive().optional(),
  });
  const { page, pageSize, search, onlyWithCreditors, creditMin, creditMax } = querySchema.parse(request.query);

  const filtered = filterCompanies(await loadCompanies(), search, onlyWithCreditors, creditMin, creditMax);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: filtered.slice(start, end),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
});

server.get("/api/companies/:slug", async (request, reply) => {
  const paramsSchema = z.object({
    slug: z.string().min(1),
  });
  const { slug } = paramsSchema.parse(request.params);

  const detail = await loadCompanyDetail(slug);
  if (!detail) {
    return reply.code(404).send({ error: "Empresa não encontrada" });
  }
  return detail;
});

server.get("/api/credores/rj/:hash", async (request, reply) => {
  const paramsSchema = z.object({
    hash: z.string().min(1),
  });
  const { hash } = paramsSchema.parse(request.params);

  const detail = await loadCredorRJDetail(hash);
  if (!detail) {
    return reply.code(404).send({ error: "Credor não encontrado" });
  }
  return detail;
});

server.get("/api/credores/rj/:hash/phones", async (request, reply) => {
  const paramsSchema = z.object({ hash: z.string().min(1) });
  const { hash } = paramsSchema.parse(request.params);
  const telefones = await loadCredorPhones(hash);
  if (telefones === null) {
    return reply.code(404).send({ error: "Credor não encontrado" });
  }
  return { telefones };
});

server.get("/api/credores/precatorio/:numeroProcesso/:credorNome", async (request, reply) => {
  const paramsSchema = z.object({
    numeroProcesso: z.string().min(1),
    credorNome: z.string().min(1),
  });
  const { numeroProcesso, credorNome } = paramsSchema.parse(request.params);

  const detail = await loadCredorPrecatorioDetail(
    decodeURIComponent(numeroProcesso),
    decodeURIComponent(credorNome),
  );
  if (!detail) {
    return reply.code(404).send({ error: "Credor não encontrado" });
  }
  return detail;
});

server.get("/api/devedores/:slug", async (request, reply) => {
  const paramsSchema = z.object({
    slug: z.string().min(1),
  });
  const { slug } = paramsSchema.parse(request.params);

  const detail = await loadPrecatorioDetail(slug);
  if (!detail) {
    return reply.code(404).send({ error: "Devedor não encontrado" });
  }
  return detail;
});

server.get("/api/processos/:numero", async (request, reply) => {
  const paramsSchema = z.object({ numero: z.string().min(1) });
  const { numero } = paramsSchema.parse(request.params);
  const detail = await loadProcessoDetail(decodeURIComponent(numero));
  if (!detail) {
    return reply.code(404).send({ error: "Processo não encontrado" });
  }
  return detail;
});

server.get("/api/precatorios/overview", async () => loadPrecatorioOverview());

server.get("/api/precatorios", async (request) => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(24),
    search: z.string().default(""),
  });
  const { page, pageSize, search } = querySchema.parse(request.query);
  const debtors = await loadPrecatorioDebtors();

  const query = search.trim().toLowerCase();
  const filtered = debtors.filter((item) => {
    if (!query) {
      return true;
    }
    return (
      item.nomeEmpresa.toLowerCase().includes(query) ||
      item.tribunal.toLowerCase().includes(query) ||
      item.cnpj.toLowerCase().includes(query)
    );
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: filtered.slice(start, end),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
});

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
await server.listen({ host: "0.0.0.0", port });
