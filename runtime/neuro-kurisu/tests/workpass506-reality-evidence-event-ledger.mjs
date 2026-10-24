import assert from 'node:assert/strict';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';
import { createRealityEvidenceEventId } from '../src/organism/system/EvidenceEventIdentity.ts';

const eventId = createRealityEvidenceEventId('wp506-action-receipt', 'learning', 'causal-record');
assert.equal(RealityEvidenceLedger.realityEvidenceEventId('wp506-action-receipt', 'learning', 'causal-record'), eventId,
  'ledger public identity helper must delegate to the shared canonical identity implementation');

const ledger = new RealityEvidenceLedger();
const input = {
  tick: 12,
  realityClass: 'device-observation',
  claim: 'action postcondition verified',
  confidence01: 0.94,
  independenceKey: 'device:postcondition-checker',
  parentIds: ['decision:wp506-action-receipt'],
  at: 1_800_000_000_000,
  eventId,
};
const first = ledger.record(input);
const retry = ledger.record({ ...input, at: input.at + 1000 });
assert.equal(first.id, eventId, 'canonical event ID becomes the persisted record ID');
assert.equal(first.eventId, eventId);
assert.equal(retry.id, first.id, 'a retry with the same identity and payload returns the original record');
assert.equal(ledger.snapshot().total, 1, 'idempotent retries must not increase ledger totals');
assert.equal(ledger.recent(8).length, 1);

assert.throws(() => ledger.record({ ...input, claim: 'conflicting postcondition', at: input.at + 2000 }),
  /reality-evidence-event-id-conflict/, 'reusing an ID for conflicting evidence must be rejected');
assert.equal(ledger.recent(8).length, 0, 'conflicted IDs are quarantined from trusted views');
assert.ok(ledger.snapshot().quarantinedEventIds?.includes(eventId));
assert.throws(() => ledger.record(input), /reality-evidence-event-id-quarantined/,
  'a conflicted identity cannot be reused later');

const restored = new RealityEvidenceLedger();
restored.restore({
  version: 1, total: 2, externalCount: 2, simulatorCount: 0, independentSources: 1,
  recent: [
    { ...input, id: eventId },
    { ...input, id: eventId, claim: 'conflicting restored payload' },
  ],
});
assert.equal(restored.recent(8).length, 0, 'restore must quarantine conflicting duplicate event IDs');
assert.ok(restored.snapshot().quarantinedEventIds?.includes(eventId));
console.log('WORKPASS506_REALITY_EVIDENCE_EVENT_LEDGER=PASS');
