import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../lib/db";
import { tick } from "../lib/worker";
const dir = mkdtempSync(join(tmpdir(), "growth-smoke-"));
const base = "http://127.0.0.1:3187";
Object.assign(process.env, {
  GROWTH_MODE: "simulation",
  DATABASE_PATH: join(dir, "smoke.sqlite"),
  DASHBOARD_PASSWORD: randomBytes(24).toString("hex"),
  SESSION_SECRET: randomBytes(32).toString("hex"),
  INGEST_SIGNING_SECRET: randomBytes(32).toString("hex"),
});
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3187", "-H", "127.0.0.1"],
  { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
server.stdout.on("data", (c) => {
  logs += c;
});
server.stderr.on("data", (c) => {
  logs += c;
});
let cookie = "";
async function call(path: string, body?: unknown, origin = true) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: base } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await call("/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, "server readiness");
  assert.equal((await call("/")).status, 307);
  assert.equal((await call("/api/overview")).status, 401);
  const login = await call("/api/login", {
    password: process.env.DASHBOARD_PASSWORD,
  });
  assert.equal(login.status, 200, await login.text());
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.ok((await call("/")).ok);
  const data = await (await call("/api/overview")).json();
  assert.equal(data.snapshot.source, "simulation");
  assert.equal(data.policies.length, 5);
  assert.equal(
    (await call("/api/control", { type: "kill", enabled: true }, false)).status,
    403,
  );
  assert.equal((await call("/api/run", {})).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await tick()).status, "completed");
  assert.equal(
    (await (await call("/api/overview")).json()).decisions.length,
    5,
  );
  const draft = await (
    await call("/api/drafts", {
      type: "create",
      kind: "experiment",
      title: "Landing A/B",
      description:
        "Hipótese: headline objetiva; métrica: lead; guardrail: CAC.",
    })
  ).json();
  assert.equal(
    (
      await call("/api/drafts", {
        type: "review",
        id: draft.id,
        approved: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/drafts", {
        type: "review",
        id: draft.id,
        approved: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("/api/control", { type: "kill", enabled: true })).status,
    200,
  );
  assert.equal((await call("/api/run", {})).status, 409);
  assert.equal((await tick()).status, "paused");
  const event = {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    kind: "purchase",
    amountCents: 29900,
    currency: "BRL",
    channel: "direct",
  };
  const raw = JSON.stringify(event),
    stamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.INGEST_SIGNING_SECRET!)
    .update(`${stamp}.${raw}`)
    .digest("hex");
  const ingest = () =>
    fetch(base + "/api/ingest", {
      method: "POST",
      headers: { "x-growth-timestamp": stamp, "x-growth-signature": signature },
      body: raw,
    });
  assert.equal((await (await ingest()).json()).duplicate, false);
  assert.equal((await (await ingest()).json()).duplicate, true);
  assert.equal((await call("/api/ingest", event)).status, 401);
  assert.equal((await call("/api/logout", {})).status, 200);
  console.log(
    "PASS: production HTTP smoke — authentication, CSRF, dashboard, queue, decisions, approvals, kill switch, signed/idempotent ingestion and logout",
  );
} catch (e) {
  console.error(logs);
  throw e;
} finally {
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", () => resolve());
  });
  await closeDb();
  rmSync(dir, { recursive: true, force: true });
}
