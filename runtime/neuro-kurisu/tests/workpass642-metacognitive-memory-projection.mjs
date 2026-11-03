import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryConsolidationController } from '../src/organism/memory/MemoryConsolidationController.ts';
import { persistMetacognitiveEpisode } from '../src/organism/memory/MetacognitiveMemoryProjection.ts';

const fabric = new CognitiveEventFabric(128);
const action = fabric.append({ tick: 42, stage: 'action', source: 'runtime-action' });
const outcome = fabric.append({
  tick: 42, stage: 'outcome', source: 'runtime-outcome', parentIds: [action.id],
});
const learning = fabric.append({
  tick: 42, stage: 'learning', source: 'runtime-learning', parentIds: [outcome.id],
});
const input = {
  tick: 42,
  cycleId: 'cycle-42',
  actionEventId: action.id,
  outcomeEventId: outcome.id,
  learningEventId: learning.id,
  predictedOutcomeHash: 'a'.repeat(64),
  observedOutcomeHash: 'b'.repeat(64),
  decisionRationaleHash: 'c'.repeat(64),
  predictionError01: 0.4,
  confidence01: 0.72,
  reflectionKind: 'calibration',
  correctionDisposition: 'staged',
};
const episode = fabric.recordMetacognitiveEpisode(input);
assert.equal(episode.resolved, true);
const event = fabric.recent(16).find(row => row.id === episode.eventId);
assert.ok(event);

const memory = new MemoryOS2({ embeddingProvider: null });
const consolidation = new MemoryConsolidationController();
const first = persistMetacognitiveEpisode(event, memory, consolidation);
assert.equal(first.stored, true);
assert.equal(first.replayed, false);
assert.equal(first.memory.kind, 'episodic');
assert.equal(first.memory.epistemicStatus, 'hypothesis');
assert.equal(first.memory.provenanceClass, 'derived');
assert.equal(first.memory.context?.sourceEventId, event.id);
assert.equal(first.memory.context?.projectionHash, episode.projectionHash);
assert.match(first.memory.content, /Prediction error 40.0%/);
assert.ok(first.consolidation);
assert.equal(consolidation.diagnostics().runs, 1);

// Replay is a no-op: no duplicate memory and no second consolidation credit.
const replay = persistMetacognitiveEpisode(event, memory, consolidation);
assert.equal(replay.replayed, true);
assert.equal(replay.stored, false);
assert.equal(memory.snapshot().items.filter(row => row.id === first.memory.id).length, 1);
assert.equal(consolidation.diagnostics().runs, 1);

// The canonical memory snapshot and controller state survive restart.
const restoredMemory = new MemoryOS2({ embeddingProvider: null });
restoredMemory.restore(memory.snapshot());
const restoredConsolidation = new MemoryConsolidationController();
restoredConsolidation.restore(consolidation.snapshot());
const restoredReplay = persistMetacognitiveEpisode(event, restoredMemory, restoredConsolidation);
assert.equal(restoredReplay.replayed, true);
assert.equal(restoredMemory.snapshot().items.length, 1);

// A conflicting projection cannot silently rewrite an already persisted episode.
const conflicting = structuredClone(event);
conflicting.payload.projectionHash = 'd'.repeat(64);
assert.throws(
  () => persistMetacognitiveEpisode(conflicting, memory, consolidation),
  /metacognitive-memory-projection-conflict/,
);

// Non-episode and malformed inputs do not mutate either canonical owner.
const beforeMemory = memory.snapshot();
const beforeConsolidation = consolidation.snapshot();
assert.throws(
  () => persistMetacognitiveEpisode({ ...event, stage: 'action' }, memory, consolidation),
  /metacognitive-memory-projection-invalid-episode/,
);
assert.deepEqual(memory.snapshot(), beforeMemory);
assert.deepEqual(consolidation.snapshot(), beforeConsolidation);

console.log('WORKPASS642_METACOGNITIVE_MEMORY_PROJECTION=PASS');
