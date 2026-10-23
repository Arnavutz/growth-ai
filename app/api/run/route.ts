import { guard } from "../../../lib/auth";
import { schedule, killed, audit } from "../../../lib/store";
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  if (await killed())
    return Response.json({ error: "Kill switch ativo" }, { status: 409 });
  await schedule();
  await audit("admin", "analysis_scheduled");
  return Response.json({
    ok: true,
    message: "Análises na fila; o worker executa em segundo plano.",
  });
}
