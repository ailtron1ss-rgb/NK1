import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { MemoryLifecycleCommandConflictError } from '../src/organism/memory/MemoryFabric.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const at = 2_000_000_000_000;
const makeInput = (content, extra = {}) => ({
  content,
  kind: 'episodic',
  source: 'memory-lifecycle-workpass31',
  tags: ['workpass31'],
  context: { branch: 'canonical-memory' },
  salience: .74,
  emotionalWeight: .16,
  identityRelevance: .18,
  goalRelevance: .36,
  socialRelevance: .08,
  predictionError: .2,
  confidence: .72,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: at,
  observedAt: at,
  ...extra,
});

const runtime = new MemorySubsystemRuntime();
const seedInput = makeInput('WP31 canonical memory mutation remains replay-safe after restore.');
const seed = runtime.fabric.encode(seedInput, { commandId: 'wp31:encode:seed', tick: 41 });
assert.ok(seed?.id);
const sizeAfterEncode = runtime.memoryOS.size();
const createEventCount = runtime.events.list().filter(event => event.type === 'memory-created').length;
const encodeStatsAfterFirst = runtime.fabric.snapshot().stats.encodes;
runtime.fabric.encode(seedInput, { commandId: 'wp31:encode:seed', tick: 42 });
assert.equal(runtime.memoryOS.size(), sizeAfterEncode, 'replaying an encode command must not create/reconsolidate canonical memory');
assert.equal(runtime.fabric.snapshot().stats.encodes, encodeStatsAfterFirst, 'replay must not increment write stats');
assert.equal(runtime.events.list().filter(event => event.type === 'memory-created').length, createEventCount, 'replay must not emit a duplicate create event');

// Legacy/multi-timescale imports also pass through the same mutation boundary.
const legacyRow = {
  id: 'wp31-legacy-row-001', kind: 'episode', summary: 'WP31 imported legacy episode is represented by the canonical memory owner.',
  salience: .61, evidence: ['old-timescale evidence'], createdAt: at, timescale: 'episodic',
  retrievalCount: 0, lastRetrievedAt: at, confidence: .74, sourceEventIds: [],
};
const legacyItem = runtime.fabric.ingestCompatibility(legacyRow, 42);
const legacySize = runtime.memoryOS.size();
const legacyStats = runtime.fabric.snapshot().stats.encodes;
const legacyEvents = runtime.events.list().length;
assert.equal(runtime.fabric.ingestCompatibility(legacyRow, 43).id, legacyItem.id);
assert.equal(runtime.memoryOS.size(), legacySize, 'legacy replay must not create duplicate canonical memory');
assert.equal(runtime.fabric.snapshot().stats.encodes, legacyStats, 'legacy replay must skip mutation stats');
assert.equal(runtime.events.list().length, legacyEvents, 'legacy replay must skip duplicate events');
const legacyRow2 = { ...legacyRow, id: 'wp31-legacy-row-002', summary: 'WP31 second legacy episode must be imported through canonical mutation boundary.' };
const legacyRows = [legacyRow, legacyRow2];
const beforeConsolidateStats = runtime.fabric.snapshot().stats.encodes;
assert.equal(runtime.fabric.consolidateCompatibility(legacyRows, 64, 44), 2);
const afterConsolidateStats = runtime.fabric.snapshot().stats.encodes;
assert.equal(runtime.fabric.consolidateCompatibility(legacyRows, 64, 45), 2);
assert.equal(runtime.fabric.snapshot().stats.encodes, afterConsolidateStats, 'compatibility restore replay should use persisted mutation receipts');
assert.ok(afterConsolidateStats > beforeConsolidateStats);

const corrected = runtime.fabric.reviseContent(seed.id, 'WP31 canonical memory mutation is corrected and remains replay-safe after restore.', {
  reason: 'workpass31-correction', source: 'memory-lifecycle-workpass31', validAt: at + 10_000,
}, { commandId: 'wp31:revise:seed', tick: 43 });
assert.ok(corrected?.id);
assert.notEqual(corrected.id, seed.id);
assert.equal(runtime.memoryOS.temporalChain(seed.id).length, 2, 'content correction must create one canonical temporal revision');
const correctedChain = runtime.memoryOS.temporalChain(corrected.id);
assert.deepEqual(correctedChain.map(row => row.id), [seed.id, corrected.id],
  'indexed temporal-chain lookup must return the complete chain in revision order from either endpoint');
