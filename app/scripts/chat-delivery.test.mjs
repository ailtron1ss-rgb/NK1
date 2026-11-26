import assert from "node:assert/strict";
import test from "node:test";
import { withChatDeliveryStatus } from "../src/organism/chatDelivery.ts";

const turns = [
  { id: "user-1", role: "user", text: "first", at: 1, tick: 1 },
  { id: "assistant-1", role: "kurisu", text: "answer", at: 2, tick: 2 },
  { id: "user-2", role: "user", text: "second", at: 3, tick: 3 },
];

test("updates only the matching user turn with a delivery outcome", () => {
  const next = withChatDeliveryStatus(turns, "user-2", "sent");
  assert.deepEqual(next[0], turns[0]);
  assert.deepEqual(next[1], turns[1]);
  assert.equal(next[2].delivery, "sent");
});

test("keeps an unconfirmed result distinct from a delivered message", () => {
  const next = withChatDeliveryStatus(turns, "user-1", "unknown");
  assert.equal(next[0].delivery, "unknown");
  assert.equal(next[1].delivery, undefined);
});

test("does not mutate the original chat array or turn objects", () => {
  const next = withChatDeliveryStatus(turns, "user-1", "sending");
  assert.notEqual(next, turns);
  assert.equal(turns[0].delivery, undefined);
  assert.equal(next[0].delivery, "sending");
});

test("keeps deterministic request rejection distinct from uncertain transport outcomes", () => {
  const next = withChatDeliveryStatus(turns, "user-2", "rejected");
  assert.equal(next[2].delivery, "rejected");
});

test("a missing id and an assistant id are no-ops", () => {
  assert.deepEqual(withChatDeliveryStatus(turns, "missing", "unknown"), turns);
  assert.deepEqual(withChatDeliveryStatus(turns, "assistant-1", "unknown"), turns);
});
