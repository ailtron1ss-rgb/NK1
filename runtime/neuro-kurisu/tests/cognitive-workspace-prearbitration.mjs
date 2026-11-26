import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { GlobalWorkspaceSubstrateV2 } from '../src/organism/cognition/GlobalWorkspaceSubstrateV2.ts';

// The current cycle's workspace coalition must be formed before P61/P64 arbitration,
// and its ignition signal must be the signal consumed by that same arbitration.
const core = new OrganismCore(new MemoryStateStore(), {
  enableLanguage: false,
  enableWorkspace: true,
  cycleResultMode: 'operational',
});
await core.init();

const order = [];
let competed = null;
let arbitrationWorkspace01 = null;
let workspaceInputs = [];
let arbitrationCandidateScores = [];
const workspace = core.cognitiveRuntime.globalWorkspace;
const coordinator = core.cognitiveRuntime.cognitiveKernelCoordinator;
const compete = workspace.compete.bind(workspace);
const arbitrate = coordinator.integrateAndArbitrate.bind(coordinator);

workspace.compete = (...args) => {
  order.push('workspace');
  workspaceInputs = structuredClone(args[0]);
  competed = compete(...args);
  return competed;
};
coordinator.integrateAndArbitrate = (input, ...args) => {
  order.push('arbitration');
  arbitrationWorkspace01 = input.workspace01;
  arbitrationCandidateScores = input.candidates.map(candidate => ({ action: candidate.action, score: candidate.score }));
  return arbitrate(input, ...args);
};

await core.observe({
  text: 'Inspect the current lab situation and choose the safest useful next action.',
  novelty: 0.7,
  uncertainty: 0.35,
});

assert.ok(competed, 'the real runtime must compete the current cycle candidates');
assert.ok(competed.ignition01 > 0, 'the current cycle must produce a non-empty workspace ignition');
assert.ok(order.indexOf('workspace') >= 0 && order.indexOf('arbitration') >= 0,
  'both workspace competition and P61/P64 arbitration must execute');
assert.ok(order.indexOf('workspace') < order.indexOf('arbitration'),
  'current-cycle workspace competition must precede P61/P64 arbitration');
assert.equal(order.filter(event => event === 'workspace').length, 1,
  'the current cycle must compete the global workspace exactly once; no late duplicate competition is allowed');
assert.equal(order.at(-1), 'arbitration',
  'no global workspace competition may run after P61/P64 arbitration');
assert.equal(arbitrationWorkspace01, competed.ignition01,
  'P61/P64 must consume the ignition produced by this cycle, not a stale previous-cycle signal');

const actionByCandidateId = new Map(workspaceInputs.map(candidate => [candidate.id, candidate.content?.action]));
const sourceScoreByAction = new Map(workspaceInputs.map(candidate => [candidate.content?.action, candidate.features?.[0]]));
const selectedActions = new Set(competed.selectedIds.map(id => actionByCandidateId.get(id)).filter(Boolean));
// Verify the real OrganismCore cycle preserves the decision lane while admitting domain summaries.
const workspaceSourceById = new Map(workspaceInputs.map(candidate => [candidate.id, candidate.source]));
const selectedSources = new Set(competed.selectedIds.map(id => workspaceSourceById.get(id)).filter(Boolean));
assert.ok(selectedSources.has('decision'),
  'the integrated workspace coalition must preserve a decision candidate for the canonical selector');
assert.ok([...selectedSources].some(source => source !== 'decision'),
  'the integrated workspace coalition must broadcast at least one non-decision cognitive domain');
assert.ok(selectedActions.size > 0, 'the workspace must return a non-empty same-cycle coalition');
const supportRows = arbitrationCandidateScores.map(candidate => ({
  action: candidate.action,
  selected: selectedActions.has(candidate.action),
  delta: candidate.score - (sourceScoreByAction.get(candidate.action) ?? candidate.score),
}));
assert.ok(supportRows.some(row => row.selected && row.delta > 0.000001),
  'selected workspace candidates must influence same-cycle arbitration, not only produce a diagnostic ignition scalar');
assert.ok(supportRows.filter(row => row.selected).every(row => row.delta > 0 && row.delta <= 0.030001),
  'workspace coalition support must be positive but strictly bounded to 0.03');
assert.ok(supportRows.filter(row => !row.selected).every(row => Math.abs(row.delta) < 0.000001),
  'non-selected candidates must not receive global workspace coalition support');


const firstDecisionTrace = core.persisted.traces[0];
assert.ok(firstDecisionTrace?.id && firstDecisionTrace.selected,
  'the real OrganismCore cycle must emit a selected decision trace');
const firstDecisionReceipt = core.cognitiveRuntime.globalWorkspace.snapshot().decisionReceipts
  .find(receipt => receipt.decisionId === firstDecisionTrace.id);
