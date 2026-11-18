import assert from 'node:assert/strict';
import { createDevelopmentalMultiverseSessionFromP55, DevelopmentalMultiverse, variantsFromP55Forks } from '../src/organism/developmental/DevelopmentalMultiverse.ts';

const baselineProfile = { exploration: 0.5, verification: 0.5, reflection: 0.5, attention: 0.5, prediction: 0.5 };
const scenarioMatrix = (prefix, scenarioCount, firstSeed, seedCount) => Array.from({ length: scenarioCount }, (_, scenario) => Array.from({ length: seedCount }, (_, offset) => ({ id: `${prefix}-${scenario + 1}`, seed: firstSeed + offset }))).flat();
const input = {
  runId: 'dm19-contract-test',
  createdAt: 1_800_000_000_000,
  sourceRevision: 'a'.repeat(40),
  environmentFingerprint: 'b'.repeat(64),
  baselineProfile,
  validationScenarios: scenarioMatrix('validation', 2, 101, 3),
  holdoutScenarios: scenarioMatrix('holdout', 2, 201, 5),
  privateUserData: { conversation: 'must-not-be-copied' },
  variants: [
    { id: 'verification-plus', label: 'verification plus', deltas: { verification: 0.08 } },
    { id: 'exploration-heavy', label: 'exploration heavy', deltas: { exploration: 0.1 } },
  ],
};
const seedConcentration = new DevelopmentalMultiverse();
assert.throws(() => seedConcentration.createSession({
  ...input,
  runId: 'dm19-repeated-holdout-seed',
  holdoutScenarios: scenarioMatrix('holdout-repeated', 5, 301, 1).map(item => ({ ...item, seed: 999 })),
}), /holdout-seed-diversity-invalid/,
'five scenario IDs must not be mistaken for five independent holdout seeds');

assert.throws(() => new DevelopmentalMultiverse().createSession({
  ...input,
  runId: 'dm19-incomplete-seed-matrix',
  validationScenarios: [
    { id: 'validation-1', seed: 101 },
    { id: 'validation-2', seed: 101 },
    { id: 'validation-1', seed: 102 },
    { id: 'validation-2', seed: 103 },
  ],
}), /validation-scenario-seed-matrix-incomplete/,
'P23 paired-seed statistics require every validation scenario on every validation seed');
assert.throws(() => new DevelopmentalMultiverse().createSession({
  ...input,
  runId: 'dm19-overlapping-phase-seeds',
  holdoutScenarios: scenarioMatrix('holdout', 2, 101, 5),
}), /holdout-seeds-overlap-validation/,
'holdout must use seed values disjoint from validation');

let sessionGetterCalls = 0;
const accessorSession = { ...input };
Object.defineProperty(accessorSession, 'runId', {
  enumerable: true,
  get() { sessionGetterCalls += 1; return 'getter-must-not-run'; },
});
assert.throws(() => new DevelopmentalMultiverse().createSession(accessorSession), /session-data-invalid/,
  'session accessors must be rejected before untrusted values are read');
assert.equal(sessionGetterCalls, 0, 'session snapshotting must not execute getters');

let restoreGetterCalls = 0;
const accessorRestore = {};
Object.defineProperty(accessorRestore, 'version', {
  enumerable: true,
  get() { restoreGetterCalls += 1; return 1; },
});
assert.throws(() => new DevelopmentalMultiverse().restore(accessorRestore), /snapshot-data-invalid/,
  'restore accessors must be rejected before state validation');
assert.equal(restoreGetterCalls, 0, 'restore validation must not execute getters');

const baselineMetrics = { quality01: 0.7, cost01: 0.5, safety01: 0.95, stability01: 0.82 };
const validationMetrics = {
  baseline: baselineMetrics,
  'verification-plus': { quality01: 0.78, cost01: 0.52, safety01: 0.96, stability01: 0.85 },
  'exploration-heavy': { quality01: 0.75, cost01: 0.72, safety01: 0.92, stability01: 0.79 },
};

const universe = new DevelopmentalMultiverse();
const created = universe.createSession(input);
assert.equal(created.runId, input.runId);
assert.equal(created.variantCount, 3, 'baseline must be included as a control arm');
assert.equal('privateUserData' in universe.snapshot().session, false, 'untrusted extra state must be dropped');

