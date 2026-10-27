import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { MemoryLifecycleCommandConflictError, MemoryLifecycleCommandRecoveryRequiredError } from '../src/organism/memory/MemoryFabric.ts';
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

// WorkPass434: if a status mutation commits but lifecycle-event append throws before
// the receipt is persisted, its in-flight compensation token must still restore the
// exact canonical status/timestamp/history rather than being discarded as a no-op.
const statusCompensationRuntime = new MemorySubsystemRuntime();
const statusCompensationSeed = statusCompensationRuntime.fabric.encode(
  makeInput('WP434 status compensation must survive a post-mutation event failure.'),
  { commandId: 'wp434:status-compensation:seed' },
);
const statusCompensationToken = statusCompensationRuntime.fabric.captureStatusCompensation(statusCompensationSeed.id);
assert.ok(statusCompensationToken);
const statusBeforeFailure = statusCompensationRuntime.fabric.canonicalSnapshot().items
  .find(item => item.id === statusCompensationSeed.id);
assert.ok(statusBeforeFailure);
const appendLifecycleEvent = statusCompensationRuntime.fabric.events.append.bind(statusCompensationRuntime.fabric.events);
let injectedLifecycleAppendFailure = false;
statusCompensationRuntime.fabric.events.append = (...args) => {
  if (!injectedLifecycleAppendFailure) {
    injectedLifecycleAppendFailure = true;
    throw new Error('injected-status-lifecycle-event-append-failure');
  }
  return appendLifecycleEvent(...args);
};
assert.throws(
  () => statusCompensationRuntime.fabric.revise(
    statusCompensationSeed.id,
    'belief',
    'workpass434-post-mutation-fault',
    {
      commandId: 'hexis-supersede:' + 'a'.repeat(48),
      compensationToken: statusCompensationToken,
    },
  ),
  /injected-status-lifecycle-event-append-failure/,
);
statusCompensationRuntime.fabric.events.append = appendLifecycleEvent;
assert.equal(injectedLifecycleAppendFailure, true);
const statusAfterPartialFailure = statusCompensationRuntime.fabric.canonicalSnapshot().items
  .find(item => item.id === statusCompensationSeed.id);
assert.equal(statusAfterPartialFailure?.epistemicStatus, 'belief',
  'fault injection must occur after the canonical status mutation');
assert.equal(
  statusCompensationRuntime.fabric.restoreStatusForCompensation(
    statusCompensationSeed.id,
    statusCompensationToken,
    'hexis-hmx-apply-rollback',
    { commandId: 'hexis-status-rollback:' + 'b'.repeat(48) },
  ),
  true,
  'the in-flight compensation token must remain usable without a persisted mutation receipt',
);
const statusAfterCompensation = statusCompensationRuntime.fabric.canonicalSnapshot().items
  .find(item => item.id === statusCompensationSeed.id);
assert.equal(statusAfterCompensation?.epistemicStatus, statusBeforeFailure.epistemicStatus);
assert.equal(statusAfterCompensation?.lastAccessAt, statusBeforeFailure.lastAccessAt);
assert.deepEqual(statusAfterCompensation?.revisionHistory, statusBeforeFailure.revisionHistory);


// WorkPass435: trust-signal compensation must also survive a failure after MemoryOS2
// mutates the row but before MemoryFabric can persist its lifecycle receipt.
const signalCompensationRuntime = new MemorySubsystemRuntime();
const signalCompensationSeed = signalCompensationRuntime.fabric.encode(
  makeInput('WP435 signal compensation must survive a post-mutation event failure.'),
  { commandId: 'wp435:signal-compensation:seed' },
);
const signalCompensationToken = signalCompensationRuntime.fabric.captureSignalCompensation(signalCompensationSeed.id);
assert.ok(signalCompensationToken);
const signalBeforeFailure = signalCompensationRuntime.fabric.canonicalSnapshot().items
  .find(item => item.id === signalCompensationSeed.id);
