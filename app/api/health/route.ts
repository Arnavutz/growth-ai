import { mode } from "../../../lib/config";
import { query } from "../../../lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await query("SELECT 1 AS healthy");
    return Response.json({
      status: "ok",
      database: "reachable",
      mode: mode(),
      externalActions: false,
    });
  } catch {
    return Response.json(
      { status: "unavailable", externalActions: false },
      { status: 503 },
    );
  }
}
