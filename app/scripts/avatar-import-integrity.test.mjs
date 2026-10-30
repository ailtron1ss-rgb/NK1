import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every user-supplied VRM/GLB is preflighted before Three.js parses it", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  const preflight = stage.indexOf("inspectSelfContainedGlb(data,MAX_AVATAR_MODEL_BYTES)");
  const parse = stage.indexOf('new GLTFLoader().parse(data,""');
  assert.ok(preflight >= 0, "missing self-contained GLB preflight");
  assert.ok(parse > preflight, "GLTFLoader must not parse before the preflight succeeds");
});

test("failed imports preserve the last successfully loaded model", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /const active=runtime.current?.loaded;setState(active?"loaded":"error")/);
  assert.match(stage, /Предыдущая модель остаётся активной/);
});

test("mixer actions are stopped and uncached before replaced/reset model resources are disposed", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /function stopAndDetachMixer(rt:Runtime,root:any=rt.loaded)/);
  assert.match(stage, /mixer.stopAllAction();if(root)mixer.uncacheRoot(root);rt.mixer=null/);
  const replacement = stage.indexOf("stopAndDetachMixer(rt,rt.loaded);if(rt.loaded)");
  assert.ok(replacement >= 0 && replacement < stage.indexOf("disposeTree(rt.loaded)", replacement));
  const reset = stage.indexOf("const reset=async()=>");
  assert.ok(reset >= 0 && stage.indexOf("stopAndDetachMixer(rt,rt.loaded)", reset) < stage.indexOf("disposeTree(rt.loaded)", reset));
  assert.ok(stage.indexOf("stopAndDetachMixer(rt,rt.loaded);disposeTree(scene)") >= 0);
});

test("browser speech prosody uses one rate for synthesis and the viseme timeline", async () => {
  const stage = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /deriveBrowserVoiceProsody/);
  assert.match(stage, /timeline: buildVisemeTimeline(text, rate, language)/);
  assert.match(stage, /utterance.rate = prosody.rate/);
  assert.match(stage, /utterance.pitch = prosody.pitch/);
  assert.match(stage, /utterance.volume = prosody.volume/);
});
