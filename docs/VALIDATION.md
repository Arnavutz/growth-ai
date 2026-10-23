# Evidências deste incremento

Executado no ambiente cloud em 23/10/2026, Node 24.19.0. Nenhuma chamada real a OpenAI/Meta/Instagram/PostHog ou publicação Vercel foi feita.

| Check                                       | Resultado                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `npm ci` com lockfile                       | Passou                                                                 |
| `npm audit --omit=dev`                      | Zero vulnerabilidades conhecidas no momento da consulta                |
| `npm run format:check`                      | Passou                                                                 |
| `npm run typecheck`                         | Passou                                                                 |
| `npm test` / SQLite                         | 7 testes passaram; nenhum skipped                                      |
| `npm test` / PostgreSQL 17 descartável      | 7 testes passaram; nenhum skipped                                      |
| `npm run build`                             | Build de produção passou                                               |
| `npm run smoke` / SQLite                    | Fluxo HTTP completo passou                                             |
| `npm run smoke` / PostgreSQL 17 descartável | Fluxo HTTP completo passou                                             |
| `npm run test:browser` / Chromium           | Desktop e mobile passaram; sem erro JS ou overflow horizontal          |
| Build `Dockerfile.worker`                   | Passou com proxy/CA oficiais, TLS e checksums ativos                   |
| Worker no container + PostgreSQL            | Passou como usuário não root; 5 decisões; sem .env na imagem           |
| Migração local repetida                     | Passou; arquivos de configuração preservados                           |
| Web + worker na instância atual             | Login e leitura autenticada passaram; 5 decisões simuladas persistidas |
| Reinício do worker / mesma rodada           | Retornou idle, sem duplicar decisões                                   |

Os testes cobrem métricas/denominadores, auth e sessão, assinatura HMAC e rejeição de PII, migração, scheduling idempotente, claims concorrentes, retry/backoff e expiração terminal de lease, kill switch, permissões, rollback de transação e contratos de endpoints oficiais com fetch mockado. Smoke cobre CSRF, aprovação única, ingestão idempotente e logout. Testes de integração real de API e Supabase Auth não rodaram por ausência de credenciais.

Capturas locais não versionadas: `.data/artifacts/dashboard-desktop.png` e `dashboard-mobile.png`. A validação local do workflow não comprova que o GitHub Actions já executou; pipeline ainda precisa ser enviado ao remoto.

O Vercel CLI informa ausência de login, e não há bindings de Vercel ou PostgreSQL de staging. Deploy público e ativação das integrações continuam pendentes. Os commits são locais na branch de trabalho; não houve push. A configuração cloud recebeu install_script/start_skill como rascunho; salvar o rascunho não publica o ambiente nem a aplicação.

A dependência opcional Undici do OpenAI SDK estava sendo resolvida para uma versão antiga compartilhada com a CLI Vercel. A dependência runtime explícita `undici` 8.x respeita o peer range oficial do SDK (`>=5 <9`) e isola a aplicação dessa resolução antiga. O audit de produção passou sem vulnerabilidades; isso não é uma garantia de ausência de falhas futuras.