assert.ok(firstDecisionReceipt,
  'the real OrganismCore cycle must freeze its workspace coalition against the decision ID');
const firstDecisionId = firstDecisionTrace.id;
const firstDecisionEventAnchors = firstDecisionTrace.cognitiveEventAnchors;
assert.ok(firstDecisionEventAnchors?.action && firstDecisionEventAnchors?.prediction,
  'the decision trace must persist its own observation/prediction/action CEF anchors');
await core.observe({
  text: 'Run a second cognitive cycle before the first decision receives its delayed result.',
  novelty: 0.22,
  uncertainty: 0.68,
});
assert.notEqual(core.persisted.traces[0]?.id, firstDecisionId,
  'the second observation must produce a distinct later decision');
const secondCycleEventAnchors = structuredClone(core.cognitiveCycleAnchors);
await core.feedback({
  decisionId: firstDecisionId,
  outcomeId: 'workspace-late-feedback-1',
  success: .92,
  reward: .88,
  evidenceSource: 'device',
});
assert.ok(core.cognitiveRuntime.canonicalTemporalCredit.snapshot().recentAssignments
  .some(assignment => assignment.decisionId === firstDecisionId && assignment.delayTicks > 0),
  'delayed Core feedback must resolve against its exact historical decision rather than the newest trace');
const delayedOutcomeEvent = core.cognitiveRuntime.cognitiveEventFabric.recent(128)
  .find(event => event.stage === 'outcome' && event.payload?.decisionId === firstDecisionId);
assert.ok(delayedOutcomeEvent,
  'delayed feedback must append a CEF outcome linked to the explicit historical decision');
assert.ok(delayedOutcomeEvent.parentIds.includes(firstDecisionEventAnchors.action),
  'the delayed outcome must parent the original decision action event');
assert.ok(delayedOutcomeEvent.parentIds.includes(firstDecisionEventAnchors.prediction),
  'the delayed outcome must parent the original decision prediction event');
assert.equal(core.cognitiveCycleAnchors.action, secondCycleEventAnchors.action,
  'delayed feedback must not clear or overwrite the newer active cognitive cycle anchors');

console.log('NK1_COGNITIVE_WORKSPACE_PREARBITRATION=PASS', JSON.stringify({
  order,
  ignition01: competed.ignition01,
  arbitrationWorkspace01,
}));


// Admission is deterministic, bounded, duplicate-safe and independent of input ordering.
const admissionCandidates = Array.from({ length: 80 }, (_, i) => ({
  id: `candidate-${String(i).padStart(2, '0')}`,
  source: i % 2 ? 'perception' : 'memory',
  salience: i === 79 ? 1 : 0.2 + (i % 7) * 0.01,
  features: [i === 79 ? 1 : 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}));
const admissionA = new GlobalWorkspaceSubstrateV2();
const admissionB = new GlobalWorkspaceSubstrateV2();
const admittedA = admissionA.compete(admissionCandidates);
const admittedB = admissionB.compete([...admissionCandidates].reverse());
assert.deepEqual(admittedA.selectedIds, admittedB.selectedIds,
  'candidate admission must not depend on producer array order');
assert.ok(admittedA.selectedIds.includes('candidate-79'),
  'a high-salience late candidate must not be silently dropped by first-64 truncation');
assert.equal(admissionA.diagnostics().admission.admittedCount, 64,
  'workspace admission must enforce its 64-candidate compute bound');

const duplicateWorkspace = new GlobalWorkspaceSubstrateV2();
const duplicateResult = duplicateWorkspace.compete([
  { id: 'same-id', source: 'memory', salience: 0.1, features: new Array(12).fill(0) },
  { id: 'same-id', source: 'perception', salience: 0.95, features: [1, ...new Array(11).fill(0)] },
  { id: 'other-id', source: 'goal', salience: 0.5, features: new Array(12).fill(0) },
]);
assert.equal(duplicateResult.selectedIds.filter(id => id === 'same-id').length, 1,
  'duplicate candidate identities must never occupy multiple coalition slots');
assert.equal(duplicateWorkspace.diagnostics().admission.duplicateCount, 1,
  'duplicate identity rejection must be observable in diagnostics');
assert.equal(duplicateWorkspace.diagnostics().admission.uniqueCount, 2,
  'the strongest version of a repeated candidate identity must be retained');


const sourceBalancedWorkspace = new GlobalWorkspaceSubstrateV2();
const sourceBalancedCandidates = [
  ...Array.from({ length: 80 }, (_, i) => ({
    id: `dominant-${i}`, source: 'memory', salience: 0.95,
    features: [0.8, ...new Array(11).fill(0)],
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `minority-${i}`, source: 'perception', salience: 0.45,
    features: [0.3, ...new Array(11).fill(0)],
  })),
];
sourceBalancedWorkspace.compete(sourceBalancedCandidates);
const sourceAdmission = sourceBalancedWorkspace.diagnostics().admission.admittedBySource;
const sourceById = new Map(sourceBalancedCandidates.map(candidate => [candidate.id, candidate.source]));
assert.ok(sourceBalancedWorkspace.snapshot().selectedIds.some(id => sourceById.get(id) === 'perception'),
  'the final attention coalition must preserve at least one lower-volume source, not only admit it');
assert.equal(sourceAdmission.memory, 52,
  'after reserving admission for other sources, remaining capacity may be filled by the strongest candidates');
assert.equal(sourceAdmission.perception, 12,
  'lower-volume sources must retain admission even when a dominant source emits many higher-salience candidates');
assert.equal(sourceBalancedWorkspace.diagnostics().admission.admittedCount, 64,
  'the second admission pass must fill remaining capacity with real candidates');


 // Delayed outcome credit must remain bound to the decision-time coalition across
 // a later competition and a process-style snapshot/restore boundary.
const delayedWorkspace = new GlobalWorkspaceSubstrateV2();
delayedWorkspace.compete([
  { id: 'decision-credit-a', source: 'decision', salience: .96,
    features: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], content: { action: 'explore' } },
  { id: 'memory-credit-a', source: 'memory', salience: .24,
    features: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], content: { signal: 'memory-context' } },
]);
const captureA = delayedWorkspace.registerDecision({ decisionId: 'decision-credit-a', tick: 4, action: 'explore', at: 400 });
assert.equal(captureA.recorded, true,
  'the workspace must capture a selected decision lane against the immutable decision identity');
