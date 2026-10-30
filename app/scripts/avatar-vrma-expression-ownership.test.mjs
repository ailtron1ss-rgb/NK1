import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  advanceVrmaExpressionOwnership,
  beginVrmaExpressionOwnershipTransition,
  getProtectedVrmaExpressionKeys,
  getVrmaSpeechVisemeKeys,
} from "../src/components/avatar/vrmaExpressionOwnership.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("clip entry protects incoming VRMA expression channels during fade-in", () => {
  const state = beginVrmaExpressionOwnershipTransition([], ["happy", "blink"], 0.22);
  assert.deepEqual(state.activeExpressionKeys, ["happy", "blink"]);
  assert.deepEqual(state.transitionExpressionKeys, ["happy", "blink"]);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(state)].sort(), ["blink", "happy"]);
});

test("clip switching protects outgoing and incoming channels, then releases outgoing ownership", () => {
  const initial = beginVrmaExpressionOwnershipTransition(["happy", "blink"], ["sad", "blink"], 0.2);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(initial)].sort(), ["blink", "happy", "sad"]);
  const midway = advanceVrmaExpressionOwnership(initial, 0.08);
  assert.ok(Math.abs(midway.expressionTransitionRemaining - 0.12) < 1e-9);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(midway)].sort(), ["blink", "happy", "sad"]);
  const finished = advanceVrmaExpressionOwnership(midway, 0.2);
  assert.equal(finished.expressionTransitionRemaining, 0);
  assert.deepEqual(finished.transitionExpressionKeys, []);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(finished)].sort(), ["blink", "sad"]);
});

test("stopping a clip retains its outgoing facial channels only for the fade-out window", () => {
  const stopping = beginVrmaExpressionOwnershipTransition(["aa", "happy"], [], 0.15);
  assert.deepEqual(stopping.activeExpressionKeys, []);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(stopping)].sort(), ["aa", "happy"]);
  const stopped = advanceVrmaExpressionOwnership(stopping, 0.15);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(stopped)], []);
});

test("zero-duration transitions release old ownership immediately", () => {
  const state = beginVrmaExpressionOwnershipTransition(["happy"], ["sad"], 0);
  assert.deepEqual(state.transitionExpressionKeys, []);
  assert.deepEqual([...getProtectedVrmaExpressionKeys(state)], ["sad"]);
});

test("invalid keys and non-finite or negative frame deltas are normalized safely", () => {
  const state = beginVrmaExpressionOwnershipTransition([" happy ", "", "happy", null], ["sad"], Number.NaN);
  assert.deepEqual(state.activeExpressionKeys, ["sad"]);
  assert.deepEqual(state.transitionExpressionKeys, []);
  assert.equal(advanceVrmaExpressionOwnership(state, Number.NaN).expressionTransitionRemaining, 0);
  assert.equal(advanceVrmaExpressionOwnership(state, -1).expressionTransitionRemaining, 0);
});

test("speech override is limited to vowel presets actually exposed by the VRM", () => {
  assert.deepEqual(getVrmaSpeechVisemeKeys(["happy", "aa", "blink", "oh"]), ["aa", "oh"]);
  assert.deepEqual(getVrmaSpeechVisemeKeys(["happy", "blink"]), []);
  assert.deepEqual(getVrmaSpeechVisemeKeys(undefined), []);
});

test("the live 3D stage delegates clip ownership and speech arbitration to the tested helper", async () => {
  const stage = await readFile(path.join(repoRoot, "app/src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /beginVrmaExpressionOwnershipTransition\(rt\.activeExpressionKeys,nextKeys,fadeSeconds\)/);
  assert.match(stage, /getProtectedVrmaExpressionKeys\(/);
  assert.match(stage, /getVrmaSpeechVisemeKeys\(rt\.vrmExpressionKeys\)/);
  assert.match(stage, /advanceVrmaExpressionOwnership\(/);
  assert.match(stage, /rt\.activeExpressionKeys=\[\]/);
  assert.match(stage, /rt\.transitionExpressionKeys=\[\]/);
  assert.match(stage, /rt\.expressionTransitionRemaining=0/);
});
