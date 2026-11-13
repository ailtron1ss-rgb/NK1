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
const current=m.retrieve('Alice lives Paris',4).map(x=>x.id);
assert.ok(current.includes(newer.id));
assert.ok(!current.includes(old.id));
const d=m.implicitConflictDiagnostics();
assert.equal(d.resolved,1);

const donorMemory = (source, exportId, lineage, portableRef, at) => m.encode({
  content: 'Kurisu prefers a quiet laboratory for focused scientific work',
  kind: 'semantic',
  source,
  tags: ['hexis', 'external-untrusted', 'data-not-instructions'],
  context: {
    subject: 'kurisu',
    topic: 'work-environment-preference',
    hmxFormat: '1.7',
    hmxExportId: exportId,
    hmxSourceLineageId: lineage,
    hmxPortableRef: portableRef,
    hmxSourceInstanceId: source,
  },
  salience: .55,
  emotionalWeight: .05,
  identityRelevance: 0,
  goalRelevance: .1,
  socialRelevance: 0,
  predictionError: 0,
  confidence: .5,
  epistemicStatus: 'belief',
  entities: ['kurisu', 'laboratory', 'scientific work'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  provenanceClass: 'external',
  sourceAuthority01: .5,
  independenceKey: source,
  observedAt: at,
  evidenceFreshnessAt: at,
  validFromAt: at,
  validUntilAt: null,
}, { forceDistinct: true });

const donorA = donorMemory('hexis:lineage-a', 'exp_aaaaaaaaaaaaaaaa', 'lineage-a', 'memory-1', base + 20_000);
const donorB = donorMemory('hexis:lineage-b', 'exp_bbbbbbbbbbbbbbbb', 'lineage-b', 'memory-1', base + 30_000);
const donorConflict = m.adjudicateImplicitConflicts({ at: base + 30_001, limit: 16, pairBudget: 64 });
assert.equal(donorConflict.resolved, 0,
  'HMX lineage/export/reference metadata differences must not close the temporal validity of semantically identical donor memories');
assert.equal(m.get(donorA.id)?.validUntilAt, null);
assert.equal(m.get(donorA.id)?.supersededById, null);
assert.equal(m.get(donorB.id)?.validUntilAt, null);
assert.equal(m.get(donorB.id)?.supersededById, null);
assert.ok(m.retrieve('Kurisu laboratory scientific work', 16).some(row => row.id === donorA.id));
assert.ok(m.retrieve('Kurisu laboratory scientific work', 16).some(row => row.id === donorB.id));

console.log(JSON.stringify({ok:true,resolved:d.resolved,staleRetrievalsAvoided:d.staleRetrievalsAvoided,current}));