const checkpointWithOpenCredit = delayedWorkspace.snapshot();
const restoredDelayedWorkspace = new GlobalWorkspaceSubstrateV2();
restoredDelayedWorkspace.restore(checkpointWithOpenCredit);
restoredDelayedWorkspace.compete([
  { id: 'decision-credit-b', source: 'decision', salience: .96,
    features: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], content: { action: 'rest' } },
  { id: 'memory-credit-b', source: 'memory', salience: .24,
    features: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], content: { signal: 'different-context' } },
]);
const decisionBReceipt = restoredDelayedWorkspace.registerDecision({
  decisionId: 'another-decision', tick: 5, action: 'rest', at: 500,
});
assert.equal(decisionBReceipt.recorded, true,
  'the later coalition must be frozen against its own decision identity');
const gateBeforeDelayedCredit = restoredDelayedWorkspace.snapshot().gateWeights.slice();
const delayedResult = restoredDelayedWorkspace.learnOutcomeForDecision({
  decisionId: 'decision-credit-a', outcomeId: 'outcome-credit-a',
  reward01: .98, learningRate: .2, learningScale01: 1,
});
assert.equal(delayedResult.updated, true,
  'a delayed outcome must update the exact stored decision receipt after a newer competition');
assert.ok(restoredDelayedWorkspace.snapshot().gateWeights[0] > gateBeforeDelayedCredit[0],
  'the delayed outcome must update the captured decision feature, not the newer all-zero feature vector');
const gateAfterFirstCredit = restoredDelayedWorkspace.snapshot().gateWeights.slice();
const replayResult = restoredDelayedWorkspace.learnOutcomeForDecision({
  decisionId: 'decision-credit-a', outcomeId: 'outcome-credit-a',
  reward01: .98, learningRate: .2, learningScale01: 1,
});
assert.equal(replayResult.replayed, true,
  'replaying the same outcome identity must not apply workspace learning twice');
assert.deepEqual(restoredDelayedWorkspace.snapshot().gateWeights, gateAfterFirstCredit,
  'duplicate outcome replay must leave learned workspace parameters unchanged');
const missingCredit = restoredDelayedWorkspace.learnOutcomeForDecision({
  decisionId: 'unknown-decision', outcomeId: 'unknown-outcome',
  reward01: .1, learningRate: .2, learningScale01: 1,
});
assert.equal(missingCredit.updated, false,
  'an outcome without a matching decision receipt must fail closed rather than credit the latest coalition');
assert.deepEqual(restoredDelayedWorkspace.snapshot().gateWeights, gateAfterFirstCredit,
  'unmatched outcomes must not change workspace parameters');

