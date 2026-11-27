import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as dynamics from "../src/components/avatar/avatarNeuroAdaptiveDynamics.ts";

const baseFrame = {
  deltaSeconds: 1 / 60,
  awake: true,
  energy: 0.8,
  arousal: 0.45,
  cognitiveLoad: 0.25,
  uncertainty: 0.2,
  curiosity: 0.55,
  novelty: 0.3,
  predictionError: 0.15,
  action: "respond",
  quality: "high",
  bodyChannels: { headYaw: 0.35, headPitch: -0.1, torsoYaw: 0.25, torsoPitch: 0.12, rootYaw: 0.18, breath: 0.4, leftShoulder: -0.25, rightShoulder: 0.3 },
};

test("semantic role resolver animates only authored hair, garment and sleeve bones, never face or core skeleton", () => {
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("hairLockTipL")?.role, "hair");
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("coatHemPanel_R")?.role, "garment");
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("leftSleeveFollow")?.role, "sleeve");
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("NK1_NeuralFiber_02")?.role, "neural-fiber");
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("hairLockRoot"), null);
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("head"), null);
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("leftUpperArm"), null);
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("jaw"), null);
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("coatHemPanel")?.side, 0);
  assert.equal(dynamics.resolveAvatarDynamicsBoneRole("coatHemPanel_R")?.side, 1);
});

test("spring dynamics produce bounded, smoothed offsets for authored hair and cloth bones", () => {
  const solver = new dynamics.AvatarNeuroAdaptiveDynamics();
  const bones = [{ key: "hair", name: "hairLockTipL" }, { key: "cloth", name: "coatHemPanel_R" }];
  const first = solver.step(bones, baseFrame);
  assert.ok(first.get("hair"));
  assert.ok(first.get("cloth"));
  const start = first.get("hair").x;
  let later = first;
  for (let index = 0; index < 90; index += 1) later = solver.step(bones, baseFrame);
  const moved = later.get("hair");
  assert.notEqual(moved.x, start);
  assert.ok(Math.abs(moved.x) <= 0.06 && Math.abs(moved.y) <= 0.06 && Math.abs(moved.z) <= 0.06);
  const garment = later.get("cloth");
  assert.ok(Math.abs(garment.x) <= 0.09 && Math.abs(garment.y) <= 0.09 && Math.abs(garment.z) <= 0.09);
});

test("secondary motion is deterministic and duplicate bone names remain independently addressable", () => {
  const bones = [{ key: "strand-a", name: "hairFringeLeft" }, { key: "strand-b", name: "hairFringeLeft" }];
  const left = new dynamics.AvatarNeuroAdaptiveDynamics();
  const right = new dynamics.AvatarNeuroAdaptiveDynamics();
  let leftFrame;
  let rightFrame;
  for (let index = 0; index < 24; index += 1) {
    leftFrame = left.step(bones, baseFrame);
    rightFrame = right.step(bones, baseFrame);
  }
  assert.deepEqual([...leftFrame], [...rightFrame]);
  assert.ok(leftFrame.has("strand-a") && leftFrame.has("strand-b"));
});

test("sleep, low quality and reset reduce or clear secondary motion safely", () => {
  const solver = new dynamics.AvatarNeuroAdaptiveDynamics();
  const bones = [{ key: "hair", name: "hairLockTip" }];
  let active;
  for (let index = 0; index < 60; index += 1) active = solver.step(bones, baseFrame);
  const activeMagnitude = Math.hypot(active.get("hair").x, active.get("hair").y, active.get("hair").z);
  let asleep;
  for (let index = 0; index < 90; index += 1) asleep = solver.step(bones, { ...baseFrame, awake: false, action: "rest", bodyChannels: {} });
  const asleepMagnitude = Math.hypot(asleep.get("hair").x, asleep.get("hair").y, asleep.get("hair").z);
  assert.ok(asleepMagnitude < activeMagnitude);
  solver.reset();
  assert.equal(solver.snapshot().activeBones, 0);
  const low = solver.step(bones, { ...baseFrame, quality: "low" });
  assert.ok(Math.hypot(low.get("hair").x, low.get("hair").y, low.get("hair").z) < activeMagnitude);
});

test("neuroadaptive morphs affect only explicitly named non-facial targets that exist", () => {
  const dictionary = { NK1_Cloth_Sway: 0, NK1_Hair_Sway: 1, NK1_Tissue_Breath: 2, NK1_Neural_Pulse: 3, happy: 4, jawOpen: 5 };
  const weights = dynamics.resolveNeuroAdaptiveMorphWeights(dictionary, baseFrame);
  assert.deepEqual(weights.map((item) => item.index), [0, 1, 2, 3]);
  for (const item of weights) assert.ok(item.value >= 0 && item.value <= 1);
  assert.deepEqual(dynamics.resolveNeuroAdaptiveMorphWeights({ happy: 0, jawOpen: 1 }, baseFrame), []);
  assert.deepEqual(dynamics.resolveNeuroAdaptiveMorphWeights({ NK1_Cloth_Sway: "0" }, baseFrame), []);
});

test("neural garment emission is bounded and follows organism state without changing authored color", () => {
  const calm = dynamics.resolveNeuroAdaptiveNeuralMultiplier({ ...baseFrame, arousal: 0.05, curiosity: 0.05, novelty: 0.05, predictionError: 0.05 });
  const curious = dynamics.resolveNeuroAdaptiveNeuralMultiplier({ ...baseFrame, arousal: 0.85, curiosity: 0.95, novelty: 0.8, predictionError: 0.65 });
  const asleep = dynamics.resolveNeuroAdaptiveNeuralMultiplier({ ...baseFrame, awake: false });
  assert.ok(curious > calm);
  assert.ok(asleep < curious);
  for (const value of [calm, curious, asleep]) assert.ok(value >= 0.75 && value <= 1.65);
});

test("invalid frame values and extreme time steps remain bounded", () => {
  const solver = new dynamics.AvatarNeuroAdaptiveDynamics();
  const bones = [{ key: "cloth", name: "capeTailTip" }];
  const result = solver.step(bones, { ...baseFrame, deltaSeconds: 50, energy: Number.NaN, bodyChannels: { torsoYaw: Infinity } });
  const offset = result.get("cloth");
  assert.ok(offset);
  for (const value of [offset.x, offset.y, offset.z]) assert.ok(Number.isFinite(value) && Math.abs(value) <= 0.09);
});

test("Three.js stage consumes the canonical frame and only applies tagged secondary layers", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /new AvatarNeuroAdaptiveDynamics\(\)/);
  assert.match(stage, /adaptiveDynamics\.step\(/);
  assert.match(stage, /adaptiveDynamics\.reset\(\)/);
  assert.match(stage, /resolveNeuroAdaptiveMorphWeights\(/);
  assert.match(stage, /collectAvatarNeuralMaterials\(/);
  assert.match(stage, /resolveAvatarDynamicsBoneRole\(n\)/);
  assert.match(stage, /resolveNeuroAdaptiveNeuralMultiplier\(/);
});
