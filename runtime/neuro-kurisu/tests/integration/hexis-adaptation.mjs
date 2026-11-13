import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';

const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

const first = fabric.reviseBelief({ memoryId:'mem-1', confidence01:.5, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(first.applied, true);
assert(first.posteriorConfidence01 > .5);
const duplicate = fabric.reviseBelief({ memoryId:'mem-1', confidence01:first.posteriorConfidence01, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(duplicate.applied, false);
assert.equal(duplicate.reason, 'duplicate_source');

// Duplicate evidence may be audited, but it must not increase belief trust or
// advance the accepted-belief timestamp, even if the duplicate payload inflates trust.
const trustGuard = new HexisAdaptationFabric();
const trustedFirst = trustGuard.reviseBelief({
  memoryId:'mem-trust-guard', confidence01:.5, trust01:.1, stance:'supports',
  evidence:{ref:'stable-source',trust01:.2}, at:1000,
});
assert.equal(trustedFirst.applied, true);
const beforeDuplicate = trustGuard.snapshot().beliefs.find(x => x.memoryId === 'mem-trust-guard');
assert.ok(beforeDuplicate);
const rejectedDuplicate = trustGuard.reviseBelief({
  memoryId:'mem-trust-guard', confidence01:trustedFirst.posteriorConfidence01, trust01:.1, stance:'supports',
  evidence:{ref:'stable-source',trust01:.99}, at:2000,
});
assert.equal(rejectedDuplicate.applied, false);
assert.equal(rejectedDuplicate.priorTrust01, beforeDuplicate.trust01);
assert.equal(rejectedDuplicate.posteriorTrust01, beforeDuplicate.trust01,
  'duplicate evidence must not inflate the trust assigned to its source');
const afterDuplicate = trustGuard.snapshot().beliefs.find(x => x.memoryId === 'mem-trust-guard');
assert.equal(afterDuplicate?.trust01, beforeDuplicate.trust01);
assert.equal(afterDuplicate?.confidence01, beforeDuplicate.confidence01);
assert.equal(afterDuplicate?.updatedAt, beforeDuplicate.updatedAt,
  'rejected duplicate evidence must not advance the accepted-belief timestamp');

// A protected contradiction is recorded as an audit event but must not mutate
// confidence, trust or the accepted-belief timestamp.
const protectedGuard = new HexisAdaptationFabric();
const protectedFirst = protectedGuard.reviseBelief({
  memoryId:'protected-identity', confidence01:.8, trust01:.2, stance:'supports',
  evidence:{ref:'identity-support',trust01:.1}, at:3000,
});
const protectedBefore = protectedGuard.snapshot().beliefs.find(x => x.memoryId === 'protected-identity');
assert.ok(protectedBefore);
const blockedContradiction = protectedGuard.reviseBelief({
  memoryId:'protected-identity', confidence01:protectedFirst.posteriorConfidence01, trust01:.2,
  stance:'contradicts', evidence:{ref:'new-independent-challenge',trust01:.99},
  protectedBelief:true, at:4000,
});
assert.equal(blockedContradiction.applied, false);
assert.equal(blockedContradiction.reason, 'protected');
assert.ok(protectedGuard.snapshot().beliefAudit.some(row => row.id === blockedContradiction.id && row.applied === false),
  'rejected protected evidence must remain visible in the audit trail');
const protectedAfter = protectedGuard.snapshot().beliefs.find(x => x.memoryId === 'protected-identity');
assert.equal(protectedAfter?.confidence01, protectedBefore.confidence01);
assert.equal(protectedAfter?.trust01, protectedBefore.trust01,
  'blocked protected-belief contradictions must not raise trust');
assert.equal(protectedAfter?.updatedAt, protectedBefore.updatedAt);
assert.deepEqual(protectedAfter?.sourceKeys, protectedBefore.sourceKeys,
  'rejected protected contradictions must not mutate accepted supporting-source lineage');
assert.deepEqual(protectedAfter?.contradictingSourceKeys, protectedBefore.contradictingSourceKeys,
  'rejected protected contradictions must not mutate accepted contradiction-source lineage');

const t1 = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'alpha',confidence01:.7,validFrom:1000,source:'test',value:'alpha'});
fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'beta',confidence01:.8,validFrom:2000,source:'test',value:'beta'});
assert.equal(fabric.temporalAt('mem-1',1500)?.valueHash, t1.valueHash);
assert.equal(fabric.temporalAt('mem-1',2500)?.summary, 'beta');
assert.equal(fabric.temporalDiff('mem-1',1500,2500).changed, true);

