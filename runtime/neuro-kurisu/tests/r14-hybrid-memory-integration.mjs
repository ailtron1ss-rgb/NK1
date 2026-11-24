import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const fields={
  salience:.6, emotionalWeight:.1, identityRelevance:.1, goalRelevance:.2,
  socialRelevance:.1, predictionError:.2, confidence:.8,
  epistemicStatus:'belief', source:'r14-test', entities:[], semanticLinks:[], temporalLinks:[], causalLinks:[],
};

const os=new MemoryOS2();
const exact=os.encode({...fields,kind:'semantic',content:'Build identifier ARG-2026-991 for policy cache.'});
os.encode({...fields,kind:'episodic',content:'The policy cache was not rebuilt after the deployment.'});
os.encode({...fields,kind:'episodic',content:'The policy cache was rebuilt after the deployment.'});

const exactResults=os.retrieve('ARG-2026-991',3);
assert.equal(exactResults[0]?.id,exact.id,'identifier-like queries must preserve exact lexical evidence');
assert.equal(os.retrievalDiagnostics().hybridRetrieval,true);
assert.equal(os.retrievalDiagnostics().bm25Enabled,true);
assert.equal(os.retrievalDiagnostics().identifierBias,true);

const contradictionItems=os.snapshot().items.filter(x=>(x.contradictionLinks?.length??0)>0);
assert.ok(contradictionItems.length>=1,'semantically similar opposite-polarity memories should be linked as contradictions');
assert.ok(os.contradictionDiagnostics().linkedPairs>=1);

const restored=new MemoryOS2();
restored.restore(os.snapshot());
const restoredResults=restored.retrieve('policy cache rebuilt deployment',5);
assert.ok(restoredResults.length>0,'retrieval must survive restore');
assert.ok(restored.retrievalDiagnostics().bm25CandidateCount>0,'restored index must rebuild BM25 document frequency');

console.log(JSON.stringify({
  pass:true,
  exactTop:exactResults[0]?.id,
  hybrid:restored.retrievalDiagnostics(),
  contradictions:restored.contradictionDiagnostics(),
  items:restored.size(),
}));
