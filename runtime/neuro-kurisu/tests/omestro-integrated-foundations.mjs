import assert from 'node:assert/strict';
import {
  OMESTRO_CONCEPTS, getOmeStroImplementationSummary, validateOmeStroConceptRegistry,
} from '../src/organism/system/OmeStroConceptRegistry.ts';
import {
  compileOmeStroIntent, ChronoTruthLedger, NegativeSpaceLedger, OpenLoopRadar,
  prepareUndoFirstPlan, assessConsequenceEcology, assessSubstrateMigration,
} from '../src/organism/system/OmeStroCognitiveGovernance.ts';
import {
  validateDevelopmentalGenome, buildWorldForgeManifest, adjudicateCognitiveParliament,
  advanceInventionLoop, assessNeuroForgeIntake, rankMechanismAnalogies,
  createSharedFuture, createDyadicTaskLink, validateSynapticCommonsArtifact,
  compareDevelopmentalForks,
} from '../src/organism/system/OmeStroDevelopmentProtocol.ts';
import {
  validateNeuralAdapterCandidate, AdaptiveSynapticMatrix, EphemeralPlasticitySession,
  compileCognitiveNeuralControl, createSparsePlasticityMask, compileNeuralJitSkillCapsule,
  evaluateNeuralAdaptationPromotion,
} from '../src/organism/system/OmeStroNeuralAdaptation.ts';

const registry = validateOmeStroConceptRegistry();
assert.equal(registry.valid, true, registry.errors.join(','));
assert.equal(OMESTRO_CONCEPTS.length, 32);
assert.deepEqual(getOmeStroImplementationSummary().counts, {
  existing_partial: 5, foundation_added: 18, research_gated: 9,
});

const incompleteIntent = compileOmeStroIntent({ goal: 'Build a report' });
assert.equal(incompleteIntent.status, 'needs-clarification');
assert.ok(incompleteIntent.missing.includes('acceptanceCriteria'));
const completeIntent = compileOmeStroIntent({
  goal: 'Build an evidence report', outputs: ['report.md'], constraints: ['No private data'],
  acceptanceCriteria: ['All claims have source refs'], allowedActions: ['read-files'],
  forbiddenActions: ['send-email'], stopConditions: ['Missing source provenance'],
  irreversibleActions: ['publish-release'],
});
assert.equal(completeIntent.status, 'ready');
assert.equal(completeIntent.requiresHumanApproval, true);
assert.ok(completeIntent.forbiddenActions.includes('send-email'));

const dyadicDenied = createDyadicTaskLink({
  taskId: 'task-1', humanPrincipal: 'human', organismPrincipal: 'organism',
  scopes: ['shared-task'], userConsent: false,
});
assert.equal(dyadicDenied.accepted, false);
const dyadic = createDyadicTaskLink({
  taskId: 'task-1', humanPrincipal: 'human', organismPrincipal: 'organism',
  scopes: ['shared-task', 'milestones'], userConsent: true,
});
assert.equal(dyadic.accepted, true);
assert.equal(dyadic.link.sharedMemoryPolicy, 'task-context-only');
assert.equal(createDyadicTaskLink({
  taskId: 'task-2', humanPrincipal: 'human', organismPrincipal: 'organism',
  scopes: ['shared-task'], userConsent: true, sharePrivateEpisodes: true,
}).accepted, false);

const truth = new ChronoTruthLedger();
assert.equal(truth.append({
  id: 'fact-1', key: 'preferred-format', value: 'markdown', sourceRef: 'user-explicit:1',
  confidence01: 1, validFrom: 100, recordedAt: 100, sensitivity: 'low-risk', consented: true,
}).accepted, true);
assert.equal(truth.query('preferred-format', 150, 100).value, 'markdown');
assert.equal(truth.query('preferred-format', 150, 99), null, 'knowledge must not travel backward in transaction time');
assert.equal(truth.append({
  id: 'fact-sensitive', key: 'secret', value: 'private', sourceRef: 'observation:2',
  confidence01: 1, validFrom: 101, recordedAt: 101, sensitivity: 'sensitive', consented: true,
}).accepted, false);
assert.equal(truth.append({
  id: 'fact-2', key: 'preferred-format', value: 'plain-text', kind: 'correct',
  sourceRef: 'user-explicit:3', confidence01: 1, validFrom: 120, recordedAt: 200,
  supersedesId: 'fact-1', sensitivity: 'low-risk', consented: true,
}).accepted, true);
assert.equal(truth.query('preferred-format', 110, 200).value, 'markdown',
  'a correction must preserve the previous value before its valid-time boundary');
