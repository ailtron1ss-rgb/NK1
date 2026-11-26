import assert from "node:assert/strict";
import test from "node:test";
import {
  createAvatarFrameBudgetController,
  resolveAvatarFrameBudget,
  shouldRenderAvatarFrame,
  shouldRunAvatarRenderLoop,
} from "../src/components/avatar/avatarFrameBudget.ts";

test("reduced-motion and data-saver preferences select the low-power budget", () => {
  assert.deepEqual(resolveAvatarFrameBudget({ reducedMotion: true }), {
    tier: "low",
    targetFps: 24,
    maxPixelRatio: 1,
    reason: "reduced-motion",
  });
  assert.deepEqual(resolveAvatarFrameBudget({ saveData: true }), {
    tier: "low",
    targetFps: 24,
    maxPixelRatio: 1,
    reason: "data-saver",
  });
});

test("constrained device hints avoid a high-resolution continuous avatar loop", () => {
  assert.equal(resolveAvatarFrameBudget({ deviceMemoryGiB: 4 }).tier, "low");
  assert.equal(resolveAvatarFrameBudget({ hardwareConcurrency: 4 }).tier, "low");
  assert.equal(resolveAvatarFrameBudget({ deviceMemoryGiB: 2, hardwareConcurrency: 2 }).maxPixelRatio, 1);
});

test("high performance is selected only when both memory and CPU hints are strong", () => {
  assert.deepEqual(resolveAvatarFrameBudget({ deviceMemoryGiB: 8, hardwareConcurrency: 8 }), {
    tier: "high",
    targetFps: 60,
    maxPixelRatio: 2,
    reason: "high-capability",
  });
  assert.equal(resolveAvatarFrameBudget({ deviceMemoryGiB: 16 }).tier, "balanced");
  assert.equal(resolveAvatarFrameBudget({ hardwareConcurrency: 16 }).tier, "balanced");
});

test("unknown and malformed hardware hints fall back to a conservative balanced budget", () => {
  assert.deepEqual(resolveAvatarFrameBudget(), {
    tier: "balanced",
    targetFps: 40,
    maxPixelRatio: 1.5,
    reason: "balanced-default",
  });
  assert.equal(resolveAvatarFrameBudget({ deviceMemoryGiB: Number.NaN, hardwareConcurrency: -1 }).tier, "balanced");
});

test("frame scheduler renders immediately, then respects the selected target cadence", () => {
  const budget = resolveAvatarFrameBudget({ deviceMemoryGiB: 8, hardwareConcurrency: 8 });
  assert.equal(shouldRenderAvatarFrame(100, null, budget), true);
  assert.equal(shouldRenderAvatarFrame(116, 100, budget), false);
  assert.equal(shouldRenderAvatarFrame(117, 100, budget), true);
  assert.equal(shouldRenderAvatarFrame(150, 117, budget), true);
});

test("frame scheduler rejects backwards, negative and non-finite timestamps", () => {
  const budget = resolveAvatarFrameBudget();
  assert.equal(shouldRenderAvatarFrame(-1, null, budget), false);
  assert.equal(shouldRenderAvatarFrame(Number.NaN, null, budget), false);
  assert.equal(shouldRenderAvatarFrame(10, 11, budget), false);
  assert.equal(shouldRenderAvatarFrame(20, 10, { ...budget, targetFps: Number.NaN }), false);
});

test("sustained frame pressure degrades one tier per full sample window", () => {
  const controller = createAvatarFrameBudgetController(
    resolveAvatarFrameBudget({ deviceMemoryGiB: 8, hardwareConcurrency: 8 }),
  );

  for (let i = 0; i < 23; i += 1) assert.equal(controller.recordFrameCost(20), null);
  const first = controller.recordFrameCost(20);
  assert.equal(first?.tier, "balanced");
  assert.equal(first?.targetFps, 40);
  assert.equal(first?.maxPixelRatio, 1.5);
  assert.equal(first?.reason, "runtime-pressure");

  for (let i = 0; i < 24; i += 1) controller.recordFrameCost(20);
  assert.deepEqual(controller.snapshot(), {
    tier: "low",
    targetFps: 24,
    maxPixelRatio: 1,
    reason: "runtime-pressure",
  });
});

test("three healthy windows recover one tier but never exceed the device's starting tier", () => {
  const controller = createAvatarFrameBudgetController(
    resolveAvatarFrameBudget({ deviceMemoryGiB: 8, hardwareConcurrency: 8 }),
  );

  for (let i = 0; i < 24; i += 1) controller.recordFrameCost(20);
  assert.equal(controller.snapshot().tier, "balanced");

  for (let window = 0; window < 2; window += 1) {
    for (let i = 0; i < 24; i += 1) controller.recordFrameCost(3);
    assert.equal(controller.snapshot().tier, "balanced");
  }
  for (let i = 0; i < 24; i += 1) controller.recordFrameCost(3);
  assert.equal(controller.snapshot().tier, "high");
});

test("low-power devices cannot be promoted above their starting budget", () => {
  const controller = createAvatarFrameBudgetController(resolveAvatarFrameBudget({ saveData: true }));
  for (let window = 0; window < 6; window += 1) {
    for (let i = 0; i < 24; i += 1) controller.recordFrameCost(1);
  }
  assert.equal(controller.snapshot().tier, "low");
  assert.equal(controller.snapshot().maxPixelRatio, 1);
});

test("invalid render-cost samples do not advance the adaptive controller", () => {
  const controller = createAvatarFrameBudgetController(
    resolveAvatarFrameBudget({ deviceMemoryGiB: 8, hardwareConcurrency: 8 }),
  );
  for (let i = 0; i < 23; i += 1) controller.recordFrameCost(20);
  controller.recordFrameCost(Number.NaN);
  controller.recordFrameCost(Number.POSITIVE_INFINITY);
  controller.recordFrameCost(-1);
  assert.equal(controller.snapshot().tier, "high");
  assert.equal(controller.recordFrameCost(20)?.tier, "balanced");
});

test("the 3D render loop is active only while the page and avatar are visible", () => {
  assert.equal(shouldRunAvatarRenderLoop(true, true), true);
  assert.equal(shouldRunAvatarRenderLoop(false, true), false);
  assert.equal(shouldRunAvatarRenderLoop(true, false), false);
  assert.equal(shouldRunAvatarRenderLoop(false, false), false);
});
