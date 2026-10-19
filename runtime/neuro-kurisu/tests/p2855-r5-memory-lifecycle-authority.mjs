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
assert.ok(restored.fabric.retrieve('rare calibration event',4,0,0,{emitEvent:false}).length>=1);
console.log(JSON.stringify({ok:true,canonicalItems:restored.memoryOS.size(),maintenanceRuns:restored.memoryLifecycleAuthority.snapshot().maintenanceRuns,consolidationRuns:restored.memoryLifecycleAuthority.snapshot().consolidationRuns}));
