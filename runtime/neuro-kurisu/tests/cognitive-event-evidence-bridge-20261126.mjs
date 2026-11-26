import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { RuntimeEvidenceBus } from '../src/organism/system/RuntimeEvidenceBus.ts';

const tick = 42;
const bus = new RuntimeEvidenceBus(128);
const observation = bus.publish({ tick, kind:'observation', source:'runtime', payload:{ external:true } });
const prediction = bus.publish({ tick, kind:'prediction', source:'reward-model', parentIds:[observation.id], payload:{ predicted01:.7 } });
const risk = bus.publish({ tick, kind:'action', source:'risk-aware-recovery-controller', parentIds:[observation.id], payload:{ risk01:.2 } });
const action = bus.publish({ tick, kind:'action', source:'organism-action-gate', parentIds:[prediction.id,risk.id], payload:{ action:'observe' } });
const outcome = bus.publish({ tick, kind:'outcome', source:'shadow-simulator', parentIds:[action.id,prediction.id], payload:{ reward01:.6 } });

const attentionReceipt = {
  id:'nk1-cycle:42:attention',
  cycleId:'nk1-cycle:42',
  tick,
  stage:'attention',
  owner:'OrganismCore.attend',
  status:'completed',
  inputRefs:[observation.id],
  outputRefs:['attention-state:42'],
  consumedStageReceipts:[],
  outputHash:'a'.repeat(64),
};
const memoryReceipt = {
  id:'nk1-cycle:42:memory',
  cycleId:'nk1-cycle:42',
  tick,
  stage:'memory',
  owner:'MemoryFabric.retrieveForCognition',
  status:'completed_empty',
  inputRefs:['query-sha256:'+'b'.repeat(64)],
  outputRefs:[],
  consumedStageReceipts:[attentionReceipt.id],
  outputHash:'c'.repeat(64),
};

const fabric = new CognitiveEventFabric(128);
const ids = fabric.recordOperationalCycle({
  tick,
  observation:{ source:'runtime', payload:{ evidenceId:observation.id } },
  prediction:{ source:'reward-model', payload:{ evidenceId:prediction.id } },
  appraisal:{ source:'homeostatic-appraisal' },
  attention:{ source:'OrganismCore.attend', receipt:attentionReceipt, payload:{ timing:'pre-decision' } },
  memory:{ source:'MemoryFabric.retrieveForCognition', receipt:memoryReceipt, payload:{ status:'completed_empty' } },
  goal:{ source:'canonical-goal-selection' },
  plan:{ source:'plan-engine' },
  action:{ source:'organism-action-gate', payload:{ evidenceId:action.id } },
  outcome:{ source:'shadow-simulator', payload:{ evidenceId:outcome.id } },
  learning:{ source:'core.feedback' },
  selfUpdate:{ source:'core.lifecycle' },
});
const actualEvidence = bus.recent(128);
const stageIds = {
  observation:ids.observation,
  prediction:ids.prediction,
  appraisal:ids.appraisal,
  attention:ids.attention,
  memory:ids.memory,
  goal:ids.goal,
  plan:ids.plan,
  action:ids.action,
  outcome:ids.outcome,
  learning:ids.learning,
  'self-update':ids.selfUpdate,
};

const verified = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], actualEvidence);
assert.equal(verified.coreComplete, true);
assert.equal(verified.ownerEvidenceComplete, true);
assert.equal(verified.evidenceVerification, 'verified');
assert.equal(verified.evidenceComplete, true);
assert.equal(verified.fullComplete, true);
assert.deepEqual(verified.missingEvidenceRefs, []);
assert.deepEqual(verified.invalidEvidenceRefs, []);

// Existing direct callers remain compatible until they explicitly supply the bus view.
const legacyCall = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt]);
assert.equal(legacyCall.evidenceVerification, 'not-requested');
assert.equal(legacyCall.fullComplete, true);

