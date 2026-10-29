import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';
import { OutcomeVerificationService } from '../src/organism/system/OutcomeVerificationService.ts';

const f = new ExperienceContinuumFabric({ maxNodes: 64, maxEdges: 128, maxClusters: 16 });
const base = {
  id: 'm105', kind: 'episodic', source: 'runtime',
  content: 'controlled replay protocol retention transfer', createdAt: 1, lastAccessAt: 1,
  retrievalCount: 1, salience: .82, identityRelevance: .71, goalRelevance: .83,
  predictionError: .68, emotionalWeight: .44, socialRelevance: .52, confidence: .84,
  semanticLinks: [], temporalLinks: [], causalLinks: [], epistemicStatus: 'verified',
};
f.observe(base, {
  tick: 1, at: 1, novelty01: .77, activeGoalIds: ['goal-A'],
  identityContinuity01: .9, valueStability01: .88, evidenceSupport01: .84,
});
const proto = f.createReplayExperimentProtocol({
  id: 'exp105', taskId: 'task-target', sourceTaskId: 'task-source', targetTaskId: 'task-target',
  randomized: true, balanced: true, requiredPairs: 2, contextKeys: ['c1', 'c2', 'c3'], at: 100,
});
assert.equal(proto.requiredPairs, 2);
for (const pair of ['c1', 'c2']) {
  f.recordReplayExperimentTrial({
    experimentId: 'exp105', taskId: 'task-target', mode: 'replay-on',
    preScore01: .5, postScore01: .76, independentVerified: true,
    randomized: true, contextKey: pair, pairKey: `p-${pair}`, at: 1000,
  });
  f.recordReplayExperimentTrial({
    experimentId: 'exp105', taskId: 'task-target', mode: 'replay-off',
    preScore01: .5, postScore01: .57, independentVerified: true,
    randomized: true, contextKey: pair, pairKey: `p-${pair}`, at: 1001,
  });
}
const gate = f.replayExperimentProtocolCheck('exp105', 'task-target');
assert.equal(gate.eligibleForConfirmatoryInference, true);
assert.equal(gate.matchedPairs, 2);
const replayLedger = f.replayEvidenceLedger();
assert.ok(Array.isArray(replayLedger));

// Confirmatory inference must remain within the predeclared context manifest.
const unplannedFabric = new ExperienceContinuumFabric({ maxNodes: 16, maxEdges: 32, maxClusters: 8 });
unplannedFabric.createReplayExperimentProtocol({
  id: 'exp-unplanned-context', taskId: 'task-target', randomized: true, balanced: true,
  requiredPairs: 2, contextKeys: ['declared-c1', 'declared-c2'], at: 200,
});
for (const pairKey of ['rogue-p1', 'rogue-p2']) {
  unplannedFabric.recordReplayExperimentTrial({
    experimentId: 'exp-unplanned-context', taskId: 'task-target', mode: 'replay-on',
    preScore01: .5, postScore01: .9, independentVerified: true,
    randomized: true, contextKey: 'undeclared-context', pairKey, at: 201,
  });
  unplannedFabric.recordReplayExperimentTrial({
    experimentId: 'exp-unplanned-context', taskId: 'task-target', mode: 'replay-off',
    preScore01: .5, postScore01: .4, independentVerified: true,
    randomized: true, contextKey: 'undeclared-context', pairKey, at: 202,
  });
}
const unplannedGate = unplannedFabric.replayExperimentProtocolCheck('exp-unplanned-context', 'task-target');
assert.equal(unplannedGate.matchedPairs, 2);
assert.equal(unplannedGate.eligibleForConfirmatoryInference, false,
  'a balanced set of trials outside the predeclared context manifest cannot confirm the hypothesis');
assert.equal(unplannedGate.reason, 'undeclared-context-key');
assert.deepEqual(unplannedGate.undeclaredContextKeys, ['undeclared-context']);

