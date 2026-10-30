import assert from "node:assert/strict";
import test from "node:test";
import { forwardKinematics3D } from "../src/organism/system/SkeletalKinematics3D.ts";
import { solveSkeletalPoseIK3D } from "../src/organism/system/SkeletalPoseIK3D.ts";

const chain = () => [
  {id:"root",offset:{x:0,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-Math.PI,maxAngleRad:Math.PI},
  {id:"elbow",parentId:"root",offset:{x:1,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-Math.PI,maxAngleRad:Math.PI},
  {id:"wrist",parentId:"elbow",offset:{x:1,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-Math.PI,maxAngleRad:Math.PI},
];
const qz = (a) => ({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)});

test("combined pose IK reaches both a reachable wrist position and orientation",()=>{
 const joints=chain(),targetPose={root:.25,elbow:.45,wrist:.35};
 const target=forwardKinematics3D(joints,targetPose,"wrist");
 const solved=solveSkeletalPoseIK3D({joints,pose:{root:0,elbow:0,wrist:0},chain:["root","elbow","wrist"],
   targetPosition:target.endEffector,targetRotation:target.joints.wrist.rotation,maxIterations:100,positionTolerance:.012,orientationToleranceRad:.045});
 assert.equal(solved.converged,true,JSON.stringify(solved));
 assert.ok(solved.positionError<=.012);
 assert.ok(solved.orientationErrorRad<=.045);
});

test("orientation-only target is solved without moving the end-effector outside tolerance",()=>{
 const joints=chain(),target=forwardKinematics3D(joints,{root:0,elbow:0,wrist:.7},"wrist");
 const solved=solveSkeletalPoseIK3D({joints,pose:{root:0,elbow:0,wrist:0},chain:["root","elbow","wrist"],
   targetPosition:target.endEffector,targetRotation:qz(.7),maxIterations:100,positionTolerance:.02,orientationToleranceRad:.04});
 assert.equal(solved.converged,true,JSON.stringify(solved));
 assert.ok(solved.positionError<=.02);
 assert.ok(solved.orientationErrorRad<=.04);
});

test("joint limits bound the pose and unreachable pose returns an explicit non-converged result",()=>{
 const joints=chain().map(j=>({...j,minAngleRad:0,maxAngleRad:0}));
 const solved=solveSkeletalPoseIK3D({joints,pose:{},chain:["root","elbow","wrist"],targetPosition:{x:0,y:3,z:0},
   targetRotation:qz(1),maxIterations:12});
 assert.equal(solved.converged,false);
 assert.equal(solved.reason,"joint-limits-or-singularity");
 for(const value of Object.values(solved.pose))assert.equal(value,0);
});

test("malformed quaternion and non-contiguous chains fail closed",()=>{
 const joints=chain();
 assert.throws(()=>solveSkeletalPoseIK3D({joints,pose:{},chain:["root","wrist"],targetPosition:{x:1,y:0,z:0},targetRotation:qz(0)}),/contiguous/);
 assert.throws(()=>solveSkeletalPoseIK3D({joints,pose:{},chain:["root","elbow","wrist"],targetPosition:{x:1,y:0,z:0},targetRotation:{x:0,y:0,z:0,w:0}}),/quaternion/);
});
