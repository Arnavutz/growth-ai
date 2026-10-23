import { guard } from "../../../lib/auth";
import { overview } from "../../../lib/store";
import { snapshot } from "../../../lib/connectors";
import { mode } from "../../../lib/config";
export const dynamic = "force-dynamic";
export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const state = await overview();
    const data = await snapshot().catch(() => ({
      source: mode(),
      period: "Conector indisponível",
      metrics: null,
      error:
        "Não foi possível consultar a fonte. Políticas e kill switch continuam disponíveis.",
    }));
    return Response.json({ ...state, snapshot: data });
  } catch {
    return Response.json(
      { error: "Banco indisponível; verifique a configuração." },
      { status: 503 },
    );
  }
}
