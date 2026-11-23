import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Temporal-validity write guard. Adapted from Hexis's
// normalize_memory_temporal_validity trigger (MIT, db/46c_functions_memory_supersessions.sql),
// which rejects a memory whose valid_until precedes valid_from. In NK1 every
// temporal guard is `at < validUntilAt`, so an inverted window makes a row
// unreachable in current, point-in-time and archive modes alike: a silent,
// total data loss for that memory. The window is closed at validFromAt instead,
// matching the restore policy so a live write and a reloaded snapshot agree.

const now = 2_000_000_000_000;
const encode = (memory, content, extra = {}) => memory.encode({
  content,
  kind: 'semantic',
  source: 'temporal-validity-fixture',
  ...extra,
});

// An already-expired memory re-encoded without an explicit validFromAt must not
// receive a start later than its own expiry.
const memory = new MemoryOS2({ embeddingProvider: null });
const expiredId = encode(memory, 'The quarterly key rotates at the end of the quarter.', { validFromAt: now, validUntilAt: now - 3_600_000 }).id;
const expired = memory.get(expiredId);
assert.ok(expired.validUntilAt >= expired.validFromAt, 'an inverted expiry must be closed at the start, not stored inverted');

// The row is still reachable in archive mode (point-in-time history is preserved).
const archived = memory.retrieve('quarterly key rotates end of quarter', 5, 0, 0, { temporalMode: 'all' });
assert.ok(archived.some(row => row.id === expiredId), 'the closed window must remain visible in archive mode');

// A legitimately bounded window is preserved exactly.
const boundedId = encode(memory, 'The seasonal key rotates at the end of the season.', { validFromAt: now - 1_000, validUntilAt: now + 9_000_000 }).id;
const bounded = memory.get(boundedId);
assert.equal(bounded.validUntilAt, now + 9_000_000, 'a valid expiry boundary must be preserved');

// A live inverted window and a reloaded snapshot must agree; restore must not
// silently rewrite the interval in a way the live instance did not.
const reloaded = new MemoryOS2({ embeddingProvider: null });
reloaded.restore(structuredClone(memory.snapshot()));
const reloadedExpired = reloaded.snapshot().items.find(item => item.id === expiredId);
assert.equal(reloadedExpired.validFromAt, expired.validFromAt, 'restore must agree on the start');
assert.equal(reloadedExpired.validUntilAt, expired.validUntilAt, 'restore must agree on the closed expiry');

// A snapshot that arrives already inverted (e.g. from an older writer) is also
// closed at the start, and the repair is reported rather than hidden.
const invertedSnapshot = structuredClone(memory.snapshot());
const target = invertedSnapshot.items.find(item => item.id === expiredId);
target.validUntilAt = target.validFromAt - 60_000;
const repaired = new MemoryOS2({ embeddingProvider: null });
repaired.restore(invertedSnapshot);
const repairedRow = repaired.snapshot().items.find(item => item.id === expiredId);
assert.equal(repairedRow.validUntilAt, repairedRow.validFromAt, 'restore must close an inverted window at the start');
assert.ok(repaired.restoreDiagnostics().invalidExpiriesClosed >= 1, 'the inverted-window repair must be reported');

console.log('MEMORY_TEMPORAL_VALIDITY_WRITE_GUARD=PASS', JSON.stringify({
  liveWindowClosed: expired.validUntilAt === expired.validFromAt,
  validBoundaryPreserved: bounded.validUntilAt === now + 9_000_000,
  restoreRepairsReported: repaired.restoreDiagnostics().invalidExpiriesClosed,
}));
