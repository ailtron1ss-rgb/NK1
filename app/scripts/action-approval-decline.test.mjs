import assert from "node:assert/strict";
import test from "node:test";
import {
  ActionDeclinedError,
  decideActionApproval,
  getActionApprovalSnapshot,
  waitForActionApproval,
} from "../src/neuro-kurisu/action-approval-broker.ts";

test("an explicit owner decline rejects the original request with a typed 403 outcome", async () => {
  const id = "approval-test-decline-0001";
  let attempted = null;
  const pending = waitForActionApproval({
    id,
    toolId: "http.voice.listen",
    permissionClass: "microphone-input",
    operation: "direct",
    reasonCode: "explicit approval",
    expiresAt: Date.now() + 60_000,
    inputKeys: [],
    inputPreview: {},
    requestPath: "/api/organism/voice/listen",
    label: "Access microphone input",
    execute: async (approved) => {
      attempted = approved;
      return { ok: true };
    },
  });

  assert.equal(getActionApprovalSnapshot().find((card) => card.id === id)?.stage, "pending");
  await decideActionApproval(id, false);
  await assert.rejects(pending, (error) =>
    error instanceof ActionDeclinedError
      && error.status === 403
      && error.code === "ACTION_DECLINED"
  );
  assert.equal(attempted, false);
  assert.equal(getActionApprovalSnapshot().find((card) => card.id === id)?.stage, "declined");
});

test("declined approval is not treated as an executed action", async () => {
  const id = "approval-test-decline-0002";
  let sideEffectCount = 0;
  const pending = waitForActionApproval({
    id,
    toolId: "http.voice.turn",
    permissionClass: "voice-conversation-turn",
    operation: "direct",
    reasonCode: "explicit approval",
    expiresAt: Date.now() + 60_000,
    requestPath: "/api/organism/voice/turn",
    label: "Voice conversation turn",
    execute: async (approved) => {
      if (approved) sideEffectCount += 1;
      return null;
    },
  });
  await decideActionApproval(id, false);
  await assert.rejects(pending, ActionDeclinedError);
  assert.equal(sideEffectCount, 0);
});
