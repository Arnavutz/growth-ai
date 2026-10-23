import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  checkPassword,
  signSession,
  supabase,
  cookieName,
  sameOrigin,
} from "../../../lib/auth";
import { mode } from "../../../lib/config";
import { init, audit } from "../../../lib/store";
import { query } from "../../../lib/db";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida" }, { status: 403 });
  const parsed = z
    .object({
      email: z.string().email().optional(),
      password: z.string().min(1).max(256),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  await init();
  // Global persistent throttle: does not trust spoofable forwarding headers or store IPs.
  const id = createHash("sha256").update("dashboard-login").digest("hex");
  const now = new Date().toISOString();
  await query("DELETE FROM login_attempts WHERE expires_at<$1", [now]);
  const [attempt] = await query<{ failures: number }>(
    "INSERT INTO login_attempts(id,failures,expires_at) VALUES ($1,1,$2) ON CONFLICT(id) DO UPDATE SET failures=login_attempts.failures+1 RETURNING failures",
    [id, new Date(Date.now() + 15 * 60000).toISOString()],
  );
  if (attempt.failures > 10)
    return Response.json(
      { error: "Muitas tentativas. Aguarde 15 minutos." },
      { status: 429 },
    );
  let token: string | undefined,
    maxAge = 8 * 3600;
  try {
    if (mode() === "simulation") {
      if (checkPassword(parsed.data.password)) token = signSession();
    } else if (parsed.data.email) {
      const { data, error } = await supabase().auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (!error && data.user?.app_metadata?.growth_role === "admin") {
        token = data.session?.access_token;
        maxAge = data.session?.expires_in ?? 3600;
      }
    }
  } catch {
    return Response.json(
      { error: "Autenticação não configurada" },
      { status: 503 },
    );
  }
  if (!token) {
    await audit("anonymous", "login_denied");
    return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
  }
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  await audit("admin", "login");
  return Response.json({ ok: true });
}
