import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryConsolidationController } from '../src/organism/memory/MemoryConsolidationController.ts';
import { recordAndPersistMetacognitiveEpisode, persistMetacognitiveEpisode } from '../src/organism/memory/MetacognitiveMemoryProjection.ts';

const fabric = new CognitiveEventFabric(128);
const recordedStages = fabric.recordOperationalCycle({
  tick: 42,
  observation: { source: 'runtime-observation', confidence01: 0.92 },
  prediction: { source: 'runtime-prediction', confidence01: 0.81 },
  appraisal: { source: 'runtime-appraisal', confidence01: 0.88 },
  attention: { source: 'runtime-attention', confidence01: 0.86 },
  memory: { source: 'runtime-memory', confidence01: 0.9 },
  goal: { source: 'runtime-goal', confidence01: 0.84 },
  plan: { source: 'runtime-plan', confidence01: 0.82 },
  action: { source: 'runtime-action', confidence01: 0.8 },
  outcome: { source: 'runtime-outcome', confidence01: 0.6 },
  learning: { source: 'runtime-learning', confidence01: 0.6 },
  selfUpdate: { source: 'runtime-self-update', confidence01: 0.9 },
});
const cycleStageIds = {
  observation: recordedStages.observation,
  prediction: recordedStages.prediction,
  appraisal: recordedStages.appraisal,
  attention: recordedStages.attention,
  memory: recordedStages.memory,
  goal: recordedStages.goal,
  plan: recordedStages.plan,
  action: recordedStages.action,
  outcome: recordedStages.outcome,
  learning: recordedStages.learning,
  'self-update': recordedStages.selfUpdate,
};
const expectedParentIds = [
  cycleStageIds.observation,
  cycleStageIds.prediction,
  cycleStageIds.appraisal,
  cycleStageIds.attention,
  cycleStageIds.memory,
  cycleStageIds.goal,
  cycleStageIds.plan,
  cycleStageIds.action,
  cycleStageIds.outcome,
  cycleStageIds.learning,
  cycleStageIds['self-update'],
];
assert.ok(expectedParentIds.every((id) => typeof id === 'string'));

const input = {
  tick: 42,
  cycleId: 'cycle-42',
  cycleStageIds,
  actionEventId: cycleStageIds.action,
  observationEventId: cycleStageIds.observation,
  predictionEventId: cycleStageIds.prediction,
  outcomeEventId: cycleStageIds.outcome,
  learningEventId: cycleStageIds.learning,
  predictedOutcomeHash: 'a'.repeat(64),
  observedOutcomeHash: 'b'.repeat(64),
  decisionRationaleHash: 'c'.repeat(64),
  predictionError01: 0.4,
  confidence01: 0.72,
  reflectionKind: 'calibration',
  correctionDisposition: 'staged',
};
const memory = new MemoryOS2({ embeddingProvider: null });
const consolidation = new MemoryConsolidationController();
const recorded = recordAndPersistMetacognitiveEpisode(fabric, input, memory, consolidation);
const episode = recorded.episode;
assert.equal(episode.resolved, true);
const event = fabric.recent(16).find(row => row.id === episode.eventId);
assert.ok(event);
assert.deepEqual(event.parentIds, expectedParentIds,
  'the metacognitive event must link all eleven verified stages in canonical order');
assert.equal(event.parentIds.length, 11);
const first = recorded.projection;
assert.ok(first);
assert.equal(first.stored, true);
assert.equal(first.replayed, false);
assert.equal(first.memory.kind, 'episodic');
assert.equal(first.memory.epistemicStatus, 'hypothesis');
assert.equal(first.memory.provenanceClass, 'derived');
assert.equal(first.memory.context?.sourceEventId, event.id);
assert.equal(first.memory.context?.observationId, cycleStageIds.observation);
assert.equal(first.memory.context?.decisionId, cycleStageIds.action);
assert.deepEqual(first.memory.context?.causalParentIds, expectedParentIds,
  'canonical MemoryOS2 episode must retain the complete causal parent set');
assert.equal(first.memory.context?.outcomeDirection, 'prediction-aligned');
assert.equal(first.memory.context?.projectionHash, episode.projectionHash);
assert.match(first.memory.content, /Prediction error 40.0%/);
assert.ok(first.consolidation);
assert.equal(consolidation.diagnostics().runs, 1);
const causalRecall = memory.previewRetrieveWithDiagnostics('why did the prediction fail?', 5);
assert.equal(causalRecall.diagnostics.queryIntentMode, 'causal');
assert.equal(causalRecall.items[0]?.id, first.memory.id,
  'causal retrieval should surface the linked metacognitive episode');

// Replay is a no-op: no duplicate memory and no second consolidation credit.
const replay = recordAndPersistMetacognitiveEpisode(fabric, input, memory, consolidation).projection;
assert.ok(replay);
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
assert.deepEqual(restoredReplay.memory.context?.causalParentIds, expectedParentIds);
assert.equal(restoredMemory.snapshot().items.length, 1);

