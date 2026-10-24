import assert from 'node:assert/strict';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const fabric = new ExternalObserverFabric();
const registered = fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'physical-sensor-bank-a',
  reliability01: 0.9,
});
assert.equal(registered.independenceKey, 'physical-sensor-bank-a');

// Re-registering a known source may update operational trust settings, but
// must never let the same source ID claim a different independence group.
assert.throws(() => fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'pretend-independent-source',
}), /external-observer-source-identity-conflict/);

assert.throws(() => fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'external-api',
  channel: 'http',
  independenceKey: 'physical-sensor-bank-a',
}), /external-observer-source-identity-conflict/);

 // Observation ingress must reject caller labels that disagree with the registry,
 // rather than silently accepting a mislabeled observation under a trusted ID.
assert.throws(() => fabric.observe({
  sourceId: 'device-primary',
  sourceClass: 'external-api',
  channel: 'http',
  independenceKey: 'pretend-independent-source',
  claimKey: 'door=open',
  observedPostcondition: 'door=open',
  confidence01: 0.99,
}), /external-observer-source-identity-conflict/);
assert.equal(fabric.snapshot().observations.length, 0);

const afterRejectedChanges = fabric.snapshot().sources.find(source => source.id === 'device-primary');
assert.equal(afterRejectedChanges.sourceClass, 'device');
assert.equal(afterRejectedChanges.channel, 'sensor');
assert.equal(afterRejectedChanges.independenceKey, 'physical-sensor-bank-a');

// Legitimate reliability/enablement updates remain possible when identity is stable.
const updated = fabric.registerSource({
  id: 'device-primary',
  sourceClass: 'device',
  channel: 'sensor',
  independenceKey: 'physical-sensor-bank-a',
  reliability01: 0.7,
});
assert.equal(updated.reliability01, 0.7);
assert.equal(updated.independenceKey, 'physical-sensor-bank-a');

// A caller's confidence in one sample must not mint a permanently high-trust source.
const autoRegistered = new ExternalObserverFabric();
autoRegistered.observe({
  sourceId: 'api-untrusted',
  sourceClass: 'external-api',
  channel: 'http',
  claimKey: 'status=ready',
  observedPostcondition: 'status=ready',
  confidence01: 0.99,
});
const mintedSource = autoRegistered.snapshot().sources.find(source => source.id === 'api-untrusted');
assert.equal(mintedSource.reliability01, 0.84, 'new external-api sources must start from the conservative class prior');
assert.equal(autoRegistered.snapshot().observations[0].confidence01, 0.99, 'sample confidence remains separate evidence');

// Source registry exhaustion must not evict established identities or accept new evidence.
const bounded = new ExternalObserverFabric({ maxSources: 16 });
for (let i = 0; i < 16; i += 1) {
  bounded.registerSource({
    id: `capacity-${String(i).padStart(2, '0')}`,
    sourceClass: 'unknown',
    channel: 'unknown',
    independenceKey: `group-${i}`,
  });
}
assert.equal(bounded.snapshot().sources.length, 16);
assert.throws(() => bounded.observe({
  sourceId: 'capacity-new',
  sourceClass: 'unknown',
  channel: 'unknown',
  claimKey: 'attacker=claim',
  observedPostcondition: 'attacker=claim',
}), /observer-source-registry-capacity-exceeded/);
assert.equal(bounded.snapshot().sources.length, 16, 'registry must not silently evict a registered source');
assert.ok(bounded.snapshot().sources.some(source => source.id === 'capacity-00'), 'oldest source identity must remain intact');
assert.equal(bounded.snapshot().observations.length, 0, 'evidence from the rejected identity must not persist');
const existingAtCapacity = bounded.registerSource({
  id: 'capacity-00',
  sourceClass: 'unknown',
  channel: 'unknown',
  independenceKey: 'group-0',
  reliability01: 0.51,
});
assert.equal(existingAtCapacity.reliability01, 0.51, 'known source calibration remains writable at capacity');
assert.equal(bounded.snapshot().sources.length, 16, 'updating a known identity must not grow or shrink the registry');

console.log('WorkPass548 observer source identity regression: PASS');
