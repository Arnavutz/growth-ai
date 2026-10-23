# Growth AI

Plataforma de growth marketing: Next.js/TypeScript, OpenAI Agents SDK, Supabase/PostgreSQL, PostHog e APIs oficiais da Meta. Leia README.md e docs/ARCHITECTURE.md.

- Use o checkout existente; tarefas cloud já são isoladas. Não crie worktrees sem pedido.
- Padrão seguro: GROWTH_MODE=simulation. Nunca gaste, altere anúncios ou publique conteúdo real sem credenciais E permissões explícitas. Conectores atuais são exclusivamente de leitura.
- Preserve kill switch, auditoria, permissões por agente, limites, idempotência e validações. Não coloque secrets ou dados pessoais em código, logs, fixtures ou decisões.
- Métricas simuladas devem estar identificadas. Não alegue validação de integrações/deploy sem evidência.
- npm ci; npm run typecheck; npm test; npm run build. Worker: npm run worker. Node >=24.
- Faça incrementos pequenos, testes de comportamento e commits organizados. Atualize documentação de configuração e limitações.
- Fase 1: análise read-only. Fase 2: experimentos e conteúdo com aprovação. Fase 3: execução externa exige implementação e revisão separadas; não habilitar apenas por env.
