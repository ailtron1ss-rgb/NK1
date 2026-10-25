import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { developmentEvidenceVerificationInput, developmentalOutcomeVerificationInput, P36_EXTERNAL_EVIDENCE_TOOL_ID, P36_DEVELOPMENTAL_OUTCOME_TOOL_ID } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';

let coreEvidenceReceiptCount=0;
let coreMaturityReceiptCount=0;
const p36IndependentEvaluator={
  capability:'learning.evaluation',
  destructive:false,
  projectAllowed:true,
  observationSource:{
    sourceId:'p36-host-fixture-evaluator',
    sourceClass:'external-api',
    channel:'tool',
    independenceKey:'host-owned-p36-test-evaluator',
  },
  execute:async()=>({ok:true,observationId:'core-action-gateway-p36-receipt-'+(++coreEvidenceReceiptCount)}),
  verify:({result})=>{
    const observationId=String(result.observationId??'');
    return {verified:Boolean(observationId),basis:'external-postcondition',externalObservation:true,confidence01:1,
      observationId,expectedPostcondition:'p36-evaluation-complete:'+observationId,
      observedPostcondition:'p36-evaluation-complete:'+observationId};
  },
};
const p36DevelopmentalOutcomeEvaluator={
  capability:'learning.maturity',
  destructive:false,
  projectAllowed:true,
  observationSource:{
    sourceId:'p36-host-fixture-maturity-evaluator',
    sourceClass:'external-api',
    channel:'tool',
    independenceKey:'host-owned-p36-test-maturity-evaluator',
  },
  execute:async()=>({ok:true,observationId:'core-p36-maturity-receipt-'+(++coreMaturityReceiptCount)}),
  verify:({result})=>{
    const observationId=String(result.observationId??'');
    return {verified:Boolean(observationId),basis:'external-postcondition',externalObservation:true,confidence01:1,
      observationId,expectedPostcondition:'maturity-evaluation-complete:'+observationId,
      observedPostcondition:'maturity-evaluation-complete:'+observationId};
  },
};
const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,p36IndependentEvaluator,p36DevelopmentalOutcomeEvaluator});
await core.init();
assert.ok(core.actionToolsSnapshot().some(tool=>tool.id===P36_EXTERNAL_EVIDENCE_TOOL_ID),
  'host construction config must register the reserved evaluator before the organism starts');
assert.ok(core.actionToolsSnapshot().some(tool=>tool.id===P36_DEVELOPMENTAL_OUTCOME_TOOL_ID),
  'host construction config must register the separate maturity evaluator before the organism starts');
const before=core.p36Snapshot();
const step=await core.observe({text:'проверить собственное развитие',novelty:.7,worldContext:{tick:1,location:'lab',energy:.72,attention:.82,uncertainty:.78,facts:['test'],objects:[],events:[]}});
await core.feedback({success:.8,reward:.6,surprise:.12,notes:'useful developmental outcome'});
const after=core.p36Snapshot();
assert.ok(after.cycles>=before.cycles);
assert.ok(after.hypotheses.length>=0);
assert.ok(after.experiments.length>=0);
assert.equal(after.developmentalMaturity.verifiedOutcomeCount,0,'runtime feedback booleans alone must not certify developmental maturity');
assert.equal(after.rejectedMaturityReceipts,0,'ordinary reward/transition booleans should no longer be submitted as independent maturity receipts');
assert.ok(step.decision.selected);
await core.flush();
const saved=await store.load();
assert.ok(saved.facets.learning.p36);
assert.equal(saved.facets.learning.p36.version,6,'runtime persistence must preserve the current P36 schema version');

// Exercise the actual core -> ActionGateway -> decision-linked verifier -> P36 route.
// The evaluator is a fixture; production must register a host-owned external evaluator
// under this reserved tool ID, while the learner cannot mint its own receipt.
const traceForEvidence=saved.traces.find(row=>row.selected!==null&&row.tick===row.stateBefore.tick);
assert.ok(traceForEvidence,'integration fixture needs a persisted decision trace for ActionGateway authority');
const hypothesis=core.p36Propose()??core.p36Snapshot().hypotheses[0];
assert.ok(hypothesis,'live core should have a P36 hypothesis to evaluate');
const evidenceInput=developmentEvidenceVerificationInput({
  hypothesisId:hypothesis.id,
  contextKey:'core-action-gateway-p36-context',
  control01:.4,
  treatment01:.6,
  holdout:false,
  delayMs:0,
  evaluatorVersion:'core-action-gateway-fixture-v1',
  evidenceSource:'external-evaluator',
});
assert.throws(()=>core.registerActionTool({
  id:P36_EXTERNAL_EVIDENCE_TOOL_ID,
  capability:'learning.evaluation',destructive:false,projectAllowed:true,
  execute:async()=>({ok:true,observationId:'forged-public-registry-receipt'}),
  verify:()=>({verified:true,basis:'external-postcondition',externalObservation:true,confidence01:1,observationId:'forged-public-registry-receipt',expectedPostcondition:'ok',observedPostcondition:'ok'}),
}),/reserved-p36-evaluator-must-be-configured-at-core-construction/,
'generic runtime tool registration cannot seize the reserved independent-evaluator identity');
assert.throws(()=>core.registerActionTool({
  id:P36_DEVELOPMENTAL_OUTCOME_TOOL_ID,
  capability:'learning.maturity',destructive:false,projectAllowed:true,
  execute:async()=>({ok:true,observationId:'forged-public-maturity-receipt'}),
  verify:()=>({verified:true,basis:'external-postcondition',externalObservation:true,confidence01:1,observationId:'forged-public-maturity-receipt',expectedPostcondition:'ok',observedPostcondition:'ok'}),
}),/reserved-p36-maturity-evaluator-must-be-configured-at-core-construction/,
'generic runtime registration cannot seize the reserved maturity evaluator identity');
const attemptsBeforeUnlinked=core.p36Diagnostics().unverifiedEvidenceAttempts;
const unlinkedInput=developmentEvidenceVerificationInput({...evidenceInput,contextKey:'core-unlinked-p36-context'});
const unlinkedResult=await core.executeTool(P36_EXTERNAL_EVIDENCE_TOOL_ID,unlinkedInput,'p36-unlinked-evidence');
assert.equal(unlinkedResult.verified,true,'the evaluator may verify its result, but the core decision-link gate is separate');
assert.equal(core.p36DevelopmentEvidence(hypothesis.id).find(row=>row.contextKey==='core-unlinked-p36-context').independentVerified,false,
  'a valid external receipt without a decision-linked trace must not enter independent learning');
