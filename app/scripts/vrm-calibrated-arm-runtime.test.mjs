import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareVrmArmRuntimeBinding,
  solveCalibratedVrmArmGesture,
  applyCalibratedVrmArmGesture,
} from "../src/components/avatar/vrmCalibratedArmRuntime.ts";

const bone=(name,rotation={x:0,y:0,z:0})=>({name,rotation});
const left={
  shoulder:bone("LeftUpperArm",{x:0,y:0,z:-.1}),
  elbow:bone("LeftLowerArm",{x:0,y:0,z:.2}),
  hand:bone("LeftHand"),
};
const right={
  shoulder:bone("RightUpperArm",{x:0,y:0,z:.1}),
  elbow:bone("RightLowerArm",{x:0,y:0,z:.2}),
  hand:bone("RightHand"),
};
const points={
  left:{shoulder:{x:-.2,y:1,z:0},elbow:{x:-.45,y:1,z:0},hand:{x:-.65,y:1,z:0}},
  right:{shoulder:{x:.2,y:1,z:0},elbow:{x:.45,y:1,z:0},hand:{x:.65,y:1,z:0}},
};
const frameId="kurisu.root.meter.v1";
const preparedLeft=prepareVrmArmRuntimeBinding("left",left,points.left,frameId);
const preparedRight=prepareVrmArmRuntimeBinding("right",right,points.right,frameId);
const context={modelFingerprint:"sha256:model-001",coordinateFrameId:frameId,left,right};
const armCalibration=(shoulderBoneName,elbowBoneName)=>({
  shoulderAxis:"z",elbowAxis:"z",shoulderSign:1,elbowSign:1,
  shoulderOffsetRad:0,elbowOffsetRad:0,shoulderMinRad:-1.2,shoulderMaxRad:1.2,
  elbowMinRad:0,elbowMaxRad:2.4,shoulderBoneName,elbowBoneName,
});
const profile={
  schemaVersion:1,modelFingerprint:context.modelFingerprint,coordinateFrameId:frameId,calibrationMethod:"manual-measured",
  left:armCalibration("LeftUpperArm","LeftLowerArm"),
  right:armCalibration("RightUpperArm","RightLowerArm"),
};
const readyState=(overrides={})=>({
  action:"respond",emotion:"neutral",speaking:true,awake:true,uncertainty:.1,cognitiveLoad:.2,...overrides,
});

test("prepares a full shoulder/elbow/hand chain in one model coordinate frame",()=>{
  assert.equal(preparedLeft.accepted,true);assert.equal(preparedRight.accepted,true);
  if(preparedLeft.accepted&&preparedRight.accepted){
    assert.ok(Math.abs(preparedLeft.binding.upperArmLengthM-.25)<1e-9);
    assert.ok(Math.abs(preparedLeft.binding.forearmLengthM-.2)<1e-9);
    assert.equal(preparedLeft.binding.coordinateFrameId,frameId);
    assert.equal(Object.isFrozen(preparedLeft.binding.bindPose),true);
  }
});

test("rejects missing coordinate identity, unrealistic segment lengths and out-of-plane rigs",()=>{
  assert.deepEqual(prepareVrmArmRuntimeBinding("left",left,points.left,""),{accepted:false,reason:"invalid-coordinate-frame"});
  assert.deepEqual(prepareVrmArmRuntimeBinding("left",left,{...points.left,hand:{x:-4,y:1,z:0}},frameId),
    {accepted:false,reason:"invalid-segment-length"});
  assert.deepEqual(prepareVrmArmRuntimeBinding("left",left,{...points.left,elbow:{x:-.45,y:1,z:.3}},frameId),
    {accepted:false,reason:"off-plane-rig"});
});

test("only exact profile-bound semantic actions produce calibrated absolute poses",()=>{
  assert.equal(preparedLeft.accepted,true);assert.equal(preparedRight.accepted,true);
  if(!preparedLeft.accepted||!preparedRight.accepted)return;
  const explore=solveCalibratedVrmArmGesture(preparedLeft.binding,profile,context,readyState({action:"explore",speaking:false}));
  assert.equal(explore.accepted,true);
  if(explore.accepted){assert.ok(Number.isFinite(explore.pose.shoulder.z));assert.ok(Number.isFinite(explore.pose.elbow.z));}
  const respond=solveCalibratedVrmArmGesture(preparedRight.binding,profile,context,readyState());
  assert.equal(respond.accepted,true);
  const idle=solveCalibratedVrmArmGesture(preparedRight.binding,profile,context,readyState({action:"wait",speaking:false}));
  assert.deepEqual(idle,{accepted:false,reason:"no-calibrated-gesture-requested"});
  const asleep=solveCalibratedVrmArmGesture(preparedRight.binding,profile,context,readyState({awake:false}));
  assert.deepEqual(asleep,{accepted:false,reason:"no-calibrated-gesture-requested"});
});

test("crossed-arm intent targets both chains toward the midline without bypassing joint limits",()=>{
  assert.equal(preparedLeft.accepted,true);assert.equal(preparedRight.accepted,true);
  if(!preparedLeft.accepted||!preparedRight.accepted)return;
  const state=readyState({action:"wait",emotion:"anger",speaking:false});
  const l=solveCalibratedVrmArmGesture(preparedLeft.binding,profile,context,state);
  const r=solveCalibratedVrmArmGesture(preparedRight.binding,profile,context,state);
  assert.equal(l.accepted,true);assert.equal(r.accepted,true);
  if(l.accepted&&r.accepted){assert.ok(l.target.x>preparedLeft.binding.shoulder.x);assert.ok(r.target.x<preparedRight.binding.shoulder.x);}
});

test("rejects cross-model and cross-coordinate calibration profiles before IK",()=>{
  assert.equal(preparedLeft.accepted,true);if(!preparedLeft.accepted)return;
  assert.deepEqual(solveCalibratedVrmArmGesture(preparedLeft.binding,{...profile,modelFingerprint:"sha256:other"},context,
    readyState({action:"explore"})),{accepted:false,reason:"model-fingerprint-mismatch"});
  assert.deepEqual(solveCalibratedVrmArmGesture(preparedLeft.binding,{...profile,coordinateFrameId:"camera"},context,
    readyState({action:"explore"})),{accepted:false,reason:"coordinate-frame-mismatch"});
});

test("applies calibrated gesture as an absolute blended pose and never accumulates bind-pose drift",()=>{
  assert.equal(preparedRight.accepted,true);if(!preparedRight.accepted)return;
  const result=applyCalibratedVrmArmGesture(preparedRight.binding,profile,context,readyState(),1);
  assert.equal(result.accepted,true);
  if(result.accepted){
    assert.equal(right.shoulder.rotation.z,result.pose.shoulder.z);
    assert.equal(right.elbow.rotation.z,result.pose.elbow.z);
  }
  const reset=applyCalibratedVrmArmGesture(preparedRight.binding,profile,context,readyState(),0);
  assert.equal(reset.accepted,true);
  assert.equal(right.shoulder.rotation.z,result.accepted?result.pose.shoulder.z:right.shoulder.rotation.z);
});
