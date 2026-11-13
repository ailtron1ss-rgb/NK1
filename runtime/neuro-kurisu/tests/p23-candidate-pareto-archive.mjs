import assert from 'node:assert/strict';
import * as learning from '../src/organism/learning/P23LearningEngine.ts';

// This is the public seam the feature must expose. The current single-candidate
// P23 lifecycle has no multi-objective archive, so this assertion must fail first.
assert.equal(
  typeof learning.P23CandidateParetoArchive,
  'function',
  'P23 must expose a deterministic validation-only candidate Pareto archive',
);

console.log('P23_CANDIDATE_PARETO_ARCHIVE=PASS');
