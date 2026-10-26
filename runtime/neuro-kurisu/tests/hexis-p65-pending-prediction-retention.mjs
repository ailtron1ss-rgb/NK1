import assert from 'node:assert/strict';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';

const ledger = new P65EpistemicLedger();
for (let tick = 1; tick <= 200; tick += 1) {
  ledger.record({
    tick,
    at: tick * 1000,
    kind: 'prediction',
    content: `unresolved prediction ${tick}`,
    confidence01: 0.7,
    source: 'organism',
  });
}

const persisted = ledger.persistenceSnapshot();
const pending = persisted.claimsData.filter((claim) => claim.kind === 'prediction' && !claim.resolved);
assert.equal(pending.length, 200, 'persistence must retain all unresolved predictions even when the pending set exceeds the recent-history window');
assert.equal(new Set(pending.map((claim) => claim.id)).size, 200, 'pending prediction IDs must remain unique');

const restored = new P65EpistemicLedger();
restored.restore(persisted);
const restoredPending = restored.persistenceSnapshot().claimsData.filter((claim) => claim.kind === 'prediction' && !claim.resolved);
assert.equal(restoredPending.length, 200, 'all pending predictions must survive restore and another persistence projection');

console.log('Hexis P65 pending-prediction retention: PASS');
