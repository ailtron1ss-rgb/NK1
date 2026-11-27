import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Vite forwards the health panel to the canonical organism runtime", async () => {
  const vite = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../../runtime/neuro-kurisu/src/server/server.mjs", import.meta.url), "utf8");
  assert.match(vite, /["']\/api\/health["']\s*:\s*\{\s*target:\s*["']http:\/\/127\.0\.0\.1:3310["']/s);
  assert.match(runtime, /url\.pathname === ['"]\/api\/health['"]/);
  assert.match(runtime, /reason:\s*['"]public-health['"]/);
});
