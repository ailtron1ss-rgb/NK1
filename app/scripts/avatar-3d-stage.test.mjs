import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const root=path.join(repoRoot,"app");
const stagePath=path.join(root,"src/components/Avatar3DStage.tsx");
test("a real Three.js 3D mode exists rather than reusing the legacy Avatar2D alias",async()=>{
 const parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8"),stage=await readFile(stagePath,"utf8"),legacy=await readFile(path.join(repoRoot,"legacy/kurisu-v56/src/components/Avatar3D.tsx"),"utf8");
 assert.match(parent,/"3d"/);assert.match(parent,/<Avatar3DStage/);assert.match(stage,/new THREE\.WebGLRenderer/);assert.match(stage,/new THREE\.Scene/);assert.match(stage,/makeBody/);assert.match(legacy,/return <Avatar2D \{\.\.\.props\} \/>/);assert.match(stage,/Процедурный 3D-концепт/);
});
test("local VRM/GLB upload is bounded and browser-local",async()=>{
 const stage=await readFile(stagePath,"utf8"),store=await readFile(path.join(root,"src/components/avatar/avatarModelStore.ts"),"utf8");
 assert.match(stage,/accept="\.vrm,\.glb,model\/gltf-binary"/);assert.match(stage,/MAX_AVATAR_MODEL_BYTES/);assert.match(stage,/saveAvatarModel\(blob,name\)/);assert.match(stage,/loadStoredAvatarModel/);assert.match(stage,/clearStoredAvatarModel/);assert.match(store,/90 \* 1024 \* 1024/);assert.match(store,/indexedDB\.open/);assert.doesNotMatch(stage,/https?:\/\/[^"'\s]+\.glb/i);
});
test("all local VRM/GLB imports are preflighted before GLTFLoader and prior model survives rejection",async()=>{
 const stage=await readFile(stagePath,"utf8"),validator=await readFile(path.join(root,"src/components/avatar/avatarModelValidation.ts"),"utf8");
 assert.match(stage,/inspectSelfContainedGlb\(data,MAX_AVATAR_MODEL_BYTES\)/);
 assert.ok(stage.indexOf("inspectSelfContainedGlb(data,MAX_AVATAR_MODEL_BYTES)")<stage.indexOf("loader.parse(data"));
 assert.match(stage,/active\?\.loaded\?"loaded":active\?"error":"webgl-unavailable"/);
 assert.match(stage,/Предыдущая модель остаётся активной/);
 assert.match(validator,/external-resource/);
 assert.match(validator,/startsWith\("data:"\)/);
 assert.match(validator,/maxAccessorElements: 8_000_000/);
 assert.match(validator,/maxHierarchyDepth: 256/);
});

test("drag yaw rotates the loaded VRM/GLB pivot without overwriting its source orientation",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/const pivot=new THREE\.Group\(\);pivot\.name="NK1AvatarMotionPivot";pivot\.add\(root\)/);
 assert.match(stage,/rt\.loaded=pivot/);
 assert.match(stage,/rt\.scene\.add\(pivot\)/);
 assert.match(stage,/rt\.loaded\.rotation\.y=rt\.yaw\+Math\.sin/);
 assert.match(stage,/rt\.yaw\+=\(e\.clientX-rt\.dragX\)\*\.008/);
 assert.match(stage,/rt\.mixer=new THREE\.AnimationMixer\(root\)/);
 assert.ok(stage.indexOf("VRMUtils.rotateVRM0(vrm)")<stage.indexOf("const pivot=new THREE.Group()"));
});