assert.equal(core.p36Diagnostics().unverifiedEvidenceAttempts,attemptsBeforeUnlinked+1);
const evaluatorResult=await core.executeTool(P36_EXTERNAL_EVIDENCE_TOOL_ID,evidenceInput,'p36-integration-evidence',{decisionId:traceForEvidence.id});
assert.equal(evaluatorResult.verified,true,'the registered independent evaluator must return a verified gateway result');
const recorded=core.p36DevelopmentEvidence(hypothesis.id);
assert.ok(recorded.some(row=>row.independentVerified&&row.executionId===evaluatorResult.executionId&&row.decisionId===traceForEvidence.id),
  'only the exact decision-linked ActionGateway receipt should enter P36 as independent evidence');
await core.flush();
const afterEvaluator=await store.load();
assert.ok(afterEvaluator.facets.learning.p36.externalEvidence.some(row=>row.executionId===evaluatorResult.executionId&&row.independentVerified),
  'verified P36 evidence must be projected into the normal persistence checkpoint');

// Developmental maturity is a separate evidence lane. Legacy reward booleans do not update it;
// only a second ActionGateway receipt bound to the exact maturity tuple can do so.
const maturityInput=developmentalOutcomeVerificationInput({area:'learning',outcome01:.91,delayed:true,transfer:true});
assert.equal(maturityInput.kind,'developmental-outcome','the maturity event must use the dedicated evidence discriminant');
const maturityBefore=core.p36Diagnostics();
const wrongLaneMaturity=await core.executeTool(P36_EXTERNAL_EVIDENCE_TOOL_ID,maturityInput,'p36-maturity-on-experiment-lane',{decisionId:traceForEvidence.id});
assert.equal(wrongLaneMaturity.verified,true,'ActionGateway can verify an adapter response; Core still enforces the semantic evidence lane');
assert.equal(core.p36Diagnostics().developmentalMaturity.verifiedOutcomeCount,maturityBefore.developmentalMaturity.verifiedOutcomeCount,
  'instantaneous experiment evaluator must not update maturity even if given a maturity-shaped payload');
assert.equal(core.p36DevelopmentalOutcomeSnapshot?.(),undefined,'no alternate maturity snapshot route should be exposed');
const unlinkedMaturityResult=await core.executeTool(P36_DEVELOPMENTAL_OUTCOME_TOOL_ID,maturityInput,'p36-unlinked-maturity');
assert.equal(unlinkedMaturityResult.verified,true);
assert.equal(core.p36Diagnostics().developmentalMaturity.verifiedOutcomeCount,maturityBefore.developmentalMaturity.verifiedOutcomeCount,
  'unlinked maturity receipt must not update maturation');
assert.equal(core.p36Diagnostics().rejectedMaturityReceipts,maturityBefore.rejectedMaturityReceipts+1,
  'unlinked maturity attempt must be observable');
const maturityResult=await core.executeTool(P36_DEVELOPMENTAL_OUTCOME_TOOL_ID,maturityInput,'p36-linked-maturity',{decisionId:traceForEvidence.id});
assert.equal(maturityResult.verified,true);
const afterMaturity=core.p36Diagnostics().developmentalMaturity;
assert.equal(afterMaturity.verifiedOutcomeCount,maturityBefore.developmentalMaturity.verifiedOutcomeCount+1);
assert.equal(afterMaturity.retainedOutcomeCount,1);
assert.equal(afterMaturity.transferredOutcomeCount,1);
const maturityRejectionsBeforeReplay=core.p36Diagnostics().rejectedMaturityReceipts;
const directMaturityReplay=core.p36RecordDevelopmentalOutcome({
  ...maturityInput,
  toolId:P36_DEVELOPMENTAL_OUTCOME_TOOL_ID,
  executionId:maturityResult.executionId,
  decisionId:traceForEvidence.id,
  verification:maturityResult.verification,
});
assert.equal(directMaturityReplay.verifiedOutcomeCount,1,'Core public maturity API must require canonical proof and remain idempotent');
assert.equal(core.p36Diagnostics().rejectedMaturityReceipts,maturityRejectionsBeforeReplay,'an exact public-API replay must not be misreported as a rejected receipt');
await core.flush();
const afterMaturityPersistence=await store.load();
assert.equal(afterMaturityPersistence.facets.learning.p36.developmentalMaturity.verifiedOutcomeCount,1,
  'maturity evidence must survive the normal persistence checkpoint as a result, not as a trust flag');
console.log('P36_INTEGRATION=PASS',JSON.stringify({action:step.decision.selected.action,hypotheses:after.hypotheses.length,experiments:after.experiments.length,completedSteps:after.curriculum.completedSteps}));
