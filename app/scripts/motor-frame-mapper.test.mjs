import assert from "node:assert/strict";
import test from "node:test";
import { mapMotorFrameToSemanticPose } from "../src/components/avatar/motorFrameMapper.ts";

const frame = (overrides = {}) => ({
  version: 1, tick: 7, atMs: 120, goalId: "goal-7", action: "reach",
  phase: "moving", completion01: 0.4, reason: "in-progress",
  reachedJointIds: [], blockedJointIds: [],
  joints: {
    left_elbow: { id: "left_elbow", angleRad: 0.25, targetAngleRad: 1.1, velocityRadPerSec: 0.2, accelerationRadPerSec2: 0.1, available: true },
    right_elbow: { id: "right_elbow", angleRad: -0.5, targetAngleRad: -0.8, velocityRadPerSec: 0, accelerationRadPerSec2: 0, available: true },
    unavailable_joint: { id: "unavailable_joint", angleRad: 0.2, targetAngleRad: 0.3, velocityRadPerSec: 0, accelerationRadPerSec2: 0, available: false },
    extra_joint: { id: "extra_joint", angleRad: 0.1, targetAngleRad: 0.1, velocityRadPerSec: 0, accelerationRadPerSec2: 0, available: true },
  },
  ...overrides,
});
const profile = {
  schemaVersion: 1, calibrationId: "vrm-rig-sha256:abc123",
  mappings: [
    { jointId: "left_elbow", channel: "leftElbow", scale: 2, offset: 0.1, min: -1, max: 1 },
    { jointId: "right_elbow", channel: "rightElbow", scale: 1, offset: 0, min: -0.4, max: 0.4 },
    { jointId: "unavailable_joint", channel: "leftWrist", scale: 1, offset: 0, min: -1, max: 1 },
  ],
};

test("maps measured motor angles through explicit calibration, not target intent", () => {
  const result = mapMotorFrameToSemanticPose(frame(), profile);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.pose, { leftElbow: 0.6, rightElbow: -0.4 });
  assert.deepEqual(result.mappedJointIds, ["left_elbow", "right_elbow"]);
  assert.deepEqual(result.unavailableJointIds, ["unavailable_joint"]);
  assert.deepEqual(result.unmappedJointIds, ["extra_joint"]);
  assert.equal(result.cursor.tick, 7);
  assert.equal(result.rendererPoseVerified, false);
});

test("rejects stale, duplicate, rewound and over-age frames", () => {
  assert.equal(mapMotorFrameToSemanticPose(frame(), profile, { previous: { tick: 7, atMs: 120 } }).reason, "stale-or-rewound-motor-frame");
  assert.equal(mapMotorFrameToSemanticPose(frame({ tick: 8, atMs: 119 }), profile, { previous: { tick: 7, atMs: 120 } }).reason, "stale-or-rewound-motor-frame");
  assert.equal(mapMotorFrameToSemanticPose(frame(), profile, { nowMs: 300, maxAgeMs: 100 }).reason, "stale-motor-frame");
  assert.equal(mapMotorFrameToSemanticPose(frame(), profile, { nowMs: 100, maxAgeMs: 100 }).reason, "stale-motor-frame");
});

test("fails closed on invalid frames, terminal phases and malformed calibration", () => {
  assert.equal(mapMotorFrameToSemanticPose(frame({ tick: -1 }), profile).reason, "invalid-motor-frame");
  assert.equal(mapMotorFrameToSemanticPose(frame({ phase: "expired" }), profile).reason, "motor-frame-not-executable");
  assert.equal(mapMotorFrameToSemanticPose(frame(), { ...profile, mappings: [...profile.mappings, profile.mappings[0]] }).reason, "invalid-motor-mapping-profile");
  assert.equal(mapMotorFrameToSemanticPose(frame(), { ...profile, mappings: [{ ...profile.mappings[0], scale: 0 }] }).reason, "invalid-motor-mapping-profile");
});

test("a valid frame without a mapped joint is accepted as an empty, explicit sample", () => {
  const result = mapMotorFrameToSemanticPose(frame({ joints: {} }), profile);
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "motor-frame-has-no-calibrated-joints");
  assert.deepEqual(result.pose, {});
});
