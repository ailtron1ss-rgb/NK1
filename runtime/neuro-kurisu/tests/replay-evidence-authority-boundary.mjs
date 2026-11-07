import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const fabric = new ExperienceContinuumFabric();

// A caller-controlled boolean must never establish independent verification.
const longitudinal = fabric.recordLongitudinalReplayTrial({
  experimentId: 'authority-boundary',
  taskId: 'memory-transfer',
  phase: 'holdout',
  mode: 'replay-on',
  contextKey: 'holdout-a',
  pairKey: 'pair-a',
  delayMs: 86_400_000,
  baselineScore01: 0.5,
  score01: 0.9,
  independentVerified: true,
  at: 10,
});
assert.equal(longitudinal.independentVerified, false,
  'longitudinal evidence must not trust independentVerified from a caller');

// The protocol metadata is not proof of randomization or balance.
fabric.createReplayExperimentProtocol({
  id: 'authority-boundary-protocol',
  taskId: 'memory-transfer',
  randomized: true,
  balanced: true,
  requiredPairs: 5,
  contextKeys: ['ctx-a', 'ctx-b', 'ctx-c', 'ctx-d', 'ctx-e'],
  at: 20,
});
for (let i = 0; i < 5; i++) {
  const pairKey = `pair-${i}`;
  const contextKey = `ctx-${i}`;
  fabric.recordReplayExperimentTrial({
    experimentId: 'authority-boundary-protocol',
    taskId: 'memory-transfer',
    mode: 'replay-on',
    preScore01: 0.5,
    postScore01: 0.8,
    independentVerified: true,
    randomized: true,
    contextKey,
    pairKey,
    at: 100 + i * 2,
  });
  fabric.recordReplayExperimentTrial({
    experimentId: 'authority-boundary-protocol',
    taskId: 'memory-transfer',
    mode: 'replay-off',
    preScore01: 0.5,
    postScore01: 0.7,
    independentVerified: true,
    randomized: true,
    contextKey,
    pairKey,
    at: 101 + i * 2,
  });
}
const protocolCheck = fabric.replayExperimentProtocolCheck(
  'authority-boundary-protocol',
  'memory-transfer',
);
assert.equal(protocolCheck.eligibleForConfirmatoryInference, false,
  'caller booleans must not make a replay experiment confirmatory');

// Memory-to-skill association is not an independently verified skill transfer.
const skillBinding = fabric.bindMemoryToSkill({
  memoryId: 'memory-1',
  skillId: 'skill-1',
  confidence01: 0.95,
  independentVerified: true,
  evidenceKey: 'caller-asserted',
  at: 30,
});
assert.equal(skillBinding.independentVerified, false,
  'memory-to-skill binding must require authenticated transfer evidence');

// The replay-validation path already has a process-local receipt gate. Keep that
// invariant explicit so the other entry points converge on the same authority.
const validation = fabric.recordReplayValidation({
  memoryId: 'memory-1',
  retentionScore01: 0.9,
  baselineScore01: 0.5,
  independentVerified: true,
  evidenceKey: 'caller-asserted-validation',
  at: 40,
});
assert.equal(validation.independentVerified, false,
  'a caller boolean must not bypass the existing verifier receipt boundary');

// Persisted verification bits and credit aggregates are claims, not authority.
const hostileSnapshot = fabric.snapshot();
hostileSnapshot.replay.longitudinal = [longitudinal];
hostileSnapshot.replay.experiments = hostileSnapshot.replay.experiments.map((row) => ({
  ...row,
  independentVerified: true,
  randomized: true,
}));
hostileSnapshot.replay.protocols = hostileSnapshot.replay.protocols.map((row) => ({
  ...row,
  randomized: true,
  balanced: true,
}));
hostileSnapshot.memorySkillBindings = [skillBinding];
hostileSnapshot.causalReplayCredit = {
  ...hostileSnapshot.causalReplayCredit,
  assignments: 99,
  verifiedAssignments: 99,
  meanCredit01: 0.99,
  recent: [{
    id: 'forged-credit',
    memoryId: 'memory-1',
    replayEventId: 'replay-1',
    validationId: 'validation-1',
    delayMs: 1000,
    delayAttenuation01: 1,
    cascadeShort01: 1,
    cascadeMedium01: 1,
    cascadeLong01: 1,
    temporalMatch01: 1,
    eligibility01: 1,
    outcome01: 1,
    credit01: 0.99,
    independentVerified: true,
    at: 50,
  }],
};

const restored = new ExperienceContinuumFabric();
restored.restore(hostileSnapshot);
assert.equal(
  restored.longitudinalReplaySummary('authority-boundary', 'memory-transfer').verifiedTrials,
  0,
  'restored legacy longitudinal rows must remain visible but not verified',
);
assert.equal(
  restored.replayExperimentProtocolCheck(
    'authority-boundary-protocol',
    'memory-transfer',
  ).eligibleForConfirmatoryInference,
  false,
  'restored protocol booleans and trial booleans must not authorize confirmatory inference',
);
assert.equal(
  restored.memorySkillEvidence('memory-1', 'skill-1')[0]?.independentVerified,
  false,
  'restored memory-to-skill bindings must not inherit boolean proof',
);
assert.equal(
  restored.summary().causalReplayCredit.verifiedAssignments,
  0,
  'serialized verified credit counters must be recomputed from authenticated evidence',
);
assert.equal(
  restored.summary().causalReplayCredit.meanCredit01,
  0,
  'serialized credit aggregates must not survive without authenticated assignments',
);

console.log('REPLAY_EVIDENCE_AUTHORITY_BOUNDARY=PASS');
