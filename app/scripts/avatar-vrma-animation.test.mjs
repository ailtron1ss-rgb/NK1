import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("pins the Pixiv VRMA loader/compiler package at the VRM runtime version", async () => {
  const pkg = JSON.parse(await readFile(path.join(appRoot, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(appRoot, "package-lock.json"), "utf8"));
  assert.equal(pkg.dependencies["@pixiv/three-vrm-animation"], "3.5.5");
  assert.equal(lock.packages[""].dependencies["@pixiv/three-vrm-animation"], "3.5.5");
  assert.equal(lock.packages["node_modules/@pixiv/three-vrm-animation"].version, "3.5.5");
  assert.equal(lock.packages["node_modules/@pixiv/three-vrm-animation"].license, "MIT");
  assert.equal(lock.packages["node_modules/@pixiv/three-vrm-animation"].peerDependencies.three, ">=0.137");
});

test("the production GLTF loader registers both VRM and VRMA parsers", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /import \{ createVRMAnimationClip, VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy \} from "@pixiv\/three-vrm-animation"/);
  assert.match(stage, /loader\.register\(\(parser:any\)=>new VRMLoaderPlugin\(parser\)\)/);
  assert.match(stage, /loader\.register\(\(parser:any\)=>new VRMAnimationLoaderPlugin\(parser\)\)/);
});

test("VRMA sidecars are preflighted, converted against the active VRM, and bounded", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  const validation = stage.indexOf("inspectSelfContainedGlb(data,MAX_AVATAR_MODEL_BYTES)", stage.indexOf("const loadVrma"));
  const parse = stage.indexOf("loader.parse(data", stage.indexOf("const loadVrma"));
  assert.ok(validation >= 0 && parse > validation);
  assert.match(stage, /Array\.isArray\(gltf\.userData\?\.vrmAnimations\)/);
  assert.match(stage, /if\(animations\.length>20\)/);
  assert.match(stage, /createVRMAnimationClip\(animation,rt\.vrm\)/);
  assert.match(stage, /rt\.vrmaClips=\[\]/);
  assert.match(stage, /rt\.vrmaDefaultClip=clips\[0\]\?\?null/);
});

test("the VRM mixer exists even when the character file contains no embedded animations", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /rt\.mixer=new THREE\.AnimationMixer\(root\)/);
  assert.match(stage, /rt\.vrmaClips=\[\]/);
  assert.match(stage, /rt\.clips=\[\.\.\.rt\.modelClips,\.\.\.rt\.vrmaClips\]/);
});

test("VRMA LookAt quaternion tracks have the official proxy node and animation selection prefers action-specific clips", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /new VRMLookAtQuaternionProxy\(vrm\.lookAt\)/);
  assert.match(stage, /rt\.lookAtProxy\.name="lookAtQuaternionProxy"/);
  assert.match(stage, /selectAvatarMotionClip\(\{vrmaClips:rt\.vrmaClips,modelClips:rt\.modelClips/);
  assert.match(stage, /accept="\.vrma,model\/gltf-binary"/);
  assert.match(stage, /onChange=\{onAnimationFile\}/);
});

test("VRMA sidecars persist separately and restore after the VRM model is loaded", async () => {
  const store = await readFile(path.join(appRoot, "src/components/avatar/avatarModelStore.ts"), "utf8");
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(store, /const VERSION = 2/);
  assert.match(store, /const ANIMATION_STORE = "active-animation"/);
  assert.match(store, /export function loadStoredAvatarAnimation/);
  assert.match(store, /export function saveAvatarAnimation/);
  assert.match(store, /export function clearStoredAvatarAnimation/);
  assert.match(stage, /saveAvatarAnimation\(blob,name\)/);
  assert.match(stage, /loadStoredAvatarAnimation\(\)/);
  assert.match(stage, /loadVrma\(saved\.blob,saved\.name,false\)/);
  assert.match(stage, /clearStoredAvatarAnimation\(\)/);
});

test("separate IndexedDB object store persists and restores VRMA sidecars", async () => {
  const store = await readFile(path.join(appRoot, "src/components/avatar/avatarModelStore.ts"), "utf8");
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(store, /const VERSION = 2/);
  assert.match(store, /const MODEL_STORE = "active-model"/);
  assert.match(store, /const ANIMATION_STORE = "active-animation"/);
  assert.match(store, /export function loadStoredAvatarAnimation/);
  assert.match(store, /export function saveAvatarAnimation/);
  assert.match(store, /export function clearStoredAvatarAnimation/);
  assert.match(store, /MAX_AVATAR_ANIMATION_BYTES/);
  assert.match(stage, /saveAvatarAnimation\(blob,name\)/);
  assert.match(stage, /loadStoredAvatarAnimation\(\)/);
  assert.match(stage, /loadVrma\(saved\.blob,saved\.name,false\)/);
  assert.match(stage, /clearStoredAvatarAnimation\(\)/);
});

test("VRMA-authored expression and LookAt tracks are not overwritten by static organism channels", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /animation\?\.expressionTracks\?\.preset\?\.keys\?\.\(\)/);
  assert.match(stage, /animation\?\.expressionTracks\?\.custom\?\.keys\?\.\(\)/);
  assert.match(stage, /expressionKeysByClip\[clip\.name\]=/);
  assert.match(stage, /rt\.vrmaExpressionKeysByClip=expressionKeysByClip/);
  assert.match(stage, /protectedKeys\.has\(key\)/);
  assert.match(stage, /rt\.activeLookAtClip=rt\.vrmaLookAtClipNames\.includes/);
  assert.match(stage, /if\(rt\.activeLookAtClip\)rt\.vrm\.lookAt\.target=null/);
  assert.match(stage, /rt\.vrm\.lookAt\.target=rt\.lookAtTarget/);
});

test("the VRMA picker rejects ordinary GLB character files", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /if\(!file\.name\.toLowerCase\(\)\.endsWith\("\.vrma"\)\)/);
  assert.match(stage, /Для отдельной анимации выберите файл \.vrma/);
});

test("live speech visemes take priority over VRMA vowel morph tracks", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /const speechVisemeKeys=p\.speaking\?new Set\(\["aa","ih","ou","ee","oh"\]\):null/);
  assert.match(stage, /if\(speechVisemeKeys\?\.has\(key\)\)rt\.vrm\.expressionManager\.setValue\(key,expressionWeights\[key\]\?\?0\)/);
  assert.match(stage, /else if\(!protectedKeys\.has\(key\)\)rt\.vrm\.expressionManager\.setValue/);
});

test("motion clip changes cross-fade instead of calling stopAllAction for every state transition", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /function transitionClip\(rt:Runtime,clip:any,timeScale:number,fadeSeconds=\.22\)/);
  assert.match(stage, /rt\.activeAction\.fadeOut\(fadeSeconds\)/);
  assert.match(stage, /next\.fadeIn\(fadeSeconds\)\.play\(\)/);
  assert.match(stage, /transitionClip\(rt,clip,p\.awake\?\.55\+energy\*\.45:\.3\)/);
});

test("replacing or resetting the VRM invalidates any in-flight VRMA load", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /animationToken\.current\+\+;const token=\+\+loadToken\.current/);
  assert.match(stage, /const reset=async\(\)=>\{loadToken\.current\+\+;animationToken\.current\+\+/);
  assert.match(stage, /token!==animationToken\.current\|\|runtime\.current!==rt/);
});
