import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");
const mapMatch = source.match(/const EXPR_MAP=(\{[\s\S]*?\});/);
const fnMatch = source.match(/function applyExpression\(expr\)\{([\s\S]*?)\n  \}/);
assert.ok(mapMatch, "Live2D expression map must exist");
assert.ok(fnMatch, "Live2D expression applier must exist");

const calls = [];
const context = {
  EXPR_MAP: vm.runInNewContext(`(${mapMatch[1]})`),
  lastAppliedExpression: null,
  model: { expression: (name) => calls.push(name) },
};
vm.runInNewContext(`function applyExpression(expr){${fnMatch[1]}\n}`, context);

context.applyExpression("happy");
context.applyExpression("happy");
context.applyExpression("neutral"); // Same mapped expression as happy.
assert.deepEqual(calls, ["Stanby Smile"], "unchanged mapped expressions must not restart");
context.applyExpression("sad");
context.applyExpression("sad");
assert.deepEqual(calls, ["Stanby Smile", "Stanby Sad"], "only expression transitions should invoke the model");

console.log("NK1_LIVE2D_EXPRESSION_CACHE=PASS transitions=2 duplicateResets=0");
