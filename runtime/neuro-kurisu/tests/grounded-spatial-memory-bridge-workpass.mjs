import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { defaultGroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import {
  GROUNDED_SPATIAL_MEMORY_TTL_MS,
  GROUNDED_SPATIAL_MEMORY_SOURCE,
  synchronizeGroundedSpatialMemories,
} from '../src/organism/memory/GroundedSpatialMemoryBridge.ts';

function entity(id, overrides = {}) {
  const at = overrides.lastSeenAt ?? Date.now();
  return {
    id,
    label: id === 'chair-1' ? 'chair' : id,
    kind: 'object',
    confidence01: 0.91,
    present01: 0.96,
    firstSeenAt: at - 1000,
    lastSeenAt: at,
    modalities: ['vision'],
    positionFrameId: 'lab-map',
    position: { x: 1, y: 2, z: 0 },
    modalityEvidenceKinds: { vision: 'observed' },
    sourceIds: ['vision'],
    visibilityKnown: true,
    presenceStatus: 'visible',
    persistence01: 0.5,
    absenceEvidence01: 0,
    observationCount: 4,
    ...overrides,
  };
}

function query(memoryOS, point, extra = {}) {
  return memoryOS.previewRetrieve('where is the chair?', 8, 0, 0, {
    spatial: { frameId: 'lab-map', x: point.x, y: point.y, z: 0, radius: 2 },
    ...extra,
  });
}

{
  const memory = new MemorySubsystemRuntime();
  const at = Date.now();
  const snapshot = defaultGroundedWorldState();
  snapshot.lastAt = at;
  snapshot.entities = [
    entity('chair-1', { lastSeenAt: at - 50 }),
    entity('model-only', {
      lastSeenAt: at - 50,
      modalityEvidenceKinds: { vision: 'model-output' },
      position: { x: 1, y: 2, z: 0 },
    }),
    entity('conflicted', {
      lastSeenAt: at - 50,
      modalityEvidenceKinds: { vision: 'conflict' },
    }),
    entity('stale', { lastSeenAt: at - GROUNDED_SPATIAL_MEMORY_TTL_MS - 1 }),
    entity('camera-box-only', { position: null, positionFrameId: undefined }),
  ];

  const first = synchronizeGroundedSpatialMemories({
    fabric: memory.fabric,
    memoryOS: memory.memoryOS,
    snapshot,
    at,
    tick: 1,
  });
  assert.equal(first.considered, 5);
  assert.equal(first.accepted, 1);
  assert.equal(first.written, 1);
  assert.equal(first.rejected, 4);
  assert.equal(memory.memoryOS.size(), 1);
  assert.equal(memory.memoryOS.snapshot({ clone: false }).items[0].source, GROUNDED_SPATIAL_MEMORY_SOURCE);
  assert.deepEqual(query(memory.memoryOS, { x: 1, y: 2 }).map(row => row.id), first.memoryIds);

  const duplicate = synchronizeGroundedSpatialMemories({
    fabric: memory.fabric,
    memoryOS: memory.memoryOS,
    snapshot,
    at,
    tick: 2,
  });
  assert.equal(duplicate.written, 0);
  assert.equal(duplicate.unchanged, 1);
  assert.equal(memory.memoryOS.size(), 1);

  const movedAt = Date.now();
  snapshot.lastAt = movedAt;
  snapshot.entities[0].lastSeenAt = movedAt;
  snapshot.entities[0].position = { x: 20, y: 2, z: 0 };
  const moved = synchronizeGroundedSpatialMemories({
    fabric: memory.fabric,
    memoryOS: memory.memoryOS,
    snapshot,
    at: movedAt,
    tick: 3,
  });
  assert.equal(moved.written, 1);
  assert.equal(memory.memoryOS.size(), 1, 'same grounded entity must reconsolidate rather than duplicate');
  assert.equal(query(memory.memoryOS, { x: 1, y: 2 }).some(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE), false,
    'moving a track must remove its old cell posting');
  assert.equal(query(memory.memoryOS, { x: 20, y: 2 }).some(row => row.source === GROUNDED_SPATIAL_MEMORY_SOURCE), true,
    'the new observed position must be retrievable in the same frame');
  const current = memory.memoryOS.snapshot({ clone: false }).items[0];
  assert.equal(current.validUntilAt, movedAt + GROUNDED_SPATIAL_MEMORY_TTL_MS);
  assert.equal(current.context.spatialX, '20');
  assert.equal(current.context.groundedEvidenceKind, 'observed');

  const betweenOldAndNewExpiry = movedAt + GROUNDED_SPATIAL_MEMORY_TTL_MS - 1;
  assert.equal(query(memory.memoryOS, { x: 20, y: 2 }, {
    temporalMode: 'at',
    asOfAt: betweenOldAndNewExpiry,
  }).length > 0, true, 'new observation must extend the current track validity window');
  assert.equal(query(memory.memoryOS, { x: 20, y: 2 }, {
    temporalMode: 'at',
    asOfAt: movedAt + GROUNDED_SPATIAL_MEMORY_TTL_MS + 1,
  }).length, 0, 'unrefreshed spatial tracks must expire rather than remain current forever');
  assert.equal(memory.memoryOS.indexDiagnostics().spatialIndex.pass, true);
}

console.log('GROUNDED_SPATIAL_MEMORY_BRIDGE=PASS');
