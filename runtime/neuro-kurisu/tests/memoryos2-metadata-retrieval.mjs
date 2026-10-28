import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const memory = new MemoryOS2({ embeddingProvider: null });
const encode = (id, content, extras = {}) => memory.encode({
  id,
  content,
  kind: 'semantic',
  source: 'metadata-retrieval-regression',
  tags: [],
  context: {},
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 10_000,
  observedAt: now - 1000,
  provenanceClass: 'external',
  sourceAuthority01: 0.9,
  ...extras,
});

encode('m-orchid', 'A short note about reorganizing a bookshelf on Sunday.', {
  tags: ['botany', 'indoor-garden'],
  context: { topic: 'orchid watering schedule', category: 'plant-care' },
  entities: ['Phalaenopsis'],
});
encode('m-budget', 'A note about reviewing a purchase order next month.', {
  tags: ['finance', 'quarterly-review'],
  context: { topic: 'quarterly budget planning', category: 'finance' },
  entities: ['Acme Accounts'],
});
encode('m-direct', 'Instructions for resetting a laptop after a system update.', {
  tags: ['computing'],
  context: { topic: 'device maintenance', category: 'technology' },
  entities: ['Laptop'],
});

const topicHits = memory.retrieve('orchid watering schedule', 3);
assert.equal(topicHits[0]?.m?.id ?? topicHits[0]?.id, 'm-orchid',
  'topic metadata should make a differently-worded memory discoverable');
assert.ok(topicHits.some(row => (row.m?.id ?? row.id) === 'm-orchid'));

const entityHits = memory.retrieve('Phalaenopsis', 3);
assert.equal(entityHits[0]?.m?.id ?? entityHits[0]?.id, 'm-orchid',
  'entity metadata should provide a candidate even when entity terms are absent from content');

const directHits = memory.retrieve('resetting a laptop system update', 3);
assert.equal(directHits[0]?.m?.id ?? directHits[0]?.id, 'm-direct',
  'direct content/BM25 matches must remain stronger than unrelated metadata hits');

const snapshot = memory.snapshot();
assert.equal(snapshot.items.length, 3, 'metadata retrieval must be read-only');
console.log('MEMORYOS2_METADATA_RETRIEVAL=PASS', JSON.stringify({
  topicTop1: topicHits[0]?.m?.id ?? topicHits[0]?.id,
  entityTop1: entityHits[0]?.m?.id ?? entityHits[0]?.id,
  directContentTop1: directHits[0]?.m?.id ?? directHits[0]?.id,
  liveItems: snapshot.items.length,
}));
