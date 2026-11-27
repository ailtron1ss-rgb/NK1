import assert from "node:assert/strict";
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
  const publishTimes = [33, 66, 99, 132, 165, 198, 231, 264, 297, 330];
  let lastStepAt = 0;
  const steppedAt = [];
  for (const now of publishTimes) {
    if (shouldStepAvatarBodyMotion(now, lastStepAt)) {
      steppedAt.push(now);
      lastStepAt = now;
    }
  }
  assert.deepEqual(steppedAt, [66, 132, 198, 264, 330]);
  assert.ok(steppedAt.length > 0);
});

test("non-monotonic and non-finite timestamps fail closed", () => {
  assert.equal(shouldStepAvatarBodyMotion(999, 1000), false);
  assert.equal(shouldStepAvatarBodyMotion(Number.NaN, 1000), false);
  assert.equal(shouldStepAvatarBodyMotion(1050, Number.POSITIVE_INFINITY), false);
});
