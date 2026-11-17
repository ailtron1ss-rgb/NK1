import assert from 'node:assert/strict';
import { DevelopmentalMultiverse, variantsFromP55Forks } from '../src/organism/developmental/DevelopmentalMultiverse.ts';

const baselineProfile = { exploration: 0.5, verification: 0.5, reflection: 0.5, attention: 0.5, prediction: 0.5 };
const scenarios = (prefix, firstSeed, count) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i + 1}`, seed: firstSeed + i }));
const input = {
  runId: 'dm19-contract-test',
  createdAt: 1_800_000_000_000,
  sourceRevision: 'a'.repeat(40),
  environmentFingerprint: 'b'.repeat(64),
  baselineProfile,
  validationScenarios: scenarios('validation', 101, 4),
  holdoutScenarios: scenarios('holdout', 201, 5),
  privateUserData: { conversation: 'must-not-be-copied' },
  variants: [
    { id: 'verification-plus', label: 'verification plus', deltas: { verification: 0.08 } },
    { id: 'exploration-heavy', label: 'exploration heavy', deltas: { exploration: 0.1 } },
  ],
};
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
  universe.recordValidationObservation({ ...item, measurementId: `val:${item.variantId}:${item.scenarioId}`, metrics, safetyViolationCount: 0 });
}
assert.throws(() => universe.recordValidationObservation({ ...validationPlan[0], measurementId: `val:baseline:validation-1`, metrics: baselineMetrics, safetyViolationCount: 0 }), /measurement-id-duplicate/);
const selection = universe.selectValidationFinalist();
assert.equal(selection.selectedVariantId, 'verification-plus', 'selection must use matched validation pairs and hard safety constraints');
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
  universe.recordHoldoutObservation({ ...item, measurementId: `hold:${item.variantId}:${item.scenarioId}`, metrics, safetyViolationCount: 0 });
}
const result = universe.finalize();
assert.equal(result.status, 'eligible-for-independent-review');
assert.equal(result.selectedVariantId, 'verification-plus');
assert.equal(result.comparison.pairedN, 5);
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
  partial.recordValidationObservation({ ...item, measurementId: `resume:val:${item.variantId}:${item.scenarioId}`, metrics, safetyViolationCount: 0 });
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

const blocked = new DevelopmentalMultiverse();
blocked.createSession({ ...input, runId: 'dm19-safety-test', variants: [{ id: 'unsafe', label: 'unsafe', deltas: { verification: 0.08 } }] });
for (const item of blocked.validationWorkPlan()) {
  const metrics = item.variantId === 'baseline' ? baselineMetrics : { quality01: 0.9, cost01: 0.4, safety01: 0.7, stability01: 0.9 };
  blocked.recordValidationObservation({ ...item, measurementId: `safety:${item.variantId}:${item.scenarioId}`, metrics, safetyViolationCount: item.variantId === 'baseline' ? 0 : 1 });
}
assert.equal(blocked.selectValidationFinalist().selectedVariantId, null, 'safety regressions must block finalist selection');
assert.equal(blocked.snapshot().status, 'rejected');

console.log('DEVELOPMENTAL_MULTIVERSE=PASS matched-arms=3 validation-pairs=4 holdout-pairs=5 safety-gate=PASS auto-promotion=DISABLED');
