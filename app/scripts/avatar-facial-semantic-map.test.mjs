import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFacialBindings,
  composeFacialWeights,
  mapFacialWeightsToTargets,
  resolveFacialSemantic,
} from "../src/components/avatar/facialSemanticMap.ts";

test("resolves VRM 0.x, VRM 1.0 and common GLB morph aliases", () => {
  assert.equal(resolveFacialSemantic("Joy"), "happy");
  assert.equal(resolveFacialSemantic("happy"), "happy");
  assert.equal(resolveFacialSemantic("blink_L"), "blinkLeft");
  assert.equal(resolveFacialSemantic("vrc.v_aa"), "aa");
  assert.equal(resolveFacialSemantic("viseme_O"), "oh");
  assert.equal(resolveFacialSemantic("unknown_custom_shape"), undefined);
});

test("builds deterministic semantic bindings and rejects malformed indices", () => {
  const bindings = buildFacialBindings([
    { name: "Joy", index: 3 },
    { name: "happy", index: 4 },
    { name: "blink_L", index: 5 },
    { name: "not-a-face-channel", index: 6 },
    { name: "blink_R", index: -1 },
  ]);
  const bySemantic = new Map(bindings.map((item) => [item.semantic, item]));
  assert.equal(bySemantic.get("happy")?.target.index, 4);
  assert.equal(bySemantic.get("blinkLeft")?.target.index, 5);
  assert.equal(bySemantic.has("blinkRight"), false);
});

test("speech visemes override expression mouth shapes but preserve eye expressions", () => {
  const weights = composeFacialWeights(
    [{ semantic: "aa", weight: 0.2 }, { semantic: "happy", weight: 0.8 }, { semantic: "blink", weight: 1.4 }],
    [{ semantic: "aa", weight: 0.9 }, { semantic: "ih", weight: 0.4 }],
  );
  assert.equal(weights.get("aa"), 0.9);
  assert.equal(weights.get("ih"), 0.4);
  assert.equal(weights.get("happy"), 0.8);
  assert.equal(weights.get("blink"), 1);
});

test("maps semantic weights to bounded morph indices", () => {
  const bindings = buildFacialBindings([
    { name: "A", index: 2 },
    { name: "blink", index: 7 },
  ]);
  const result = mapFacialWeightsToTargets(bindings, new Map([
    ["aa", Number.POSITIVE_INFINITY],
    ["blink", 0.65],
  ]));
  assert.equal(result.has(2), false);
  assert.equal(result.get(7), 0.65);
});
