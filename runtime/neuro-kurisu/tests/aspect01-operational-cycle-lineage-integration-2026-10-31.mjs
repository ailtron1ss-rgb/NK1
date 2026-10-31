import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nk-aspect01-lineage-'));
const stateFile=path.join(dir,'organism.json');
const worldStateFile=path.join(dir,'world.json');
const make=()=>new OrganismRuntime({stateFile,worldStateFile,enableLanguage:false,autoRun:false,intervalMs:100000});
let first,second;
try {
  first=make();
  await first.init();
  for(let i=0;i<3;i++) await first.autonomousStep();
  await first.flush();

  const cycle=first.unifiedCognitiveCycleSnapshot();
  assert.ok(cycle.cycles>=3,'runtime must advance the unified-cycle ledger for real autonomous steps');
  assert.equal(cycle.lastComplete,true,'the production path must complete all eleven phases with causal lineage');
  assert.deepEqual(cycle.lastMissingStages,[]);

  const snapshot=first.cognitiveEventFabricSnapshot();
  const current=snapshot.recent.filter(event=>event.tick===cycle.lastTick);
  const ids=Object.fromEntries(current.map(event=>[event.stage,event.id]));
  const required=['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update'];
  for(const stage of required) assert.equal(typeof ids[stage],'string',`missing runtime event for ${stage}`);
  assert.equal(new Set(required.map(stage=>ids[stage])).size,required.length,'runtime phase IDs must be unique');

  const verifier=new CognitiveEventFabric(512);
  verifier.restore(snapshot);
  const lineage=verifier.verifyOperationalCycle(ids,cycle.lastTick);
  assert.equal(lineage.complete,true,'the persisted event graph must verify as a complete operational cycle');
  assert.equal(lineage.integrity01,1);
  assert.deepEqual(lineage.missingEdges,[]);
  const wrongTick=verifier.verifyOperationalCycle(ids,cycle.lastTick+1);
  assert.equal(wrongTick.complete,false,'a valid trace from a different tick must not satisfy this cycle');
  assert.ok(wrongTick.invalidStages.includes('cycle:tick-mismatch'));

  await first.stop();
  second=make();
  await second.init();
  const restored=second.unifiedCognitiveCycleSnapshot();
  assert.ok(restored.cycles>=cycle.cycles,'unified-cycle state must survive a real runtime restart');
  assert.equal(restored.lastTick,cycle.lastTick);
  assert.equal(restored.lastComplete,true);
  console.log(`ASPECT01_RUNTIME_CYCLE_LINEAGE=PASS cycles=${restored.cycles} tick=${restored.lastTick} lineage=${lineage.integrity01}`);
} finally {
  if(first) await first.stop().catch(()=>undefined);
  if(second) await second.stop().catch(()=>undefined);
  fs.rmSync(dir,{recursive:true,force:true});
}