assert.ok(signalBeforeFailure);
const signalFields = [
  'salience', 'emotionalWeight', 'identityRelevance', 'goalRelevance', 'socialRelevance',
  'predictionError', 'temperature01', 'confidence', 'sourceAuthority01', 'evidenceSources',
  'evidenceLineageKeys', 'dormant', 'lastAccessAt', 'revisionHistory',
];
const signalBaseline = Object.fromEntries(
  signalFields.map(field => [field, structuredClone(signalBeforeFailure[field])]),
);
const appendSignalLifecycleEvent = signalCompensationRuntime.fabric.events.append
  .bind(signalCompensationRuntime.fabric.events);
let injectedSignalAppendFailure = false;
signalCompensationRuntime.fabric.events.append = (...args) => {
  if (!injectedSignalAppendFailure) {
    injectedSignalAppendFailure = true;
    throw new Error('injected-signal-lifecycle-event-append-failure');
  }
  return appendSignalLifecycleEvent(...args);
};
assert.throws(
  () => signalCompensationRuntime.fabric.updateSignals(
    signalCompensationSeed.id,
    { salience: .98, confidence: .96 },
    'workpass435-post-mutation-fault',
    {
      commandId: 'hexis-authority:' + 'c'.repeat(48),
      compensationToken: signalCompensationToken,
    },
  ),
  /injected-signal-lifecycle-event-append-failure/,
);
signalCompensationRuntime.fabric.events.append = appendSignalLifecycleEvent;
assert.equal(injectedSignalAppendFailure, true);
const signalAfterPartialFailure = signalCompensationRuntime.fabric.canonicalSnapshot().items
  .find(item => item.id === signalCompensationSeed.id);
assert.equal(signalAfterPartialFailure?.salience, .98,
  'fault injection must occur after canonical signal mutation');
assert.equal(signalAfterPartialFailure?.confidence, .96);
assert.equal(
  signalCompensationRuntime.fabric.restoreSignalsForCompensation(
    signalCompensationSeed.id,
    signalCompensationToken,
    'hexis-hmx-apply-rollback',
    { commandId: 'hexis-signals-rollback:' + 'd'.repeat(48) },
  ),
  true,
  'the in-flight trust-signal compensation token must remain usable without a persisted receipt',
);
const signalAfterCompensation = signalCompensationRuntime.fabric.canonicalSnapshot().items
  .find(item => item.id === signalCompensationSeed.id);
assert.deepEqual(
  Object.fromEntries(signalFields.map(field => [field, structuredClone(signalAfterCompensation[field])])),
  signalBaseline,
  'compensation must restore the exact canonical trust-signal/provenance/timestamp/history state',
);
const sizeAfterEncode = runtime.memoryOS.size();
const createEventCount = runtime.events.list().filter(event => event.type === 'memory-created').length;
const encodeStatsAfterFirst = runtime.fabric.snapshot().stats.encodes;
runtime.fabric.encode(seedInput, { commandId: 'wp31:encode:seed', tick: 42 });
assert.equal(runtime.memoryOS.size(), sizeAfterEncode, 'replaying an encode command must not create/reconsolidate canonical memory');
assert.equal(runtime.fabric.snapshot().stats.encodes, encodeStatsAfterFirst, 'replay must not increment write stats');
assert.equal(runtime.events.list().filter(event => event.type === 'memory-created').length, createEventCount, 'replay must not emit a duplicate create event');

// WorkPass429: a command ID is an exact idempotency key. It may not be trimmed,
// truncated or coerced, because aliases can replay an unrelated cached result.
const idPrefix = 'wp31:command-id-boundary:';
const validBoundaryCommandId = idPrefix + 'x'.repeat(128 - idPrefix.length);
assert.equal(validBoundaryCommandId.length, 128, 'the maximum supported command ID length remains valid');
const boundaryInput = makeInput('WP429 bounded command ID remains an exact canonical-memory key.');
const boundaryItem = runtime.fabric.encode(boundaryInput, { commandId: validBoundaryCommandId, tick: 44 });
assert.ok(boundaryItem?.id);
assert.equal(runtime.fabric.encode(boundaryInput, { commandId: validBoundaryCommandId, tick: 45 })?.id, boundaryItem.id,
  'a valid maximum-length ID must still replay its original receipt');
