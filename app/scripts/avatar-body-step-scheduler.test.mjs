import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  AVATAR_BODY_MOTION_STEP_INTERVAL_MS,
  shouldStepAvatarBodyMotion,
} from "../src/components/avatar/avatarBodyStepScheduler.ts";

test("body motion is held below the 20 Hz step interval", () => {
  assert.equal(AVATAR_BODY_MOTION_STEP_INTERVAL_MS, 50);
  assert.equal(shouldStepAvatarBodyMotion(1049, 1000), false);
});

test("body motion advances exactly at the 20 Hz interval", () => {
  assert.equal(shouldStepAvatarBodyMotion(1050, 1000), true);
  assert.equal(shouldStepAvatarBodyMotion(1100, 1000), true);
});

test("the scheduler depends on elapsed time rather than a particle tick modulus", () => {
  // requestAnimationFrame is ~60 Hz; physics state is emitted at 20 Hz.
  const publishTimes = [16, 33, 50, 66, 83, 100, 116, 133, 150, 166, 183, 200];
  let lastStepAt = 0;
  const steppedAt = [];
  for (const now of publishTimes) {
    if (shouldStepAvatarBodyMotion(now, lastStepAt)) {
      steppedAt.push(now);
      lastStepAt = now;
    }
  }
  assert.deepEqual(steppedAt, [50, 100, 150, 200]);
  assert.ok(steppedAt.length > 0);
});

test("non-monotonic and non-finite timestamps fail closed", () => {
  assert.equal(shouldStepAvatarBodyMotion(999, 1000), false);
  assert.equal(shouldStepAvatarBodyMotion(Number.NaN, 1000), false);
  assert.equal(shouldStepAvatarBodyMotion(1050, Number.POSITIVE_INFINITY), false);
});

test("AvatarStage uses the 20 Hz scheduler for the actual physics loop", () => {
  const stage = readFileSync(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /import \{ shouldStepAvatarBodyMotion \} from "\.\/avatar\/avatarBodyStepScheduler"/);
  assert.match(stage, /if \(shouldStepAvatarBodyMotion\(now, lastStepAt\)\) \{/);
  assert.match(stage, /stepAvatarArticulatedBody\([\s\S]*?deltaMs/);
  assert.match(stage, /lastStepAt = now;/);
  assert.doesNotMatch(stage, /if \(deltaMs >= 33\)/);
});