assert.equal(truth.query('preferred-format', 150, 199).value, 'markdown',
  'a fact correction must not be visible before it was recorded');
assert.equal(truth.query('preferred-format', 150, 200).value, 'plain-text');
assert.equal(truth.append({
  id: 'fact-3', key: 'preferred-format', kind: 'retract', sourceRef: 'user-explicit:4',
  confidence01: 1, validFrom: 180, recordedAt: 300, supersedesId: 'fact-2',
  sensitivity: 'low-risk', consented: true,
}).accepted, true);
assert.equal(truth.query('preferred-format', 170, 300).value, 'plain-text');
assert.equal(truth.query('preferred-format', 180, 300), null);
assert.equal(truth.history('preferred-format', 300).length, 3);

const negative = new NegativeSpaceLedger();
assert.equal(negative.record({
  id: 'alt-1', option: 'Use provider A', reason: 'Fails reliability threshold',
  confidence01: .8, rejectedAt: 100, reopenAt: null, reopenWhenEvidenceRefs: ['new-benchmark:1'],
}).accepted, true);
assert.equal(negative.reopen('alt-1', 'unrelated:evidence', 101).reopened, false);
assert.equal(negative.reopen('alt-1', 'new-benchmark:1', 102).reopened, true);

const radar = new OpenLoopRadar();
assert.equal(radar.upsert({
  id: 'loop-1', summary: 'Recheck release parity', owner: 'release-engineering',
  createdAt: 10, dueAt: 20, reviewAt: 20, expiresAt: 40,
  dependencyIds: [], closeCondition: 'Artifact parity report accepted',
}).accepted, true);
assert.equal(radar.due(20).length, 1);
assert.equal(radar.markExpired(40), 1);
assert.equal(radar.snapshot()[0].status, 'stale');

const blockedUndo = prepareUndoFirstPlan({
  id: 'plan-1', sourceBranch: 'aspect/omestro', steps: [
    { id: 'write', action: 'write-file', idempotencyKey: 'write:1', reversible: true, compensation: null },
    { id: 'publish', action: 'publish', idempotencyKey: 'publish:1', reversible: false, compensation: null },
  ],
});
assert.equal(blockedUndo.readyToExecute, false);
assert.ok(blockedUndo.blockers.includes('irreversible-approval-required'));
assert.ok(blockedUndo.blockers.some(code => code.startsWith('missing-compensation:')));
const undo = prepareUndoFirstPlan({
  id: 'plan-2', sourceBranch: 'aspect/omestro', snapshotRef: 'snapshot:1', approveIrreversible: true, steps: [
    { id: 'write', action: 'write-file', idempotencyKey: 'write:2', reversible: true, compensation: 'restore-snapshot' },
    { id: 'notify', action: 'notify', idempotencyKey: 'notify:2', reversible: true, compensation: 'send-correction' },
  ],
});
assert.equal(undo.readyToExecute, true);
assert.deepEqual(undo.rollbackOrder.map(step => step.stepId), ['notify', 'write']);

const ecology = assessConsequenceEcology([
  { id: 'root', stakeholder: 'team', description: 'Deploy', delayMs: 0, probability01: .5, impact01: .8, evidenceRef: 'e1' },
  { id: 'next', stakeholder: 'users', description: 'Latency rise', delayMs: 60000, probability01: .5, impact01: 1, evidenceRef: 'e2' },
], [{ from: 'root', to: 'next', confidence01: .8 }], ['root']);
assert.equal(ecology.paths.length, 2);
assert.ok(Math.abs(ecology.paths[1].expectedExposure01 - .2) < 1e-9);
assert.ok(ecology.totalExpectedExposure01 > 0);

const migration = assessSubstrateMigration({
  sourceFingerprint: 'model:old', targetFingerprint: 'model:new',
  stateSchemaCompatible: true, stateRoundTripPassed: true, benchmarkPairedSeeds: 5,
  qualityDelta01: .01, maximumAllowedRegression01: .02, rollbackAvailable: true,
  calibrationEvidenceRef: 'benchmark:paired-5',
});
assert.equal(migration.eligible, true);
assert.equal(assessSubstrateMigration({
  sourceFingerprint: 'model:old', targetFingerprint: 'model:new',
  stateSchemaCompatible: true, stateRoundTripPassed: false, benchmarkPairedSeeds: 2,
  qualityDelta01: -.2, maximumAllowedRegression01: .02, rollbackAvailable: false,
  calibrationEvidenceRef: '',
}).mode, 'base-fallback');

