import test from "node:test";
import assert from "node:assert/strict";
import { getVrmArmCalibration, parseVrmRigCalibrationProfileJson, serializeVrmRigCalibrationProfileJson, validateVrmRigCalibrationProfile } from "../src/components/avatar/vrmRigCalibrationProfile.ts";

const calibration = { shoulderAxis:"z", elbowAxis:"z", shoulderSign:1, elbowSign:1, shoulderOffsetRad:0, elbowOffsetRad:0, shoulderMinRad:-1.2, shoulderMaxRad:1.2, elbowMinRad:0, elbowMaxRad:2.4 };
const bone = (name) => ({ name, rotation:{x:0,y:0,z:0} });
const context = { modelFingerprint:"sha256:avatar-a", coordinateFrameId:"avatar-root-m", left:{shoulder:bone("LeftUpperArm"),elbow:bone("LeftLowerArm")}, right:{shoulder:bone("RightUpperArm"),elbow:bone("RightLowerArm")} };
const profile = { schemaVersion:1, modelFingerprint:"sha256:avatar-a", coordinateFrameId:"avatar-root-m", calibrationMethod:"manual-measured", left:{...calibration,shoulderBoneName:"LeftUpperArm",elbowBoneName:"LeftLowerArm"}, right:{...calibration,shoulderBoneName:"RightUpperArm",elbowBoneName:"RightLowerArm"} };

test("accepts and deeply freezes an exact bilateral model calibration",()=>{const result=validateVrmRigCalibrationProfile(profile,context);assert.equal(result.accepted,true);if(!result.accepted)return;assert.ok(Object.isFrozen(result.profile));assert.ok(Object.isFrozen(result.profile.left));assert.equal(getVrmArmCalibration(result.profile,"right").shoulderAxis,"z");});
test("rejects profiles from a different model or coordinate frame",()=>{assert.deepEqual(validateVrmRigCalibrationProfile(profile,{...context,modelFingerprint:"sha256:other"}),{accepted:false,reason:"model-fingerprint-mismatch"});assert.deepEqual(validateVrmRigCalibrationProfile(profile,{...context,coordinateFrameId:"camera"}),{accepted:false,reason:"coordinate-frame-mismatch"});});
test("rejects missing, ambiguous-by-identity and mismatched arm rigs",()=>{assert.deepEqual(validateVrmRigCalibrationProfile(profile,{...context,left:null}),{accepted:false,reason:"left-rig-mismatch"});assert.deepEqual(validateVrmRigCalibrationProfile(profile,{...context,right:{...context.right,elbow:bone("RightForearmOther")}}),{accepted:false,reason:"right-rig-mismatch"});});
test("rejects unknown schema, malformed values and invalid joint ranges",()=>{assert.deepEqual(validateVrmRigCalibrationProfile({...profile,schemaVersion:2},context),{accepted:false,reason:"unsupported-schema"});assert.deepEqual(validateVrmRigCalibrationProfile({...profile,left:{...profile.left,shoulderSign:0}},context),{accepted:false,reason:"invalid-profile"});assert.deepEqual(validateVrmRigCalibrationProfile({...profile,right:{...profile.right,elbowMinRad:3,elbowMaxRad:1}},context),{accepted:false,reason:"invalid-calibration"});});

test("classifies structurally valid but physically invalid calibration separately",()=>{
  assert.deepEqual(validateVrmRigCalibrationProfile({...profile,left:{...profile.left,shoulderMinRad:2,shoulderMaxRad:1}},context),{accepted:false,reason:"invalid-calibration"});
  assert.deepEqual(validateVrmRigCalibrationProfile({...profile,right:{...profile.right,elbowOffsetRad:Math.PI*3}},context),{accepted:false,reason:"invalid-calibration"});
});
test("rejects blank bone identities as malformed profile data",()=>{
  assert.deepEqual(validateVrmRigCalibrationProfile({...profile,left:{...profile.left,shoulderBoneName:"  "}},context),{accepted:false,reason:"invalid-profile"});
});

