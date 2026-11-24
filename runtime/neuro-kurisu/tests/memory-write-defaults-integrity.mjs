import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// A live write must satisfy the same invariants restore enforces. buildMemoryItem
// previously spread `confidence`/`epistemicStatus`/signal fields through
// unvalidated, so a caller that omitted them produced records that doctor()
// rejected in memory and restore silently repaired on reload — the two owners
// disagreed. Merging a same-content re-encode with omitted signals also read
// `undefined` as NaN and zeroed the existing record's salience.

const VALID_STATUSES = new Set(['fact', 'belief', 'hypothesis', 'unknown', 'quarantined']);

// 1. Omitted confidence/status on a fresh record: normalized, not left invalid.
const memory = new MemoryOS2({ embeddingProvider: null });
const plain = memory.get(memory.encode({ content: 'A plain note that sets no explicit signals at all.', kind: 'semantic', source: 'ops' }).id);
assert.ok(Number.isFinite(plain.confidence) && plain.confidence >= 0 && plain.confidence <= 1, 'omitted confidence must be normalized to a finite value');
assert.ok(VALID_STATUSES.has(plain.epistemicStatus), 'omitted epistemic status must be normalized to a supported enum');
assert.equal(memory.doctor().pass, true, 'a live write must not fail integrity for omitted signals');

// 2. Out-of-range confidence and unsupported status are coerced, not stored verbatim.
const junk = memory.get(memory.encode({ content: 'A note carrying out-of-range and unsupported signal values.', kind: 'semantic', source: 'ops', confidence: 5, epistemicStatus: 'bogus' }).id);
assert.ok(junk.confidence >= 0 && junk.confidence <= 1, 'out-of-range confidence must be clamped');
assert.ok(VALID_STATUSES.has(junk.epistemicStatus), 'unsupported status must fall back to a supported enum');

// 3. A 'fact' with an invalid confidence is downgraded, matching restore.
const downgraded = memory.get(memory.encode({ content: 'A record claiming fact status with an invalid confidence.', kind: 'semantic', source: 'ops', confidence: 9, epistemicStatus: 'fact' }).id);
assert.notEqual(downgraded.epistemicStatus, 'fact', 'a fact without a valid confidence must be downgraded');
assert.equal(memory.doctor().pass, true, 'the normalized live state must pass integrity');

// 4. A same-content re-encode with omitted signals must not zero the existing salience.
const merge = new MemoryOS2({ embeddingProvider: null });
const seeded = merge.encode({ content: 'A recurring observation about the harbor tides.', kind: 'semantic', source: 'user', salience: .7, confidence: .8 });
const before = merge.get(seeded.id);
const beforeSalience = before.salience;
merge.encode({ content: 'A recurring observation about the harbor tides.', kind: 'semantic', source: 'user' });
const after = merge.get(seeded.id);
assert.equal(merge.size(), 1, 'a same-content re-encode must merge, not fork');
assert.ok(after.salience > 0, 'a merged record must not have its salience zeroed by an omitted input signal');
assert.ok(after.salience >= beforeSalience * .5, 'a merge with omitted signals must preserve the existing salience magnitude');
assert.equal(merge.doctor().pass, true, 'the merged live state must pass integrity');

// 5. A snapshot/restore round-trip agrees with the live state: no repair drift.
const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(structuredClone(memory.snapshot()));
assert.equal(restored.doctor().pass, true, 'restore of the normalized live state must pass integrity');
const restoredPlain = restored.get(plain.id);
assert.equal(restoredPlain.confidence, plain.confidence, 'confidence must survive a round-trip unchanged');
assert.equal(restoredPlain.epistemicStatus, plain.epistemicStatus, 'epistemic status must survive a round-trip unchanged');

console.log('MEMORY_WRITE_DEFAULTS_INTEGRITY=PASS', JSON.stringify({
  plainConfidence: plain.confidence,
  plainStatus: plain.epistemicStatus,
  junkClamped: junk.confidence,
  factDowngraded: downgraded.epistemicStatus,
  mergeSaliencePreserved: after.salience > 0,
  restoreAgrees: restoredPlain.confidence === plain.confidence,
}));
