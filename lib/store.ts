import { randomUUID } from "node:crypto";
import { mode } from "./config";
import { schema } from "./schema";
import { query, transaction } from "./db";
export const agentIds = ["director", "performance", "experiments", "acquisition", "social"] as const;
export type AgentId = typeof agentIds[number];
let initialized: Promise<void> | undefined;
export function init() { return initialized ??= migrate().catch(e => { initialized = undefined; throw e; }); }
async function migrate() {
 await transaction(async()=>{
  if(process.env.DATABASE_URL || mode()==="live") await query("SELECT pg_advisory_xact_lock(7431092)");
  const migration = schema;
  for (const statement of migration.split(";").map(s=>s.trim()).filter(Boolean)) await query(statement);
  if (process.env.DATABASE_URL || mode() === "live") for (const table of ["settings","policies","jobs","decisions","audit","drafts","events","login_attempts"]) await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  for (const agent of agentIds) await query("INSERT INTO policies(agent) VALUES ($1) ON CONFLICT(agent) DO NOTHING", [agent]);
 });
}
export async function audit(actor: string, action: string, payload: unknown = {}) {
  await query("INSERT INTO audit(id,created_at,actor,action,payload) VALUES ($1,$2,$3,$4,$5)", [randomUUID(),new Date().toISOString(),actor,action,JSON.stringify(payload)]);
}
export async function killed() { await init(); return (await query<{value:string}>("SELECT value FROM settings WHERE id='kill_switch'"))[0]?.value !== "0"; }
export async function setKill(enabled: boolean) { await init(); await transaction(async()=>{await query("UPDATE settings SET value=$1 WHERE id='kill_switch'", [enabled?"1":"0"]); await audit("admin","kill_switch", {enabled});}); }
export type Policy = {agent: AgentId; enabled:number; daily_budget_cents:number; allowed_actions:string};
export async function policy(agent: AgentId) { await init(); return (await query<Policy>("SELECT * FROM policies WHERE agent=$1", [agent]))[0]; }
export function authorize(p: Policy | undefined, action: string, spendCents = 0, spentCents = 0) {
  if (!p || !p.enabled || !JSON.parse(p.allowed_actions).includes(action)) return false;
  // Execution is intentionally unavailable in all modes until Phase 3 is implemented.
  if (!["analyze","propose"].includes(action) || spendCents !== 0 || spentCents < 0) return false;
  return spentCents + spendCents <= p.daily_budget_cents;
}
export async function schedule(slot = new Date().toISOString().slice(0,13)) {
  await init();
  for (const agent of [...agentIds.filter(a=>a!=="director"),"director"]) await query("INSERT INTO jobs(id,agent,due_at) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING", [`${slot}:${agent}`,agent,new Date().toISOString()]);
}
export async function overview() {
  await init();
  return {killSwitch: await killed(), policies:await query<Policy>("SELECT * FROM policies ORDER BY agent"), jobs:await query("SELECT * FROM jobs ORDER BY due_at DESC LIMIT 30"), decisions:await query("SELECT * FROM decisions ORDER BY created_at DESC LIMIT 20"), audit:await query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 30"), drafts:await query("SELECT * FROM drafts ORDER BY created_at DESC LIMIT 20")};
}
