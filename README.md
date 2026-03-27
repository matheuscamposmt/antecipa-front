# Antecipa Front

Dashboard para análise e priorização comercial de créditos em Recuperação Judicial (RJ) e precatórios trabalhistas. Permite que analistas identifiquem credores elegíveis para antecipação, avaliem devedores públicos e acompanhem o status de pagamentos de precatórios nos TRTs.

## Arquitetura

Monorepo com dois apps independentes:

- **`apps/web`** — SPA React servida por Vite, consome a API local
- **`apps/api`** — Microserviço Fastify que executa queries SQL diretas no Redshift

Os dados são populados pelo pipeline ETL [`antecipa`](../antecipa), que extrai PDFs de planos de recuperação judicial e faz scraping dos TRTs, carregando tudo no Redshift via S3.

## Stack

| Camada     | Tecnologias                                                  |
|------------|--------------------------------------------------------------|
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS v3, shadcn/ui       |
| Tabelas    | TanStack Table v8 + React Virtual (virtualização)            |
| Gráficos   | Recharts                                                     |
| Roteamento | React Router DOM v7                                          |
| Backend    | Fastify v5, `pg` (driver Redshift), Zod                      |

## Dados

### Recuperação Judicial (RJ)

Credores extraídos de PDFs de planos e listas de credores submetidos pelos Administradores Judiciais. Cada credor possui:

- **Identificação**: nome, CPF/CNPJ, tipo de pessoa (PF/PJ)
- **Crédito**: valor, moeda, classe do crédito (I a IV)
- **Flags**: disputas, contestações e observações do AJ
- **Score de elegibilidade** (0–100 pts): pontuação calculada pela API com base em valor, classe, tipo de pessoa, validade do documento e risco

As classes de crédito seguem a Lei 11.101/2005:
- **Classe I** — Trabalhistas (até 150 salários mínimos) e acidentários
- **Classe II** — Garantia real
- **Classe III** — Quirografários
- **Classe IV** — ME/EPP

### Precatórios Trabalhistas (TRTs)

Dados de precatórios expedidos pelos Tribunais Regionais do Trabalho (TRT-1 a TRT-24), raspados diretamente dos portais dos tribunais. Cada precatório contém:

- **Devedor**: ente público (município, estado, União), CNPJ, regime de pagamento
- **Crédito**: valor nominal, valor pago, natureza (alimentar/não alimentar), preferências
- **Processo**: número do precatório, RP, processo de origem
- **Contatos**: credores e advogados resolvidos via API do DEJT e base RVTA (operadoras de telefonia)

## Tabelas no Redshift

| Schema                       | Tabela                   | Descrição                                    |
|------------------------------|--------------------------|----------------------------------------------|
| `administradores_judiciais`  | `documentos`             | Metadados dos PDFs de planos de RJ            |
| `administradores_judiciais`  | `credores`               | Credores extraídos dos PDFs                   |
| `precatorios`                | `lista_cronologica`      | Precatórios scrapeados dos TRTs               |
| `precatorios`                | `processos_credores`     | Credores dos processos (enriquecimento DEJT)  |
| `precatorios`                | `processos_advogados`    | Advogados dos processos (enriquecimento DEJT) |
| `telecom`                    | `contatos`               | Base de contatos RVTA/Anatel (telefones)      |

## Rodar local

```bash
pnpm install
```

Crie um `.env` em `apps/api/`:

```bash
REDSHIFT_DSN="postgresql://user:pass@host:5439/db"
SALARIO_MINIMO=1518   # usado no cálculo de score da Classe I
```

Terminal 1:
```bash
pnpm dev:api   # http://localhost:3001
```

Terminal 2:
```bash
pnpm dev:web   # http://localhost:5173
```

Ou ambos em paralelo:
```bash
pnpm dev
```

## Endpoints da API

### Recuperação Judicial

| Método | Rota                          | Descrição                                              |
|--------|-------------------------------|--------------------------------------------------------|
| GET    | `/api/overview`               | KPIs gerais: total de empresas, crédito, top AJs       |
| GET    | `/api/companies`              | Lista paginada de empresas (`page`, `pageSize`, `search`, `onlyWithCreditors`) |
| GET    | `/api/companies/:slug`        | Detalhe da empresa: credores, ranking, distribuição de classes |
| GET    | `/api/credores/rj/:hash`      | Detalhe do credor: score, empresas relacionadas, elegibilidade |

### Precatórios

| Método | Rota                          | Descrição                                              |
|--------|-------------------------------|--------------------------------------------------------|
| GET    | `/api/precatorios/overview`   | KPIs: total de devedores, precatórios, pago vs. nominal |
| GET    | `/api/precatorios`            | Lista paginada de devedores (`page`, `pageSize`, `search`) |
| GET    | `/api/devedores/:slug`        | Detalhe do devedor: linha cronológica + contatos        |

## Páginas do Dashboard

| Rota                    | Descrição                                              |
|-------------------------|--------------------------------------------------------|
| `/`                     | Visão geral: KPIs de RJ, grid de empresas, gráficos    |
| `/precatorios`          | Grid de devedores públicos por TRT                     |
| `/empresa/:slug`        | Empresa em RJ: credores, score, ranking, distribuição  |
| `/devedor/:slug`        | Devedor público: precatórios, histórico, contatos      |
| `/credor/rj/:hash`      | Credor individual: score detalhado, aparições cruzadas |
