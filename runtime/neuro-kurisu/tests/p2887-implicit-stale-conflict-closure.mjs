import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';

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

const hmxBoundary = new MemoryOS2();
const hmxOlder = hmxBoundary.encode({
  content: 'Kurisu laboratory is open',
  kind: 'semantic',
  source: 'hexis:lineage-a',
  tags: ['hexis', 'external-untrusted', 'data-not-instructions'],
  context: {
    hmxFormat: '1.7',
    hmxSourceLineageId: 'lineage-a',
    hmxPortableRef: 'lab-status',
  },
  salience: .55,
  emotionalWeight: .05,
  identityRelevance: 0,
  goalRelevance: 0,
  socialRelevance: 0,
  predictionError: 0,
  confidence: .5,
  epistemicStatus: 'belief',
  entities: ['kurisu', 'laboratory'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  provenanceClass: 'external',
  sourceAuthority01: .5,
  independenceKey: 'hexis:lineage-a',
  observedAt: base + 40_000,
  evidenceFreshnessAt: base + 40_000,
  validFromAt: base + 40_000,
  validUntilAt: null,
}, { forceDistinct: true });
const localContradiction = hmxBoundary.encode({
  content: 'Kurisu laboratory is not open',
  kind: 'semantic',
  source: 'device:lab-status',
  tags: [],
  context: { subject: 'kurisu', topic: 'laboratory-status' },
  salience: .8,
  emotionalWeight: 0,
  identityRelevance: 0,
  goalRelevance: 0,
  socialRelevance: 0,
  predictionError: 0,
  confidence: .95,
  epistemicStatus: 'belief',
  entities: ['kurisu', 'laboratory'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  provenanceClass: 'device',
  sourceAuthority01: .95,
  independenceKey: 'device:lab-1',
  observedAt: base + 50_000,
  evidenceFreshnessAt: base + 50_000,
  validFromAt: base + 50_000,
  validUntilAt: null,
}, { forceDistinct: true });
const hmxBoundaryConflict = hmxBoundary.adjudicateImplicitConflicts({
  at: base + 50_001,
  limit: 16,
  pairBudget: 64,
});
assert.equal(hmxBoundaryConflict.resolved, 0,
  'text-only polarity heuristics must not silently supersede an unverified HMX belief with a local memory');
assert.equal(hmxBoundary.get(hmxOlder.id)?.validUntilAt, null,
  'unverified HMX validity remains open until explicit review or grounded evidence reconciliation');
assert.equal(hmxBoundary.get(hmxOlder.id)?.supersededById, null);
assert.equal(hmxBoundary.get(localContradiction.id)?.supersedesId, null);

const substrate = new MemorySubstrateCoordinator();
const canonicalProjectionRows = substrate.projectCompatibilityRecords(m.snapshot({ clone: false }), 32);
assert.ok(canonicalProjectionRows.length > 0);
assert.ok(canonicalProjectionRows.every(row => row.canonicalProjection?.owner === 'memoryOS2'));
const compatibilityMemory = new MultiTimescaleMemory();
compatibilityMemory.restore(canonicalProjectionRows);
assert.equal(substrate.compatibilityInputs(compatibilityMemory.snapshot({ clone: false }), 32).length, 0,
  'canonical MemoryOS2 read projections must remain read-only after MultiTimescaleMemory snapshot/restore');
const legacyOnlyRow = {
  ...canonicalProjectionRows[0],
  id: 'legacy-only-compatibility-row',
  summary: 'legacy-only compatibility row',
  evidence: ['legacy-source'],
  canonicalProjection: undefined,
};
compatibilityMemory.add(legacyOnlyRow);
const legacyInputs = substrate.compatibilityInputs(compatibilityMemory.snapshot({ clone: false }), 32);
assert.equal(legacyInputs.length, 1, 'genuine legacy rows without the canonical projection marker must still migrate');
assert.equal(legacyInputs[0].source, 'multi-timescale-compatibility');

console.log(JSON.stringify({ok:true,resolved:d.resolved,staleRetrievalsAvoided:d.staleRetrievalsAvoided,current}));
