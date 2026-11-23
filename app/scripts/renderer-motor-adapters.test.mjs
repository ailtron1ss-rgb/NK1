import assert from "node:assert/strict";
import test from "node:test";
import { resolveVrmArmIntent } from "../src/components/avatar/rendererMotorAdapters.ts";

const plan = (action, gesture = true) => ({
  action,
  motionGroup: "TapBody",
  motionIndex: 0,
  headTilt: 0.04,
  gesture,
  reason: "test",
});
const neutralFrame = {
  emotion: "calm",
  speaking: false,
  awake: true,
  cognitiveLoad: 0,
  socialNeed: 0,
  guardedness: 0,
};

test("VRM adapter maps explain, inspect, reflect and respond from the shared motor plan", () => {
  assert.deepEqual(resolveVrmArmIntent(plan("explain"), neutralFrame), {
    leftArmIntent: 0.08, rightArmIntent: -0.68,
  });
  assert.deepEqual(resolveVrmArmIntent(plan("inspect"), neutralFrame), {
    leftArmIntent: -0.23, rightArmIntent: -0.45,
  });
  assert.deepEqual(resolveVrmArmIntent(plan("reflect"), neutralFrame), {
    leftArmIntent: -0.1, rightArmIntent: 0.18,
  });
  assert.deepEqual(resolveVrmArmIntent(plan("respond"), { ...neutralFrame, speaking: true }), {
    leftArmIntent: -0.25, rightArmIntent: 0.42,
  });
});

test("rest and listen never invent a gesture even when the affect is activated", () => {
  for (const action of ["rest", "listen"]) {
    assert.deepEqual(resolveVrmArmIntent(plan(action), {
      ...neutralFrame,
      emotion: "anger",
      speaking: true,
    }), { leftArmIntent: 0, rightArmIntent: 0 });
  }
});

test("anger modifier, gesture damping and sleep regulation stay bounded", () => {
  assert.deepEqual(resolveVrmArmIntent(plan("respond"), {
    ...neutralFrame,
    emotion: "anger",
  }), { leftArmIntent: -0.64, rightArmIntent: 0.64 });

  const damped = resolveVrmArmIntent(plan("explain", false), neutralFrame);
  assert.ok(Math.abs(damped.leftArmIntent - 0.028) < 1e-9);
  assert.ok(Math.abs(damped.rightArmIntent + 0.238) < 1e-9);

  const asleep = resolveVrmArmIntent(plan("explain"), { ...neutralFrame, awake: false });
  assert.ok(Math.abs(asleep.leftArmIntent - 0.02) < 1e-9);
  assert.ok(Math.abs(asleep.rightArmIntent + 0.17) < 1e-9);
});

test("non-finite affect input cannot escape the normalized bone range", () => {
  const result = resolveVrmArmIntent(plan("explain"), {
    ...neutralFrame,
    emotion: "anxiety",
    cognitiveLoad: Number.POSITIVE_INFINITY,
    socialNeed: Number.NaN,
    guardedness: Number.POSITIVE_INFINITY,
  });
  assert.ok(Number.isFinite(result.leftArmIntent));
  assert.ok(Number.isFinite(result.rightArmIntent));
  assert.ok(result.leftArmIntent >= -0.85 && result.leftArmIntent <= 0.85);
  assert.ok(result.rightArmIntent >= -0.85 && result.rightArmIntent <= 0.85);
});
