import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2({ signalFusionProfile: 'balanced', embeddingProvider: null });
const now = Date.now();
memory.encode({
  id: 'doctor-healthy-record',
  content: 'Unique memory doctor fixture record.',
  kind: 'semantic',
  source: 'workpass314-memory-doctor',
  tags: [],
  context: {},
  salience: .6,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .3,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 1000,
  observedAt: now - 500,
});
const healthy = memory.doctor({ at: now });
assert.equal(healthy.pass, true, 'a clean canonical memory snapshot should pass doctor');
assert.equal(healthy.issueCount, 0, 'a clean snapshot should not report memory hygiene issues');

const damagedSnapshot = memory.snapshot();
damagedSnapshot.items[0].contentHash = 'not-the-canonical-content-hash';
damagedSnapshot.items[0].semanticLinks = ['missing-memory-doctor-target'];
damagedSnapshot.items[0].supersedesId = 'missing-memory-revision';
damagedSnapshot.items[0].observedAt = now + 3_600_000;

const damaged = new MemoryOS2({ signalFusionProfile: 'balanced', embeddingProvider: null });
damaged.restore(damagedSnapshot);
const repairedHashAfterRestore = damaged.snapshot().items[0].contentHash;
assert.notEqual(repairedHashAfterRestore, 'not-the-canonical-content-hash',
  'restore should repair the content hash before the record is indexed');
const restoreDiagnostics = damaged.restoreDiagnostics();
assert.equal(restoreDiagnostics.contentHashMismatchesRepaired, 1,
  'restore must retain evidence that a serialized content hash was repaired');
const report = damaged.doctor({ at: now });
assert.equal(report.readOnly, true, 'doctor must never repair or rewrite memory automatically');
assert.equal(report.pass, false, 'content hash inconsistency should fail doctor');
assert.ok(report.counts.hashMismatch > 0, 'doctor should detect altered canonical content hashes');
assert.ok(report.counts.danglingRevision > 0, 'doctor should detect unresolved revision pointers');
assert.ok(report.counts.danglingLinks > 0, 'doctor should detect unresolved relationship links');
assert.ok(report.counts.futureEvidence > 0, 'doctor should detect future-dated evidence');
assert.ok(report.issues.length <= 64, 'doctor output must remain bounded');

const capped = damaged.doctor({ at: now, maxIssues: 1 });
assert.equal(capped.issues.length, 1, 'doctor must cap detailed issue payloads');
assert.equal(capped.errors, 1, 'severity counters must include issues beyond the display cap');
assert.ok(capped.warnings > 0, 'warning counters must include issues beyond the display cap');
assert.equal(capped.truncated, true, 'doctor must mark a capped issue list as truncated');
assert.equal(damaged.snapshot().items[0].contentHash, repairedHashAfterRestore,
  'read-only doctor must not mutate the already-normalized record it reports');

console.log('WORKPASS314_MEMORY_DOCTOR=PASS', JSON.stringify({
  cleanPass: healthy.pass,
  damagedPass: report.pass,
  errors: report.errors,
  warnings: report.warnings,
  capped: capped.truncated,
  restoreHashRepairs: restoreDiagnostics.contentHashMismatchesRepaired,
}));
