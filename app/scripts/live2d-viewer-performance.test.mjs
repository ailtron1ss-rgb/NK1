import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const viewer = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");

test("Live2D render ticker pauses while hidden and resumes when visible", () => {
  const match = viewer.match(/function syncRendererVisibility\(\)\{([\s\S]*?)\n      \}/);
  assert.ok(match, "visibility controller must exist in the shipped frontend viewer");
  const calls = [];
  const context = {
    app: { ticker: {
      stop() { calls.push("stop"); },
      start() { calls.push("start"); },
    } },
    document: { visibilityState: "hidden" },
  };
  vm.runInNewContext("function syncRendererVisibility(){" + match[1] + "\n}", context);
  context.syncRendererVisibility();
  assert.deepEqual(calls, ["stop"], "hidden documents must stop PIXI work");
  context.document.visibilityState = "visible";
  context.syncRendererVisibility();
  assert.deepEqual(calls, ["stop", "start"], "visible documents must resume PIXI work");
});

test("Live2D viewer wires visibility, page lifecycle and a bounded 30 FPS ticker", () => {
  assert.match(viewer, /if\(typeof app\.ticker\?\.maxFPS==='number'\)app\.ticker\.maxFPS=30;/);
  assert.match(viewer, /document\.addEventListener\('visibilitychange',syncRendererVisibility/);
  assert.match(viewer, /window\.addEventListener\('pagehide',\(\)=>app\?\.ticker\?\.stop\(\)/);
  assert.match(viewer, /window\.addEventListener\('pageshow',syncRendererVisibility/);
});
