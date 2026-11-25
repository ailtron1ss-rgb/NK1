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

test("discards malformed local cache rows and keeps the newest bounded window", () => {
  const recovered = recoverPendingChatTurns([
    null,
    "bad row",
    { id: "missing-role", text: "x", at: 1, tick: 1 },
    { id: "bad-clock", role: "user", text: "x", at: "1", tick: 1 },
    ...Array.from({ length: 130 }, (_, index) => ({
      id: "u" + index, role: "user", text: "message", at: index, tick: index, delivery: "sent",
    })),
  ]);
  assert.equal(recovered.length, 120);
  assert.equal(recovered[0].id, "u10");
  assert.equal(recovered[119].id, "u129");
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
