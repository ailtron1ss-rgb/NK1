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
  const parentStages = episode.parentEventIds.map(parentId => causalFabric.recent.find(node => node.id === parentId)?.stage).sort();
  assert.deepEqual(parentStages, ['action','appraisal','attention','goal','learning','memory','observation','outcome','plan','prediction','self-update'].sort(),
    'the metacognitive node is causally attached to exactly the eleven operational stages');
  assert.equal(causalFabric.cycleCoverage01, 1, 'metacognitive nodes do not dilute core cycle coverage');
  assert.equal(causalFabric.fullCycleCoverage01, 1, 'metacognitive nodes do not inflate the eleven-stage cycle denominator');
  for (const parentId of episode.parentEventIds) {
    assert.ok(causalFabric.recent.some(node => node.id === parentId), `causal parent ${parentId} is retained`);
  }

  const memoryId = `metacognitive-cycle-${episode.tick}`;
  const canonicalMemory = first.core.memorySubstrateCanonicalItems(32).find(item => item.id === memoryId);
  assert.ok(canonicalMemory, 'the episode is encoded in canonical MemoryOS2 through MemoryFabric');
  assert.equal(canonicalMemory.kind, 'episodic');
  assert.equal(canonicalMemory.epistemicStatus, 'hypothesis', 'a generated reflection cannot silently become a confirmed fact');
  assert.ok(canonicalMemory.content.includes('error'), 'canonical episodic content exposes calibration outcome');

  const replay = await first.core.recordMetacognitiveEpisode(episode);
  assert.equal(replay.status, 'replayed', 'replaying a committed episode does not create another memory/event');
  const afterReplay = first.core.snapshot().facets.memory.eventLog.filter(row => row.type === 'metacognitive-episode');
  assert.equal(afterReplay.length, 1, 'replay does not duplicate the canonical event');

  const conflictingExpected = Math.max(0, episode.prediction.expectedOutcome01 - 0.2);
  const conflicting = {
    ...episode,
    prediction: { ...episode.prediction, expectedOutcome01: conflictingExpected },
    outcome: { ...episode.outcome, predictionError01: Math.abs(conflictingExpected - episode.outcome.observedOutcome01) },
  };
  await assert.rejects(() => first.core.recordMetacognitiveEpisode(conflicting), /metacognitive-episode-id-conflict/,
    'reusing the cycle identity with changed evidence is rejected');

  const staleTick = episode.tick - 1;
  const staleEpisode = {
    ...episode,
    id: `meta-cycle:${staleTick}`,
    cycleId: `cycle:${staleTick}`,
    cognitiveEventId: `cef:metacognitive:${staleTick}`,
    tick: staleTick,
  };
  await assert.rejects(() => first.core.recordMetacognitiveEpisode(staleEpisode), /metacognitive-episode-stale-tick/,
    'a new stale episode is rejected before memory/event mutation');
  assert.equal(first.core.snapshot().facets.memory.eventLog.filter(row => row.type === 'metacognitive-episode').length, 1,
    'a rejected stale tick leaves no partial event');

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

  // A secondary metacognitive-memory failure must not abort the canonical organism tick.
  const originalRecorder = second.core.recordMetacognitiveEpisode.bind(second.core);
  second.core.recordMetacognitiveEpisode = async () => {
    throw new Error('injected-metacognitive-memory-failure');
  };
  const degradedTick = durableTick + 2;
  const degradedStep = await second.step();
  assert.equal(degradedStep.cycle.state.tick, degradedTick,
    'the organism must finish its cycle when optional metacognitive memory persistence fails');
  const degradedSnapshot = second.core.snapshot();
  assert.equal(degradedSnapshot.state.tick, degradedTick,
    'the canonical tick must advance despite a metacognitive persistence failure');
  assert.equal(degradedSnapshot.facets.memory.eventLog.filter(row => row.type === 'metacognitive-episode').length, 2,
    'a failed secondary persistence attempt must not fabricate a canonical memory event');
  assert.ok(degradedSnapshot.system.runtimeCognitiveEventFabric.recent.some(node => node.id === `cef:metacognitive:${degradedTick}`),
    'the completed cycle must retain its metacognitive diagnostic node even if canonical memory persistence fails');
  second.core.recordMetacognitiveEpisode = originalRecorder;

  console.log('metacognitive-episode-runtime: PASS');
} finally {
  if (first) await first.stop();
  if (second) await second.stop();
  await rm(directory, { recursive: true, force: true });
}
