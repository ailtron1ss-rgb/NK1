import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const compact = (value) => value.replace(/\s+/g, "");

test("every user-supplied VRM/GLB is preflighted before Three.js parses it", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  const preflight = stage.indexOf("inspectSelfContainedGlb(data,MAX_AVATAR_MODEL_BYTES)");
  const parse = stage.indexOf('new GLTFLoader().parse(data,""');
  assert.ok(preflight >= 0, "missing self-contained GLB preflight");
  assert.ok(parse > preflight, "GLTFLoader must not parse before the preflight succeeds");
});

test("failed imports preserve the last successfully loaded model", async () => {
  const stage = compact(await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8"));
  assert.ok(stage.includes('constactive=runtime.current?.loaded;setState(active?"loaded":"error")'));
  assert.ok(stage.includes("Предыдущая модель остаётся активной"));
});

test("mixer actions are stopped and uncached before replaced/reset model resources are disposed", async () => {
  const stage = compact(await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8"));
  assert.ok(stage.includes("functionstopAndDetachMixer(rt:Runtime,root:any=rt.loaded)"));
  assert.ok(stage.includes("mixer.stopAllAction();if(root)mixer.uncacheRoot(root);rt.mixer=null"));
  const replacement = stage.indexOf("stopAndDetachMixer(rt,rt.loaded);if(rt.loaded){rt.scene.remove(rt.loaded);disposeTree(rt.loaded);}");
  assert.ok(replacement >= 0, "replacement must detach the mixer before disposing the previous rig");
  const resetStart = stage.indexOf("constreset=async()=>");
  const resetMixer = stage.indexOf("stopAndDetachMixer(rt,rt.loaded)", resetStart);
  const resetDispose = stage.indexOf("disposeTree(rt.loaded)", resetStart);
  assert.ok(resetStart >= 0 && resetMixer > resetStart && resetDispose > resetMixer, "reset must detach the mixer before disposal");
  assert.ok(stage.includes("stopAndDetachMixer(rt,rt.loaded);disposeTree(scene)"), "unmount must detach the mixer before scene disposal");
});

test("browser speech prosody uses one rate for synthesis and the viseme timeline", async () => {
  const stage = compact(await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8"));
  assert.ok(stage.includes("deriveBrowserVoiceProsody"));
  assert.ok(stage.includes("timeline:buildVisemeTimeline(text,rate,language)"));
  assert.ok(stage.includes("utterance.rate=prosody.rate"));
  assert.ok(stage.includes("utterance.pitch=prosody.pitch"));
  assert.ok(stage.includes("utterance.volume=prosody.volume"));
});
