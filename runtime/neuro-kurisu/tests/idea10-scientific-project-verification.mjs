import assert from 'node:assert/strict';
import { ScientificMethodEngine } from '../src/organism/learning/ScientificMethodEngine.ts';

const contract = {
  protocol: 'paired-holdout-v1',
  minPairedSeeds: 5,
  baselineRequired: true,
  independentHoldoutRequired: true,
  maxVariantsPerRun: 1,
  rollbackRequired: true,
  autoApply: false,
};
const engine = new ScientificMethodEngine();
const project = engine.create(
  'Validate a cross-domain mechanism transfer',
  'The transfer improves the declared target metric without safety regression.',
  'One isolated mechanism variant, paired against baseline',
  ['mechanism-serendipity', 'mechanism:discovery-17'],
  contract,
);
assert.deepEqual(project.verificationContract, contract,
  'ScientificMethodEngine.create must preserve the mechanism verification contract');
const restored = new ScientificMethodEngine();
restored.restore(engine.snapshot());
assert.deepEqual(restored.snapshot().projects[0].verificationContract, contract,
  'the verification contract must survive durable scientific project snapshot/restore');

const callerOwned = { ...contract };
const safeProject = engine.create('Safe protocol copy', 'Hypothesis', 'Prediction', ['mechanism'], callerOwned);
callerOwned.autoApply = true;
assert.equal(safeProject.verificationContract.autoApply, false,
  'the project must own a validated copy, not caller-mutable verification settings');
const unsafeProject = engine.create('Unsafe protocol rejected', 'Hypothesis', 'Prediction', ['mechanism'], { ...contract, autoApply: true });
assert.equal(unsafeProject.verificationContract, undefined,
  'an auto-apply or weakened verification contract must never be persisted');


const gatedEngine = new ScientificMethodEngine();
const gatedProject = gatedEngine.create(
  'Causal transfer must pass paired holdout',
  'A mechanism transfer improves held-out outcomes.',
  'One isolated mechanism variant',
  ['mechanism-serendipity'],
  contract,
);
const initialGated = gatedEngine.snapshot().projects.find(row => row.id === gatedProject.id);
assert.ok(initialGated);
const initialGatedConfidence = initialGated.hypotheses[0].confidence;
gatedEngine.observe(gatedProject.id, {
  evidence: 'verified flag without paired receipt',
  success: 1,
  verified: true,
});
let gatedAfter = gatedEngine.snapshot().projects.find(row => row.id === gatedProject.id);
assert.ok(gatedAfter);
assert.equal(gatedAfter.evidence.length, 0,
  'verified=true alone must not bypass a mechanism holdout contract');
assert.equal(gatedAfter.hypotheses[0].confidence, initialGatedConfidence);

const pair = (seedId, baselineEvidenceId, variantEvidenceId, baselineScore, variantScore) => ({
  seedId, baselineEvidenceId, variantEvidenceId, baselineScore, variantScore,
});
const validReceipt = {
  protocol: 'paired-holdout-v1',
  runId: 'run-idea10-001',
  evidenceId: 'receipt-idea10-001',
  pairedRuns: [
    pair('train-1', 'base-1', 'variant-1', .4, .41),
    pair('train-2', 'base-2', 'variant-2', .4, .41),
    pair('train-3', 'base-3', 'variant-3', .4, .41),
    pair('train-4', 'base-4', 'variant-4', .4, .41),
    pair('train-5', 'base-5', 'variant-5', .4, .41),
  ],
  holdoutRuns: [
    pair('holdout-1', 'holdout-base-1', 'holdout-variant-1', .4, .42),
  ],
  independentHoldout: true,
  variantCount: 1,
  rollbackAvailable: true,
  autoApplied: false,
  safetyRegression: false,
};
gatedEngine.observe(gatedProject.id, {
  evidence: validReceipt.evidenceId,
  success: .6,
  verified: true,
  verificationReceipt: validReceipt,
});
gatedAfter = gatedEngine.snapshot().projects.find(row => row.id === gatedProject.id);
assert.ok(gatedAfter);
assert.equal(gatedAfter.evidence.length, 1,
  'five unique paired seeds plus a disjoint independent holdout may enter the verified evidence ledger');
assert.ok(gatedAfter.hypotheses[0].confidence > initialGatedConfidence);

const replayConfidence = gatedAfter.hypotheses[0].confidence;
gatedEngine.observe(gatedProject.id, {
  evidence: validReceipt.evidenceId,
  success: 0,
  verified: true,
  verificationReceipt: validReceipt,
});
gatedAfter = gatedEngine.snapshot().projects.find(row => row.id === gatedProject.id);
assert.ok(gatedAfter);
assert.equal(gatedAfter.hypotheses[0].confidence, replayConfidence,
  'the same paired-holdout receipt must remain idempotent');

const badReceipt = {
  ...validReceipt,
  evidenceId: 'receipt-idea10-invalid-overlap',
  holdoutRuns: [pair('train-1', 'holdout-base', 'holdout-variant', .4, .42)],
};
gatedEngine.observe(gatedProject.id, {
  evidence: badReceipt.evidenceId,
  success: .6,
  verified: true,
  verificationReceipt: badReceipt,
});
gatedAfter = gatedEngine.snapshot().projects.find(row => row.id === gatedProject.id);
assert.ok(gatedAfter);
assert.equal(gatedAfter.evidence.length, 1,
  'holdout seeds overlapping training seeds must be rejected');

const autoAppliedReceipt = { ...validReceipt, evidenceId: 'receipt-auto-apply', autoApplied: true };
gatedEngine.observe(gatedProject.id, {
  evidence: autoAppliedReceipt.evidenceId,
  success: .6,
  verified: true,
  verificationReceipt: autoAppliedReceipt,
});
const safetyRegressionReceipt = { ...validReceipt, evidenceId: 'receipt-safety-regression', safetyRegression: true };
gatedEngine.observe(gatedProject.id, {
  evidence: safetyRegressionReceipt.evidenceId,
  success: .6,
  verified: true,
  verificationReceipt: safetyRegressionReceipt,
});
gatedEngine.observe(gatedProject.id, {
  evidence: 'receipt-mismatched-success',
  success: 1,
  verified: true,
  verificationReceipt: { ...validReceipt, evidenceId: 'receipt-mismatched-success' },
});
gatedAfter = gatedEngine.snapshot().projects.find(row => row.id === gatedProject.id);
assert.ok(gatedAfter);
assert.equal(gatedAfter.evidence.length, 1,
  'auto-applied, safety-regressing or score-mismatched receipts must not enter scientific evidence');

const tamperedSnapshot = gatedEngine.snapshot();
tamperedSnapshot.projects.find(row => row.id === gatedProject.id).verificationContract.autoApply = true;
const hardenedRestore = new ScientificMethodEngine();
hardenedRestore.restore(tamperedSnapshot);
assert.equal(hardenedRestore.snapshot().projects.find(row => row.id === gatedProject.id).verificationContract, undefined,
  'restore must discard a persisted verification contract if its safety requirements were weakened');


console.log('IDEA10_SCIENTIFIC_PROJECT_VERIFICATION=PASS');