// Duplicating one condition in a matched pair must not let the last row silently
// replace the earlier measurement and bias the reported paired estimate.
const duplicateFabric = new ExperienceContinuumFabric({ maxNodes: 16, maxEdges: 32, maxClusters: 8 });
duplicateFabric.createReplayExperimentProtocol({
  id: 'exp-duplicate-pair', taskId: 'task-target', randomized: true, balanced: true,
  requiredPairs: 2, contextKeys: ['c1', 'c2'], at: 300,
});
for (const [mode, postScore01, at] of [
  ['replay-on', .95, 301],
  ['replay-on', .05, 302],
  ['replay-off', .50, 303],
  ['replay-on', .75, 304],
  ['replay-off', .50, 305],
]) {
  const pairKey = at <= 303 ? 'pair-1' : 'pair-2';
  const contextKey = at <= 303 ? 'c1' : 'c2';
  duplicateFabric.recordReplayExperimentTrial({
    experimentId: 'exp-duplicate-pair', taskId: 'task-target', mode,
    preScore01: .5, postScore01, independentVerified: true, randomized: true,
    contextKey, pairKey, at,
  });
}
const duplicateSummary = duplicateFabric.replayExperimentSummary('exp-duplicate-pair', 'task-target');
const duplicateGate = duplicateFabric.replayExperimentProtocolCheck('exp-duplicate-pair', 'task-target');
assert.equal(duplicateSummary.duplicatePairCells, 1);
assert.equal(duplicateSummary.matchedPairs, 1,
  'ambiguous duplicate pair must be excluded instead of selecting the last result');
assert.equal(duplicateGate.duplicatePairCells, 1);
assert.equal(duplicateGate.eligibleForConfirmatoryInference, false);


// A caller's own independentVerified/holdout booleans are claims, not proof.
// First prove that these claims alone do not create transfer evidence.
const u = new UnifiedLearningSubstrate();
const unauthenticated = u.recordTransferProbe({
  id: 'claimed-only', sourceTaskId: 'source', targetTaskId: 'target',
  baseline01: .5, postScore01: .9, independentVerified: true, holdout: true,
  contextKey: 'untrusted-context', at: 99,
});
assert.equal(unauthenticated?.independentVerified, false,
  'caller-supplied verification flags must not be treated as an independent receipt');
assert.equal(u.transferInferenceGate({
  sourceTaskId: 'source', targetTaskId: 'target', minHoldout: 2, minDistinctContexts: 2,
}).eligibleForConfirmatoryInference, false,
'untrusted self-assertions must not satisfy the independent transfer gate');

// Build process-local trusted receipts bound to each exact measurement tuple.
const verifier = new OutcomeVerificationService();
for (const [i, score] of [[0, .68], [1, .72], [2, .70], [3, .75]]) {
  const id = `tp-${i}`;
  const sourceTaskId = 'source';
  const targetTaskId = 'target';
  const contextKey = `ctx-${i}`;
  const at = 100 + i;
  const input = {
    id, sourceTaskId, targetTaskId, baseline01: .5, postScore01: score,
    holdout: true, contextKey, at,
  };
  const verification = await verifier.verify({
    toolId: 'independent-holdout-evaluator',
    input,
    result: { observedScore01: score },
  }, async () => ({
    verified: true,
    basis: 'external-postcondition',
    confidence01: 1,
    externalObservation: true,
    observationId: `holdout-observation-${i}`,
    expectedPostcondition: `score=${score}`,
    observedPostcondition: `score=${score}`,
  }));
  const accepted = u.recordTransferProbe({
    ...input,
    independentVerified: true,
    verification,
  });
  assert.equal(accepted?.independentVerified, true,
    'only the trusted verification receipt bound to this exact probe should earn holdout credit');
}
const tg = u.transferInferenceGate({
  sourceTaskId: 'source', targetTaskId: 'target', minHoldout: 4, minDistinctContexts: 4,
});
assert.equal(tg.eligibleForConfirmatoryInference, true);
assert.equal(tg.holdoutSamples, 4);
assert.equal(tg.distinctContexts, 4);
const matrix = u.transferMatrix();
assert.equal(matrix.length, 1);
assert.equal(matrix[0].positive, 4);
console.log('BIG_PASS_105_EXPERIMENTAL_PROTOCOL=PASS', JSON.stringify({
  protocolDefined: gate.protocolDefined,
  matchedPairs: gate.matchedPairs,
  conditionDifference: Number((f.replayExperimentSummary('exp105', 'task-target').estimatedConditionDifference01 ?? 0).toFixed(3)),
  transferHoldout: tg.holdoutSamples,
  transferMean: Number(tg.meanDelta01.toFixed(3)),
  selfAssertionsRejected: unauthenticated?.independentVerified === false,
}));
