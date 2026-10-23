import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
export const ProductEvent=z.object({id:z.string().uuid(),occurredAt:z.string().datetime(),kind:z.enum(["lead","qualified_lead","purchase","refund"]),amountCents:z.number().int().min(0).max(100000000).default(0),currency:z.literal("BRL"),channel:z.enum(["meta","instagram","organic","direct","other"])}).strict();
export function validSignature(raw:string, timestamp:string, signature:string, secret:string, now=Date.now()) {
 if(!/^\d+$/.test(timestamp) || Math.abs(now-Number(timestamp)*1000)>300000 || !/^[a-f0-9]{64}$/.test(signature))return false;
 const expected=createHmac("sha256",secret).update(`${timestamp}.${raw}`).digest();return timingSafeEqual(Buffer.from(signature,"hex"),expected);
}