assert.deepEqual(correctedChain.map(row => row.revisionSequence), [1, 2]);
assert.equal(runtime.memoryOS.indexDiagnostics().pass, true, 'revision-group index must match canonical memory before restore');
const temporalSnapshot = runtime.memoryOS.snapshot();
const temporalNow = Date.now();
const expectedCurrentCount = temporalSnapshot.items.filter(row => {
  const from = Number(row.validFromAt ?? row.createdAt);
  const until = row.validUntilAt == null ? Number.POSITIVE_INFINITY : Number(row.validUntilAt);
  return from <= temporalNow && temporalNow < until;
}).length;
const expectedHistoricalCount = temporalSnapshot.items.filter(row => row.validUntilAt != null).length;
const expectedRevisionGroups = new Map();
for (const row of temporalSnapshot.items) {
  const group = row.revisionGroupId ?? row.id;
  expectedRevisionGroups.set(group, Math.max(expectedRevisionGroups.get(group) ?? 0, Number(row.revisionSequence ?? 1)));
}
assert.deepEqual(runtime.memoryOS.temporalDiagnostics(), {
  current: expectedCurrentCount,
  historical: expectedHistoricalCount,
  revisedItems: expectedHistoricalCount,
  revisionGroups: expectedRevisionGroups.size,
  maxRevision: Math.max(0, ...expectedRevisionGroups.values()),
  validityCoverage01: temporalSnapshot.items.length
    ? Math.max(0, Math.min(1, Number.isFinite((expectedCurrentCount + expectedHistoricalCount) / temporalSnapshot.items.length)
      ? (expectedCurrentCount + expectedHistoricalCount) / temporalSnapshot.items.length : 0))
    : 1,
}, 'single-pass temporal diagnostics must preserve the existing diagnostic contract');

runtime.fabric.updateSignals(corrected.id, { confidence: .81 }, 'workpass31-confidence-update', { commandId: 'wp31:signals:seed', tick: 44 });
runtime.fabric.updateContext(corrected.id, { branch: 'workpass31', reviewState: 'integrated' }, { commandId: 'wp31:context:seed', tick: 45 });
runtime.fabric.revise(corrected.id, 'hypothesis', 'workpass31-epistemic-review', { commandId: 'wp31:status:seed', tick: 46 });
const disposable = runtime.fabric.encode(makeInput('WP31 disposable episodic row for replay-safe forgetting.', { validFromAt: at + 20_000, observedAt: at + 20_000 }), { tick: 47 });
assert.equal(runtime.fabric.forgetById(disposable.id, 'workpass31-disposal', { commandId: 'wp31:forget:disposable', tick: 48 }), true);
assert.equal(runtime.memoryOS.snapshot({ clone: false }).items.some(row => row.id === disposable.id), false);

// A no-op context update is not another lifecycle mutation and must not create noise.
const eventsBeforeNoop = runtime.events.list().length;
runtime.fabric.updateContext(corrected.id, { branch: 'workpass31', reviewState: 'integrated' }, { tick: 49 });
assert.equal(runtime.events.list().length, eventsBeforeNoop, 'unchanged context must not emit a lifecycle event');

const durable = {
  memoryOS: runtime.memoryOS.snapshot(),
  fabric: runtime.fabric.snapshot(),
  events: runtime.events.list(),
};
assert.ok(durable.fabric.mutationReceipts.length >= 6, 'mutating command receipts must be part of the persisted Fabric snapshot');

// Exercise the actual persisted-state normalizer: it used to drop the new journal.
const migratedPersisted = migratePersistedOrganism({
  schemaVersion: ORGANISM_STATE_SCHEMA,
  state: { version: ORGANISM_STATE_SCHEMA, tick: 50 },
  facets: { advanced: { memoryOS: structuredClone(durable.memoryOS), memoryFabric: structuredClone(durable.fabric) } },
});
const migratedFabricSnapshot = migratedPersisted.facets.advanced.memoryFabric;
assert.equal(migratedFabricSnapshot.mutationReceipts?.length, durable.fabric.mutationReceipts.length,
  'the normal persistence migration must preserve valid replay receipts instead of dropping them');
