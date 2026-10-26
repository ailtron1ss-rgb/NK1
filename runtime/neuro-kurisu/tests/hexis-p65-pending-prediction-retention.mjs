import assert from 'node:assert/strict';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';

const ledger = new P65EpistemicLedger();
for (let tick = 1; tick <= 1024; tick += 1) {
  const id = ledger.record({
    tick,
    at: tick * 1000,
    kind: 'prediction',
    content: `unresolved prediction ${tick}`,
    confidence01: 0.7,
    source: 'organism',
  });
  assert.ok(id, `prediction ${tick} should be accepted below the pending cap`);
}

// A full pending set is not silently evicted to admit another prediction.
assert.equal(ledger.record({
  tick: 1025,
  at: 1025000,
  kind: 'prediction',
  content: 'over-cap prediction',
  confidence01: 0.8,
  source: 'organism',
}), '', 'new predictions must fail closed when the bounded pending queue is full');

// Recent observations may rotate, but must not displace unresolved predictions.
for (let tick = 1; tick <= 200; tick += 1) {
  ledger.record({
    tick: 2000 + tick,
    at: (2000 + tick) * 1000,
    kind: 'observation',
    content: `recent observation ${tick}`,
    confidence01: 0.9,
    source: 'world',
  });
}

const persisted = ledger.persistenceSnapshot();
const pending = persisted.claimsData.filter((claim) => claim.kind === 'prediction' && !claim.resolved);
const recent = persisted.claimsData.filter((claim) => claim.kind !== 'prediction' || claim.resolved);
assert.equal(pending.length, 1024, 'all accepted unresolved predictions must survive recording and persistence');
assert.equal(recent.length, 128, 'non-prediction history must remain bounded');
assert.ok(recent.some((claim) => claim.content === 'recent observation 200'), 'newest history should survive');
assert.ok(!recent.some((claim) => claim.content === 'recent observation 1'), 'old history should rotate out');
assert.equal(new Set(pending.map((claim) => claim.id)).size, 1024, 'pending prediction IDs must remain unique');

const restored = new P65EpistemicLedger();
restored.restore(persisted);
const restoredPending = restored.persistenceSnapshot().claimsData.filter((claim) => claim.kind === 'prediction' && !claim.resolved);
assert.equal(restoredPending.length, 1024, 'all pending predictions must survive restore and another persistence projection');

// Restore is defensive against nulls, malformed IDs and duplicate rows; newest-first ordering is retained.
restored.restore({
  ...persisted,
  claimsData: [
    null,
    { id: 'bad', kind: 'prediction', content: 'missing required fields' },
    ...persisted.claimsData,
    persisted.claimsData[0],
  ],
});
const recovered = restored.persistenceSnapshot();
assert.equal(recovered.claimsData.filter((claim) => claim.kind === 'prediction' && !claim.resolved).length, 1024);
assert.equal(new Set(recovered.claimsData.map((claim) => claim.id)).size, recovered.claimsData.length);

console.log('Hexis P65 pending-prediction retention: PASS (1024 pending, bounded history, restore sanitization)');
