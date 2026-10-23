import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
if (process.env.GROWTH_MODE === "live") {
  console.log(
    "Live mode: use environment bindings; no local credentials generated.",
  );
} else {
  try {
    await writeFile(
      ".env.local",
      `GROWTH_MODE=simulation\nDATABASE_PATH=.data/growth.sqlite\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nDASHBOARD_PASSWORD=${randomBytes(24).toString("hex")}\nINGEST_SIGNING_SECRET=${randomBytes(32).toString("hex")}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Created ignored .env.local with unique simulation credentials. Configure your password locally; values are not logged.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    console.log("Existing .env.local preserved.");
  }
}
