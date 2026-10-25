import assert from 'node:assert/strict';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';
const m=new P66InteroceptiveHomeostasis();
const base={energy01:.8,thermal01:.2,capacity01:.8,load01:.25,awake:true,uncertainty01:.15,predictionError01:.12,novelty01:.7};
const a=m.observe({tick:1,at:1001,...base});
const b=m.observe({tick:2,at:1002,...base,novelty01:.75});
const c=m.observe({tick:3,at:1003,...base,energy01:.18,capacity01:.35,thermal01:.85});
assert.equal(a.mode,'explore');
assert.equal(b.mode,'explore');
assert(['recover','protect'].includes(c.mode));
assert.equal(m.snapshot().cycles,3);
const r=new P66InteroceptiveHomeostasis(); r.restore(m.snapshot()); assert.deepEqual(r.snapshot(),m.snapshot());

const p66Snapshot=m.snapshot();
const poisonedP66={
  ...p66Snapshot,cycles:NaN,meanStress01:Infinity,lastPressure01:Infinity,recoveryDebt01:-1,
  stableCycles:NaN,lastMode:'invalid-mode',
  modeCounts:{...p66Snapshot.modeCounts,recover:Infinity,explore:-2},
  setpoints:{...p66Snapshot.setpoints,energy01:NaN,thermal01:2},
  history:[{...p66Snapshot.history[0],error01:NaN},p66Snapshot.history[0]],
};
const safeP66=new P66InteroceptiveHomeostasis();
safeP66.restore(poisonedP66);
const safeP66State=safeP66.snapshot();
assert.equal(safeP66State.cycles,1,'valid restored history prevents the cycle counter from undershooting retained samples');
assert.equal(safeP66State.history.length,1,'invalid and duplicate homeostasis observations are discarded');
assert.equal(safeP66State.meanStress01,.25,'non-finite stress falls back to the safe default');
assert.equal(safeP66State.lastPressure01,.3,'non-finite regulation pressure falls back to the safe default');
assert.equal(safeP66State.recoveryDebt01,.18,'out-of-range recovery debt falls back to the safe default');
assert.equal(safeP66State.stableCycles,0,'non-finite stable-cycle counters are reset');
assert.equal(safeP66State.lastMode,'balance','unknown restored modes cannot steer the controller');
assert.equal(safeP66State.modeCounts.recover,0,'invalid mode counters are reset');
assert.equal(safeP66State.setpoints.energy01,.68,'invalid setpoints cannot poison future control decisions');
assert.equal(safeP66State.setpoints.thermal01,.25,'out-of-range setpoints are reset');
let p66GetterCalls=0;
const hostileP66={...p66Snapshot};
Object.defineProperty(hostileP66,'cycles',{enumerable:true,get(){p66GetterCalls++;return 999;}});
const getterP66=new P66InteroceptiveHomeostasis();
getterP66.restore(hostileP66);
assert.equal(p66GetterCalls,0,'homeostasis restore must not execute persisted accessors');
assert.equal(getterP66.snapshot().cycles,0,'accessor-backed state fails closed');
console.log(JSON.stringify({pass:'P66-regression',a,b,c,deterministic:true},null,2));