test("the 3D body consumes organism emotion, action, arousal/valence, gaze, sleep and speech",async()=>{
 const stage=await readFile(stagePath,"utf8"),parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 for(const key of ["emotion","arousal","valence","dominance","energy","cognitiveLoad","uncertainty","socialNeed","novelty","goalPressure","curiosity","predictionError","traits","gazeX","gazeY","speaking","mouthPose","thinking","awake","action"])assert.ok(stage.includes(key),"Missing state: "+key);
 for(const key of ["b.head.rotation","b.leftArm.rotation","b.rightArm.rotation","b.mouth.scale","rt.mood.color","rt.mixer"])assert.ok(stage.includes(key),"Missing body response: "+key);
 assert.match(parent,/emotion=\{snap\.emotion\.label\} action=\{snap\.lastOption\}/);assert.match(parent,/arousal=\{snap\.emotion\.arousal\} valence=\{snap\.emotion\.valence\}/);assert.match(parent,/cognitiveLoad=\{snap\.needs\.cognitiveLoad\}/);assert.match(parent,/traits=\{snap\.identity\.traits\}/);assert.match(parent,/predictionError=\{snap\.predictionError\}/);assert.match(parent,/mouthPose=\{mouthPose\} thinking=\{thinking\} awake=\{snap\.awake\}/);
});
test("renderer resources and animation loops are disposed and high-DPI rendering is capped",async()=>{
 const stage=await readFile(stagePath,"utf8");assert.match(stage,/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,2\)\)/);assert.match(stage,/cancelAnimationFrame\(raf\)/);assert.match(stage,/Reset to bind pose before the mixer/);assert.match(stage,/selectAvatarMotionClip\(\{vrmaClips:rt\.vrmaClips,modelClips:rt\.modelClips/);assert.doesNotMatch(stage,/\|\|clips\[0\]\|\|null/);assert.match(stage,/observer\?\.disconnect\(\)/);assert.match(stage,/renderer\.dispose\(\)/);assert.match(stage,/disposeTree\(rt\.loaded\)/);
});
test("Three.js lock metadata is pinned consistently",async()=>{
 const pkg=JSON.parse(await readFile(path.join(root,"package.json"),"utf8")),lock=JSON.parse(await readFile(path.join(root,"package-lock.json"),"utf8"));
 assert.equal(pkg.dependencies.three,"0.180.0");assert.equal(lock.packages[""].dependencies.three,"0.180.0");assert.equal(lock.packages["node_modules/three"].version,"0.180.0");assert.equal(lock.packages["node_modules/three"].license,"MIT");
});
test("existing sprite and Live2D files remain available",async()=>{
 const manifest=JSON.parse(await readFile(path.join(root,"public/sprites/manifest.json"),"utf8"));assert.ok(manifest.cells.length>=30);
 for(const cell of manifest.cells){const file=path.resolve(root,"public",cell.file);assert.ok(file.startsWith(path.join(root,"public")+path.sep));assert.ok((await stat(file)).size>20000,"Missing sprite: "+cell.file);}
 assert.ok((await stat(path.join(repoRoot,"runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json"))).size>0);
});

test("separate GLTF motion source is baked onto the active rig without reprocessing Pixiv VRMA",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/Motion source VRM\/GLB/);
 assert.match(stage,/loadMotionSource=useCallback/);
 assert.match(stage,/captureHumanoidRigSnapshot\(root,bones,rt\.scene\)/);
 assert.match(stage,/rebuildModelMotionClips\(rt\)/);
 assert.match(stage,/retargetThreeHumanoidClip\(\s*source\.root,source\.bones,source\.snapshot,\s*rt\.rigRoot,rt\.bones,rt\.rigSnapshot,clip/);
 const vrmaStart=stage.indexOf("const loadVrma=useCallback");
 const vrmaEnd=stage.indexOf("useEffect(()=>{",vrmaStart);
 assert.ok(vrmaStart>=0&&vrmaEnd>vrmaStart);
 assert.match(stage.slice(vrmaStart,vrmaEnd),/createVRMAnimationClip\(animation,rt\.vrm\)/);
 assert.doesNotMatch(stage.slice(vrmaStart,vrmaEnd),/retargetThreeHumanoidClip/);
 assert.match(stage,/motionSourceToken\.current\+\+/);
 assert.match(stage,/rt\.motionSource\.pivot/);
});
