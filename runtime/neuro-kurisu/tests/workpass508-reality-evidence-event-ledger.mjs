import assert from 'node:assert/strict';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';
import { createRealityEvidenceEventId } from '../src/organism/system/EvidenceEventIdentity.ts';

const eventId = createRealityEvidenceEventId('wp508-memory-consolidation', 'memory', 'evidence-record');
assert.equal(RealityEvidenceLedger.realityEvidenceEventId('wp508-memory-consolidation', 'memory', 'evidence-record'), eventId,
  'memory ledger identity must delegate to the same canonical event ID contract');

const ledger = new RealityEvidenceLedger();
const input = {
  tick: 18,
  realityClass: 'device-observation',
  claim: 'independently verified memory postcondition',
  confidence01: 0.9,
  independenceKey: 'device:memory-verifier',
  parentIds: ['memory-decision:wp508'],
  at: 1_800_000_000_000,
  eventId,
};
const first = ledger.record(input);
const retry = ledger.record({ ...input, at: input.at + 5000 });
assert.equal(first.id, eventId);
assert.equal(retry.id, eventId);
assert.equal(ledger.snapshot().total, 1, 'retry must not double-count a memory evidence record');
assert.equal(ledger.recent(8).length, 1);

assert.throws(() => ledger.record({ ...input, confidence01: 0.1, at: input.at + 6000 }),
  /reality-evidence-event-id-conflict/, 'evidence ID reuse with a changed confidence must be quarantined');
assert.equal(ledger.recent(8).length, 0);
assert.ok(ledger.snapshot().quarantinedEventIds?.includes(eventId));

const userReport = new RealityEvidenceLedger();
userReport.record({
  tick: 18, realityClass: 'user-reported', claim: 'reported but not device-verified',
  confidence01: 0.99, independenceKey: 'user:report', at: 1_800_000_000_000,
  eventId: createRealityEvidenceEventId('wp508-user-report', 'user-report', 'memory-claim'),
});
assert.equal(userReport.snapshot().externalCount, 0,
  'user-reported content must remain separate from external/device observation counts');

console.log('WORKPASS508_MEMORY_REALITY_EVIDENCE_LEDGER=PASS');