// A conflicting projection cannot silently rewrite an already persisted episode.
const conflicting = structuredClone(event);
conflicting.payload.projectionHash = 'd'.repeat(64);
assert.throws(
  () => persistMetacognitiveEpisode(conflicting, memory, consolidation),
  /metacognitive-memory-projection-conflict/,
);

// Duplicate causal parents cannot be admitted into canonical episodic memory.
const duplicateParent = structuredClone(event);
duplicateParent.parentIds[10] = duplicateParent.parentIds[9];
assert.throws(
  () => persistMetacognitiveEpisode(duplicateParent, new MemoryOS2({ embeddingProvider: null }), new MemoryConsolidationController()),
  /metacognitive-memory-projection-invalid-episode/,
);

// An incomplete eleven-stage cycle must not create a metacognitive event.
const incompleteFabric = new CognitiveEventFabric(128);
const incompleteStages = incompleteFabric.recordOperationalCycle({
  tick: 43,
  observation: { source: 'runtime-observation' },
  prediction: { source: 'runtime-prediction' },
  action: { source: 'runtime-action' },
  outcome: { source: 'runtime-outcome' },
  learning: { source: 'runtime-learning' },
  selfUpdate: { source: 'runtime-self-update' },
});
const incompleteCycleStageIds = {
  observation: incompleteStages.observation,
  prediction: incompleteStages.prediction,
  appraisal: incompleteStages.appraisal,
  attention: incompleteStages.attention,
  memory: incompleteStages.memory,
  goal: incompleteStages.goal,
  plan: incompleteStages.plan,
  action: incompleteStages.action,
  outcome: incompleteStages.outcome,
  learning: incompleteStages.learning,
  'self-update': incompleteStages.selfUpdate,
};
const incompleteResult = incompleteFabric.recordMetacognitiveEpisode({
  ...input,
  tick: 43,
  cycleId: 'cycle-43',
  cycleStageIds: incompleteCycleStageIds,
  actionEventId: incompleteStages.action,
  observationEventId: incompleteStages.observation,
  predictionEventId: incompleteStages.prediction,
  outcomeEventId: incompleteStages.outcome,
  learningEventId: incompleteStages.learning,
});
assert.equal(incompleteResult.resolved, false);
assert.equal(incompleteResult.reason, 'cycle-lineage-incomplete');
assert.equal(incompleteFabric.recent(32).some(row => row.stage === 'metacognition'), false,
  'incomplete cycle evidence must not be recorded as a complete metacognitive episode');

// Existing snapshots without the full-cycle field remain replayable after upgrade.
// The old episode is not rewritten or duplicated; only newly created episodes receive all eleven parents.
const legacyFabric = new CognitiveEventFabric(128);
const legacyStages = legacyFabric.recordOperationalCycle({
  tick: 44,
  observation: { source: 'legacy-observation' },
  prediction: { source: 'legacy-prediction' },
  appraisal: { source: 'legacy-appraisal' },
  attention: { source: 'legacy-attention' },
  memory: { source: 'legacy-memory' },
  goal: { source: 'legacy-goal' },
  plan: { source: 'legacy-plan' },
  action: { source: 'legacy-action' },
  outcome: { source: 'legacy-outcome' },
  learning: { source: 'legacy-learning' },
  selfUpdate: { source: 'legacy-self-update' },
});
const legacyCycleStageIds = {
  observation: legacyStages.observation,
  prediction: legacyStages.prediction,
  appraisal: legacyStages.appraisal,
  attention: legacyStages.attention,
  memory: legacyStages.memory,
  goal: legacyStages.goal,
  plan: legacyStages.plan,
  action: legacyStages.action,
  outcome: legacyStages.outcome,
  learning: legacyStages.learning,
  'self-update': legacyStages.selfUpdate,
};
const { cycleStageIds: _newOnlyStageMap, ...legacyBaseInput } = input;
const legacyInput = {
  ...legacyBaseInput,
  tick: 44,
  cycleId: 'legacy-cycle-44',
  actionEventId: legacyStages.action,
  observationEventId: legacyStages.observation,
  predictionEventId: legacyStages.prediction,
  outcomeEventId: legacyStages.outcome,
  learningEventId: legacyStages.learning,
};
const legacyRecorded = legacyFabric.recordMetacognitiveEpisode(legacyInput);
assert.equal(legacyRecorded.resolved, true);
const legacyEvent = legacyFabric.recent(16).find(row => row.id === legacyRecorded.eventId);
assert.ok(legacyEvent);
assert.equal(legacyEvent.parentIds.length, 4);
const legacyUpgradeReplay = legacyFabric.recordMetacognitiveEpisode({
  ...legacyInput,
  cycleStageIds: legacyCycleStageIds,
});
assert.equal(legacyUpgradeReplay.resolved, true);
assert.equal(legacyUpgradeReplay.replayed, true,
  'a pre-full-cycle event with the same canonical identity must remain an idempotent replay');
assert.equal(legacyFabric.recent(16).filter(row => row.stage === 'metacognition').length, 1,
  'upgrade replay must not duplicate or rewrite a legacy episode');

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
