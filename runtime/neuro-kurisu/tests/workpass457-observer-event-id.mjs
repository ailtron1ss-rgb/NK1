import assert from 'node:assert/strict';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const observer = new ExternalObserverFabric();
const eventId = `outcome:${'a'.repeat(40)}`;
const input = {
  sourceId: 'device-camera-front',
  sourceClass: 'device',
  channel: 'device',
  independenceKey: 'device:camera-front',
  claimKey: 'tool-postcondition:door-open',
  observedPostcondition: 'front camera observed the door open',
  facts: ['front camera observed the door open'],
  confidence01: 0.91,
  observedAt: 1792800000000,
  actionRef: 'exec-0123456789abcdef',
  tool: 'device.observe',
  tick: 42,
  evidenceEventId: eventId,
  metadata: { verifierObservationId: 'obs-42', evidenceEventId: eventId },
  payload: {
    verifierObservationId: 'obs-42',
    expectedPostcondition: 'front camera observed the door open',
    observedPostcondition: 'front camera observed the door open',
  },
};

const first = observer.observe(input);
assert.equal(first.evidenceEventId, eventId);
assert.equal(observer.snapshot().observations.length, 1);
const replay = observer.observe(structuredClone(input));
assert.deepEqual(replay, first, 'same verifier event must return one canonical observation');
assert.equal(observer.snapshot().observations.length, 1, 'replay must not become a second source sample');
assert.equal(observer.snapshot().sources.find(source => source.id === input.sourceId).samples, 1);

assert.throws(() => observer.observe({
  ...input,
  observedPostcondition: 'the door is closed',
  facts: ['the door is closed'],
  payload: {
    verifierObservationId: 'obs-42',
    expectedPostcondition: 'front camera observed the door open',
    observedPostcondition: 'the door is closed',
  },
}), /external-observer-evidence-event-identity-conflict/,
'same upstream identity bound to a different observation must fail closed');
assert.equal(observer.snapshot().observations.length, 1);

assert.throws(() => observer.observe({ ...input, evidenceEventId: 'outcome:bad\nforged' }),
  /external-observer-evidence-event-id-invalid/);
console.log('WORKPASS457_OBSERVER_EVENT_ID=PASS replayIsIdempotent=true payloadConflictRejected=true malformedIdentityRejected=true');
