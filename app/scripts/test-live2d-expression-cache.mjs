import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");
const mapMatch = source.match(/const EXPR_MAP=(\{[\s\S]*?\});/);
const fnMatch = source.match(/function applyExpression\(expr\)\{([\s\S]*?)\n  \}/);
const activeMatch = source.match(/function visualStateIsActive\(signal=bodySignal\)\{([\s\S]*?)\n  \}/);
const budgetMatch = source.match(/function updateTickerBudget\(\)\{([\s\S]*?)\n  \}/);
const visibilityMatch = source.match(/function syncViewerVisibility\(\)\{([\s\S]*?)\n  \}/);
assert.ok(mapMatch, "Live2D expression map must exist");
assert.ok(fnMatch, "Live2D expression applier must exist");
assert.ok(activeMatch, "Live2D active-state classifier must exist");
assert.ok(budgetMatch, "Live2D ticker budget function must exist");
assert.ok(visibilityMatch, "Live2D visibility lifecycle function must exist");

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

context.bodySignal = {};
context.app = { ticker: { maxFPS: 60 }, startCalls: 0, stopCalls: 0,
  start() { this.startCalls += 1; }, stop() { this.stopCalls += 1; } };
context.model = {};
context.document = { hidden: false };
vm.runInNewContext(`${activeMatch[0]}\n${budgetMatch[0]}\n${visibilityMatch[0]}`, context);
context.updateTickerBudget();
assert.equal(context.app.ticker.maxFPS, 14, "idle Live2D render budget must be capped at 14 FPS");
context.bodySignal = { speaking: true };
context.updateTickerBudget();
assert.equal(context.app.ticker.maxFPS, 30, "speech must raise the render budget to 30 FPS");
context.bodySignal = { expressionIntensity: 0.51 };
context.updateTickerBudget();
assert.equal(context.app.ticker.maxFPS, 30, "high-affect motion must use the active render budget");
context.bodySignal = { gesture: true };
context.updateTickerBudget();
assert.equal(context.app.ticker.maxFPS, 30, "a gesture must use the active render budget");
context.bodySignal = {};
context.document.hidden = true;
context.syncViewerVisibility();
assert.equal(context.app.stopCalls, 1, "hidden viewers must stop the Pixi render loop");
context.document.hidden = false;
context.syncViewerVisibility();
assert.equal(context.app.startCalls, 1, "visible viewers must resume the Pixi render loop");
assert.equal(context.app.ticker.maxFPS, 14, "resumed idle viewer must restore the idle budget");

console.log("NK1_LIVE2D_RUNTIME_BUDGET=PASS idleFps=14 activeFps=30 hiddenPause=1 visibleResume=1");
