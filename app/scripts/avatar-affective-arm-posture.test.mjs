import assert from "node:assert/strict";
import test from "node:test";
import { deriveAffectiveArmPosture } from "../src/components/avatar/affectiveArmPosture.ts";

const base = { baseLeft: -0.2, baseRight: 0.3, armOpenness: 0.5, shoulderTension: 0.2, gestureAmplitude: 0.5, stillness: 0.1, dominance: 0.5 };

test("affect modulates motor targets continuously without selecting a gesture", () => {
  const quiet = deriveAffectiveArmPosture({ ...base, gestureAmplitude: 0.1 });
  const expressive = deriveAffectiveArmPosture({ ...base, gestureAmplitude: 0.9 });
  assert.ok(Math.abs(expressive.left) > Math.abs(quiet.left));
  assert.ok(Math.abs(expressive.right) > Math.abs(quiet.right));
});

test("openness and guardedness produce opposing continuous arm biases", () => {
  const open = deriveAffectiveArmPosture({ ...base, armOpenness: 1, shoulderTension: 0 });
  const guarded = deriveAffectiveArmPosture({ ...base, armOpenness: 0, shoulderTension: 1 });
  assert.ok(open.left < guarded.left);
  assert.ok(open.right > guarded.right);
});

test("stillness settles toward neutral without replacing the planner target", () => {
  const active = deriveAffectiveArmPosture({ ...base, stillness: 0 });
  const still = deriveAffectiveArmPosture({ ...base, stillness: 1 });
  assert.ok(Math.abs(still.left) < Math.abs(active.left));
  assert.ok(Math.abs(still.right) < Math.abs(active.right));
});

test("dominance introduces bounded asymmetry rather than a fixed pose", () => {
  const low = deriveAffectiveArmPosture({ ...base, dominance: 0 });
  const high = deriveAffectiveArmPosture({ ...base, dominance: 1 });
  assert.notEqual(low.left - low.right, high.left - high.right);
});

test("malformed and extreme inputs remain finite and bounded", () => {
  const result = deriveAffectiveArmPosture({ ...base, baseLeft: Infinity, baseRight: -Infinity, armOpenness: NaN, shoulderTension: 99, gestureAmplitude: -99, stillness: NaN, dominance: 100 });
  for (const value of Object.values(result)) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= -0.85 && value <= 0.85);
  }
});
