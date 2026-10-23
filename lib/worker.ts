import { randomUUID } from "node:crypto";
import { query, transaction } from "./db";
import { init, killed, policy, authorize, audit, type AgentId } from "./store";
import { snapshot } from "./connectors";
import { analyze } from "./agents";
import { mode } from "./config";
type Job = {id:string; agent:AgentId; attempts:number; lease_until:string};
export async function tick() {
 await init(); if(await killed()) return {status:"paused"};
 const now=new Date().toISOString(); const lease=new Date(Date.now()+180000).toISOString();
 // Single atomic claim works with concurrent workers on SQLite and PostgreSQL.
 const [job]=await query<Job>(`UPDATE jobs SET status='running',attempts=attempts+1,lease_until=$1 WHERE id=(SELECT id FROM jobs WHERE ((status='pending' AND due_at<=$2) OR (status='running' AND lease_until<$3)) AND attempts<3 ORDER BY due_at, CASE WHEN agent='director' THEN 1 ELSE 0 END LIMIT 1${process.env.DATABASE_URL || mode()==="live"?" FOR UPDATE SKIP LOCKED":""}) AND ((status='pending') OR (status='running' AND lease_until<$4)) RETURNING *`,[lease,now,now,now]);
 if(!job) { await query("UPDATE jobs SET status='failed',last_error='lease_expired' WHERE status='running' AND attempts>=3 AND lease_until<$1",[now]); return {status:"idle"}; }
 try {
  if(!authorize(await policy(job.agent),"analyze")) throw new Error("policy_denied");
  const data=await snapshot(); const context=job.agent==="director"?await query("SELECT agent,source,payload FROM decisions ORDER BY created_at DESC LIMIT 20"):[];
  const result=await analyze(job.agent,{snapshot:data,priorDecisions:context});
  if(await killed() || !authorize(await policy(job.agent),result.proposedAction)) throw new Error("policy_denied");
  // Fence stale workers: only the lease holder may persist the decision.
  await transaction(async()=>{
  // Serialize policy changes with the decision commit on PostgreSQL.
  if(mode()==="live" || process.env.DATABASE_URL) {await query("SELECT id FROM settings WHERE id='kill_switch' FOR UPDATE");await query("SELECT agent FROM policies WHERE agent=$1 FOR UPDATE",[job.agent]);}
  if(await killed() || !authorize(await policy(job.agent),result.proposedAction)) throw new Error("policy_denied");
  const inserted=await query(`INSERT INTO decisions(id,job_id,agent,created_at,source,payload) SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM jobs WHERE id=$7 AND status='running' AND lease_until=$8) ON CONFLICT(job_id) DO NOTHING RETURNING id`,[randomUUID(),job.id,job.agent,new Date().toISOString(),mode(),JSON.stringify(result),job.id,lease]);
  await query("UPDATE jobs SET status='completed',completed_at=$1,lease_until=NULL WHERE id=$2 AND lease_until=$3",[new Date().toISOString(),job.id,lease]);
  if(inserted.length) await audit(job.agent,"decision_recorded",{jobId:job.id,source:mode()});
  });
  return {status:"completed",jobId:job.id};
 } catch(error) {
  // Store only classified errors. Never persist upstream payloads, URLs or tokens.
  const code=error instanceof Error && error.message==="policy_denied" ? "policy_denied" : "analysis_failed";
  await query("UPDATE jobs SET status=$1,due_at=$2,lease_until=NULL,last_error=$3 WHERE id=$4 AND lease_until=$5",[job.attempts>=3?"failed":"pending",new Date(Date.now()+30000*2**(job.attempts-1)).toISOString(),code,job.id,lease]);
  await audit(job.agent,"job_failed",{jobId:job.id,code,attempt:job.attempts});
  return {status:"failed",jobId:job.id,code};
 }
}
