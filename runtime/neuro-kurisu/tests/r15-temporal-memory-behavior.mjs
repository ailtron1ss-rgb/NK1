import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const base=Date.now();
const os=new MemoryOS2();
const make=(content, extra={})=>os.encode({
  content,kind:'semantic',source:'r15-test',salience:.72,emotionalWeight:.2,identityRelevance:.1,goalRelevance:.4,socialRelevance:.1,predictionError:.2,confidence:.86,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],...extra
},{clone:false});

const old=make('Project KURISU-741 runs on the mobile continuity branch.',{validFromAt:base-10000,revisionGroupId:'project-kurisu',revisionSequence:1});
const revised=os.reviseContent(old.id,'Project KURISU-741 runs on the verified continuity branch.',{validAt:base,reason:'verified branch correction'});
assert(revised);
assert.equal(old.validUntilAt,base);
assert.equal(revised.supersedesId,old.id);
assert.equal(old.supersededById,revised.id);
assert.equal(os.temporalChain(old.id).length,2);

const before=os.retrieve('KURISU-741 branch',3);
assert.equal(before[0].id,revised.id,'current retrieval must prefer the valid revision');
const historical=os.retrieve('KURISU-741 branch',3,0,0,{temporalMode:'at',asOfAt:base-1});
assert.equal(historical[0].id,old.id,'point-in-time retrieval must recover the prior revision');
const after=os.retrieve('KURISU-741 branch',3,0,0,{temporalMode:'at',asOfAt:base+1});
assert.equal(after[0].id,revised.id,'point-in-time retrieval after revision must select the new revision');

const contradictionA=make('KURISU-741 does not use volatile cache memory.',{validFromAt:base-5000});
const contradictionB=make('KURISU-741 uses volatile cache memory.',{validFromAt:base-4000});
assert(contradictionA.contradictionLinks?.includes(contradictionB.id) || contradictionB.contradictionLinks?.includes(contradictionA.id));
const contradictionDiagnostics=os.contradictionDiagnostics();
assert(contradictionDiagnostics.linkedPairs>=2);

assert.equal(os.forgetById(contradictionA.id,'r15-test-forget'),true);
assert.equal(os.get(contradictionA.id),null,'forget must remove stale item-index entries');
const diagnosticsAfterForget=os.temporalDiagnostics();
assert(diagnosticsAfterForget.current>=1);

// Independent behavioral holdout: exact identifiers should be actionable, not decorative.
const cases=[
  ['RUN-501','Run 501 must prefer external-world evidence.'],
  ['RUN-502','Run 502 must prefer verified replay evidence.'],
  ['RUN-503','Run 503 must quarantine contradictory simulator-only claims.'],
  ['RUN-504','Run 504 must preserve durable identity anchors.'],
];
for(const [id,content] of cases) make(`${id}: ${content}`,{goalRelevance:.72,identityRelevance:.45});
// Add semantically similar decoys without identifiers to create a real ranking test.
for(let i=0;i<10;i++)make(`Evidence policy for continuity verification and durable memory consistency decoy ${i}.`,{salience:.55,goalRelevance:.35,confidence:.72});
let hit=0;
for(const [id] of cases){
  const rows=os.retrieve(`What is the policy for ${id}?`,3);
  if(rows.some(r=>r.content.startsWith(id+':')))hit++;
}
const holdoutRecallAt3=hit/cases.length;
assert(holdoutRecallAt3>=.75,`holdout Recall@3 too low: ${holdoutRecallAt3}`);
// A near-match must not be accepted as an exact identifier match.
const nearMiss=os.retrieve('What is the policy for RUN-5011?',3);
assert(!nearMiss.some(row=>row.content.startsWith('RUN-501:')),
  'identifier recall must reject a prefix-only collision such as RUN-501 vs RUN-5011');

console.log(JSON.stringify({
  pass:true,
  revisionChain:os.temporalChain(revised.id).map(x=>({id:x.id,seq:x.revisionSequence,validFromAt:x.validFromAt,validUntilAt:x.validUntilAt})),
  temporalDiagnostics:os.temporalDiagnostics(),
  contradictionDiagnostics,
  holdoutRecallAt3,
  retrievalDiagnostics:os.retrievalDiagnostics(),
}));
