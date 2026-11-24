import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { GROUNDED_SPATIAL_MEMORY_SOURCE } from '../src/organism/memory/GroundedSpatialMemoryBridge.ts';

const core = new OrganismCore(new MemoryStateStore(), { enableLanguage: false });
await core.init();
try {
  const world = (x, evidenceKind, tick) => ({
    tick,
    location: 'lab',
    energy: 0.8,
    attention: 0.75,
    uncertainty: 0.12,
    facts: ['calibrated laboratory frame'],
    objects: [{
      id: 'chair-track-1',
      label: 'chair',
      location: 'lab',
      value: 0,
      valueKnown: false,
      visible: true,
      visibilityKnown: true,
      collected: false,
      collectionKnown: false,
      confidence01: 0.92,
      evidenceKind,
      sourceId: 'calibrated-world-receipt:42',
      coordinateFrameId: 'lab-map',
      x,
      y: 2,
      z: 0,
    }],
  });
  await core.observe({ worldContext: world(1, 'observed', 1) });
  const afterObserved = core.snapshot();
  let records = afterObserved.facets.advanced.memoryOS.items.filter(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE);
  assert.equal(records.length, 1, 'a live Core observation must write the observed coordinate to canonical MemoryOS2');
  assert.equal(records[0].context.spatialX, '1');
  assert.equal(records[0].context.spatialFrameId, 'lab-map');
  assert.equal(records[0].context.groundedEvidenceKind, 'observed');

  await core.observe({ worldContext: world(20, 'model-output', 2) });
  const afterModelOutput = core.snapshot();
  records = afterModelOutput.facets.advanced.memoryOS.items.filter(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE);
  assert.equal(records.length, 1, 'model-only output must not create another spatial memory');
  assert.equal(records[0].context.spatialX, '1', 'model-only coordinates must not overwrite an accepted observed position');
  assert.equal(records[0].context.groundedEvidenceKind, 'observed');

  await core.observe({ worldContext: world(3, 'observed', 3) });
  const afterNewObserved = core.snapshot();
  records = afterNewObserved.facets.advanced.memoryOS.items.filter(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE);
  assert.equal(records.length, 1, 'a moving entity must update one canonical memory instead of duplicating it');
  assert.equal(records[0].context.spatialX, '3', 'a newer observed position must update the canonical spatial point');
  assert.equal(records[0].context.groundedEvidenceKind, 'observed');
  console.log('GROUNDED_SPATIAL_CORE_TICK=PASS');
} finally {
  await core.close?.();
}
