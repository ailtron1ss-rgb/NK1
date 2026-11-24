import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  avatarBrainBodyChannels,
  avatarBrainFrameForTick,
  avatarBrainGaze,
  avatarBrainHeadTilt,
  avatarBrainLive2DExpression,
  avatarBrainMouthPose,
} from "../src/components/avatar/avatarBrainUi.ts";

const frame = () => ({
  schemaVersion: 1,
  profile: "3d",
  expression: "curious",
  expressionWeight: .7,
  source: "organism-state",
  affect: { valence01:.6, arousal01:.7, dominance01:.6, curiosity01:.8, warmth01:.6, stress01:.2, confidence01:.8, memoryRecall01:0 },
  channels: { eyeOpen:.8, browRaise:.7, browFurrow:.1, mouthSmile:.5, mouthOpen:.2, cheekRaise:.4, headTilt:.4, headYaw:-.2, gazeX:1, gazeY:-.5, idleMotion:.3, lipSyncGain:.75 },
  freshness01:1,
  reducedMotion:false,
  rendererHints:{live2d:{ParamEyeLOpen:.8},layered2d:{parallax01:.2,depthBreath01:.1,faceRig01:.6},spatial3d:{headPitch:.04,headYaw:-.2,gazeDistance01:.6,shoulderRelax01:.7}},
  projectedAt:1000,
});
const envelope = (stateVersion=42) => ({ schemaVersion:1, stateVersion, frame:frame() });

test("uses only the avatar brain frame matching the canonical snapshot tick",()=>{
  assert.deepEqual(avatarBrainFrameForTick(envelope(42),42),frame());
  assert.equal(avatarBrainFrameForTick(envelope(41),42),null);
  assert.equal(avatarBrainFrameForTick(null,42),null);
});

test("maps canonical expressions into the supported Live2D expression vocabulary",()=>{
  const f=frame();
  assert.equal(avatarBrainLive2DExpression(f),"thinking");
  assert.equal(avatarBrainLive2DExpression({...f,expressionWeight:.05}),"neutral");
  assert.equal(avatarBrainLive2DExpression({...f,expression:"amused"}),"happy");
  assert.equal(avatarBrainLive2DExpression({...f,expression:"concerned"}),"sad");
  assert.equal(avatarBrainLive2DExpression({...f,expression:"determined"}),"focused");
});

test("bounds shared gaze and head channels for the renderer-specific contracts",()=>{
  const f=frame();
  assert.deepEqual(avatarBrainGaze(f,{x:0,y:0}),{x:.4,y:-.2});
  assert.deepEqual(avatarBrainGaze(null,{x:9,y:-9}),{x:.4,y:-.4});
  assert.equal(avatarBrainHeadTilt(f,0),.06);
  assert.deepEqual(avatarBrainBodyChannels(f),{headRoll:.4,headYaw:-.2,gazeX:1,gazeY:-.5,breath:.3});
});

test("preserves audio viseme shape while applying bounded brain lip-sync gain",()=>{
  const f=frame();
  const pose={open:.8,form:.4,viseme:"wide"};
  assert.ok(Math.abs(avatarBrainMouthPose(pose,f,true).open - .6) < 1e-12);
  assert.equal(avatarBrainMouthPose(pose,f,true).form,.4);
  assert.equal(avatarBrainMouthPose(pose,f,true).viseme,"wide");
  assert.deepEqual(avatarBrainMouthPose(pose,null,true),pose);
  assert.equal(avatarBrainMouthPose(pose,f,false).open,.015);
});


test("all continuous avatar renderers consume the same tick-matched brain frame", async () => {
 const [stage, original, three] = await Promise.all([
  readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8"),
 ]);
 assert.match(stage, /avatarBrainFrameForTick\(snap\.avatarBrain, snap\.tick\)/);
 assert.match(stage, /avatarBrainLive2DExpression\(currentBrainFrame\)/);
 assert.match(stage, /avatarBrainChannels=\{currentBrainChannels \?\? undefined\}/);
 assert.match(original, /const eyeAperture = avatarBrainChannels \?/);
 assert.match(original, /avatarBrainChannels\.browRaise/);
 assert.match(original, /avatarBrainChannels\.mouthSmile/);
 assert.match(three, /avatarBrainChannels\?: AvatarBrainChannelsV1/);
});
