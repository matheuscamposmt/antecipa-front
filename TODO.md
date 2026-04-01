# TODO — Antecipa Front

> Itens marcados como `[ ]` requerem infraestrutura adicional ou dados ainda não disponíveis.
> Cada item traz uma sugestão de como desbloquear.

---

## Autenticação e acesso (§01)

- [ ] **Login com email/senha + JWT** — Requer banco de dados próprio da plataforma (PostgreSQL). Solução: Adicionar uma postgres e configurar docker-compose.yml para o projeto. OK
- [ ] **Logout automático após 30 min de inatividade** — Implementável no frontend após ter JWT; usar `setTimeout` resetado a cada interação. OK
- [ ] **Reset de senha via email** — Requer serviço SMTP (AWS SES, Resend, etc.) + tabela `password_reset_tokens`. NO
- [ ] **Histórico de acessos por fundo** (data, IP, dispositivo) — Requer tabela `auditoria_acesso` no banco da plataforma. NO

---

## Detalhes do prospect (§04)

- [ ] **Mitigar homônimos na camada de telefones** — O enriquecimento conservador por CPF/CNPJ já evita anexar dados de terceiros, mas a busca em `telecom.contatos` ainda é por nome. Próximo passo: filtrar também por UF/localização quando essa base estiver disponível no acesso atual.

---

## Scoring (§05)

- [ ] **Score do Devedor real completo** (0–35) — A etapa atual já usa homologação em RJ e regime/% pago em precatórios, com PGFN por razão social apenas quando o match é barato/confiável. Ainda faltam:
  - Para RJ: coobrigados e uma resolução mais robusta do CNPJ do devedor (idealmente tabela/materialized view pré-calculada).
  - Para precatórios: RCL do ente e histórico de adimplência.
  - Sugestão: criar `entes_rcl` com dados do SICONFI e um artefato pré-calculado `nome_da_empresa -> cnpj_basico_devedor`.
- [ ] **Score do Credor real para PJ** (0–25) — Pessoa física já usa renda, benefícios sociais e localização. Para PJ, o score ainda cai no proxy de tipo de pessoa + faixa de valor.

## Processos
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

2. **Autenticação JWT** — PocketBase como um serviço no docker, sem imagens de avatar por enquanto

3. **Gateway de mensagens** — Twilio (SMS + WhatsApp) — ~$0,0075/SMS, ~$0,005/WhatsApp session

4. **Serviço de email** — AWS SES (reset de senha) — gratuito até 62k e-mails/mês na AWS

5. **Enriquecimento telefônico com desambiguação** — `telecom.contatos` ainda pode evoluir para usar UF/localização como filtro secundário em nomes comuns
