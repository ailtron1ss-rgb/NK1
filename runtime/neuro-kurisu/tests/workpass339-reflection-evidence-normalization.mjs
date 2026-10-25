import assert from 'node:assert/strict';
import { reflectOnOutcomes } from '../src/organism/learning/OutcomeReflectionCurriculum.ts';

const baseRows = Array.from({ length: 7 }, (_, i) => ({
  id: 'experience-' + i,
  contextKey: 'energy=low|uncertainty=high',
  action: 'explore',
  success: i === 0 ? 0.1 : 0.2,
  predictedUtility: 0.85,
  surprise: 0.9,
  tick: i + 1,
  at: 1000 + i,
}));
const duplicateDelivery = { ...baseRows[0] };
const conflictingDuplicate = { ...baseRows[1], success: 1, predictedUtility: 1, surprise: 0 };
const malformed = [
  { ...baseRows[2], success: Number.NaN },
  { ...baseRows[3], predictedUtility: Number.POSITIVE_INFINITY },
  { ...baseRows[4], surprise: -0.1 },
  { ...baseRows[5], tick: -1 },
  { ...baseRows[6], at: Number.NaN },
];

const hypotheses = reflectOnOutcomes([
  ...baseRows,
  duplicateDelivery,
  conflictingDuplicate,
  ...malformed,
]);
assert.equal(hypotheses.length, 1);
assert.equal(hypotheses[0].occurrences, 5,
  'exact redelivery must count once and conflicting-ID evidence must be excluded');
assert.equal(hypotheses[0].kind, 'repeated-context-failure');
assert.ok(!hypotheses[0].sourceExperienceIds.includes('experience-1'),
  'conflicting duplicate identity must be removed rather than choosing the first or last value');
assert.ok(!hypotheses[0].sourceExperienceIds.includes('experience-2'),
  'non-finite success is invalid evidence, not a zero-success label');
assert.ok(!hypotheses[0].sourceExperienceIds.includes('experience-3'),
  'infinite prediction is invalid evidence');
assert.ok(!hypotheses[0].sourceExperienceIds.includes('experience-4'),
  'out-of-range surprise is invalid evidence');
assert.ok(!hypotheses[0].sourceExperienceIds.includes('experience-5'),
  'negative cognitive tick is invalid evidence');
assert.ok(!hypotheses[0].sourceExperienceIds.includes('experience-6'),
  'invalid timestamp is invalid evidence');

const tied = [
  { id: 'z', contextKey: 'same', action: 'verify', success: 0, predictedUtility: 0.9, surprise: 0.9, tick: 7 },
  { id: 'b', contextKey: 'same', action: 'verify', success: 0, predictedUtility: 0.9, surprise: 0.9, tick: 7 },
  { id: 'm', contextKey: 'same', action: 'verify', success: 0, predictedUtility: 0.9, surprise: 0.9, tick: 7 },
  { id: 'a', contextKey: 'same', action: 'verify', success: 0, predictedUtility: 0.9, surprise: 0.9, tick: 7 },
];
const ordered = reflectOnOutcomes(tied)[0];
const permuted = reflectOnOutcomes([...tied].reverse())[0];
assert.deepEqual(ordered, permuted, 'equal-tick ordering must not depend on evidence arrival order');
assert.deepEqual(ordered.sourceExperienceIds, ['a', 'b', 'm', 'z']);

assert.deepEqual(reflectOnOutcomes(null), [], 'malformed non-array input must not produce a hypothesis');
console.log('WORKPASS339_REFLECTION_EVIDENCE_NORMALIZATION=PASS dedupe=true conflictingIdsBlocked=true invalidLabelsRejected=true deterministic=true');
