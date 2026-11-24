import assert from "node:assert/strict";
import test from "node:test";
import { shouldApplyUiSnapshot } from "../src/organism/snapshotSync.ts";

const stamp = (overrides = {}) => ({
  version: "nk1-test",
  schemaVersion: 225,
  tick: 10,
  at: 1_000,
  ...overrides,
});

test("accepts the first valid canonical snapshot", () => {
  assert.equal(shouldApplyUiSnapshot(stamp(), null, 1, 1), true);
});

test("rejects an older request even when it finishes after a newer request", () => {
  assert.equal(shouldApplyUiSnapshot(stamp({ tick: 20, at: 2_000 }), stamp(), 1, 2), false);
});

test("rejects a stale backend timestamp for the same runtime version", () => {
  assert.equal(shouldApplyUiSnapshot(stamp({ tick: 99, at: 999 }), stamp(), 2, 2), false);
});

test("rejects tick regression when timestamps are equal", () => {
  assert.equal(shouldApplyUiSnapshot(stamp({ tick: 9, at: 1_000 }), stamp(), 2, 2), false);
});

test("allows an idempotent snapshot and a newer timestamp after a runtime restart", () => {
  assert.equal(shouldApplyUiSnapshot(stamp(), stamp(), 2, 2), true);
  assert.equal(shouldApplyUiSnapshot(stamp({ tick: 1, at: 1_001 }), stamp(), 2, 2), true);
});

test("a runtime schema/version change is accepted only when its timestamp is not older", () => {
  assert.equal(shouldApplyUiSnapshot(stamp({ version: "nk1-next", tick: 1, at: 1_001 }), stamp(), 2, 2), true);
  assert.equal(shouldApplyUiSnapshot(stamp({ schemaVersion: 226, at: 999 }), stamp(), 2, 2), false);
});

test("rejects malformed timestamps, ticks, schema versions and request identities", () => {
  assert.equal(shouldApplyUiSnapshot(stamp({ at: Number.NaN }), null, 1, 1), false);
  assert.equal(shouldApplyUiSnapshot(stamp({ tick: -1 }), null, 1, 1), false);
  assert.equal(shouldApplyUiSnapshot(stamp({ schemaVersion: 0 }), null, 1, 1), false);
  assert.equal(shouldApplyUiSnapshot(stamp(), null, 0, 1), false);
  assert.equal(shouldApplyUiSnapshot(stamp(), null, 2, 1), false);
});
