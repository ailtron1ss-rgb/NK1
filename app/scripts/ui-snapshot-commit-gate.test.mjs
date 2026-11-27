import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createUiSnapshotCommitGate } from "../src/organism/uiSnapshotCommitGate.ts";

test("a late older snapshot cannot overwrite a newer committed organism revision", async () => {
  const gate = createUiSnapshotCommitGate();
  const state = { tick: 0, marker: "empty" };
  let resolveOlder;
  const olderResponse = new Promise(resolve => { resolveOlder = resolve; });

  const olderTicket = gate.begin();
  const newerTicket = gate.begin();

  assert.equal(gate.commit(newerTicket, () => {
    state.tick = 42;
    state.marker = "newer";
  }), true);

  resolveOlder({ tick: 41 });
  const olderPayload = await olderResponse;
  const committed = gate.commit(olderTicket, () => {
    state.tick = olderPayload.tick;
    state.marker = "older";
  });

  assert.equal(committed, false);
  assert.deepEqual(state, { tick: 42, marker: "newer" });
});

test("only the latest in-flight snapshot request may commit or report an error", () => {
  const gate = createUiSnapshotCommitGate();
  const state = { tick: 0, error: null };

  const first = gate.begin();
  const second = gate.begin();

  assert.equal(gate.commit(first, () => { state.tick = 1; }), false);
  assert.equal(gate.commit(first, () => { state.error = "stale failure"; }), false);
  assert.equal(gate.commit(second, () => { state.tick = 2; }), true);
  assert.deepEqual(state, { tick: 2, error: null });
});

test("a newer request invalidates an older request even before the newer one completes", () => {
  const gate = createUiSnapshotCommitGate();
  const oldTicket = gate.begin();
  const newTicket = gate.begin();

  assert.equal(gate.isCurrent(oldTicket), false);
  assert.equal(gate.isCurrent(newTicket), true);
});

test("all canonical UI snapshot entry points use the same commit gate", async () => {
  const store = await readFile(new URL("../src/organism/store.ts", import.meta.url), "utf8");
  assert.equal((store.match(/snapshotCommitGate\.begin\(\)/g) || []).length, 4);
  assert.ok((store.match(/snapshotCommitGate\.commit\(/g) || []).length >= 8);
  assert.match(store, /if \(!committed\) return;/);
});
