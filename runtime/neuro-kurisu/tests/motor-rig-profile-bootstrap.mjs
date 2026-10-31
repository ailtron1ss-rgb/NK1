import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_MOTOR_RIG_PROFILE_CONFIG_BYTES, parseMotorRigProfileConfigJson } from '../src/organism/body/MotorRigProfileBootstrap.ts';
const cal={status:'calibrated',evidenceId:'nk1.calibration.host-test',calibratedAt:'2026-10-31T08:00:00.000Z',verifierVersion:'host-profile-test-v1'};
function profile(renderer,modelId){
 const live=renderer==='live2d',depth=renderer==='depth2d';
 return {schemaVersion:1,profileId:'nk1.test.'+renderer+'.'+modelId,modelId,revision:1,renderer,
 coordinateFrame:{handedness:'right',upAxis:'y',forwardAxis:'-z',positionUnit:live||depth?'normalized':'meters',angleUnit:'radians'},
 calibration:structuredClone(cal),
 joints:[{id:'head-yaw',role:'head.yaw',parentId:null,minAngleRad:-.8,maxAngleRad:.8,restAngleRad:0,maxSpeedRadPerSec:1.5,maxAccelerationRadPerSec2:8,maxJerkRadPerSec3:80,
 ...(live?{}:{geometry:{offset:{x:0,y:0,z:0},axis:{x:0,y:1,z:0}}}),
 binding:{targetId:live?'ParamHeadAngleY':depth?'head':'Head',targetKind:live?'cubism-parameter':depth?'depth-rig-node':'humanoid-bone',
 component:live?'value':depth?'rotation':'y',scale:depth?90:1,offset:0,minValue:depth?-72:live?-100:-.8,maxValue:depth?72:live?100:.8,
 fidelity:live?'approximate':'direct',requiredInFrame:true}}]};
}
const cfg=(profiles,extra={})=>JSON.stringify({schemaVersion:1,profiles,...extra});
test('accepts Live2D, DepthRig and VRM projections over one canonical skeleton',()=>{
 const r=parseMotorRigProfileConfigJson(cfg([profile('live2d','kurisu-live'),profile('depth2d','kurisu-depth'),profile('vrm3d','kurisu-vrm')]));
 assert.equal(r.accepted,true);if(r.accepted)assert.deepEqual(r.profiles.map(p=>p.renderer),['live2d','depth2d','vrm3d']);
});
test('rejects empty, malformed, oversized and unsupported config',()=>{
 assert.equal(parseMotorRigProfileConfigJson('').reason,'motor-rig-profile-config-size-invalid');
 assert.equal(parseMotorRigProfileConfigJson('{').reason,'motor-rig-profile-config-json-invalid');
 assert.equal(parseMotorRigProfileConfigJson(' '.repeat(MAX_MOTOR_RIG_PROFILE_CONFIG_BYTES+1)).reason,'motor-rig-profile-config-size-invalid');
 assert.equal(parseMotorRigProfileConfigJson(cfg([profile('live2d','kurisu-live')],{schemaVersion:2})).reason,'motor-rig-profile-config-schema-invalid');
});
test('rejects fixtures and duplicate renderer/model identities',()=>{
 const fixture=profile('live2d','kurisu-live');fixture.calibration.status='test-fixture';
 assert.equal(parseMotorRigProfileConfigJson(cfg([fixture])).reason,'motor-rig-profile-not-production-calibrated');
 assert.equal(parseMotorRigProfileConfigJson(cfg([profile('live2d','kurisu-live'),{...profile('live2d','kurisu-live'),profileId:'nk1.test.live.second'}])).reason,'motor-rig-renderer-model-duplicate');
});
test('rejects renderer profiles which do not share the canonical skeleton',()=>{
 const altered=profile('vrm3d','kurisu-vrm');altered.joints[0].maxAngleRad=.7;
 assert.equal(parseMotorRigProfileConfigJson(cfg([profile('live2d','kurisu-live'),altered])).reason,'motor-rig-profile-canonical-skeleton-mismatch');
});
