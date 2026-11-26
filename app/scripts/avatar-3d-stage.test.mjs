import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as THREE from "three";
import { refreshAvatarRaycastBounds } from "../src/components/avatar/avatarModelFitBounds.ts";
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const root=path.join(repoRoot,"app");
const stagePath=path.join(root,"src/components/Avatar3DStage.tsx");
test("a real Three.js 3D mode exists rather than reusing the legacy Avatar2D alias",async()=>{
 const parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8"),stage=await readFile(stagePath,"utf8"),legacy=await readFile(path.join(repoRoot,"legacy/kurisu-v56/src/components/Avatar3D.tsx"),"utf8");
 assert.match(parent,/"3d"/);assert.match(parent,/<Avatar3DStage/);assert.match(stage,/new THREE\.WebGLRenderer/);assert.match(stage,/new THREE\.Scene/);assert.match(stage,/makeBody/);assert.match(legacy,/return <Avatar2D \{\.\.\.props\} \/>/);assert.match(stage,/3D-модель не загружена/);
});
test("local VRM/GLB upload is bounded and browser-local",async()=>{
 const stage=await readFile(stagePath,"utf8"),store=await readFile(path.join(root,"src/components/avatar/avatarModelStore.ts"),"utf8");
 assert.match(stage,/accept="\.vrm,\.glb,model\/gltf-binary"/);assert.match(stage,/MAX_AVATAR_MODEL_BYTES/);assert.match(stage,/saveAvatarModel\(blob,name\)/);assert.match(stage,/loadStoredAvatarModel/);assert.match(stage,/clearStoredAvatarModel/);assert.match(store,/avatarModelLimits\.ts/);assert.match(await readFile(path.join(root,"src/components/avatar/avatarModelLimits.ts"),"utf8"),/90 \* 1024 \* 1024/);assert.match(store,/indexedDB\.open/);assert.doesNotMatch(stage,/https?:\/\/[^"'\s]+\.glb/i);
});
test("the 3D body consumes organism emotion, action, arousal/valence, gaze, sleep and speech",async()=>{
 const stage=await readFile(stagePath,"utf8"),parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 for(const key of ["emotion","arousal","valence","dominance","energy","cognitiveLoad","uncertainty","socialNeed","novelty","goalPressure","curiosity","predictionError","traits","gazeX","gazeY","speaking","mouthPose","thinking","awake","action"])assert.ok(stage.includes(key),"Missing state: "+key);
 for(const key of ["b.head.rotation","b.leftArm.rotation","b.rightArm.rotation","b.mouth.scale","rt.mood.color","rt.mixer"])assert.ok(stage.includes(key),"Missing body response: "+key);
 assert.match(parent,/emotion=\{snap\.emotion\.label\} action=\{snap\.lastOption\}/);assert.match(parent,/arousal=\{snap\.emotion\.arousal\} valence=\{snap\.emotion\.valence\}/);assert.match(parent,/cognitiveLoad=\{snap\.needs\.cognitiveLoad\}/);assert.match(parent,/traits=\{snap\.identity\.traits\}/);assert.match(parent,/predictionError=\{snap\.predictionError\}/);assert.match(parent,/motorPlan=\{projection\.motorPlan\}/);assert.match(parent,/mouthPose=\{projection\.mouthPose\} thinking=\{thinking\} awake=\{snap\.awake\}/);
});
test("renderer resources and animation loops are disposed and high-DPI rendering is capped",async()=>{
 const stage=await readFile(stagePath,"utf8"),animation=await readFile(path.join(root,"src/components/avatar/avatarAnimationRuntime.ts"),"utf8");assert.match(stage,/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,2\)\)/);assert.match(stage,/cancelAnimationFrame\(raf\)/);assert.match(stage,/Reset to bind pose before the mixer/);assert.match(stage,/applyAvatarAnimationFrame/);assert.match(stage,/rt\.activeClipAction/);assert.doesNotMatch(stage,/\|\|clips\[0\]\|\|null/);assert.ok(animation.includes("rig[_-]?kurisu"),"semantic rig fallback must remain in the extracted resolver");assert.match(stage,/observer\?\.disconnect\(\)/);assert.match(stage,/renderer\.dispose\(\)/);assert.match(stage,/disposeTree\(rt\.loaded\)/);assert.match(stage,/const gradient=getSharedAnimeGradientTexture\(\);disposeThreeObjectTree\(root,gradient\?\[gradient\]:\[\]\)/);
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
 assert.ok(stage.includes('if(!vrm){if(name===KURISU_HYBRID_MODEL_V7_CANDIDATE.filename||name===KURISU_HYBRID_MODEL_V12_CANDIDATE.filename)applyAvatarPbrMaterials(root);else applyAnimeToonMaterials(root);}'));
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
 assert.match(stage,/import \{ applyAnimeToonMaterials, applyAvatarPbrMaterials, createProceduralToonMaterial, getSharedAnimeGradientTexture \}/);
 assert.match(stage,/if\(!vrm\)\{if\(name===KURISU_HYBRID_MODEL_V7_CANDIDATE\.filename\|\|name===KURISU_HYBRID_MODEL_V12_CANDIDATE\.filename\)applyAvatarPbrMaterials\(root\);else applyAnimeToonMaterials\(root\);\}/);
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
 const stage=await readFile(stagePath,"utf8"),catalog=await readFile(path.join(root,"src/components/avatar/avatarModelCatalog.ts"),"utf8"),animation=await readFile(path.join(root,"src/components/avatar/avatarAnimationRuntime.ts"),"utf8");
 assert.match(catalog,/NeuroKurisu_3D_v5\.glb/);
 assert.match(catalog,/sha256:4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743/);
 assert.match(catalog,/sizeBytes:\s*2_035_768/);
 assert.match(stage,/fetch\(asset\.url/);
 assert.match(stage,/credentials:\s*"omit"/);
 assert.match(stage,/fingerprintAvatarModel\(data\)/);
 assert.match(stage,/asset\.sha256/);
 assert.match(stage,/loadModel\(blob,asset\.filename,persistence\)/);
 assert.match(stage,/Загрузить модель v5 \(онлайн\)/);
 assert.ok(animation.includes("rig[_-]?kurisu"),"semantic rig fallback must remain in the extracted resolver");
});

test("3D mode restores the user's local model first and auto-loads the pinned Kurisu model otherwise",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/if\(saved\)void loadModel\(saved\.blob,saved\.name,"restore"\)/);
 assert.match(stage,/void loadBundledModel\(\)/);
 assert.match(stage,/asset\.url/);
 assert.match(stage,/signal:AbortSignal\.timeout\(25_000\)/);
 assert.match(stage,/contentType!=="model\/gltf-binary"/);
 assert.match(stage,/declaredLength!==asset\.sizeBytes/);
 assert.match(stage,/loadToken\.current\+\+/);
});
test("generic GLB speech drives all available Kurisu viseme morph targets",async()=>{
 const stage=await readFile(stagePath,"utf8"),adapter=await readFile(path.join(root,"src/components/avatar/glbMouthMorphAdapter.ts"),"utf8");
 assert.match(stage,/resolveGlbMouthMorphWeights\(node\.morphTargetDictionary,p\.mouthPose,p\.speaking\)/);
 for(const key of ["visemeaa","visemeih","visemeee","visemeoh","visemeou"])assert.ok(adapter.includes(key),"Missing GLB viseme target: "+key);
 assert.match(adapter,/if \(!speaking\) return result/);
 assert.match(adapter,/case "open"/);assert.match(adapter,/case "round"/);assert.match(adapter,/case "wide"/);assert.match(adapter,/case "teeth"/);
});


