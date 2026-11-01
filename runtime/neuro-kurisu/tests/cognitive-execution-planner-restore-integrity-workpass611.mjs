import assert from 'node:assert/strict';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';

const valid={
  version:1,tick:42,mode:'deep',reason:'restored-plan',
  run:{perception:true,memory:false,'world-rollout':true,research:false,shadow:true,project:true,'slow-cognition':false},
  cost01:{perception:.04,memory:.02,'world-rollout':.12,research:.3,shadow:.08,project:.1,'slow-cognition':.2},
  informationGain01:{perception:.7,memory:.6,'world-rollout':.5,research:.4,shadow:.3,project:.2,'slow-cognition':.1},
  expectedValue01:{perception:.6,memory:.5,'world-rollout':.4,research:.3,shadow:.2,project:.1,'slow-cognition':.05},
  metabolism:{memory:{domain:'memory',priority01:.8,budgetShare01:.3,estimatedLoad01:.4,active:true}},
  stats:{memory:{runs:8,skips:2,forced:1,opportunities:10,estimatedCost01:.02,estimatedSavings01:.1,lastReason:'restored'}},
};
const planner=new CognitiveExecutionPlanner();
planner.restore(valid);
let snapshot=planner.snapshot();
assert.equal(snapshot.tick,42);
assert.equal(snapshot.mode,'deep');
assert.equal(snapshot.run.memory,false);
assert.equal(snapshot.metabolism.memory.priority01,.8);
assert.equal(snapshot.stats.memory.runs,8);
assert.equal(snapshot.stats.memory.lastReason,'restored');

// Accessors at both the root and nested levels must not execute during restore.
let getterCalls=0;
const hostileRun={};
Object.defineProperty(hostileRun,'project',{enumerable:true,get(){getterCalls++;throw new Error('getter executed');}});
const hostileRoot={version:1,tick:99,run:hostileRun};
Object.defineProperty(hostileRoot,'reason',{enumerable:true,get(){getterCalls++;throw new Error('root getter executed');}});
planner.restore(hostileRoot);
snapshot=planner.snapshot();
assert.equal(getterCalls,0);
assert.equal(snapshot.tick,99);
assert.equal(snapshot.reason,'initial');
assert.equal(snapshot.run.project,false);

// Inherited values and non-plain records are ignored.
const inherited=Object.create({tick:900,mode:'deep'});
inherited.version=1;
planner.restore(inherited);
assert.equal(planner.snapshot().tick,0);
assert.equal(planner.snapshot().mode,'balanced');

// Hostile reflection traps and malformed nested containers fail closed.
const hostileProxy=new Proxy({}, {getPrototypeOf(){throw new Error('prototype trap');}});
assert.doesNotThrow(()=>planner.restore(hostileProxy));
assert.equal(planner.snapshot().tick,0);
const nestedProxy=new Proxy({}, {getOwnPropertyDescriptor(){throw new Error('descriptor trap');}});
assert.doesNotThrow(()=>planner.restore({version:1,tick:7,run:nestedProxy}));
assert.equal(planner.snapshot().tick,7);
assert.equal(planner.snapshot().run.project,false);
const revoked=Proxy.revocable({},{});revoked.revoke();
assert.doesNotThrow(()=>planner.restore(revoked.proxy));
assert.equal(planner.snapshot().tick,0,'revoked root proxies must fail closed');
const revokedNested=Proxy.revocable({},{});revokedNested.revoke();
assert.doesNotThrow(()=>planner.restore({version:1,tick:8,run:revokedNested.proxy}));
assert.equal(planner.snapshot().tick,8);
assert.equal(planner.snapshot().run.project,false,'revoked nested proxies must be ignored');
planner.restore([]);
assert.equal(planner.snapshot().tick,0,'array snapshots are not planner records');

// Invalid versions, arrays and out-of-range metrics cannot poison future snapshots.
planner.restore({version:9,tick:100,mode:'deep'});
assert.equal(planner.snapshot().tick,0);
planner.restore({version:1,tick:4,mode:'invalid',cost01:{project:5},stats:{project:{runs:-1}}});
snapshot=planner.snapshot();
assert.equal(snapshot.tick,4);
assert.equal(snapshot.mode,'balanced');
assert.equal(snapshot.cost01.project,1,'finite out-of-range metrics are clamped into the normalized interval');
assert.equal(snapshot.stats.project.runs,0);
assert.ok(Object.values(snapshot.cost01).every(Number.isFinite));
assert.ok(Object.values(snapshot.metabolism).every(row=>row.priority01>=0&&row.priority01<=1));

console.log('COGNITIVE_EXECUTION_PLANNER_RESTORE_INTEGRITY=PASS');
