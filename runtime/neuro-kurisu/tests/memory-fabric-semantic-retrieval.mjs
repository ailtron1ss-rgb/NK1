import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const originalRuntimeEnabled=process.env.NK_EMBEDDINGS_RUNTIME_ENABLED;
const originalRuntimeBudget=process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS;
const originalTimeout=process.env.NK_EMBEDDINGS_TIMEOUT_MS;
const now=Date.now();
const query='quantum violet protocol';
const provider={
  providerId:'ollama:http://127.0.0.1:11434/workpass607-fake',
  modelId:'workpass607-fake',
  async embedBatch(texts){
    return texts.map((text,index)=>index===0?[1,0]:String(text).includes('semantic-target-token')?[1,0]:[0,1]);
  },
  diagnostics(){
    return {configured:true,provider:'ollama',model:'workpass607-fake',endpoint:'http://127.0.0.1:11434',
      cacheEntries:0,cacheHits:0,cacheMisses:0,requests:1,failures:0,lastError:null,lastLatencyMs:0,redactedInputs:0};
  },
};
function createRuntime(){
  const memoryOS=new MemoryOS2({embeddingProvider:provider});
  const base={
    kind:'semantic',source:'workpass607-fixture',tags:['test'],context:{area:'semantic-runtime-wiring'},
    salience:.65,emotionalWeight:.2,identityRelevance:.2,goalRelevance:.2,socialRelevance:.1,
    predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],
    temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-60_000,observedAt:now-1_000,
    provenanceClass:'external',sourceAuthority01:.9,
  };
  memoryOS.encode({id:'semantic-target',content:'semantic-target-token spectral harmonics cascade archive',...base});
  for(let index=0;index<8;index++){
    memoryOS.encode({id:`lexical-distractor-${index}`,content:`quantum violet protocol reference document ${index}`,...base});
  }
  const unified=new UnifiedMemorySystem();
  const fabric=new MemoryFabric(memoryOS,new EventLog(),new MultiTimescaleMemory(),
    new MemorySubstrateCoordinator(),unified,new P62MemoryFabric(),new SemanticMemoryGraph());
  return {memoryOS,unified,fabric};
}
function restoreEnv(name,value){if(value===undefined)delete process.env[name];else process.env[name]=value;}
try{
  process.env.NK_EMBEDDINGS_RUNTIME_ENABLED='0';
  process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS='1000';
  process.env.NK_EMBEDDINGS_TIMEOUT_MS='1000';
  {
    const {memoryOS,unified,fabric}=createRuntime();
    const rows=await fabric.retrieveForCognition(query,1);
    assert.notEqual(rows[0]?.id,'semantic-target','disabled runtime must use canonical lexical retrieval');
    assert.equal(fabric.inspect().stats.retrievals,1,'one cognition request must count exactly one retrieval');
    assert.equal(fabric.inspect().stats.retrievalHits,1);
    assert.equal(unified.snapshot().retrieveCount,1,'the chosen lexical result is recorded once');
    assert.equal(unified.snapshot().recentQueries.length,1);
    const counts=new Map(memoryOS.snapshot().items.map(row=>[row.id,row.retrievalCount]));
    assert.equal(counts.get(rows[0].id),1,'only the selected lexical row receives an access update');
    assert.equal(counts.get('semantic-target'),0);
  }
  {
    process.env.NK_EMBEDDINGS_RUNTIME_ENABLED='1';
    const {memoryOS,unified,fabric}=createRuntime();
    const rows=await fabric.retrieveForCognition(query,1,0,0);
    assert.equal(rows[0]?.id,'semantic-target','enabled runtime should use the semantic candidate selected by the fake provider');
    assert.equal(fabric.inspect().stats.retrievals,1,'lexical preview must not be counted in addition to the semantic result');
    assert.equal(fabric.inspect().stats.retrievalHits,1);
    assert.equal(unified.snapshot().retrieveCount,1,'semantic result is recorded exactly once');
    assert.equal(unified.snapshot().recentQueries.length,1);
    const counts=new Map(memoryOS.snapshot().items.map(row=>[row.id,row.retrievalCount]));
    assert.equal(counts.get('semantic-target'),1,'the selected semantic row receives the canonical access update');
    assert.equal(counts.get('lexical-distractor-0'),0,'discarded lexical fallback must not receive access credit');
  }
  console.log('MEMORY_FABRIC_SEMANTIC_RETRIEVAL=PASS');
} finally {
  restoreEnv('NK_EMBEDDINGS_RUNTIME_ENABLED',originalRuntimeEnabled);
  restoreEnv('NK_EMBEDDINGS_RUNTIME_BUDGET_MS',originalRuntimeBudget);
  restoreEnv('NK_EMBEDDINGS_TIMEOUT_MS',originalTimeout);
}