// A graph with valid CEF parent edges is not a full cycle if its evidence refs cannot resolve.
const noEvidence = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], []);
assert.equal(noEvidence.evidenceVerification, 'incomplete');
assert.equal(noEvidence.evidenceComplete, false);
assert.equal(noEvidence.fullComplete, false);
assert.equal(noEvidence.missingEvidenceRefs.length, 4);

// A broken RuntimeEvidenceBus causal edge must fail closed.
const brokenOutcomeEvidence = actualEvidence.map(event => event.id === outcome.id
  ? { ...event, parentIds:[prediction.id] }
  : event);
const brokenOutcome = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], brokenOutcomeEvidence);
assert.equal(brokenOutcome.fullComplete, false);
assert.ok(brokenOutcome.invalidEvidenceRefs.includes('outcome:missing-action-parent'));

// The action-to-risk chain is mandatory, not just the visible action/prediction edge.
const brokenRiskEvidence = actualEvidence.map(event => event.id === risk.id
  ? { ...event, parentIds:[] }
  : event);
const brokenRisk = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], brokenRiskEvidence);
assert.equal(brokenRisk.fullComplete, false);
assert.ok(brokenRisk.invalidEvidenceRefs.includes('action:risk-parent-missing-observation'));

// An event ID cannot be used to relabel evidence from another category.
const wrongKindEvidence = actualEvidence.map(event => event.id === observation.id
  ? { ...event, kind:'resource' }
  : event);
const wrongKind = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], wrongKindEvidence);
assert.equal(wrongKind.fullComplete, false);
assert.ok(wrongKind.invalidEvidenceRefs.includes('observation:kind-mismatch'));

// Duplicate IDs create ambiguous lineage and are rejected.
const duplicateEvidence = [...actualEvidence, { ...observation }];
const duplicate = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], duplicateEvidence);
assert.equal(duplicate.fullComplete, false);
assert.ok(duplicate.invalidEvidenceRefs.includes('runtime-evidence:duplicate-id'));

// An accessor-shaped event is rejected without invoking the getter.
let hostileGetterInvoked = false;
const hostilePrediction = { ...prediction };
Object.defineProperty(hostilePrediction, 'kind', {
  enumerable:true,
  get() { hostileGetterInvoked = true; throw new Error('getter-must-not-run'); },
});
const hostileEvidence = actualEvidence.map(event => event.id === prediction.id ? hostilePrediction : event);
const hostile = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], hostileEvidence);
assert.equal(hostile.fullComplete, false);
assert.equal(hostileGetterInvoked, false);
assert.ok(hostile.invalidEvidenceRefs.includes('runtime-evidence:event-shape-invalid'));

// Proxies are rejected before their traps can become part of evidence verification.
const proxiedEvidence = new Proxy(actualEvidence, {});
const proxyCheck = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], proxiedEvidence);
assert.equal(proxyCheck.fullComplete, false);
assert.ok(proxyCheck.invalidEvidenceRefs.includes('runtime-evidence:not-plain-array'));

// Cross-tick evidence is not accepted, even when the event ID and kind match.
const crossTickEvidence = actualEvidence.map(event => event.id === prediction.id
  ? { ...event, tick:tick+1 }
  : event);
const crossTick = fabric.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], crossTickEvidence);
assert.equal(crossTick.fullComplete, false);
assert.ok(crossTick.invalidEvidenceRefs.includes('prediction:tick-mismatch'));

// A restored CEF preserves its event references and can be re-verified against the canonical bus.
const restored = new CognitiveEventFabric(128);
restored.restore(fabric.snapshot());
const restoredCheck = restored.verifyOperationalCycle(stageIds, [attentionReceipt,memoryReceipt], actualEvidence);
assert.equal(restoredCheck.fullComplete, true);
assert.equal(restoredCheck.evidenceComplete, true);

console.log('COGNITIVE_EVENT_EVIDENCE_BRIDGE=PASS', JSON.stringify({
  stages:11,
  ownerReceipts:2,
  runtimeEvidenceEvents:actualEvidence.length,
  evidenceVerification:verified.evidenceVerification,
  restoredFullComplete:restoredCheck.fullComplete,
}));
