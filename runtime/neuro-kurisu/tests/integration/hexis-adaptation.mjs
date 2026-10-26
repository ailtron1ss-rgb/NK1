import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { HexisRemoteApiBridge, HexisRemoteBridgeError, parseHexisRemoteApiConfig } from '../../src/organism/integration/hexis/HexisRemoteApiBridge.ts';
import { buildNk1HmxV17Document, normalizeHmxV17Memory, snapshotAndValidateHmxV17Document, validateHmxV17Document } from '../../src/organism/integration/hexis/HexisHmxV17Adapter.ts';
import { applyHmxMemoryBatchAtomically } from '../../src/organism/integration/hexis/HexisHmxImportTransaction.ts';

const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

// Batch application must roll canonical memory and the mutation-receipt ledger
// back together if any encode throws after making an observable side effect.
let transactionItems = [{ id: 'existing' }];
let transactionReceipts = ['before'];
const transactionPorts = {
  snapshotMemory: () => structuredClone(transactionItems),
  restoreMemory: snapshot => { transactionItems = structuredClone(snapshot); },
  snapshotLifecycle: () => structuredClone(transactionReceipts),
  restoreLifecycle: snapshot => { transactionReceipts = structuredClone(snapshot); },
  encode: (input, commandId) => {
    transactionItems.push({ id: input.id });
    transactionReceipts.push(commandId);
    if (input.fail === true) throw new Error('test failure after partial mutation');
    return { id: input.id };
  },
};
const rolledBack = applyHmxMemoryBatchAtomically(transactionPorts, [
  { input: { id: 'new-one' }, commandId: 'test:one' },
  { input: { id: 'failure', fail: true }, commandId: 'test:failure' },
], ['existing']);
assert.equal(rolledBack.outcome, 'rolled-back');
assert.equal(rolledBack.created, 0);
assert.deepEqual(rolledBack.createdIds, [], 'rolled-back record IDs must not be exposed as committed events');
assert.deepEqual(transactionItems, [{ id: 'existing' }]);
assert.deepEqual(transactionReceipts, ['before']);

const committed = applyHmxMemoryBatchAtomically({
  snapshotMemory: () => structuredClone(transactionItems),
  restoreMemory: snapshot => { transactionItems = structuredClone(snapshot); },
  snapshotLifecycle: () => structuredClone(transactionReceipts),
  restoreLifecycle: snapshot => { transactionReceipts = structuredClone(snapshot); },
  encode: (input, commandId) => {
    const prior = transactionItems.find(row => row.id === input.id);
    if (!prior) transactionItems.push({ id: input.id });
    transactionReceipts.push(commandId);
    return { id: input.id };
  },
}, [
  { input: { id: 'new-one' }, commandId: 'test:success-one' },
  { input: { id: 'existing' }, commandId: 'test:reuse-existing' },
], ['existing']);
assert.equal(committed.outcome, 'committed');
assert.equal(committed.created, 1);
assert.equal(committed.reused, 1);
assert.deepEqual(committed.createdIds, ['new-one'], 'only committed new IDs may feed the batch audit event');
assert(transactionItems.some(row => row.id === 'new-one'));

let incompleteItems = [];
let incompleteReceipts = [];
const rollbackIncomplete = applyHmxMemoryBatchAtomically({
  snapshotMemory: () => structuredClone(incompleteItems),
  restoreMemory: () => { throw new Error('simulated memory restore failure'); },
  snapshotLifecycle: () => structuredClone(incompleteReceipts),
  restoreLifecycle: snapshot => { incompleteReceipts = structuredClone(snapshot); },
  encode: (input, commandId) => {
    incompleteItems.push({ id: input.id });
    incompleteReceipts.push(commandId);
    if (input.fail === true) throw new Error('simulated encode failure');
    return { id: input.id };
  },
}, [
  { input: { id: 'survived-uncertainly' }, commandId: 'test:partial-one' },
  { input: { id: 'failure', fail: true }, commandId: 'test:partial-two' },
], []);
assert.equal(rollbackIncomplete.outcome, 'rollback-incomplete');
assert.equal(rollbackIncomplete.reason, 'rollback-failed');
assert.equal(rollbackIncomplete.created, 1, 'incomplete rollback must not be reported as a clean skip');
assert.deepEqual(rollbackIncomplete.createdIds, ['survived-uncertainly'], 'incomplete rollback exposes potentially surviving IDs only with rollback-incomplete status');


const first = fabric.reviseBelief({ memoryId:'mem-1', confidence01:.5, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(first.applied, true);
assert(first.posteriorConfidence01 > .5);
const duplicate = fabric.reviseBelief({ memoryId:'mem-1', confidence01:first.posteriorConfidence01, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(duplicate.applied, false);
assert.equal(duplicate.reason, 'duplicate_source');

const t1 = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'alpha',confidence01:.7,validFrom:1000,source:'test',value:'alpha'});
fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'beta',confidence01:.8,validFrom:2000,source:'test',value:'beta'});
assert.equal(fabric.temporalAt('mem-1',1500)?.valueHash, t1.valueHash);
assert.equal(fabric.temporalAt('mem-1',2500)?.summary, 'beta');
assert.equal(fabric.temporalDiff('mem-1',1500,2500).changed, true);

const review = fabric.createLearningReview({periodStart:0,periodEnd:1,summary:'test review',items:[{kind:'semantic_belief',title:'x',content:'y',sourceMemoryId:'mem-1',evidence:{}}]});
const decided = fabric.decideLearningReview(review.id,review.items[0].id,'approve');
assert.equal(decided?.status,'approved');

const validHmx = {
  hmx_version: '1.7',
  export_id: 'exp_0123456789abcdef',
  export_intent: 'telepathy',
  exported_at: '2026-10-26T10:00:00.000Z',
  source: {
    instance_id: 'hexis-test-instance',
    schema_version: '1.7',
    embedding_model: 'test-embedding',
    embedding_dimension: 2,
    hexis_lineage_id: 'hexis-test-lineage',
  },
  sections: {
    memories: [{
      ref: 'exp_0123456789abcdef:memory:1',
      type: 'semantic',
      content: 'A canonical imported fact.',
      trust_level: 0.82,
      importance: 0.73,
      created_at: '2026-10-20T10:00:00.000Z',
      updated_at: '2026-10-25T10:00:00.000Z',
      valid_from: '2026-10-20T10:00:00.000Z',
      valid_until: null,
      access_count: 3,
      last_accessed: null,
      source_attribution: { origin: 'test' },
      metadata: { nk1_kind: 'semantic', nk1_confidence: 0.77, nk1_salience: 0.71, nk1_epistemic_status: 'belief', tags: ['external'], context: { topic: 'hexis', ignoredObject: { secret: 'dropped' } }, entities: ['NK1'] },
      provenance: { acquisition_mode: 'experienced', origin_instance: 'hexis-test-lineage' },
    }],
  },
};
assert.deepEqual(validateHmxV17Document(validHmx, 'telepathy'), []);

