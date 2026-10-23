import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { mode, required } from "./config";
export const cookieName="growth_session";
function secret() { const s=required("SESSION_SECRET"); if(s.length<32) throw new Error("SESSION_SECRET must have at least 32 characters"); return s; }
export function signSession(expires=Date.now()+8*3600000) { const body=`${expires}.${randomBytes(16).toString("hex")}`; return `${body}.${createHmac("sha256",secret()).update(body).digest("hex")}`; }
export function verifySession(token:string) {
 const parts=token.split("."); if(parts.length!==3 || !/^\d+$/.test(parts[0]) || Number(parts[0])<=Date.now()) return false;
 const expected=createHmac("sha256",secret()).update(parts.slice(0,2).join(".")).digest("hex");
 const actual=Buffer.from(parts[2],"hex"), wanted=Buffer.from(expected,"hex"); return actual.length===wanted.length && timingSafeEqual(actual,wanted);
}
export function checkPassword(password:string) { const salt="growth-admin-password-comparison"; return timingSafeEqual(scryptSync(password,salt,32),scryptSync(required("DASHBOARD_PASSWORD"),salt,32)); }
export function supabase() { return createClient(required("NEXT_PUBLIC_SUPABASE_URL"),required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false}}); }
export async function authenticated() {
 const token=(await cookies()).get(cookieName)?.value; if(!token) return false;
 if(mode()==="simulation") return verifySession(token);
 const {data,error}=await supabase().auth.getUser(token);
 return !error && !!data.user && data.user.app_metadata?.growth_role==="admin";
}
export function sameOrigin(request:Request) {
 const origin=request.headers.get("origin");
 const expected=process.env.APP_ORIGIN ?? (mode()==="live"?required("APP_ORIGIN"):`${new URL(request.url).protocol}//${request.headers.get("host")}`);
 return origin===expected;
}
export async function guard(request?:Request) {
 if(!await authenticated()) return Response.json({error:"Não autenticado"},{status:401});
 if(request && !["GET","HEAD"].includes(request.method)) {
  if(!sameOrigin(request)) return Response.json({error:"Origem inválida"},{status:403});
 }
 return null;
}