const tamperedReceiptWorkspace = new GlobalWorkspaceSubstrateV2();
tamperedReceiptWorkspace.compete([
  { id: 'tamper-decision', source: 'decision', salience: .99,
    features: [1, ...new Array(11).fill(0)], content: { action: 'explore' } },
  { id: 'tamper-memory', source: 'memory', salience: .3,
    features: [0, 1, ...new Array(10).fill(0)], content: { signal: 'memory' } },
]);
tamperedReceiptWorkspace.registerDecision({ decisionId: 'tamper-decision', tick: 6, action: 'explore', at: 600 });
const tamperedReceiptState = tamperedReceiptWorkspace.snapshot();
const tamperedReceipt = tamperedReceiptState.decisionReceipts[0];
const tamperedDecisionCandidate = tamperedReceipt.coalition.find(candidate => candidate.source === 'decision');
assert.ok(tamperedDecisionCandidate, 'the decision lane must be present in the stored coalition');
tamperedDecisionCandidate.candidateAction = 'rest';
tamperedDecisionCandidate.eligible = true;
const tamperedRestore = new GlobalWorkspaceSubstrateV2();
tamperedRestore.restore(tamperedReceiptState);
const beforeTamperCredit = tamperedRestore.snapshot().gateWeights.slice();
const tamperAttempt = tamperedRestore.learnOutcomeForDecision({
  decisionId: 'tamper-decision', outcomeId: 'tamper-outcome',
  reward01: .99, learningRate: .2, learningScale01: 1,
});
assert.equal(tamperAttempt.updated, false,
  'a restored eligibility bit must not override the immutable decision action recorded in the receipt');
assert.equal(tamperAttempt.reason, 'decision-action-not-in-coalition',
  'mismatched persisted action provenance must fail closed');
assert.deepEqual(tamperedRestore.snapshot().gateWeights, beforeTamperCredit,
  'tampered decision receipts must not change workspace weights');

const crossDecisionReuse = restoredDelayedWorkspace.learnOutcomeForDecision({
  decisionId: 'another-decision', outcomeId: 'outcome-credit-a',
  reward01: .1, learningRate: .2, learningScale01: 1,
});
assert.equal(crossDecisionReuse.updated, false,
  'one outcome identity must never be reused to credit a second decision');
assert.equal(crossDecisionReuse.reason, 'outcome-id-already-bound-to-different-decision',
  'cross-decision outcome reuse must produce an explicit integrity rejection');
const invalidRateResult = restoredDelayedWorkspace.learnOutcomeForDecision({
  decisionId: 'decision-credit-a', outcomeId: 'outcome-credit-nan',
  reward01: .98, learningRate: Number.NaN, learningScale01: 1,
});
assert.equal(invalidRateResult.updated, true,
  'an invalid learning-rate override must degrade to a zero-rate receipt rather than poison workspace parameters');
assert.ok(restoredDelayedWorkspace.snapshot().gateWeights.every(Number.isFinite),
  'invalid external learning-rate values must never introduce NaN parameters');


const boundedReceiptWorkspace = new GlobalWorkspaceSubstrateV2();
for (let i = 0; i < 65; i++) {
  boundedReceiptWorkspace.compete([{
    id: `bounded-decision-${i}`, source: 'decision', salience: .9,
    features: [1, ...new Array(11).fill(0)], content: { action: 'explore' },
  }]);
  const registration = boundedReceiptWorkspace.registerDecision({
    decisionId: `bounded-trace-${i}`, tick: i, action: 'explore', at: i * 100,
  });
  assert.equal(registration.recorded, true,
    'each unique decision must be recorded before the bounded receipt limit is reached');
}
assert.equal(boundedReceiptWorkspace.snapshot().decisionReceipts.length, 64,
  'workspace decision receipts must remain bounded at 64');
assert.equal(boundedReceiptWorkspace.diagnostics().expiredDecisionReceipts, 1,
  'evicting the oldest still-open receipt must be counted, not hidden');
assert.equal(boundedReceiptWorkspace.snapshot().decisionReceipts[0].decisionId, 'bounded-trace-1',
  'capacity pressure must evict only the oldest receipt');
assert.equal(boundedReceiptWorkspace.snapshot().decisionReceipts.at(-1).decisionId, 'bounded-trace-64',
  'the newest decision receipt must remain available');
assert.equal(boundedReceiptWorkspace.registerDecision({
  decisionId: 'bounded-trace-64', tick: 64, action: 'explore', at: 6400,
}).replayed, true,
  're-registering an exact decision identity must not create a duplicate receipt');
assert.equal(boundedReceiptWorkspace.registerDecision({
  decisionId: 'bounded-trace-64', tick: 64, action: 'rest', at: 6400,
}).reason, 'decision-id-conflict',
  'reusing a decision ID with a conflicting action must be rejected');

console.log('NK1_GLOBAL_WORKSPACE_ADMISSION=PASS', JSON.stringify({
  orderInvariant: true,
  admitted: admissionA.diagnostics().admission.admittedCount,
  overflow: admissionA.diagnostics().admission.overflowCount,
  duplicates: duplicateWorkspace.diagnostics().admission.duplicateCount,
}));
