import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Original 2D asset validator accepts the honest empty production inventory", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-original-2d-assets.mjs"], {
    cwd: appRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /24 slots; 0 authored\/in progress; 24 not authored/);
});
