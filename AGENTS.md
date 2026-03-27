# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: React + Vite frontend (Tailwind v3 + shadcn/ui).
- `apps/api`: Fastify API that serves dashboard/company data from Redshift.
- `data/`: legacy local snapshots kept only for fallback/manual inspection:
  - `aj_empresas_manual.sqlite`
  - `db.sqlite`
  - `credores_extraidos.csv`
- Keep UI code in `apps/web/src/components` and pages in `apps/web/src/pages`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev:api`: run API on `http://localhost:8787`.
- `pnpm dev:web`: run frontend on `http://localhost:5173`.
- `pnpm dev`: run API + web in parallel.
- `pnpm build`: build all apps.
- `pnpm typecheck`: TypeScript validation in all workspaces.

## Coding Style & Naming Conventions
- Language: TypeScript in both apps.
- Prefer small, deterministic functions (KISS).
- Components/pages: `kebab-case` file names, PascalCase exports.
- Use shadcn components from `src/components/ui` before creating custom primitives.
- Keep visual style minimal and professional; soft green palette for “investimentos/ganho”.

## Data & Domain Rules
- `data_homologacao` can be empty when unavailable; do not hallucinate.
- Preserve company/group context even when the same creditor file is shared.
- Scoring should stay simple and explainable (value + class + PF/PJ weight).
- `capitalSocialEstimado` is intentionally `null` for now (feature flag placeholder).
- Redshift é a fonte principal para RJ e precatórios.
- Em RJ, os metadados do PDF vivem em `administradores_judiciais.documentos` e as linhas extraídas em `administradores_judiciais.credores`.
- `db.sqlite` e `credor_rj` são artefatos legados; não usar como source of truth em novas features.

## Frontend UX Requirements
- Dashboard: KPI cards, AJ/class charts, company cards with key metrics.
- Precatórios: cards por devedor com badge visível de tribunal e navegação para a mesma página de empresa.
- `/devedor/:slug` é a página própria do ente público com cards e tabela de pagamentos de precatórios.
- Company detail: full creditors table (client filtering via TanStack), plus ranking with score breakdown.
- No login page for now.

## Commit & PR Guidelines
- Use concise, imperative commits (e.g., `feat(web): add company detail ranking`).
- PRs should include:
  - Scope summary
  - Screenshots (dashboard + detail)
  - API changes and sample endpoints touched
