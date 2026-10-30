import test from "node:test";
import assert from "node:assert/strict";
import {computeVrmArmPose,resolveLeftVrmArm,resolveVrmArm} from "../src/components/avatar/vrmHumanoidRigAdapter.ts";
import {solvePlanarArmIK} from "../src/components/avatar/planarArmIK.ts";
const bone=(name,x=0,y=0,z=0)=>({name,rotation:{x,y,z}});
const calibration={shoulderAxis:"z",elbowAxis:"z",shoulderSign:1,elbowSign:1,shoulderOffsetRad:0,elbowOffsetRad:0,shoulderMinRad:-1.2,shoulderMaxRad:1.2,elbowMinRad:0,elbowMaxRad:2.4};
const solution=solvePlanarArmIK({shoulder:{x:0,y:0},target:{x:.25,y:.2},upperArmLength:.32,forearmLength:.28,frameId:"avatar",targetFrameId:"avatar",confidence01:.95});
test("resolves an unambiguous left upper/lower arm pair",()=>{const map=resolveLeftVrmArm([bone("LeftUpperArm"),bone("LeftLowerArm"),bone("RightUpperArm")]);assert.ok(map);assert.equal(map.shoulder.name,"LeftUpperArm");assert.equal(map.elbow.name,"LeftLowerArm");});
test("refuses missing or ambiguous bone mappings",()=>{assert.equal(resolveLeftVrmArm([bone("LeftUpperArm")]),null);assert.equal(resolveLeftVrmArm([bone("LeftUpperArm"),bone("LeftArm"),bone("LeftLowerArm")]),null);});
test("maps IK angles relative to bind pose on explicitly calibrated axes",()=>{assert.ok(solution.accepted);if(!solution.accepted)return;const map={shoulder:bone("LeftUpperArm",.1,.2,.3),elbow:bone("LeftLowerArm",0,.1,.2)};const pose=computeVrmArmPose(map,solution,calibration);assert.ok(pose);assert.equal(pose.shoulder.x,.1);assert.equal(pose.shoulder.y,.2);assert.ok(Math.abs(pose.shoulder.z-(.3+solution.shoulderAngle))<1e-9);assert.ok(Math.abs(pose.elbow.z-(.2+solution.elbowFlexion))<1e-9);});
test("clamps calibrated joint targets and preserves other Euler axes",()=>{assert.ok(solution.accepted);if(!solution.accepted)return;const pose=computeVrmArmPose({shoulder:bone("s",.4,.5,.6),elbow:bone("e",.1,.2,.3)},solution,{...calibration,shoulderMaxRad:.31,elbowMaxRad:.42});assert.ok(pose);assert.equal(pose.shoulder.z,.31);assert.equal(pose.elbow.z,.42);assert.equal(pose.shoulder.x,.4);});
test("refuses absent IK, invalid limits, or non-finite bind pose",()=>{const map={shoulder:bone("s"),elbow:bone("e")};assert.equal(computeVrmArmPose(map,{accepted:false,reason:"no"},calibration),null);assert.equal(computeVrmArmPose(map,solution,{...calibration,shoulderMinRad:2,shoulderMaxRad:1}),null);assert.equal(computeVrmArmPose({shoulder:bone("s",NaN),elbow:bone("e")},solution,calibration),null);});

test("resolves the right arm independently",()=>{const map=resolveVrmArm([bone("RightUpperArm"),bone("RightLowerArm"),bone("LeftUpperArm"),bone("LeftLowerArm")],"right");assert.ok(map);assert.equal(map.shoulder.name,"RightUpperArm");assert.equal(map.elbow.name,"RightLowerArm");});
