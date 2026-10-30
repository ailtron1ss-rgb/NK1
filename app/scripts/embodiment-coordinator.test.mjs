import assert from "node:assert/strict";
import test from "node:test";
import { EmbodimentSwitchCoordinator } from "../src/components/avatar/embodimentCoordinator.ts";

const snapshot = { schemaVersion: 1, revision: 7, capturedAtMonotonicMs: 100,
  emotion: "curiosity", emotionIntensity: 0.7, expression: "thinking",
  gaze: { x: 0.1, y: -0.1, targetId: "focus" },
  speech: { eventId: "speech-7", phase: "speaking", audioTimeMs: 450, mouthOpen: 0.4, mouthForm: 0.1 },
  action: "explain", intentId: "intent-7", pose: { headYaw: 0.2 }, wardrobeId: "lab-coat" };

function adapter(id, options = {}) {
  const calls = [];
  const value = {
    id, mode: id === "live" ? "live2d" : "vrm3d", calls,
    async prepare(state, signal) { calls.push("prepare"); assert.equal(state.revision, 7); if (options.prepare) await options.prepare(signal); },
    async apply(state) {
      calls.push("apply");
      if (options.apply) return options.apply(state);
      return { adapterId: id, stateRevision: state.revision, appliedAtMonotonicMs: 200,
        acceptedChannels: ["headYaw"], rejectedChannels: [], executionId: id + "-execution" };
    },
    async verify(receipt) {
      calls.push("verify");
      if (options.verify) return options.verify(receipt);
      return { verified: true, stateRevision: receipt.stateRevision, observedAtMonotonicMs: 220,
        observedChannels: ["headYaw"], mismatches: [] };
    },
    async dispose() { calls.push("dispose"); },
  };
  return value;
}

test("commits only after destination apply receipt and independent verification", async () => {
  const source = adapter("live"), target = adapter("vrm");
  const events = [];
  const coordinator = new EmbodimentSwitchCoordinator(source, event => events.push(event.phase));
  const result = await coordinator.switchTo(target, snapshot);
  assert.equal(result.status, "committed");
  assert.equal(coordinator.activeAdapterId, "vrm");
  assert.deepEqual(target.calls, ["prepare", "apply", "verify"]);
  assert.deepEqual(source.calls, ["dispose"]);
  assert.ok(events.indexOf("verifying") < events.indexOf("committed"));
});

test("verification failure disposes destination and restores the source", async () => {
  const source = adapter("live");
  const target = adapter("vrm", { verify: async receipt => ({
    verified: false, stateRevision: receipt.stateRevision, observedAtMonotonicMs: 220,
    observedChannels: [], mismatches: ["headYaw"], reason: "pose-not-observed",
  }) });
  const coordinator = new EmbodimentSwitchCoordinator(source);
  const result = await coordinator.switchTo(target, snapshot);
  assert.equal(result.status, "rolled-back");
  assert.equal(coordinator.activeAdapterId, "live");
  assert.deepEqual(target.calls, ["prepare", "apply", "verify", "dispose"]);
  assert.deepEqual(source.calls, ["apply", "verify"]);
});

test("rejects stale revisions without touching either adapter", async () => {
  const source = adapter("live"), target = adapter("vrm");
  const coordinator = new EmbodimentSwitchCoordinator(source);
  const result = await coordinator.switchTo(target, { ...snapshot, revision: -1 });
  assert.equal(result.status, "failed");
  assert.equal(result.reason, "stale-or-invalid-state-revision");
  assert.deepEqual(source.calls, []);
  assert.deepEqual(target.calls, []);
});

test("prevents overlapping switches while a destination is preparing", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const source = adapter("live");
  const target = adapter("vrm", { prepare: () => gate });
  const second = adapter("other");
  const coordinator = new EmbodimentSwitchCoordinator(source);
  const firstPromise = coordinator.switchTo(target, snapshot);
  await Promise.resolve();
  assert.equal(coordinator.isSwitching, true);
  const secondResult = await coordinator.switchTo(second, snapshot);
  assert.equal(secondResult.status, "failed");
  assert.equal(secondResult.reason, "switch-in-progress");
  release();
  assert.equal((await firstPromise).status, "committed");
  assert.equal(coordinator.activeAdapterId, "vrm");
});