test("3D GLB clip playback uses semantic resolution and crossfades without stopping the mixer", async () => {
 const stage = await readFile(stagePath, "utf8");
 const animation = await readFile(path.join(root, "src/components/avatar/avatarAnimationRuntime.ts"), "utf8");
 assert.match(stage, /import \{ applyAvatarAnimationFrame \} from "\.\/avatar\/avatarAnimationRuntime"/);
 assert.match(stage, /previousAction:rt\.activeClipAction/);
 assert.match(stage, /rt\.activeClipAction=animation\.activeAction/);
 assert.match(stage, /rt\.activeClipAction=null/);
 assert.doesNotMatch(stage, /rt\.mixer\.stopAllAction\(\);const a=rt\.mixer\.clipAction/);
 assert.match(animation, /crossFadeTo\(next, fadeSeconds, false\)/);
 assert.match(animation, /const requestedAction = input\.awake \? input\.action : "rest"/);
});


test("the procedural geometry is hidden until a verified external model loads",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/const body=makeBody\(scene\);body\.root\.visible=false;/);
 assert.match(stage,/setState\("empty"\)/);
 assert.doesNotMatch(stage,/setState\("procedural"\)/);
 assert.doesNotMatch(stage,/rt\.body\.root\.visible=true/);
 assert.match(stage,/Показываем 3D-тело только после успешной загрузки и preflight/);
 assert.match(stage,/геометрическая заглушка скрыта/);
});

