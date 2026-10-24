import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { PredictiveSelfAgencySubstrate } from '../src/organism/cognition/PredictiveSelfAgencySubstrate.ts';

// WorkPass460: outcome learning receives causal credit only when the action/outcome link supports it.
const selfState={tick:1,at:1001,needs:{energy:.72,cognitiveLoad:.24,uncertainty:.3,novelty:.4,goalPressure:.5,socialNeed:.2,identityCoherence:.8}};
const verifyActionIndex=2;
const noCausalCredit=new PredictiveSelfAgencySubstrate();
const noCreditBefore=noCausalCredit.snapshot();
noCausalCredit.learnOutcome('verify',1,selfState,false,0);
const noCreditAfter=noCausalCredit.snapshot();
assert.equal(noCreditAfter.actionBias[verifyActionIndex],noCreditBefore.actionBias[verifyActionIndex],
  'causally unrelated outcomes must not update action value');
assert.deepEqual(noCreditAfter.actionRows[verifyActionIndex],noCreditBefore.actionRows[verifyActionIndex],
  'causally unrelated outcomes must not update action features');
assert.equal(noCreditAfter.agencyError01,noCreditBefore.agencyError01,
  'unrelated outcomes must not distort agency calibration');
assert.equal(noCreditAfter.ownership01,noCreditBefore.ownership01);
assert.equal(noCreditAfter.predictionSamples,noCreditBefore.predictionSamples,
  'unrelated outcomes must not inflate confidence evidence');
const partialCredit=new PredictiveSelfAgencySubstrate();
const partialBefore=partialCredit.snapshot().actionBias[verifyActionIndex];
partialCredit.learnOutcome('verify',1,selfState,false,.25);
const partialDelta=Math.abs(partialCredit.snapshot().actionBias[verifyActionIndex]-partialBefore);
const fullCredit=new PredictiveSelfAgencySubstrate();
const fullBefore=fullCredit.snapshot().actionBias[verifyActionIndex];
fullCredit.learnOutcome('verify',1,selfState,false,1);
const fullDelta=Math.abs(fullCredit.snapshot().actionBias[verifyActionIndex]-fullBefore);
assert.ok(partialDelta>0&&partialDelta<fullDelta,
  'low causal confidence must scale down the policy update rather than receive full credit');
assert.equal(fullCredit.snapshot().predictionSamples,1,
  'strongly matched outcome evidence should count toward prediction calibration');

const dir=await mkdtemp(path.join(tmpdir(),'nk-b340-core-'));
try {
 const r=new OrganismRuntime({stateFile:path.join(dir,'s.json'),worldStateFile:path.join(dir,'w.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal()});
 await r.init();
 const before=r.core.personalitySummary().causalUpdates ?? 0;
 for(let i=0;i<10;i++) await r.step();
 const after=r.core.personalitySummary();
 const diag=r.core.causalPersonalityDevelopmentSnapshot?.() ?? r.core.developmentalCausalSnapshot?.();
 assert.ok((after.causalUpdates ?? 0)>before,'live runtime should update personality hypotheses');
 assert.ok((after.trajectorySamples ?? 0)>0,'live runtime should append personality trajectory evidence');
 assert.ok(diag,'core should expose developmental/personality diagnostics');
 console.log(`B340_CORE_SELF_MODEL_PERSONALITY_CONSOLIDATION=PASS ticks=10 causalUpdates=${after.causalUpdates} trajectory=${after.trajectorySamples}`);
 await r.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
