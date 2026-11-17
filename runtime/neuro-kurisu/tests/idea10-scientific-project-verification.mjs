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
console.log('IDEA10_SCIENTIFIC_PROJECT_VERIFICATION=PASS');
