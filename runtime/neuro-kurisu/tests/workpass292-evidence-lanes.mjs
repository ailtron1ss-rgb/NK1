import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { UnifiedLearningSubstrate } from '../src/organism/learning/UnifiedLearningSubstrate.ts';

const state = (tick, overrides = {}) => ({
  version: 1,
  tick,
  at: tick * 1000,
  needs: {
    energy: 0.72,
    cognitiveLoad: 0.2,
    uncertainty: 0.58,
    socialNeed: 0.3,
    novelty: 0.42,
    identityCoherence: 0.82,
    goalPressure: 0.48,
  },
  predictionError: 0.54,
  attentionBudget: 0.76,
  lastAction: 'explore',
  lastActionSuccess: null,
  autonomyScore: 0.4,
  selfPredictionError: 0.3,
  predictedNextAction: 'verify',
  lastPredictionConfidence: 0.55,
  worldContextVersion: 1,
  ...overrides,
});

const before = state(7);
const after = state(8, {
  needs: { ...before.needs, uncertainty: 0.22, energy: 0.75, novelty: 0.7 },
  lastAction: 'explore',
  lastActionSuccess: 0.96,
  predictionError: 0.31,
});
const trace = {
  id: 'trace-wp292-1',
  tick: 7,
  createdAt: 7000,
  candidates: [],
  selected: { id: 'candidate-1', goalId: 'goal-1', action: 'explore' },
  stateBefore: before,
  reasoningSignals: {},
};

const experiences = new CausalExperienceStream();
const grounded = experiences.recordOutcome(trace, after, {
  reward01: 0.94,
  success01: 0.96,
  surprise01: 0.91,
  novelty01: 0.82,
});
assert.ok(grounded, 'a state-grounded runtime transition should be recorded');
assert.equal(grounded.provenance, 'runtime-outcome');
assert.equal(grounded.stateGrounded, true);
assert.equal(grounded.replayEligible, true);
assert.equal(experiences.recordOutcome(trace, { ...after, lastAction: 'verify' }, {
  reward01: 0.94, success01: 0.96, surprise01: 0.91, novelty01: 0.82,
}), null, 'a state transition attributed to another action cannot earn this trace credit');
assert.equal(experiences.recordOutcome(trace, { ...after, lastActionSuccess: 0.5 }, {
  reward01: 0.94, success01: 0.96, surprise01: 0.91, novelty01: 0.82,
}), null, 'a contradictory post-action success signal must not earn learning credit');
assert.equal(experiences.recordOutcome(trace, { ...after, lastActionSuccess: null }, {
  reward01: 0.94, success01: 0.96, surprise01: 0.91, novelty01: 0.82,
}), null, 'missing action outcome must not be inferred from unrelated state drift');

const external = experiences.recordExternalLearningEvent({
  tick: 8,
  taskId: 'imported-skill',
  action: 'explore',
  reward01: 1,
  success01: 1,
  surprise01: 1,
  novelty01: 1,
  causalStrength01: 1,
  provenance: 'skill-repair',
  stateGrounded: true,
  traceId: 'external-claim-wp292',
});
assert.equal(external.provenance, 'external', 'caller-provided provenance cannot authenticate an event');
assert.equal(external.stateGrounded, false, 'caller-provided grounding cannot authenticate an event');

const packet = experiences.learningPacket(32);
assert.equal(packet.records.length, 1, 'only the grounded runtime outcome should enter the unified learning packet');
assert.equal(packet.records[0].traceId, trace.id);
assert.equal(packet.meanReward01, grounded.reward01, 'external reward claims must not inflate packet statistics');
assert.equal(experiences.consolidate(32).length, 1, 'grounded runtime outcome remains eligible for consolidation');
assert.equal(experiences.prioritizedReplayCandidates(32).length, 1, 'grounded runtime outcome remains eligible for replay');

const forgedPersistedExperience = experiences.snapshot();
forgedPersistedExperience.records = [{ ...grounded, provenance: 'runtime-outcome', stateGrounded: false }];
const restoredExperienceStream = new CausalExperienceStream();
restoredExperienceStream.restore(forgedPersistedExperience);
assert.equal(restoredExperienceStream.recent(4)[0].provenance, 'external', 'restore must downgrade a runtime label without grounded-state evidence');
assert.equal(restoredExperienceStream.learningPacket(4).records.length, 0, 'forged persisted runtime label must not enter the learning packet');

