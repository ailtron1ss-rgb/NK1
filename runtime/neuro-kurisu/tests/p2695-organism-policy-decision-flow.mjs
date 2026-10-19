import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const embodiment={bodyEnergy01:.78,cognitiveCapacity01:.86,thermalStrain01:.12,sensoryFreshness01:.95,awake:true,battery01:.82,cpuLoad01:.18,ramPressure01:.20};
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
await core.observe({text:'Kurisu policy decision continuity probe: causal replay memory should preserve its exact retrieval decision.',novelty:.72,surprise:.38,embodiment},'operational');

const retrieved=core.memoryRetrieveWithPolicyDecision('causal replay memory exact retrieval decision continuity probe',8);
assert.ok(retrieved.decisionId,'retrieval must expose an exact policy decision id');
assert.ok(retrieved.rows.length>0,'retrieval must return at least one memory');
const memoryId=retrieved.rows[0].id;
const before=core.adaptiveMemoryPolicyOutcomeDiagnostics();
assert.equal(before.lastPolicyDecisionId,retrieved.decisionId);

const replay=core.experienceContinuumReactivate(memoryId);
assert.ok(replay,'memory must be present in the experience continuum');
const verificationService=new OutcomeVerificationService();
const verification=await verificationService.verify({toolId:'p2695-independent-test-harness',input:{memoryId},result:{retentionScore01:.88}},()=>({verified:true,basis:'external-postcondition',confidence01:1,externalObservation:true,observationId:`p2695-observation:${retrieved.decisionId}`,expectedPostcondition:'retention score independently measured',observedPostcondition:'retention score independently measured'}));
assert.equal(verification.verified,true);
const validation=core.experienceContinuumReplayValidate({
  memoryId,
  retentionScore01:.88,
  baselineScore01:.62,
  delayMs:2*86400000,
  transferPotential01:.81,
  interferenceRisk01:.12,
  independentVerified:true, // legacy claim is ignored; verifier-issued object below is authoritative.
  verification,
  evidenceKey:`p2695:${retrieved.decisionId}`,
  taskId:'p2695-policy-flow',
  contextKey:'p2695',
  replayEventId:replay && `replay:${memoryId}:${replay.lastReplayedAt}`,
  policyDecisionId:retrieved.decisionId,
  at:Date.now()+10,
});
assert.ok(validation.adaptivePolicyOutcome,'validation must resolve the exact decision');
assert.equal(validation.adaptivePolicyOutcome.decisionId,retrieved.decisionId);

const diag=core.adaptiveMemoryPolicyOutcomeDiagnostics();
assert.ok(diag.resolved>=1);
assert.ok(diag.pending < before.pending + 1);
assert.ok(diag.pending >= 0);

const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await restored.init();
const restoredDiag=restored.adaptiveMemoryPolicyOutcomeDiagnostics();
assert.ok(restoredDiag.resolved>=1);

console.log(JSON.stringify({
  ok:true,
  decisionId:retrieved.decisionId,
  memoryId,
  policy:validation.adaptivePolicyOutcome.policy,
  contextKey:validation.adaptivePolicyOutcome.contextKey,
  reward01:Number(validation.adaptivePolicyOutcome.reward01.toFixed(4)),
  delayed01:Number(validation.adaptivePolicyOutcome.delayed01.toFixed(4)),
  causalCredit01:Number(validation.adaptivePolicyOutcome.causalCredit01.toFixed(4)),
  resolved:diag.resolved,
  pending:diag.pending,
  restoredResolved:restoredDiag.resolved
},null,2));
