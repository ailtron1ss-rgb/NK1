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

console.log('IDEA10_SCIENTIFIC_PROJECT_VERIFICATION=PASS');
