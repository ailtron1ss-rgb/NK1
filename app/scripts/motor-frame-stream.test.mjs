import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMotorFrameEnvelope,
  parseMotorFrameStatusEnvelope,
} from "../src/components/avatar/motorFrameStream.ts";

const command = {
  jointId: "head.yaw", role: "head.yaw", targetId: "head",
  targetKind: "depth-rig-node", component: "rotation", value: 18,
  valueUnit: "degrees", fidelity: "direct", clamped: false,
};
function envelope(overrides = {}) {
  return JSON.stringify({
    ok: true, configured: true, readOnly: true,
    frame: { version: 1, tick: 7, atMs: 350, phase: "moving", joints: {} },
    rendererCommands: {
      ok: true, reason: "renderer-command-batch-ready",
      batch: {
        version: 1, profileId: "kurisu.depth.v1", modelId: "kurisu-depth-rig",
        renderer: "depth2d", frameTick: 7, frameAtMs: 350, goalId: "gesture-01",
        commands: [command], unmappedFrameJointIds: [], clampedJointIds: [],
      },
    },
    ...overrides,
  });
}

test("accepts only a calibrated command batch bound to the requested depth rig and exact frame", () => {
  const result = parseMotorFrameEnvelope(envelope(), "depth2d", "kurisu-depth-rig");
  assert.equal(result.state, "ready");
  assert.equal(result.batch.commands[0].component, "rotation");
  assert.equal(result.batch.commands[0].valueUnit, "degrees");
  assert.equal(result.batch.frameTick, 7);
});

test("rejects a renderer, model, frame tick, target kind or unit mismatch", () => {
  assert.equal(parseMotorFrameEnvelope(envelope(), "vrm3d", "kurisu-depth-rig").state, "invalid");
  assert.equal(parseMotorFrameEnvelope(envelope(), "depth2d", "another-rig").reason,
    "renderer-command-batch-invalid-or-model-mismatch");
  const stale = JSON.parse(envelope());
  stale.rendererCommands.batch.frameTick = 6;
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(stale), "depth2d", "kurisu-depth-rig").state, "invalid");
  const wrongTarget = JSON.parse(envelope());
  wrongTarget.rendererCommands.batch.commands[0].targetKind = "humanoid-bone";
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(wrongTarget), "depth2d", "kurisu-depth-rig").state, "invalid");
  const wrongUnit = JSON.parse(envelope());
  wrongUnit.rendererCommands.batch.commands[0].valueUnit = "radians";
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(wrongUnit), "depth2d", "kurisu-depth-rig").state, "invalid");
});

test("rejects duplicate channels, non-finite values and over-sized payloads", () => {
  const duplicate = JSON.parse(envelope());
  duplicate.rendererCommands.batch.commands.push({ ...command, jointId: "head.pitch" });
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(duplicate), "depth2d", "kurisu-depth-rig").state, "invalid");
  const nonFinite = JSON.parse(envelope());
  nonFinite.rendererCommands.batch.commands[0].value = null;
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(nonFinite), "depth2d", "kurisu-depth-rig").state, "invalid");
  assert.equal(parseMotorFrameEnvelope("x".repeat(270000), "depth2d", "kurisu-depth-rig").reason,
    "invalid-sse-json");
});

test("keeps controller-unconfigured distinct from profile-not-registered", () => {
  const unconfigured = parseMotorFrameEnvelope(JSON.stringify({
    ok: true, configured: false, readOnly: true, frame: null, rendererCommands: null,
  }), "depth2d", "kurisu-depth-rig");
  assert.equal(unconfigured.state, "unconfigured");
  const noProfile = parseMotorFrameEnvelope(JSON.stringify({
    ok: true, configured: true, readOnly: true,
    frame: { tick: 1, atMs: 10 },
    rendererCommands: { ok: false, reason: "renderer-profile-not-configured", batch: null },
  }), "depth2d", "kurisu-depth-rig");
  assert.equal(noProfile.state, "unmapped");
});

test("reports matching calibrated profiles from the initial SSE status without fabricating a frame", () => {
  const status = parseMotorFrameStatusEnvelope(JSON.stringify({
    configured: true, hasFrame: false,
    registeredProfiles: [{ renderer: "depth2d", modelId: "kurisu-depth-rig", calibrated: true }],
  }), "depth2d", "kurisu-depth-rig");
  assert.equal(status.state, "waiting");
  assert.equal(status.batch, null);
  const missing = parseMotorFrameStatusEnvelope(JSON.stringify({
    configured: true, hasFrame: false, registeredProfiles: [],
  }), "depth2d", "kurisu-depth-rig");
  assert.equal(missing.state, "unmapped");
});

function live2dEnvelope(overrides = {}) {
  const cubismCommand = {
    jointId: "head.yaw", role: "head.yaw", targetId: "ParamAngleX",
    targetKind: "cubism-parameter", component: "value", value: 12,
    valueUnit: "parameter", fidelity: "approximate", clamped: false,
  };
  return JSON.stringify({
    ok: true, configured: true, readOnly: true,
    frame: { version: 1, tick: 8, atMs: 400, phase: "moving", joints: {} },
    rendererCommands: {
      ok: true, reason: "renderer-command-batch-ready",
      batch: {
        version: 1, profileId: "kurisu.live2d.v1", modelId: "kurisu-live2d-balanced-v1",
        renderer: "live2d", frameTick: 8, frameAtMs: 400, goalId: "gaze",
        commands: [cubismCommand], unmappedFrameJointIds: [], clampedJointIds: [],
      },
    },
    ...overrides,
  });
}

test("accepts only an allow-listed, model-bound Cubism parameter MotorFrame", () => {
  const accepted = parseMotorFrameEnvelope(live2dEnvelope(), "live2d", "kurisu-live2d-balanced-v1");
  assert.equal(accepted.state, "ready");
  assert.equal(accepted.batch.commands[0].targetId, "ParamAngleX");
  assert.equal(accepted.batch.commands[0].valueUnit, "parameter");
  const invalidTarget = JSON.parse(live2dEnvelope());
  invalidTarget.rendererCommands.batch.commands[0].targetId = "window.location";
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(invalidTarget), "live2d", "kurisu-live2d-balanced-v1").state, "invalid");
  const invalidRange = JSON.parse(live2dEnvelope());
  invalidRange.rendererCommands.batch.commands[0].value = 101;
  assert.equal(parseMotorFrameEnvelope(JSON.stringify(invalidRange), "live2d", "kurisu-live2d-balanced-v1").state, "invalid");
  assert.equal(parseMotorFrameEnvelope(live2dEnvelope(), "live2d", "kurisu-live2d-mobile-v1").state, "invalid");
});
