import assert from 'node:assert/strict';
import {
  rerankSemanticCandidates,
} from '../src/organism/developmental/MemorySemanticReranker.ts';

const candidate = (id, baseScore, metadata = {}, similarity = baseScore) => ({
  item: {
    id,
    salience: .1,
    emotionalWeight: .05,
    identityRelevance: .05,
    goalRelevance: .05,
    socialRelevance: .05,
    predictionError: .05,
    confidence: .6,
    ...metadata,
  },
  score: baseScore,
  similarity,
  lexicalRank: 0,
});

const neutral = candidate('neutral-semantic', .91, {
  salience: .12, emotionalWeight: .05, identityRelevance: .08,
  goalRelevance: .08, socialRelevance: .05, predictionError: .08, confidence: .72,
});
const affective = candidate('affectively-salient', .905, {
  salience: .86, emotionalWeight: .99, identityRelevance: .12,
  goalRelevance: .1, socialRelevance: .22, predictionError: .8, confidence: .9,
});
const identity = candidate('identity-relevant', .904, {
  salience: .12, emotionalWeight: .05, identityRelevance: .99,
  goalRelevance: .08, socialRelevance: .05, predictionError: .08, confidence: .72,
});
const goal = candidate('goal-relevant', .903, {
  salience: .12, emotionalWeight: .05, identityRelevance: .08,
  goalRelevance: .99, socialRelevance: .05, predictionError: .08, confidence: .72,
});

const affectRanked = rerankSemanticCandidates([neutral, affective, identity, goal], {
  limit: 1, goalRelevance: 0, identityRelevance: 0,
});
assert.equal(affectRanked[0].item.id, 'affectively-salient',
  'affective salience may reorder close semantic candidates');

const identityCold = rerankSemanticCandidates([neutral, identity], {
  limit: 1, goalRelevance: 0, identityRelevance: 0,
});
const identityHot = rerankSemanticCandidates([neutral, identity], {
  limit: 1, goalRelevance: 0, identityRelevance: 1,
});
assert.equal(identityCold[0].item.id, 'neutral-semantic',
  'identity metadata must remain a modest baseline when the query has no identity demand');
assert.equal(identityHot[0].item.id, 'identity-relevant',
  'identity demand should promote identity-relevant memories within the semantic candidate pool');

const goalCold = rerankSemanticCandidates([neutral, goal], {
  limit: 1, goalRelevance: 0, identityRelevance: 0,
});
const goalHot = rerankSemanticCandidates([neutral, goal], {
  limit: 1, goalRelevance: 1, identityRelevance: 0,
});
assert.equal(goalCold[0].item.id, 'neutral-semantic');
assert.equal(goalHot[0].item.id, 'goal-relevant',
  'active goal relevance should promote matching episodic evidence');

const unrelatedHighSalience = candidate('unrelated-high-salience', .2, {
  salience: 1, emotionalWeight: 1, identityRelevance: 1,
  goalRelevance: 1, socialRelevance: 1, predictionError: 1, confidence: 1,
});
const strongSemantic = candidate('strong-semantic', .96);
const weakSemantic = candidate('weak-semantic', .55, {
  salience: 1, emotionalWeight: 1, identityRelevance: 1,
  goalRelevance: 1, socialRelevance: 1, predictionError: 1, confidence: 1,
});
const protectedRanked = rerankSemanticCandidates([
  unrelatedHighSalience, weakSemantic, strongSemantic,
], { limit: 1, goalRelevance: 1, identityRelevance: 1 });
assert.equal(protectedRanked[0].item.id, 'strong-semantic',
  'metadata must not override a materially stronger semantic match');

const distant = Array.from({ length: 8 }, (_, index) =>
  candidate(`distant-${index}`, .25 - index * .01, {
    salience: 1, emotionalWeight: 1, identityRelevance: 1, goalRelevance: 1,
  }));
const poolGuard = rerankSemanticCandidates([
  strongSemantic, neutral, affective, identity, ...distant,
], { limit: 1, goalRelevance: 1, identityRelevance: 1 });
assert.ok(!poolGuard.some((row) => row.item.id.startsWith('distant-')),
  'affective re-ranking must happen only after semantic preselection');

const malformed = rerankSemanticCandidates([
  candidate('malformed-context', .8, {
    salience: Number.NaN, emotionalWeight: Number.POSITIVE_INFINITY,
    identityRelevance: '1', goalRelevance: -20, confidence: Number.NaN,
  }),
], { limit: 1, goalRelevance: Number.NaN, identityRelevance: Number.POSITIVE_INFINITY });
assert.equal(malformed.length, 1);
assert.ok(Number.isFinite(malformed[0].score) && malformed[0].score >= 0 && malformed[0].score <= 1);

const deterministicA = rerankSemanticCandidates([neutral, affective, identity, goal], {
  limit: 4, goalRelevance: .4, identityRelevance: .7,
}).map((row) => row.item.id);
const deterministicB = rerankSemanticCandidates([neutral, affective, identity, goal], {
  limit: 4, goalRelevance: .4, identityRelevance: .7,
}).map((row) => row.item.id);
assert.deepEqual(deterministicA, deterministicB);

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'memory-semantic-affect-reranking',
  affectiveWinner: affectRanked[0].item.id,
  identityWinnerWithDemand: identityHot[0].item.id,
  goalWinnerWithDemand: goalHot[0].item.id,
  semanticGuard: protectedRanked[0].item.id,
  poolGuarded: true,
}));
