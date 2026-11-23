import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const CAP = 1600;
const input = (content, extra = {}) => ({
  content,
  kind: 'semantic',
  source: 'memoryos2-capacity-lifecycle-integrity',
  tags: ['capacity-regression'],
  context: {},
  salience: 0.5,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.8,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  ...extra,
});

const cloneRow = (row, index, overrides = {}) => ({
  ...structuredClone(row),
  id: 'restore-row-' + String(index).padStart(5, '0'),
  content: 'restore payload ' + index + ' exact independent record',
  contentHash: undefined,
  kind: 'semantic',
  source: 'restore-source-' + index,
  semanticVector: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  supersedesId: null,
  supersededById: null,
  revisionGroupId: 'restore-row-' + String(index).padStart(5, '0'),
  revisionSequence: 1,
  createdAt: 1700000000000 + index,
  lastAccessAt: 1700000000000 + index,
  ...overrides,
});

// 1. Encode overflow must protect identity and evict the weakest eligible row.
{
  const memory = new MemoryOS2({ embeddingProvider: null });
  const identity = memory.encode(input('protected identity must survive overflow', {
    kind: 'identity',
    salience: 0.9,
    confidence: 0.99,
    identityRelevance: 1,
  }));
  const victim = memory.encode(input('weak capacity victim unique-token qzv-001', {
    salience: 0.001,
    confidence: 0.01,
    identityRelevance: 0,
    goalRelevance: 0,
  }));
  const referrer = memory.encode(input('relationship referrer stable memory', {
    salience: 0.7,
    confidence: 0.9,
  }));
  memory.addLinks(referrer.id, {
    semanticLinks: [victim.id],
    temporalLinks: [victim.id],
    causalLinks: [victim.id],
    contradictionLinks: [victim.id],
  });

  for (let index = 0; index < CAP - 3; index += 1) {
    memory.encode(input('capacity filler ' + index + ' with unique memory token', {
      salience: 0.35,
      confidence: 0.55,
      identityRelevance: 0,
      goalRelevance: 0,
    }));
  }
  assert.equal(memory.size(), CAP);

  memory.encode(input('new verified high-value memory after overflow', {
    salience: 1,
    confidence: 1,
    identityRelevance: 0.9,
    goalRelevance: 1,
  }));

  const rows = memory.snapshot({ clone: false }).items;
  const ids = new Set(rows.map((row) => row.id));
  assert.equal(rows.length, CAP, 'the ordinary cap remains bounded');
  assert.ok(ids.has(identity.id), 'identity memory must never be evicted by capacity pressure');
  assert.ok(!ids.has(victim.id), 'the lowest-value eligible record should be evicted instead');
  const remainingReferrer = rows.find((row) => row.id === referrer.id);
  assert.ok(remainingReferrer, 'the relationship owner must remain canonical');
  for (const field of ['semanticLinks', 'temporalLinks', 'causalLinks', 'contradictionLinks']) {
    assert.ok(!(remainingReferrer[field] ?? []).includes(victim.id), field + ' must not retain a removed ID');
  }
  assert.equal(memory.memoryAccountingDiagnostics().exact, true, 'overflow must subtract the removed row bytes');
  assert.equal(memory.indexDiagnostics().pass, true, 'all retrieval/index projections must reconcile');
}

// 2. Restore must retain a protected tail row, not blindly truncate the input prefix.
{
  const seed = new MemoryOS2({ embeddingProvider: null });
  seed.encode(input('restore base template'));
  const snapshot = seed.snapshot();
  const template = snapshot.items[0];
  const rows = Array.from({ length: CAP }, (_, index) => cloneRow(
    template,
    index,
    index === 0
      ? { salience: 0.001, confidence: 0.01 }
      : { salience: 0.6, confidence: 0.8 },
  ));
  rows[1].semanticLinks = ['restore-row-00000'];
  const protectedTail = {
    ...cloneRow(template, CAP, {
      kind: 'identity',
      source: 'restore-protected-tail',
      content: 'protected identity tail must survive restore capacity selection',
      salience: 1,
      confidence: 0.99,
      identityRelevance: 1,
    }),
    id: 'restore-protected-tail',
    revisionGroupId: 'restore-protected-tail',
  };
  const oversized = { ...snapshot, items: [...rows, protectedTail], estimatedBytes: 0 };
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore(oversized);

  const restoredRows = restored.snapshot().items;
  const ids = new Set(restoredRows.map((row) => row.id));
  assert.equal(restoredRows.length, CAP);
  assert.ok(ids.has('restore-protected-tail'), 'protected records in the tail must survive restore');
  assert.ok(!ids.has('restore-row-00000'), 'the weakest unprotected record should be selected for truncation');
  assert.ok(
    !(restoredRows.find((row) => row.id === 'restore-row-00001').semanticLinks ?? []).includes('restore-row-00000'),
    'restore must prune links to rows removed by capacity selection',
  );
  assert.equal(restored.restoreDiagnostics().truncatedRows, 1);
  assert.equal(restored.restoreDiagnostics().capacityOverrunRows, 0);
  assert.equal(restored.indexDiagnostics().pass, true);
}

// 3. If protected rows alone exceed capacity, preserve them and expose the overrun.
{
  const seed = new MemoryOS2({ embeddingProvider: null });
  seed.encode(input('protected restore template', { kind: 'identity' }));
  const snapshot = seed.snapshot();
  const template = snapshot.items[0];
  const protectedRows = Array.from({ length: CAP + 1 }, (_, index) => ({
    ...cloneRow(template, index, {
      kind: index % 2 ? 'autobiographical' : 'identity',
      epistemicStatus: index % 3 ? 'belief' : 'quarantined',
      content: 'protected continuity row ' + index,
      source: 'protected-source-' + index,
    }),
    id: 'protected-' + String(index).padStart(5, '0'),
    revisionGroupId: 'protected-' + String(index).padStart(5, '0'),
  }));
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore({ ...snapshot, items: protectedRows, estimatedBytes: 0 });
  assert.equal(restored.size(), CAP + 1, 'protected records must not be silently truncated');
  assert.equal(restored.restoreDiagnostics().capacityOverrunRows, 1);
  restored.maintain({ maxItems: CAP });
  assert.equal(restored.size(), CAP + 1, 'maintenance must not perform an unsafe final slice');
  assert.equal(restored.capacityDiagnostics().overCapacity, true);
}

// 4. The legacy clone:false option must not expose the live mutable canonical state.
{
  const memory = new MemoryOS2({ embeddingProvider: null });
  const original = memory.encode(input('snapshot isolation original content'));
  const external = memory.snapshot({ clone: false });
  external.items[0].content = 'mutated through leaked canonical reference';
  external.items.push(cloneRow(external.items[0], 99));
  assert.equal(memory.size(), 1, 'external snapshot mutation must not change canonical count');
  assert.equal(memory.get(original.id).content, 'snapshot isolation original content');
  assert.equal(memory.indexDiagnostics().pass, true);
}

console.log('MEMORYOS2_CAPACITY_LIFECYCLE_INTEGRITY=PASS');
