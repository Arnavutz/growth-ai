import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshot, meta, instagram, posthog } from "../lib/connectors";
test("simulation never queries external services; official connectors use scoped read endpoints", async () => {
  const original = globalThis.fetch;
  const saved = { ...process.env };
  const requests: { url: URL; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: new URL(String(input)), init });
    return Response.json({ data: [], results: [] });
  };
  try {
    process.env.GROWTH_MODE = "simulation";
    assert.equal((await snapshot()).source, "simulation");
    assert.equal(requests.length, 0);
    Object.assign(process.env, {
      META_GRAPH_VERSION: "v99.0",
      META_AD_ACCOUNT_ID: "act_123",
      META_ACCESS_TOKEN: "test-token-not-real",
      INSTAGRAM_ACCOUNT_ID: "456",
      POSTHOG_PERSONAL_API_KEY: "test-key-not-real",
      POSTHOG_PROJECT_ID: "123",
      POSTHOG_API_HOST: "https://eu.posthog.com",
    });
    await meta.read();
    await instagram.read();
    await posthog.read();
    assert.equal(requests.length, 3);
    assert.equal(requests[0].url.hostname, "graph.facebook.com");
    assert.equal(requests[0].url.pathname, "/v99.0/act_123/insights");
    assert.ok(!requests[0].url.searchParams.has("access_token"));
    assert.equal(requests[0].init?.method, undefined);
    assert.ok(
      !requests[1].url.searchParams.get("fields")?.includes("username"),
    );
    assert.ok(!requests[1].url.searchParams.get("fields")?.includes("caption"));
    assert.equal(requests[2].url.hostname, "eu.posthog.com");
    assert.equal(requests[2].init?.method, "POST");
    assert.ok(String(requests[2].init?.body).includes("GROUP BY event"));
    process.env.POSTHOG_API_HOST = "http://untrusted.invalid";
    await assert.rejects(posthog.read(), /Unsupported/);
    process.env.META_AD_ACCOUNT_ID = "../../campaign";
    await assert.rejects(meta.read(), /Invalid/);
  } finally {
    globalThis.fetch = original;
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
