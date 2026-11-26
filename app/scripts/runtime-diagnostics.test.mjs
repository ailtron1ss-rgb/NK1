import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeRecovery, readFiniteMetric, safeRecord } from "../src/organism/runtimeDiagnostics.ts";

test("parses a redacted action recovery queue without inventing actions", () => {
  const rows = parseRuntimeRecovery({
    recovery: [{ id: "op-1", toolId: "browser.click", status: "uncertain", reasonCode: "receipt-missing", outcomeClass: "unknown" }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "op-1");
  assert.equal(rows[0].action, "browser.click");
  assert.equal(rows[0].status, "uncertain");
  assert.equal(rows[0].reason, "receipt-missing");
  assert.equal(rows[0].outcome, "unknown");
});

test("supports wrapped recovery collections and bounds the visible queue", () => {
  const rows = parseRuntimeRecovery({ recovery: { items: Array.from({ length: 80 }, (_, i) => ({ id: String(i), status: "pending" })) } });
  assert.equal(rows.length, 64);
});

test("ignores malformed recovery records", () => {
  assert.deepEqual(parseRuntimeRecovery({ recovery: [null, 2, {}, { id: "x", action: " " }] }).map(x => x.id), ["recovery-2", "x"]);
});

test("does not interpret strings or non-finite values as operational metrics", () => {
  assert.equal(readFiniteMetric(0.5), 0.5);
  assert.equal(readFiniteMetric("0.5"), null);
  assert.equal(readFiniteMetric(Number.NaN), null);
  assert.deepEqual(safeRecord({ status: "ok" }), { status: "ok" });
  assert.equal(safeRecord([]), null);
});
