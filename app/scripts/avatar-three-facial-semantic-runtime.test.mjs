import assert from "node:assert/strict";
import test from "node:test";
import {
  applyThreeFacialSemanticWeights,
  bindThreeFacialMorphTargets,
} from "../src/components/avatar/threeFacialSemanticRuntime.ts";

function fakeRoot(nodes) {
  return { traverse(visitor) { for (const node of nodes) visitor(node); } };
}

test("binds semantic morph channels per mesh and ignores malformed indices", () => {
  const faceA = {
    morphTargetDictionary: { happy: 0, viseme_aa: 1, blink_L: 2, custom: 3, invalid: 9 },
    morphTargetInfluences: [0, 0, 0, 0.37],
  };
  const faceB = {
    morphTargetDictionary: { Joy: 0, viseme_O: 1 },
    morphTargetInfluences: [0, 0],
  };
  const bindings = bindThreeFacialMorphTargets(fakeRoot([faceA, faceB]));
  assert.equal(bindings.length, 5);
  assert.equal(bindings.filter((item) => item.object === faceA).length, 3);
  assert.equal(bindings.filter((item) => item.object === faceB).length, 2);
});

test("applies emotion, blink and speech visemes without touching custom channels", () => {
  const face = {
    morphTargetDictionary: { happy: 0, viseme_aa: 1, blink: 2, custom: 3 },
    morphTargetInfluences: [0, 0, 0, 0.42],
  };
  const bindings = bindThreeFacialMorphTargets(fakeRoot([face]));
  applyThreeFacialSemanticWeights(bindings, {
    happy: 0.72,
    aa: 0.15,
    blink: 0.9,
  }, [{ semantic: "aa", weight: 0.88 }]);

  assert.deepEqual(face.morphTargetInfluences, [0.72, 0.88, 0.9, 0.42]);
});

test("resets previously owned channels when the next frame has no expression", () => {
  const face = {
    morphTargetDictionary: { happy: 0, viseme_aa: 1 },
    morphTargetInfluences: [0.8, 0.6],
  };
  const bindings = bindThreeFacialMorphTargets(fakeRoot([face]));
  applyThreeFacialSemanticWeights(bindings, {});
  assert.deepEqual(face.morphTargetInfluences, [0, 0]);
});

test("ignores a disposed or shortened morph influence array safely", () => {
  const face = {
    morphTargetDictionary: { happy: 0 },
    morphTargetInfluences: [0],
  };
  const bindings = bindThreeFacialMorphTargets(fakeRoot([face]));
  face.morphTargetInfluences = [];
  assert.doesNotThrow(() => applyThreeFacialSemanticWeights(bindings, { happy: 1 }));
});
