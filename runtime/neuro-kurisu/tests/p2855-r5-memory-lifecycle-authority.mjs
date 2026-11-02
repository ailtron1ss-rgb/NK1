import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

const memory = new MemorySubsystemRuntime();
const row = {
  kind:'episode', summary:'rare calibration event with delayed consequence', evidence:['holdout-source'], salience:.82,
  createdAt:Date.now(), id:'r5-memory-1', timescale:'episodic', retrievalCount:0,lastRetrievedAt:0,confidence:.78,sourceEventIds:[]
};
memory.fabric.ingestCompatibility(row,1);
const first = memory.fabric.retrieve('rare calibration event',4,0,0,{emitEvent:false});
assert.equal(first.length,1);
const run = memory.memoryLifecycleAuthority.run({tick:1,at:Date.now(),traces:4,events:8,goals:2,memories:memory.memoryOS.size(),semanticItems:0,workingSet01:.42,energy01:.8,pressure01:.2,identityTension01:.3,consolidationCandidates:[{id:'r5-memory-1',kind:'episodic',salience01:.82,novelty01:.7,predictionError01:.55,uncertainty01:.35,outcome01:.8,recency01:1}],consolidationBatchSize:1});
assert.equal(run.maintenance.skipped,false);
const consolidation=memory.memoryLifecycleAuthority.consolidate({candidates:[{id:'r5-memory-1',kind:'episodic',salience01:.82,novelty01:.7,predictionError01:.55,uncertainty01:.35,outcome01:.8,recency01:1}],batchSize:1,pressure01:.2,awake01:1});
assert.equal(consolidation.length,1);
assert.equal(memory.memoryLifecycleAuthority.snapshot().lastTick,1);
assert.equal(memory.fabric.inspect().canonicalAuthority,'memoryOS2');
const snap=memory.snapshot();
const restored = new MemorySubsystemRuntime();
restored.restoreFromPersisted({memory:snap,advanced:snap});
assert.equal(restored.memoryLifecycleAuthority.snapshot().cycles,1);
assert.equal(restored.consolidationController.snapshot().lastBatch.length,1,'valid consolidation decisions survive restore');
assert.equal(restored.memoryLifecycleAuthority.snapshot().lastConsolidation.length,1,'valid lifecycle decisions survive restore');
assert.ok(restored.fabric.retrieve('rare calibration event',4,0,0,{emitEvent:false}).length>=1);
console.log(JSON.stringify({ok:true,canonicalItems:restored.memoryOS.size(),maintenanceRuns:restored.memoryLifecycleAuthority.snapshot().maintenanceRuns,consolidationRuns:restored.memoryLifecycleAuthority.snapshot().consolidationRuns}));


// Restore is a trust boundary for both the canonical consolidation controller and its lifecycle authority.
const restoreProbe = new MemorySubsystemRuntime();
const restoreConsolidation = restoreProbe.consolidationController;
restoreConsolidation.restore({version:1,runs:-1,meanPriority01:Number.NaN,lastBatch:[{id:'bad',route:'invalid',priority01:1}]});
assert.equal(restoreConsolidation.snapshot().runs,0);
assert.equal(restoreConsolidation.snapshot().meanPriority01,0);
assert.deepEqual(restoreConsolidation.snapshot().lastBatch,[]);
let consolidationGetterCalls=0;
const consolidationAccessor=restoreConsolidation.snapshot();
Object.defineProperty(consolidationAccessor,'runs',{enumerable:true,get(){consolidationGetterCalls++;return 99;}});
restoreConsolidation.restore(consolidationAccessor);
assert.equal(consolidationGetterCalls,0);
assert.equal(restoreConsolidation.snapshot().runs,0);
const hostileConsolidation=new Proxy(restoreConsolidation.snapshot(),{getOwnPropertyDescriptor(){throw new Error('hostile consolidation snapshot');}});
assert.doesNotThrow(()=>restoreConsolidation.restore(hostileConsolidation));
assert.equal(restoreConsolidation.snapshot().runs,0);
restoreConsolidation.restore({version:1,runs:3,meanPriority01:.4});
assert.equal(restoreConsolidation.snapshot().runs,3);
assert.equal(restoreConsolidation.snapshot().meanPriority01,.4);

const lifecycle=restoreProbe.memoryLifecycleAuthority;
lifecycle.restore({version:1,cycles:-1,meanPressure01:Number.NaN,lastConsolidation:[{id:'bad',route:'invalid',priority01:1}]});
assert.equal(lifecycle.snapshot().cycles,0);
assert.equal(lifecycle.snapshot().meanPressure01,.18);
assert.deepEqual(lifecycle.snapshot().lastConsolidation,[]);
let lifecycleGetterCalls=0;
const lifecycleAccessor=lifecycle.snapshot();
Object.defineProperty(lifecycleAccessor,'cycles',{enumerable:true,get(){lifecycleGetterCalls++;return 99;}});
lifecycle.restore(lifecycleAccessor);
assert.equal(lifecycleGetterCalls,0);
assert.equal(lifecycle.snapshot().cycles,0);
const hostileLifecycle=new Proxy(lifecycle.snapshot(),{getOwnPropertyDescriptor(){throw new Error('hostile lifecycle snapshot');}});
assert.doesNotThrow(()=>lifecycle.restore(hostileLifecycle));
assert.equal(lifecycle.snapshot().cycles,0);
lifecycle.restore({version:1,cycles:5,meanPressure01:.42});
assert.equal(lifecycle.snapshot().cycles,5);
assert.equal(lifecycle.snapshot().meanPressure01,.42);
assert.equal(lifecycle.snapshot().lastPlan,undefined,'diagnostic plans are regenerated after restore');
const sparseBatch = new Array(1);
restoreConsolidation.restore({version:1,runs:9,lastBatch:sparseBatch});
assert.equal(restoreConsolidation.snapshot().runs,0,'sparse decision history must be rejected');
lifecycle.restore({version:1,cycles:9,lastConsolidation:sparseBatch});
assert.equal(lifecycle.snapshot().cycles,0,'sparse lifecycle history must be rejected');
let feedbackGetterCalls=0;
const feedbackAccessor={};
Object.defineProperty(feedbackAccessor,'action',{enumerable:true,get(){feedbackGetterCalls++;return 'recalled-action';}});
restoreConsolidation.restore({version:1,runs:9,lastFeedback:feedbackAccessor});
assert.equal(feedbackGetterCalls,0,'feedback restore must not invoke accessors');
assert.equal(restoreConsolidation.snapshot().runs,0);
restoreConsolidation.restore({version:1,runs:9,lastFeedback:{action:42,delta01:.4,retention01:.6}});
assert.equal(restoreConsolidation.snapshot().runs,0,'malformed feedback must still fail closed after the type narrowing');
assert.equal(restoreConsolidation.snapshot().lastFeedback,undefined);

