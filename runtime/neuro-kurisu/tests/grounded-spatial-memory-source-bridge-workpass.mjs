import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { defaultGroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import {
  GROUNDED_SPATIAL_MEMORY_SOURCE,
  GROUNDED_SPATIAL_MEMORY_TTL_MS,
  synchronizeGroundedSpatialMemories,
} from '../src/organism/memory/GroundedSpatialMemoryBridge.ts';

function entity(id, observedAt, overrides = {}) {
  return {
    id,
    label: id === 'chair-1' ? 'chair' : id,
    kind: 'object',
    confidence01: 0.91,
    present01: 0.96,
    firstSeenAt: observedAt - 1000,
    lastSeenAt: observedAt,
    modalities: ['world'],
    positionFrameId: 'lab-map',
    position: { x: 1, y: 2, z: 0 },
    modalityEvidenceKinds: { world: 'observed' },
    sourceIds: ['camera-receipt:42'],
    visibilityKnown: true,
    presenceStatus: 'visible',
    persistence01: 0.5,
    absenceEvidence01: 0,
    observationCount: 4,
    ...overrides,
  };
}
function spatial(memoryOS, point, extra = {}) {
  return memoryOS.previewRetrieve('where is the chair?', 8, 0, 0, {
    spatial: { frameId: 'lab-map', x: point.x, y: point.y, z: 0, radius: 2 },
    ...extra,
  });
}

const memory = new MemorySubsystemRuntime();
const at = Date.now() - 10_000;
const snapshot = defaultGroundedWorldState();
snapshot.lastAt = at;
snapshot.entities = [
  entity('chair-1', at - 50),
  entity('model-only', at - 50, { modalities: ['vision'], modalityEvidenceKinds: { vision: 'model-output' } }),
  entity('mixed-provenance', at - 50, { modalities: ['world', 'vision'], modalityEvidenceKinds: { world: 'observed', vision: 'model-output' } }),
  entity('conflicted', at - 50, { modalityEvidenceKinds: { world: 'conflict' } }),
  entity('unresolved', at - 50, { modalityEvidenceKinds: { world: 'unresolved' } }),
  entity('stale', at - GROUNDED_SPATIAL_MEMORY_TTL_MS - 1),
  entity('image-box-only', at - 50, { position: null, positionFrameId: undefined }),
  entity('invisible', at - 50, { presenceStatus: 'fading' }),
  entity('low-confidence', at - 50, { confidence01: 0.2 }),
];
const first = synchronizeGroundedSpatialMemories({
  fabric: memory.fabric, memoryOS: memory.memoryOS, snapshot, at, tick: 1,
});
assert.equal(first.considered, 9);
assert.equal(first.accepted, 1);
assert.equal(first.written, 1);
assert.equal(first.rejected, 8);
assert.equal(memory.memoryOS.size(), 1);
const firstMemory = memory.memoryOS.snapshot({ clone: false }).items[0];
assert.equal(firstMemory.source, GROUNDED_SPATIAL_MEMORY_SOURCE);
assert.equal(firstMemory.context.groundedEvidenceKind, 'observed');
assert.deepEqual(spatial(memory.memoryOS, { x: 1, y: 2 }).map(row => row.id), first.memoryIds);

const duplicate = synchronizeGroundedSpatialMemories({
  fabric: memory.fabric, memoryOS: memory.memoryOS, snapshot, at, tick: 2,
});
assert.equal(duplicate.written, 0);
assert.equal(duplicate.unchanged, 1);
assert.equal(memory.memoryOS.size(), 1);

const movedAt = at + 1000;
snapshot.lastAt = movedAt;
snapshot.entities[0].lastSeenAt = movedAt;
snapshot.entities[0].position = { x: 20, y: 2, z: 0 };
const moved = synchronizeGroundedSpatialMemories({
  fabric: memory.fabric, memoryOS: memory.memoryOS, snapshot, at: movedAt, tick: 3,
});
assert.equal(moved.written, 1);
assert.equal(memory.memoryOS.size(), 1, 'the same entity must reconsolidate, not duplicate');
assert.equal(spatial(memory.memoryOS, { x: 1, y: 2 }).length, 0, 'moving a track must remove its old spatial posting');
assert.equal(spatial(memory.memoryOS, { x: 20, y: 2 }).length, 1, 'the new observed coordinate must be retrievable');
const current = memory.memoryOS.snapshot({ clone: false }).items[0];
assert.equal(current.validUntilAt, movedAt + GROUNDED_SPATIAL_MEMORY_TTL_MS);
assert.equal(current.context.spatialX, '20');

const delayedAt = movedAt + 2000;
snapshot.entities[0].lastSeenAt = movedAt - 500;
snapshot.entities[0].position = { x: 2, y: 2, z: 0 };
const delayed = synchronizeGroundedSpatialMemories({
  fabric: memory.fabric, memoryOS: memory.memoryOS, snapshot, at: delayedAt, tick: 4,
});
assert.equal(delayed.staleSkipped, 1);
assert.equal(memory.memoryOS.snapshot({ clone: false }).items[0].context.spatialX, '20',
  'a delayed observation must not move the canonical track backwards');

snapshot.entities[0].lastSeenAt = movedAt;
snapshot.entities[0].position = { x: 999, y: 2, z: 0 };
const equalTimeConflict = synchronizeGroundedSpatialMemories({
  fabric: memory.fabric, memoryOS: memory.memoryOS, snapshot, at: delayedAt + 1, tick: 5,
});
assert.equal(equalTimeConflict.conflictSkipped, 1);
assert.equal(memory.memoryOS.snapshot({ clone: false }).items[0].context.spatialX, '20',
  'a conflicting equal-time observation must preserve the previously accepted position');

const expired = spatial(memory.memoryOS, { x: 20, y: 2 }, {
  temporalMode: 'at', asOfAt: movedAt + GROUNDED_SPATIAL_MEMORY_TTL_MS + 1,
});
assert.equal(expired.length, 0, 'the spatial observation must expire without a newer observation');
assert.equal(memory.memoryOS.indexDiagnostics().spatialIndex.pass, true);
console.log('GROUNDED_SPATIAL_MEMORY_BRIDGE=PASS');
