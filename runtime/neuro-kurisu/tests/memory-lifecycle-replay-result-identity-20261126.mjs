import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

const runtime = new MemorySubsystemRuntime();
const input = {
  content: 'Replay of an encode command must retain the original result identity after revision.',
  kind: 'episodic',
  source: 'memory-replay-result-identity',
  tags: ['replay-identity'],
  context: { phase: 'initial' },
  salience: .72,
  emotionalWeight: .12,
  identityRelevance: .2,
  goalRelevance: .3,
  socialRelevance: .05,
  predictionError: .2,
  confidence: .8,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
};
const seed = runtime.fabric.encode(input, { commandId: 'replay-identity:encode', tick: 1 });
assert.ok(seed?.id);

const revision = runtime.fabric.reviseContent(seed.id, 'A later revision must not change the original encode receipt identity.', {
  reason: 'replay-identity-revision',
  source: 'memory-replay-result-identity',
}, { commandId: 'replay-identity:revise', tick: 2 });
assert.ok(revision?.id);
assert.notEqual(revision.id, seed.id, 'fixture must create a distinct temporal revision');
assert.equal(runtime.memoryOS.temporalChain(seed.id).length, 2);

const beforeStats = runtime.fabric.snapshot().stats;
const replay = runtime.fabric.encode(input, { commandId: 'replay-identity:encode', tick: 3 });
assert.equal(
  replay?.id,
  seed.id,
  'replaying an old encode command must return the original result revision, not the current revision tip',
);
assert.deepEqual(runtime.fabric.snapshot().stats, beforeStats, 'idempotent replay must not increment canonical mutation counters');
assert.equal(runtime.memoryOS.temporalChain(seed.id).length, 2, 'replay must not create a new revision');

console.log('MEMORY_LIFECYCLE_REPLAY_RESULT_IDENTITY=PASS');
