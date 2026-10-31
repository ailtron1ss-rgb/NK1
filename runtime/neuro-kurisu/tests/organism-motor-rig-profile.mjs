import assert from "node:assert/strict";
import { OrganismMotorRuntime } from "../src/organism/body/OrganismMotorRuntime.ts";

const profile = {
  schemaVersion: 1, profileId: "kurisu.vrm3d.runtime-v1", modelId: "kurisu-vrm-test", revision: 1, renderer: "vrm3d",
  coordinateFrame: { handedness: "right", upAxis: "y", forwardAxis: "-z", positionUnit: "meters", angleUnit: "radians" },
  calibration: { status: "calibrated", evidenceId: "test.runtime.evidence", calibratedAt: "2026-10-30T12:00:00.000Z", verifierVersion: "runtime-test-v1" },
  joints: [{
    id: "head.yaw", role: "head.yaw", parentId: null, minAngleRad: -0.7, maxAngleRad: 0.7, restAngleRad: 0,
    maxSpeedRadPerSec: 1.5, maxAccelerationRadPerSec2: 6, maxJerkRadPerSec3: 60,
    geometry: { offset: { x: 0, y: 1.5, z: 0 }, axis: { x: 0, y: 1, z: 0 } },
    binding: { targetId: "J_Bip_C_Head", targetKind: "humanoid-bone", component: "y", scale: 1, offset: 0,
      minValue: -0.7, maxValue: 0.7, fidelity: "direct", requiredInFrame: true }
  }]
};
const runtime = new OrganismMotorRuntime();
const rejected = structuredClone(profile); rejected.calibration = { status: "test-fixture" };
assert.throws(() => runtime.configureRigProfile(rejected), /not-production-calibrated/);
assert.equal(runtime.diagnostics().configured, false);
runtime.configureRigProfile(profile);
assert.equal(runtime.diagnostics().activeRigProfileId, profile.profileId);
assert.equal(runtime.diagnostics().activeRenderer, "vrm3d");
const goal = runtime.submitApprovedGoal({
  id: "head-turn-01", action: "look", source: "organism", priority: 40, confidence01: 0.9,
  createdAtMs: 0, targetJointAnglesRad: { "head.yaw": 0.25 }, reason: "approved test goal"
}, 0);
assert.equal(goal.accepted, true);
const frame = runtime.advance(100);
assert.equal(frame.goalId, "head-turn-01");
const commands = runtime.rendererCommandsForFrame(frame);
assert.equal(commands.ok, true);
assert.equal(commands.batch.commands[0].targetId, "J_Bip_C_Head");
runtime.configureSkeleton([{ id: "head.yaw", minAngleRad: -0.7, maxAngleRad: 0.7, restAngleRad: 0, maxSpeedRadPerSec: 1 }]);
assert.equal(runtime.diagnostics().activeRigProfileId, null);
assert.equal(runtime.rendererCommandsForFrame(frame).reason, "renderer-profile-not-configured");
console.log("Organism motor rig profile integration: calibration gate, configure, approved-goal projection and stale-binding reset passed.");