const organismCoreSource = readFileSync(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
assert.match(organismCoreSource, /unifiedLearningExternalHypotheses\(limit = 32\)/, 'core runtime must expose the read-only hypothesis queue');
assert.match(organismCoreSource, /independent:\s*independentSources\s*>=\s*2/, 'causal learning independent flag must require independent source support');
assert.match(organismCoreSource, /independent:\s*verifiedNow\s*&&\s*independentSources\s*>=\s*2/, 'macro synthesis must use the same independent evidence gate');
assert.doesNotMatch(organismCoreSource, /independent:\s*Boolean\(outcome\.worldTransition\?\.after\)\s*\|\|\s*projectEvidenceExternal/, 'generic external evidence must not self-certify independent evidence');

const learning = new UnifiedLearningSubstrate();
const trustedUpdate = learning.ingest(trace, after, grounded, packet);
assert.ok(trustedUpdate.learningOpportunity01 >= 0);
assert.equal(learning.snapshot().patterns.length, 1, 'trace-bound grounded outcome may update a learning pattern');

const externalOnly = new CausalExperienceStream();
const spoofed = externalOnly.recordExternalLearningEvent({
  tick: 7,
  taskId: 'spoof-task',
  action: 'explore',
  reward01: 1,
  success01: 1,
  surprise01: 1,
  novelty01: 1,
  causalStrength01: 1,
  provenance: 'experience-replay',
  stateGrounded: true,
  traceId: trace.id,
});
const quarantinedLearning = new UnifiedLearningSubstrate();
quarantinedLearning.ingest(trace, after, spoofed, externalOnly.learningPacket());
assert.equal(quarantinedLearning.snapshot().patterns.length, 0, 'external claims must not update the trusted behavior pattern bank');

const externalState = new UnifiedLearningSubstrate();
const beforeState = externalState.snapshot();
const externalResult = externalState.ingestExternalSignal({
  taskId: 'externally-reported',
  action: 'explore',
  reward01: 0.99,
  success01: 0.99,
  surprise01: 0.99,
  novelty01: 0.99,
  causalStrength01: 0.99,
  provenance: 'skill-repair',
});
const afterState = externalState.snapshot();
assert.equal(externalResult.acceptedAs, 'unverified-hypothesis');
assert.equal(externalResult.coreLearningUpdated, false);
assert.equal(afterState.provenanceCounts.external, beforeState.provenanceCounts.external + 1);
assert.equal(afterState.provenanceCounts.skillRepair, beforeState.provenanceCounts.skillRepair, 'caller cannot self-assert trusted repair provenance');
assert.equal(afterState.samples, beforeState.samples, 'external hypotheses do not increment trusted learning sample count');
assert.equal(afterState.patterns.length, beforeState.patterns.length, 'external hypotheses do not mutate the trusted pattern bank');
assert.equal(afterState.externalHypotheses.length, 1, 'external hypothesis is retained separately for later adjudication');

const restored = new UnifiedLearningSubstrate();
restored.restore({
  version: 4,
  externalHypotheses: [{
    id: 'bad-hypothesis',
    taskId: 'spoofed',
    action: 'explore',
    reward01: 1,
    success01: 1,
    surprise01: 1,
    novelty01: 1,
    causalStrength01: 1,
    transferPotential01: 1,
    claimedProvenance: 'forged',
    receivedAt: Date.now(),
  }],
});
assert.equal(restored.snapshot().externalHypotheses.length, 0, 'invalid persisted hypotheses are rejected during restore');
const legacyLearning = new UnifiedLearningSubstrate();
legacyLearning.restore({
  version: 3,
  cycles: 12,
  samples: 99,
  updates: 99,
  sharedRepresentation01: new Array(16).fill(0.99),
  patterns: [{ id: 'legacy-ulp-ext', key: 'spoof|explore', samples: 44, taskId: 'spoof', dominantAction: 'explore', meanReward01: 1, meanPredictionError01: 0, meanCausalStrength01: 1, meanNovelty01: 1, transferPotential01: 1, confidence01: 1, firstAt: 1, lastAt: 2 }],
  provenanceCounts: { runtime: 5, experienceReplay: 10, skillRepair: 10, external: 0 },
});
assert.equal(legacyLearning.snapshot().cycles, 12, 'cycle continuity may survive learning-schema migration');
assert.equal(legacyLearning.snapshot().samples, 0, 'untraceable legacy samples must not survive the trust-boundary migration');
assert.equal(legacyLearning.snapshot().patterns.length, 0, 'patterns contaminated by unverified legacy claims must not survive migration');
assert.deepEqual(legacyLearning.snapshot().sharedRepresentation01, new Array(16).fill(0.5), 'representation trained on unverified legacy claims must be reset');
assert.deepEqual(legacyLearning.snapshot().provenanceCounts, { runtime: 0, experienceReplay: 0, skillRepair: 0, external: 0 }, 'unverifiable legacy provenance counters must be reset');

console.log(JSON.stringify({
  ok: true,
  groundedPacketRecords: packet.records.length,
  trustedPatterns: learning.snapshot().patterns.length,
  quarantinedExternalEvents: 2,
  retainedHypotheses: afterState.externalHypotheses.length,
}));