const restored = new MemorySubsystemRuntime();
restored.memoryOS.restore(structuredClone(durable.memoryOS));
restored.fabric.restore(structuredClone(migratedFabricSnapshot));
restored.events.restore(structuredClone(durable.events));
const beforeReplaySize = restored.memoryOS.size();
const beforeReplayFabricStats = restored.fabric.snapshot().stats;
const beforeReplayEvents = restored.events.list().length;

assert.equal(restored.fabric.encode(seedInput, { commandId: 'wp31:encode:seed', tick: 50 }).id, seed.id);
assert.equal(restored.fabric.reviseContent(seed.id, 'WP31 canonical memory mutation is corrected and remains replay-safe after restore.', {
  reason: 'workpass31-correction', source: 'memory-lifecycle-workpass31', validAt: at + 10_000,
}, { commandId: 'wp31:revise:seed', tick: 51 })?.id, corrected.id);
restored.fabric.updateSignals(corrected.id, { confidence: .81 }, 'workpass31-confidence-update', { commandId: 'wp31:signals:seed', tick: 52 });
const replayedContext = restored.fabric.updateContext(corrected.id, { branch: 'workpass31', reviewState: 'integrated' }, { commandId: 'wp31:context:seed', tick: 53 });
assert.equal(replayedContext.reviewState, 'integrated');
restored.fabric.revise(corrected.id, 'hypothesis', 'workpass31-epistemic-review', { commandId: 'wp31:status:seed', tick: 54 });
assert.equal(restored.fabric.forgetById(disposable.id, 'workpass31-disposal', { commandId: 'wp31:forget:disposable', tick: 55 }), true);
assert.deepEqual(restored.memoryOS.temporalChain(corrected.id).map(row => row.id), [seed.id, corrected.id],
  'restore and command replay must preserve revision-group index membership');
assert.equal(restored.memoryOS.indexDiagnostics().pass, true, 'all derived indexes must remain consistent after replay and forgetting');

assert.equal(restored.memoryOS.size(), beforeReplaySize, 'restoring and replaying receipts must not resurrect forgotten memories or add revisions');
assert.deepEqual(restored.fabric.snapshot().stats, beforeReplayFabricStats, 'replay must not change mutation/retrieval counters');
assert.equal(restored.events.list().length, beforeReplayEvents, 'replay across restart must not duplicate lifecycle events');
assert.equal(restored.memoryOS.temporalChain(seed.id).length, 2, 'replayed correction must not fork or lengthen the revision chain');
const replayEventDelta = restored.events.list().length - beforeReplayEvents;
assert.equal(replayEventDelta, 0, 'replay should emit no new lifecycle events');

assert.throws(() => restored.fabric.encode(makeInput('different payload with a reused mutation key'), { commandId: 'wp31:encode:seed' }), MemoryLifecycleCommandConflictError,
  'reusing an idempotency key for a different payload must fail explicitly');
const malformedMigration = migratePersistedOrganism({
  schemaVersion: ORGANISM_STATE_SCHEMA,
  state: { version: ORGANISM_STATE_SCHEMA },
  facets: { advanced: { memoryFabric: { ...durable.fabric, mutationReceipts: [
    ...(durable.fabric.mutationReceipts ?? []),
    { commandId: 'bad', fingerprint: 'invalid', action: 'encode', at: -1, outcome: 'applied', resultKind: 'memory' },
  ] } } },
});
assert.equal(malformedMigration.facets.advanced.memoryFabric.mutationReceipts?.some(row => row.commandId === 'bad'), false,
  'invalid or negative-time replay receipts must be discarded during state migration');

// The journal itself remains bounded even under a long-lived organism session.
for (let index = 0; index < 520; index++) {
  restored.fabric.updateContext(corrected.id, { [`bounded-${index}`]: String(index) }, { commandId: `wp31:bounded:${index}` });
}
assert.equal(restored.fabric.snapshot().mutationReceipts.length, 512, 'the persisted receipt journal must stay bounded');

console.log(JSON.stringify({
  ok: true,
  canonicalItems: restored.memoryOS.size(),
  revisionCount: restored.memoryOS.temporalChain(seed.id).length,
  receiptCount: restored.fabric.snapshot().mutationReceipts.length,
  replayEventDelta,
  canonicalAuthority: restored.fabric.inspect().canonicalAuthority,
}));
