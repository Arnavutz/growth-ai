# Growth AI

Plataforma de growth com dashboard Next.js, cinco agentes, fila durável e controle humano. O padrão é **simulação sem serviços externos**. Integrações live permanecem somente leitura. Nenhum caminho de código compra mídia, altera anúncios ou publica conteúdo.

## Executar localmente

Node.js 24+ e npm. Use o checkout existente; ambientes cloud já são isolados.

```sh
npm ci
npm run setup:local
npm run db:migrate
npm run dev
# Outro terminal, mesmo diretório:
npm run worker
```

`setup:local` cria `.env.local` ignorado pelo Git, com credenciais aleatórias, e nunca sobrescreve um arquivo existente. Configure `DASHBOARD_PASSWORD` nesse arquivo em seu editor local para entrar no dashboard. Não envie valores pelo chat. `SESSION_SECRET` deve ter pelo menos 32 caracteres. O worker e a migração carregam `.env.local` automaticamente. O Next também o carrega. Persistência local: `.data/growth.sqlite`, WAL, Node SQLite nativo. Pare web e worker antes de copiar/backupear SQLite, incluindo WAL/SHM, ou use backup SQLite consistente.

O worker agenda uma rodada por hora UTC e reivindica um job a cada dois segundos. “Executar análise” garante a rodada da hora atual; cliques repetidos não criam novas cobranças ou decisões. `npm run worker -- --once` agenda a rodada e executa **um** job. O Diretor consulta decisões recentes dos demais agentes; não há execução externa.

## Validar

```sh
npm run typecheck
npm test
npm run build
npm run smoke
npm run test:browser
```

Os testes usam bases e credenciais temporárias. O smoke inicia um servidor de produção temporário e valida login, CSRF, dashboard, fila, decisões, aprovação, kill switch e ingestão assinada. O teste de navegador usa Chromium (`CHROMIUM_PATH` ou `/usr/bin/chromium`). CI instala Chromium pelo Playwright. Para testar PostgreSQL, forneça `DATABASE_URL` para um **banco de testes vazio**, nunca um banco real, e execute `npm test`. Para smoke, use outro banco vazio. Testes não apagam tabelas no PostgreSQL: use bancos descartáveis.

## O que existe

- Dashboard responsivo em português, login, métricas e funil identificados como simulados.
- Cinco agentes: Diretor, Performance, Experimentos, Aquisição e Social. Decisões estruturadas via OpenAI Agents SDK em live; respostas determinísticas úteis em simulação.
- Políticas por agente, teto de mídia, análise/proposta apenas, kill switch global e histórico durável.
- Jobs persistentes com chave por hora/agente, claim atômico, lease de 3 minutos, fencing, três tentativas e backoff exponencial. PostgreSQL usa `SKIP LOCKED`; SQLite usa WAL.
- Rascunhos de conteúdo/experimento e aprovação/rejeição auditada. Aprovar **não executa** nem publica.
- Conectores oficiais Meta Insights, Instagram Media e PostHog HogQL, somente leitura, sem dados pessoais nos campos requisitados.
- Ingestão de eventos de leads e pagamentos sem identidade de pessoas, com HMAC, janela antirreplay e chave idempotente.
- PostgreSQL/Supabase para staging, worker containerizado e CI com deploy preview opcional.

## Limites deste incremento

As métricas fictícias são uma fixture, não resultados reais. O live lê a primeira página de Meta Insights; o dashboard não inventa agregações de receita ou atribuição. Os adaptadores de Instagram e PostHog estão implementados, mas ainda não conectados ao ciclo de análise. Eventos recebidos são armazenados; reconciliação de reembolsos/atribuição e agregação financeira ainda não existem. A gestão A/B é um backlog de hipóteses, não um motor estatístico nem integração de feature flags. Conteúdo é proposto pelos agentes e registrado manualmente como rascunho; calendário/agendamento de publicação e geração automática de drafts são próximos incrementos.

Os orçamentos configurados são tetos de **mídia**, não controle de custo do provedor OpenAI. O código bloqueia toda execução com gasto, e cada chamada live limita saída a 1.200 tokens. Configure também limites de uso no projeto OpenAI. Não há promessa de LGPD completa: este incremento minimiza dados, mas retenção, base legal, contratos e procedimentos de atendimento precisam ser definidos antes de produção. Sem eventos de pessoas no banco, não envie e-mail, IP, nome ou IDs de usuários.

Veja [arquitetura](docs/ARCHITECTURE.md), [staging e credenciais](docs/STAGING.md) e [roteiro incremental](docs/ROADMAP.md).