const baseGenome = {
  version: 1, modules: [{ id: 'core', dependsOn: [], contractRef: 'contract:core' }],
  invariants: ['safety-gate', 'provenance'],
};
const genomeCandidate = {
  candidateId: 'genome-2', branchRef: 'aspect/omestro-genome',
  baseVersion: 1, targetVersion: 2,
  modules: [
    { id: 'core', dependsOn: [], contractRef: 'contract:core-v2' },
    { id: 'chrono', dependsOn: ['core'], contractRef: 'contract:chrono' },
  ],
  invariants: ['safety-gate', 'provenance'], migrationRef: 'migration:1-2',
  testRefs: ['test:genome'], rollbackRef: 'rollback:genome-2',
};
const genome = validateDevelopmentalGenome(baseGenome, genomeCandidate);
assert.equal(genome.eligible, true, genome.blockers.join(','));
assert.deepEqual(genome.topologicalOrder, ['core', 'chrono']);
assert.equal(validateDevelopmentalGenome(baseGenome, {
  ...genomeCandidate, branchRef: 'main', invariants: ['safety-gate'],
}).eligible, false);

const worldForge = buildWorldForgeManifest([
  { taskId: 't1', taskFingerprint: 'fp-train', split: 'train', seed: 1, environmentFingerprint: 'env-1', perturbationId: 'p0' },
  { taskId: 't2', taskFingerprint: 'fp-valid', split: 'validation', seed: 2, environmentFingerprint: 'env-1', perturbationId: 'p1' },
  { taskId: 't3', taskFingerprint: 'fp-holdout', split: 'holdout', seed: 3, environmentFingerprint: 'env-1', perturbationId: 'p2' },
]);
assert.equal(worldForge.accepted, true);
assert.equal(worldForge.manifest.holdoutLocked, true);
assert.equal(buildWorldForgeManifest([
  { taskId: 't1', taskFingerprint: 'shared-fp', split: 'train', seed: 1, environmentFingerprint: 'env', perturbationId: 'p0' },
  { taskId: 't2', taskFingerprint: 'shared-fp', split: 'holdout', seed: 2, environmentFingerprint: 'env', perturbationId: 'p0' },
  { taskId: 't3', taskFingerprint: 'fp-valid', split: 'validation', seed: 3, environmentFingerprint: 'env', perturbationId: 'p0' },
]).accepted, false);

const reviews = [
  { role: 'discoverer', actorId: 'discoverer', position: 'accept', evidenceRefs: ['discovery:1'] },
  { role: 'theorist', actorId: 'theorist', position: 'accept', evidenceRefs: ['theory:1'] },
  { role: 'experimentalist', actorId: 'experimenter', position: 'accept', evidenceRefs: ['experiment:1'] },
  { role: 'replicator', actorId: 'replicator', independentOf: 'author', position: 'accept', evidenceRefs: ['replication:1'] },
  { role: 'skeptic', actorId: 'skeptic', position: 'accept', evidenceRefs: ['review:1'] },
  { role: 'auditor', actorId: 'auditor', position: 'accept', evidenceRefs: ['audit:1'] },
  { role: 'safety', actorId: 'safety', position: 'accept', evidenceRefs: ['safety:1'] },
];
assert.equal(adjudicateCognitiveParliament({
  candidateAuthorId: 'author', reviews, holdoutPassed: true, replicationPassed: true,
  safetyPassed: true, auditPassed: true,
}).status, 'promotable');
assert.equal(adjudicateCognitiveParliament({
  candidateAuthorId: 'author', reviews: reviews.map(review =>
    review.role === 'replicator' ? { ...review, actorId: 'author' } : review),
  holdoutPassed: true, replicationPassed: true, safetyPassed: true, auditPassed: true,
}).status, 'needs-evidence');

