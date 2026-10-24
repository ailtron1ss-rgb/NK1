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

console.log('WorkPass548 observer source identity regression: PASS');
