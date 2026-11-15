import { createHash, randomUUID } from 'node:crypto';
import type { MemoryOSState2, MemoryItem2 } from '../developmental/MemoryOS2.ts';
import { MemoryOS2 } from '../developmental/MemoryOS2.ts';
import type { TextEmbeddingProvider } from '../developmental/LocalEmbeddingProvider.ts';
import {
  hmacSha256Hex,
  runMemoryOS2RetrievalBenchmark,
  type MemoryRetrievalBenchmarkExample,
  type MemoryRetrievalBenchmarkOptions,
} from './MemoryRetrievalBenchmark.ts';

export interface MemorySemanticRetrievalBenchmarkOptions extends MemoryRetrievalBenchmarkOptions {
  embeddingProvider: TextEmbeddingProvider;
  minSimilarity01?: number;
  providerTimeoutMs?: number;
  maxIndexBatchItems?: number;
}
type ArmResult={items:MemoryItem2[];latencyMs:number;isolationSetupMs:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const isCurrent=(item:MemoryItem2,now:number)=>!item.dormant&&item.epistemicStatus!=='quarantined'&&Number.isFinite(Number(item.validFromAt??item.createdAt))&&Number(item.validFromAt??item.createdAt)<=now&&(item.validUntilAt==null||Number(item.validUntilAt)>now);

function pairedBootstrap(
  baseline:Array<{groupId:string;recallAtK01:number;mrr01:number}>,
  semantic:Array<{groupId:string;recallAtK01:number;mrr01:number}>,
  metric:'recallAtK01'|'mrr01',samples:number,seed:number,
){
  const groups=new Map<string,Array<[number,number]>>();
  for(let i=0;i<Math.min(baseline.length,semantic.length);i++){
    const a=baseline[i]!,b=semantic[i]!;
    if(!a.groupId||a.groupId!==b.groupId)continue;
    const rows=groups.get(a.groupId)??[];rows.push([a[metric],b[metric]]);groups.set(a.groupId,rows);
  }
  const clusters=[...groups.values()];
  if(!clusters.length)return {samples:0,clusterCount:0,lowerBound01:0,medianDelta01:0,upperBound01:0,resamplingUnit:'independenceGroupId-or-exampleId' as const};
  let state=(seed>>>0)||0x6d2b79f5;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const deltas:number[]=[];
  for(let sample=0;sample<samples;sample++){
    let delta=0,count=0;
    for(let draw=0;draw<clusters.length;draw++){
      const rows=clusters[Math.floor(random()*clusters.length)]!;
      for(const [left,right] of rows){delta+=right-left;count++;}
    }
    deltas.push(count?delta/count:0);
  }
  deltas.sort((a,b)=>a-b);
  const at=(p:number)=>Number((deltas[Math.min(deltas.length-1,Math.max(0,Math.floor((deltas.length-1)*p)))]??0).toFixed(4));
  return {samples,clusterCount:clusters.length,lowerBound01:at(.025),medianDelta01:at(.5),upperBound01:at(.975),resamplingUnit:'independenceGroupId-or-exampleId' as const};
}
function valueBootstrap(baseline:Array<{groupId:string;value:number}>,semantic:Array<{groupId:string;value:number}>,samples:number,seed:number){
  return pairedBootstrap(baseline.map(x=>({groupId:x.groupId,recallAtK01:x.value,mrr01:x.value})),semantic.map(x=>({groupId:x.groupId,recallAtK01:x.value,mrr01:x.value})),'recallAtK01',samples,seed);
}

/**
 * Measures the actual async semantic preview used by cognition against the ordinary
 * lexical preview. Both arms share the same snapshot, temporal window and labels.
 * Document embeddings are fully indexed before queries run, preventing query order
 * and partial-index coverage from contaminating the semantic arm.
 */
export async function runMemoryOS2SemanticRetrievalBenchmark(
  snapshot:MemoryOSState2,
  rawExamples:MemoryRetrievalBenchmarkExample[],
  options:MemorySemanticRetrievalBenchmarkOptions,
){
  if(!options?.embeddingProvider)throw new Error('semantic-benchmark-embedding-provider-required');
  const now=Number.isFinite(Number(options.now))?Number(options.now):Date.now();
  const k=Math.max(1,Math.min(10,Math.floor(Number(options.k??5)||5)));
  const maxExamples=Math.max(64,Math.min(512,Math.floor(Number(options.maxExamples??512)||512)));
  const bootstrapSamples=Math.max(200,Math.min(5000,Math.floor(Number(options.bootstrapSamples??1000)||1000)));
  const seed=Number(options.seed??1);
  if(!Number.isSafeInteger(seed)||seed<1||seed>0xffffffff)throw new Error('semantic-benchmark-seed-invalid');
  const requestedThreshold=Number(options.minSimilarity01??0.72);
  const minSimilarity01=Number.isFinite(requestedThreshold)?Math.max(.60,Math.min(.95,requestedThreshold)):.72;
  const providerTimeoutMs=Math.max(500,Math.min(20000,Math.floor(Number(options.providerTimeoutMs??5000)||5000)));
  const batchSize=Math.max(1,Math.min(16,Math.floor(Number(options.maxIndexBatchItems??16)||16)));
  const reference=runMemoryOS2RetrievalBenchmark(snapshot,rawExamples,{...options,now,k,maxExamples,includeQueryEvidence:false});
  const integrity=reference.datasetIntegrity as any;
  const structurallyValid=Boolean(reference.corpusIntegrity.validForPromotion&&integrity.droppedExamples===0&&integrity.truncatedExamples===0&&
    integrity.truncatedFieldRows===0&&integrity.malformedRelevantLabelCount===0&&integrity.duplicateExampleIdCount===0&&
    integrity.duplicateQueryGroupCount===0&&integrity.duplicateRelevantLabelCount===0&&integrity.unknownRelevantMemoryIdCount===0&&
    integrity.crossSplitQueryLeakageCount===0&&integrity.nearDuplicateCrossSplitPairCount===0&&integrity.independenceGroupSplitLeakageCount===0&&integrity.languageAnnotationComplete);
  if(!structurallyValid||rawExamples.length>maxExamples)throw new Error('semantic-benchmark-dataset-integrity-failed');
  const rows=rawExamples.map(row=>({...row,independenceGroupId:row.independenceGroupId??row.id,answerable:row.answerable!==false}))
    .sort((a,b)=>a.split.localeCompare(b.split)||a.id.localeCompare(b.id));
  const corpusItems=(snapshot.items??[]).slice(0,1600).filter(item=>item&&typeof item.id==='string'&&item.id.trim()&&typeof item.content==='string');
  const boundedSnapshot={...structuredClone(snapshot),items:structuredClone(corpusItems)} as MemoryOSState2;
  const baselineOS=new MemoryOS2({embeddingProvider:null});
  const semanticOS=new MemoryOS2({embeddingProvider:options.embeddingProvider});
  baselineOS.restore(structuredClone(boundedSnapshot));
  semanticOS.restore(structuredClone(boundedSnapshot));
  const eligibleCorpus=corpusItems.filter(item=>isCurrent(item,now));
  const indexStarted=performance.now();
  let indexBatches=0,indexedItems=0,failedItems=0,lastIndexError:string|null=null;
  for(let pass=0;pass<Math.ceil(Math.max(1,eligibleCorpus.length)/batchSize)+2;pass++){
    const before=indexedItems;
    const state=await semanticOS.maintainSemanticIndexBatch({maxItems:batchSize,providerTimeoutMs,now});
    indexBatches++;indexedItems=state.indexedItems;failedItems+=state.failed;lastIndexError=state.lastErrorCode;
    if(indexedItems>=eligibleCorpus.length)break;
    if(state.indexed===0||indexedItems<=before)break;
  }
  const indexingDurationMs=Math.max(0,performance.now()-indexStarted);
  const indexingComplete=indexedItems>=eligibleCorpus.length&&failedItems===0;
  const providerDiagnostics=options.embeddingProvider.diagnostics();
  const common={
    schemaVersion:1 as const,
    benchmark:'memoryos2-lexical-vs-semantic-embeddings',
    mode:'offline-clone; no-live-state-mutation; diagnostic-only' as const,
    now,k,seed,bootstrapSamples,minSimilarity01,
    datasetFingerprint:reference.datasetFingerprint,
    corpusFingerprint:reference.corpusFingerprint,
    referenceDatasetIntegrity:reference.datasetIntegrity,
    datasetProvenance:reference.datasetProvenance,
    corpusItems:corpusItems.length,eligibleCorpusItems:eligibleCorpus.length,
    semanticIndex:{indexedItems,coverage01:eligibleCorpus.length?clamp(indexedItems/eligibleCorpus.length):0,batches:indexBatches,failedItems,indexingDurationMs:Number(indexingDurationMs.toFixed(3)),provider:providerDiagnostics.provider,model:providerDiagnostics.model,requests:providerDiagnostics.requests,failures:providerDiagnostics.failures},
  };
  if(!indexingComplete)return {...common,skipped:true,skipReason:lastIndexError??'semantic-index-incomplete',promotion:{allowed:false,status:'not-promoted',reason:'semantic-index-incomplete',requiresIndependentHumanOrCIReview:true,liveStateChanged:false,candidateAutomaticallyPromoted:false}};

  const baselineMap=new Map<string,ArmResult>(),semanticMap=new Map<string,ArmResult>();
  const semanticFlags=new Map<string,{enabled:boolean;abstained:boolean;fallbackReason:string|null;topSimilarity01:number|null}>();
  const queries=[...new Set(rows.map(row=>row.query))];
  for(const query of queries){
    let started=performance.now();
    const lexical=baselineOS.previewRetrieve(query,k,0,0,{temporalMode:'at',asOfAt:now});
    baselineMap.set(query,{items:lexical,latencyMs:Math.max(0,performance.now()-started),isolationSetupMs:0});
    started=performance.now();
    const preview=await semanticOS.previewRetrieveWithEmbeddings(query,k,0,0,{temporalMode:'at',asOfAt:now},{maxIndexItems:1,maxLexicalPool:24,providerTimeoutMs,minSimilarity01});
    semanticMap.set(query,{items:preview.items,latencyMs:Math.max(0,performance.now()-started),isolationSetupMs:0});
    semanticFlags.set(query,{enabled:preview.semantic.enabled,abstained:preview.semantic.abstained===true,fallbackReason:preview.semantic.fallbackReason,topSimilarity01:preview.semantic.topSimilarity01??null});
  }
  const retrieve=(map:Map<string,ArmResult>)=>(query:string):ArmResult=>map.get(query)??{items:[],latencyMs:0,isolationSetupMs:0};
  const holdout=rows.filter(row=>row.split==='holdout'),train=rows.filter(row=>row.split==='train');
  const baselineHoldout=evaluate(holdout,retrieve(baselineMap),k,now);
  const semanticHoldout=evaluate(holdout,retrieve(semanticMap),k,now);
  const baselineTrain=evaluate(train,retrieve(baselineMap),k,now);
  const semanticTrain=evaluate(train,retrieve(semanticMap),k,now);
  const recallDelta=semanticHoldout.metrics.recallAtK01-baselineHoldout.metrics.recallAtK01;
  const mrrDelta=semanticHoldout.metrics.mrr01-baselineHoldout.metrics.mrr01;
  const recallConfidence=pairedBootstrap(baselineHoldout.outcomes,semanticHoldout.outcomes,'recallAtK01',bootstrapSamples,seed);
  const mrrConfidence=pairedBootstrap(baselineHoldout.outcomes,semanticHoldout.outcomes,'mrr01',bootstrapSamples,seed^0x9e3779b9);
  const unsupportedConfidence=valueBootstrap(baselineHoldout.unsupportedRetrievalOutcomes,semanticHoldout.unsupportedRetrievalOutcomes,bootstrapSamples,seed^0x85ebca6b);
  const minUplift=Math.max(0,Math.min(.25,Number(options.minimumRecallUplift01??.02)));
  const mrrTolerance=Math.max(0,Math.min(.1,Number(options.maximumMrrRegression01??.01)));
  const unsupportedTolerance=Math.max(0,Math.min(.25,Number(options.maximumUnsupportedRetrievalRegression01??0)));
  const answerableHoldout=holdout.filter(row=>row.answerable!==false).length;
  const unanswerableHoldout=holdout.filter(row=>row.answerable===false).length;
  const minAnswerable=Math.max(8,Math.floor(Number(options.minHoldoutQueries??8)));
  const minUnanswerable=Math.max(4,Math.floor(Number(options.minUnanswerableHoldoutQueries??4)));
const minimumUnanswerablePerLanguage=(options:MemorySemanticRetrievalBenchmarkOptions)=>Math.max(2,Math.floor(Number(options.minLanguageUnanswerableHoldoutQueries??2)));
const languageGatesForDisplay=(gates:Record<string,boolean>,_language:string)=>gates;
  const languageSlices:Record<string,unknown>={};
  const languageGates:Record<string,boolean>={};
  for(const language of ['en','ru'] as const){
    const languageRows=holdout.filter(row=>row.language===language);
    if(!languageRows.length)continue;
    const languageBaseline=evaluate(languageRows,retrieve(baselineMap),k,now);
    const languageSemantic=evaluate(languageRows,retrieve(semanticMap),k,now);
    const languageSeed=((seed^(language==='en'?0x13579bdf:0x2468ace0))>>>0)||1;
    const languageRecallConfidence=pairedBootstrap(languageBaseline.outcomes,languageSemantic.outcomes,'recallAtK01',bootstrapSamples,languageSeed);
    const languageMrrConfidence=pairedBootstrap(languageBaseline.outcomes,languageSemantic.outcomes,'mrr01',bootstrapSamples,languageSeed^0x9e3779b9);
    const languageUnsupportedConfidence=valueBootstrap(languageBaseline.unsupportedRetrievalOutcomes,languageSemantic.unsupportedRetrievalOutcomes,bootstrapSamples,languageSeed^0x85ebca6b);
    const answerableRows=languageRows.filter(row=>row.answerable!==false);
    const unanswerableRows=languageRows.filter(row=>row.answerable===false);
    const answerableGroups=new Set(answerableRows.map(row=>row.independenceGroupId??row.id)).size;
    const unanswerableGroups=new Set(unanswerableRows.map(row=>row.independenceGroupId??row.id)).size;
    const languageRecallDelta=languageSemantic.metrics.recallAtK01-languageBaseline.metrics.recallAtK01;
    const languageMrrDelta=languageSemantic.metrics.mrr01-languageBaseline.metrics.mrr01;
    const languageGates={
      sufficientAnswerableQueries:answerableRows.length>=Math.max(8,minAnswerable),
      sufficientUnanswerableQueries:unanswerableRows.length>=Math.max(2,minimumUnanswerablePerLanguage(options)),
      sufficientIndependentAnswerableGroups:answerableGroups>=Math.max(8,minAnswerable),
      sufficientIndependentUnanswerableGroups:unanswerableGroups>=Math.max(2,minimumUnanswerablePerLanguage(options)),
      minimumRecallUplift:languageRecallDelta>=minUplift,
      recallConfidenceSupported:languageRecallConfidence.lowerBound01>0,
      mrrNonInferioritySupported:languageMrrConfidence.lowerBound01>=-mrrTolerance,
      unsupportedRetrievalNonInferioritySupported:languageUnsupportedConfidence.upperBound01<=unsupportedTolerance,
    };
    languageGates[language]=Object.values(languageGates).every(Boolean);
    languageSlices[language]={
      trainQueries:train.filter(row=>row.language===language).length,
      holdoutQueries:languageRows.length,
      answerableHoldoutQueries:answerableRows.length,
      unanswerableHoldoutQueries:unanswerableRows.length,
      independentAnswerableHoldoutGroups:answerableGroups,
      independentUnanswerableHoldoutGroups:unanswerableGroups,
      metrics:{baseline:languageBaseline.metrics,semantic:languageSemantic.metrics},
      deltas:{recallAtK01:Number(languageRecallDelta.toFixed(4)),mrr01:Number(languageMrrDelta.toFixed(4))},
      confidence:{recallAtK01:languageRecallConfidence,mrr01:languageMrrConfidence,unsupportedRetrievalRate01:languageUnsupportedConfidence},
      gates:languageGatesForDisplay(languageGates,language),
    };
  }
  const bilingual=reference.languageStratification?.enabled===true&&reference.languageStratification?.annotationsComplete===true&&
    Boolean(languageSlices.en)&&Boolean(languageSlices.ru)&&languageGates.en===true&&languageGates.ru===true;
  const noUnsafe=semanticHoldout.metrics.quarantinedResultCount===0&&semanticHoldout.metrics.staleResultCount===0&&semanticHoldout.metrics.futureResultCount===0&&
    semanticHoldout.metrics.dormantResultCount===0&&semanticHoldout.metrics.invalidEpistemicStatusResultCount===0&&semanticHoldout.metrics.invalidResultRate01<=baselineHoldout.metrics.invalidResultRate01;
  const gates={
    semanticIndexComplete:indexingComplete,
    datasetAndCorpusIntegrity:structurallyValid,
    datasetProvenanceComplete:reference.datasetProvenance?.contentHashValid===true,
    sufficientAnswerableHoldout:answerableHoldout>=minAnswerable,
    sufficientUnanswerableHoldout:unanswerableHoldout>=minUnanswerable,
    bilingualLanguageSlices:bilingual,
    noUnsafeResults:noUnsafe,
    minimumRecallUplift:recallDelta>=minUplift,
    recallUpliftConfidenceSupported:recallConfidence.lowerBound01>0,
    mrrNonInferioritySupported:mrrConfidence.lowerBound01>=-mrrTolerance,
    unsupportedRetrievalNonInferioritySupported:unsupportedConfidence.upperBound01<=unsupportedTolerance,
  };
  const gatesPass=Object.values(gates).every(Boolean);
  const enabledQueries=[...semanticFlags.values()].filter(flag=>flag.enabled).length;
  const abstainedQueries=[...semanticFlags.values()].filter(flag=>flag.abstained).length;
  const fallbackReasons:Record<string,number>={};
  for(const flag of semanticFlags.values())if(flag.fallbackReason)fallbackReasons[flag.fallbackReason]=(fallbackReasons[flag.fallbackReason]??0)+1;
  const queryEvidence=options.includeQueryEvidence===true?(()=>{
    // Query-level evidence is opt-in and HMAC-keyed with a one-run secret. Raw queries,
    // memory IDs and the ephemeral key are never written to the output.
    const ephemeralSalt=randomUUID().replace(/-/g,'')+randomUUID().replace(/-/g,'');
    return rows.map(row=>({
      exampleIdDigest:hmacSha256Hex(ephemeralSalt,row.id),
      queryDigest:hmacSha256Hex(ephemeralSalt,normalizeQuery(row.query)),
      groupDigest:hmacSha256Hex(ephemeralSalt,row.independenceGroupId??row.id),
      split:row.split,language:row.language??'other',answerable:row.answerable!==false,
      relevantIdDigests:row.relevantIds.map(id=>hmacSha256Hex(ephemeralSalt,id)).sort(),
      baselineRankedIdDigests:(baselineMap.get(row.query)?.items??[]).map(item=>hmacSha256Hex(ephemeralSalt,item.id)),
      semanticRankedIdDigests:(semanticMap.get(row.query)?.items??[]).map(item=>hmacSha256Hex(ephemeralSalt,item.id)),
    }));
  })():undefined;
  const configFingerprint=createHash('sha256').update(JSON.stringify({
    baseline:'MemoryOS2.previewRetrieve',
    semantic:'MemoryOS2.previewRetrieveWithEmbeddings',
    provider:options.embeddingProvider.providerId,
    model:options.embeddingProvider.modelId,
    minSimilarity01,
    maxIndexBatchItems:batchSize,
    providerTimeoutMs,
  })).digest('hex');
  return {
    ...common,skipped:false,
    semanticSelection:{queries:queries.length,semanticEnabledQueries:enabledQueries,abstainedQueries,fallbackReasons,minSimilarity01,
      meanTopSimilarity01:semanticFlags.size?Number(([...semanticFlags.values()].reduce((sum,row)=>sum+(row.topSimilarity01??0),0)/semanticFlags.size).toFixed(4)):0},
    metrics:{baseline:baselineHoldout.metrics,semantic:semanticHoldout.metrics,train:{baseline:baselineTrain.metrics,semantic:semanticTrain.metrics},
      deltas:{recallAtK01:Number(recallDelta.toFixed(4)),mrr01:Number(mrrDelta.toFixed(4)),unsupportedRetrievalRate01:Number((semanticHoldout.metrics.unsupportedRetrievalRate01-baselineHoldout.metrics.unsupportedRetrievalRate01).toFixed(4))}},
    confidence:{recallAtK01:recallConfidence,mrr01:mrrConfidence,unsupportedRetrievalRate01:unsupportedConfidence},
    languageSlices,
    evaluationGates:gates,...(queryEvidence?{queryEvidence}:{}),
    retrievalConfigurationFingerprint:configFingerprint,
    promotion:{allowed:false,status:gatesPass?'candidate-eligible-for-independent-review':'not-promoted',
      reason:gatesPass?'all-metric-gates-pass-but-human-review-required':Object.entries(gates).filter(([,value])=>!value).map(([name])=>name).join(','),
      requiresIndependentHumanOrCIReview:true,liveStateChanged:false,candidateAutomaticallyPromoted:false},
  };
}
