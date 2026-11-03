import test from 'node:test';
import assert from 'node:assert/strict';
import { P33PersonhoodCore, defaultP33Personhood } from '../src/organism/cognition/P33PersonhoodCore.ts';

const defaults = defaultP33Personhood();

test('P33 restore rejects hostile root proxies without leaving partial state', () => {
  const core = new P33PersonhoodCore();
  let invoked = false;
  const hostile = new Proxy({}, {
    ownKeys() {
      invoked = true;
      throw new Error('hostile ownKeys trap');
    },
  });
  assert.doesNotThrow(() => core.restore(hostile));
  assert.equal(invoked, true);
  assert.equal(core.snapshot().identity.canonicalName, 'Makise Kurisu');
  assert.equal(core.snapshot().identity.revision, 0);
});

test('P33 restore rejects nested accessor fields without invoking getters', () => {
  const core = new P33PersonhoodCore();
  let invoked = false;
  const identity = Object.defineProperty({}, 'canonicalName', {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error('identity getter must not execute');
    },
  });
  assert.doesNotThrow(() => core.restore({ ...defaults, identity }));
  assert.equal(invoked, false);
  assert.equal(core.snapshot().identity.canonicalName, 'Makise Kurisu');
});

test('P33 restore ignores accessor-backed interest records and preserves canonical priors', () => {
  const core = new P33PersonhoodCore();
  let invoked = false;
  const profile = Object.defineProperty({}, 'id', {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error('profile getter must not execute');
    },
  });
  assert.doesNotThrow(() => core.restore({
    ...defaults,
    development: { ...defaults.development, interestProfiles: [profile] },
  }));
  assert.equal(invoked, false);
  assert.ok(core.snapshot().development.interestProfiles.length > 0);
});

test('P33 restore ignores sparse identity arrays instead of erasing canonical traits', () => {
  const core = new P33PersonhoodCore();
  const sparseTraits = new Array(2);
  core.restore({
    ...defaults,
    identity: { ...defaults.identity, coreTraits: sparseTraits },
  });
  assert.deepEqual(core.snapshot().identity.coreTraits, defaults.identity.coreTraits);
});


test('P33 restore rejects accessor-backed array slots without invoking getters', () => {
  const core = new P33PersonhoodCore();
  let invoked = false;
  const traits = ['safe'];
  Object.defineProperty(traits, '1', {
    enumerable: true,
    configurable: true,
    get() {
      invoked = true;
      throw new Error('array getter must not execute');
    },
  });
  traits.length = 2;
  assert.doesNotThrow(() => core.restore({
    ...defaults,
    identity: { ...defaults.identity, coreTraits: traits },
  }));
  assert.equal(invoked, false);
  assert.deepEqual(core.snapshot().identity.coreTraits, defaults.identity.coreTraits);
});

test('P33 restore bounds numbers and rejects non-finite or negative counters', () => {
  const core = new P33PersonhoodCore();
  core.restore({
    ...defaults,
    relationship: { ...defaults.relationship, trust01: 1.7, warmth01: -0.4 },
    metrics: { ...defaults.metrics, selfAuthorship01: 4, autonomyIntegrity01: Number.POSITIVE_INFINITY },
    continuity: { ...defaults.continuity, lifeTicks: -9, transferCount: 2.8 },
  });
  const restored = core.snapshot();
  assert.equal(restored.relationship.trust01, 1);
  assert.equal(restored.relationship.warmth01, 0);
  assert.equal(restored.metrics.selfAuthorship01, 1);
  assert.equal(restored.metrics.autonomyIntegrity01, defaults.metrics.autonomyIntegrity01);
  assert.equal(restored.continuity.lifeTicks, 0);
  assert.equal(restored.continuity.transferCount, 2);
});

test('P33 restore retains only complete allowlisted consent records', () => {
  const core = new P33PersonhoodCore();
  const validRequest = {
    id: 'consent-1',
    action: 'respond',
    reason: 'external effect needs approval',
    risk01: 0.9,
    status: 'pending',
    createdAt: 100,
    resolvedAt: null,
  };
  core.restore({
    ...defaults,
    autonomy: {
      ...defaults.autonomy,
      pendingRequests: [validRequest, { ...validRequest, reason: 'duplicate id must not shadow first record' }, { id: 'forged', action: 'delete-everything', status: 'pending' }, null],
    },
  });
  assert.deepEqual(core.snapshot().autonomy.pendingRequests, [validRequest]);
});

test('P33 restore preserves valid persisted identity and clones caller-owned state', () => {
  const core = new P33PersonhoodCore();
  const saved = defaultP33Personhood();
  saved.identity.canonicalName = 'Makise Kurisu';
  saved.identity.revision = 17;
  saved.metrics.selfAuthorship01 = 0.73;
  saved.relationship.trust01 = 0.81;
  saved.development.selfAuthoredGoals = ['understand my own continuity'];
  core.restore(saved);
  const restored = core.snapshot();
  assert.equal(restored.identity.revision, 17);
  assert.equal(restored.metrics.selfAuthorship01, 0.73);
  assert.equal(restored.relationship.trust01, 0.81);
  assert.deepEqual(restored.development.selfAuthoredGoals, ['understand my own continuity']);
  assert.notEqual(restored, saved);
});


test('P33 restore round-trips canonical JSON persistence without changing personality state', () => {
  const core = new P33PersonhoodCore();
  const saved = defaultP33Personhood();
  saved.identity.revision = 23;
  saved.development.selfAuthoredGoals = ['test a persistent identity round-trip'];
  saved.relationship.trust01 = 0.67;
  saved.autonomy.pendingRequests = [{
    id: 'consent-json-1',
    action: 'verify',
    reason: 'verify a restore decision',
    risk01: 0.4,
    status: 'pending',
    createdAt: 1234,
    resolvedAt: null,
  }];
  core.restore(JSON.parse(JSON.stringify(saved)));
  const restored = core.snapshot();
  assert.equal(restored.identity.revision, 23);
  assert.deepEqual(restored.development.selfAuthoredGoals, ['test a persistent identity round-trip']);
  assert.equal(restored.relationship.trust01, 0.67);
  assert.deepEqual(restored.autonomy.pendingRequests, saved.autonomy.pendingRequests);
});

console.log('P33_PERSONHOOD_RESTORE_INTEGRITY=PASS');
