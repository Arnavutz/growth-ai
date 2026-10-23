import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "growth-browser-"));
const base = "http://localhost:3188";
const password = randomBytes(24).toString("hex");
const env = {
  ...process.env,
  GROWTH_MODE: "simulation",
  APP_ORIGIN: base,
  DATABASE_PATH: join(dir, "browser.sqlite"),
  DASHBOARD_PASSWORD: password,
  SESSION_SECRET: randomBytes(32).toString("hex"),
};
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3188"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
server.stdout.on("data", (v) => {
  logs += v;
});
server.stderr.on("data", (v) => {
  logs += v;
});
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ??
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no workspace" }).click();
  await page
    .getByRole("heading", { name: "Crescimento, sob controle." })
    .waitFor();
  await page.getByText("R$ 19.136", { exact: true }).waitFor();
  mkdirSync(".data/artifacts", { recursive: true });
  await page.screenshot({
    path: ".data/artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Executar análise" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Análises na fila" })
    .waitFor();
  await page.getByRole("button", { name: "Conteúdo", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Apresentação do produto");
  await page
    .locator("textarea")
    .fill("Demonstração do benefício com convite para conhecer o produto.");
  await page.getByRole("button", { name: "Salvar para aprovação" }).click();
  await page
    .getByRole("heading", { name: "Apresentação do produto" })
    .waitFor();
  await page.getByRole("button", { name: "Aprovar proposta" }).click();
  await page.getByText("approved", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Políticas", exact: true }).click();
  await page.getByRole("button", { name: "Pausar toda operação" }).click();
  await page.getByRole("button", { name: "Retomar operação" }).waitFor();
  assert.ok(
    await page.getByRole("button", { name: "Executar análise" }).isDisabled(),
  );
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".data/artifacts/dashboard-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "No mobile horizontal overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Chromium desktop/mobile — login, dashboard, scheduling, content approval, kill switch, responsive layout, no client errors",
  );
} catch (e) {
  console.error(logs);
  throw e;
} finally {
  await browser.close();
  server.kill("SIGTERM");
  await new Promise<void>((r) => {
    if (server.exitCode !== null) r();
    else server.once("exit", () => r());
  });
  rmSync(dir, { recursive: true, force: true });
}