// The staging path needs both the safely detached input and its schema issues.
// This combined boundary must return one owned snapshot and validate that exact
// value; public validateHmxV17Document still accepts arbitrary raw inputs safely.
const combinedHmxValidation = snapshotAndValidateHmxV17Document(validHmx, 'telepathy');
assert.equal(combinedHmxValidation.ok, true);
if (combinedHmxValidation.ok) {
  assert.deepEqual(combinedHmxValidation.issues, []);
  assert.notEqual(combinedHmxValidation.value, validHmx,
    'combined validation must return a detached snapshot, never the caller object');
  assert.deepEqual(combinedHmxValidation.value, validHmx);
}
let combinedValidationGetterCalls = 0;
const accessorCombinedHmx = { ...validHmx };
Object.defineProperty(accessorCombinedHmx, 'export_intent', {
  enumerable: true,
  get() { combinedValidationGetterCalls += 1; return 'telepathy'; },
});
const rejectedCombinedHmx = snapshotAndValidateHmxV17Document(accessorCombinedHmx, 'telepathy');
assert.equal(rejectedCombinedHmx.ok, false);
if (!rejectedCombinedHmx.ok) assert.equal(rejectedCombinedHmx.issue.kind, 'unsafe-input');
assert.equal(combinedValidationGetterCalls, 0,
  'combined capture-and-validate must reject accessors without evaluating them');

// Malformed-but-JSON metadata must produce validation issues or a null projection,
// never a TypeError during string/number coercion of a null-prototype snapshot.
const malformedIntentHmx = { ...validHmx, export_intent: Object.create(null) };
assert.doesNotThrow(() => validateHmxV17Document(malformedIntentHmx, 'telepathy'));
assert(validateHmxV17Document(malformedIntentHmx, 'telepathy').some(issue =>
  issue.path === 'export_intent' && issue.kind === 'schema'));

const malformedPrivacyHmx = {
  ...validHmx,
  privacy: {
    redaction_policy: Object.create(null),
    contains_sensitive_content: false,
    consent_scope: Object.create(null),
  },
};
assert.doesNotThrow(() => validateHmxV17Document(malformedPrivacyHmx, 'telepathy'));
const malformedPrivacyIssues = validateHmxV17Document(malformedPrivacyHmx, 'telepathy');
assert(malformedPrivacyIssues.some(issue => issue.path === 'privacy.redaction_policy' && issue.kind === 'schema'));
assert(malformedPrivacyIssues.some(issue => issue.path === 'privacy.consent_scope' && issue.kind === 'schema'));

const malformedMetadataHmx = {
  ...validHmx,
  sections: {
    memories: [{
      ...validHmx.sections.memories[0],
      metadata: {
        ...validHmx.sections.memories[0].metadata,
        nk1_kind: Object.create(null),
        nk1_confidence: Object.create(null),
        tags: [Object.create(null)],
      },
    }],
  },
};
assert.doesNotThrow(() => validateHmxV17Document(malformedMetadataHmx, 'telepathy'));
const malformedMetadataIssues = validateHmxV17Document(malformedMetadataHmx, 'telepathy');
assert(malformedMetadataIssues.some(issue => issue.path.endsWith('.metadata.nk1_kind') && issue.kind === 'schema'));
assert(malformedMetadataIssues.some(issue => issue.path.endsWith('.metadata.nk1_confidence') && issue.kind === 'schema'));
assert(malformedMetadataIssues.some(issue => issue.path.endsWith('.metadata.tags') && issue.kind === 'schema'));