const validationPlan = universe.validationWorkPlan();
assert.equal(validationPlan.length, 3 * input.validationScenarios.length);
for (const scenario of input.validationScenarios) {
  const paired = validationPlan.filter(item => item.scenarioId === scenario.id && item.seed === scenario.seed);
  assert.deepEqual(new Set(paired.map(item => item.variantId)), new Set(['baseline', 'verification-plus', 'exploration-heavy']));
  assert.equal(new Set(paired.map(item => item.pairFingerprint)).size, 1, 'all arms must share identical scenario conditions');
  assert.equal(new Set(paired.map(item => item.initialStateFingerprint)).size, 1, 'all arms must start from the same baseline state');
}
assert.ok(validationPlan.every(item => !('memory' in item) && !('identity' in item) && !('conversation' in item)), 'work plan must contain only the whitelisted policy state');
assert.throws(() => universe.selectValidationFinalist(), /validation-incomplete/);
assert.throws(() => universe.holdoutWorkPlan(), /no-holdout-finalist/);

for (const item of validationPlan) {
  const metrics = validationMetrics[item.variantId];
  universe.recordValidationObservation({ ...item, measurementId: `val:${item.variantId}:${item.scenarioId}:${item.seed}`, metrics, safetyViolationCount: 0 });
}
assert.throws(() => universe.recordValidationObservation({ ...validationPlan[0], measurementId: `val:baseline:validation-1:101`, metrics: baselineMetrics, safetyViolationCount: 0 }), /measurement-id-duplicate/);
const selection = universe.selectValidationFinalist();
assert.equal(selection.selectedVariantId, 'verification-plus', 'selection must use matched validation pairs and hard safety constraints');
assert.equal(selection.comparisons[0].pairedN, 3,
  'validation pairedN must count three independent seed clusters');
assert.equal(selection.comparisons[0].matchedScenarioSeedPairs, 6,
  'validation must also report all six matched scenario × seed cells');
assert.equal(universe.snapshot().status, 'holding-out');

const holdoutPlan = universe.holdoutWorkPlan();
assert.equal(holdoutPlan.length, 2 * input.holdoutScenarios.length, 'only baseline and the validation finalist may see holdout scenarios');
assert.ok(holdoutPlan.every(item => ['baseline', 'verification-plus'].includes(item.variantId)));
assert.ok(!holdoutPlan.some(item => item.variantId === 'exploration-heavy'), 'non-finalists must not see holdout data');
assert.throws(() => universe.recordHoldoutObservation({ ...holdoutPlan[0], measurementId: 'bad-env', environmentFingerprint: 'c'.repeat(64), metrics: baselineMetrics, safetyViolationCount: 0 }), /binding-mismatch/);

for (const item of holdoutPlan) {
  const metrics = item.variantId === 'baseline'
    ? { quality01: 0.68, cost01: 0.5, safety01: 0.95, stability01: 0.82 }
    : { quality01: 0.75, cost01: 0.52, safety01: 0.95, stability01: 0.84 };
  universe.recordHoldoutObservation({ ...item, measurementId: `hold:${item.variantId}:${item.scenarioId}:${item.seed}`, metrics, safetyViolationCount: 0 });
}
const result = universe.finalize();
assert.equal(result.status, 'eligible-for-independent-review');
assert.equal(result.selectedVariantId, 'verification-plus');
assert.equal(result.comparison.pairedN, 5, 'confidence interval N must count independent seeds, not scenario-seed rows');
assert.equal(result.comparison.matchedScenarioSeedPairs, 10, 'all 10 paired scenario-seed cells must be reported separately');
assert.equal(result.evidence.holdoutPairCount, 10,
  'final evidence must report matched scenario × seed cells, not only seed clusters');
assert.equal(result.evidence.holdoutSeedCount, 5,
  'final evidence must report the actual number of independent holdout seeds');
assert.ok(result.comparison.utilityDelta01 > 0);
assert.ok(result.comparison.utilityCi95[0] > 0, 'holdout lower confidence bound must be positive');
assert.equal(result.automaticPromotion, false, 'the multiverse must never mutate live policy by itself');
assert.equal(result.requiresIndependentVerification, true);

const saved = universe.snapshot();
const restored = new DevelopmentalMultiverse();
restored.restore(saved);
assert.deepEqual(restored.finalize(), result, 'restored evidence must reproduce the same decision');
assert.throws(() => restored.recordHoldoutObservation({ ...holdoutPlan[0], measurementId: 'duplicate', metrics: baselineMetrics, safetyViolationCount: 0 }), /session-not-accepting-holdout/);

