import assert from 'node:assert/strict';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

function fnv32(seed) {
  let h = 2166136261 >>> 0;
  for (const char of seed) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
function legacyFingerprint(payload) { return fnv32(JSON.stringify(payload)); }
function legacyObservationId(input, payloadHash) {
  return `obs:${fnv32(`${input.sourceId}|${input.claimKey.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 180)}|${input.actionRef ?? ''}|${Math.floor(input.observedAt / 1000)}|${payloadHash}`)}`;
}

const observer = new ExternalObserverFabric();
const at = 1_800_000_000_123;
const input = {
  sourceId: 'device.workpass39', sourceClass: 'device', channel: 'sensor',
  claimKey: 'door state', observedPostcondition: 'door=open', confidence01: .93,
  actionRef: 'execution-39', observedAt: at, payload: { state: 'open', tick: 39 },
};
const first = observer.observe(input);
assert.match(first.id, /^obs:[0-9a-f]{64}$/);
assert.match(first.payloadHash, /^[0-9a-f]{64}$/);
assert.equal(observer.observe(input).id, first.id, 'same evidence must be idempotent');
const different = observer.observe({ ...input, payload: { state: 'closed', tick: 39 } });
assert.notEqual(different.id, first.id, 'different payload must never collide at the stored identity level');
assert.notEqual(different.payloadHash, first.payloadHash);

// Compatibility: an old v2 state row must deduplicate a repeated observation.
const legacyObserver = new ExternalObserverFabric();
const legacyState = legacyObserver.snapshot();
const legacyHash = legacyFingerprint(input.payload);
const legacyId = legacyObservationId(input, legacyHash);
legacyState.observations = [{
  ...first, id: legacyId, payloadHash: legacyHash,
  claimKey: 'door state', sourceId: input.sourceId, actionRef: input.actionRef, observedAt: input.observedAt,
}];
legacyState.sources = [{ id: input.sourceId, sourceClass: input.sourceClass, channel: input.channel, independenceKey: input.sourceId, reliability01: .93, enabled: true, samples: 1, accepted: 0, contradicted: 0, lastAt: input.observedAt }];
legacyState.totalObservations = 1;
legacyObserver.restore(legacyState);
const legacyAgain = legacyObserver.observe(input);
assert.equal(legacyAgain.id, legacyId, 'legacy persisted IDs remain stable during migration');
assert.equal(legacyObserver.snapshot().observations.length, 1, 'legacy repeat must not append a duplicate');

// Property order must not affect the new content digest.
const orderedA = new ExternalObserverFabric();
const orderedB = new ExternalObserverFabric();
const rowA = orderedA.observe({ ...input, payload: { alpha: 1, beta: { x: 2, y: 3 } } });
const rowB = orderedB.observe({ ...input, payload: { beta: { y: 3, x: 2 }, alpha: 1 } });
assert.equal(rowA.payloadHash, rowB.payloadHash, 'canonical JSON is independent of property insertion order');
assert.equal(rowA.id, rowB.id);
console.log('EXTERNAL_OBSERVER_HASH_HARDENING_WORKPASS39=PASS sha256=64hex legacy-idempotency=PASS canonical-json=PASS');