const malformedMetadataStageFabric = new HexisAdaptationFabric();
const malformedMetadataStage = malformedMetadataStageFabric.stageHmx({
  document: malformedMetadataHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert(malformedMetadataStage.conflicts.length > 0,
  'malformed trust metadata must be exposed as stage conflicts');
assert.equal(malformedMetadataStage.stagedSections.memories, undefined,
  'the full memory section containing a schema conflict must be omitted atomically');
assert.equal(malformedMetadataStageFabric.decideHmx(malformedMetadataStage.stagingId, 'accept')?.status, 'staged',
  'malformed metadata cannot be accepted into canonical memory');


const malformedTypeHmx = {
  ...validHmx,
  sections: {
    memories: [{
      ...validHmx.sections.memories[0],
      type: Object.create(null),
    }],
  },
};
assert.doesNotThrow(() => validateHmxV17Document(malformedTypeHmx, 'telepathy'));
assert(validateHmxV17Document(malformedTypeHmx, 'telepathy').some(issue =>
  issue.path.endsWith('.type') && issue.kind === 'schema'));

const malformedProjectionRow = {
  ...validHmx.sections.memories[0],
  metadata: { ...validHmx.sections.memories[0].metadata, nk1_confidence: Object.create(null) },
};
assert.doesNotThrow(() => normalizeHmxV17Memory(malformedProjectionRow, {
  exportId: validHmx.export_id,
  sourceSubjectId: validHmx.source.hexis_lineage_id,
}));
assert.equal(normalizeHmxV17Memory(malformedProjectionRow, {
  exportId: validHmx.export_id,
  sourceSubjectId: validHmx.source.hexis_lineage_id,
}), null);

const malformedAuthorityHmx = {
  ...validHmx,
  sections: {
    memories: [{
      ...validHmx.sections.memories[0],
      source_attribution: { source_authority_01: Object.create(null) },
    }],
  },
};
assert.doesNotThrow(() => validateHmxV17Document(malformedAuthorityHmx, 'telepathy'));
assert(validateHmxV17Document(malformedAuthorityHmx, 'telepathy').some(issue =>
  issue.path.endsWith('.source_attribution.source_authority_01') && issue.kind === 'schema'));

const malformedSourceAttributionHmx = {
  ...validHmx,
  sections: {
    memories: [{
      ...validHmx.sections.memories[0],
      source_attribution: 'unknown-source-object',
    }],
  },
};
assert.doesNotThrow(() => validateHmxV17Document(malformedSourceAttributionHmx, 'telepathy'));
assert(validateHmxV17Document(malformedSourceAttributionHmx, 'telepathy').some(issue =>
  issue.path.endsWith('.source_attribution') && issue.kind === 'schema'));
assert.equal(normalizeHmxV17Memory(malformedSourceAttributionHmx.sections.memories[0], {
  exportId: validHmx.export_id,
  sourceSubjectId: validHmx.source.hexis_lineage_id,
}), null, 'malformed source attribution must not be downgraded to a source-less memory');

const overlongRefHmx = {
  ...validHmx,
  sections: {
    memories: [{
      ...validHmx.sections.memories[0],
      ref: validHmx.export_id + ':' + 'x'.repeat(520),
    }],
  },
};
assert(validateHmxV17Document(overlongRefHmx, 'telepathy').some(issue =>
  issue.path.endsWith('.ref') && issue.kind === 'schema'));



// The adaptation fabric enforces the enum contract independently of the HTTP
// route, so internal callers cannot create malformed or preview-only surprise stages.
const invalidHmxModesFabric = new HexisAdaptationFabric();
assert.throws(() => invalidHmxModesFabric.stageHmx({
  document: validHmx,
  intent: 'telepahy',
  strategy: 'additive',
}), /hmx-invalid-intent/);
assert.throws(() => invalidHmxModesFabric.stageHmx({
  document: validHmx,
  intent: 'telepathy',
  strategy: 'unrestricted',
}), /hmx-invalid-strategy/);
assert.equal(invalidHmxModesFabric.snapshot().hmxStages.length, 0,
  'invalid mode values must be refused before creating a stage or incrementing stage state');

let stageEnvelopeIntentGetterCalls = 0;
const accessorIntentRequest = { document: validHmx, strategy: 'additive' };
Object.defineProperty(accessorIntentRequest, 'intent', {
  enumerable: true,
  get() { stageEnvelopeIntentGetterCalls += 1; return 'telepathy'; },
});
assert.throws(() => invalidHmxModesFabric.stageHmx(accessorIntentRequest), /hmx-unsafe-stage-request/);
assert.equal(stageEnvelopeIntentGetterCalls, 0,
  'the stage envelope intent accessor must never run');

let stageEnvelopeDocumentGetterCalls = 0;
const accessorDocumentRequest = { intent: 'telepathy', strategy: 'additive' };
Object.defineProperty(accessorDocumentRequest, 'document', {
  enumerable: true,
  get() { stageEnvelopeDocumentGetterCalls += 1; return validHmx; },
});
assert.throws(() => invalidHmxModesFabric.stageHmx(accessorDocumentRequest), /hmx-unsafe-stage-request/);
assert.equal(stageEnvelopeDocumentGetterCalls, 0,
  'the stage envelope document accessor must never run');
assert.equal(invalidHmxModesFabric.snapshot().hmxStages.length, 0,
  'unsafe request envelopes must be rejected before staging or metric mutation');



// HMX ingress owns a detached snapshot. Removing redundant intermediate
// deep copies is safe only while both caller input and returned stage remain isolated.
const isolationFabric = new HexisAdaptationFabric();
const mutableHmxSource = structuredClone(validHmx);
const isolatedStage = isolationFabric.stageHmx({
  document: mutableHmxSource,
  intent: 'telepathy',
  strategy: 'additive',
});
mutableHmxSource.sections.memories[0].content = 'Mutated after stage creation.';
assert.equal(
  isolationFabric.getHmxStage(isolatedStage.stagingId)?.stagedSections.memories[0].content,
  'A canonical imported fact.',
  'the detached ingress snapshot must not alias the caller document',
);
isolatedStage.stagedSections.memories[0].content = 'Mutated from returned stage clone.';
assert.equal(
  isolationFabric.getHmxStage(isolatedStage.stagingId)?.stagedSections.memories[0].content,
  'A canonical imported fact.',
  'mutating the returned stage clone must not mutate persisted staging state',
);

// Stage HMX arrays atomically: over-capacity or malformed source data must
// not leave a misleading valid-looking prefix in stagedSections.// Stage HMX arrays atomically: over-capacity or malformed source data must
// not leave a misleading valid-looking prefix in stagedSections.
const oversizedExportId = 'exp_3333333333333333';
const oversizedHmx = {
  ...validHmx,
  export_id: oversizedExportId,
  sections: {
    memories: Array.from({ length: 257 }, (_, index) => ({
      ref: oversizedExportId + ':memory:' + index,
      type: 'semantic',
      content: 'Bounded fixture memory ' + index,
    })),
  },
};
const oversizedStage = fabric.stageHmx({
  document: oversizedHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert(oversizedStage.conflicts.some(issue => issue.kind === 'staging-capacity'));
assert.equal(oversizedStage.sectionCounts.memories, 257, 'diagnostics preserve the full source count');
assert.equal(oversizedStage.stagedSections.memories, undefined, 'oversized sections are omitted rather than truncated');
assert.equal(fabric.decideHmx(oversizedStage.stagingId, 'accept')?.status, 'staged',
  'a conflicted oversized section must not be accepted');

const malformedHmx = structuredClone(validHmx);
malformedHmx.export_id = 'exp_4444444444444444';
malformedHmx.sections.memories.push(null);
const malformedStage = fabric.stageHmx({
  document: malformedHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert(malformedStage.conflicts.some(issue => issue.kind === 'schema'));
assert.equal(malformedStage.sectionCounts.memories, 2);
assert.equal(malformedStage.stagedSections.memories, undefined, 'one malformed row omits the entire source section');
assert.equal(fabric.decideHmx(malformedStage.stagingId, 'accept')?.status, 'staged',
  'a malformed section cannot enter canonical memory');

// HMX validation and staging must inspect data descriptors, not execute getters.
const accessorCases = [
  {
    name: 'root-export-id',
    create(onRead) {
      const document = { ...validHmx };
      Object.defineProperty(document, 'export_id', {
        enumerable: true,
        configurable: true,
        get() { onRead(); return 'exp_0123456789abcdef'; },
      });
      return document;
    },
  },
  {
    name: 'nested-memories',
    create(onRead) {
      const document = structuredClone(validHmx);
      Object.defineProperty(document.sections, 'memories', {
        enumerable: true,
        configurable: true,
        get() { onRead(); return validHmx.sections.memories; },
      });
      return document;
    },
  },
];
for (const accessorCase of accessorCases) {
  let getterReads = 0;
  const accessorDocument = accessorCase.create(() => { getterReads += 1; });
  const issues = validateHmxV17Document(accessorDocument, 'telepathy');
  assert(issues.some(issue => issue.kind === 'unsafe-input'),
    `${accessorCase.name}: accessor-backed HMX must be rejected`);
  assert.equal(getterReads, 0, `${accessorCase.name}: validation must not execute getters`);

  const accessorStage = fabric.stageHmx({
    document: accessorDocument,
    intent: 'telepathy',
    strategy: 'additive',
  });
  assert(accessorStage.conflicts.some(issue => issue.kind === 'unsafe-input'),
    `${accessorCase.name}: staging must retain an explicit unsafe-input conflict`);
  assert.equal(getterReads, 0, `${accessorCase.name}: staging must not execute getters`);
  assert.equal(accessorStage.stagedSections.memories, undefined,
    `${accessorCase.name}: rejected source must not leave a staged memory payload`);
  assert.equal(fabric.decideHmx(accessorStage.stagingId, 'accept')?.status, 'staged',
    `${accessorCase.name}: unsafe input must remain ineligible for acceptance`);
}

// A pending HMX receipt must still be intact after persistence restore.
const integrityFabric = new HexisAdaptationFabric();
const integrityPending = integrityFabric.stageHmx({
  document: validHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert.equal(integrityPending.conflicts.length, 0);
const corruptedPersistence = integrityFabric.snapshot();
const corruptedPending = corruptedPersistence.hmxStages.find(row => row.stagingId === integrityPending.stagingId);
assert.ok(corruptedPending);
corruptedPending.stagedSections.memories[0].content = 'Tampered after review, before acceptance.';
const restoredIntegrityFabric = new HexisAdaptationFabric();
restoredIntegrityFabric.restore(corruptedPersistence);
const restoredCorruptedStage = restoredIntegrityFabric.getHmxStage(integrityPending.stagingId);
assert.equal(restoredCorruptedStage?.status, 'rejected',
  'a stale digest must quarantine a pending stage on restore');
assert(restoredCorruptedStage?.conflicts.some(issue =>
  issue.kind === 'persisted-stage-integrity-failure' &&
  issue.detail.includes('persisted-stage-digest-mismatch')));
assert.equal(restoredIntegrityFabric.decideHmx(integrityPending.stagingId, 'accept')?.status, 'rejected',
  'an altered pending stage must never reach canonical apply');

// A valid stage with ordinary validation conflicts remains staged for operator
// inspection; this is different from a stale/tampered persistence receipt.
const validConflictRestoreFabric = new HexisAdaptationFabric();
const conflictStage = validConflictRestoreFabric.stageHmx({
  document: { ...validHmx, sections: { ...validHmx.sections, identity: [{ id: 'protected' }] } },
  intent: 'telepathy',
  strategy: 'additive',
});
const conflictRestoredFabric = new HexisAdaptationFabric();
conflictRestoredFabric.restore(validConflictRestoreFabric.snapshot());
assert.equal(conflictRestoredFabric.getHmxStage(conflictStage.stagingId)?.status, 'staged');
assert.equal(conflictRestoredFabric.decideHmx(conflictStage.stagingId, 'accept')?.status, 'staged',
  'a validly digested stage with source-validation conflicts remains available for review');

// If the process stopped after HMX acceptance but before the import receipt was
// persisted, restore must terminally quarantine the result instead of replaying
// an accepted stage whose canonical-memory side effects are not known.
const interruptedFabric = new HexisAdaptationFabric();
const interruptedStage = interruptedFabric.stageHmx({
  document: validHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert.equal(interruptedStage.conflicts.length, 0);
assert.equal(interruptedFabric.decideHmx(interruptedStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(interruptedFabric.getHmxStage(interruptedStage.stagingId)?.importResult?.status, 'pending');
const interruptedSnapshot = interruptedFabric.snapshot();
const restoredInterruptedFabric = new HexisAdaptationFabric();
// Use the same JSON encoding boundary as persisted runtime state, not only an in-memory clone.
restoredInterruptedFabric.restore(JSON.parse(JSON.stringify(interruptedSnapshot)));
const restoredInterruptedStage = restoredInterruptedFabric.getHmxStage(interruptedStage.stagingId);
assert.equal(restoredInterruptedStage?.status, 'accepted',
  'the operator acceptance decision remains recorded');
assert.equal(restoredInterruptedStage?.importResult?.status, 'uncertain',
  'accepted+pending must be terminally uncertain after restore, never automatically retried');
assert.equal(restoredInterruptedStage?.importResult?.skipped, restoredInterruptedStage?.sectionCounts.memories,
  'the uncertain receipt conservatively accounts for every source row without claiming a success');
assert.equal(restoredInterruptedStage?.importResult?.reason, 'accepted-stage-import-interrupted-after-restore');
assert.equal(restoredInterruptedFabric.decideHmx(interruptedStage.stagingId, 'accept')?.importResult?.status, 'uncertain',
  'a repeated accept cannot turn an interrupted restore into a new import attempt');

// A reject sent after acceptance cannot turn an accepted+pending stage back
// into an apply-eligible result: the first decision may already have side effects.
const lateRejectFabric = new HexisAdaptationFabric();
const lateRejectStage = lateRejectFabric.stageHmx({
  document: validHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert.equal(lateRejectFabric.decideHmx(lateRejectStage.stagingId, 'accept')?.status, 'accepted');
const lateRejectResult = lateRejectFabric.decideHmx(lateRejectStage.stagingId, 'reject');
assert.equal(lateRejectResult?.status, 'accepted',
  'a reject received after acceptance cannot undo an already-recorded decision');
assert.equal(lateRejectResult?.importResult?.status, 'uncertain',
  'late reject must quarantine an accepted pending import rather than leave it apply-eligible');
assert.equal(lateRejectResult?.importResult?.reason, 'reject-request-after-accept-before-import-receipt');
assert.equal(lateRejectFabric.decideHmx(lateRejectStage.stagingId, 'accept')?.importResult?.status, 'uncertain',
  'subsequent accept must not replay a stage quarantined by a late reject');

// A repeated accept while the first import receipt is still pending is also
// ambiguous. It must close as uncertain before core can re-enter its apply gate.
const repeatAcceptFabric = new HexisAdaptationFabric();
const repeatAcceptStage = repeatAcceptFabric.stageHmx({
  document: validHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert.equal(repeatAcceptFabric.decideHmx(repeatAcceptStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(repeatAcceptFabric.getHmxStage(repeatAcceptStage.stagingId)?.importResult?.status, 'pending');
const repeatedAcceptance = repeatAcceptFabric.decideHmx(repeatAcceptStage.stagingId, 'accept');
assert.equal(repeatedAcceptance?.status, 'accepted');
assert.equal(repeatedAcceptance?.importResult?.status, 'uncertain',
  'duplicate accept cannot return an accepted+pending stage to the canonical apply path');
assert.equal(repeatedAcceptance?.importResult?.reason, 'repeat-accept-after-accept-before-import-receipt');
assert.equal(repeatAcceptFabric.decideHmx(repeatAcceptStage.stagingId, 'accept')?.importResult?.status, 'uncertain',
  'further repeated acceptance remains terminal and cannot replay');



// Tampering with an accepted stage before restore is also surfaced for review;
// it must not re-enable import merely because a new receipt was synthesized.
const interruptedTamperedSnapshot = interruptedFabric.snapshot();
const interruptedTampered = interruptedTamperedSnapshot.hmxStages.find(row => row.stagingId === interruptedStage.stagingId);
assert.ok(interruptedTampered);
interruptedTampered.stagedSections.memories[0].content = 'Mutated during an interrupted HMX import.';
const restoredTamperedInterruptedFabric = new HexisAdaptationFabric();
restoredTamperedInterruptedFabric.restore(JSON.parse(JSON.stringify(interruptedTamperedSnapshot)));
const restoredTamperedInterrupted = restoredTamperedInterruptedFabric.getHmxStage(interruptedStage.stagingId);
assert.equal(restoredTamperedInterrupted?.importResult?.status, 'uncertain');
assert(restoredTamperedInterrupted?.conflicts.some(issue =>
  issue.kind === 'persisted-stage-integrity-failure'));
assert.equal(restoredTamperedInterruptedFabric.decideHmx(interruptedStage.stagingId, 'accept')?.importResult?.status, 'uncertain');


// Untrusted section names must not mutate the prototypes of stage diagnostics.
const protoKeyHmx = structuredClone(validHmx);
Object.defineProperty(protoKeyHmx.sections, '__proto__', {
  enumerable: true,
  configurable: true,
  writable: true,
  value: [{ shouldNeverApply: true }],
});
const protoKeyStage = fabric.stageHmx({
  document: protoKeyHmx,
  intent: 'telepathy',
  strategy: 'additive',
});
assert(protoKeyStage.conflicts.some(issue =>
  issue.kind === 'unsupported-section' && issue.path === 'sections.__proto__'));
assert.equal(Object.getPrototypeOf(protoKeyStage.sectionCounts), null,
  'section counts must have no inherited keys');
assert.equal(Object.hasOwn(protoKeyStage.sectionCounts, '__proto__'), true,
  'the original untrusted section count remains diagnostic data');
assert.equal(protoKeyStage.sectionCounts['__proto__'], 1);
assert.equal(Object.getPrototypeOf(protoKeyStage.stagedSections), null,
  'staged section map must have no inherited setters');
assert.equal(Object.hasOwn(protoKeyStage.stagedSections, '__proto__'), false,
  'conflicted prototype-like section must not be staged');
assert.equal(fabric.decideHmx(protoKeyStage.stagingId, 'accept')?.status, 'staged',
  'prototype-like section remains blocked from acceptance');

// Reject other non-JSON shapes before they can reach schema mapping or memory apply.
const unsafeShapeCases = [
  {
    name: 'sparse-memory-array',
    create() {
      const document = structuredClone(validHmx);
      const sparse = [];
      sparse.length = 2;
      sparse[0] = document.sections.memories[0];
      document.sections.memories = sparse;
      return document;
    },
  },
  {
    name: 'cyclic-memory-metadata',
    create() {
      const document = structuredClone(validHmx);
      const cycle = {};
      cycle.self = cycle;
      document.sections.memories[0].metadata.context = cycle;
      return document;
    },
  },
  {
    name: 'non-finite-number',
    create() {
      const document = structuredClone(validHmx);
      document.source.embedding_dimension = Number.POSITIVE_INFINITY;
      return document;
    },
  },
  {
    name: 'non-plain-source-object',
    create() {
      const document = structuredClone(validHmx);
      document.source = Object.assign(Object.create({ inherited: true }), document.source);
      return document;
    },
  },
];
for (const unsafeCase of unsafeShapeCases) {
  const unsafeDocument = unsafeCase.create();
  const issues = validateHmxV17Document(unsafeDocument, 'telepathy');
  assert(issues.some(issue => issue.kind === 'unsafe-input'),
    `${unsafeCase.name}: non-JSON input must be rejected at the snapshot boundary`);
  const staged = fabric.stageHmx({
    document: unsafeDocument,
    intent: 'telepathy',
    strategy: 'additive',
  });
  assert(staged.conflicts.some(issue => issue.kind === 'unsafe-input'),
    `${unsafeCase.name}: staging must preserve the unsafe-input conflict`);
  assert.equal(staged.stagedSections.memories, undefined,
    `${unsafeCase.name}: unsafe input must not leave a partially staged memory section`);
  assert.equal(fabric.decideHmx(staged.stagingId, 'accept')?.status, 'staged',
    `${unsafeCase.name}: unsafe input must not be accepted`);
}

assert.equal(validateHmxV17Document(validHmx, 'port').some(issue => issue.kind === 'intent-mismatch'), true);
assert.equal(validateHmxV17Document({ ...validHmx, export_id: 'random-uuid' }, 'telepathy').some(issue => issue.path === 'export_id'), true);

const projection = normalizeHmxV17Memory(validHmx.sections.memories[0], {
  exportId: validHmx.export_id,
  sourceSubjectId: validHmx.source.hexis_lineage_id,
});
assert.equal(projection?.kind, 'semantic');
assert.equal(projection?.ref, validHmx.sections.memories[0].ref, 'source HMX reference survives normalization for provenance mapping');
assert.equal(projection?.confidence, 0.55, 'external memory confidence is capped before independent verification');
assert.equal(projection?.salience, 0.71);
assert.equal(projection?.sourceAuthority01, 0.55, 'self-reported external trust cannot boost source authority');
assert.equal(projection?.epistemicStatus, 'belief');
assert.equal(projection?.independenceKey, 'hexis:hexis-test-lineage');
const protectedMemoryDoc = structuredClone(validHmx);
protectedMemoryDoc.sections.memories[0].metadata.nk1_kind = 'identity';
assert(validateHmxV17Document(protectedMemoryDoc, 'telepathy').some(issue => issue.kind === 'protected-memory-record'));

assert.deepEqual(projection?.context, { topic: 'hexis' }, 'non-scalar imported context is discarded');

const unsafeSections = structuredClone(validHmx);
unsafeSections.sections.identity = [{ key: 'identity', content: 'must not auto-merge' }];
const unsafeStage = fabric.stageHmx({ document: unsafeSections, intent: 'telepathy', strategy: 'additive' });
assert(unsafeStage.conflicts.some(issue => issue.kind === 'protected-section'));
assert(unsafeStage.conflicts.some(issue => issue.path.startsWith('sections.identity')));
assert.equal(fabric.decideHmx(unsafeStage.stagingId, 'accept')?.status, 'staged', 'protected/unsupported sections cannot be accepted');

const stage = fabric.stageHmx({ document: validHmx, intent: 'telepathy', strategy: 'additive' });
assert.equal(stage.status, 'staged');
assert.equal(stage.applicationMode, 'memory-merge');
assert.equal(stage.importResult?.status, 'pending');
assert.equal(fabric.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
assert.equal(fabric.getHmxStage(stage.stagingId)?.importResult?.status, 'pending', 'fabric acceptance alone is not evidence that the canonical-memory import has been applied');
const invalidNanReceipt = fabric.recordHmxImportResult(stage.stagingId, { status: 'applied', created: Number.NaN, reused: 0, skipped: 0 });
assert.equal(invalidNanReceipt?.importResult?.status, 'pending',
  'non-finite import counts must not complete a receipt');
const invalidCountReceipt = fabric.recordHmxImportResult(stage.stagingId, { status: 'applied', created: 0, reused: 0, skipped: 0 });
assert.equal(invalidCountReceipt?.importResult?.status, 'pending',
  'receipt counts must account for every source memory record');
const invalidPartialReceipt = fabric.recordHmxImportResult(stage.stagingId, { status: 'partial', created: 1, reused: 0, skipped: 0 });
assert.equal(invalidPartialReceipt?.importResult?.status, 'pending',
  'partial status must describe a receipt that actually skipped source records');
const importRecorded = fabric.recordHmxImportResult(stage.stagingId, { status: 'applied', created: 1, reused: 0, skipped: 0 });
assert.equal(importRecorded?.importResult?.status, 'applied');
assert.equal(importRecorded?.importResult?.created, 1);
assert.equal(fabric.recordHmxImportResult(stage.stagingId, { status: 'applied', created: 10, reused: 0 })?.importResult?.created, 1, 'completed import receipts cannot be replayed to rewrite counts');

const uncertainStage = fabric.stageHmx({ document: validHmx, intent: 'telepathy', strategy: 'additive' });
assert.equal(uncertainStage.status, 'staged');
assert.equal(fabric.decideHmx(uncertainStage.stagingId, 'accept')?.status, 'accepted');
const uncertainReceipt = fabric.recordHmxImportResult(uncertainStage.stagingId, {
  // Core may know which encoder calls returned, but an incomplete rollback
  // makes the final canonical state uncertain even when all counts add up.
  status: 'partial',
  created: 0,
  reused: 0,
  skipped: 1,
  reason: 'memory-encode-failed-rollback-incomplete',
});
assert.equal(uncertainReceipt?.importResult?.status, 'uncertain',
  'incomplete rollback must be terminal and must never masquerade as ordinary partial success');
assert.equal(uncertainReceipt?.importResult?.created, 0);
assert.equal(uncertainReceipt?.importResult?.reused, 0);
assert.equal(uncertainReceipt?.importResult?.skipped, 1,
  'uncertain rollback receipt must still account for every source record');
const uncertainReplay = fabric.recordHmxImportResult(uncertainStage.stagingId, {
  status: 'applied', created: 1, reused: 0, skipped: 0,
});
assert.equal(uncertainReplay?.importResult?.status, 'uncertain',
  'a terminal uncertain receipt cannot be replayed into a false applied status');

const emptySnapshot = buildNk1HmxV17Document({ subjectId: 'nk1-empty', memories: [], exportedAt: Date.parse('2026-10-26T10:00:00.000Z') });
assert.match(String(emptySnapshot.export_id), /^exp_[0-9a-f]{16}$/);
assert.equal(emptySnapshot.export_intent, 'telepathy');
assert.deepEqual(validateHmxV17Document(emptySnapshot, 'telepathy'), [], 'valid empty memory snapshots remain exportable');

const exportSnapshot = buildNk1HmxV17Document({
  subjectId: 'nk1-test',
  exportedAt: Date.parse('2026-10-26T10:00:00.000Z'),
  memories: [{
    id: 'memory-7',
    content: 'exported memory',
    kind: 'semantic',
    confidence: 0.8,
    salience: 0.7,
    source: 'canonical-memory',
    sourceAuthority01: 0.75,
    createdAt: Date.parse('2026-10-20T10:00:00.000Z'),
    observedAt: Date.parse('2026-10-25T10:00:00.000Z'),
    validFromAt: Date.parse('2026-10-20T10:00:00.000Z'),
    validUntilAt: null,
    epistemicStatus: 'belief',
    dormant: false,
    retrievalCount: 2,
    tags: ['memory'],
    context: {
      channel: 'test' + String.fromCharCode(1) + 'context',
      ['bad' + String.fromCharCode(1) + 'key']: 'normalized-control-key',
      nested: { private: true },
    },
    entities: ['NK1'],
  }, {
    id: 'private-identity-memory',
    content: 'identity marker should never be included in an ordinary portable export',
    kind: 'identity',
    confidence: 1,
    salience: 1,
    source: 'self-model',
    epistemicStatus: 'belief',
    protectedBelief: true,
  }],
});
assert.deepEqual(validateHmxV17Document(exportSnapshot, 'telepathy'), []);
assert.equal(exportSnapshot.sections.memories[0].type, 'semantic');
assert.equal(exportSnapshot.sections.memories[0].trust_level, 0.75);
assert.equal(exportSnapshot.sections.memories.length, 1, 'protected self/identity memories are excluded from memory-only export');
assert.equal(exportSnapshot.sections.memories[0].metadata.context.nested, undefined);
assert.equal(exportSnapshot.sections.memories[0].metadata.context.channel, 'test context');
assert.equal(exportSnapshot.sections.memories[0].metadata.context.badkey, 'normalized-control-key');

const protectedStage = fabric.stageHmx({
  document: {
    ...validHmx,
    export_id: 'exp_abcdef0123456789',
    sections: {
      memories: validHmx.sections.memories,
      identity: [{ key: 'self', content: 'protected' }],
    },
  },
  intent: 'telepathy',
  strategy: 'analysis_only',
});
assert(protectedStage.conflicts.length > 0);
assert.equal(protectedStage.applicationMode, 'preview-only');
assert.equal(fabric.decideHmx(protectedStage.stagingId, 'accept')?.status, 'staged');


const assertedFact = normalizeHmxV17Memory({
  ...validHmx.sections.memories[0],
  trust_level: 1,
  metadata: { nk1_kind: 'semantic', nk1_confidence: 1, nk1_epistemic_status: 'fact' },
}, { exportId: validHmx.export_id, sourceSubjectId: validHmx.source.hexis_lineage_id });
assert.equal(assertedFact?.epistemicStatus, 'belief', 'untrusted HMX metadata cannot promote an imported record to fact');
assert.equal(assertedFact?.confidence, 0.55);
assert.equal(assertedFact?.sourceAuthority01, 0.55);

const mismatchedReference = structuredClone(validHmx);
mismatchedReference.sections.memories[0].ref = 'exp_fedcba9876543210:memory:foreign';
assert(validateHmxV17Document(mismatchedReference, 'telepathy').some(issue => issue.path.endsWith('.ref')));

const invalidTimestamp = structuredClone(validHmx);
invalidTimestamp.sections.memories[0].valid_until = 'not-a-date';
assert(validateHmxV17Document(invalidTimestamp, 'telepathy').some(issue => issue.path.endsWith('.valid_until')));
const invalidContentHash = structuredClone(validHmx);
invalidContentHash.sections.memories[0].content_hash_v1 = '0'.repeat(64);
assert(validateHmxV17Document(invalidContentHash, 'telepathy').some(issue => issue.kind === 'integrity'));


const out = fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}});
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{meta:{a:1,b:2},text:'x'}}).id,out.id);
const outConflict=fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'different logical action'}});
assert.equal(outConflict.ok,false,'same key must not alias a different outbox action');
assert.equal(outConflict.error,'idempotency-key-conflict');
assert.equal(outConflict.existingId,out.id);
const missingOutboxKey=fabric.enqueueOutbox({idempotencyKey:'',kind:'notify',channel:'telegram',payload:{text:'not safe without key'}});
assert.equal(missingOutboxKey.ok,false,'blank keys must not collapse unrelated messages');
assert.equal(missingOutboxKey.error,'idempotency-key-required');
assert.equal(fabric.claimOutbox(out.id)?.status,'publishing');
assert.equal(fabric.ackOutbox(out.id,true)?.status,'published');
// An identical logical action stays deduplicated even if the previous attempt reached a terminal state.
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{a:1,b:2}}}).id,out.id);
assert.equal(fabric.snapshot().metrics.outboxIdempotencyConflicts,1);
const failedOut=fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}});
for(let attempt=0;attempt<3;attempt++){assert.equal(fabric.claimOutbox(failedOut.id)?.status,'publishing');fabric.ackOutbox(failedOut.id,false,'synthetic-ambiguous-failure');}
assert.equal(fabric.snapshot().outbox.find(x=>x.id===failedOut.id)?.status,'failed');
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}}).id,failedOut.id,'failed terminal attempt must not create a second logical delivery');
const legacySnapshot=fabric.snapshot(); delete legacySnapshot.metrics.outboxIdempotencyConflicts;
const restoredLegacy=new HexisAdaptationFabric(); restoredLegacy.restore(legacySnapshot);
assert.equal(restoredLegacy.snapshot().metrics.outboxIdempotencyConflicts,0,'legacy snapshots receive the new metric default');
const restoredOutbox=new HexisAdaptationFabric(); restoredOutbox.restore(fabric.snapshot());
assert.equal(restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}}).id,out.id,'outbox idempotency survives snapshot/restore');
const restoredConflict=restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'after restore this must not alias'}});
assert.equal(restoredConflict.error,'idempotency-key-conflict');
assert.equal(restoredOutbox.snapshot().metrics.outboxIdempotencyConflicts,2,'outbox conflict telemetry survives snapshot/restore');

