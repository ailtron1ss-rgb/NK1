import assert from 'node:assert/strict';
import { BoundedRecurrentStateSubstrate } from '../src/organism/cognition/BoundedRecurrentStateSubstrate.ts';
const lane=new BoundedRecurrentStateSubstrate(16,'p2906');
let maxSat=0;
let last=lane.snapshot();
for(let t=0;t<512;t++){
  const input=Array.from({length:16},(_,i)=>Math.sin(t*.037+i*.19));
  const step=lane.step(input);
  maxSat=Math.max(maxSat,step.saturation01);
  assert.ok(step.state.every(Number.isFinite));
  assert.ok(step.state.every(v=>v>=-1&&v<=1));
  last=lane.snapshot();
}
assert.equal(last.updates,512);
assert.ok(last.bounded01>.5);
lane.reset();
const afterReset=lane.step(new Array(16).fill(.25));
assert.ok(afterReset.state.every(Number.isFinite));
assert.equal(lane.snapshot().resets,1);
console.log(JSON.stringify({pass:true,updates:last.updates,resets:lane.snapshot().resets,maxSaturation01:maxSat,bounded01:last.bounded01,spectralProxy01:last.spectralProxy01}));
