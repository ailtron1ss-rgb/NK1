import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const m=new MemoryOS2();
const base={kind:'episodic',salience:.4,emotionalWeight:.1,identityRelevance:.2,goalRelevance:.4,socialRelevance:.2,predictionError:.2,confidence:.7,epistemicStatus:'belief',source:'benchmark',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[]};
for(let i=0;i<1600;i++){
  const topic=i%5===0?'identity continuity':i%7===0?'battery thermal':i%11===0?'causal research':'generic cognition';
  m.encode({...base,content:`record-${i} ${topic} durable context token-${i}`},{clone:false});
}
const start=process.hrtime.bigint();
const hits=m.retrieve('identity continuity',8);
const ms=Number(process.hrtime.bigint()-start)/1e6;
const d=m.retrievalDiagnostics();
assert.equal(m.size(),1600);
assert.ok(hits.length>0);
assert.ok(d.candidateCount<d.totalItems);
assert.ok(d.pruning01>0.5);
console.log('BIG_PASS_52_MEMORY_INDEX=PASS');
console.log(JSON.stringify({items:d.totalItems,candidates:d.candidateCount,pruning01:d.pruning01.toFixed(3),latencyMs:Number(ms.toFixed(3)),hits:hits.length}));
