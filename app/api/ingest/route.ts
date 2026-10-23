import { ProductEvent, validSignature } from "../../../lib/events";
import { init, audit } from "../../../lib/store";
import { query, transaction } from "../../../lib/db";
export async function POST(request: Request) {
  const secret = process.env.INGEST_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    return Response.json(
      { error: "Ingestão não configurada" },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 8192)
    return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (
    !validSignature(
      raw,
      request.headers.get("x-growth-timestamp") ?? "",
      request.headers.get("x-growth-signature") ?? "",
      secret,
    )
  )
    return new Response(null, { status: 401 });
  const data = ProductEvent.safeParse(
    (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })(),
  );
  if (!data.success)
    return Response.json(
      { error: "Evento inválido; não envie dados pessoais" },
      { status: 400 },
    );
  await init();
  const e = data.data;
  return transaction(async () => {
    const inserted = await query(
      "INSERT INTO events(id,occurred_at,kind,amount_cents,currency,channel) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING id",
      [e.id, e.occurredAt, e.kind, e.amountCents, e.currency, e.channel],
    );
    if (inserted.length)
      await audit("ingest", "event_received", { id: e.id, kind: e.kind });
    return Response.json(
      { accepted: true, duplicate: !inserted.length },
      { status: 202 },
    );
  });
}
