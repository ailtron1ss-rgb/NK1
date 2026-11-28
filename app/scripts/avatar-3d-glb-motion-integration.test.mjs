import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("generic GLB renderer consumes the expressive face and secondary motion adapters", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /import \{ resolveGlbFacialMorphWeights \} from "\.\/avatar\/glbFacialMorphAdapter"/);
  assert.match(stage, /import \{ resolveGlbSecondaryBoneRotation \} from "\.\/avatar\/glbSecondaryMotionAdapter"/);
  assert.match(stage, /import \{ resolveGlbBodyBoneRotation \} from "\.\/avatar\/glbBodyChannelAdapter"/);
  assert.match(stage, /resolveGlbBodyBoneRotation\(n,p\.bodyChannels\?\?\{\}\)/);
  assert.match(stage, /resolveGlbSecondaryBoneRotation\(n,\{timeSeconds:t,awake:p\.awake,energy,action:p\.action,bodyChannels:p\.bodyChannels\?\?\{\}\}\)/);
  assert.match(stage, /node\.morphTargetDictionary,p\.mouthPose,p\.speaking/);
  assert.match(stage, /resolveGlbFacialMorphWeights\(node\.morphTargetDictionary/);
  assert.match(stage, /browRaise:brain\?\.browRaise\?\?0/);
  assert.match(stage, /browFurrow:brain\?\.browFurrow\?\?0/);
  assert.match(stage, /if\(rt\.vrm\)\{applyVrmExpressionFrame/);
  assert.match(stage, /attachAvatarSecondaryVertexDynamics\(root,scale\)/);
  assert.match(stage, /updateAvatarSecondaryVertexDynamics\(rt\.secondaryVertexBindings,adaptiveFrame,t\)/);
  assert.match(stage, /setSecondaryParticleMeshCount\(rt\.secondaryVertexBindings\.filter\(\(binding\)=>!!binding\.particleState\)\.length\)/);
  assert.match(stage, /avatarSecondaryParticleMeshCount/);
  assert.match(stage, /XPBD surface particles/);
  const particleSolver = await readFile(new URL("../src/components/avatar/avatarSecondaryParticleSolver.ts", import.meta.url), "utf8");
  assert.match(particleSolver, /createAvatarSecondaryParticleState/);
  assert.match(particleSolver, /stepAvatarSecondaryParticleState/);
  assert.match(particleSolver, /SOLVER_ITERATIONS/);
  assert.match(particleSolver, /MAX_PARTICLES/);
  assert.match(stage, /disposeAvatarSecondaryVertexDynamics\(rt\.secondaryVertexBindings\)/);
  assert.match(stage, /XPBD surface particles/);
  assert.match(stage, /XPBD-частицы ждут подходящей топологии/);
  assert.match(stage, /Вторичная динамика не подключена/);
  assert.match(stage, /resolveAvatarCameraFraming/);
  assert.match(stage, /node\.skeleton\?\.update\?\.\(\)/, "skinned skeleton palettes refresh before camera bounds");
  assert.match(stage, /node\.computeBoundingBox\?\.\(\)/, "skinned mesh bounds are recomputed after pose updates");
  assert.ok(stage.includes('import { forEachAvatarRenderedVertexIndex, resolveAvatarSceneBounds } from "./avatar/avatarSceneBounds"'), "avatar loader uses the indexed rendered-surface bounds adapter");
  assert.match(stage, /const sourceSceneBounds=resolveAvatarSceneBounds\(root\)/, "source normalization excludes studio/environment geometry");
  assert.match(stage, /const normalizedSceneBounds=resolveAvatarSceneBounds\(root\)/, "camera framing uses pose-aware character-only bounds");
  assert.match(stage, /excludedEnvironmentMeshes:\s*sourceSceneBounds\.excludedEnvironmentMeshes/, "runtime diagnostics disclose excluded environment meshes");
  assert.match(stage, /avatarVisibleMeshCount/);
  assert.match(stage, /avatarRenderCalls/);
  assert.match(stage, /function applyAvatarCameraFit\(rt:Runtime,bounds:any\)/);
  assert.match(stage, /rt\.renderer\.domElement\.dataset\.avatarVisibleMeshCount/);
  assert.match(stage, /if\(rt\.cameraBounds\)\{const fit=applyAvatarCameraFit/);
  assert.match(stage, /rt\.cameraBounds=null/);
});
test("GLB diagnostics and camera framing share the morph-aware skinned vertex surface", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /node\.getVertexPosition\(index,\s*auditVertex\)/,
    "vertex audit must include the current morph and skin deformation");
  assert.match(stage, /const cameraBoundsSource\s*=\s*skinVertexBounds\s*\?/,
    "camera fit must prefer the exact deformed surface bounds");
  assert.match(stage, /const cameraBounds=skinVertexBounds\s*\?/,
    "camera fit bounds must use the same vertex audit result");
});

test("GLB browser diagnostics expose per-mesh surface bounds and projected fit", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /extremeMeshBounds/,
    "skin audit must identify mesh nodes that contribute outsized bounds");
  assert.match(stage, /cameraProjectionAudit/,
    "runtime must report projected bounds computed by the active camera");
});

