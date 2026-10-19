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
console.log(JSON.stringify({ok:true,resolved:d.resolved,staleRetrievalsAvoided:d.staleRetrievalsAvoided,current}));
