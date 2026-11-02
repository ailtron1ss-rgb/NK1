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
 assert.match(stage,/accept="\.vrm,\.glb,model\/gltf-binary"/);assert.match(stage,/MAX_AVATAR_MODEL_BYTES/);assert.match(stage,/saveAvatarModel\(blob,name\)/);assert.match(stage,/loadStoredAvatarModel/);assert.match(stage,/clearStoredAvatarModel/);assert.match(store,/avatarModelLimits\.ts/);assert.match(await readFile(path.join(root,"src/components/avatar/avatarModelLimits.ts"),"utf8"),/90 \* 1024 \* 1024/);assert.match(store,/indexedDB\.open/);assert.doesNotMatch(stage,/https?:\/\/[^"'\s]+\.glb/i);
});
test("the 3D body consumes organism emotion, action, arousal/valence, gaze, sleep and speech",async()=>{
 const stage=await readFile(stagePath,"utf8"),parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 for(const key of ["emotion","arousal","valence","dominance","energy","cognitiveLoad","uncertainty","socialNeed","novelty","goalPressure","curiosity","predictionError","traits","gazeX","gazeY","speaking","mouthPose","thinking","awake","action"])assert.ok(stage.includes(key),"Missing state: "+key);
 for(const key of ["b.head.rotation","b.leftArm.rotation","b.rightArm.rotation","b.mouth.scale","rt.mood.color","rt.mixer"])assert.ok(stage.includes(key),"Missing body response: "+key);
 assert.match(parent,/emotion=\{snap\.emotion\.label\} action=\{snap\.lastOption\}/);assert.match(parent,/arousal=\{snap\.emotion\.arousal\} valence=\{snap\.emotion\.valence\}/);assert.match(parent,/cognitiveLoad=\{snap\.needs\.cognitiveLoad\}/);assert.match(parent,/traits=\{snap\.identity\.traits\}/);assert.match(parent,/predictionError=\{snap\.predictionError\}/);assert.match(parent,/mouthPose=\{mouthPose\} thinking=\{thinking\} awake=\{snap\.awake\}/);
});
test("renderer resources and animation loops are disposed and high-DPI rendering is capped",async()=>{
 const stage=await readFile(stagePath,"utf8");assert.match(stage,/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,2\)\)/);assert.match(stage,/cancelAnimationFrame\(raf\)/);assert.match(stage,/Reset to bind pose before the mixer/);assert.match(stage,/applyAvatarAnimationFrame/);assert.doesNotMatch(stage,/rt\.mixer\.stopAllAction\(\);const a=rt\.mixer\.clipAction/);assert.ok((await readFile(path.join(root,"src/components/avatar/avatarAnimationRuntime.ts"),"utf8")).includes("rig[_-]?kurisu"));assert.doesNotMatch(stage,/\|\|clips\[0\]\|\|null/);assert.match(stage,/observer\?\.disconnect\(\)/);assert.match(stage,/renderer\.dispose\(\)/);assert.match(stage,/disposeTree\(rt\.loaded\)/);assert.match(stage,/const gradient=getSharedAnimeGradientTexture\(\);disposeThreeObjectTree\(root,gradient\?\[gradient\]:\[\]\)/);
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

test("VRM models use the official Pixiv runtime through the normalized adapter",async()=>{
 const stage=await readFile(stagePath,"utf8"),adapter=await readFile(path.join(root,"src/components/avatar/vrmRuntimeAdapter.ts"),"utf8");
 assert.ok(stage.includes('import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm"'));
 assert.ok(stage.includes("new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })"));
 assert.ok(stage.includes("gltf.userData?.vrm"));
 assert.ok(stage.includes("applyVrmExpressionFrame"));
 assert.ok(stage.includes("applyVrmNormalizedMotorFrame"));
 assert.ok(stage.includes("updateVrmForNk1Frame"));
 assert.ok(adapter.includes("expressionManager"));
 assert.ok(adapter.includes("getNormalizedBoneNode"));
 assert.ok(adapter.includes("vrm.update("));
 assert.ok(stage.includes("VRMUtils.rotateVRM0(vrm)"));
});
test("GLB models retain the generic glTF fallback without pretending they are VRM",async()=>{const stage=await readFile(stagePath,"utf8");assert.match(stage,/const root=vrm\?\.scene\s*\?\?\s*gltf\.scene/);assert.match(stage,/if \(fileName\.toLowerCase\(\)\.endsWith\("\.vrm"\) && !vrm\)/);});

test("the official VRM runtime is pinned to the Three.js-compatible MIT release",async()=>{const pkg=JSON.parse(await readFile(path.join(root,"package.json"),"utf8")),lock=JSON.parse(await readFile(path.join(root,"package-lock.json"),"utf8"));assert.equal(pkg.dependencies["@pixiv/three-vrm"],"3.5.5");assert.equal(lock.packages[""].dependencies["@pixiv/three-vrm"],"3.5.5");assert.equal(lock.packages["node_modules/@pixiv/three-vrm"].version,"3.5.5");assert.equal(lock.packages["node_modules/@pixiv/three-vrm"].license,"MIT");});