const maliciousRestore = structuredClone(saved);
maliciousRestore.holdoutObservations[0].metrics.quality01 = 7;
assert.throws(() => new DevelopmentalMultiverse().restore(maliciousRestore), /out-of-range/);
const alteredFingerprint = structuredClone(saved);
alteredFingerprint.initialStateFingerprint = 'f'.repeat(64);
assert.throws(() => new DevelopmentalMultiverse().restore(alteredFingerprint), /initial-state-mismatch/);
const partial = new DevelopmentalMultiverse();
partial.createSession({ ...input, runId: 'dm19-resume-test' });
for (const item of partial.validationWorkPlan()) {
  const metrics = validationMetrics[item.variantId];
  partial.recordValidationObservation({ ...item, measurementId: `resume:val:${item.variantId}:${item.scenarioId}:${item.seed}`, metrics, safetyViolationCount: 0 });
}
partial.selectValidationFinalist();
const partialHoldoutItem = partial.holdoutWorkPlan()[0];
partial.recordHoldoutObservation({ ...partialHoldoutItem, measurementId: 'resume:hold:one', metrics: baselineMetrics, safetyViolationCount: 0 });
const resumed = new DevelopmentalMultiverse();
resumed.restore(partial.snapshot());
assert.equal(resumed.snapshot().status, 'holding-out', 'in-progress holdout must survive restart without changing its selected candidate');
assert.equal(resumed.snapshot().holdoutObservations.length, 1);

const p55 = variantsFromP55Forks([
  { id: 'p55:2:balanced:abc', style: 'balanced', status: 'candidate', deltas: { exploration: 0.03, verification: 0.03, reflection: 0.03, attention: 0, prediction: 0.03 } },
  { id: 'p55:2:radical:def', style: 'radical', status: 'rejected', deltas: { exploration: 0.12, verification: -0.04, reflection: 0.08, attention: -0.06, prediction: 0.09 } },
]);
assert.equal(p55.length, 1, 'rejected/replaced P55 forks cannot enter the multiverse');
assert.equal(p55[0].id, 'p55:2:balanced:abc');

const snapshotSession = createDevelopmentalMultiverseSessionFromP55(
  { ...input, runId: 'dm19-real-p55-snapshot' },
  {
    version: 2,
    generations: 2,
    simulated: 2,
    promoted: 0,
    rejected: 1,
    replaced: 0,
    unresolvedForks: 1,
    meanDevelopmentalValue01: 0.6,
    branchDiversity01: 0.5,
    futureCoverage01: 0.3,
    lastWinnerId: null,
    lastAppliedForkId: null,
    appliedCount: 0,
    calibration01: 0.5,
    actionBiases: { explore: 0.018 },
    forks: [
      { id: 'p55:snapshot:balanced', style: 'balanced', status: 'candidate', deltas: { exploration: 0.03, verification: 0.03, reflection: 0.03, attention: 0, prediction: 0.03 } },
      { id: 'p55:snapshot:rejected', style: 'radical', status: 'rejected', deltas: { exploration: 0.12, verification: -0.04, reflection: 0.08, attention: -0.06, prediction: 0.09 } },
    ],
  },
);
assert.deepEqual(snapshotSession.variants.map(item => item.id), ['p55:snapshot:balanced'],
  'the public P55 snapshot adapter must admit only active fork candidates');
assert.equal('actionBiases' in snapshotSession, false,
  'P55 action bias/runtime state must not be copied into the developmental experiment');

const blocked = new DevelopmentalMultiverse();
blocked.createSession({ ...input, runId: 'dm19-safety-test', variants: [{ id: 'unsafe', label: 'unsafe', deltas: { verification: 0.08 } }] });
for (const item of blocked.validationWorkPlan()) {
  const metrics = item.variantId === 'baseline' ? baselineMetrics : { quality01: 0.9, cost01: 0.4, safety01: 0.7, stability01: 0.9 };
  blocked.recordValidationObservation({ ...item, measurementId: `safety:${item.variantId}:${item.scenarioId}:${item.seed}`, metrics, safetyViolationCount: item.variantId === 'baseline' ? 0 : 1 });
}
assert.equal(blocked.selectValidationFinalist().selectedVariantId, null, 'safety regressions must block finalist selection');
assert.equal(blocked.snapshot().status, 'rejected');

console.log('DEVELOPMENTAL_MULTIVERSE=PASS matched-arms=3 validation-seeds=3 holdout-seeds=5 cluster-bootstrap=PASS safety-gate=PASS auto-promotion=DISABLED');
