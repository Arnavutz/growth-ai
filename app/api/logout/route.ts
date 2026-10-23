import { cookies } from "next/headers";
import { cookieName, guard } from "../../../lib/auth";
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  (await cookies()).delete(cookieName);
  return Response.json({ ok: true });
}
