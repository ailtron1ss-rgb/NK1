import assert from "node:assert/strict";
import test from "node:test";
import { snapshotPollDelayMs } from "../src/organism/pollingSchedule.ts";

test("background polling uses the base interval while healthy", () => {
  assert.equal(snapshotPollDelayMs(0), 1400);
});

test("transport failures back off exponentially and recover within a bound", () => {
  assert.equal(snapshotPollDelayMs(1), 2800);
  assert.equal(snapshotPollDelayMs(2), 5600);
  assert.equal(snapshotPollDelayMs(3), 11200);
  assert.equal(snapshotPollDelayMs(10), 30000);
  assert.equal(snapshotPollDelayMs(100), 30000);
});

test("custom bounds are validated and clamped", () => {
  assert.equal(snapshotPollDelayMs(2, 1000, 5000), 4000);
  assert.equal(snapshotPollDelayMs(5, 1000, 5000), 5000);
  assert.equal(snapshotPollDelayMs(2, -1, -1), 5600);
  assert.equal(snapshotPollDelayMs(Number.NaN), 1400);
});
