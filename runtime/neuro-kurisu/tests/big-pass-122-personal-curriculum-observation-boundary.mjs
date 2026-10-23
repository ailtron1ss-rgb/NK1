import assert from 'node:assert/strict';
import { PersonalCurriculumEngine } from '../src/organism/learning/PersonalCurriculumEngine.ts';

const goal = {
  id: 'observation-boundary-goal',
  title: 'Learn from verified feedback',
  reason: 'Exercise the personal curriculum input gate',
  source: 'intrinsic',
  status: 'active',
  importance: 0.8,
  urgency: 0.6,
  confidence: 0.7,
  progress: 0.2,
  createdAt: 1,
  updatedAt: 1,
};
const engine = new PersonalCurriculumEngine();
engine.beginCycle();
const before = engine.snapshot();

assert.throws(() => engine.observeOutcome({
  goal, outcome01: 2, verified: true, contextKey: 'invalid-outcome',
  causal01: 0.7, social01: 0.7, identity01: 0.7, retention01: 0.7, transfer01: 0.7,
}), /personal-curriculum-outcome-score-invalid/);
assert.deepEqual(engine.snapshot(), before, 'invalid outcome must not mutate curriculum state');

assert.throws(() => engine.observeDevelopmentalContext({
  action: 'reflect', source: 'mixed', contextKey: 'invalid-context',
  pressure01: 0.7, identity01: 0.7, social01: 0.7, causal01: 0.7,
  evidence01: 2, unresolved01: 0.2,
}), /personal-curriculum-developmental-context-score-invalid/);
assert.deepEqual(engine.snapshot(), before, 'invalid developmental context must not mutate curriculum state');

assert.throws(() => engine.observeOutcome({
  goal, outcome01: 0.8, verified: true, contextKey: 'invalid-time',
  causal01: 0.7, social01: 0.7, identity01: 0.7, retention01: 0.7, transfer01: 0.7, at: -1,
}), /personal-curriculum-outcome-invalid/);
assert.deepEqual(engine.snapshot(), before, 'invalid timestamps must not mutate curriculum state');

console.log('BIG_PASS_122_CURRICULUM_OBSERVATION_BOUNDARY=PASS');
