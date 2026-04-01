# TODO — MVP

Backlog enxuto do que ainda falta para deixar o produto coeso, rápido e operável no fluxo principal de prospecção.

## Produto e dados

- [ ] **Reduzir falsos positivos de telefone** — Adicionar mais um filtro objetivo de desambiguação para contatos buscados por nome.
- [ ] **Melhorar resolução do devedor** — Corrigir casos em que RJ ou precatórios ainda não vinculam bem o devedor ao CNPJ/grupo correto.
- [ ] **Padronizar faltas de dados na API** — Garantir payloads consistentes quando não houver telefone, homologação, regime ou documentos.
- [ ] **Fechar uma versão estável do score** — Revisar pesos e regras para evitar distorções em ranking de devedor e credor.
- [ ] **Deixar o breakdown do score mais legível** — Tornar o motivo da priorização mais direto para uso operacional.

## Fluxo operacional

- [ ] **Exportar a lista filtrada** — CSV simples da visão atual para uso comercial e análise offline.
- [ ] **Registrar status mínimo do prospect** — Marcar se já foi visto, trabalhado ou contatado para evitar retrabalho.
- [ ] **Adicionar um registro mínimo de contato/oferta** — Sem CRM completo; apenas o suficiente para operação acompanhar abordagem.

## UX e navegação

- [ ] **Revisar navegação ponta a ponta** — Garantir continuidade clara entre dashboard, empresa, devedor, processo e credor.
- [ ] **Padronizar breadcrumbs** — Toda página de detalhe deve indicar claramente de onde o usuário veio e como voltar.
- [ ] **Revisar URLs** — Slugs, parâmetros e rotas precisam ficar previsíveis, limpos e consistentes entre RJ e precatórios.
- [ ] **Refinar estados de loading, empty e error** — Principalmente em tabelas, cards e páginas de detalhe com dados enriquecidos.
- [ ] **Melhorar feedback de ações e transições** — Ajustar alerts, placeholders, estados intermediários e mensagens de erro.

## Design system e consistência visual

- [ ] **Revisar o design system atual** — Consolidar padrões reais de cards, tabelas, badges, métricas, alertas e headers.
- [ ] **Reduzir variações visuais desnecessárias** — Unificar espaçamentos, tipografia, bordas, cores e densidade entre páginas.
- [ ] **Padronizar componentes de detalhe** — Evitar que RJ e precatórios resolvam o mesmo problema com interfaces levemente diferentes.
- [ ] **Revisar responsividade do fluxo principal** — Garantir leitura e uso aceitáveis no mobile e em telas menores.

## Performance e otimização

- [ ] **Revisar queries e carregamentos mais pesados** — Reduzir custo e latência nas páginas de dashboard, devedor e processo.
- [ ] **Evitar recomputações e renderizações desnecessárias** — Principalmente em tabelas, filtros e breakdowns de score.
- [ ] **Melhorar percepção de performance** — Priorizar skeletons, carregamento progressivo e ordenação de conteúdo crítico.
