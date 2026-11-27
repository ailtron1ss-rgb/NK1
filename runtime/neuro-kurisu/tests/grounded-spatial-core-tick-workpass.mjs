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
  assert.equal(records.length, 0, 'caller-supplied evidenceKind=observed is not a host admission receipt and must not enter canonical MemoryOS2');
  const firstGroundedEntity = core.groundedWorldSnapshot().entities.find(row => row.label === 'chair');
  assert.deepEqual(firstGroundedEntity?.position, { x: 1, y: 2, z: 0 }, 'unverified spatial input may remain a world hypothesis');
  assert.equal(firstGroundedEntity?.modalityEvidenceKinds.world, 'derived', 'caller labels cannot promote world evidence to observed');

  await core.observe({ worldContext: world(20, 'model-output', 2) });
  const afterModelOutput = core.snapshot();
  records = afterModelOutput.facets.advanced.memoryOS.items.filter(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE);
  assert.equal(records.length, 0, 'model-only output must not create canonical spatial memory');
  const modelGroundedEntity = core.groundedWorldSnapshot().entities.find(row => row.label === 'chair');
  assert.equal(modelGroundedEntity?.modalityEvidenceKinds.world, 'model-output');
  assert.deepEqual(modelGroundedEntity?.position, { x: 20, y: 2, z: 0 }, 'model coordinates remain available as a hypothesis without canonical fact promotion');

  await core.observe({ worldContext: world(3, 'observed', 3) });
  const afterNewObserved = core.snapshot();
  records = afterNewObserved.facets.advanced.memoryOS.items.filter(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE);
  assert.equal(records.length, 0, 'a second caller-labelled observation still cannot bypass host admission');
  const finalGroundedEntity = core.groundedWorldSnapshot().entities.find(row => row.label === 'chair');
  assert.deepEqual(finalGroundedEntity?.position, { x: 3, y: 2, z: 0 });
  assert.equal(finalGroundedEntity?.modalityEvidenceKinds.world, 'derived');
  console.log('GROUNDED_SPATIAL_CORE_UNTRUSTED_INPUT=PASS');
} finally {
  await core.close?.();
}