test("procedural 3D fallback uses the extracted shared cel-shading material adapter",async()=>{
 const stage=await readFile(stagePath,"utf8"),toon=await readFile(path.join(root,"src/components/avatar/threeToonMaterials.ts"),"utf8");
 assert.ok(stage.includes("createProceduralToonMaterial"));
 assert.ok(toon.includes("new THREE_TOON.MeshToonMaterial"));
 assert.ok(toon.includes("new THREE_TOON.DataTexture"));
 assert.match(toon,/let sharedAnimeGradient:\s*any\s*=\s*null/);
 assert.match(toon,/function createAnimeGradient\(\): any/);
 assert.match(toon,/if \(sharedAnimeGradient\) return sharedAnimeGradient/);
 assert.ok(toon.includes("THREE_TOON.RedFormat"));
 assert.ok(toon.includes("THREE_TOON.NearestFilter"));
 assert.ok(stage.includes("new THREE.MeshStandardMaterial({color:0x2d8198"));
});
test("non-VRM GLB imports use the extracted toon adapter while VRM materials remain native",async()=>{
 const stage=await readFile(stagePath,"utf8"),toon=await readFile(path.join(root,"src/components/avatar/threeToonMaterials.ts"),"utf8");
 assert.ok(stage.includes("if(!vrm)applyAnimeToonMaterials(root)"));
 assert.ok(toon.includes("source.isMeshStandardMaterial"));
 assert.ok(toon.includes("source.isMeshPhysicalMaterial"));
 assert.ok(toon.includes("new THREE_TOON.MeshToonMaterial"));
 assert.ok(toon.includes("source.map"));
 assert.ok(toon.includes("source.normalMap"));
 assert.ok(toon.includes("source.emissiveMap"));
 assert.ok(toon.includes("nk1ToonConverted: true"));
});

test("avatar stage delegates material conversion and renderer-owned texture preservation",async()=>{
 const stage=await readFile(stagePath,"utf8"),toon=await readFile(path.join(root,"src/components/avatar/threeToonMaterials.ts"),"utf8");
 assert.match(stage,/import \{ applyAnimeToonMaterials, createProceduralToonMaterial, getSharedAnimeGradientTexture \}/);
 assert.match(stage,/if\(!vrm\)applyAnimeToonMaterials\(root\)/);
 assert.match(stage,/const gradient=getSharedAnimeGradientTexture\(\)/);
 assert.match(toon,/const replaced = new Set<any>\(\)/);
 assert.match(toon,/replaced\.add\(source\)/);
 assert.match(toon,/disposeReplacedThreeMaterials\(replaced\)/);
});

test("uploaded model bytes are structurally preflighted before GLTFLoader parses them",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/import \{ preflightAvatarModel \} from "\.\/avatar\/avatarModelPreflight"/);
 assert.match(stage,/preflightAvatarModel\(data,name\)/);
 assert.ok(stage.indexOf("preflightAvatarModel(data,name)")<stage.indexOf("loader.parse(data"));
});

test("a pinned hosted Kurisu hybrid GLB can be loaded without a manual file download",async()=>{
 const stage=await readFile(stagePath,"utf8"),catalog=await readFile(path.join(root,"src/components/avatar/avatarModelCatalog.ts"),"utf8");
 assert.match(catalog,/NeuroKurisu_3D_v5\.glb/);
 assert.match(catalog,/sha256:4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743/);
 assert.match(catalog,/sizeBytes:\s*2_035_768/);
 assert.match(stage,/fetch\(KURISU_HYBRID_MODEL\.url/);
 assert.match(stage,/credentials:\s*"omit"/);
 assert.match(stage,/fingerprintAvatarModel\(data\)/);
 assert.match(stage,/KURISU_HYBRID_MODEL\.sha256/);
 assert.match(stage,/loadModel\(blob,KURISU_HYBRID_MODEL\.filename,true\)/);
 assert.match(stage,/Загрузить модель Курису v5/);
 assert.ok((await readFile(path.join(root,"src/components/avatar/avatarAnimationRuntime.ts"),"utf8")).includes("rig[_-]?kurisu"));
});

test("3D mode restores the user's local model first and auto-loads the pinned Kurisu model otherwise",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/if\(saved\)void loadModel\(saved\.blob,saved\.name,false\)/);
 assert.match(stage,/void loadBundledModel\(\)/);
 assert.match(stage,/KURISU_HYBRID_MODEL\.url/);
 assert.match(stage,/signal:AbortSignal\.timeout\(25_000\)/);
 assert.match(stage,/contentType!==\"model\/gltf-binary\"/);
 assert.match(stage,/declaredLength!==KURISU_HYBRID_MODEL\.sizeBytes/);
 assert.match(stage,/loadToken\.current\+\+/);
});
test("generic GLB speech drives all available Kurisu viseme morph targets",async()=>{
 const stage=await readFile(stagePath,"utf8"),adapter=await readFile(path.join(root,"src/components/avatar/glbMouthMorphAdapter.ts"),"utf8");
 assert.match(stage,/resolveGlbMouthMorphWeights\(node\.morphTargetDictionary,p\.mouthPose,p\.speaking\)/);
 for(const key of ["visemeaa","visemeih","visemeee","visemeoh","visemeou"])assert.ok(adapter.includes(key),"Missing GLB viseme target: "+key);
 assert.match(adapter,/if \(!speaking\) return result/);
 assert.match(adapter,/case "open"/);assert.match(adapter,/case "round"/);assert.match(adapter,/case "wide"/);assert.match(adapter,/case "teeth"/);
});
