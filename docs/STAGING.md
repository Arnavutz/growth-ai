# Staging: pronto para configuração, não publicado

Não há credenciais de deploy, banco ou APIs configuradas nesta tarefa. Os arquivos de infraestrutura são preparados; não comprovam deploy nem funcionamento em contas reais. Não é necessário conectar Meta/OpenAI para publicar um staging em simulação.

## Primeiro staging seguro

1. Criar projeto PostgreSQL/Supabase exclusivo de staging. Obter conexão de pooler compatível com seu host (TLS com verificação; nunca `rejectUnauthorized=false`). Usar a mesma `DATABASE_URL` no web e worker. Não colocar credenciais em URL pública ou Git. Rodar `npm run db:migrate` com esse binding e verificar backup/conectividade.
2. Na Vercel, importar este repositório, runtime Node 24, framework Next.js. Configurar `GROWTH_MODE=simulation`, `DATABASE_URL`, `DASHBOARD_PASSWORD` forte, `SESSION_SECRET` >=32 caracteres e `APP_ORIGIN` igual à origem HTTPS exata do preview (sem barra final). Reimplantar ao mudar env. Simulação em Vercel **exige PostgreSQL**: filesystem não é persistente nem compartilhado.
3. Publicar o container `Dockerfile.worker` num host de workers persistentes. `render.yaml` é um blueprint opcional, não uma dependência do aplicativo. Revisar custos do host antes de provisionar. Definir `GROWTH_MODE=simulation` e a mesma `DATABASE_URL`; o worker não precisa de senha de dashboard. A imagem não inclui `.env` nem `.data`; só PostgreSQL em staging.
4. Validar `/api/health`, login, overview, execução da rodada, cinco decisões e auditoria. Reiniciar worker e verificar que a rodada da mesma hora não duplica. Testar kill switch e aprovação sem publicação. Verificar logs sanitizados e alertas para jobs failed/lease_expired. Não declare staging pronto só por ter URL ou processo vivo.

## CI e deploy

`.github/workflows/ci.yml` roda TypeScript, testes, build, smoke HTTP e navegador em push/PR. Job de preview Vercel fica desligado até `STAGING_ENABLED=true` em GitHub Variables, secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` e GitHub Environment `staging` configurados. Configure proteção/revisão do environment conforme equipe. O deploy acontece só em push para main com checks aprovados. Não usa `--prod`. O worker precisa de deploy separado; auto deploy do blueprint está desligado.

Alternativa manual após credenciais configuradas no shell seguro: `npx vercel link`, `npx vercel pull --environment=preview`, `npx vercel build`, `npx vercel deploy --prebuilt`. Não cole tokens no chat ou em comandos versionados. Primeiro push/PR e conexão da Vercel ainda dependem de GitHub/conta de deployment.

## Ativar leitura live (etapa posterior)

Configure bindings seguros; nenhum valor foi solicitado em chat:

| Variável                                                             | Uso / permissão mínima                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GROWTH_MODE=live`                                                   | Usa PostgreSQL, Supabase Auth e análises OpenAI reais; não permite execução externa                                    |
| `DATABASE_URL`                                                       | PostgreSQL backend, com TLS verificado e alcance de rede pelo worker e web                                             |
| `APP_ORIGIN`                                                         | Origem HTTPS exata do dashboard para CSRF                                                                              |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | Projeto Supabase; chave pública publishable/anon, nunca service role                                                   |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                                     | Projeto OpenAI isolado, modelo compatível com structured outputs, limites de uso definidos no provedor                 |
| `META_ACCESS_TOKEN`                                                  | Token de sistema oficial, app/conta autorizados, escopo de leitura `ads_read`; não solicitar ads_management nesta fase |
| `META_AD_ACCOUNT_ID`                                                 | `act_` + ID numérico da conta                                                                                          |
| `META_GRAPH_VERSION`                                                 | Versão Graph API ainda suportada pela Meta, por exemplo o valor aprovado no app; não assumir versão antiga             |
| `INSTAGRAM_ACCOUNT_ID`                                               | Conta profissional, vinculada conforme requisitos atuais da API; permissões de leitura aprovadas pela Meta             |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` | Acesso de leitura a queries, host `https://us.posthog.com` ou `https://eu.posthog.com`                                 |
| `INGEST_SIGNING_SECRET`                                              | Chave compartilhada backend-backend >=32 caracteres para eventos de produto/pagamentos                                 |

No Supabase, crie/conceda acesso ao usuário administrativo e defina `app_metadata.growth_role=admin` via ferramenta administrativa confiável. Restrinja cadastro e configure MFA/controles de conta conforme seu risco. A aplicação não implementa MFA própria.

Apenas Meta entra no snapshot live desta versão. Instagram/PostHog são adaptadores disponíveis, mas não são consultados automaticamente pelo worker; há trabalho de normalização/paginação pendente. Métricas live aparecem como indisponíveis até reconciliação e atribuição implementadas. Não misture fixtures com métricas reais.

Destinos de rede quando necessários: registry.npmjs.org (instalação), api.openai.com, graph.facebook.com, host específico do projeto Supabase/auth, host/porta do pooler PostgreSQL, us.posthog.com ou eu.posthog.com, api.vercel.com e destinos informados oficialmente pela Vercel/host de worker. A política de rede cloud atual não foi ampliada para integrações sem credenciais.

## Build em rede com proxy corporativo

O Dockerfile aceita o secret opcional BuildKit `npm_ca` para uma CA de confiança oficial da sua organização. Passe os argumentos de proxy padrão do Docker somente quando o host exigir. Se o DNS do BuildKit não resolver o hostname do proxy, use `--add-host` com o endereço resolvido pela rede autorizada do host; não fixe esse endereço no repositório. O certificado é montado apenas durante a instalação e não é incluído na imagem; tokens de aplicação também não entram no build. Não desative verificação TLS nem altere checksums do lockfile. Para conexões runtime atrás de proxy, configure o trust store e a rota de rede suportados pelo seu provedor separadamente.