test("3D model failure presents a real retry/import/Live2D recovery path",async()=>{
 const stage=await readFile(stagePath,"utf8"),parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 assert.match(stage,/Повторить загрузку модели v5 \(онлайн\)/);
 assert.match(stage,/Выбрать VRM \/ GLB/);
 assert.match(stage,/props\.onReturnTo2D/);
 assert.match(parent,/onReturnTo2D=\{\(\) => setMode\("live2d"\)\}/);
});

test("reset hides the procedural body and disposes VRM resources through VRMUtils",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/if\(rt\.vrm\)VRMUtils\.deepDispose\(rt\.loaded\);else disposeTree\(rt\.loaded\)/);
 assert.match(stage,/rt\.body\.root\.visible=false/);
 assert.match(stage,/setState\(rt\?"empty":"webgl-unavailable"\)/);
});


test("hidden procedural fixture does not run its per-frame body animation",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/if\(b\.root\.visible\)\{/);
});


test("3D uses the same shared motor projection but preserves raw organism action for GLB clip selection",async()=>{
 const stage=await readFile(stagePath,"utf8"),parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 assert.match(stage,/motorPlan: AvatarMotorIntentPlan/);
 assert.match(stage,/resolveVrmArmIntent\(p\.motorPlan/);
 assert.match(stage,/headTilt:p\.motorPlan\.headTilt/);
 assert.match(stage,/applyAvatarAnimationFrame\(\{mixer:rt\.mixer,clips:rt\.clips,action:p\.action/);
 assert.match(parent,/motorPlan=\{projection\.motorPlan\}/);
});


test("v7 NLA candidate is available for explicit visual preview but never promoted or persisted by default",async()=>{
 const catalog=await readFile(path.join(root,"src/components/avatar/avatarModelCatalog.ts"),"utf8");
 const stage=await readFile(stagePath,"utf8");
 assert.match(catalog,/export const KURISU_HYBRID_MODEL_V7_CANDIDATE/);
 assert.match(catalog,/canonical:\s*false/);
 assert.match(catalog,/9eb90244a35db827334c65a2101e5e4640875b9a25f53836876f1ca20972f8a0/);
 assert.match(stage,/loadCatalogModel/);
 assert.match(stage,/loadCatalogModel\(KURISU_HYBRID_MODEL_V7_CANDIDATE,"preview"\)/);
 assert.match(stage,/loadModel\(blob,asset\.filename,persistence\)/);
 assert.match(stage,/persistence==="preview"\)setStorageMessage\(`Кандидат v\$\{name\.includes\("_v12_"\)\?12:7\}: временный preview, не записан в IndexedDB/);
 assert.match(stage,/returningFromCandidate/);
 assert.match(stage,/previewPendingRef=useRef\(false\)/);
 assert.match(stage,/previewPendingRef\.current=persistence==="preview"/);
 assert.match(stage,/modelName===KURISU_HYBRID_MODEL_V7_CANDIDATE\.filename\|\|modelName===KURISU_HYBRID_MODEL_V12_CANDIDATE\.filename\|\|previewPendingRef\.current/);
 assert.match(stage,/loadV7Candidate/);
 assert.match(stage,/v7[^\n]{0,80}(?:preview|кандидат)|(?:preview|предпросмотр)[^\n]{0,80}v7/i);
});

test("avatar renderer mode controls expose the selected mode to assistive technology",async()=>{
 const ui=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 for(const mode of ["live2d","legacy","original","3d"])assert.ok(ui.includes(`aria-pressed={mode === "${mode}"}`),`missing aria-pressed state for ${mode}`);
});

test("v7 hybrid avatar keeps authored PBR materials while legacy GLB remains toon-shaded",async()=>{
 const stage=await readFile(stagePath,"utf8"),toon=await readFile(path.join(root,"src/components/avatar/threeToonMaterials.ts"),"utf8");
 assert.match(stage,/applyAvatarPbrMaterials/);
 assert.match(stage,/if\(!vrm\)\{if\(name===KURISU_HYBRID_MODEL_V7_CANDIDATE\.filename\|\|name===KURISU_HYBRID_MODEL_V12_CANDIDATE\.filename\)applyAvatarPbrMaterials\(root\);else applyAnimeToonMaterials\(root\);\}/);
 assert.match(toon,/export function applyAvatarPbrMaterials\(root: any\): void/);
});

test("avatar renderer and voice toolbar is mobile-touch friendly and screen-reader discoverable",async()=>{
 const ui=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 assert.match(ui,/role="toolbar" aria-label="Управление аватаром"/);
 assert.match(ui,/role="group" aria-label="Режим отображения персонажа"/);
 assert.match(ui,/role="group" aria-label="Голосовой вывод"/);
 for(const mode of ["Live2D","Legacy","NK1 Original","3D"]){
  assert.ok(ui.includes(`Переключить на режим ${mode}`),`missing descriptive label for ${mode}`);
 }
 assert.match(ui,/aria-live="polite"/);
 assert.match(ui,/min-h-9/);
 assert.match(ui,/focus-visible:ring-2/);
});

test("3D viewport exposes bounded zoom, pointer-wheel zoom and one-tap camera reset",async()=>{
 const stage=await readFile(stagePath,"utf8");
 const controls=await import("../src/components/avatar/avatarViewportControls.ts");
 assert.equal(controls.resolveAvatarCameraDistance(6.65,-1),5.65);
 assert.equal(controls.resolveAvatarCameraDistance(4.7,-5),4.5);
 assert.equal(controls.resolveAvatarCameraDistance(8.8,5),9);
 assert.equal(controls.resolveAvatarCameraDistance(Number.NaN,Number.NaN),6.65);
 assert.match(stage,/aria-label="Управление масштабом 3D-модели"/);
 assert.match(stage,/aria-label="Приблизить 3D-модель"/);
 assert.match(stage,/aria-label="Отдалить 3D-модель"/);
 assert.match(stage,/aria-label="Сбросить ракурс 3D-модели"/);
 assert.match(stage,/addEventListener\("wheel",wheel/);
 assert.match(stage,/removeEventListener\("wheel",wheel/);
 assert.match(stage,/resetCameraView/);
 assert.match(stage,/min-h-9/);
});


test("morph-ready v12 is pinned as a safe preview-only candidate without changing v5 canonical",async()=>{
 const catalog=await readFile(path.join(root,"src/components/avatar/avatarModelCatalog.ts"),"utf8");
 const stage=await readFile(stagePath,"utf8");
 assert.match(catalog,/export const KURISU_HYBRID_MODEL_V12_CANDIDATE/);
 assert.match(catalog,/id: "neuro-kurisu-hybrid-v12-morph-ready-candidate"/);
 assert.match(catalog,/NeuroKurisu_3D_v12_morph_and_actions\.glb/);
 assert.match(catalog,/sizeBytes: 7_367_524/);
 assert.match(catalog,/sha256: "sha256:9535d6edcbe85d79a7a5cae49aa75ec189b63a0ba7f54b2b9bc24e5488d6046a"/);
 assert.match(catalog,/canonical: false as const/);
 assert.match(catalog,/acceptance: "morph-and-semantic-clips-structural" as const/);
 assert.match(stage,/loadCatalogModel\(KURISU_HYBRID_MODEL_V12_CANDIDATE,"preview"\)/);
 assert.match(stage,/const loadV12Candidate/);
 assert.match(stage,/modelName===KURISU_HYBRID_MODEL_V12_CANDIDATE\.filename/);
 assert.match(stage,/Новый v12 · preview/);
 assert.match(stage,/morph-ready preview/);
 assert.match(stage,/KURISU_HYBRID_MODEL_V7_CANDIDATE\.filename\|\|name===KURISU_HYBRID_MODEL_V12_CANDIDATE\.filename/);
 assert.match(stage,/Кандидат v\$\{name\.includes\("_v12_"\)\?12:7\}: временный preview/);
 assert.match(stage,/KURISU_HYBRID_MODEL_V12_CANDIDATE\.filename\|\|previewPendingRef\.current/);
});

test("hosted model verifier pins the public v12 asset and all morph target names",async()=>{
 const verify=await readFile(path.join(root,"scripts/verify-hosted-kurisu-model.mjs"),"utf8");
 assert.match(verify,/KURISU_HYBRID_MODEL_V12_CANDIDATE/);
 assert.match(verify,/candidate\.morphTargets, 11/);
 assert.match(verify,/gltf\.skins\[0\]\.joints\.length, 19/);
 for(const key of ["EYE_white_L","EYE_white_R","FACE_mouth","HEAD_face","viseme_aa","viseme_oh","viseme_ee","viseme_ih","viseme_ou","NK1_Jaw_Taper"])assert.ok(verify.includes(key),`missing hosted v12 morph contract: ${key}`);
 assert.match(verify,/HOSTED_KURISU_V12_MORPH_PREVIEW=PASS/);
 assert.match(verify,/talk_gesture/);
 assert.match(verify,/thinking_pose/);
 assert.match(verify,/explore_turn/);
 assert.match(verify,/animation\.channels\.length, 57/);
 assert.match(verify,/idle_breathing/);
 assert.match(verify,/talk_gesture/);
 assert.match(verify,/thinking_pose/);
 assert.match(verify,/explore_turn/);
 assert.match(verify,/HOSTED_KURISU_V12_MORPH_PREVIEW=PASS/);
});


test("avatar speech capability and saved preferences hydrate without SSR browser-state divergence",async()=>{
 const stage=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 assert.match(stage,/const \[preferencesHydrated, setPreferencesHydrated\] = useState\(false\)/);
 assert.match(stage,/const \[voiceEnabled, setVoiceEnabled\] = useState\(false\)/);
 assert.match(stage,/const \[voiceName, setVoiceName\] = useState\(""/);
 assert.match(stage,/const \[mode, setMode\] = useState<ViewMode>\("live2d"\)/);
 assert.match(stage,/const \[voiceStatus, setVoiceStatus\] = useState<[^;]+>\("unknown"\)/);
 assert.match(stage,/setPreferencesHydrated\(true\)/);
 assert.match(stage,/if \(!preferencesHydrated\) return;/);
 assert.doesNotMatch(stage,/useState\(\(\) => readAvatarPreference/);
 assert.doesNotMatch(stage,/typeof window !== "undefined" && "speechSynthesis" in window/);
});


test("3D fitting uses rigged character meshes instead of the scene environment floor",async()=>{
 const stage=await readFile(stagePath,"utf8");
 const fit=await readFile(path.join(root,"src/components/avatar/avatarModelFitBounds.ts"),"utf8");
 assert.match(stage,/resolveAvatarModelFitBounds\(root\)/);
 assert.match(fit,/node\.isSkinnedMesh/);
 assert.match(fit,/skinnedMeshes\.length > 0 \? skinnedMeshes : characterMeshes/);
 assert.match(fit,/ENVIRONMENT_NAME/);
 assert.match(fit,/largest > 10 && smallest < 0\.01/);
});


test("3D renderer mode keeps the global avatar toolbar outside the model viewport",async()=>{
 const avatarStage=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 assert.match(avatarStage,/mode === "3d" \|\| mode === "legacy" \|\| mode === "original" \? "relative z-30 flex w-full flex-wrap items-center gap-2 border-b border-border bg-black\/70 p-2 backdrop-blur"\s*:\s*"absolute left-3 top-3 z-30/);
});


test("Legacy outfit controls are not covered by the global avatar toolbar on mobile",async()=>{
 const stage=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 assert.match(stage,/mode === "3d" \|\| mode === "legacy" \|\| mode === "original" \? "relative z-30 flex w-full flex-wrap items-center gap-2 border-b border-border bg-black\/70 p-2 backdrop-blur"\s*:\s*"absolute left-3 top-3 z-30/);
});

test("3D pointer picking declares the Three.js raycaster and vector types",async()=>{
 const stage=await readFile(stagePath,"utf8");
 const threeTypes=await readFile(path.join(root,"src/types/three.d.ts"),"utf8");
 assert.match(stage,/new THREE\.Vector2\(/);
 assert.match(stage,/new THREE\.Raycaster\(/);
 assert.match(threeTypes,/export const Vector2:any/);
 assert.match(threeTypes,/export const Raycaster:any/);
});

test("3D model tools stay inside a collapsed disclosure so the avatar canvas remains tappable",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/const \[controlsOpen\s*,\s*setControlsOpen\]\s*=\s*useState\(false\)/);
 assert.match(stage,/aria-expanded=\{controlsOpen\}/);
 assert.match(stage,/aria-controls="avatar-3d-controls"/);
 assert.match(stage,/\{controlsOpen\s*\?\s*<div id="avatar-3d-controls"/);
 assert.match(stage,/Настройки 3D/);
});


test("3D avatar contact picking includes static head meshes and classifies against complete character bounds", async () => {
 const THREE = await import("three");
 const { resolveAvatarModelFitBounds, resolveAvatarContactZone } = await import("../src/components/avatar/avatarModelFitBounds.ts");
 const stage = await readFile(stagePath, "utf8");
 assert.match(stage, /raycaster\.intersectObjects\(fit\.pickMeshes,true\)/,
   "the production pointer raycast must include every eligible character surface");
 assert.match(stage, /resolveAvatarContactZone\(hit\.point\.y,fit\.contactBounds\)/,
   "the production contact classifier must use the full character envelope");
 const root = new THREE.Group();
 const material = new THREE.MeshBasicMaterial();
 const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), material);
 torso.name = "RiggedTorso";
 torso.position.y = 1.4;
 torso.isSkinnedMesh = true;
 root.add(torso);
 const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), material);
 head.name = "StaticHeadSurface";
 head.position.y = 2.55;
 root.add(head);
 const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 20), material);
 floor.name = "Environment_Floor";
 floor.position.y = -0.05;
 root.add(floor);
 const hiddenRigBranch = new THREE.Group();
 hiddenRigBranch.visible = false;
 const hiddenAccessory = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), material);
 hiddenAccessory.name = "HiddenHeadAccessory";
 hiddenAccessory.position.y = 3.1;
 hiddenRigBranch.add(hiddenAccessory);
 root.add(hiddenRigBranch);

 const fit = resolveAvatarModelFitBounds(root);
 const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
 camera.position.set(0, 2.55, 6);
 camera.lookAt(0, 2.55, 0);
 camera.updateMatrixWorld(true);
 const raycaster = new THREE.Raycaster();
 raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
 const headHit = raycaster.intersectObjects(fit.pickMeshes, true)[0];

 assert.ok(headHit, "the actual raycast must hit a visible static head surface even when a skinned torso exists");
 assert.equal(headHit.object, head);
 assert.equal(resolveAvatarContactZone(headHit.point.y, fit.contactBounds), "head",
   "head contact must be classified against full character bounds, not torso-only fit bounds");
 assert.equal(fit.source, "skinned-meshes", "camera fitting must retain its skinned-mesh preference");
 assert.ok(!fit.pickMeshes.includes(floor), "scene floors must never become contact targets");
 assert.ok(!fit.pickMeshes.includes(hiddenAccessory),
   "meshes under an invisible parent must never become pointer contact targets");
 assert.ok(fit.contactBounds.max.y < hiddenAccessory.position.y,
   "invisible rig branches must not distort the contact envelope");
});

test("animated SkinnedMesh refreshes bone-deformed bounds before pointer raycasting", () => {
 const geometry=new THREE.BoxGeometry(1,1,1);
 const count=geometry.attributes.position.count;
 const skinIndices=new Uint16Array(count*4);
 const skinWeights=new Float32Array(count*4);
 for(let index=0;index<count;index++)skinWeights[index*4]=1;
 geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(skinIndices,4));
 geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(skinWeights,4));
 const root=new THREE.Group();
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 const bone=new THREE.Bone();
 mesh.add(bone);
 root.add(mesh);
 const skeleton=new THREE.Skeleton([bone]);
 mesh.bind(skeleton);
 root.updateMatrixWorld(true);
 skeleton.update();
 mesh.computeBoundingBox();
 mesh.computeBoundingSphere();
 const bindCenter=mesh.boundingSphere.center.clone();
 bone.position.x=4;
 root.updateMatrixWorld(true);
 skeleton.update();
 assert.ok(mesh.boundingSphere.center.distanceTo(bindCenter)<0.001,"the cached sphere is intentionally stale before refresh");
 const camera=new THREE.PerspectiveCamera(50,1,0.1,100);
 camera.position.set(4,0,10);
 camera.lookAt(4,0,0);
 camera.updateMatrixWorld(true);
 const raycaster=new THREE.Raycaster();
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 assert.equal(raycaster.intersectObject(mesh,false).length,0,"a stale skin sphere must not be accepted as an animated hit");
 assert.equal(refreshAvatarRaycastBounds(root),1,"one skinned mesh must be refreshed");
 assert.ok(mesh.boundingSphere.center.x>3.9,"the updated sphere must follow the animated bone");
 assert.ok(mesh.boundingBox.min.x>3.4,"the updated box must follow the animated bone");
 assert.ok(raycaster.intersectObject(mesh,false).length>0,"the same camera ray must hit after the skin bounds are refreshed");
});

test("3D contact refreshes animated skin bounds before intersecting pick meshes",async()=>{
 const stage=await readFile(stagePath,"utf8");
 const refresh=stage.indexOf("refreshAvatarRaycastBounds(target)");
 const intersect=stage.indexOf("raycaster.intersectObjects(fit.pickMeshes,true)");
 assert.ok(refresh>=0&&intersect>refresh,"animated skin bounds must be refreshed before raycast");
});


test("Live2D is a real bundled Cubism rig, while SVG and Legacy remain honestly distinct renderers", async () => {
 const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
 const appRoot = path.join(repoRoot, "app");
 const modelPath = path.join(repoRoot, "runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json");
 const model = JSON.parse(await readFile(modelPath, "utf8"));
 const refs = model.FileReferences;
 assert.equal(model.Version, 3, "the canonical model must be a Cubism 3 model");
 assert.ok(refs?.Moc?.endsWith(".moc3"), "the canonical model must reference a Cubism moc, not a flat image");
 assert.ok(Array.isArray(refs.Textures) && refs.Textures.length > 0, "Cubism model must reference a texture atlas");
 assert.ok(refs.Physics && refs.DisplayInfo, "Cubism model must retain physics and display metadata");
 assert.ok(refs.Expressions?.length >= 7, "Cubism model must provide authored expression assets");
 assert.ok(Object.values(refs.Motions ?? {}).flat().length >= 5, "Cubism model must provide authored motion assets");
 assert.ok(model.Groups?.some((group) => group.Name === "EyeBlink"), "Cubism eye-blink group is required");
 assert.ok(model.Groups?.some((group) => group.Name === "LipSync"), "Cubism lip-sync group is required");
 assert.ok(model.HitAreas?.some((area) => area.Name === "Head"), "Cubism head hit-area is required");
 assert.ok(model.HitAreas?.some((area) => area.Name === "Body"), "Cubism body hit-area is required");

 const base = path.dirname(modelPath);
 const dependencyPaths = [
  refs.Moc, ...refs.Textures, refs.Physics, refs.DisplayInfo,
  ...Object.values(refs.Motions ?? {}).flat().map((motion) => motion.File),
  ...refs.Expressions.map((expression) => expression.File),
 ];
 const lock = JSON.parse(await readFile(path.join(repoRoot, "contracts/inventory/canonical-public-assets-workpass42.json"), "utf8"));
 const locked = new Map(lock.items.map((item) => [item.canonicalPath, item]));
 for (const reference of dependencyPaths) {
  const absolute = path.resolve(base, reference);
  const relative = path.relative(base, absolute);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Cubism reference must remain inside its asset directory");
  const repoPath = path.relative(repoRoot, absolute).split(path.sep).join("/");
  const info = await stat(absolute);
  const item = locked.get(repoPath);
  assert.ok(item, "canonical-public asset manifest must lock " + repoPath);
  assert.equal(info.size, item.sizeBytes, "locked asset size must match " + repoPath);
  assert.match(item.sha256, /^[a-f0-9]{64}$/, "locked asset SHA-256 must be present for " + repoPath);
 }
 assert.ok((await stat(path.join(base, refs.Moc))).size > 5_000_000, "the actual Cubism moc binary must be present");
 assert.ok((await stat(path.join(base, refs.Textures[0]))).size > 8_000_000, "the high-quality texture atlas must be present");

 const viewer = await readFile(path.join(appRoot, "public/live2d/viewer.html"), "utf8");
 for (const script of ["./vendor/pixi.min.js", "./vendor/live2dcubismcore.min.js", "./vendor/cubism4.min.js"]) {
  assert.ok(viewer.includes(script), "the app viewer must use its local pinned runtime: " + script);
 }
 assert.match(viewer, /Live2DModel\.from\(modelPath/);
 const parent = await readFile(path.join(appRoot, "src/components/AvatarStage.tsx"), "utf8");
 assert.match(parent, /src="\/live2d\/viewer\.html\?profile=auto"/);
 assert.match(parent, /type ViewMode = "live2d" \| "legacy" \| "original" \| "3d"/);
 assert.match(parent, /const \[mode, setMode\] = useState<ViewMode>\("live2d"\)/);
 assert.match(parent, /Live2D unavailable/);
 assert.match(parent, /Open Legacy/);

 const originalManifest = JSON.parse(await readFile(path.join(appRoot, "public/kurisu-original/asset-manifest.json"), "utf8"));
 assert.equal(originalManifest.manifestStatus, "planning-inventory");
 assert.ok(originalManifest.assets.every((asset) => asset.status === "not-authored"),
  "Original 2D production art masters must not be presented as already authored");
 const artContract = JSON.parse(await readFile(path.join(appRoot, "public/kurisu-original/character-art-contract.json"), "utf8"));
 assert.ok(artContract.explicitNonGoals.some((item) => item.includes("does not claim 2.5D depth")));
 const originalStage = await readFile(path.join(appRoot, "src/components/KurisuOriginalStage.tsx"), "utf8");
 assert.match(originalStage, /<svg/);
 assert.match(originalStage, /<path/);

 const legacy = await readFile(path.join(appRoot, "src/legacy/avatar/LegacySpriteDeck.tsx"), "utf8");
 assert.match(legacy, /new Image\(/);
 assert.match(legacy, /ctx\.drawImage\(/);
 assert.match(legacy, /still|stills|static/i);
});

test("generic GLB full-body motor is wired after clip playback and only uses audited scene Bones", async () => {
 const stage = await readFile(stagePath, "utf8");
 const adapter = await readFile(path.join(root, "src/components/avatar/glbHumanoidMotorAdapter.ts"), "utf8");
 assert.match(stage, /auditGenericGlbHumanoidScene\(root\)/);
 assert.match(stage, /resolveGenericGlbHumanoidRig\(humanoidAudit\)/);
 assert.match(stage, /applyGenericGlbFullBodyChannels\(rt\.glbRig,p\.bodyChannels\?\?\{\}\)/);
 assert.match(stage, /glbRig:GenericGlbHumanoidRig\|null/);
 assert.match(stage, /rt\.glbRig=vrm\?null:resolveGenericGlbHumanoidRig\(humanoidAudit\)/);
 assert.match(stage, /applyVrmFullBodyChannels\(rt\.vrm,p\.bodyChannels\?\?\{\}\)/);
 const mixerFrame = stage.indexOf("rt.mixer?.update(dt)");
 const genericMotorFrame = stage.indexOf("applyGenericGlbFullBodyChannels(rt.glbRig,p.bodyChannels??{})");
 assert.ok(mixerFrame >= 0 && genericMotorFrame > mixerFrame,
  "generic GLB motor channels must blend on top of the clip pose, not be overwritten by AnimationMixer");
 assert.match(adapter, /auditHumanoidRig\(nodes\)/);
 assert.match(adapter, /value\.isBone !== true/);
 assert.match(adapter, /torsoPitch: \{ role: "spine"/);
 assert.match(adapter, /leftElbow: \{ role: "leftLowerArm"/);
 assert.match(adapter, /leftHip: \{ role: "leftUpperLeg"/);
 assert.match(adapter, /leftKnee: \{ role: "leftLowerLeg"/);
});


import {
  AVATAR_CAMERA_DEFAULT_DISTANCE,
  AVATAR_CAMERA_MAX_DISTANCE,
  AVATAR_CAMERA_MIN_DISTANCE,
  resolveAvatarCameraFitDistance,
} from "../src/components/avatar/avatarViewportControls.ts";

test("3D camera fit frames a compact avatar more closely than a full-height model", () => {
  const compactMobileModel = resolveAvatarCameraFitDistance({ x: 0.84, y: 1.07, z: 0.84 }, 31, 280 / 420);
  const fullHeightModel = resolveAvatarCameraFitDistance({ x: 0.84, y: 3.15, z: 0.84 }, 31, 280 / 420);
  assert.ok(compactMobileModel >= AVATAR_CAMERA_MIN_DISTANCE);
  assert.ok(fullHeightModel > compactMobileModel, "a taller model must move farther from the camera");
  assert.ok(fullHeightModel <= AVATAR_CAMERA_MAX_DISTANCE);
});

test("3D camera fit accounts for viewport aspect and rejects invalid model bounds", () => {
  const narrow = resolveAvatarCameraFitDistance({ x: 2, y: 2, z: 0.3 }, 31, 0.6);
  const wide = resolveAvatarCameraFitDistance({ x: 2, y: 2, z: 0.3 }, 31, 1.8);
  assert.ok(narrow > wide, "a narrow mobile viewport needs more distance for the same width");
  assert.equal(resolveAvatarCameraFitDistance({ x: 0, y: 0, z: 0 }, 31, 1), AVATAR_CAMERA_DEFAULT_DISTANCE);
  assert.equal(resolveAvatarCameraFitDistance({ x: 1, y: Number.NaN, z: 1 }, 31, 1), AVATAR_CAMERA_DEFAULT_DISTANCE);
});

test("3D scene refits after model load and preserves a camera target while zooming", async () => {
  const stage = await readFile(stagePath, "utf8");
  assert.match(stage, /resolveAvatarCameraFitDistance/);
  assert.match(stage, /fitAvatarCameraToModel/);
  assert.match(stage, /cameraTarget/);
  assert.match(stage, /cameraDistance/);
  assert.match(stage, /fitAvatarCameraToModel\(rt,root\)/);
  assert.match(stage, /rt\.camera\.lookAt\(rt\.cameraTarget\)/);
});
