import { schedule } from "../lib/store";
import { tick } from "../lib/worker";
import { closeDb } from "../lib/db";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const once = process.argv.includes("--once");
do {
  try {
    await schedule();
    const result = await tick();
    if (once && result.status === "failed") process.exitCode = 1;
    console.log(JSON.stringify({ time: new Date().toISOString(), ...result }));
  } catch {
    console.error(
      JSON.stringify({
        time: new Date().toISOString(),
        status: "worker_error",
      }),
    );
    if (once) {
      process.exitCode = 1;
      break;
    }
  }
  if (!once && !stopping) await new Promise((r) => setTimeout(r, 2000));
} while (!once && !stopping);
await closeDb();
