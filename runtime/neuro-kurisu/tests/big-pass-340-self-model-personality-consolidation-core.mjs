import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { PredictiveSelfAgencySubstrate } from '../src/organism/cognition/PredictiveSelfAgencySubstrate.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

// WorkPass525: self-agency updates are credit-assigned and require trusted evidence on the production path.
const selfState={tick:1,at:1001,needs:{energy:.72,cognitiveLoad:.24,uncertainty:.3,novelty:.4,goalPressure:.5,socialNeed:.2,identityCoherence:.8}};
const actionIndex=2;
const zeroCausal=new PredictiveSelfAgencySubstrate(); const zeroBefore=zeroCausal.snapshot();
zeroCausal.learnOutcome('verify',.9,selfState,false,0); const zeroAfter=zeroCausal.snapshot();
assert.equal(zeroAfter.actionBias[actionIndex],zeroBefore.actionBias[actionIndex]);
assert.deepEqual(zeroAfter.actionRows[actionIndex],zeroBefore.actionRows[actionIndex]);
assert.equal(zeroAfter.predictionSamples,zeroBefore.predictionSamples,'zero causal credit must not inflate calibration samples');
const partial=new PredictiveSelfAgencySubstrate(), full=new PredictiveSelfAgencySubstrate();
const partialBefore=partial.snapshot().actionBias[actionIndex], fullBefore=full.snapshot().actionBias[actionIndex];
partial.learnOutcome('verify',.9,selfState,false,.25); full.learnOutcome('verify',.9,selfState,false,1);
assert.ok(Math.abs(partial.snapshot().actionBias[actionIndex]-partialBefore)<Math.abs(full.snapshot().actionBias[actionIndex]-fullBefore),
  'the lower causal match must receive a smaller update');

const verifier=new OutcomeVerificationService();
const execution={toolId:'test.write-document',input:{path:'draft.txt',content:'saved'},result:{ok:true},executionId:'exec-12345678',decisionId:'decision-workpass525'};
const receipt=await verifier.verify(execution,async()=>({verified:true,basis:'external-postcondition',confidence01:.84,externalObservation:true,observationId:'obs-workpass525',expectedPostcondition:'document saved',observedPostcondition:'document saved'}));
const verified=new PredictiveSelfAgencySubstrate(), verifiedBefore=verified.snapshot();
const binding={toolId:execution.toolId,input:execution.input,executionId:execution.executionId,decisionId:execution.decisionId};
assert.throws(()=>verified.learnVerifiedOutcome('verify',.9,selfState,false,1,{...receipt},binding),/predictive-self-agency-external-evidence-untrusted/);
assert.deepEqual(verified.snapshot(),verifiedBefore,'copied receipts must not authorize model updates');
assert.throws(()=>verified.learnVerifiedOutcome('verify',.9,selfState,false,1,receipt,{...binding,decisionId:'decision-other'}),/predictive-self-agency-external-evidence-untrusted/);
assert.deepEqual(verified.snapshot(),verifiedBefore,'mismatched decision IDs must not authorize model updates');
verified.learnVerifiedOutcome('verify',.9,selfState,false,1,receipt,binding);
assert.equal(verified.snapshot().predictionSamples,1,'exact decision-linked external evidence may update the model');

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
