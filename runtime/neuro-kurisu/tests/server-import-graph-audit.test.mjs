import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const auditor = fileURLToPath(new URL("../scripts/audit-server-imports.mjs", import.meta.url));

test("server import audit traverses the transitive graph and resolves every local edge", () => {
  const result = spawnSync(process.execPath, [auditor], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, String(result.stdout) + "\n" + String(result.stderr));

  const start = result.stdout.indexOf("{");
  const end = result.stdout.lastIndexOf("}");
  assert.ok(start >= 0 && end > start, "auditor must emit a JSON report");
  const report = JSON.parse(result.stdout.slice(start, end + 1));

  assert.equal(report.check, "server-transitive-relative-imports");
  assert.ok(report.checkedFiles > 1, "audit must traverse beyond the server entry point");
  assert.ok(report.checkedEdges >= report.checkedFiles - 1, "reachable graph must contain enough edges to reach every checked file");
  assert.equal(report.unresolvedCount, 0, JSON.stringify(report.unresolved, null, 2));
  console.log(result.stdout.trim());
});
