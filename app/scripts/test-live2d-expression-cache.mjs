import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { EXPRESSION_TEXT } from "../src/components/avatar/embodimentUiBridge.ts";

const source = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");
const mapMatch = source.match(/const EXPR_MAP=(\{[\s\S]*?\});/);
const fnMatch = source.match(/function applyExpression\(expr(?:,revision=null)?\)\{([\s\S]*?)\n  \}/);
assert.ok(mapMatch, "Live2D expression map must exist");
assert.ok(fnMatch, "Live2D expression applier must exist");

const viewerExprKeys = new Set(Object.keys(vm.runInNewContext(`(${mapMatch[1]})`)));

// The viewer validates `d.expression` against EXPR_MAP and rejects the entire intent
// frame when it is unknown, so every expression the stage can send must be a known key.
for (const [label, expression] of Object.entries(EXPRESSION_TEXT)) {
  assert.ok(viewerExprKeys.has(expression), `emotion ${label} sends expression "${expression}", which the Live2D viewer does not know`);
}

const calls = [];
const context = {
  EXPR_MAP: vm.runInNewContext(`(${mapMatch[1]})`),
  lastAppliedExpression: null,
  lastIntentStateVersion: 1,
  model: { expression: (name) => { calls.push(name); return true; } },
};
vm.runInNewContext(`function applyExpression(expr,revision=null){${fnMatch[1]}\n}`, context);

await context.applyExpression("happy");
await context.applyExpression("happy");
await context.applyExpression("neutral"); // Same mapped expression as happy.
assert.deepEqual(calls, ["Stanby Smile"], "unchanged mapped expressions must not restart");
await context.applyExpression("sad");
await context.applyExpression("sad");
assert.deepEqual(calls, ["Stanby Smile", "Stanby Sad"], "only expression transitions should invoke the model");

const failedCalls = [];
const retryContext = {
  EXPR_MAP: vm.runInNewContext(`(${mapMatch[1]})`),
  lastAppliedExpression: null,
  lastIntentStateVersion: 1,
  model: { expression: (name) => { failedCalls.push(name); return false; } },
};
vm.runInNewContext(`function applyExpression(expr,revision=null){${fnMatch[1]}\n}`, retryContext);
await retryContext.applyExpression("happy");
await retryContext.applyExpression("happy");
assert.deepEqual(failedCalls, ["Stanby Smile", "Stanby Smile"], "a failed expression start must remain retryable");
assert.equal(retryContext.lastAppliedExpression, null, "failed expression start must not poison the success cache");

console.log("NK1_LIVE2D_EXPRESSION_CACHE=PASS transitions=2 duplicateResets=0 failedStartRetries=1");
