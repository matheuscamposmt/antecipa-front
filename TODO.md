# TODO — Antecipa Front

> Itens marcados como `[ ]` requerem infraestrutura adicional ou dados ainda não disponíveis.
> Cada item traz uma sugestão de como desbloquear.

---

## Autenticação e acesso (§01)

- [ ] **Login com email/senha + JWT** — Requer banco de dados próprio da plataforma (PostgreSQL). Sugestão: adicionar uma instância RDS/Postgres separada do Redshift para dados da plataforma, usar `fastify-jwt` + `bcryptjs`.
- [ ] **Logout automático após 30 min de inatividade** — Implementável no frontend após ter JWT; usar `setTimeout` resetado a cada interação.
- [ ] **Reset de senha via email** — Requer serviço SMTP (AWS SES, Resend, etc.) + tabela `password_reset_tokens`.
- [ ] **Histórico de acessos por fundo** (data, IP, dispositivo) — Requer tabela `auditoria_acesso` no banco da plataforma.
- [ ] **Acesso ao CPF completo com cota diária** (`limite_cpf_dia`) — Requer tabela `auditoria_cpf` + middleware de autenticação. UI para CPF mascarado já pode ser implementada assim que houver auth.

---

## Dashboard (§02)

- [ ] **KPIs diários de prospects qualificados/marginais** — Score já é calculado pela API, mas os KPIs precisam de agregação sobre todos os credores (query pesada). Sugestão: materializar uma view diária no Redshift com contagem por status, consultada pela API no endpoint `/api/overview`.
- [ ] **Contador de prospects não visualizados desde o último login** — Requer tabela `carteira_item.visualizado_em` + auth.
- [ ] **Alerta de novos prospects adicionados desde o último acesso** — Requer comparação entre `calculado_em` e `ultimo_acesso` do fundo.

---

## Listagem de prospects (§03)

- [ ] **Filtro por status (qualificado/marginal/rejeitado)** — Status já é calculado por credor, mas o endpoint `/api/companies` retorna empresas, não credores. Requer endpoint unificado `/api/prospects` com filtros por status. Sugestão: criar view materializada no Redshift com score por credor + filtros via API.
- [ ] **Filtro por tipo de devedor** (Federal/Estadual/Municipal/Privado) — Para precatórios, o campo `tipo_devedor` já existe na `lista_cronologica`. Para RJ, não há classificação de porte/esfera na base atual. Sugestão: adicionar campo `esfera_devedor` na tabela `administradores_judiciais.documentos`.
- [ ] **Filtro por dias estimados até pagamento** — Requer campo `prazo_est_dias` calculado pelo ETL.
- [ ] **Ordenação por score descendente como padrão** — Implementável após criar o endpoint unificado de prospects.
- [ ] **Filtros salvos como favoritos** — Requer tabela `filtros_salvos` no banco da plataforma + auth.
- [ ] **CPF mascarado na listagem** — Requer auth + campo CPF na listagem (atualmente não exibido na lista).
- [ ] **Indicação de prospects já contatados** — Requer tabela `contato` no banco da plataforma + auth.
- [ ] **Flag ⚠ Homônimos** — Campo `homonimos` requer query cruzada na base `telecom.contatos` por nome. Sugestão: pré-computar no ETL e armazenar em `administradores_judiciais.credores`.

---

## Detalhes do prospect (§04)

- [ ] **CPF completo** (apenas para fundos autorizados) — Requer auth + tabela `auditoria_cpf` + campo CPF real (hoje temos CPF/CNPJ mas sem mascaramento controlado).
- [ ] **Renda anual estimada** — Requer enriquecimento via `telecom.contatos` ou base própria. Atualmente não disponível.
- [ ] **Beneficiário de programas sociais** — Não disponível na base atual. Sugestão: integrar com base CadÚnico (via parceiro) ou inferir via faixa de renda.
- [ ] **Localização/região** — Disponível parcialmente em `telecom.contatos`. Adicionar query por CPF/CNPJ.
- [ ] **Flag de homônimos com contagem** — Ver TODO acima.
- [ ] **URL do inteiro teor** do processo — Disponível para RJ via `link_credores`. Para precatórios, requer integração com portal do tribunal.
- [ ] **Fase do processo de RJ** — Não modelada na base atual. Sugestão: adicionar campo `fase_rj` no ETL (deferimento processado / votação / homologado).
- [ ] **Coobrigados e garantias** — Não presentes na base atual.
- [ ] **Impacto estimado da EC 136/2025** no prazo de pagamento — Requer modelo de estimativa baseado em RCL e estoque de precatórios do ente. Sugestão: criar tabela `entes_rcl` com dados do SICONFI e calcular estimativa no ETL.
- [ ] **Posição na fila cronológica** — Disponível em `lista_cronologica.exequente_index`. Expor na UI como "posição X de Y".

