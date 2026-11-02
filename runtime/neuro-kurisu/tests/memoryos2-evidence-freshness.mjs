import assert from 'node:assert/strict';
import { MemoryOS2, memoryEvidenceFreshness01 } from '../src/organism/developmental/MemoryOS2.ts';

const day = 86_400_000;
const base = Date.now();
const memory = new MemoryOS2({ embeddingProvider: null });
const content = 'NK1 continuity memory preserves evidence provenance and temporal validity.';

const shared = {
  content,
  source: 'evidence-freshness-regression',
  salience: 0.6,
  emotionalWeight: 0.2,
  identityRelevance: 0.2,
  goalRelevance: 0.2,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: ['NK1'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: base - 30 * day,
  observedAt: base - 30 * day,
  evidenceFreshnessAt: base - 10 * day,
};

memory.encode({ ...shared, id: 'a-volatile', kind: 'semantic', freshnessHalfLifeMs: day }, { forceDistinct: true });
memory.encode({ ...shared, id: 'z-durable', kind: 'identity' }, { forceDistinct: true });

// Make access and validity signals identical. The only meaningful distinction is
// explicit evidence perishability; an old read must not masquerade as fresh evidence.
const snapshot = memory.snapshot();
for (const row of snapshot.items) {
  row.createdAt = base - 30 * day;
  row.lastAccessAt = base - 31 * day;
  row.validFromAt = base - 30 * day;
  row.observedAt = base - 30 * day;
  row.evidenceFreshnessAt = base - 10 * day;
  row.salience = 0.6;
  row.emotionalWeight = 0.2;
  row.identityRelevance = 0.2;
  row.goalRelevance = 0.2;
  row.socialRelevance = 0.1;
  row.predictionError = 0.1;
  row.temperature01 = 0.2;
}

const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(snapshot);
const rows = restored.previewRetrieve('temporal validity evidence provenance', 2);
assert.equal(rows.length, 2);
assert.equal(rows[0].id, 'z-durable',
  'durable memory must outrank an equally worded stale volatile observation');
assert.equal(rows.find(row => row.id === 'a-volatile')?.freshnessHalfLifeMs, day,
  'explicit freshness half-life must survive snapshot/restore');
assert.equal(rows.find(row => row.id === 'z-durable')?.freshnessHalfLifeMs, undefined,
  'legacy/durable memories must not receive an invented decay horizon');


assert.equal(memoryEvidenceFreshness01({
  evidenceFreshnessAt: base - 2 * day,
  freshnessHalfLifeMs: day,
  createdAt: base - 30 * day,
  observedAt: base - 2 * day,
}, base), 0.25, 'two evidence half-lives should leave one quarter of freshness');
assert.equal(memoryEvidenceFreshness01({
  evidenceFreshnessAt: base - 365 * day,
  freshnessHalfLifeMs: null,
  createdAt: base - 365 * day,
  observedAt: base - 365 * day,
}, base), 1, 'explicitly durable memories must not decay');
assert.equal(memoryEvidenceFreshness01({
  evidenceFreshnessAt: base - 365 * day,
  createdAt: base - 365 * day,
  observedAt: base - 365 * day,
}, base), 1, 'legacy memories without a horizon must remain durable');

// A renewed observation from the same independent source is still fresher
// evidence. Re-ingestion must advance evidenceFreshnessAt, not only access time.
const refreshMemory = new MemoryOS2({ embeddingProvider: null });
const refreshContent = 'A temporary service endpoint remains healthy after a new device probe.';
refreshMemory.encode({
  id: 'refresh-same-lineage',
  content: refreshContent,
  kind: 'semantic',
  source: 'device-health-probe',
  observedAt: base - 10 * day,
  evidenceFreshnessAt: base - 10 * day,
  freshnessHalfLifeMs: day,
  salience: 0.5,
  confidence: 0.8,
  epistemicStatus: 'fact',
});
const refreshed = refreshMemory.encode({
  content: refreshContent,
  kind: 'semantic',
  source: 'device-health-probe',
  observedAt: base,
  evidenceFreshnessAt: base,
  freshnessHalfLifeMs: day,
  salience: 0.5,
  confidence: 0.8,
  epistemicStatus: 'fact',
});
assert.equal(refreshed.evidenceFreshnessAt, base,
  'same-lineage new evidence must refresh evidenceFreshnessAt');

const diagnostics = restored.indexDiagnostics();
assert.equal(diagnostics.pass, true, 'freshness metadata must not desynchronize canonical indexes');
console.log('MEMORYOS2_EVIDENCE_FRESHNESS=PASS', JSON.stringify({
  ranking: rows.map(row => row.id),
  volatileHalfLifeMs: rows.find(row => row.id === 'a-volatile')?.freshnessHalfLifeMs,
  durableHasNoExpiry: rows.find(row => row.id === 'z-durable')?.freshnessHalfLifeMs === undefined,
  indexIntegrity: diagnostics.pass,
}));
