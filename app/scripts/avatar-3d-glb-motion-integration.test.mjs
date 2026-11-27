import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("generic GLB renderer consumes the expressive face and secondary motion adapters", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /import \{ resolveGlbFacialMorphWeights \} from "\.\/avatar\/glbFacialMorphAdapter"/);
  assert.match(stage, /import \{ resolveGlbSecondaryBoneRotation \} from "\.\/avatar\/glbSecondaryMotionAdapter"/);
  assert.match(stage, /resolveGlbSecondaryBoneRotation\(n,\{timeSeconds:t,awake:p\.awake,energy,action:p\.action,bodyChannels:p\.bodyChannels\?\?\{\}\}\)/);
  assert.match(stage, /node\.morphTargetDictionary,p\.mouthPose,p\.speaking/);
  assert.match(stage, /resolveGlbFacialMorphWeights\(node\.morphTargetDictionary/);
  assert.match(stage, /browRaise:brain\?\.browRaise\?\?0/);
  assert.match(stage, /browFurrow:brain\?\.browFurrow\?\?0/);
  assert.match(stage, /if\(rt\.vrm\)\{applyVrmExpressionFrame/);
  assert.match(stage, /attachAvatarSecondaryVertexDynamics\(root,scale\)/);
  assert.match(stage, /updateAvatarSecondaryVertexDynamics\(rt\.secondaryVertexBindings,adaptiveFrame,t\)/);
  assert.match(stage, /disposeAvatarSecondaryVertexDynamics\(rt\.secondaryVertexBindings\)/);
  assert.match(stage, /GPU vertex sway/);
  assert.match(stage, /ограниченный GPU sway активен на/);
  assert.match(stage, /Костные цепочки и специальные morph-каналы отсутствуют/);
});