const beforeInvalidCommandIds = {
  size: runtime.memoryOS.size(),
  stats: runtime.fabric.snapshot().stats,
  events: runtime.events.list().length,
};
const invalidCommandIds = [
  validBoundaryCommandId + 'x',
  ' ' + validBoundaryCommandId,
  validBoundaryCommandId + String.fromCharCode(10),
  'wp31:bad' + String.fromCharCode(0x009f) + 'key',
  42,
  '',
];
for (const invalidCommandId of invalidCommandIds) {
  assert.throws(
    () => runtime.fabric.encode(boundaryInput, { commandId: invalidCommandId }),
    error => error instanceof TypeError && error.message === 'memory-lifecycle-command-id-invalid',
    'malformed, non-string or overlong command IDs must be rejected, not normalized into another key',
  );
}
assert.equal(runtime.memoryOS.size(), beforeInvalidCommandIds.size, 'invalid command IDs must not mutate canonical memory');
assert.deepEqual(runtime.fabric.snapshot().stats, beforeInvalidCommandIds.stats, 'invalid command IDs must not alter memory counters');
assert.equal(runtime.events.list().length, beforeInvalidCommandIds.events, 'invalid command IDs must not emit lifecycle events');

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
assert.equal(malformedMigration.facets.advanced.memoryFabric.retiredMutationReceiptBloomCorrupt,true,
  'dropping any malformed hot receipt must mark the replay journal uncertain instead of silently permitting a retry');
const corruptJournalRuntime=new MemorySubsystemRuntime();
corruptJournalRuntime.fabric.restore(malformedMigration.facets.advanced.memoryFabric);
assert.throws(
  () => corruptJournalRuntime.fabric.encode(makeInput('A corrupted receipt journal must never permit an ambiguous duplicate mutation.'), {commandId:'wp31:corrupt-journal:blocked'}),
  MemoryLifecycleCommandRecoveryRequiredError,
  'a malformed restored receipt must fail closed for new keyed mutations until the journal is repaired',
);
const directCorruptReceiptRuntime=new MemorySubsystemRuntime();
directCorruptReceiptRuntime.fabric.restore({mutationReceipts:[{...durable.fabric.mutationReceipts[0],commandId:' '+durable.fabric.mutationReceipts[0].commandId}]});
assert.throws(
  () => directCorruptReceiptRuntime.fabric.encode(seedInput,{commandId:durable.fabric.mutationReceipts[0].commandId}),
  MemoryLifecycleCommandRecoveryRequiredError,
  'direct restore must not trim a malformed receipt key into a valid replay key',
);
const malformedControlReceiptRuntime=new MemorySubsystemRuntime();
malformedControlReceiptRuntime.fabric.restore({mutationReceipts:[{
  ...durable.fabric.mutationReceipts[0],
  commandId:'wp31:bad\u0000receipt',
}]});
assert.throws(
  () => malformedControlReceiptRuntime.fabric.encode(seedInput,{commandId:'wp31:clean-key'}),
  MemoryLifecycleCommandRecoveryRequiredError,
  'control characters in persisted command IDs must invalidate receipt certainty',
);
const c1ControlReceiptRuntime=new MemorySubsystemRuntime();
c1ControlReceiptRuntime.fabric.restore({mutationReceipts:[{
  ...durable.fabric.mutationReceipts[0],
  commandId:'wp31:bad'+String.fromCharCode(0x009f)+'receipt',
}]});
assert.throws(
  () => c1ControlReceiptRuntime.fabric.encode(seedInput,{commandId:'wp31:c1-restore-blocked'}),
  MemoryLifecycleCommandRecoveryRequiredError,
  'C1 controls in persisted command IDs must invalidate receipt certainty',
);
const validDuplicateReceipt=durable.fabric.mutationReceipts.find(row=>row.resultKind==='memory'&&row.memoryId);
assert.ok(validDuplicateReceipt,'fixture requires a canonical memory receipt');
const c1MemoryIdRuntime=new MemorySubsystemRuntime();
c1MemoryIdRuntime.fabric.restore({mutationReceipts:[{
  ...validDuplicateReceipt,
  memoryId:'wp31:bad'+String.fromCharCode(0x009f)+'memory',
}]});
assert.throws(
  () => c1MemoryIdRuntime.fabric.encode(seedInput,{commandId:'wp31:c1-memory-id-blocked'}),
  MemoryLifecycleCommandRecoveryRequiredError,
  'C1 controls in persisted receipt memory IDs must invalidate receipt certainty',
);
const duplicateReceiptRuntime=new MemorySubsystemRuntime();
duplicateReceiptRuntime.fabric.restore({mutationReceipts:[validDuplicateReceipt,{...validDuplicateReceipt,memoryId:'forged-memory-id'}]});
assert.throws(
  () => duplicateReceiptRuntime.fabric.encode(seedInput,{commandId:validDuplicateReceipt.commandId}),
  MemoryLifecycleCommandRecoveryRequiredError,
  'duplicate persisted command IDs with conflicting result metadata must not replay either cached receipt',
);