test("imports JSON only after exact loaded-rig validation and round-trips deterministically",()=>{
  const json=serializeVrmRigCalibrationProfileJson(profile,context);
  assert.equal(typeof json,"string");
  const imported=parseVrmRigCalibrationProfileJson(json,context);
  assert.equal(imported.accepted,true);
  if(imported.accepted){
    assert.deepEqual(imported.profile,validateVrmRigCalibrationProfile(profile,context).profile);
    assert.equal(serializeVrmRigCalibrationProfileJson(imported.profile,context),json);
  }
  assert.deepEqual(parseVrmRigCalibrationProfileJson("{not-json",context),{accepted:false,reason:"invalid-profile"});
  assert.deepEqual(parseVrmRigCalibrationProfileJson(" ".repeat(32_769),context),{accepted:false,reason:"invalid-profile"});
  assert.equal(serializeVrmRigCalibrationProfileJson(profile,{...context,modelFingerprint:"sha256:other"}),null);
});


import { calibrateVrmArmFromMeasurement, createMeasuredVrmRigCalibrationProfile } from "../src/components/avatar/vrmRigCalibrationProfile.ts";

const measuredArm = (offset = 0) => ({
  shoulderAxis:"z", elbowAxis:"x", shoulderSign:1, elbowSign:-1,
  bindShoulder:{x:0,y:0,z:0.1}, bindElbow:{x:1.0,y:0,z:0},
  observedShoulder:{x:0,y:0,z:0.1+0.5+offset}, observedElbow:{x:1.0-0.7+offset,y:0,z:0},
  referenceShoulderAngleRad:0.5, referenceElbowAngleRad:0.7,
  shoulderMinRad:-1.2, shoulderMaxRad:1.2, elbowMinRad:-0.1, elbowMaxRad:2.4,
});

test("derives offsets from known-angle reference poses and creates an exact model-bound profile",()=>{
  const measured=calibrateVrmArmFromMeasurement(measuredArm(0.03));
  assert.equal(measured.accepted,true);
  if(measured.accepted){assert.ok(Math.abs(measured.calibration.shoulderOffsetRad-0.03)<1e-9);assert.ok(Math.abs(measured.calibration.elbowOffsetRad-0.03)<1e-9);}
  const result=createMeasuredVrmRigCalibrationProfile(context,{left:measuredArm(0.03),right:measuredArm(-0.02)});
  assert.equal(result.accepted,true);
  if(result.accepted){assert.equal(result.profile.calibrationMethod,"manual-measured");assert.equal(result.profile.left.shoulderBoneName,"LeftUpperArm");assert.equal(result.profile.right.elbowBoneName,"RightLowerArm");}
});

test("refuses weak fixture motion, off-axis movement, unsafe limits and invalid measurements",()=>{
  assert.deepEqual(calibrateVrmArmFromMeasurement({...measuredArm(),referenceShoulderAngleRad:0.01}),{accepted:false,reason:"insufficient-reference-motion"});
  assert.deepEqual(calibrateVrmArmFromMeasurement({...measuredArm(),observedShoulder:{x:0.3,y:0,z:0.6}}),{accepted:false,reason:"off-axis-motion"});
  assert.deepEqual(calibrateVrmArmFromMeasurement({...measuredArm(),shoulderMinRad:2,shoulderMaxRad:1}),{accepted:false,reason:"invalid-measurement"});
  assert.deepEqual(calibrateVrmArmFromMeasurement({...measuredArm(),observedElbow:{x:Number.NaN,y:0,z:0}}),{accepted:false,reason:"invalid-measurement"});
  assert.deepEqual(calibrateVrmArmFromMeasurement({...measuredArm(),elbowMinRad:0.5,elbowMaxRad:0.6}),{accepted:false,reason:"reference-outside-joint-limits"});
});
