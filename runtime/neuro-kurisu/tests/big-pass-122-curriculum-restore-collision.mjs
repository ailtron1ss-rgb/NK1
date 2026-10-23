import assert from 'node:assert/strict';
import { PersonalCurriculumEngine } from '../src/organism/learning/PersonalCurriculumEngine.ts';

const goal = {
  id: 'restore-collision-goal',
  title: 'Preserve consistent learning history',
  reason: 'Exercise persisted curriculum identity reconciliation',
  source: 'intrinsic',
  status: 'active',
  importance: 0.8,
  urgency: 0.6,
  confidence: 0.7,
  progress: 0.2,
  createdAt: 1,
  updatedAt: 1,
};
const source = new PersonalCurriculumEngine();
source.observeOutcome({
  goal, outcome01: 0.8, verified: true, contextKey: 'context-a',
  causal01: 0.7, social01: 0.4, identity01: 0.8, retention01: 0.7, transfer01: 0.5, at: 1000,
});
const validState = source.snapshot();
assert.equal(validState.threads.length, 1);

const duplicateId = structuredClone(validState);
duplicateId.threads = [
  { ...validState.threads[0], title: 'conflicting row A' },
  { ...validState.threads[0], title: 'conflicting row B', priority01: 0.99 },
];
const restoredId = new PersonalCurriculumEngine();
restoredId.restore(duplicateId);
assert.equal(restoredId.snapshot().threads.length, 0,
  'conflicting rows sharing an ID must all be quarantined, independent of array order');

const duplicateFamily = structuredClone(validState);
duplicateFamily.threads = [
  { ...validState.threads[0], id: 'curriculum-row-a' },
  { ...validState.threads[0], id: 'curriculum-row-b', priority01: 0.99 },
];
const restoredFamily = new PersonalCurriculumEngine();
restoredFamily.restore(duplicateFamily);
assert.equal(restoredFamily.snapshot().threads.length, 0,
  'conflicting rows sharing a family must all be quarantined, independent of array order');

console.log('BIG_PASS_122_CURRICULUM_RESTORE_COLLISION=PASS');