const duplicateReceiptMigration=migratePersistedOrganism({
  schemaVersion:ORGANISM_STATE_SCHEMA,
  state:{version:ORGANISM_STATE_SCHEMA},
  facets:{advanced:{memoryFabric:{...durable.fabric,mutationReceipts:[validDuplicateReceipt,{...validDuplicateReceipt,memoryId:'forged-memory-id'}]}}},
});
assert.equal(duplicateReceiptMigration.facets.advanced.memoryFabric.retiredMutationReceiptBloomCorrupt,true,
  'state migration must mark duplicate command IDs uncertain even while deduplicating their rows');
assert.equal(duplicateReceiptMigration.facets.advanced.memoryFabric.mutationReceipts.filter(row=>row.commandId===validDuplicateReceipt.commandId).length,1,
  'state migration must retain at most one row for a duplicate command identity');

// The journal itself remains bounded even under a long-lived organism session.
for (let index = 0; index < 520; index++) {
  restored.fabric.updateContext(corrected.id, { [`bounded-${index}`]: String(index) }, { commandId: `wp31:bounded:${index}` });
}
assert.equal(restored.fabric.snapshot().mutationReceipts.length, 512, 'the persisted receipt journal must stay bounded');

// WorkPass437: a capacity-trim failure must restore the full over-capacity
// transaction state, not truncate it through the normal 1,600-item restore limit.
const capacityFailureRuntime = new MemorySubsystemRuntime();
const capacityFailureSeed = capacityFailureRuntime.fabric.encode(
  makeInput('WP437 capacity-failure baseline seed row.'),
  { commandId: 'wp437:capacity-seed' },
);
const capacityFailureState = capacityFailureRuntime.memoryOS.snapshot();
const capacityFailureTemplate = capacityFailureState.items.find(item => item.id === capacityFailureSeed.id);
assert.ok(capacityFailureTemplate);
const capacityFailureRows = Array.from({ length: 1600 }, (_, index) => ({
  ...structuredClone(capacityFailureTemplate),
  id: index === 0 ? capacityFailureTemplate.id : 'wp437-capacity-baseline-' + String(index).padStart(4, '0'),
  content: index === 0 ? capacityFailureTemplate.content : 'WP437 capacity baseline row ' + index,
  contentHash: '',
  source: 'wp437-capacity-baseline',
  tags: ['wp437-capacity-baseline'],
  context: { branch: 'wp437-capacity-baseline', ordinal: String(index) },
  semanticVector: [],
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  evidenceSources: [],
  evidenceLineageKeys: [],
  revisionHistory: [],
  revisionGroupId: index === 0 ? capacityFailureTemplate.revisionGroupId : 'wp437-capacity-baseline-' + String(index).padStart(4, '0'),
  revisionSequence: 1,
}));
capacityFailureRuntime.memoryOS.restore({
  ...capacityFailureState,
  items: capacityFailureRows,
  estimatedBytes: 0,
});
assert.equal(capacityFailureRuntime.fabric.canonicalSize(), 1600);
const capacityFailureBaselineIds = capacityFailureRuntime.fabric.canonicalSnapshot().items
  .map(item => item.id).sort();
