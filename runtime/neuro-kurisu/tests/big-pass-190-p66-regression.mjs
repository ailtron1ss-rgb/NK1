import assert from 'node:assert/strict';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';
const m=new P66InteroceptiveHomeostasis();
const base={energy01:.8,thermal01:.2,capacity01:.8,load01:.25,awake:true,uncertainty01:.15,predictionError01:.12,novelty01:.7};
const a=m.observe({tick:1,at:1001,...base});
// 0.5 novelty normally classifies as engage; hysteresis retains the prior explore mode.
const b=m.observe({tick:2,at:1002,...base,novelty01:.5});
const c=m.observe({tick:3,at:1003,...base,energy01:.18,capacity01:.35,thermal01:.85});
assert.equal(a.mode,'explore');
assert.equal(b.mode,'explore');
assert(['recover','protect'].includes(c.mode));
const snapshot=m.snapshot();
assert.equal(snapshot.cycles,3);
assert.equal(snapshot.lastMode,c.mode,'persisted lastMode must match the final mode returned by observe()');
assert.equal(snapshot.history[0].mode,c.mode,'newest history row must record the hysteresis-resolved mode');
assert.equal(snapshot.modeCounts.explore,2,'hysteresis-resolved exploration must be counted as exploration');
assert.equal(snapshot.modeCounts.engage,0,'the discarded provisional engage mode must not be counted');
assert.equal(Object.values(snapshot.modeCounts).reduce((total,count)=>total+count,0),snapshot.cycles,
  'mode counters must account for each cycle exactly once');
const r=new P66InteroceptiveHomeostasis(); r.restore(snapshot); assert.deepEqual(r.snapshot(),snapshot);
console.log(JSON.stringify({pass:'P66-regression',a,b,c,deterministic:true},null,2));
