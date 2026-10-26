import assert from 'node:assert/strict';
import { HexisAdaptationFabric } from '../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { CANONICAL_MEMORY_CAPACITY } from '../src/organism/memory/CanonicalMemoryCapacity.ts';

const RETAINED_LIMIT_BYTES = 16 * 1024 * 1024;
const ROW_COUNT = 8;
const CONTENT_BYTES = 240_000;
const largeContent = 'H'.repeat(CONTENT_BYTES);

function makeDocument(index) {
  const exportId = 'exp_' + index.toString(16).padStart(16, '0');
  return {
    hmx_version: '1.7',
    export_id: exportId,
    export_intent: 'port',
    exported_at: '2026-10-26T12:00:00.000Z',
    source: {
      instance_id: 'retained-stage-budget-test',
      schema_version: '1.7',
      embedding_model: 'test-only',
      embedding_dimension: 1,
      hexis_lineage_id: 'retained-stage-budget-lineage-' + index,
    },
    sections: {
      memories: Array.from({ length: ROW_COUNT }, (_, rowIndex) => ({
        ref: exportId + ':memory-' + rowIndex,
        type: 'semantic',
        content: largeContent,
      })),
    },
  };
}

const owner = new HexisAdaptationFabric();
const stages = [];
for (let index = 0; index < 9; index++) {
  const stage = owner.stageHmx({
    document: makeDocument(index),
    intent: 'port',
    strategy: 'additive',
  });
  stages.push(stage);
  if (index < 8) {
    assert.deepEqual(stage.conflicts, [], 'staged payload ' + index + ' should fit within the retained budget');
    assert.equal(stage.stagedSections.memories.length, ROW_COUNT);
  } else {
    assert(stage.conflicts.some(conflict => conflict.kind === 'retained-stage-budget'));
    assert.equal(stage.sectionCounts.memories, ROW_COUNT,
      'source record counts stay visible after payload omission');
    assert.equal(stage.stagedSections.memories, undefined,
      'when budget would be exceeded the entire incoming section must be omitted');
    assert.equal(owner.decideHmx(stage.stagingId, 'accept')?.status, 'staged',
      'a retained-budget conflict must block acceptance');
  }
}
const retainedBytes = owner.snapshot().hmxStages.reduce((sum, stage) => sum + (stage.stagedBytes ?? 0), 0);
assert(retainedBytes <= RETAINED_LIMIT_BYTES,
  'the retained stage payload must never exceed the configured 16 MiB budget');
const firstStoredStage = owner.snapshot().hmxStages.find(stage => stage.stagingId === stages[0].stagingId);
assert.equal(firstStoredStage?.stagedSections.memories.length, ROW_COUNT,
  'rejecting a later payload must not mutate the earlier retained payload in owner state');
assert.equal(firstStoredStage?.stagedBytes, stages[0].stagedBytes);
assert.equal(stages[0].stagedSections.memories.length, ROW_COUNT,
  'the original staging receipt remains unchanged for the caller');
assert.equal(stages[0].stagedBytes > 0, true);
assert.equal(stages[8].stagedBytes, 0);

// Legacy or externally corrupted persisted snapshots must be remeasured: never trust
// their stagedBytes accounting field. Construct the pre-budget state containing nine
// large staged payloads and verify restore preserves recent work while dropping older
// unaccepted payloads with an explicit blocking conflict.
const legacySnapshot = owner.snapshot();
const latest = legacySnapshot.hmxStages.at(-1);
assert(latest);
latest.stagedSections = { memories: makeDocument(8).sections.memories };
latest.stagedBytes = 0;
const restored = new HexisAdaptationFabric();
restored.restore(legacySnapshot);
const restoredStages = restored.snapshot().hmxStages;
const restoredBytes = restoredStages.reduce((sum, stage) => sum + (stage.stagedBytes ?? 0), 0);
assert(restoredBytes <= RETAINED_LIMIT_BYTES,
  'restore recomputes staged payload size rather than trusting the persisted counter');
assert.equal(restoredStages.length, 9);
assert.equal(Object.keys(restoredStages[0].stagedSections).length, 0,
  'restore drops the oldest payload when a legacy snapshot exceeds the aggregate limit');
assert(restoredStages[0].conflicts.some(conflict => conflict.kind === 'retained-stage-budget'));
assert.equal(restoredStages[0].status, 'staged',
  'restore must not leave an accepted stage eligible after its source payload was omitted');
assert.equal(restoredStages.at(-1)?.stagedSections.memories.length, ROW_COUNT,
  'recent staged payload is kept when older persisted stages exceed the bound');

// Keep the fixture tied to the shared memory-capacity contract as a guard against
// an accidental import-side preflight drift while this staging boundary is exercised.
assert(CANONICAL_MEMORY_CAPACITY > ROW_COUNT);

console.log('HEXIS_HMX_RETAINED_STAGE_BUDGET=PASS', JSON.stringify({
  stages: restoredStages.length,
  retainedBytes: restoredBytes,
  retainedLimitBytes: RETAINED_LIMIT_BYTES,
  omittedOldestStage: restoredStages[0].stagingId,
}));
