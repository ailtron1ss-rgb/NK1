import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2({ embeddingProvider: null });
memory.encode({
  id: 'byte-roundtrip-row',
  content: 'Restore must preserve byte estimates for an ordinary canonical memory.',
  kind: 'episodic',
  source: 'memoryos2-byte-roundtrip-workpass70',
  tags: ['restore', 'bytes'],
  context: { fixture: 'roundtrip' },
  salience: .7,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: ['memoryos2', 'restore'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });

const snapshot = memory.snapshot();
const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(structuredClone(snapshot));

assert.equal(restored.snapshot().estimatedBytes, snapshot.estimatedBytes,
  'restore must not change the canonical byte estimate');
assert.equal(restored.memoryAccountingDiagnostics().exact, true,
  `restored byte accounting must be exact; drift=${restored.memoryAccountingDiagnostics().driftBytes}`);

console.log('MEMORYOS2_BYTE_ROUNDTRIP_WORKPASS70=PASS');
