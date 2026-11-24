import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0});
await core.init();
const h=core.p36Propose();
assert.ok(h===null || h.id);
if(h){
  const x=core.p36RunExperiment(h.id,11);
  assert.ok(x?.safeSandbox===true);
}
assert.ok(core.p36Diagnostics().cycles>=0);
console.log('P36_SERVER_LOGIC=PASS',JSON.stringify(core.p36Diagnostics()));
