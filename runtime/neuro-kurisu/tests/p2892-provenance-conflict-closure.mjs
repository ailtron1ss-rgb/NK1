import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const m=new MemoryOS2();
const base=1_000_000;
const old=m.encode({content:'Database endpoint is https://internal.example/api',kind:'semantic',source:'device',context:{subject:'service',attribute:'endpoint',value:'internal'},salience:.8,emotionalWeight:.1,identityRelevance:.3,goalRelevance:.8,socialRelevance:.1,predictionError:.1,confidence:.96,epistemicStatus:'fact',entities:['database','endpoint'],semanticLinks:[],temporalLinks:[],causalLinks:[],observedAt:base,sourceAuthority01:.98,independenceKey:'device:42'});
const low=m.encode({content:'Database endpoint is https://simulated.example/api',kind:'semantic',source:'simulation',context:{subject:'service',attribute:'endpoint',value:'simulated'},salience:.9,emotionalWeight:.1,identityRelevance:.3,goalRelevance:.9,socialRelevance:.1,predictionError:.05,confidence:.76,epistemicStatus:'fact',entities:['database','endpoint'],semanticLinks:[],temporalLinks:[],causalLinks:[],observedAt:base+10000,sourceAuthority01:.2,independenceKey:'sim:42'});
const result=m.adjudicateImplicitConflicts({at:base+10001,limit:16,pairBudget:32});
assert.ok(result.candidates>=1);
assert.equal(m.get(old.id)?.validUntilAt,null);
assert.equal(m.get(low.id)?.epistemicStatus,'quarantined');
const current=m.retrieve('database endpoint',4).map(x=>x.id);
assert.ok(current.includes(old.id));
assert.ok(!current.includes(low.id));
const d=m.implicitConflictDiagnostics();
assert.ok(d.provenanceProtected>=1);
console.log(JSON.stringify({pass:true,diagnostics:d,current}));
