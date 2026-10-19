import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'nk162-runtime-'));
const stateStore=new MemoryStateStore();
const worldStore=new MemoryStateStore();
const mk=()=>new OrganismRuntime({
  stateFile:path.join(root,'organism.json'),
  intervalMs:60_000,
  enableLanguage:false,
  autoRun:false,
  stateStore,
  worldStateStore:worldStore,
  journal:new BoundedOperationalJournal(),
  checkpointMinIntervalMs:0,
  checkpointMaxDirtyCycles:1,
  enableLifelongLearning:true,
  performanceProfile:'mobile',
});
const rt=mk();
await rt.init();
const before=rt.unifiedCognitiveCycleSnapshot();
const step=await rt.step('Please investigate the unfamiliar result and learn from the outcome.');
const economy=rt.cognitiveResourceEconomySnapshot();
const evidence=rt.realityEvidenceLedgerSnapshot();
const cycle=rt.unifiedCognitiveCycleSnapshot();
assert.ok(step?.cycle?.state?.tick>=1);
assert.ok(cycle.cycles>before.cycles);
assert.equal(cycle.lastComplete,true);
assert.ok(cycle.meanStageCoverage01>0.9);
assert.ok(economy.cycles>=1);
assert.ok(evidence.total>=3);
assert.ok(evidence.simulatorCount>=1);
assert.ok(evidence.externalCount>=1);
await rt.core.flush();
const rt2=mk(); await rt2.init();
assert.equal(rt2.unifiedCognitiveCycleSnapshot().cycles,cycle.cycles);
assert.equal(rt2.cognitiveResourceEconomySnapshot().cycles,economy.cycles);
assert.equal(rt2.realityEvidenceLedgerSnapshot().total,evidence.total);
const status=rt2.core.operationalStatusSnapshot();
assert.equal(status.tick,step.cycle.state.tick);
await rt2.stop(); await rt.stop();
console.log(JSON.stringify({pass:162,status:'PASS',tick:status.tick,cycle, economy,evidence:{total:evidence.total,externalCount:evidence.externalCount,simulatorCount:evidence.simulatorCount}},null,2));
