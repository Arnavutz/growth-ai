import { mode, required } from "./config";
import { metrics, simulatedTotals } from "./metrics";
export interface ReadConnector {
  name: string;
  read(): Promise<unknown>;
}
async function json(url: URL, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Connector HTTP ${response.status}`);
  return response.json();
}
function graph(path: string, fields: string) {
  const version = required("META_GRAPH_VERSION");
  if (!/^v\d+\.0$/.test(version)) throw new Error("Invalid Meta API version");
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  url.searchParams.set("fields", fields);
  return url;
}
export const meta: ReadConnector = {
  name: "meta",
  async read() {
    const account = required("META_AD_ACCOUNT_ID");
    if (!/^act_\d+$/.test(account)) throw new Error("Invalid ad account ID");
    const url = graph(
      `${account}/insights`,
      "impressions,clicks,spend,cpc,cpm,ctr,actions,action_values",
    );
    url.searchParams.set("date_preset", "last_7d");
    url.searchParams.set("limit", "100");
    return json(url, required("META_ACCESS_TOKEN"));
  },
};
export const instagram: ReadConnector = {
  name: "instagram",
  async read() {
    const id = required("INSTAGRAM_ACCOUNT_ID");
    if (!/^\d+$/.test(id)) throw new Error("Invalid Instagram ID");
    return json(
      graph(`${id}/media`, "id,media_type,timestamp,like_count,comments_count"),
      required("META_ACCESS_TOKEN"),
    );
  },
};
export const posthog: ReadConnector = {
  name: "posthog",
  async read() {
    const host = new URL(
      process.env.POSTHOG_API_HOST ?? "https://us.posthog.com",
    );
    if (
      !["us.posthog.com", "eu.posthog.com"].includes(host.hostname) ||
      host.protocol !== "https:"
    )
      throw new Error("Unsupported PostHog host");
    const project = required("POSTHOG_PROJECT_ID");
    if (!/^\d+$/.test(project)) throw new Error("Invalid PostHog project");
    const url = new URL(`/api/projects/${project}/query/`, host);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${required("POSTHOG_PERSONAL_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query:
            "SELECT event, count() FROM events WHERE timestamp > now() - INTERVAL 7 DAY GROUP BY event LIMIT 50",
        },
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`PostHog HTTP ${response.status}`);
    return response.json();
  },
};
export async function snapshot() {
  if (mode() === "simulation")
    return {
      source: "simulation" as const,
      period: "Últimos 7 dias • dados fictícios",
      metrics: metrics(simulatedTotals),
    };
  // Do not fabricate revenue, qualified leads, or attribution from incomplete sources.
  return {
    source: "live" as const,
    period: "Últimos 7 dias • Meta (primeira página); atribuição pendente",
    metrics: null,
    meta: await meta.read(),
  };
}
