import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const base = {
  kind: 'episodic',
  source: 'memoryos2-byte-accounting-workpass70',
  salience: .7,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: ['reactor', 'eastern-facility', 'containment-system'],
};

const memory = new MemoryOS2({ embeddingProvider: null });
const first = memory.encode({
  ...base,
  id: 'reactor-stable',
  content: 'The reactor in the eastern facility is stable and operating normally.',
}, { clone: false });
const second = memory.encode({
  ...base,
  id: 'reactor-unstable',
  content: 'The reactor in the eastern facility is not stable and operating normally.',
}, { clone: false });

assert.ok(second.contradictionLinks.includes(first.id), 'new memory should identify the contradictory canonical fact');
const updatedFirst = memory.snapshot({ clone: false }).items.find(row => row.id === first.id);
assert.ok(updatedFirst?.contradictionLinks.includes(second.id), 'the prior row should receive the reciprocal contradiction link');

const diagnostics = memory.memoryAccountingDiagnostics();
assert.equal(diagnostics.exact, true,
  `encode-time reverse contradiction-link updates must reconcile bytes; drift=${diagnostics.driftBytes}`);
assert.equal(memory.indexDiagnostics().pass, true, 'link updates must not break canonical indexes');

console.log('MEMORYOS2_BYTE_ACCOUNTING_WORKPASS70=PASS');