---

## Scoring (§05)

- [ ] **Score do Devedor real** (0–35) — Atualmente usa `faixaScore` (distribuição interna dos valores) como proxy. Para o score real, requer:
  - Para RJ: existência de homologação do plano, presença de coobrigados, dívida PGFN do devedor.
  - Para precatórios: RCL do ente, histórico de adimplência, regime de pagamento.
  - Sugestão: criar tabela `entes_rcl` com dados do SICONFI e enriquecer o ETL.
- [ ] **Score do Credor real** (0–25) — Atualmente usa tipo de pessoa + z-score de valor como proxy. Para o score real, requer:
  - Renda anual (via `telecom.contatos` ou base própria).
  - Beneficiário de programas sociais.
  - Localização/região (propensão por acesso a serviços financeiros).
  - Sugestão: adicionar query por CPF no endpoint `/api/credores/rj/:hash` para buscar renda e localização em `telecom.contatos`.
- [ ] **Prazo estimado até pagamento** (`prazo_est_dias`) — Para precatórios, requer modelo baseado em RCL e estoque. Para RJ, depende da fase do processo. Incluir no score.

---

## Contato e envio de oferta (§06)

- [ ] **Envio de SMS via gateway** (Twilio ou similar) — Requer API key Twilio + endpoint POST `/api/contatos/sms`. Adicionar `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` ao `.env`.
- [ ] **Envio de WhatsApp** — Requer Twilio WhatsApp Sandbox ou Business API aprovada.
- [ ] **Templates de mensagem selecionáveis** — Requer tabela `template` no banco da plataforma + auth.
- [ ] **Registro de contato** com snapshot do telefone — Requer tabela `contato` + auth.
- [ ] **Registro de oferta** com validação de deságio ≥ 15% — Requer tabela `oferta` + `carteira_item` + auth. UI já scaffolded como placeholder.

---

## Exportação (§07)

- [ ] **Exportação CSV com filtros ativos** — Implementável sem DB extra: endpoint GET `/api/prospects/export.csv` que aplica os mesmos filtros da listagem e retorna CSV. Para listas > 500 registros, processar de forma assíncrona.
- [ ] **CPF completo na exportação** — Requer auth + auditoria.

---

## Histórico e relatórios (§08)

- [ ] **Relatório de atividades por período** — Requer tabelas `contato`, `oferta`, `carteira_item` + auth.
- [ ] **Taxa de conversão** — Requer dados de carteira.
- [ ] **Evolução do valor em carteira** — Requer dados de carteira.

---

## Notificações (§09)

- [ ] **Alerta configurável por score mínimo** — Requer tabela `preferencias_fundo` + lógica de notificação (email ou push).
- [ ] **Contador de prospects não visualizados** — Requer auth + `visualizado_em`.

---

## Infraestrutura necessária para desbloquear a maioria dos itens acima

1. **Banco de dados da plataforma** (PostgreSQL/RDS) — separado do Redshift, para dados transacionais:
   - Tabelas: `fundo`, `prospect`, `carteira_item`, `oferta`, `contato`, `template`, `auditoria_cpf`
   - Schema disponível nos requisitos (seção Modelo de dados)
   - Sugestão: usar `postgres` via Docker local ou RDS t3.micro na AWS

2. **Autenticação JWT** — `fastify-jwt` no backend, tokens em `localStorage` ou `httpOnly cookie`

3. **Gateway de mensagens** — Twilio (SMS + WhatsApp) — ~$0,0075/SMS, ~$0,005/WhatsApp session

4. **Serviço de email** — AWS SES (reset de senha) — gratuito até 62k e-mails/mês na AWS

5. **Enriquecimento de score do credor** — Query em `telecom.contatos` por CPF para renda e localização (a base já existe no Redshift)
