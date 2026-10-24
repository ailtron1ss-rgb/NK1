import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nk161-'));
const stateFile=path.join(dir,'organism.json');
const worldStateFile=path.join(dir,'world.json');
const make=()=>new OrganismRuntime({stateFile,worldStateFile,enableLanguage:false,autoRun:false,intervalMs:100000});
const first=make();
await first.init();
const before=first.cognitiveEventFabricSnapshot();
for(const text of ['investigate an unknown signal','compare two explanations','revise the hypothesis','consolidate the result']) await first.step(text,{deliberate:true});
await first.flush();
const mid=first.cognitiveEventFabricSnapshot();
assert.ok(mid);
assert.ok(mid.total>=24,'each operational step should create a full causal chain');
assert.ok(mid.cycleCoverage01>=0.99,'operational cycles should have observation/prediction/action/outcome');
assert.ok(mid.lineageIntegrity01>=0.99,'causal parent lineage should remain intact in the buffer');
assert.equal(mid.danglingParentLinks,0);
assert.ok(mid.recent.some(e=>e.stage==='learning'));
assert.ok(mid.recent.some(e=>e.stage==='self-update'));
const second=make();
await second.init();
const resumed=second.cognitiveEventFabricSnapshot();
assert.ok(resumed);
assert.ok(resumed.total>=mid.total,'cognitive event total must survive restart');
assert.ok(resumed.buffered>=Math.min(mid.buffered,128));
assert.equal(resumed.danglingParentLinks,0);
// The richer verifier must check optional-stage identity and causal edges. This
// specifically protects against duplicate class methods silently replacing it.
const causalFabric = new CognitiveEventFabric(128);
const phaseIds = causalFabric.recordOperationalCycle({
  tick: 700,
  observation: { payload: { observation: 'signal' } },
  prediction: { payload: { prediction: 'expected' } },
  appraisal: { payload: { appraisal: 'uncertain' } },
  attention: { payload: { attention: 'focused' } },
  memory: { payload: { memory: 'recalled' } },
  goal: { payload: { goal: 'investigate' } },
  plan: { payload: { plan: 'compare' } },
  action: { payload: { action: 'measure' } },
  outcome: { payload: { outcome: 'observed' } },
  learning: { payload: { learning: 'update' } },
  selfUpdate: { payload: { selfUpdate: 'integrated' } },
});
const stageIds = { ...phaseIds, 'self-update': phaseIds.selfUpdate };
const completeCycle = causalFabric.verifyOperationalCycle(stageIds);
assert.equal(completeCycle.complete, true, 'a fully linked 11-phase cycle should verify');
assert.deepEqual(completeCycle.missingEdges, []);

const detachedAppraisal = causalFabric.append({
  tick: 700,
  stage: 'appraisal',
  source: 'regression-detached-appraisal',
  parentIds: [],
  payload: { appraisal: 'detached' },
});
const detachedCycle = causalFabric.verifyOperationalCycle({ ...stageIds, appraisal: detachedAppraisal.id });
assert.equal(detachedCycle.complete, false, 'optional stages with missing causal parents must fail verification');
assert.ok(detachedCycle.missingEdges.includes('appraisal->observation'));
assert.ok(detachedCycle.missingEdges.includes('appraisal->prediction'));
console.log('COGNITIVE_EVENT_FABRIC_OPTIONAL_STAGE_CAUSALITY=PASS');

console.log(JSON.stringify({pass:161,before:before?.total??0,after:mid,resumed:{total:resumed.total,buffered:resumed.buffered,lineageIntegrity01:resumed.lineageIntegrity01}},null,2));
first.stop(); second.stop();
fs.rmSync(dir,{recursive:true,force:true});