const review = fabric.createLearningReview({periodStart:0,periodEnd:1,summary:'test review',items:[{kind:'semantic_belief',title:'x',content:'y',sourceMemoryId:'mem-1',evidence:{}}]});
const decided = fabric.decideLearningReview(review.id,review.items[0].id,'approve');
assert.equal(decided?.status,'approved');

const makeHmxDocument = (exportId, exportIntent, sections) => ({
  hmx_version: '1.7',
  export_id: exportId,
  export_intent: exportIntent,
  exported_at: new Date(1_800_000_000_000).toISOString(),
  source: {
    instance_id: 'hexis-test-donor',
    schema_version: '1.7',
    embedding_model: 'donor-test-no-vector-import',
    embedding_dimension: 384,
    hexis_lineage_id: 'hexis-test-lineage',
  },
  capabilities: {
    formats: ['json'],
    sections: Object.keys(sections),
    hash_algorithms: ['sha256'],
    relationship_edge_types: ['supports', 'contradicts'],
    optional_features: [],
  },
  privacy: {
    redaction_policy: 'strict',
    contains_sensitive_content: false,
    consent_scope: 'migration',
  },
  sections,
});
const stageId = 'exp_0000000000000001';
const stage = fabric.stageHmx({
  document: makeHmxDocument(stageId, 'port', {
    memories: [{ ref: stageId + ':memory-m', type: 'semantic', content: 'validated donor memory' }],
    goals: [{ id: 'g' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(stage.status, 'staged');
assert.deepEqual(stage.conflicts, []);
assert.equal(fabric.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');

const protectedId = 'exp_0000000000000002';
const protectedStage = fabric.stageHmx({
  document: makeHmxDocument(protectedId, 'telepathy', { identity: [{ id: 'self' }] }),
  intent: 'telepathy',
  strategy: 'analysis_only',
});
assert.equal(fabric.decideHmx(protectedStage.stagingId, 'accept')?.status, 'staged');

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

const policyRestoreSnapshot = fabric.snapshot();
policyRestoreSnapshot.connectorPolicies = [
  { ...policy, status: 'active', windowStartedAt: Date.now(), windowCount: 0 },
  { ...policy, id: 'malformed-missing-contexts', contexts: undefined },
  { ...policy, id: 'malformed-truthy-string-autonomy', allowAutonomous: 'false' },
  { ...policy, id: 'malformed-window-counter', windowCount: Number.NaN },
  { ...policy, id: 'malformed-overlong-window', windowMs: Number.MAX_SAFE_INTEGER },
  { ...policy, id: 'malformed-fractional-window-start', windowStartedAt: 1.5 },
  { ...policy, id: 'malformed-empty-contexts', contexts: [] },
  { ...policy, id: 'malformed-overquota-counter', windowCount: 1_000_001 },
  { ...policy, id: 'malformed-overquota-limit', maxPerWindow: 1_000_001 },
  { ...policy, id: 'duplicate-policy-id' },
  { ...policy, id: 'duplicate-policy-id' },
];
policyRestoreSnapshot.metrics.policyAllows = Number.POSITIVE_INFINITY;
policyRestoreSnapshot.metrics.policyDenials = -1;
const policyRestoreGuard = new HexisAdaptationFabric();
policyRestoreGuard.restore(policyRestoreSnapshot);
const guardedSnapshot = policyRestoreGuard.snapshot();
assert.deepEqual(
  guardedSnapshot.connectorPolicies.map(item => item.id),
  [policy.id],
  'restore must keep only structurally valid, unique, fail-closed connector policies',
);
assert.equal(guardedSnapshot.metrics.policyAllows, 0, 'non-finite persisted metrics must not survive restore');
assert.equal(guardedSnapshot.metrics.policyDenials, 0, 'negative persisted metrics must not survive restore');
assert.equal(
  policyRestoreGuard.evaluateConnectorAction({ connectorId: 'telegram', actionKind: 'send', context: 'chat', target: '123', confirmed: true }).allowed,
  true,
  'a valid restored policy must remain usable',
);
assert.throws(
  () => fabric.grantConnectorPolicy({ connectorId: 'telegram', actionKind: 'send', allowAutonomous: 'false' }),
  /allowAutonomous must be a boolean/,
  'truthy strings must not grant autonomous connector authority',
);
assert.throws(
  () => fabric.grantConnectorPolicy({ connectorId: 'telegram', actionKind: 'send', maxPerWindow: Number.NaN }),
  /maxPerWindow must be a positive safe integer/,
);
assert.throws(
  () => fabric.grantConnectorPolicy({ connectorId: { toString: () => 'telegram' }, actionKind: 'send' }),
  /connector policy identity must be strings/,
  'runtime identity objects must not be coerced into connector authority',
);
assert.throws(
  () => fabric.grantConnectorPolicy({ connectorId: 'telegram', actionKind: 'send', maxPerWindow: 1_000_001 }),
  /maxPerWindow must be a positive safe integer/,
);
assert.throws(
  () => fabric.grantConnectorPolicy({ connectorId: 'telegram', actionKind: 'send', expiresAt: 1.5 }),
  /expiresAt must be a non-negative safe integer/,
);
assert.throws(
  () => fabric.grantConnectorPolicy({ connectorId: 'telegram', actionKind: 'send', windowMs: Number.POSITIVE_INFINITY }),
  /windowMs must be a safe integer/,
);


// Untrusted snapshots must be inspected without invoking accessors. A hostile
// envelope resets to the canonical defaults instead of crashing initialization.
{
  const hostile = {};
  let getterCalls = 0;
  Object.defineProperty(hostile, 'beliefs', {
    enumerable: true,
    get() { getterCalls += 1; throw new Error('snapshot getter must stay inert'); },
  });
  const restored = new HexisAdaptationFabric();
  assert.doesNotThrow(() => restored.restore(hostile));
  assert.equal(getterCalls, 0, 'restore must inspect own data descriptors, never invoke a snapshot getter');
  assert.deepEqual(restored.snapshot(), defaultHexisAdaptationState(),
    'an uninspectable root snapshot must reset the adapter to safe defaults');
}

// Nested accessors are equally untrusted: a valid-looking outbox row must not
// smuggle an executable getter into a future delivery or snapshot operation.
{
  let nestedGetterCalls = 0;
  const payload = {};
  Object.defineProperty(payload, 'text', {
    enumerable: true,
    get() { nestedGetterCalls += 1; throw new Error('nested getter must stay inert'); },
  });
  const hostile = {
    outbox: [{
      id: 'out-1', idempotencyKey: 'key-1', kind: 'notify', channel: 'test',
      payload, status: 'pending', attempts: 0, createdAt: 1, updatedAt: 1,
    }],
  };
  const restored = new HexisAdaptationFabric();
  assert.doesNotThrow(() => restored.restore(hostile));
  assert.equal(nestedGetterCalls, 0, 'nested snapshot getters must not execute during restore');
  assert.deepEqual(restored.snapshot(), defaultHexisAdaptationState(),
    'a snapshot containing an uninspectable nested object must fail closed');
}

// Structurally corrupt rows must not survive merely because their container is
// an array. Valid rows in the same collection remain restorable.
{
  const validBelief = {
    memoryId: 'memory-valid', confidence01: 0.6, trust01: 0.5,
    sourceKeys: ['source-a'], contradictingSourceKeys: [], updatedAt: 100,
  };
  const invalidBelief = {
    memoryId: 'memory-invalid', confidence01: Number.POSITIVE_INFINITY, trust01: 0.5,
    sourceKeys: [], contradictingSourceKeys: [], updatedAt: 100,
  };
  const restored = new HexisAdaptationFabric();
  restored.restore({ beliefs: [validBelief, null, invalidBelief] });
  assert.deepEqual(restored.snapshot().beliefs, [validBelief],
    'restore must filter malformed belief rows without discarding valid peers');
}

// Outbox recovery must not retain malformed rows or ambiguous duplicate keys;
// idempotency lookup depends on these identities remaining unique.
{
  const validOutbox = {
    id: 'out-valid', idempotencyKey: 'key-valid', kind: 'notify', channel: 'test',
    payload: { text: 'safe' }, status: 'pending', attempts: 0, createdAt: 100, updatedAt: 100,
  };
  const duplicateA = { ...validOutbox, id: 'out-duplicate-a', idempotencyKey: 'key-ambiguous' };
  const duplicateB = { ...validOutbox, id: 'out-duplicate-b', idempotencyKey: 'key-ambiguous' };
  const invalidOutbox = { ...validOutbox, id: 'out-invalid', attempts: -1 };
  const restored = new HexisAdaptationFabric();
  restored.restore({ outbox: [validOutbox, duplicateA, duplicateB, invalidOutbox] });
  assert.deepEqual(restored.snapshot().outbox, [validOutbox],
    'restore must drop malformed rows and every row sharing an ambiguous idempotency key');
}

console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
