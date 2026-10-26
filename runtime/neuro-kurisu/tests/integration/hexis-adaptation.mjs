import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { HexisRemoteApiBridge, HexisRemoteBridgeError, parseHexisRemoteApiConfig } from '../../src/organism/integration/hexis/HexisRemoteApiBridge.ts';
import { buildNk1HmxV17Document, normalizeHmxV17Memory, validateHmxV17Document } from '../../src/organism/integration/hexis/HexisHmxV17Adapter.ts';

const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

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

// Stage HMX arrays atomically: over-capacity or malformed source data must
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
assert(unsafeStage.conflicts.some(issue => issue.kind === 'unsupported-import-section'));
assert(unsafeStage.conflicts.some(issue => issue.kind === 'protected-by-intent'));
assert.equal(fabric.decideHmx(unsafeStage.stagingId, 'accept')?.status, 'staged', 'protected/unsupported sections cannot be accepted');

const stage = fabric.stageHmx({ document: validHmx, intent: 'telepathy', strategy: 'additive' });
assert.equal(stage.status, 'staged');
assert.equal(stage.applicationMode, 'memory-merge');
assert.equal(stage.importResult?.status, 'pending');
assert.equal(fabric.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
assert.equal(fabric.getHmxStage(stage.stagingId)?.importResult?.status, 'pending', 'fabric acceptance alone is not evidence that the canonical-memory import has been applied');
const importRecorded = fabric.recordHmxImportResult(stage.stagingId, { status: 'applied', created: 1, reused: 0, skipped: 0 });
assert.equal(importRecorded?.importResult?.status, 'applied');
assert.equal(importRecorded?.importResult?.created, 1);
assert.equal(fabric.recordHmxImportResult(stage.stagingId, { status: 'applied', created: 10, reused: 0 })?.importResult?.created, 1, 'completed import receipts cannot be replayed to rewrite counts');

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
