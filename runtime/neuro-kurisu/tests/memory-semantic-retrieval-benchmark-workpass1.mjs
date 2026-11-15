import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { runMemoryOS2SemanticRetrievalBenchmark } from '../src/organism/memory/MemorySemanticRetrievalBenchmark.ts';
import { fingerprintMemoryRetrievalDataset } from '../src/organism/memory/MemoryRetrievalBenchmark.ts';

class FixtureEmbeddingProvider {
  providerId='fixture:semantic-eval-v1';
  modelId='fixture-semantic-eval-v1';
  requests=0;
  diagnostics(){return {configured:true,provider:'ollama',model:this.modelId,endpoint:'fixture://local',cacheEntries:0,cacheHits:0,cacheMisses:0,requests:this.requests,failures:0,lastError:null,lastLatencyMs:0,redactedInputs:0};}
  async embedBatch(texts){
    this.requests++;
    return texts.map(raw=>{
      const value=String(raw).toLowerCase();
      if(/qzxv|glarpen|unikora|orbital|nonsense/.test(value))return [0,0,1];
      if(/credential|password|login|authenticate|sign.in|account access|пароль|вход|аккаунт/.test(value))return [1,0,0];
      return [0,1,0];
    });
  }
}
const now=2_000_000_000_000;
const memory=new MemoryOS2({embeddingProvider:null});
for(let i=0;i<8;i++)memory.encode({
  id:`credential-${i}`,content:`credential password recovery login authentication account access procedure number ${i}`,
  kind:'semantic',source:'benchmark-fixture',tags:[],context:{},salience:.6,emotionalWeight:.1,identityRelevance:.1,goalRelevance:.1,socialRelevance:.1,
  predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],
  validFromAt:now-1000,observedAt:now-500,createdAt:now,
});
for(let i=0;i<8;i++)memory.encode({
  id:`decoy-${i}`,content:`network routing database avatar palette cooking landscape science unrelated record ${i}`,
  kind:'semantic',source:'benchmark-fixture',tags:[],context:{},salience:.5,emotionalWeight:.1,identityRelevance:.1,goalRelevance:.1,socialRelevance:.1,
  predictionError:.1,confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],
  validFromAt:now-1000,observedAt:now-500,createdAt:now,
});
const snapshot=memory.snapshot(),before=structuredClone(snapshot);
const examples=[
 ...Array.from({length:2},(_,i)=>({id:`en-train-${i}`,query:`restore account password login procedure training ${i}`,relevantIds:[`credential-${i}`],split:'train',language:'en'})),
 ...Array.from({length:8},(_,i)=>({id:`en-holdout-${i}`,query:`I cannot sign in to my account password access ${i}`,relevantIds:[`credential-${i}`],split:'holdout',language:'en'})),
 ...Array.from({length:2},(_,i)=>({id:`en-noanswer-${i}`,query:`qzxv glarpen orbital nonsense token ${i}`,relevantIds:[],split:'holdout',answerable:false,language:'en'})),
 ...Array.from({length:2},(_,i)=>({id:`ru-train-${i}`,query:`восстановить вход пароль аккаунт тренировка ${i}`,relevantIds:[`credential-${i+2}`],split:'train',language:'ru'})),
 ...Array.from({length:8},(_,i)=>({id:`ru-holdout-${i}`,query:`не могу войти в аккаунт сбросить пароль ${i}`,relevantIds:[`credential-${i}`],split:'holdout',language:'ru'})),
 ...Array.from({length:2},(_,i)=>({id:`ru-noanswer-${i}`,query:`qzxv glarpen орбитальный шифр nonsense ${i}`,relevantIds:[],split:'holdout',answerable:false,language:'ru'})),
];
const provenance={
 datasetId:'semantic-path-fixture',datasetVersion:'1.0.0',sourceRef:'test-only-fixture',
 labelingProtocol:'Hand-authored deterministic synthetic labels. Not production evidence.',
 licenseId:'LicenseRef-NK1-TestFixture',contentSha256:fingerprintMemoryRetrievalDataset(examples),
};
const provider=new FixtureEmbeddingProvider();
const report=await runMemoryOS2SemanticRetrievalBenchmark(snapshot,examples,{
 now,k:5,seed:31,bootstrapSamples:200,maxExamples:512,
 minHoldoutQueries:8,minUnanswerableHoldoutQueries:4,minLanguageTrainQueries:2,
 minLanguageAnswerableHoldoutQueries:8,minLanguageUnanswerableHoldoutQueries:2,
 datasetProvenance:provenance,embeddingProvider:provider,minSimilarity01:.72,
});
assert.equal(report.skipped,false,'complete deterministic local fixture should be indexable');
assert.equal(report.semanticIndex.indexedItems,16,'all eligible documents must be indexed before paired comparison');
assert.equal(report.semanticIndex.coverage01,1);
assert.equal(report.metrics.baseline.queries,20);
assert.equal(report.metrics.semantic.queries,20);
assert.ok(report.semanticSelection.semanticEnabledQueries>0,'async embedding branch must be exercised');
assert.equal(report.semanticSelection.abstainedQueries,4,'explicitly unanswerable RU/EN queries must abstain on weak semantic matches');
assert.equal(report.metrics.semantic.unsupportedRetrievalCount,0);
assert.ok(report.evaluationGates.bilingualLanguageSlices);
assert.equal(report.promotion.allowed,false,'diagnostic benchmark must never auto-promote');
assert.equal(report.promotion.candidateAutomaticallyPromoted,false);
assert.equal(report.promotion.liveStateChanged,false);
assert.deepEqual(snapshot,before,'semantic A/B evaluation must not mutate the caller snapshot');
assert.ok(provider.requests>=2,'provider must be called for corpus indexing and query embeddings');

class FailingEmbeddingProvider extends FixtureEmbeddingProvider {
  async embedBatch(){this.requests++;throw new Error('fixture-provider-offline');}
}
const failed=await runMemoryOS2SemanticRetrievalBenchmark(snapshot,examples,{
 now,k:5,seed:31,bootstrapSamples:200,maxExamples:512,embeddingProvider:new FailingEmbeddingProvider(),
});
assert.equal(failed.skipped,true,'provider/index failure must fail closed instead of comparing a partial semantic index');
assert.equal(failed.promotion.allowed,false);
console.log('MEMORY_SEMANTIC_RETRIEVAL_BENCHMARK_WORKPASS1=PASS',JSON.stringify({
 indexed:report.semanticIndex.indexedItems,queries:report.semanticSelection.queries,
 semanticEnabled:report.semanticSelection.semanticEnabledQueries,abstained:report.semanticSelection.abstainedQueries,
 baselineRecall:report.metrics.baseline.recallAtK01,semanticRecall:report.metrics.semantic.recallAtK01,
 recallDelta:report.metrics.deltas.recallAtK01,unsupportedSemantic:report.metrics.semantic.unsupportedRetrievalCount,
 promotion:report.promotion.status,
}));
