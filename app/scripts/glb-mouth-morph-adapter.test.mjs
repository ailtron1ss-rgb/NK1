import assert from "node:assert/strict";
import test from "node:test";
import { resolveGlbMouthMorphWeights } from "../src/components/avatar/glbMouthMorphAdapter.ts";

const dictionary = Object.freeze({
  viseme_aa: 0,
  viseme_oh: 1,
  viseme_ee: 2,
  viseme_ih: 3,
  viseme_ou: 4,
  blink: 5,
  happy: 6,
});

const pose = (viseme, open, form = 0) => ({ viseme, open, form });
const values = (mouthPose, speaking = true, targetDictionary = dictionary) =>
  Object.fromEntries(resolveGlbMouthMorphWeights(targetDictionary, mouthPose, speaking)
    .map(({ index, value }) => [index, value]));

test("open viseme drives aa and neutralizes every other mouth target", () => {
  assert.deepEqual(values(pose("open", 0.6, 0.1)), {
    0: 0.6, 1: 0, 2: 0, 3: 0, 4: 0,
  });
});

test("round viseme chooses ou for a narrow round form and oh for a broader round form", () => {
  assert.deepEqual(values(pose("round", 0.34, -0.46)), {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0.34,
  });
  assert.deepEqual(values(pose("round", 0.34, -0.3)), {
    0: 0, 1: 0.34, 2: 0, 3: 0, 4: 0,
  });
});

test("wide and teeth visemes use ee and ih targets respectively", () => {
  assert.deepEqual(values(pose("wide", 0.25, 0.32)), {
    0: 0, 1: 0, 2: 0.25, 3: 0, 4: 0,
  });
  assert.deepEqual(values(pose("wide", 0.25, 0.2)), {
    0: 0, 1: 0, 2: 0, 3: 0.25, 4: 0,
  });
  assert.deepEqual(values(pose("teeth", 0.14, 0.18)), {
    0: 0, 1: 0, 2: 0, 3: 0.14, 4: 0,
  });
});

test("inactive speech and closed/rest poses reset all mouth channels", () => {
  assert.deepEqual(values(pose("open", 0.8), false), {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
  });
  assert.deepEqual(values(pose("closed", 0.025), true), {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
  });
  assert.deepEqual(values(pose("rest", 0.015), true), {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
  });
});

test("falls back to generic mouth-open targets when specific visemes are absent", () => {
  assert.deepEqual(values(pose("round", 0.4, -0.46), true, { MouthOpen: 0, JawOpen: 1 }), {
    0: 0.4, 1: 0,
  });
  assert.deepEqual(values(pose("open", 0.5), true, { JawOpen: 1 }), { 1: 0.5 });
});

test("does not mutate expression/blink targets or accept malformed indices", () => {
  assert.deepEqual(resolveGlbMouthMorphWeights({ happy: 0, blink: 1, viseme_aa: 1.5 }, pose("open", 0.5), true), []);
  assert.deepEqual(resolveGlbMouthMorphWeights(null, pose("open", 0.5), true), []);
  assert.deepEqual(resolveGlbMouthMorphWeights(dictionary, null, true), []);
  assert.deepEqual(values(pose("open", Number.NaN)), {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0,
  });
});
