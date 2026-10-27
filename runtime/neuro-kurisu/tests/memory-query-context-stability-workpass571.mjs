import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2({ embeddingProvider: null });
const encode = (id) => memory.encode({
  id,
  content: 'violet compass migration stable factual note',
  kind: 'semantic',
  source: 'workpass571-context-fixture',
  tags: [],
  context: {},
  salience: .5,
  emotionalWeight: .1,
  identityRelevance: .1,
  goalRelevance: .1,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
});
encode('stable-fact');
encode('stable-decoy');

const lastContextKey = () => memory.snapshot().adaptiveMemoryPolicy.lastContextKey;

// A long series of ordinary retrievals must not manufacture a temporal signal
// from semanticQueries. The old fallback drifted after enough ordinary calls.
for (let index = 0; index < 80; index++) {
  memory.retrieve('violet compass migration', 1);
}
assert.equal(
  lastContextKey(),
  '0:0:0:0:m',
  'history volume must not turn a general retrieval into a temporal context',
);

memory.retrieve('When did the violet compass migration happen last time?', 1);
assert.equal(
  lastContextKey(),
  '0:0:0:3:m',
  'explicit episodic/time language should select temporal context',
);

memory.retrieve('Why did the violet compass migration fail?', 1);
assert.equal(
  lastContextKey(),
  '0:0:3:0:m',
  'causal language should select causal context without inheriting temporal history',
);

console.log('MEMORY_QUERY_CONTEXT_STABILITY_WORKPASS571=PASS', JSON.stringify({
  generalQueries: 80,
  semanticQueries: memory.snapshot().semanticQueries,
  finalContextKey: lastContextKey(),
}));
