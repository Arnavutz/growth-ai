import { randomUUID } from "node:crypto";
import { z } from "zod";
import { guard } from "../../../lib/auth";
import { init, killed, audit } from "../../../lib/store";
import { query, transaction } from "../../../lib/db";
const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create"),
    kind: z.enum(["experiment", "content"]),
    title: z.string().min(3).max(160),
    description: z.string().min(10).max(4000),
  }),
  z.object({
    type: z.literal("review"),
    id: z.string().uuid(),
    approved: z.boolean(),
  }),
]);
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  await init();
  if (await killed())
    return Response.json({ error: "Kill switch ativo" }, { status: 409 });
  return transaction(async () => {
    const d = parsed.data;
    if (d.type === "create") {
      const id = randomUUID();
      await query(
        "INSERT INTO drafts(id,kind,created_at,payload) VALUES ($1,$2,$3,$4)",
        [
          id,
          d.kind,
          new Date().toISOString(),
          JSON.stringify({ title: d.title, description: d.description }),
        ],
      );
      await audit("admin", "draft_created", { id, kind: d.kind });
      return Response.json({ id });
    }
    const rows = await query(
      "UPDATE drafts SET status=$1,reviewed_at=$2 WHERE id=$3 AND status='pending' RETURNING id",
      [d.approved ? "approved" : "rejected", new Date().toISOString(), d.id],
    );
    if (!rows.length)
      return Response.json(
        { error: "Rascunho ausente ou já revisado" },
        { status: 409 },
      );
    await audit("admin", "draft_reviewed", { id: d.id, approved: d.approved });
    return Response.json({ ok: true, executed: false });
  });
}
