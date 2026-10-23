import { z } from "zod";
import { guard } from "../../../lib/auth";
import { setKill, agentIds, init, audit } from "../../../lib/store";
import { query, transaction } from "../../../lib/db";
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kill"), enabled: z.boolean() }),
  z.object({
    type: z.literal("policy"),
    agent: z.enum(agentIds),
    enabled: z.boolean(),
    dailyBudgetCents: z.number().int().min(0).max(10000000),
  }),
]);
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  const p = parsed.data;
  await init();
  return transaction(async () => {
    if (p.type === "kill") await setKill(p.enabled);
    else {
      await query(
        "UPDATE policies SET enabled=$1,daily_budget_cents=$2 WHERE agent=$3",
        [p.enabled ? 1 : 0, p.dailyBudgetCents, p.agent],
      );
      await audit("admin", "policy_updated", p);
    }
    return Response.json({ ok: true });
  });
}
