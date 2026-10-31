import assert from "node:assert/strict";
import test from "node:test";
import { forwardKinematics3D, solveDampedLeastSquaresIK3D, validateSkeleton3D } from "../src/organism/system/SkeletalKinematics3D.ts";

const arm = () => [
  {id:"shoulder",offset:{x:0,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-2.8,maxAngleRad:2.8},
  {id:"elbow",parentId:"shoulder",offset:{x:1,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-2.8,maxAngleRad:2.8},
  {id:"wrist",parentId:"elbow",offset:{x:1,y:0,z:0},axis:{x:0,y:0,z:1},minAngleRad:-2.8,maxAngleRad:2.8},
];

test("3D skeleton validation catches cycles, missing parents and invalid axes",()=>{
  assert.throws(()=>validateSkeleton3D([{id:"a",parentId:"b",offset:{x:0,y:0,z:0},axis:{x:1,y:0,z:0},minAngleRad:-1,maxAngleRad:1}]),/missing/);
  assert.throws(()=>validateSkeleton3D([
    {id:"a",parentId:"b",offset:{x:0,y:0,z:0},axis:{x:1,y:0,z:0},minAngleRad:-1,maxAngleRad:1},
    {id:"b",parentId:"a",offset:{x:0,y:0,z:0},axis:{x:1,y:0,z:0},minAngleRad:-1,maxAngleRad:1},
  ]),/cycle/);
  assert.throws(()=>validateSkeleton3D([{id:"a",offset:{x:0,y:0,z:0},axis:{x:0,y:0,z:0},minAngleRad:-1,maxAngleRad:1}]),/transform/);
});

test("forward kinematics composes hierarchical rotations and offsets",()=>{
  const joints=arm();
  const fk=forwardKinematics3D(joints,{shoulder:Math.PI/2,elbow:0,wrist:0},"wrist");
  assert.ok(Math.abs(fk.endEffector.x)<1e-8);
  assert.ok(Math.abs(fk.endEffector.y-2)<1e-8);
});

test("DLS IK reaches a reachable 3D target while respecting joint limits",()=>{
  const joints=arm();
  const solved=solveDampedLeastSquaresIK3D({
    joints,pose:{shoulder:0,elbow:0,wrist:0},chain:["shoulder","elbow","wrist"],
    target:{x:1.2,y:1.2,z:0},maxIterations:80,tolerance:0.01,
  });
  assert.equal(solved.converged,true,JSON.stringify(solved));
  assert.ok(solved.error<=0.01);
  for(const j of joints) assert.ok(solved.pose[j.id]>=j.minAngleRad&&solved.pose[j.id]<=j.maxAngleRad);
});

test("DLS IK rejects non-contiguous chains and clamps unreachable targets at joint limits",()=>{
  const joints=arm();
  assert.throws(()=>solveDampedLeastSquaresIK3D({joints,pose:{},chain:["shoulder","wrist"],target:{x:0,y:1,z:0}}),/contiguous/);
  const limited=joints.map(j=>({...j,minAngleRad:0,maxAngleRad:0}));
  const solved=solveDampedLeastSquaresIK3D({joints:limited,pose:{},chain:["shoulder","elbow","wrist"],target:{x:0,y:2,z:0}});
  assert.equal(solved.converged,false);
  assert.ok(solved.error>0.1);
});
