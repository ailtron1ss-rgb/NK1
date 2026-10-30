import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("pins the official MIT Pixiv VRM runtime against the repository Three.js version", async () => {
  const packageJson = JSON.parse(await readFile(path.join(appRoot, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(appRoot, "package-lock.json"), "utf8"));
  assert.equal(packageJson.dependencies["@pixiv/three-vrm"], "3.5.5");
  assert.equal(lock.packages[""].dependencies["@pixiv/three-vrm"], "3.5.5");
  assert.equal(lock.packages["node_modules/@pixiv/three-vrm"].version, "3.5.5");
  assert.equal(lock.packages["node_modules/@pixiv/three-vrm"].license, "MIT");
  assert.equal(lock.packages["node_modules/three"].version, "0.180.0");
  assert.equal(lock.packages["node_modules/@pixiv/three-vrm"].peerDependencies.three, ">=0.137");
  assert.ok(lock.packages["node_modules/@pixiv/three-vrm-materials-mtoon"]);
  assert.ok(lock.packages["node_modules/@pixiv/three-vrm-springbone"]);
  assert.ok(lock.packages["node_modules/@pixiv/three-vrm-node-constraint"]);
});

test("the production loader registers VRMLoaderPlugin and uses normalized VRM scene orientation", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /import \{ VRMLoaderPlugin, VRMUtils \} from "@pixiv\/three-vrm"/);
  assert.match(stage, /loader\.register\(\(parser:any\)=>new VRMLoaderPlugin\(parser\)\)/);
  assert.match(stage, /gltf\.userData\?\.vrm\?\?null/);
  assert.match(stage, /if\(vrm\)VRMUtils\.rotateVRM0\(vrm\)/);
  assert.match(stage, /const root=vrm\?\.scene\?\?gltf\.scene/);
});

test("the runtime drives native expression manager, VRM LookAt, spring bones and MToon updates", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /expressionManager\.setValue\(key,expressionWeights\[key\]\?\?0\)/);
  assert.match(stage, /rt\.vrm\.lookAt\.target=rt\.lookAtTarget/);
  assert.match(stage, /getNormalizedBoneNode/);
  assert.match(stage, /rt\.vrm\?\.update\(dt\)/);
  assert.match(stage, /VRMUtils\.deepDispose\(rt\.loaded\)/);
  assert.match(stage, /if\(gltf\.userData\?\.vrm\)VRMUtils\.deepDispose\(gltf\.userData\.vrm\.scene\);else disposeTree\(gltf\.scene\);return;/);
  assert.match(stage, /if\(rt\.vrm\)\{VRMUtils\.deepDispose\(rt\.vrm\.scene\);disposeTree\(rt\.body\.root\);\}else disposeTree\(scene\)/);
  assert.match(stage, /key\.startsWith\("look"\)/);
});

test("plain GLB keeps the precompiled morph-target adapter as a fallback", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /buildVrmExpressionMap\(gltf\.parser\?\.json\?\.extensions\)/);
  assert.match(stage, /bindVrmExpressionTargets\(rt\.vrmExpressionDefinitions,gltf\.parser\?\.associations\?\.entries\?\.\(\)\?\?\[\]\)/);
  assert.match(stage, /else if\(rt\.vrmMorphTargets\.length\)/);
  assert.match(stage, /applyVrmMorphTargetWeights\(rt\.vrmMorphTargets,expressionWeights\)/);
});
