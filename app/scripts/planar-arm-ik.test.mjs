import test from "node:test";
import assert from "node:assert/strict";
import {solvePlanarArmIK} from "../src/components/avatar/planarArmIK.ts";
const base={shoulder:{x:0,y:0},target:{x:.25,y:.2},upperArmLength:.32,forearmLength:.28,frameId:"avatar-root-m",targetFrameId:"avatar-root-m",confidence01:.95};
test("solves a reachable target with bounded finite joints",()=>{const r=solvePlanarArmIK(base);assert.equal(r.accepted,true);if(r.accepted){assert.ok(Number.isFinite(r.shoulderAngle));assert.ok(Number.isFinite(r.elbowFlexion));assert.ok(r.elbowFlexion>=0&&r.elbowFlexion<=2.65);}});
test("rejects coordinate frame mismatch",()=>assert.deepEqual(solvePlanarArmIK({...base,targetFrameId:"camera"}),{accepted:false,reason:"coordinate-frame-mismatch"}));
test("rejects weak perception confidence",()=>assert.deepEqual(solvePlanarArmIK({...base,confidence01:.2}),{accepted:false,reason:"target-confidence-too-low"}));
test("rejects invalid limb lengths",()=>assert.deepEqual(solvePlanarArmIK({...base,upperArmLength:0}),{accepted:false,reason:"invalid-segment-length"}));
test("rejects non-finite targets",()=>assert.deepEqual(solvePlanarArmIK({...base,target:{x:NaN,y:0}}),{accepted:false,reason:"non-finite-kinematics-input"}));
test("clamps unreachable targets to conservative reach boundary",()=>{const r=solvePlanarArmIK({...base,target:{x:2,y:0}});assert.equal(r.accepted,true);if(r.accepted)assert.ok(r.clampedDistance<.6);});
test("rejects target at shoulder origin",()=>assert.deepEqual(solvePlanarArmIK({...base,target:{x:0,y:0}}),{accepted:false,reason:"target-at-shoulder-origin"}));

test("reports the true end effector and flags limits when a joint is clamped",()=>{
  const free=solvePlanarArmIK(base);
  assert.equal(free.accepted,true);
  if(free.accepted){
    // An unclamped solve must reproduce the requested target exactly.
    assert.ok(Math.abs(free.endEffector.x-base.target.x)<1e-9);
    assert.ok(Math.abs(free.endEffector.y-base.target.y)<1e-9);
    assert.equal(free.limitsApplied,false);
  }
  const bound=solvePlanarArmIK({...base,shoulderLimit:{min:-.05,max:.05}});
  assert.equal(bound.accepted,true);
  if(bound.accepted){
    // The requested point is unreachable once the joint is clamped; the result
    // must report where the hand actually lands and flag the limit, not echo the target.
    assert.equal(bound.limitsApplied,true);
    assert.ok(Math.hypot(bound.endEffector.x-base.target.x,bound.endEffector.y-base.target.y)>.05);
  }
});