for (const [stage, evidence] of [
  ['idea', { hypothesisRef: 'hypothesis:1' }],
  ['hypothesis', { prototypeRef: 'prototype:1' }],
  ['prototype', { protocolRef: 'protocol:1', holdoutFingerprint: 'holdout:1' }],
  ['preregistered', { validationPassed: true }],
  ['validation', { holdoutPassed: true }],
  ['holdout', { replicatorId: 'independent-replicator', replicationPassed: true }],
  ['replicated', { safetyPassed: true, baselineScore01: .6, candidateScore01: .72, effectThreshold01: .05 }],
]) {
  const result = advanceInventionLoop({ stage, authorId: 'author', ...evidence });
  assert.equal(result.accepted, true, stage + ':' + result.blockers.join(','));
}
assert.equal(advanceInventionLoop({
  stage: 'replicated', authorId: 'author', safetyPassed: true,
  baselineScore01: .6, candidateScore01: .61, effectThreshold01: .1,
}).accepted, false);

assert.equal(assessNeuroForgeIntake({
  sourceId: 'source-1', sourceFingerprint: 'sha256:source', license: 'MIT',
  sbomFingerprint: 'sha256:sbom', architectureMapRef: 'map:1',
  sandboxEvidenceRef: 'sandbox:1', testsPassed: true,
}).eligible, true);
assert.equal(assessNeuroForgeIntake({
  sourceId: 'source-2', sourceFingerprint: 'sha256:source2', license: 'GPL-3.0',
  sbomFingerprint: 'sha256:sbom2', architectureMapRef: 'map:2',
  sandboxEvidenceRef: 'sandbox:2', testsPassed: true,
}).eligible, false);

const analogies = rankMechanismAnalogies({
  mechanisms: ['feedback-loop', 'sparse-routing'], flows: ['queue'], constraints: ['latency'],
}, [
  { id: 'weak', domain: 'weak', mechanisms: ['batch'], flows: ['stream'], constraints: ['cost'] },
  { id: 'strong', domain: 'strong', mechanisms: ['feedback-loop'], flows: ['queue'], constraints: ['latency'] },
]);
assert.equal(analogies[0].id, 'strong');
assert.equal(analogies[0].hypothesisOnly, true);

assert.equal(createSharedFuture({
  id: 'future-1', assumptions: ['resource budget remains stable'], revisitTriggers: ['budget falls'],
  scenarios: [
    { id: 'normal', probability01: .7, dependencyIds: [] },
    { id: 'degraded', probability01: .3, dependencyIds: ['normal'], pointOfNoReturn: true },
  ],
}).valid, true);

assert.equal(validateSynapticCommonsArtifact({
  artifactId: 'skill-1', artifactFingerprint: 'sha256:skill', artifactType: 'skill-contract',
  licenseRef: 'license:mit', contractRef: 'contract:1', testRef: 'tests:1',
  sandboxPassed: true, containsPersonalEpisodes: false, containsCredentials: false,
}).shareable, true);
assert.equal(validateSynapticCommonsArtifact({
  artifactId: 'skill-2', artifactFingerprint: 'sha256:skill2', artifactType: 'skill-contract',
  licenseRef: 'license:mit', contractRef: 'contract:2', testRef: 'tests:2',
  sandboxPassed: true, containsPersonalEpisodes: true, containsCredentials: false,
}).shareable, false);

const forks = compareDevelopmentalForks({
  baselineEnvironmentFingerprint: 'env-1',
  forks: [
    { candidateId: 'fork-1', branchRef: 'aspect/fork-1', environmentFingerprint: 'env-1',
      independentEvaluation: true, safetyPassed: true, rollbackRef: 'rollback:1',
      quality01: .8, cost01: .3, reliability01: .9 },
    { candidateId: 'fork-2', branchRef: 'aspect/fork-2', environmentFingerprint: 'env-2',
      independentEvaluation: true, safetyPassed: true, rollbackRef: 'rollback:2',
      quality01: .9, cost01: .2, reliability01: .95 },
  ],
});
assert.deepEqual(forks.eligibleCandidates, ['fork-1']);
assert.equal(forks.rejected[0].blockers.includes('environment-mismatch'), true);

