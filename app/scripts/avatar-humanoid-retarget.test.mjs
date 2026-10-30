import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHumanoidRetargetProfile,
  inverseQuaternion,
  multiplyQuaternion,
  normalizeQuaternion,
  retargetLocalRotations,
  retargetRootTranslation,
} from "../src/components/avatar/humanoidRetarget.ts";

const identity = [0, 0, 0, 1];
const zQuarter = [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
const rig = ({ roles = ["hips", "spine", "head"], height = 1, lengths = {} } = {}) => ({
  roleToNode: new Map(roles.map((role, index) => [role, index + 10])),
  restLocalRotation: new Map(roles.map((role) => [role, identity])),
  boneLength: new Map(Object.entries(lengths)),
  height,
});

test("quaternion normalization and inverse are stable for non-unit and degenerate inputs", () => {
  assert.deepEqual(normalizeQuaternion([0, 0, 0, 0]), identity);
  const q = normalizeQuaternion([0, 0, 2, 2]);
  const product = multiplyQuaternion(q, inverseQuaternion(q));
  assert.ok(Math.abs(product[0]) < 1e-8);
  assert.ok(Math.abs(product[1]) < 1e-8);
  assert.ok(Math.abs(product[2]) < 1e-8);
  assert.ok(Math.abs(product[3] - 1) < 1e-8);
});

test("profile maps shared semantic roles and reports target omissions", () => {
  const profile = buildHumanoidRetargetProfile(
    rig({ roles: ["hips", "spine", "head", "leftupperarm"], height: 1.7, lengths: { leftupperarm: 0.3 } }),
    rig({ roles: ["hips", "spine", "head"], height: 1.9 }),
  );
  assert.deepEqual(profile.sharedRoles, ["head", "hips", "spine"]);
  assert.deepEqual(profile.missingTargetRoles, ["leftupperarm"]);
  assert.ok(Math.abs(profile.heightScale - 1.9 / 1.7) < 1e-8);
});

test("rest-pose normalization preserves target rest when source pose equals source rest", () => {
  const profile = buildHumanoidRetargetProfile(rig(), {
    roleToNode: new Map([["hips", 1]]),
    restLocalRotation: new Map([["hips", zQuarter]]),
    height: 1.8,
  });
  const output = retargetLocalRotations(profile, new Map([["hips", identity]]));
  assert.deepEqual(output.get("hips"), normalizeQuaternion(zQuarter));
});

test("source rotation delta is transferred relative to the target rest pose", () => {
  const profile = buildHumanoidRetargetProfile(rig({ roles: ["head"] }), {
    roleToNode: new Map([["head", 4]]),
    restLocalRotation: new Map([["head", zQuarter]]),
    height: 1,
  });
  const output = retargetLocalRotations(profile, new Map([["head", zQuarter]]));
  const expected = multiplyQuaternion(zQuarter, zQuarter);
  assert.deepEqual(output.get("head"), expected);
});

test("rotation safety cap bounds the transferred delta", () => {
  const profile = buildHumanoidRetargetProfile(rig({ roles: ["head"] }), rig({ roles: ["head"] }));
  const output = retargetLocalRotations(profile, new Map([["head", zQuarter]]), { maxRotationRadians: Math.PI / 6 });
  const q = output.get("head");
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q[3])));
  assert.ok(angle <= Math.PI / 6 + 1e-8);
});

test("root translation scales with avatar height and clamps extreme displacement", () => {
  const profile = buildHumanoidRetargetProfile(rig({ height: 1 }), rig({ height: 2 }));
  assert.deepEqual(retargetRootTranslation([0.2, 0.1, 0], profile), [0.4, 0.2, 0]);
  const bounded = retargetRootTranslation([10, 0, 0], profile, 0.75);
  assert.ok(Math.abs(Math.hypot(...bounded) - 0.75) < 1e-8);
});

test("invalid dimensions and missing source pose fail closed without NaN output", () => {
  const profile = buildHumanoidRetargetProfile(rig({ height: 0 }), rig({ height: Number.NaN }));
  const output = retargetLocalRotations(profile, new Map([["hips", [Number.NaN, 0, 0, 1]]]));
  for (const q of output.values()) assert.ok(q.every(Number.isFinite));
  assert.deepEqual(retargetRootTranslation([Number.NaN, 1, 2], profile, 10), [0, 1, 2]);
});
