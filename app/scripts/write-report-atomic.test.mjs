import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeTextAtomically } from "./write-report-atomic.mjs";

function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), "report-atomic-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("atomic report writer publishes complete UTF-8 contents and replaces the previous report", (t) => {
  const root = workspace(t);
  const target = join(root, "reports", "verdict.json");
  writeTextAtomically(target, JSON.stringify({ run: 1, label: "Курису" }));
  assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { run: 1, label: "Курису" });

  writeTextAtomically(target, JSON.stringify({ run: 2, ok: true }));
  assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { run: 2, ok: true });
  assert.deepEqual(readdirSync(join(root, "reports")), ["verdict.json"]);
});

test("temporary file is private by default", (t) => {
  const root = workspace(t);
  const target = join(root, "verdict.json");
  writeTextAtomically(target, "{}\n");
  assert.equal(statSync(target).mode & 0o777, 0o600);
});

test("failed rename preserves the previous report and removes its temporary file", (t) => {
  const root = workspace(t);
  const target = join(root, "verdict.json");
  writeFileSync(target, '{"old":true}\n');
  const renameFailure = () => {
    throw Object.assign(new Error("simulated atomic rename failure"), { code: "EIO" });
  };

  assert.throws(
    () => writeTextAtomically(target, '{"new":true}\n', { renameSync: renameFailure }),
    /simulated atomic rename failure/,
  );
  assert.equal(readFileSync(target, "utf8"), '{"old":true}\n');
  assert.deepEqual(readdirSync(root), ["verdict.json"]);
});

test("writer rejects an empty destination and non-string contents", () => {
  assert.throws(() => writeTextAtomically("", "{}"), /non-empty path/);
  assert.throws(() => writeTextAtomically("report.json", { ok: true }), /must be a string/);
});