const capacityFailureExportId = 'exp_0000000000009437';
const capacityFailureStagingId = 'wp437-capacity-failure-stage';
const capacityFailureToken = capacityFailureRuntime.memoryOS.captureHmxImportCompensation(
  capacityFailureExportId,
  capacityFailureStagingId,
);
assert.ok(capacityFailureToken);
const capacityFailureImported = capacityFailureRuntime.memoryOS.encode(
  makeInput('WP437 tokenized row must survive a failed capacity trim until rollback.', {
    id: 'wp437-imported-row',
    kind: 'identity',
    source: 'hexis:wp437:capacity-failure',
    tags: ['hexis-import', 'wp437'],
    context: { hexisExportId: capacityFailureExportId, hexisStagingId: capacityFailureStagingId },
    epistemicStatus: 'quarantined',
    provenanceClass: 'external',
    sourceAuthority01: .4,
    independenceKey: 'wp437:external-source',
  }),
  {
    clone: false,
    forceDistinct: true,
    hmxImportCompensationToken: capacityFailureToken,
    hmxImportCommandId: 'hexis-hmx:' + 'e'.repeat(48),
  },
);
assert.equal(capacityFailureRuntime.fabric.canonicalSize(), 1601);
const capacityFailurePreCommitIds = capacityFailureRuntime.fabric.canonicalSnapshot().items
  .map(item => item.id).sort();
assert.equal(capacityFailurePreCommitIds.includes(capacityFailureImported.id), true);
const originalCapacityTrim = capacityFailureRuntime.memoryOS.trimCanonicalItemCount;
capacityFailureRuntime.memoryOS.trimCanonicalItemCount = () => { throw new Error('injected-capacity-trim-failure'); };
assert.equal(
  capacityFailureRuntime.memoryOS.commitHmxImportCompensation(capacityFailureToken),
  false,
  'a capacity trim exception must fail the import commit closed',
);
delete capacityFailureRuntime.memoryOS.trimCanonicalItemCount;
assert.equal(capacityFailureRuntime.memoryOS.hasHmxImportCompensation(capacityFailureToken), true);
assert.deepEqual(
  capacityFailureRuntime.fabric.canonicalSnapshot().items.map(item => item.id).sort(),
  capacityFailurePreCommitIds,
  'failure-atomic capacity commit must preserve all 1,601 rows for the enclosing rollback',
);
assert.deepEqual(
  capacityFailureRuntime.fabric.canonicalSnapshot().items.filter(item => capacityFailureBaselineIds.includes(item.id))
    .map(item => item.id).sort(),
  capacityFailureBaselineIds,
);
const capacityFailureRollback = capacityFailureRuntime.memoryOS.rollbackHmxImportMemory(
  capacityFailureImported.id, capacityFailureToken,
);
assert.equal(capacityFailureRollback?.removed, true);
assert.equal(capacityFailureRuntime.memoryOS.discardHmxImportCompensation(capacityFailureToken), true);
assert.deepEqual(
  capacityFailureRuntime.fabric.canonicalSnapshot().items.map(item => item.id).sort(),
  capacityFailureBaselineIds,
  'the enclosing rollback must return to the exact 1,600-row baseline after trim failure',
);
// Also exercise a partial trim that reports false (rather than throwing). The
// failing trim deletes an old row first; commit must restore it with the added row.
const capacityFalseExportId = 'exp_0000000000009438';
const capacityFalseStagingId = 'wp437-capacity-false-stage';
const capacityFalseToken = capacityFailureRuntime.memoryOS.captureHmxImportCompensation(
  capacityFalseExportId,
  capacityFalseStagingId,
);
assert.ok(capacityFalseToken);
const capacityFalseImported = capacityFailureRuntime.memoryOS.encode(
  makeInput('WP437 return-false trim must restore every row before rollback.', {
    id: 'wp437-imported-row-return-false',
    kind: 'identity',
    source: 'hexis:wp437:capacity-false',
    tags: ['hexis-import', 'wp437'],
    context: { hexisExportId: capacityFalseExportId, hexisStagingId: capacityFalseStagingId },
    epistemicStatus: 'quarantined',
    provenanceClass: 'external',
    sourceAuthority01: .4,
    independenceKey: 'wp437:external-source-false',
  }),
  {
    clone: false,
    forceDistinct: true,
    hmxImportCompensationToken: capacityFalseToken,
    hmxImportCommandId: 'hexis-hmx:' + 'f'.repeat(48),
  },
);
const capacityFalsePreCommitIds = capacityFailureRuntime.fabric.canonicalSnapshot().items
  .map(item => item.id).sort();
