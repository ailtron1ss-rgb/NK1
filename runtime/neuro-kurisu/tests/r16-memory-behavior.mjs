import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
const m=new MemoryOS2(); const now=Date.now();
for(let i=0;i<1600;i++) m.encode({content:`r16 memory candidate ${i} identifier ${i%32}`,kind:'episodic',source:'r16',salience:.3,emotionalWeight:.1,identityRelevance:.1,goalRelevance:.2,socialRelevance:.1,predictionError:.2,confidence:.7,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-i*1000});
const before=m.retrieve('identifier 7',8); const d=m.retrievalDiagnostics();
assert.ok(before.length>0); assert.ok(d.bm25Enabled);
const after=m.retrieve('identifier 7',8); assert.ok(after.length>0);
console.log(JSON.stringify({pass:true,candidates:d.bm25CandidateCount,results:after.length},null,2));
