import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric();
const decisionId = 'core-decision-trace:decision-not-materialized-as-cef-node';
const input = {
  tick: 41,
  executionId: 'exec-workpass72-cef-reference',
  toolId: 'organism.device.set-state',
  decisionId,
  ok: true,
  verified: true,
  outcomeClass: 'executed-verified',
  confidence01: .98,
  verificationBasis: 'external-postcondition',
  externalObservation: true,
  observationId: 'sensor:relay-01',
  expectedPostcondition: 'relay=on',
  observedPostcondition: 'relay=on',
  observationIntegrated: true,
  at: 1_800_000_000_000,
};

const first = fabric.appendToolReceiptTrace(input);
assert.equal(first.replayed, false);
let snapshot = fabric.snapshot();
let events = [...snapshot.recent, ...(snapshot.receiptEvents ?? [])];
let action = events.find(event => event.id === first.actionEventId);
assert.ok(action, 'the action receipt node must be retained in the CEF snapshot');
assert.equal(action.payload.decisionId, decisionId,
  'the exact Core decision ID must remain visible even when no same-ID CEF node exists');
assert.equal(action.payload.decisionLinked, false,
  'a correlation reference must not be represented as a graph edge when the parent event is absent');
assert.deepEqual(action.parentIds, [],
  'CEF must not create a dangling parent edge from an external Core trace ID');

const restored = new CognitiveEventFabric();
restored.restore(snapshot);
const beforeTotal = restored.snapshot().total;
const replay = restored.appendToolReceiptTrace(input);
assert.equal(replay.replayed, true);
assert.equal(replay.actionEventId, first.actionEventId);
assert.equal(restored.snapshot().total, beforeTotal,
  'the correlation reference must retain the existing receipt idempotency projection across restore');

console.log('CEF_DECISION_REFERENCE_WORKPASS72=PASS');
