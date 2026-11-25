import assert from "node:assert/strict";
import test from "node:test";
import { recoverPendingChatTurns } from "../src/organism/chatRecovery.ts";

test("marks a user request still sending at reload as unknown", () => {
  const turns = [
    { id: "u1", role: "user", text: "request", at: 1, tick: 1, delivery: "sending" },
    { id: "u2", role: "user", text: "sent", at: 2, tick: 2, delivery: "sent" },
    { id: "a1", role: "kurisu", text: "reply", at: 3, tick: 3 },
  ];
  const recovered = recoverPendingChatTurns(turns);
  assert.equal(recovered[0].delivery, "unknown");
  assert.equal(recovered[1].delivery, "sent");
  assert.equal(recovered[2].delivery, undefined);
});

test("does not mutate the persisted input array", () => {
  const turns = [{ id: "u1", role: "user", text: "request", at: 1, tick: 1, delivery: "sending" }];
  const recovered = recoverPendingChatTurns(turns);
  assert.notEqual(recovered, turns);
  assert.equal(turns[0].delivery, "sending");
  assert.equal(recovered[0].delivery, "unknown");
});

test("does not change explicit rejected or unknown results", () => {
  const turns = [
    { id: "u1", role: "user", text: "request", at: 1, tick: 1, delivery: "rejected" },
    { id: "u2", role: "user", text: "request", at: 2, tick: 2, delivery: "unknown" },
  ];
  const recovered = recoverPendingChatTurns(turns);
  assert.equal(recovered[0].delivery, "rejected");
  assert.equal(recovered[1].delivery, "unknown");
});
