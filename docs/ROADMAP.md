# Próximos incrementos

## Entrega inicial

- Fundação executável em simulação, dashboard autenticado e agentes analíticos.
- PostgreSQL ou SQLite local, worker durável e controles centrais.
- Conectores read-only e contratos de eventos, testes/CI e preparação de staging.
- Início da fase 2: backlog de hipóteses/conteúdo e workflow de aprovação sem execução.

## Prioridade seguinte: validar dados reais de ponta a ponta

1. Publicar staging simulado com PostgreSQL e worker; validar recuperação após reinício e alertas.
2. Conectar Meta read-only em conta de teste, adicionar paginação, persistência de snapshots por dia/campanha e testes de contrato com respostas oficiais.
3. Conectar PostHog/Instagram ao ciclo analítico. Definir dicionário de métricas, moeda, timezone do negócio, janelas de atribuição e deduplicação entre eventos de produto e provedores.
4. Agregar pagamentos/reembolsos/custos, validar reconciliação e exibir cobertura/qualidade dos dados. Comparar snapshots reais antes de alertar anomalias.

## Fase 2 completa

Modelo de experimentos com variantes, objetivo, exposição, guardrails, pré-registro de amostra e análise estatística. Integração PostHog de flags/experimentos com autorização explícita. Calendário editorial, geração de drafts estruturados, revisões/versionamento, asset storage e aprovação contextual.

## Fase 3

Implementar separadamente executores com allowlists, orçamento transacional/reservas, limites por conta/período, dry-run, aprovação de ações de risco, idempotência do provedor e rollback onde possível. Criar testes com sandboxes oficiais. Nenhuma flag de ambiente atual libera ações de gasto ou publicação.

## Antes de produção

RBAC multiusuário/tenant, refresh e revogação de sessões, MFA via provedor, auditoria resistente a adulteração, retenção/backup/restore e runbooks, rate limiting no edge, gestão de incidentes, avaliação de prompts/modelos, contratos LGPD e processos de direitos dos titulares. Separar migração de schema da conexão runtime e adicionar controle de versões e rollouts.
