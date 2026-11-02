import assert from 'node:assert/strict';
import { projectAvatarBrainState } from '../src/organism/body/AvatarBrainAffectBridge.ts';
import { mapAvatarProjectionToRenderer } from '../src/organism/body/AvatarRendererAdapter.ts';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';

const state={needs:{energy:.8,cognitiveLoad:.2,uncertainty:.2,socialNeed:.7,novelty:.8,identityCoherence:.8,goalPressure:.3},predictionError:.1,lastActionSuccess:.9,lastPredictionConfidence:.85,autonomyScore:.75};
const body={awake:true,bodyEnergy01:.82,thermalStrain01:.1,cognitiveCapacity01:.9};

const two=projectAvatarBrainState({state,body,now:10000,profile:'2d'});
assert.equal(two.rendererHints.live2d.ParamEyeBallX,two.channels.gazeX);
assert.equal(two.rendererHints.live2d.ParamEyeBallY,two.channels.gazeY);
const live2dIds=['ParamEyeLOpen','ParamEyeROpen','ParamEyeBallX','ParamEyeBallY','ParamBrowLY','ParamBrowRY','ParamMouthForm','ParamMouthOpenY','ParamAngleX','ParamAngleY','ParamAngleZ'];
const live2d=mapAvatarProjectionToRenderer(two,{profile:'2d',parameterIds:live2dIds});
assert.equal(live2d.compatible,true);
assert.equal(live2d.commands.length,live2dIds.length);
assert.ok(live2d.commands.every(x=>x.target==='parameter'&&Number.isFinite(x.value)));
assert.ok(live2d.commands.find(x=>x.id==='ParamAngleX').value>=-30);
const noLive2d=mapAvatarProjectionToRenderer(two,{profile:'2d',parameterIds:['ParamEyeLOpen']});
assert.deepEqual(noLive2d.commands,[{target:'parameter',id:'ParamEyeLOpen',value:two.channels.eyeOpen}]);
assert.equal(noLive2d.skipped,live2dIds.length-1);

const layered=projectAvatarBrainState({state,body,now:10000,profile:'2.5d'});
const layeredMap=mapAvatarProjectionToRenderer(layered,{profile:'2.5d',controlIds:['parallaxX','parallaxY','depthBreath01','faceRig01']});
assert.equal(layeredMap.commands.length,4);
assert.ok(layeredMap.commands.find(x=>x.id==='parallaxX').value>=-1);
assert.ok(layeredMap.commands.find(x=>x.id==='faceRig01').value>=0);

const spatial=projectAvatarBrainState({state,body,now:10000,profile:'3d'});
const spatialMap=mapAvatarProjectionToRenderer(spatial,{profile:'3d',controlIds:['headPitch','headYaw','gazeDistance01','shoulderRelax01'],expressionIds:[spatial.expression]});
assert.equal(spatialMap.commands.length,5);
assert.ok(spatialMap.commands.some(x=>x.target==='expression'&&x.id===spatial.expression));
const spatialExpressionCommand=spatialMap.commands.find(x=>x.target==='expression');
assert.equal(spatialExpressionCommand?.value,spatial.expressionWeight,'VRM expression intensity must come from the bounded brain projection');
assert.ok(spatial.expressionWeight>=0&&spatial.expressionWeight<=1,'expression weight must honor the VRM 0..1 contract');

const missingExpression=mapAvatarProjectionToRenderer(spatial,{profile:'3d',controlIds:['headPitch']});
assert.equal(missingExpression.commands.length,1);
assert.equal(missingExpression.skipped,4,'unavailable rig expressions and controls are skipped explicitly');

const mismatch=mapAvatarProjectionToRenderer(two,{profile:'3d',controlIds:['headYaw']});
assert.equal(mismatch.compatible,false);
assert.deepEqual(mismatch.commands,[]);
const nonFinite={...two,rendererHints:{...two.rendererHints,live2d:{...two.rendererHints.live2d,ParamEyeLOpen:Number.NaN}}};
const guarded=mapAvatarProjectionToRenderer(nonFinite,{profile:'2d',parameterIds:live2dIds});
assert.ok(!guarded.commands.some(x=>x.id==='ParamEyeLOpen'));
assert.equal(guarded.skipped,1);

const runtime=new EmbodimentRuntime();
const runtimeMapped=runtime.avatarRendererMapping(state,{profile:'2d',parameterIds:live2dIds},{now:50000});
assert.equal(runtimeMapped.compatible,true);
assert.equal(runtimeMapped.commands.length,live2dIds.length,'EmbodimentRuntime must expose mapped renderer commands from organism state');
const runtime3d=runtime.avatarRendererMapping(state,{profile:'3d',controlIds:['headYaw']},{now:50100});
assert.equal(runtime3d.compatible,true,'runtime must build the projection for the selected 3D renderer');
assert.deepEqual(runtime3d.commands,[{target:'control',id:'headYaw',value:runtime3d.commands[0]?.value}]);
assert.ok(Number.isFinite(runtime3d.commands[0]?.value),'only loaded and finite 3D controls reach the renderer command batch');

console.log('avatar-renderer-adapter: PASS');
