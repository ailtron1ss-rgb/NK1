import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runtimeRoot = fileURLToPath(new URL("..", import.meta.url));
const auditor = fileURLToPath(new URL("../scripts/audit-architecture.mjs", import.meta.url));

test("architecture audit rejects forbidden runtime/UI/research/legacy dependency directions", () => {
  const result = spawnSync(process.execPath, [auditor], {
    cwd: runtimeRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(
    result.status,
    0,
    "architecture audit failed:\n" + String(result.stdout) + "\n" + String(result.stderr),
  );
  assert.match(result.stdout, /CLEAN_ARCHITECTURE=PASS/);
  assert.doesNotMatch(result.stdout, /dependency boundary violations|canonical leakage|import cycles detected|missing relative imports/);
  console.log(result.stdout.trim());
});
