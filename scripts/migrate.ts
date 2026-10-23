import { init } from "../lib/store";
import { closeDb } from "../lib/db";
await init();
console.log("Database schema ready");
await closeDb();
