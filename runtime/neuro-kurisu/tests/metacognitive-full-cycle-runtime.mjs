import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const directory = await mkdtemp(path.join(tmpdir(), 'nk-metacognitive-full-cycle-'));
const options = {
  stateFile: path.join(directory, 'state.json'),
  worldStateFile: path.join(directory, 'world.json'),
  enableLanguage: false,
  performanceProfile: 'mobile',
  cycleResultMode: 'summary',
};
let runtime;
try {
  runtime = new OrganismRuntime(options);
  await runtime.init();
  await runtime.step();

  const snapshot = runtime.core.snapshot();
  const fabric = snapshot.system.cognitiveEventFabric;
  const episodeEvent = fabric.recent.find((event) => event.stage === 'metacognition');
  assert.ok(episodeEvent, 'one canonical metacognitive CEF event must be recorded for the completed feedback cycle');
  assert.equal(episodeEvent.parentIds.length, 11,
    'the canonical metacognitive event must directly reference all eleven cycle stages');

  const byId = new Map(fabric.recent.map((event) => [event.id, event]));
  const parentStages = episodeEvent.parentIds.map((id) => byId.get(id)?.stage).sort();
  assert.deepEqual(parentStages, [
    'action', 'appraisal', 'attention', 'goal', 'learning', 'memory',
    'observation', 'outcome', 'plan', 'prediction', 'self-update',
  ], 'the episode must be grounded in the exact eleven-stage causal cycle');

  const memoryId = `meta:${episodeEvent.id}`;
  const memoryItem = runtime.core.memorySubstrateCanonicalItems(32).find((item) => item.id === memoryId);
  assert.ok(memoryItem, 'the full-cycle episode must be projected into canonical MemoryOS2');
  assert.deepEqual(memoryItem.context?.causalParentIds, episodeEvent.parentIds,
    'MemoryOS2 must retain the exact CEF parent set');

  const secondSnapshot = runtime.core.snapshot();
  const matching = secondSnapshot.system.cognitiveEventFabric.recent.filter((event) => event.stage === 'metacognition');
  assert.equal(matching.length, 1, 'one completed cycle must not create duplicate metacognitive events');

  console.log('WORKPASS_FULL_CYCLE_METACOGNITIVE_RUNTIME=PASS');
} finally {
  if (runtime) await runtime.stop();
  await rm(directory, { recursive: true, force: true });
}
