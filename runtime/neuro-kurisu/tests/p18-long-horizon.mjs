import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p18-'));
const rt=new OrganismRuntime({stateFile:path.join(dir,'organism.json'),worldStateFile:path.join(dir,'world.json'),autoRun:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal()});
await rt.init();
for(let i=0;i<48;i++){
  const step=await rt.step(i%3===0?`Проверь гипотезу ${i} и сохрани вывод.`:undefined);
}
const before=rt.longitudinalSnapshot();
assert.ok(before.observedCycles>=48);
assert.ok(before.completedOutcomes>=48);
await rt.sleepConsolidate();
const after=rt.longitudinalSnapshot();
assert.ok(after.sleepConsolidations>=1);
assert.ok(after.replayUpdates>=0);
assert.ok(after.continuity01>0);
assert.ok(after.causalEvidence01>=0);
await rt.flush();
console.log(`P18_LONG_HORIZON=PASS cycles=${after.observedCycles} outcomes=${after.completedOutcomes} replay=${after.replayUpdates} causal=${after.causalEvidence01.toFixed(3)} resilience=${after.resilience01.toFixed(3)} consolidation=${after.replayUpdates}/${after.sleepConsolidations}`); rt.stop();