const policy = fabric.grantConnectorPolicy({connectorId:'telegram',actionKind:'send',contexts:['chat'],requiresApproval:true,allowedTargets:['123'],maxPerWindow:1,windowMs:60_000});
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123'}).allowed,false);
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123',confirmed:true}).allowed,true);
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123',confirmed:true}).reason,'policy-rate-limit');
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'999',confirmed:true}).allowed,false);
assert.equal(fabric.revokeConnectorPolicy(policy.id),true);

const exec = fabric.planExecution({actionKind:'code.execute',requestedPlacement:'local',risk01:.9});
assert.equal(exec.resolvedPlacement,'sandbox');
console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));


// Remote QuixiAI/Hexis is an optional peer, not a replacement memory owner.
// These tests keep it offline and verify explicit opt-in, transport/auth gates,
// bounded context projection, API compatibility and the non-evidence contract.
const disabledPeer = new HexisRemoteApiBridge({});
assert.equal(disabledPeer.config.enabled, false);
assert.equal(disabledPeer.config.consultEnabled, false);
assert.equal((await disabledPeer.status()).reason, 'not-configured');
await assert.rejects(
  () => disabledPeer.consult({ question: 'hello', confirmExternalConsult: true }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-disabled',
);

assert.throws(
  () => parseHexisRemoteApiConfig({ NK1_HEXIS_REMOTE_BASE_URL: 'http://hexis.example', NK1_HEXIS_REMOTE_API_KEY: 'key' }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-insecure-transport',
);
assert.throws(
  () => parseHexisRemoteApiConfig({ NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example', NK1_HEXIS_REMOTE_CONSULT_ENABLED: 'true' }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-auth-required',
);
assert.throws(
  () => parseHexisRemoteApiConfig({ NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example/path', NK1_HEXIS_REMOTE_API_KEY: 'key' }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-invalid-config',
);

let remoteCalls = [];
const fakeFetch = async (input, init = {}) => {
  const url = String(input);
  remoteCalls.push({ url, init });
  if (url.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', checks: { db: true } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  if (url.endsWith('/v1/models')) {
    return new Response(JSON.stringify({ data: [{ id: 'hexis-test-model' }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  if (url.endsWith('/v1/chat/completions')) {
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, 'hexis-test-model');
    assert.equal(body.stream, false);
    const forwarded = JSON.parse(body.messages[1].content);
    assert.equal(forwarded.question, 'Compare these two hypotheses.');
    assert.equal(forwarded.nk1_context.currentGoal, 'Improve recall');
    assert.equal(forwarded.nk1_context.privateNotes, undefined);
    assert.equal(forwarded.nk1_context.memoryCandidates[0].sourceRef, 'memory:17');
    return new Response(JSON.stringify({
      model: 'hexis-test-model',
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Hypothesis B fits the cited observation better.' } }],
      usage: { prompt_tokens: 31, completion_tokens: 12, total_tokens: 43 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fake Hexis URL');
};
const enabledPeer = new HexisRemoteApiBridge({
  NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example',
  NK1_HEXIS_REMOTE_API_KEY: 'test-secret-never-return-this',
  NK1_HEXIS_REMOTE_CONSULT_ENABLED: 'true',
}, { fetchImpl: fakeFetch });
assert.equal((await enabledPeer.status()).reachable, true);
const countBeforeUnconfirmed = remoteCalls.length;
await assert.rejects(
  () => enabledPeer.consult({ question: 'Do not forward this yet.' }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-confirmation-required',
);
assert.equal(remoteCalls.length, countBeforeUnconfirmed, 'missing external-send confirmation must not make a network call');

const peerResult = await enabledPeer.consult({
  question: 'Compare these two hypotheses.',
  confirmExternalConsult: true,
  context: {
    tick: 42,
    currentGoal: 'Improve recall',
    recentObservations: ['Holdout retrieval remains flat'],
    memoryCandidates: [{ id: 'memory:17', summary: 'Retrieval test summary', confidence01: 0.6, sourceRef: 'memory:17', privateNotes: 'must not pass' }],
    privateNotes: 'must not pass',
    accessToken: 'must not pass',
  },
});
assert.equal(peerResult.provider, 'QuixiAI/Hexis');
assert.equal(peerResult.response, 'Hypothesis B fits the cited observation better.');
assert.equal(peerResult.usage?.totalTokens, 43);
assert.equal(peerResult.advisoryOnly, true);
assert.equal(peerResult.externalAgentToolsMayRun, true);
assert.equal(peerResult.nk1StateChanged, false);
assert.equal(peerResult.eligibleAsVerifiedEvidence, false);
assert.match(peerResult.promotionPath, /HMX staging/);
assert.equal(remoteCalls.at(-1).init.redirect, 'error', 'bearer credentials must not follow redirects');
assert.equal(new Headers(remoteCalls.at(-1).init.headers).get('authorization'), 'Bearer test-secret-never-return-this');

const consultDisabledPeer = new HexisRemoteApiBridge({
  NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example',
  NK1_HEXIS_REMOTE_API_KEY: 'key',
  NK1_HEXIS_REMOTE_CONSULT_ENABLED: 'false',
}, { fetchImpl: fakeFetch });
const countBeforeDisabled = remoteCalls.length;
await assert.rejects(
  () => consultDisabledPeer.consult({ question: 'hello', confirmExternalConsult: true }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-consult-disabled',
);
assert.equal(remoteCalls.length, countBeforeDisabled, 'disabled consultation must not make a network call');


const localOnlyConfig = parseHexisRemoteApiConfig({
  NK1_HEXIS_REMOTE_BASE_URL: 'http://127.0.0.1:43817',
});
assert.equal(localOnlyConfig.enabled, true, 'loopback development peer may use plaintext HTTP');
assert.equal(localOnlyConfig.consultEnabled, false, 'configuring the URL alone does not enable consultations');

const unauthorizedPeer = new HexisRemoteApiBridge({
  NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example',
  NK1_HEXIS_REMOTE_API_KEY: 'key',
}, { fetchImpl: async () => new Response('upstream auth denied as plain text', { status: 401 }) });
assert.equal((await unauthorizedPeer.status()).reason, 'hexis-remote-auth-failed', 'auth errors must be classified from status, not response JSON');

const unhealthyPeer = new HexisRemoteApiBridge({
  NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example',
  NK1_HEXIS_REMOTE_API_KEY: 'key',
}, { fetchImpl: async () => new Response(JSON.stringify({ status: 'ok', checks: { db: 'unknown' } }), { status: 200 }) });
assert.equal((await unhealthyPeer.status()).reachable, false, 'a non-boolean database health result cannot pass the health gate');

const boundedPeer = new HexisRemoteApiBridge({
  NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example',
  NK1_HEXIS_REMOTE_API_KEY: 'key',
  NK1_HEXIS_REMOTE_CONSULT_ENABLED: 'true',
}, { fetchImpl: async () => { throw new Error('request should have been rejected before network'); } });
await assert.rejects(
  () => boundedPeer.consult({ question: 'x'.repeat(6001), confirmExternalConsult: true }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-question-too-long',
);
await assert.rejects(
  () => boundedPeer.consult({
    question: 'Summarize the candidate set.',
    confirmExternalConsult: true,
    context: {
      memoryCandidates: Array.from({ length: 8 }, (_, index) => ({
        id: 'memory-' + index + '-'.repeat(100),
        summary: 's'.repeat(500),
        sourceRef: 'source-' + 'r'.repeat(190),
      })),
    },
  }),
  (error) => error instanceof HexisRemoteBridgeError && error.code === 'hexis-remote-context-too-large',
);

const oversizedPeer = new HexisRemoteApiBridge({
  NK1_HEXIS_REMOTE_BASE_URL: 'https://hexis.example',
  NK1_HEXIS_REMOTE_API_KEY: 'key',
}, { fetchImpl: async () => new Response('x'.repeat(260 * 1024), { status: 200 }) });
assert.equal((await oversizedPeer.status()).reason, 'hexis-remote-response-too-large', 'oversized peer responses must be rejected');

console.log('HEXIS_REMOTE_API_BRIDGE_PASS');
