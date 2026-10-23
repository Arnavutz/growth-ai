import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { query, closeDb, transaction } from "../lib/db";
import {
  init,
  schedule,
  killed,
  setKill,
  authorize,
  policy,
} from "../lib/store";
import { tick } from "../lib/worker";
import { metrics } from "../lib/metrics";
import { ProductEvent, validSignature } from "../lib/events";
import { signSession, verifySession, checkPassword } from "../lib/auth";
import { schema } from "../lib/schema";
const dir = mkdtempSync(join(tmpdir(), "growth-test-"));
process.env.GROWTH_MODE = "simulation";
process.env.DATABASE_PATH = join(dir, "test.sqlite");
process.env.SESSION_SECRET = "a".repeat(64);
process.env.DASHBOARD_PASSWORD = "test-only-password";
after(async () => {
  await closeDb();
  rmSync(dir, { recursive: true, force: true });
});
test("metrics preserve undefined denominators and contribution after media", () => {
  const m = metrics({
    impressions: 1000,
    clicks: 100,
    leads: 20,
    qualifiedLeads: 10,
    customers: 2,
    spendCents: 10000,
    revenueCents: 50000,
    variableCostCents: 10000,
  });
  assert.equal(m.ctr, 0.1);
  assert.equal(m.cpcCents, 100);
  assert.equal(m.cpmCents, 10000);
  assert.equal(m.cacCents, 5000);
  assert.equal(m.roas, 5);
  assert.equal(m.contributionCents, 30000);
  assert.equal(m.leadToCustomer, 0.2);
  assert.equal(
    metrics({
      impressions: 0,
      clicks: 0,
      leads: 0,
      qualifiedLeads: 0,
      customers: 0,
      spendCents: 0,
      revenueCents: 0,
      variableCostCents: 0,
    }).cacCents,
    null,
  );
});
test("signed sessions reject tampering, expiry and wrong passwords", () => {
  const token = signSession();
  assert.ok(verifySession(token));
  assert.ok(!verifySession(token + "aa"));
  assert.ok(!verifySession(signSession(Date.now() - 1)));
  assert.ok(checkPassword("test-only-password"));
  assert.ok(!checkPassword("wrong"));
});
test("ingestion rejects PII, stale signatures and tampered bodies", () => {
  const e = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    occurredAt: new Date().toISOString(),
    kind: "purchase",
    amountCents: 1000,
    currency: "BRL",
    channel: "direct",
  };
  assert.ok(ProductEvent.safeParse(e).success);
  assert.ok(
    !ProductEvent.safeParse({ ...e, email: "private@example.com" }).success,
  );
  assert.ok(!ProductEvent.safeParse({ ...e, amountCents: -10 }).success);
  const raw = JSON.stringify(e),
    stamp = String(Math.floor(Date.now() / 1000)),
    secret = "secret";
  const sig = createHmac("sha256", secret)
    .update(`${stamp}.${raw}`)
    .digest("hex");
  assert.ok(validSignature(raw, stamp, sig, secret));
  assert.ok(!validSignature(raw + " ", stamp, sig, secret));
  assert.ok(!validSignature(raw, stamp, sig, secret, Date.now() + 600000));
});
test("canonical migration matches checked-in SQL", () => {
  assert.equal(
    schema,
    readFileSync(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
});
test("durable scheduling, concurrent claims, kill switch, policies, leases and retries", async () => {
  await init();
  await init();
  assert.equal(await killed(), false);
  await schedule("test-slot");
  await schedule("test-slot");
  assert.equal((await query("SELECT * FROM jobs")).length, 5);
  const p = await policy("director");
  assert.ok(authorize(p, "analyze"));
  assert.ok(!authorize(p, "publish"));
  assert.ok(!authorize({ ...p, daily_budget_cents: 10000 }, "propose", 1));
  assert.ok(!authorize({ ...p, enabled: 0 }, "analyze"));
  await setKill(true);
  assert.equal((await tick()).status, "paused");
  assert.equal((await query("SELECT * FROM decisions")).length, 0);
  await setKill(false);
  const results = await Promise.all(Array.from({ length: 5 }, () => tick()));
  assert.ok(results.every((r) => r.status === "completed"));
  assert.equal((await query("SELECT * FROM decisions")).length, 5);
  assert.equal(
    (await query("SELECT * FROM jobs WHERE status='completed'")).length,
    5,
  );
  assert.equal(
    (await query("SELECT * FROM audit WHERE action='decision_recorded'"))
      .length,
    5,
  );
  assert.equal((await tick()).status, "idle");
  await schedule("denied-slot");
  await query("UPDATE policies SET enabled=0 WHERE agent='director'");
  await query(
    "UPDATE jobs SET due_at='2999-01-01' WHERE id LIKE 'denied-slot:%' AND agent<>'director'",
  );
  const failed = await tick();
  assert.equal(failed.status, "failed");
  const [retry] = await query<{
    attempts: number;
    status: string;
    last_error: string;
  }>("SELECT * FROM jobs WHERE id='denied-slot:director'");
  assert.equal(retry.attempts, 1);
  assert.equal(retry.status, "pending");
  assert.equal(retry.last_error, "policy_denied");
  await query(
    "UPDATE jobs SET status='running',attempts=3,lease_until='2000-01-01' WHERE id='denied-slot:director'",
  );
  // Recover final expired lease.
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(
    (
      await query<{ status: string }>(
        "SELECT status FROM jobs WHERE id='denied-slot:director'",
      )
    )[0].status,
    "failed",
  );
});

test("transactions roll back both state and audit on failure", async () => {
  await init();
  await assert.rejects(
    transaction(async () => {
      await query(
        "INSERT INTO settings(id,value) VALUES ('rollback-test','1')",
      );
      throw new Error("deliberate rollback");
    }),
  );
  assert.equal(
    (await query("SELECT * FROM settings WHERE id='rollback-test'")).length,
    0,
  );
});
