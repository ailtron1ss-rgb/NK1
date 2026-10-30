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
test("the 3D body consumes organism emotion, action, arousal/valence, gaze, sleep and speech",async()=>{
 const stage=await readFile(stagePath,"utf8"),parent=await readFile(path.join(root,"src/components/AvatarStage.tsx"),"utf8");
 for(const key of ["emotion","arousal","valence","dominance","energy","cognitiveLoad","uncertainty","socialNeed","novelty","goalPressure","curiosity","predictionError","traits","gazeX","gazeY","speaking","mouthPose","thinking","awake","action"])assert.ok(stage.includes(key),"Missing state: "+key);
 for(const key of ["b.head.rotation","b.leftArm.rotation","b.rightArm.rotation","b.mouth.scale","rt.mood.color","rt.mixer"])assert.ok(stage.includes(key),"Missing body response: "+key);
 assert.match(parent,/emotion=\{snap\.emotion\.label\} action=\{snap\.lastOption\}/);assert.match(parent,/arousal=\{snap\.emotion\.arousal\} valence=\{snap\.emotion\.valence\}/);assert.match(parent,/cognitiveLoad=\{snap\.needs\.cognitiveLoad\}/);assert.match(parent,/traits=\{snap\.identity\.traits\}/);assert.match(parent,/predictionError=\{snap\.predictionError\}/);assert.match(parent,/mouthPose=\{mouthPose\} thinking=\{thinking\} awake=\{snap\.awake\}/);
});
test("renderer resources and animation loops are disposed and high-DPI rendering is capped",async()=>{
 const stage=await readFile(stagePath,"utf8");assert.match(stage,/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,2\)\)/);assert.match(stage,/cancelAnimationFrame\(raf\)/);assert.match(stage,/Reset to bind pose before the mixer/);assert.match(stage,/return clips\.find\(\(clip\)=>rules\[action\]\.test/);assert.doesNotMatch(stage,/\|\|clips\[0\]\|\|null/);assert.match(stage,/observer\?\.disconnect\(\)/);assert.match(stage,/renderer\.dispose\(\)/);assert.match(stage,/disposeTree\(rt\.loaded\)/);
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


test("procedural 3D avatar exposes real selectable lab-coat, casual and hoodie geometry",async()=>{const stage=await readFile(stagePath,"utf8");assert.match(stage,/wardrobe:casual/);assert.match(stage,/wardrobe:hoodie/);assert.match(stage,/function applyProceduralOutfit/);assert.match(stage,/node\.visible=lab/);for(const label of ["Лабораторный халат","Повседневный","Худи"])assert.ok(stage.includes(label),"Missing outfit control: "+label);assert.match(stage,/aria-pressed=\{proceduralOutfit===/);});


test("uploaded VRM stage exposes a rights-confirmed verified wardrobe pack application path",async()=>{
 const stage=await readFile(stagePath,"utf8");
 assert.match(stage,/applyVerifiedVrmWardrobePack/);
 assert.match(stage,/readWardrobeBundle/);
 assert.match(stage,/validateWardrobePackManifest\(value\.manifest\)/);
 assert.match(stage,/expectedBase64Length/);
 assert.match(stage,/Файл не объявлен в manifest/);
 assert.match(stage,/В bundle отсутствуют файлы/);
 assert.match(stage,/nk1-wardrobe-pack/);
 assert.match(stage,/avatarWardrobeBodyId/);
 assert.match(stage,/globalThis\.crypto\.subtle\.digest\("SHA-256"/);
 assert.match(stage,/normalized|toLowerCase/);
 assert.match(stage,/targetRigVersion:WARDROBE_RIG_VERSION/);
 assert.match(stage,/renderer:"vrm3d"/);
 assert.match(stage,/wardrobeRightsConfirmed/);
 assert.match(stage,/Подтверждаю, что имею право использовать все ресурсы/);
 assert.match(stage,/Применить выбранные элементы к VRM/);
 assert.match(stage,/setWardrobePack\(null\)/);
});


test("VRM wardrobe UI supports independent slot selection and keeps body identity wardrobe-independent",async()=>{
 const stage=await readFile(stagePath,"utf8"),adapter=await readFile(path.join(root,"src/components/avatar/vrmWardrobeAdapter.ts"),"utf8");
 assert.match(stage,/collectVrmAvatarRigIdentityDescriptors/);
 assert.match(stage,/wardrobeSelectedAssetIds/);
 assert.match(stage,/defaultWardrobeAssetSelection\(pack\.manifest,"vrm3d"\)/);
 assert.match(stage,/updateWardrobeAssetSelection\(wardrobePack\.manifest,"vrm3d",current,asset\.id,checked\)/);
 assert.match(stage,/Выберите элементы, которые нужно заменить/);
 assert.match(stage,/expectedAssetIds=\[\.\.\.new Set\(wardrobeSelectedAssetIds\)\]/);
 assert.match(stage,/checked=event\.currentTarget\.checked/);
 assert.match(adapter,/visitBaseAvatarRig/);
 assert.match(adapter,/nk1WardrobeSlot !== undefined/);
 assert.match(adapter,/collectVrmAvatarRigIdentityDescriptors/);
});


test("VRM wardrobe selection persists only against exact body/rig identity and restores after hash verification",async()=>{
 const stage=await readFile(stagePath,"utf8"),store=await readFile(path.join(root,"src/components/avatar/wardrobePackStore.ts"),"utf8");
 assert.match(stage,/saveStoredWardrobePack/);
 assert.match(stage,/loadStoredWardrobePack/);
 assert.match(stage,/rightsAttested:wardrobeRightsConfirmed/);
 assert.match(stage,/loadStoredWardrobePack\(bodyId,WARDROBE_RIG_VERSION\)/);
 assert.match(stage,/isCurrent:\(\)=>loadToken\.current===token&&runtime\.current===rt&&rt\.loaded===root/);
 assert.match(stage,/isCurrent:\(\)=>requestToken===loadToken\.current&&runtime\.current===rt&&rt\.loaded===targetRoot/);
 assert.match(stage,/stored\.status!=="restored"/);
 assert.match(stage,/setWardrobeSelectedAssetIds\(restored\.selectedAssetIds\)/);
 assert.match(store,/indexedDB\.open/);
 assert.match(store,/verifyWardrobePackPayload/);
 assert.match(store,/record\.bodyId !== bodyId \|\| record\.rigVersion !== rigVersion/);
 assert.match(store,/rightsAttestedAt/);
 assert.match(store,/MAX_STORED_WARDROBE_BYTES/);
});
