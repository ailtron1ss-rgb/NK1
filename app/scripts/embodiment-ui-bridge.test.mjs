import assert from "node:assert/strict";
import test from "node:test";
import { emptySnapshot } from "../src/organism/types.ts";
import { validateSemanticBodyState } from "../src/components/avatar/embodimentSwitch.ts";
import {
  advanceBodySwitch,
  beginBodySwitch,
  capabilitiesForMode,
  projectSemanticBodyState,
} from "../src/components/avatar/embodimentUiBridge.ts";

const baseInput = () => ({
  snapshot: emptySnapshot(),
  revision: 7,
  monotonicMs: 12_345,
  headTilt: 0.25,
  gaze: { x: 0.2, y: -0.1 },
  speechPhase: "speaking",
  speechEventId: "speech-1",
  audioTimeMs: 420,
  mouth: { open: 0.35, form: -0.2, viseme: "round" },
});

test("projects a valid semantic body state from the canonical snapshot", () => {
  const state = projectSemanticBodyState(baseInput());
  assert.equal(validateSemanticBodyState(state), true, "projected state must satisfy the shared validator");
  assert.equal(state.revision, 7);
  assert.equal(state.capturedAtMonotonicMs, 12_345);
  assert.equal(state.speech.eventId, "speech-1");
  assert.equal(state.speech.phase, "speaking");
  assert.equal(state.speech.audioTimeMs, 420);
  assert.equal(state.action, "wait");
  assert.equal(state.gaze.x, 0.2);
  assert.equal(state.gaze.y, -0.1);
  assert.equal(state.pose.headRoll, 0.25);
  assert.equal(state.pose.headYaw, undefined);
  assert.ok(capabilitiesForMode("live2d").channels.includes("headRoll"));
  assert.ok(!capabilitiesForMode("live2d").channels.includes("headYaw"));
});

test("clamps out-of-range numeric inputs instead of emitting an invalid snapshot", () => {
  const input = baseInput();
  input.headTilt = 9;
  input.gaze = { x: -4, y: 7 };
  input.mouth = { open: 3, form: -9, viseme: "open" };
  input.audioTimeMs = -50;
  input.monotonicMs = Number.NaN;
  input.revision = -3;
  const state = projectSemanticBodyState(input);
  assert.equal(validateSemanticBodyState(state), true);
  assert.equal(state.pose.headRoll, 1);
  assert.equal(state.pose.headYaw, undefined);
  assert.equal(state.gaze.x, -1);
  assert.equal(state.gaze.y, 1);
  assert.equal(state.speech.mouthOpen, 1);
  assert.equal(state.speech.mouthForm, -1);
  assert.equal(state.speech.audioTimeMs, 0);
  assert.equal(state.capturedAtMonotonicMs, 0);
  assert.equal(state.revision, 0);
});

test("drops an over-long speech event id rather than emitting invalid state", () => {
  const input = baseInput();
  input.speechEventId = "x".repeat(200);
  const state = projectSemanticBodyState(input);
  assert.equal(state.speech.eventId, null);
  assert.equal(validateSemanticBodyState(state), true);
});

test("maps every organism emotion label to a supported expression channel", () => {
  const labels = ["curiosity", "calm", "joy", "anxiety", "frustration", "sadness", "anger", "protective"];
  for (const label of labels) {
    const snapshot = emptySnapshot();
    snapshot.emotion = { ...snapshot.emotion, label };
    const state = projectSemanticBodyState({ ...baseInput(), snapshot });
    assert.equal(validateSemanticBodyState(state), true, `label ${label} must project to a valid state`);
    assert.ok(capabilitiesForMode("live2d").expressions.includes(state.emotion), `label ${label} must map to a declared expression`);
  }
});

test("reports 2D renderers honestly: no skeletal channels are claimed", () => {
  for (const mode of ["live2d", "original", "legacy"]) {
    const caps = capabilitiesForMode(mode);
    assert.equal(caps.mode, "live2d", `${mode} is a 2D renderer`);
    for (const channel of caps.channels) {
      assert.ok(["headRoll", "gazeX", "gazeY", "breath"].includes(channel), `${mode} claims an unexpected channel ${channel}`);
    }
  }
});

test("plans a live2d -> 3d handoff preserving the snapshot and reporting neutral rebind", () => {
  const state = projectSemanticBodyState(baseInput());
  const { plan, progress } = beginBodySwitch("live2d", "3d", state);
  assert.equal(plan.from, "live2d");
  assert.equal(plan.to, "vrm3d");
  assert.equal(plan.stateRevision, 7);
  assert.equal(plan.requiresNeutralRebind, true);
  assert.deepEqual(plan.preserved.speech, state.speech);
  assert.deepEqual(plan.preserved.gaze, state.gaze);
  assert.equal(progress.committed, false);
  assert.equal(progress.progress, 0);
  assert.ok(plan.supportedPose.gazeX !== undefined, "shared gaze channel must survive the handoff");
});

test("cross-mode handoff between two distinct 2D renderers still reports a rebind", () => {
  const state = projectSemanticBodyState(baseInput());
  const { plan } = beginBodySwitch("original", "legacy", state);
  assert.equal(plan.from, "live2d");
  assert.equal(plan.to, "live2d");
  assert.equal(plan.requiresNeutralRebind, true, "different renderer ids must not be treated as the same body");
});

test("switching to the same renderer commits immediately without a rebind", () => {
  const state = projectSemanticBodyState(baseInput());
  const { plan, progress } = beginBodySwitch("3d", "3d", state);
  assert.equal(plan.requiresNeutralRebind, false);
  assert.equal(progress.committed, true);
});

test("crossfade progress is monotonic, bounded and robust to invalid timing", () => {
  let p = { progress: 0, committed: false };
  p = advanceBodySwitch(p, 100, 300);
  assert.ok(p.progress > 0 && p.progress < 1);
  assert.equal(p.committed, false);
  const stale = advanceBodySwitch(p, 50, 300);
  assert.equal(stale.progress, p.progress, "a stale frame must not move progress backwards");
  p = advanceBodySwitch(p, 1000, 300);
  assert.equal(p.progress, 1);
  assert.equal(p.committed, true);
  assert.equal(advanceBodySwitch(p, Number.NaN, 0).progress, 1, "invalid timing keeps the high-water mark");
});
