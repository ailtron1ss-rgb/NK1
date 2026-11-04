import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now=Date.now();
const base={
  kind:'semantic',source:'semantic-answerability-fixture',tags:['test'],context:{area:'semantic-answerability'},
  salience:.65,emotionalWeight:.2,identityRelevance:.2,goalRelevance:.2,socialRelevance:.1,
  predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],
  temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-60_000,observedAt:now-1_000,
  provenanceClass:'external',sourceAuthority01:.9,
};
function provider(providerId,vectorForText){
 return {
  providerId,modelId:providerId,
  async embedBatch(texts){return texts.map((text,index)=>index===0?[1,0]:vectorForText(String(text)));},
  diagnostics(){return{configured:true,provider:'test',model:providerId,endpoint:'test://local',cacheEntries:0,cacheHits:0,cacheMisses:0,requests:1,failures:0,lastError:null,lastLatencyMs:0,redactedInputs:0};},
 };
}
function add(memoryOS,id,content,extra={}){
 memoryOS.encode({id,content,...base,...extra});
}

{
 const memoryOS=new MemoryOS2({embeddingProvider:provider('low-similarity',()=>[.8,.6])});
 add(memoryOS,'weak-semantic','an unrelated archived memory with no shared words');
 const result=await memoryOS.previewRetrieveWithEmbeddings('quantum violet protocol',4,0,0,{}, {maxIndexItems:8});
 assert.equal(result.semantic.enabled,false,'cosine below the calibrated floor must not become an answer');
 assert.equal(result.semantic.fallbackReason,'semantic-candidates-failed-answerability-gate');
 assert.ok(result.semantic.rejectedSemanticCandidates>=1);
 assert.equal(result.items.length,0,'no lexical or calibrated semantic evidence means abstain');
}

{
 const memoryOS=new MemoryOS2({embeddingProvider:provider('ambiguous-similarity',()=>[.9,Math.sqrt(1-.9*.9)])});
 add(memoryOS,'ambiguous-a','a distant memory about spectral archive patterns');
 add(memoryOS,'ambiguous-b','another distant memory about harmonic archive patterns');
 const result=await memoryOS.previewRetrieveWithEmbeddings('quantum violet protocol',4,0,0,{}, {maxIndexItems:8,minSemanticSimilarity:.84,minSemanticMargin:.08});
 assert.equal(result.semantic.enabled,false,'ambiguous near-tied semantic candidates must not bypass answerability');
 assert.ok(result.semantic.rejectedSemanticCandidates>=2);
 assert.equal(result.items.length,0);
}

{
 const memoryOS=new MemoryOS2({embeddingProvider:provider('entity-corroborated',()=>[.9,Math.sqrt(1-.9*.9)])});
 add(memoryOS,'orion-grounded','A short note about stellar mission operations and launch planning',{entities:['Orion']});
 add(memoryOS,'unrelated-near-tie','A short note about deep sea pressure and ocean instruments');
 const result=await memoryOS.previewRetrieveWithEmbeddings('Where did we discuss Project Orion?',4,0,0,{}, {maxIndexItems:8,minSemanticSimilarity:.84,minSemanticMargin:.08});
 assert.equal(result.semantic.enabled,true);
 assert.equal(result.semantic.answerabilityGate,'lexical-or-calibrated-semantic-v1');
 assert.equal(result.semantic.rankingFusion,'weighted-rrf-v1');
 assert.ok(result.items.some(row=>row.id==='orion-grounded'),'entity corroboration may ground a high-similarity candidate without a large margin');
 assert.ok(!result.items.some(row=>row.id==='unrelated-near-tie'),'near-tied candidate without corroboration must be rejected');
 assert.ok(result.semantic.rejectedSemanticCandidates>=1);
}

{
 const memoryOS=new MemoryOS2({embeddingProvider:provider('rrf-exact-preservation',text=>text.includes('semantic-target-token')?[1,0]:[0,1])});
 add(memoryOS,'exact-lexical','quantum violet protocol reference with direct lexical evidence');
 add(memoryOS,'semantic-target','semantic-target-token spectral harmonics cascade archive');
 const result=await memoryOS.previewRetrieveWithEmbeddings('quantum violet protocol',2,0,0,{}, {maxIndexItems:8});
 assert.equal(result.semantic.enabled,true);
 assert.equal(result.semantic.rankingFusion,'weighted-rrf-v1');
 assert.equal(result.items[0]?.id,'exact-lexical','the strongest grounded lexical candidate must remain pinned ahead of a semantic-only candidate');
 assert.ok(result.items.some(row=>row.id==='semantic-target'),'a high-confidence semantic paraphrase remains discoverable');
}

{
 const memoryOS=new MemoryOS2({embeddingProvider:provider('eligibility-boundary',text=>[1,0])});
 add(memoryOS,'quarantined-semantic','quarantined semantic candidate',{epistemicStatus:'quarantined'});
 add(memoryOS,'expired-semantic','expired semantic candidate',{validUntilAt:now-1});
 const result=await memoryOS.previewRetrieveWithEmbeddings('quantum violet protocol',4,0,0,{}, {maxIndexItems:8});
 assert.ok(!result.items.some(row=>row.id==='quarantined-semantic'));
 assert.ok(!result.items.some(row=>row.id==='expired-semantic'));
}

console.log('MEMORY_SEMANTIC_ANSWERABILITY_GATE=PASS');
