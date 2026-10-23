import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { mode, required } from "./config";
let sqlite: DatabaseSync | undefined;
let pool: pg.Pool | undefined;
const context = new AsyncLocalStorage<{
  client?: pg.PoolClient;
  sqlite?: boolean;
}>();
let tail: Promise<unknown> = Promise.resolve();
function postgres() {
  return Boolean(process.env.DATABASE_URL) || mode() === "live";
}
function getPool() {
  return (pool ??= new pg.Pool({
    connectionString: required("DATABASE_URL"),
    max: 5,
  }));
}
function getSqlite() {
  if (process.env.VERCEL)
    throw new Error(
      "Vercel requires persistent DATABASE_URL even in simulation",
    );
  if (!sqlite) {
    const path = resolve(
      /* turbopackIgnore: true */ process.env.DATABASE_PATH ??
        ".data/growth.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true });
    sqlite = new DatabaseSync(path);
    sqlite.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
    );
  }
  return sqlite;
}
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = tail.then(fn, fn);
  tail = next.catch(() => {});
  return next;
}
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  if (postgres())
    return (await (context.getStore()?.client ?? getPool()).query(sql, params))
      .rows as T[];
  const execute = async () =>
    getSqlite()
      .prepare(sql.replace(/\$\d+/g, "?"))
      .all(...params) as T[];
  return context.getStore()?.sqlite ? execute() : exclusive(execute);
}
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (context.getStore()) return fn();
  if (postgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await context.run({ client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  return exclusive(async () => {
    const db = getSqlite();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run({ sqlite: true }, fn);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
}
export async function closeDb() {
  await tail;
  sqlite?.close();
  sqlite = undefined;
  await pool?.end();
  pool = undefined;
}
