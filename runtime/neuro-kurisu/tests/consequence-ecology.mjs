import assert from 'node:assert/strict';
import { FutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';

const simulator = new FutureSimulator();

assert.equal(
  typeof simulator.analyzeConsequences,
  'function',
  'FutureSimulator must expose the Consequence Ecology analysis seam',
);
assert.ok(
  simulator.snapshot().consequenceEcology,
  'Consequence Ecology state must live in the canonical FutureSimulator snapshot',
);

console.log('CONSEQUENCE_ECOLOGY_RUNTIME_SEAM=PASS');
