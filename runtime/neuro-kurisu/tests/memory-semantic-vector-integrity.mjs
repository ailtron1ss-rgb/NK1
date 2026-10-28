import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now=2_000_000_000_000;
const diagnostics=()=>({
  configured:true,provider:'ollama',model:'workpass605-fake',endpoint:'http://127.0.0.1:11434',
  cacheEntries:0,cacheHits:0,cacheMisses:0,requests:1,failures:0,lastError:null,lastLatencyMs:0,redactedInputs:0,
});
function makeProvider(makeVectors){
  return {
    providerId:'workpass605-fake-provider',
    modelId:'workpass605-fake-model',
    async embedBatch(texts){return makeVectors(texts);},
    diagnostics,
  };
}
function createMemory(provider){
  const memory=new MemoryOS2({embeddingProvider:provider});
  const rows=[
    {id:'semantic-bad-vector',content:'semantic cue needle poisoned embedding'},
    {id:'semantic-good-vector',content:'semantic cue needle healthy embedding'},
  ];
  for(const row of rows){
    memory.encode({
      id:row.id,content:row.content,kind:'semantic',source:'workpass605-fixture',tags:['test'],
      context:{area:'semantic-vector-integrity'},salience:.6,emotionalWeight:.2,identityRelevance:.2,
      goalRelevance:.2,socialRelevance:.1,predictionError:.1,confidence:.9,epistemicStatus:'fact',
      entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],
      validFromAt:now-10_000,observedAt:now-1_000,provenanceClass:'external',sourceAuthority01:.9,
    });
  }
  return memory;
}
const query='semantic cue needle';
const temporal={temporalMode:'at',asOfAt:now};
const perf={maxIndexItems:8,maxLexicalPool:8,providerTimeoutMs:1000};

// A query vector is the root for cosine comparisons: malformed or zero-norm query
// vectors must turn semantic mode off and return deterministic lexical results.
for(const invalidQueryVector of [[Number.NaN,0],[Number.POSITIVE_INFINITY,1],[0,0],[]]){
  const provider=makeProvider(texts=>[
    invalidQueryVector,
    ...texts.slice(1).map(()=>[1,0]),
  ]);
  const memory=createMemory(provider);
  const expected=memory.previewRetrieve(query,2,0,0,temporal).map(row=>row.id);
  const response=await memory.previewRetrieveWithEmbeddings(query,2,0,0,temporal,perf);
  assert.equal(response.semantic.enabled,false,'invalid query vectors must disable semantic ranking');
  assert.equal(response.semantic.fallbackReason,'invalid-query-embedding-vector');
  assert.deepEqual(response.items.map(row=>row.id),expected,'invalid query vectors must fall back to canonical lexical retrieval');
  assert.equal(response.semantic.indexedItems,0,'invalid query vectors must not populate the semantic cache');
}

// Invalid document vectors are dropped from the derived index while valid rows
// continue to participate in semantic ranking.
{
  const provider=makeProvider(texts=>[
    [1,0],
    ...texts.slice(1).map(text=>text.includes('poisoned')?[Number.NaN,0]:[0,1]),
  ]);
  const memory=createMemory(provider);
  const response=await memory.previewRetrieveWithEmbeddings(query,2,0,0,temporal,perf);
  assert.equal(response.semantic.enabled,true);
  assert.equal(response.semantic.newlyIndexed,1,'only a finite, non-zero, dimension-compatible vector may be cached');
  assert.equal(response.semantic.indexedItems,1);
  assert.deepEqual(response.items.map(row=>row.id),['semantic-good-vector'],'malformed document embeddings must not rank as semantic evidence');
}

// If every document vector is malformed, do not return an empty semantic result
// while valid lexical matches exist.
{
  const provider=makeProvider(texts=>texts.map((_,index)=>index===0?[1,0]:[0,0]));
  const memory=createMemory(provider);
  const expected=memory.previewRetrieve(query,2,0,0,temporal).map(row=>row.id);
  const response=await memory.previewRetrieveWithEmbeddings(query,2,0,0,temporal,perf);
  assert.equal(response.semantic.enabled,false);
  assert.equal(response.semantic.fallbackReason,'no-valid-semantic-candidates');
  assert.deepEqual(response.items.map(row=>row.id),expected);
}

console.log('MEMORY_SEMANTIC_VECTOR_INTEGRITY=PASS');
