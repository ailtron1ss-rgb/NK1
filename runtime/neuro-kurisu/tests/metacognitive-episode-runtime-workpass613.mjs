import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const directory = await mkdtemp(path.join(tmpdir(), 'nk-metacognitive-episode-'));
const stateFile = path.join(directory, 'state.json');
const worldStateFile = path.join(directory, 'world.json');
const options = { stateFile, worldStateFile, enableLanguage: false, performanceProfile: 'mobile', cycleResultMode: 'summary' };

let first;
let second;
try {
  first = new OrganismRuntime(options);
  await first.init();
  await first.step();

  const firstSnapshot = first.core.snapshot();
  const eventRows = firstSnapshot.facets.memory.eventLog.filter(event => event.type === 'metacognitive-episode');
  assert.equal(eventRows.length, 1, 'one complete runtime cycle emits exactly one canonical metacognitive episode');
  const event = eventRows[0];
  const episode = event.payload.episode;
  assert.equal(episode.tick, firstSnapshot.state.tick);
  assert.equal(episode.parentEventIds.length, 11, 'episode links all eleven operational phases');
  assert.equal(episode.reflection.status, 'not-evaluated', 'a reflection is not promoted without a governed proposal');
  assert.equal(episode.reflection.proposalId, null);
  assert.ok(['observed', 'simulated'].includes(episode.outcome.provenance));

  const causalFabric = firstSnapshot.system.runtimeCognitiveEventFabric;
  const causalNode = causalFabric.recent.find(node => node.id === episode.cognitiveEventId);
  assert.ok(causalNode, 'episode also exists in the unified causal fabric');
  assert.equal(causalNode.stage, 'metacognitive-episode');
  assert.deepEqual(causalNode.parentIds, episode.parentEventIds);
  for (const parentId of episode.parentEventIds) {
    assert.ok(causalFabric.recent.some(node => node.id === parentId), `causal parent ${parentId} is retained`);
  }

  const memoryId = `metacognitive-cycle-${episode.tick}`;
  assert.ok(first.core.memorySubstrateCanonicalItems(32).some(item => item.id === memoryId),
    'the episode is encoded in canonical MemoryOS2 through MemoryFabric');

  const replay = await first.core.recordMetacognitiveEpisode(episode);
  assert.equal(replay.status, 'replayed', 'replaying a committed episode does not create another memory/event');
  const afterReplay = first.core.snapshot().facets.memory.eventLog.filter(row => row.type === 'metacognitive-episode');
  assert.equal(afterReplay.length, 1, 'replay does not duplicate the canonical event');

  const conflicting = { ...episode, prediction: { ...episode.prediction, expectedOutcome01: Math.max(0, episode.prediction.expectedOutcome01 - 0.2) } };
  await assert.rejects(() => first.core.recordMetacognitiveEpisode(conflicting), /metacognitive-episode-id-conflict/,
    'reusing the cycle identity with changed evidence is rejected');

  const diagnostics = first.core.metacognitiveEpisodeDiagnostics(4);
  assert.equal(diagnostics.bufferedCount, 1);
  assert.equal(diagnostics.episodes[0].parentCount, 11);
  assert.equal(typeof diagnostics.meanPredictionError01, 'number');

  const durableTick = firstSnapshot.state.tick;
  await first.stop();
  first = null;

  second = new OrganismRuntime(options);
  await second.init();
  const restored = second.core.snapshot();
  assert.equal(restored.state.tick, durableTick, 'runtime restored the committed cycle');
  assert.equal(restored.facets.memory.eventLog.filter(row => row.type === 'metacognitive-episode').length, 1,
    'metacognitive memory event survives process restart');
  assert.ok(restored.system.runtimeCognitiveEventFabric.recent.some(node => node.stage === 'metacognitive-episode'),
    'metacognitive causal node survives process restart');
  assert.ok(second.core.memorySubstrateCanonicalItems(32).some(item => item.id === memoryId),
    'canonical MemoryOS2 episode survives process restart');

  await second.step();
  assert.equal(second.core.metacognitiveEpisodeDiagnostics(4).bufferedCount, 2,
    'a post-restart full cycle appends one new episode without duplicating the prior tick');
  console.log('metacognitive-episode-runtime: PASS');
} finally {
  if (first) await first.stop();
  if (second) await second.stop();
  await rm(directory, { recursive: true, force: true });
}
