import assert from "node:assert/strict";
import test from "node:test";
import { forwardKinematics3D } from "../src/organism/system/SkeletalKinematics3D.ts";
import { solveMultiEffectorIK3D } from "../src/organism/system/SkeletalMultiEffectorIK3D.ts";

const skeleton=()=>[
 {id:"torso",offset:{x:0,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:0,maxAngleRad:0},
 {id:"leftShoulder",parentId:"torso",offset:{x:0,y:1,z:0},axis:{x:0,y:0,z:1},minAngleRad:-1.4,maxAngleRad:1.4},
 {id:"leftElbow",parentId:"leftShoulder",offset:{x:1,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-2,maxAngleRad:2},
 {id:"rightShoulder",parentId:"torso",offset:{x:0,y:-1,z:0},axis:{x:0,y:0,z:1},minAngleRad:-1.4,maxAngleRad:1.4},
 {id:"rightElbow",parentId:"rightShoulder",offset:{x:1,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-2,maxAngleRad:2},
];
const targetPose={torso:0,leftShoulder:.32,leftElbow:-.55,rightShoulder:-.28,rightElbow:.48};
const targets=()=>{
 const joints=skeleton(),pose=targetPose;
 return [
  {id:"leftHand",chain:["torso","leftShoulder","leftElbow"],target:forwardKinematics3D(joints,pose,"leftElbow").endEffector},
  {id:"rightHand",chain:["torso","rightShoulder","rightElbow"],target:forwardKinematics3D(joints,pose,"rightElbow").endEffector},
 ];
};

test("multi-effector DLS coordinates two arms in one shared solve",()=>{
 const joints=skeleton(),effectors=targets();
 const result=solveMultiEffectorIK3D({joints,pose:{},effectors,maxIterations:100,tolerance:.015});
 assert.equal(result.converged,true,JSON.stringify(result));
 assert.equal(result.residuals.length,2);
 assert.ok(result.residuals.every(r=>r.error<=.015));
 assert.ok(Math.abs(result.pose.torso)<=1e-9);
 for(const joint of joints)assert.ok(result.pose[joint.id]>=joint.minAngleRad&&result.pose[joint.id]<=joint.maxAngleRad);
});

test("multi-effector solver rejects duplicate IDs, discontinuous chains and invalid weights",()=>{
 const joints=skeleton(),base=targets()[0];
 assert.throws(()=>solveMultiEffectorIK3D({joints,pose:{},effectors:[base,{...base}]}),/duplicate/);
 assert.throws(()=>solveMultiEffectorIK3D({joints,pose:{},effectors:[{...base,chain:["torso","leftElbow"]}]}),/contiguous/);
 assert.throws(()=>solveMultiEffectorIK3D({joints,pose:{},effectors:[{...base,weight:0}]}),/weight/);
});

test("joint limits produce explicit non-convergence instead of false success",()=>{
 const joints=skeleton().map(j=>({...j,minAngleRad:0,maxAngleRad:0}));
 const result=solveMultiEffectorIK3D({joints,pose:{},effectors:targets(),maxIterations:12});
 assert.equal(result.converged,false);
 assert.equal(result.reason,"joint-limits-or-singularity");
 assert.ok(result.maxError>.1);
});

test("multi-effector bounds and malformed target input fail closed",()=>{
 const joints=skeleton(),base=targets()[0];
 assert.throws(()=>solveMultiEffectorIK3D({joints,pose:{},effectors:[{...base,target:{x:NaN,y:0,z:0}}]}),/effector/);
 assert.throws(()=>solveMultiEffectorIK3D({joints,pose:{},effectors:Array.from({length:7},(_,i)=>({...base,id:"hand"+i}))}),/count/);
});