const capacityFalseOldestId = capacityFailureRuntime.memoryOS.snapshot({ clone: false }).items.at(-1)?.id;
assert.ok(capacityFalseOldestId);
capacityFailureRuntime.memoryOS.trimCanonicalItemCount = () => {
  assert.equal(capacityFailureRuntime.memoryOS.forgetById(capacityFalseOldestId, 'wp437-injected-partial-trim'), true);
  return false;
};
assert.equal(
  capacityFailureRuntime.memoryOS.commitHmxImportCompensation(capacityFalseToken),
  false,
  'a trim that partially mutates then returns false must abort the transaction commit',
);
delete capacityFailureRuntime.memoryOS.trimCanonicalItemCount;
assert.equal(capacityFailureRuntime.memoryOS.hasHmxImportCompensation(capacityFalseToken), true);
assert.deepEqual(
  capacityFailureRuntime.fabric.canonicalSnapshot().items.map(item => item.id).sort(),
  capacityFalsePreCommitIds,
  'return-false trim failure must restore both the old row and the temporary imported row',
);
assert.equal(
  capacityFailureRuntime.memoryOS.rollbackHmxImportMemory(capacityFalseImported.id, capacityFalseToken)?.removed,
  true,
);
assert.equal(capacityFailureRuntime.memoryOS.discardHmxImportCompensation(capacityFalseToken), true);
assert.deepEqual(
  capacityFailureRuntime.fabric.canonicalSnapshot().items.map(item => item.id).sort(),
  capacityFailureBaselineIds,
  'rollback after a partial false-return trim must recover the original 1,600 row IDs',
);
void originalCapacityTrim;

// WorkPass440: removing a canonical row invalidates the derived semantic-support cache
// even when no linkUpdates counter changed, so retrieval cannot score against evicted links.
const linkSupportCacheRuntime = new MemorySubsystemRuntime();
const linkSupportCacheTarget = linkSupportCacheRuntime.fabric.encode(
  makeInput('WP440 cache target row must no longer contribute semantic support.'),
  { commandId: 'wp440:cache-target' },
);
const linkSupportCacheSource = linkSupportCacheRuntime.fabric.encode(
  makeInput('WP440 source row points to the target through a canonical semantic link.', {
    semanticLinks: [linkSupportCacheTarget.id],
    predictionError: .9,
  }),
  { commandId: 'wp440:cache-source' },
);
assert.ok(linkSupportCacheSource?.id);
linkSupportCacheRuntime.memoryOS.retrieve('WP440 source row points to the target', 4);
assert.ok(linkSupportCacheRuntime.memoryOS.linkSupportCache instanceof Map,
  'retrieval must materialize the derived semantic-support cache');
assert.equal(linkSupportCacheRuntime.memoryOS.linkSupportCache.get(linkSupportCacheTarget.id), .18,
  'the target should initially receive the source row semantic-support contribution');
const linkCacheVersionBeforeRemoval = linkSupportCacheRuntime.memoryOS.linkSupportCacheVersion;
assert.equal(linkSupportCacheRuntime.fabric.forgetById(linkSupportCacheTarget.id, 'workpass440-cache-invalidation'), true);
assert.equal(linkSupportCacheRuntime.memoryOS.linkSupportCache, null,
  'removing a canonical target must invalidate cached semantic support');
assert.equal(linkSupportCacheRuntime.memoryOS.linkSupportCacheVersion, -1,
  'cache invalidation must not depend on the linkUpdates counter changing');
assert.equal(linkCacheVersionBeforeRemoval, linkSupportCacheRuntime.memoryOS.snapshot().linkUpdates,
  'the regression must cover removal without a linkUpdates version bump');

console.log(JSON.stringify({
  ok: true,
  canonicalItems: restored.memoryOS.size(),
  revisionCount: restored.memoryOS.temporalChain(seed.id).length,
  receiptCount: restored.fabric.snapshot().mutationReceipts.length,
  replayEventDelta,
  canonicalAuthority: restored.fabric.inspect().canonicalAuthority,
}));
