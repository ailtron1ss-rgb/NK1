import assert from 'node:assert/strict';
import { ScientificMethodEngine } from '../src/organism/learning/ScientificMethodEngine.ts';

const engine = new ScientificMethodEngine();
const project = engine.create(
  'Does the observed action reduce uncertainty?',
  'A verified explore action reduces uncertainty in this context.',
  'explore',
  ['intrinsic-experiment', 'tick:7', 'experiment:exp-7-test'],
);
const initial = engine.snapshot().projects.find(row => row.id === project.id);
assert.ok(initial);
const initialConfidence = initial.hypotheses[0].confidence;
engine.observe(project.id, { evidence: 'claimed success with no independent outcome', success: 1, verified: false });
let after = engine.snapshot().projects.find(row => row.id === project.id);
assert.ok(after);
assert.equal(after.hypotheses[0].confidence, initialConfidence, 'unverified claims must not affect belief confidence');
assert.equal(after.evidence.length, 0, 'unverified claims must not enter evidence ledger');
assert.equal(after.status, 'open', 'unverified claims must not move project to testing');

for (let index = 0; index < 4; index++) {
  engine.observe(project.id, { evidence: `verified world transition ${index + 1}`, success: 1, verified: true });
}
after = engine.snapshot().projects.find(row => row.id === project.id);
assert.ok(after);
assert.equal(after.hypotheses[0].status, 'supported');
assert.equal(after.status, 'concluded');
assert.equal(engine.snapshot().completed, 1);
engine.observe(project.id, { evidence: 'duplicate late evidence', success: 1, verified: true });
assert.equal(engine.snapshot().completed, 1, 'concluded projects must not be counted repeatedly');
console.log('SCIENTIFIC_METHOD_VERIFICATION_GATE_WORKPASS595=PASS');
