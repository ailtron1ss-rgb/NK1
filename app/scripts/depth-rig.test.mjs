
import assert from "node:assert/strict";
import test from "node:test";
import {resolveDepthRigPose,stepDepthRigSecondaryMotion,stepSecondaryMotion,validateDepthRig} from "../src/components/avatar/depthRig.ts";
const rig={version:1,id:"kurisu-2p5d-test",units:"scene",nodes:[
{id:"root",parentId:null,role:"root",position:[0,0,0],pivot:[0,0],rotation:[0,0,0],depth:0,parallax:0},
{id:"torso",parentId:"root",role:"torso",position:[0,-.2,.1],pivot:[0,0],rotation:[0,0,0],depth:.1,parallax:.5},
{id:"left-arm",parentId:"torso",role:"left-upper-arm",position:[-.25,.25,.08],pivot:[0,0],rotation:[0,0,0],depth:.2,parallax:.5},
{id:"head",parentId:"torso",role:"head",position:[0,.6,.2],pivot:[0,-.4],rotation:[0,0,0],depth:.3,parallax:.8},
{id:"eyes",parentId:"head",role:"eyes",position:[0,.05,.04],pivot:[0,0],rotation:[0,0,0],depth:.5,parallax:1},
{id:"hair-front",parentId:"head",role:"hair-front",position:[0,0,.08],pivot:[0,0],rotation:[0,0,0],depth:.8,parallax:1.2},
{id:"coat-tail",parentId:"torso",role:"coat-tail",position:[0,-.5,-.05],pivot:[0,.5],rotation:[0,0,0],depth:-.1,parallax:.7}]};
test("validates hierarchy and produces parent-first traversal",()=>{const r=validateDepthRig(rig);assert.equal(r.ok,true);assert.deepEqual(r.order,["root","torso","left-arm","head","eyes","hair-front","coat-tail"])});
test("rejects duplicate IDs, missing parents, invalid ranges and cycles",()=>{const bad={...rig,nodes:[...rig.nodes,{...rig.nodes[0],id:"head"},{...rig.nodes[1],id:"orphan",parentId:"missing"},{...rig.nodes[2],id:"bad-depth",depth:9}]};const r=validateDepthRig(bad);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.startsWith("duplicate-node:")));assert.ok(r.errors.some(x=>x.startsWith("missing-parent:")));assert.ok(r.errors.some(x=>x.startsWith("invalid-depth:")));const cycle={...rig,nodes:rig.nodes.map(n=>n.id==="root"?{...n,parentId:"head"}:n)};assert.ok(validateDepthRig(cycle).errors.some(x=>x.startsWith("parent-cycle:")))});
test("resolves independent head, torso, gaze, arms, breath and depth parallax",()=>{const a=resolveDepthRigPose(rig),b=resolveDepthRigPose(rig,{headYaw:.4,headPitch:-.2,torsoYaw:.1,leftArm:.6,gazeX:.5,gazeY:-.4,breath:.8},{x:.5,y:-.25});const get=(p,id)=>p.find(x=>x.id===id);assert.notDeepEqual(get(a,"head").rotation,get(b,"head").rotation);assert.notDeepEqual(get(a,"torso").rotation,get(b,"torso").rotation);assert.notDeepEqual(get(a,"eyes").rotation,get(b,"eyes").rotation);assert.notDeepEqual(get(a,"head").position,get(b,"head").position);assert.notDeepEqual(get(a,"left-arm").rotation,get(b,"left-arm").rotation);assert.ok(get(b,"torso").scale[1]>1);assert.ok(get(b,"hair-front").renderOrder>get(b,"torso").renderOrder)});
test("clamps extreme intent and camera values",()=>{const p=resolveDepthRigPose(rig,{headYaw:100,headPitch:-100,gazeX:50,leftArm:100,breath:100},{x:90,y:-90});const h=p.find(x=>x.id==="head"),e=p.find(x=>x.id==="eyes");assert.ok(Math.abs(h.rotation[1])<=.65);assert.ok(Math.abs(h.rotation[0])<=.45);assert.ok(Math.abs(e.rotation[1])<=.197);assert.ok(p.every(x=>x.position.every(Number.isFinite)&&x.rotation.every(Number.isFinite)))});
test("secondary motion remains finite and bounded with irregular frame deltas",()=>{let s={position:0,velocity:0};for(let n=0;n<2000;n++){s=stepSecondaryMotion(s,n<400?.18:-.16,n%7===0?.2:1/60);assert.ok(Number.isFinite(s.position)&&Number.isFinite(s.velocity));assert.ok(Math.abs(s.position)<=.22);assert.ok(Math.abs(s.velocity)<=2.5)}});
test("secondary motion converges toward target",()=>{let s={position:0,velocity:0};for(let n=0;n<600;n++)s=stepSecondaryMotion(s,.12,1/60);assert.ok(Math.abs(s.position-.12)<.015);assert.ok(Math.abs(s.velocity)<.04)});

test("secondary motion adds inertial follow-through only to hair and coat semantic layers",()=>{
 const states=new Map();const intent={headYaw:.5,headPitch:-.2,torsoYaw:.2};
 const base=resolveDepthRigPose(rig,intent);let pose=stepDepthRigSecondaryMotion(rig,base,intent,states,1/60);
 const get=(items,id)=>items.find(x=>x.id===id);
 assert.notEqual(get(pose,"hair-front").rotation[2],get(base,"hair-front").rotation[2]);
 assert.notEqual(get(pose,"coat-tail").rotation[2],get(base,"coat-tail").rotation[2]);
 assert.equal(get(pose,"head").rotation[2],get(base,"head").rotation[2]);
 assert.equal(get(pose,"eyes").rotation[2],get(base,"eyes").rotation[2]);
 for(let n=0;n<600;n++)pose=stepDepthRigSecondaryMotion(rig,base,intent,states,1/60);
 for(const id of ["hair-front","coat-tail"]){const state=states.get(id);assert.ok(Number.isFinite(state.position)&&Number.isFinite(state.velocity));assert.ok(Math.abs(state.position)<=.16);}
});
