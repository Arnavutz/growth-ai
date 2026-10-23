"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronDown,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import type { metrics } from "../lib/metrics";
type Row = Record<string, string | number>;
type Data = {
  killSwitch: boolean;
  policies: Row[];
  jobs: Row[];
  decisions: Row[];
  audit: Row[];
  drafts: Row[];
  snapshot: {
    source: string;
    period: string;
    error?: string;
    metrics: ReturnType<typeof metrics> | null;
  };
};
const names: Record<string, string> = {
  director: "Diretor de Growth",
  performance: "Performance",
  experiments: "Experimentos",
  acquisition: "Aquisição",
  social: "Social Media",
};
const iconComponents = {
  director: Bot,
  performance: Activity,
  experiments: FlaskConical,
  acquisition: Target,
  social: CalendarDays,
};
function AgentIcon({ id }: { id: string }) {
  const Icon = iconComponents[id as keyof typeof iconComponents] ?? Bot;
  return <Icon size={18} aria-hidden="true" />;
}
const navigationIcons = [
  LayoutDashboard,
  Bot,
  FlaskConical,
  CalendarDays,
  ListChecks,
  Settings2,
];
const money = (c: number | null) =>
  c === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(c / 100);
const number = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
function payload(row: Row): Record<string, unknown> {
  try {
    return JSON.parse(String(row.payload));
  } catch {
    return {};
  }
}
export default function Dashboard({ mode }: { mode: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Visão geral");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/overview");
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conexão");
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, [load]);
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNotice(d.message ?? "Alteração registrada na auditoria.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conexão");
    } finally {
      setBusy(false);
    }
  }
  const m = data?.snapshot.metrics;
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          <span className="brand-icon">g</span> growth
          <span className="muted">/ ai</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">G</span>
          <div>
            Meu produto<span className="fine block">Growth workspace</span>
          </div>
          <ChevronDown size={14} className="muted" aria-hidden="true" />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {[
            "Visão geral",
            "Agentes",
            "Experimentos",
            "Conteúdo",
            "Auditoria",
            "Políticas",
          ].map((t, i) => (
            <button
              key={t}
              aria-label={t}
              aria-current={tab === t ? "page" : undefined}
              className={tab === t ? "nav-active" : ""}
              onClick={() => setTab(t)}
            >
              <span aria-hidden="true">
                {(() => {
                  const Icon = navigationIcons[i];
                  return <Icon size={17} />;
                })()}
              </span>
              {t}
              {t === "Agentes" && <small>5</small>}
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          <div className="safe-indicator">
            <i /> Execução externa bloqueada
          </div>
          <p className="fine">
            Sua estratégia. Agentes a serviço.
            <br />
            Você mantém o controle.
          </p>
          <button
            className="logout"
            onClick={async () => {
              await action("/api/logout", {});
              window.location.href = "/login";
            }}
          >
            Sair do workspace
          </button>
        </div>
      </aside>
      <div className="main">
        <header>
          <span>
            Workspace <span className="muted">/</span> <b>{tab}</b>
          </span>
          <div className="header-right">
            <span className="badge">
              {mode === "simulation" ? "◉ SIMULAÇÃO" : "◉ LIVE · LEITURA"}
            </span>
            <span className="avatar">AD</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">GROWTH INTELLIGENCE</span>
              <h1>
                {tab === "Visão geral" ? "Crescimento, sob controle." : tab}
              </h1>
              <p className="muted">
                Uma visão clara dos resultados. Um próximo passo com evidências.
              </p>
            </div>
            <button
              className="primary"
              disabled={busy || !data || data.killSwitch}
              onClick={() => action("/api/run", {})}
            >
              ✧ Executar análise
            </button>
          </div>
          <div className="simulation-note">
            <span>◈</span>
            <div>
              <strong>
                {mode === "simulation"
                  ? "Você está em um ambiente de simulação"
                  : "Conectores em modo somente leitura"}
              </strong>
              <span>
                {mode === "simulation"
                  ? "Métricas ilustrativas. Nenhum anúncio, investimento ou publicação real será alterado."
                  : "Métricas ainda não normalizadas. Receita e atribuição aguardam integração validada."}
              </span>
            </div>
            <span className="badge neutral">READ ONLY</span>
          </div>
          {data?.snapshot.error && (
            <div className="error" role="alert">
              {data.snapshot.error}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {!data ? (
            <p role="status">Carregando operações…</p>
          ) : (
            <>
              {tab === "Visão geral" && (
                <>
                  <div className="section-heading">
                    <h2>O pulso do seu negócio</h2>
                    <span className="period">◷ {data.snapshot.period}</span>
                  </div>
                  <div className="metric-grid">
                    {[
                      {
                        label: "Receita",
                        value: m ? money(m.revenueCents) : "—",
                        detail: "Receita bruta",
                        icon: "↗",
                      },
                      {
                        label: "Clientes pagantes",
                        value: m ? number(m.customers) : "—",
                        detail: "Conversões em clientes",
                        icon: "◎",
                      },
                      {
                        label: "CAC",
                        value: m ? money(m.cacCents) : "—",
                        detail: "Investimento por cliente",
                        icon: "⌁",
                      },
                      {
                        label: "Margem de contribuição",
                        value: m ? money(m.contributionCents) : "—",
                        detail: "Após custos variáveis e mídia",
                        icon: "◈",
                      },
                    ].map((k) => (
                      <article className="metric" key={k.label}>
                        <div className="metric-label">
                          {k.label}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </div>
                        <strong>{k.value}</strong>
                        <span className="fine">{k.detail}</span>
                      </article>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="section-heading">
                        <div>
                          <h2>Da atenção à conversão</h2>
                          <p className="fine">
                            Funil de aquisição · mesma janela de análise
                          </p>
                        </div>
                        <ArrowUpRight
                          size={16}
                          className="muted"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="funnel">
                        {[
                          {
                            label: "Impressões",
                            n: m?.impressions ?? 0,
                            w: 100,
                          },
                          { label: "Cliques", n: m?.clicks ?? 0, w: 80 },
                          { label: "Leads", n: m?.leads ?? 0, w: 60 },
                          {
                            label: "Qualificados",
                            n: m?.qualifiedLeads ?? 0,
                            w: 42,
                          },
                          { label: "Clientes", n: m?.customers ?? 0, w: 25 },
                        ].map((s, i) => (
                          <div className="funnel-row" key={s.label}>
                            <span>{s.label}</span>
                            <div className="bar-track">
                              <div
                                className={"bar bar-" + i}
                                style={{ width: s.w + "%" }}
                              />
                            </div>
                            <b>{m ? number(s.n) : "—"}</b>
                          </div>
                        ))}
                      </div>
                      <div className="funnel-foot">
                        Larguras esquemáticas para leitura do funil; valores à
                        direita são absolutos.
                      </div>
                    </section>
                    <section className="panel opportunity">
                      <span className="eyebrow">SEU PRÓXIMO MOVIMENTO</span>
                      <div className="opportunity-icon">
                        <Sparkles size={29} aria-hidden="true" />
                      </div>
                      <h2>
                        Evidência antes
                        <br />
                        de escalar.
                      </h2>
                      <p>
                        O Diretor de Growth reúne as análises dos agentes para
                        orientar prioridades e novos experimentos.
                      </p>
                      <div className="opportunity-footer">
                        <span className="dot" /> {data.decisions.length}{" "}
                        decisões no histórico
                        <button
                          className="text-button"
                          onClick={() => setTab("Agentes")}
                        >
                          Ver análises →
                        </button>
                      </div>
                    </section>
                  </div>
                  <div className="section-heading">
                    <h2>Eficiência em cada etapa</h2>
                    <span className="fine">
                      Sem comparativo histórico disponível
                    </span>
                  </div>
                  <div className="mini-grid">
                    {[
                      {
                        label: "Investimento",
                        value: m ? money(m.spendCents) : "—",
                      },
                      {
                        label: "CTR",
                        value:
                          m?.ctr != null ? (m.ctr * 100).toFixed(2) + "%" : "—",
                      },
                      { label: "CPC", value: m ? money(m.cpcCents) : "—" },
                      { label: "CPM", value: m ? money(m.cpmCents) : "—" },
                      {
                        label: "ROAS",
                        value: m?.roas != null ? m.roas.toFixed(2) + "×" : "—",
                      },
                    ].map((k) => (
                      <div className="mini-metric" key={k.label}>
                        <span className="fine">{k.label}</span>
                        <strong>{k.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {(tab === "Visão geral" || tab === "Agentes") && (
                <>
                  <div className="section-heading">
                    <h2>Sua equipe de growth</h2>
                    <span className="fine">
                      5 agentes · autonomia supervisionada
                    </span>
                  </div>
                  <div className="agent-grid">
                    {data.policies.map((p) => {
                      const decision = data.decisions.find(
                        (d) => d.agent === p.agent,
                      );
                      const result = decision ? payload(decision) : null;
                      return (
                        <article className="agent-card" key={p.agent}>
                          <div className="agent-top">
                            <span className="agent-icon">
                              <AgentIcon id={String(p.agent)} />
                            </span>
                            <span className="status">
                              <i
                                className={
                                  Number(p.enabled) && !data.killSwitch
                                    ? ""
                                    : "paused"
                                }
                              />
                              {!Number(p.enabled) || data.killSwitch
                                ? "Pausado"
                                : "Disponível"}
                            </span>
                          </div>
                          <h3>{names[p.agent]}</h3>
                          <p>
                            {result
                              ? String(result.summary)
                              : "Pronto para analisar os dados e propor o próximo passo."}
                          </p>
                          <div className="agent-footer">
                            <span>Somente análise</span>
                            <ArrowUpRight size={12} aria-hidden="true" />
                          </div>
                          {tab === "Agentes" && result && (
                            <div className="decision-detail">
                              <strong>Evidências</strong>
                              <ul>
                                {(result.evidence as string[]).map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                              <strong>Recomendações</strong>
                              <ul>
                                {(result.recommendations as string[]).map(
                                  (s, i) => (
                                    <li key={i}>{s}</li>
                                  ),
                                )}
                              </ul>
                              <span className="fine">
                                Confiança: {String(result.confidence)} ·{" "}
                                {String(decision?.source)}
                              </span>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
              {(tab === "Experimentos" || tab === "Conteúdo") && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {tab === "Experimentos"
                          ? "Hipóteses para aprender"
                          : "Ideias que merecem espaço"}
                      </h2>
                      <p className="fine">
                        A aprovação registra a decisão. Não inicia testes nem
                        publica conteúdo.
                      </p>
                    </div>
                  </div>
                  <form
                    className="draft-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const d = new FormData(form);
                      await action("/api/drafts", {
                        type: "create",
                        kind: tab === "Experimentos" ? "experiment" : "content",
                        title: d.get("title"),
                        description: d.get("description"),
                      });
                      form.reset();
                    }}
                  >
                    <label>
                      Título
                      <input
                        name="title"
                        required
                        minLength={3}
                        maxLength={160}
                      />
                    </label>
                    <label>
                      {tab === "Experimentos"
                        ? "Hipótese, variantes, métrica, guardrails e critério de parada"
                        : "Texto, canal, data sugerida e objetivo"}
                      <textarea
                        name="description"
                        required
                        minLength={10}
                        maxLength={4000}
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={busy || data.killSwitch}
                    >
                      Salvar para aprovação
                    </button>
                  </form>
                  <div className="draft-list">
                    {data.drafts
                      .filter(
                        (d) =>
                          d.kind ===
                          (tab === "Experimentos" ? "experiment" : "content"),
                      )
                      .map((d) => (
                        <article key={d.id}>
                          <span className="badge neutral">{d.status}</span>
                          <h3>{String(payload(d).title)}</h3>
                          <p className="preserve">
                            {String(payload(d).description)}
                          </p>
                          {d.status === "pending" && (
                            <div className="button-row">
                              <button
                                disabled={busy || data.killSwitch}
                                onClick={() =>
                                  action("/api/drafts", {
                                    type: "review",
                                    id: d.id,
                                    approved: true,
                                  })
                                }
                              >
                                Aprovar proposta
                              </button>
                              <button
                                disabled={busy || data.killSwitch}
                                onClick={() =>
                                  action("/api/drafts", {
                                    type: "review",
                                    id: d.id,
                                    approved: false,
                                  })
                                }
                              >
                                Rejeitar
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              )}
              {tab === "Auditoria" && (
                <section className="panel">
                  <h2>Histórico de decisões e execução</h2>
                  <p className="fine">
                    Registros recentes, sem dados pessoais. Horários no fuso do
                    navegador.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Quando</th>
                          <th>Ator</th>
                          <th>Ação</th>
                          <th>Contexto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.audit.map((a) => (
                          <tr key={a.id}>
                            <td>
                              {new Date(a.created_at).toLocaleString("pt-BR")}
                            </td>
                            <td>{a.actor}</td>
                            <td>{a.action}</td>
                            <td>
                              <code>{a.payload}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>Fila persistente</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Agente</th>
                          <th>Status</th>
                          <th>Tentativas</th>
                          <th>Erro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.jobs.map((j) => (
                          <tr key={j.id}>
                            <td>{names[j.agent]}</td>
                            <td>{j.status}</td>
                            <td>{j.attempts}</td>
                            <td>{j.last_error ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {tab === "Políticas" && (
                <section className="panel">
                  <h2>Autonomia com limites explícitos</h2>
                  <p className="muted">
                    Ações com gasto e publicação estão bloqueadas pelo código,
                    mesmo quando há orçamento definido.
                  </p>
                  <div className="kill-panel">
                    <div>
                      <h3>Kill switch global</h3>
                      <p className="fine">
                        Suspende novas análises e aprovações. Análises em
                        andamento não persistem resultados após a checagem
                        final.
                      </p>
                    </div>
                    <button
                      className={data.killSwitch ? "primary" : "danger"}
                      disabled={busy}
                      onClick={() =>
                        action("/api/control", {
                          type: "kill",
                          enabled: !data.killSwitch,
                        })
                      }
                    >
                      {data.killSwitch
                        ? "Retomar operação"
                        : "Pausar toda operação"}
                    </button>
                  </div>
                  {data.policies.map((p) => (
                    <form
                      className="policy-row"
                      key={p.agent}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action("/api/control", {
                          type: "policy",
                          agent: p.agent,
                          enabled: f.get("enabled") === "on",
                          dailyBudgetCents: Math.round(
                            Number(f.get("budget")) * 100,
                          ),
                        });
                      }}
                    >
                      <h3>{names[p.agent]}</h3>
                      <label className="check">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={!!Number(p.enabled)}
                        />{" "}
                        Habilitado
                      </label>
                      <label>
                        Teto diário (R$)
                        <input
                          name="budget"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100000"
                          defaultValue={Number(p.daily_budget_cents) / 100}
                          required
                        />
                      </label>
                      <button disabled={busy}>Salvar política</button>
                    </form>
                  ))}
                </section>
              )}
              <footer>
                <span>
                  <i className="dot" />{" "}
                  {data.killSwitch ? "Operação pausada" : "Workspace conectado"}
                </span>
                <span>GROWTH AI · CONSTRUIR. MEDIR. APRENDER.</span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
