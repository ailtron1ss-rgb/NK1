import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { evaluateMemoryOS2ShadowPreview, previewNekoHybridMemoryRanking } from '../../../integrations/neko-memory-shadow/src/memoryos2-preview.mjs';

const memory = new MemoryOS2({ embeddingProvider: null });
const encode = (content, entities = []) => ({
  content,
  kind: 'episodic',
  source: 'user-observation',
  tags: [],
  context: {},
  salience: .8,
  emotionalWeight: .2,
  identityRelevance: .1,
  goalRelevance: .1,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities,
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
});

const astronomy = memory.encode(encode('I keep a telescope and enjoy astronomy observations', ['telescope', 'astronomy']));
memory.encode(encode('I prefer green tea in the evening', ['green tea']));

const before = JSON.stringify(memory.snapshot());
const preview = memory.previewRetrieveWithRankedChannels('astronomy telescope', 8, 0, 0, {}, 64);
assert.deepEqual(JSON.stringify(memory.snapshot()), before,
  'ranked-channel preview must not mutate canonical MemoryOS2 state');
assert.ok(preview.itemIds.includes(astronomy.id), 'baseline recall should include the directly grounded astronomy memory');
assert.ok(preview.rankedChannels.bm25.includes(astronomy.id), 'BM25 rank IDs should be exported');
assert.ok(preview.rankedChannels.coverage.includes(astronomy.id), 'coverage rank IDs should be exported');
assert.equal(preview.maxPerChannel, 64, 'preview must expose the cap used for its ranked ID lists');
assert.deepEqual(Object.keys(preview.rankedChannels).sort(),
  ['bm25', 'coverage', 'entity', 'fuzzy', 'metadata', 'relationship']);
assert.ok(!JSON.stringify(preview).includes('telescope'),
  'preview export must contain IDs and diagnostics, never memory text');

const shadow = evaluateMemoryOS2ShadowPreview(preview, {
  channelWeights: preview.currentRrfWeights,
  limit: 8,
});
assert.ok(shadow.shadowIds.includes(astronomy.id), 'shadow fusion must preserve the directly grounded candidate');
assert.equal(shadow.diagnostics.abstained, false);
assert.ok(shadow.overlapAtK >= 0 && shadow.overlapAtK <= 8);

const disabledVector = await previewNekoHybridMemoryRanking(memory, 'astronomy telescope', {
  includeSemanticEmbeddingChannel: true,
});
assert.equal(disabledVector.semantic.enabled, false, 'explicit preview must report disabled local embedding provider');
assert.equal(disabledVector.semanticIncludedInShadowFusion, false);
assert.equal(disabledVector.userFacingEligible, false);
assert.ok(disabledVector.shadowIds.includes(astronomy.id));
assert.deepEqual(JSON.stringify(memory.snapshot()), before,
  'optional shadow preview must not mutate canonical MemoryOS2 state');

const abstained = memory.previewRetrieveWithRankedChannels('quantum chromodynamics', 8, 0, 0, {}, 64);
assert.equal(abstained.diagnostics.abstained, true,
  'unsupported query must preserve MemoryOS2 answerability abstention');
assert.ok(Object.values(abstained.rankedChannels).every(ids => ids.length === 0),
  'ungrounded candidates must not leak into shadow rank channels');
assert.deepEqual(evaluateMemoryOS2ShadowPreview(abstained).shadowIds, [],
  'shadow RRF must not resurrect candidates rejected by the answerability gate');

assert.throws(() => memory.previewRetrieveWithRankedChannels('astronomy', 8, 0, 0, {}, 193),
  /preview-limit-invalid/);

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'neko-memoryos2-ranked-channel-preview',
  baselineCount: preview.itemIds.length,
  exportedChannels: Object.keys(preview.rankedChannels).length,
  shadowCount: shadow.shadowIds.length,
  answerabilityAbstentionPreserved: true,
  canonicalStateUnchanged: true,
}));
