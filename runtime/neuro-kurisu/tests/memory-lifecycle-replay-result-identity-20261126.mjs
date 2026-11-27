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



// Restart the owner with both canonical MemoryOS2 data and its persisted
// lifecycle receipt ledger. The replay must still return the exact original
// historical result, while current-revision and retrieval views remain current.
const persisted = runtime.snapshot();
const recovered = new MemorySubsystemRuntime();
recovered.restoreFromPersisted({
  advanced: {
    memoryOS: persisted.memoryOS,
    memoryFabric: persisted.fabric,
  },
});

const recoveredChain = recovered.memoryOS.temporalChain(seed.id);
assert.equal(recoveredChain.length, 2, 'restart must preserve the full revision chain');
assert.equal(recoveredChain[0]?.id, seed.id, 'the original revision must survive restore');
assert.equal(recoveredChain[1]?.id, revision.id, 'the corrected revision must survive restore');
assert.equal(recovered.memoryOS.snapshotItem(seed.id)?.content, input.content, 'historical snapshot lookup must retain original bytes');
assert.equal(recovered.memoryOS.snapshotCurrentRevisionItem(seed.id)?.id, revision.id, 'canonical current lookup must still resolve the active revision');

const recoveredStatsBeforeReplay = recovered.fabric.snapshot().stats;
const replayAfterRestart = recovered.fabric.encode(input, {
  commandId: 'replay-identity:encode',
  tick: 4,
});
assert.equal(
  replayAfterRestart?.id,
  seed.id,
  'after restart, replay must return the original encode result instead of the current revision tip',
);
assert.deepEqual(
  recovered.fabric.snapshot().stats,
  recoveredStatsBeforeReplay,
  'post-restart replay must not mutate canonical memory statistics',
);
assert.equal(
  recovered.memoryOS.temporalChain(seed.id).length,
  2,
  'post-restart replay must not create or collapse revisions',
);
assert.equal(
  recovered.memoryOS.snapshotCurrentRevisionItem(seed.id)?.id,
  revision.id,
  'post-restart replay must not roll the current memory view back to the historical result',
);

const historicalRead = recovered.memoryOS.snapshotItem(seed.id);
const currentRead = recovered.memoryOS.snapshotCurrentRevisionItem(seed.id);
assert.equal(historicalRead?.id, seed.id);
assert.equal(currentRead?.id, revision.id);

console.log('MEMORY_LIFECYCLE_REPLAY_RESULT_IDENTITY=PASS');
