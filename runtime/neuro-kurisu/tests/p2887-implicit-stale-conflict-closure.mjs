import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const m = new MemoryOS2();
const base = 1_000_000;
const old = m.encode({
  content:'Alice lives in Berlin', kind:'semantic', source:'user', tags:[], context:{subject:'alice',attribute:'city',value:'berlin'},
  salience:.7, emotionalWeight:.1, identityRelevance:.4, goalRelevance:.2, socialRelevance:.2, predictionError:.1,
  confidence:.85, epistemicStatus:'fact', entities:['alice','berlin'], semanticLinks:[], temporalLinks:[], causalLinks:[], contradictionLinks:[],
  validFromAt:base, validUntilAt:null, observedAt:base, supersedesId:null, supersededById:null, revisionGroupId:'g:alice-city', revisionSequence:1
});
const newer = m.encode({
  content:'Alice lives in Paris', kind:'semantic', source:'user', tags:[], context:{subject:'alice',attribute:'city',value:'paris'},
  salience:.75, emotionalWeight:.1, identityRelevance:.5, goalRelevance:.2, socialRelevance:.2, predictionError:.1,
  confidence:.9, epistemicStatus:'fact', entities:['alice','paris'], semanticLinks:[], temporalLinks:[], causalLinks:[], contradictionLinks:[],
  validFromAt:base+10_000, validUntilAt:null, observedAt:base+10_000, supersedesId:null, supersededById:null, revisionGroupId:'g:new', revisionSequence:1
});
const result = m.adjudicateImplicitConflicts({at:base+10_001,limit:16,pairBudget:64});
assert.equal(result.resolved,1);
const oldAfter=m.get(old.id); const newAfter=m.get(newer.id);
assert.equal(oldAfter?.supersededById,newer.id);
assert.equal(oldAfter?.validUntilAt,base+10_000);
assert.equal(newAfter?.supersedesId,old.id);
const current=m.retrieve('where does Alice live?',4).map(x=>x.id);
assert.ok(current.includes(newer.id));
assert.ok(!current.includes(old.id));
const d=m.implicitConflictDiagnostics();
assert.equal(d.resolved,1);

function encodeConflictMemory(store, { id, source, content, observedAt, imported = false }) {
  return store.encode({
    id,
    content,
    kind: 'semantic',
    source,
    tags: imported ? ['external-import', 'hmx-1x', 'unverified-source'] : ['local'],
    context: {
      subject: 'alice',
      attribute: 'residence',
      value: content.includes('not live') ? 'not-berlin' : 'berlin',
      ...(imported ? { hmxExportId: 'export-' + id, hmxSourceInstance: source.slice(4), hmxSourceRef: id } : {}),
    },
    salience: 0.7, emotionalWeight: 0.1, identityRelevance: 0.4,
    goalRelevance: 0.2, socialRelevance: 0.2, predictionError: 0.1,
    confidence: imported ? 0.25 : 0.9,
    epistemicStatus: imported ? 'hypothesis' : 'fact',
    provenanceClass: imported ? 'external' : 'user',
    sourceAuthority01: imported ? 0.2 : 0.86,
    independenceKey: imported ? source : source + ':' + id,
    entities: ['alice', 'berlin'],
    semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
    validFromAt: observedAt, validUntilAt: null, observedAt,
    supersedesId: null, supersededById: null,
    revisionGroupId: id, revisionSequence: 1,
  }, { forceDistinct: true });
}

// An unverified imported HMX hypothesis must not be auto-closed by a newer local
// polarity/context heuristic. Both claims remain available for explicit adjudication.
const hmxThenLocal = new MemoryOS2();
const importedOlder = encodeConflictMemory(hmxThenLocal, {
  id: 'hmx-older', source: 'hmx:donor-a', content: 'Alice lives in Berlin',
  observedAt: base + 20_000, imported: true,
});
const localNewer = encodeConflictMemory(hmxThenLocal, {
  id: 'local-newer', source: 'user', content: 'Alice does not live in Berlin',
  observedAt: base + 30_000,
});
const hmxThenLocalScan = hmxThenLocal.adjudicateImplicitConflicts({ at: base + 30_001, limit: 16, pairBudget: 64 });
assert.equal(hmxThenLocalScan.resolved, 0);
assert.equal(hmxThenLocal.get(importedOlder.id)?.validUntilAt, null);
assert.equal(hmxThenLocal.get(importedOlder.id)?.supersededById, null);
assert.equal(hmxThenLocal.get(localNewer.id)?.supersedesId, null);

// The guard is symmetric: a newer unverified HMX claim cannot close a local fact.
const localThenHmx = new MemoryOS2();
const localOlder = encodeConflictMemory(localThenHmx, {
  id: 'local-older', source: 'user', content: 'Alice lives in Berlin',
  observedAt: base + 40_000,
});
const importedNewer = encodeConflictMemory(localThenHmx, {
  id: 'hmx-newer', source: 'hmx:donor-b', content: 'Alice does not live in Berlin',
  observedAt: base + 50_000, imported: true,
});
const localThenHmxScan = localThenHmx.adjudicateImplicitConflicts({ at: base + 50_001, limit: 16, pairBudget: 64 });
assert.equal(localThenHmxScan.resolved, 0);
assert.equal(localThenHmx.get(localOlder.id)?.validUntilAt, null);
assert.equal(localThenHmx.get(importedNewer.id)?.validUntilAt, null);

// Different external HMX lineages are not interchangeable evidence and must not
// supersede one another merely because their text has opposing polarity.
const hmxAcrossDonors = new MemoryOS2();
const donorA = encodeConflictMemory(hmxAcrossDonors, {
  id: 'hmx-donor-a', source: 'hmx:donor-a', content: 'Alice lives in Berlin',
  observedAt: base + 60_000, imported: true,
});
const donorB = encodeConflictMemory(hmxAcrossDonors, {
  id: 'hmx-donor-b', source: 'hmx:donor-b', content: 'Alice does not live in Berlin',
  observedAt: base + 70_000, imported: true,
});
const donorScan = hmxAcrossDonors.adjudicateImplicitConflicts({ at: base + 70_001, limit: 16, pairBudget: 64 });
assert.equal(donorScan.resolved, 0);
assert.equal(hmxAcrossDonors.get(donorA.id)?.validUntilAt, null);
assert.equal(hmxAcrossDonors.get(donorB.id)?.validUntilAt, null);

console.log(JSON.stringify({ok:true,resolved:d.resolved,staleRetrievalsAvoided:d.staleRetrievalsAvoided,hmxConflictGuard:true,current}));