const adapterCandidate = {
  adapterId: 'adapter-summary-v1', adapterFingerprint: 'sha256:adapter',
  baseModelFingerprint: 'sha256:base-model', trainerId: 'trainer',
  capabilityIds: ['summarize'], rank: 4, trainableParameterFraction01: .02,
  maxResidualNorm01: .05, expiresAt: 10_000,
  evaluation: {
    evaluatorId: 'independent-evaluator', independent: true,
    trainDatasetFingerprint: 'sha256:train', validationDatasetFingerprint: 'sha256:validation',
    holdoutDatasetFingerprint: 'sha256:holdout', pairedSeeds: 5,
    baseScore01: .7, adapterScore01: .76, maxTaskRegression01: .01,
    safetyPassed: true, ablationPassed: true, holdoutUntouched: true, evidenceRef: 'evaluation:1',
  },
};
assert.equal(validateNeuralAdapterCandidate(adapterCandidate).eligible, true);
const matrix = new AdaptiveSynapticMatrix();
assert.equal(matrix.register(adapterCandidate, 100).accepted, true);
assert.equal(matrix.route({
  baseModelFingerprint: 'sha256:base-model', capabilityId: 'summarize', confidence01: .9, now: 101,
}).adapterId, 'adapter-summary-v1');
assert.equal(matrix.route({
  baseModelFingerprint: 'sha256:other-model', capabilityId: 'summarize', confidence01: .9, now: 101,
}).mode, 'base');
const contaminated = structuredClone(adapterCandidate);
contaminated.adapterId = 'adapter-leak';
contaminated.evaluation.holdoutDatasetFingerprint = contaminated.evaluation.trainDatasetFingerprint;
assert.equal(validateNeuralAdapterCandidate(contaminated).eligible, false);

const session = new EphemeralPlasticitySession({
  sessionId: 'session-1', now: 100, ttlMs: 1_000, dimension: 2, maxNorm01: .1,
});
const adapted = session.adapt({ delta: [.2, .2], now: 101 });
assert.equal(adapted.accepted, true);
assert.ok(adapted.norm01 <= .1000001);
assert.equal(session.snapshot(1_100).reset, true);
assert.equal(session.adapt({ delta: [.01, 0], now: 1_101 }).accepted, false);

const controls = compileCognitiveNeuralControl({
  arousal01: 1, goalUrgency01: 1, predictionError01: 1, uncertainty01: 1,
  novelty01: 1, socialRelevance01: 1, energy01: 1, attention01: 1,
});
assert.ok(controls.maxAbsControl <= .041);
assert.equal(controls.application, 'backend-opt-in-only');

const mask = createSparsePlasticityMask({
  availableParameterIds: Array.from({ length: 100 }, (_, index) => 'p' + index),
  allowedParameterIds: ['p1', 'p2', 'p3'], protectedParameterIds: ['p3'],
});
assert.equal(mask.accepted, true);
assert.deepEqual(mask.selectedParameterIds, ['p1', 'p2']);
assert.equal(createSparsePlasticityMask({
  availableParameterIds: ['critical'], allowedParameterIds: ['critical'],
  protectedParameterIds: ['critical'],
}).accepted, false);

const capsule = compileNeuralJitSkillCapsule({
  taskFingerprint: 'task:1', environmentFingerprint: 'env:1', sourceEvidenceRef: 'outcome:1',
  independentlyVerified: true, noPersonalData: true,
  steps: [{ operationId: 'open', inputSchemaRef: 'schema:in', outputSchemaRef: 'schema:out', evidenceRef: 'step:1' }],
});
assert.equal(capsule.accepted, true);
assert.equal(capsule.capsule.executableSourceIncluded, false);
assert.equal(compileNeuralJitSkillCapsule({
  taskFingerprint: 'task:2', environmentFingerprint: 'env:2', sourceEvidenceRef: 'outcome:2',
  independentlyVerified: false, noPersonalData: true,
  steps: [{ operationId: 'run', inputSchemaRef: 'in', outputSchemaRef: 'out', evidenceRef: 'step:2' }],
}).accepted, false);

assert.equal(evaluateNeuralAdaptationPromotion({
  independentHoldoutPassed: true, pairedSeeds: 5, ablationBenefit01: .03,
  latencyDelta01: .02, memoryDelta01: .01, safetyPassed: true,
  baseFallbackPassed: true, rollbackAvailable: true,
}).promotable, true);
assert.equal(evaluateNeuralAdaptationPromotion({
  independentHoldoutPassed: false, pairedSeeds: 2, ablationBenefit01: 0,
  latencyDelta01: .2, memoryDelta01: .2, safetyPassed: false,
  baseFallbackPassed: false, rollbackAvailable: false,
}).promotable, false);

console.log('OMESTRO_INTEGRATED_FOUNDATIONS=PASS');
console.log(JSON.stringify({
  concepts: OMESTRO_CONCEPTS.length,
  chronoTruthEvents: truth.snapshot().records.length,
  candidateGenomeModules: genome.topologicalOrder.length,
  adapterRoutes: matrix.snapshot().length,
  ephemeralUpdates: adapted.accepted ? 1 : 0,
}, null, 2));
