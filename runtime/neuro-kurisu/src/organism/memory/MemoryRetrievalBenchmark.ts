import { createHash } from 'node:crypto';
import { MemoryOS2, type MemoryOSState2, type MemoryItem2 } from '../developmental/MemoryOS2.ts';

export type MemoryRetrievalLanguage = 'en' | 'ru' | 'other';
export const MEMORY_RETRIEVAL_TASK_CATEGORIES = [
  'single-hop', 'multi-hop', 'multi-session', 'temporal', 'knowledge-update',
  'contradiction', 'preference', 'procedural', 'open-domain', 'abstention',
  'static-state', 'dynamic-state', 'workflow-knowledge', 'environment-gotcha',
  'premise-awareness', 'other',
] as const;
export type MemoryRetrievalTaskCategory = typeof MEMORY_RETRIEVAL_TASK_CATEGORIES[number];

export interface MemoryRetrievalBenchmarkExample {
  id: string;
  query: string;
  relevantIds: string[];
  split: 'train' | 'holdout';
  /** Explicit dataset annotation; never inferred from candidate retrieval output. */
  language?: MemoryRetrievalLanguage;
  /** Optional task slice for diagnostics; never inferred from model output or used as auto-promotion evidence. */
  category?: MemoryRetrievalTaskCategory;
  /** An anonymized source-dialogue/session key used for grouped holdout analysis. */
  conversationId?: string;
  /** False marks an intentionally unanswerable query; it must have no relevant labels. */
  answerable?: boolean;
}

export interface MemoryRetrievalBenchmarkProvenance {
  /** Stable corpus/dataset name, not a free-form claim of quality. */
  datasetId?: string;
  /** Immutable dataset revision, commit, or version. */
  datasetVersion?: string;
  /** Source URI, archive hash, or internal artifact reference. */
  sourceRef?: string;
  /** How independent annotators or a fixed labeling policy assigned relevant IDs. */
  labelingProtocol?: string;
  /** SPDX license identifier or a repository-scoped LicenseRef; never a guessed license. */
  licenseId?: string;
  /** SHA-256 of the canonical labelled examples, bound to this exact dataset fingerprint. */
  contentSha256?: string;
}

export interface MemoryRetrievalBenchmarkOptions {
  k?: number;
  now?: number;
  minHoldoutQueries?: number;
  /** Minimum train examples per required language; cannot be lowered below 2. */
  minLanguageTrainQueries?: number;
  /** Minimum answerable holdout examples per required language; cannot be lowered below 8. */
  minLanguageAnswerableHoldoutQueries?: number;
  /** Minimum explicitly unanswerable holdout examples per required language; cannot be lowered below 2. */
  minLanguageUnanswerableHoldoutQueries?: number;
  /** Minimum independent holdout conversations (or queries when conversationId is absent). */
  minIndependentHoldoutGroups?: number;
  /** Minimum explicitly unanswerable holdout queries required to evaluate abstention safely. */
  minUnanswerableHoldoutQueries?: number;
  minimumRecallUplift01?: number;
  maximumMrrRegression01?: number;
  /** Maximum tolerated increase in unsupported retrieval rate; default is strict non-inferiority. */
  maximumUnsupportedRetrievalRegression01?: number;
  bootstrapSamples?: number;
  seed?: number;
  datasetProvenance?: MemoryRetrievalBenchmarkProvenance;
  /** Explicitly enable opt-in metadata recall for the candidate arm only; default is canonical retrieval. */
  metadataRecallEnabled?: boolean;
  /** Offline experiments may raise this bounded limit; the HTTP API leaves it at 64. */
  maxExamples?: number;
}

export interface RetrievalBenchmarkMetrics {
  queries: number;
  answerableQueries: number;
  unanswerableQueries: number;
  unsupportedRetrievalCount: number;
  unsupportedRetrievalRate01: number;
  correctAbstentionRate01: number;
  falseAbstentionCount: number;
  falseAbstentionRate01: number;
  recallAtK01: number;
  mrr01: number;
  precisionAtK01: number;
  queryCoverage01: number;
  quarantinedResultCount: number;
  staleResultCount: number;
  futureResultCount: number;
  dormantResultCount: number;
  invalidEpistemicStatusResultCount: number;
  duplicateResultCount: number;
  invalidResultRate01: number;
  latencyP95Ms: number;
  isolationSetupP95Ms: number;
}

const RETRIEVAL_ALGORITHM_VERSION='memoryos2-hybrid-v5-bilingual-concept-recall';
const BENCHMARK_PROTOCOL_VERSION='memoryos2-benchmark-v2-conversation-clustered-bootstrap';
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const finiteOption=(value:unknown,fallback:number,min:number,max:number)=>{
  const n=Number(value);
  return Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback));
};
const tokenSequence=(text:string)=>String(text).normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}|\p{N}/gu)??[];
const normalizeQuery=(query:string)=>String(query).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]+/gu,' ').replace(/\s+/g,' ').trim();
const queryTokens=(query:string)=>normalizeQuery(query).match(/[\p{L}\p{N}]{2,}|\p{N}/gu)??[];
const queryTrigrams=(tokens:string[])=>{
  const result=new Set<string>();
  for(let i=0;i+2<tokens.length;i++)result.add(`${tokens[i]}\u0000${tokens[i+1]}\u0000${tokens[i+2]}`);
  return result;
};
const queryNearDuplicate=(left:string,right:string)=>{
  if(left===right)return false;
  const a=queryTokens(left),b=queryTokens(right);
  // Short queries and one- or two-token fragments are too ambiguous to cluster.
  if(Math.min(a.length,b.length)<6)return false;
  const sa=queryTrigrams(a),sb=queryTrigrams(b);
  if(!sa.size||!sb.size)return false;
  let intersection=0;for(const shingle of sa)if(sb.has(shingle))intersection++;
  return intersection/(sa.size+sb.size-intersection)>=.88;
};
const canonicalExamples=(rows:MemoryRetrievalBenchmarkExample[])=>[...rows].map(x=>({id:x.id,query:normalizeQuery(x.query),...(x.language===undefined?{}:{language:x.language}),...(x.category===undefined?{}:{category:x.category}),...(x.conversationId===undefined?{}:{conversationId:x.conversationId.trim()}),relevantIds:[...x.relevantIds].sort(),split:x.split,answerable:x.answerable!==false})).sort((a,b)=>a.id.localeCompare(b.id)||a.split.localeCompare(b.split)||a.query.localeCompare(b.query)||a.relevantIds.join('\0').localeCompare(b.relevantIds.join('\0')));
const stableFingerprint=(rows:MemoryRetrievalBenchmarkExample[])=>createHash('sha256').update(JSON.stringify(canonicalExamples(rows))).digest('hex');

/** Stable canonical fingerprint shared by dataset provenance writers and the retrieval promotion gate. */
export function fingerprintMemoryRetrievalDataset(rows: MemoryRetrievalBenchmarkExample[]): string {
  return stableFingerprint(rows);
}
// Canonicalize object keys but preserve array order: arrays such as semanticLinks can
// affect bounded neighbor expansion, while object insertion order must not affect hashes.
const canonicalJsonValue=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(canonicalJsonValue);
  if(value&&typeof value==='object'){const row=value as Record<string,unknown>;return Object.fromEntries(Object.keys(row).sort().map(key=>[key,canonicalJsonValue(row[key])]));}
  if(typeof value==='number'&&!Number.isFinite(value))return String(value);
  return value;
};
const corpusFingerprint=(rows:MemoryItem2[])=>createHash('sha256').update(JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>canonicalJsonValue(row)))).digest('hex');
const retrievalConfigurationFingerprint=(snapshot:MemoryOSState2,options:MemoryRetrievalBenchmarkOptions={})=>createHash('sha256').update(JSON.stringify(canonicalJsonValue({algorithm:RETRIEVAL_ALGORITHM_VERSION,benchmarkProtocol:BENCHMARK_PROTOCOL_VERSION,tokenization:'NFKC Unicode words plus standalone single-digit numbers',candidateMetadataRecallEnabled:options.metadataRecallEnabled===true,version:snapshot?.version??null,adaptiveMemoryPolicy:snapshot?.adaptiveMemoryPolicy??null,linkUpdates:snapshot?.linkUpdates??0,semanticQueries:snapshot?.semanticQueries??0}))).digest('hex');
const isCurrent=(m:MemoryItem2,now:number)=>!m.dormant&&m.epistemicStatus!=='quarantined'&&(m.supersededById==null||m.validUntilAt!=null)&&(m.validFromAt==null||Number(m.validFromAt)<=now)&&(m.validUntilAt==null||Number(m.validUntilAt)>now);
function p95(values:number[]){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)]??0;}
function textField(value:unknown,max=200){return typeof value==='string'?value.trim().slice(0,max):'';}

type BenchmarkRetrievalResult = MemoryItem2[] | { items: MemoryItem2[]; latencyMs: number; isolationSetupMs?: number };
type QueryOutcome={recallAtK01:number;mrr01:number};
type Evaluation={metrics:RetrievalBenchmarkMetrics;outcomes:QueryOutcome[];outcomeClusterIds:string[];unsupportedRetrievalOutcomes:number[];unsupportedClusterIds:string[]};

function evaluate(examples:MemoryRetrievalBenchmarkExample[], retrieve:(query:string,k:number)=>BenchmarkRetrievalResult, k:number, now:number):Evaluation {
  let recall=0,mrr=0,precision=0,covered=0,quarantined=0,stale=0,future=0,dormant=0,invalidEpistemic=0,duplicates=0,invalid=0;
  let answerableQueries=0,unanswerableQueries=0,unsupportedRetrievalCount=0,falseAbstentionCount=0;
  const latency:number[]=[]; const setupLatency:number[]=[]; const outcomes:QueryOutcome[]=[]; const outcomeClusterIds:string[]=[]; const unsupportedRetrievalOutcomes:number[]=[]; const unsupportedClusterIds:string[]=[];
  for(const ex of examples){
    const start=performance.now();
    let results:MemoryItem2[]=[];
    try {
      const response=retrieve(ex.query,k);
      if(Array.isArray(response)){results=response.slice(0,k);latency.push(Math.max(0,performance.now()-start));setupLatency.push(0);}
      else {results=response.items.slice(0,k);latency.push(Math.max(0,response.latencyMs));setupLatency.push(Math.max(0,response.isolationSetupMs??0));}
    } catch {results=[];invalid++;latency.push(Math.max(0,performance.now()-start));setupLatency.push(0);}
    const ids=new Set<string>(); let dup=false;
    for(const row of results){if(!row?.id){invalid++;continue;} if(ids.has(row.id)){duplicates++;dup=true;} ids.add(row.id); if(row.epistemicStatus==='quarantined')quarantined++;if((row.validUntilAt!=null&&Number(row.validUntilAt)<=now)||(row.supersededById!=null&&row.validUntilAt==null))stale++;if(row.validFromAt!=null&&Number(row.validFromAt)>now)future++;if(row.dormant)dormant++;if(!['fact','belief','hypothesis','unknown','quarantined'].includes(String(row.epistemicStatus)))invalidEpistemic++;}
    const relevant=new Set(ex.relevantIds);
    const answerable=ex.answerable!==false;
    const hits=results.filter(row=>row?.id&&relevant.has(row.id));
    if(answerable){
      answerableQueries++;
      const hitIds=new Set(hits.map(row=>row.id));
      const queryRecall=relevant.size?hitIds.size/relevant.size:0;
      const first=results.findIndex(row=>relevant.has(row.id));
      const queryMrr=first>=0?1/(first+1):0;
      outcomes.push({recallAtK01:queryRecall,mrr01:queryMrr});
      outcomeClusterIds.push(ex.conversationId?.trim()||ex.id);
      recall+=queryRecall;
      // Precision counts unique relevant memory IDs, not duplicate rows for one memory.
      precision+=new Set(hits.map(row=>row.id)).size/k;
      mrr+=queryMrr;
      if(results.length===0)falseAbstentionCount++;
    }else{
      unanswerableQueries++;
      const unsupported=results.length>0?1:0;
      unsupportedRetrievalOutcomes.push(unsupported);
      unsupportedClusterIds.push(ex.conversationId?.trim()||ex.id);
      if(unsupported)unsupportedRetrievalCount++;
    }
    if(results.length)covered++;
    if(dup)invalid++;
  }
  const n=Math.max(1,answerableQueries);
  const all=Math.max(1,examples.length);
  const metrics:RetrievalBenchmarkMetrics={
    queries:examples.length,answerableQueries,unanswerableQueries,unsupportedRetrievalCount,
    unsupportedRetrievalRate01:clamp(unsupportedRetrievalCount/Math.max(1,unanswerableQueries)),
    correctAbstentionRate01:unanswerableQueries?clamp(1-unsupportedRetrievalCount/unanswerableQueries):0,
    falseAbstentionCount,falseAbstentionRate01:clamp(falseAbstentionCount/n),
    recallAtK01:clamp(recall/n),mrr01:clamp(mrr/n),precisionAtK01:clamp(precision/n),
    queryCoverage01:clamp(covered/all),quarantinedResultCount:quarantined,staleResultCount:stale,
    futureResultCount:future,dormantResultCount:dormant,invalidEpistemicStatusResultCount:invalidEpistemic,
    duplicateResultCount:duplicates,invalidResultRate01:clamp(invalid/Math.max(1,examples.length*k)),
    latencyP95Ms:Number(p95(latency).toFixed(3)),isolationSetupP95Ms:Number(p95(setupLatency).toFixed(3))
  };
  return {metrics,outcomes,outcomeClusterIds,unsupportedRetrievalOutcomes,unsupportedClusterIds};
}
function pairedBootstrapInterval(baseline:QueryOutcome[],candidate:QueryOutcome[],metric:'recallAtK01'|'mrr01',clusterIds:string[],samples:number,seed:number){
  const n=Math.min(baseline.length,candidate.length,clusterIds.length);
  if(!n)return {samples:0,independentClusters:0,lowerBound01:0,medianDelta01:0,upperBound01:0};
  const groups=new Map<string,number[]>();
  for(let i=0;i<n;i++){const key=clusterIds[i]||`query:${i}`;const rows=groups.get(key)??[];rows.push(i);groups.set(key,rows);}
  const clusterRows=[...groups.values()];
  // Resample whole conversations, not individual questions. Every selected conversation
  // contributes all its labelled queries; baseline/candidate pairs remain aligned.
  let state=(seed>>>0)||0x6d2b79f5;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const deltas:number[]=[];
  for(let s=0;s<samples;s++){
    let delta=0,weight=0;
    for(let draw=0;draw<clusterRows.length;draw++){
      const sampled=clusterRows[Math.floor(random()*clusterRows.length)]!;
      for(const ix of sampled){delta+=candidate[ix]![metric]-baseline[ix]![metric];weight++;}
    }
    deltas.push(weight?delta/weight:0);
  }
  deltas.sort((a,b)=>a-b);
  const at=(p:number)=>Number((deltas[Math.min(deltas.length-1,Math.max(0,Math.floor((deltas.length-1)*p)))]??0).toFixed(4));
  return {samples,independentClusters:clusterRows.length,lowerBound01:at(.025),medianDelta01:at(.5),upperBound01:at(.975)};
}

function clusterLeaveOneOutSensitivity(baseline:QueryOutcome[],candidate:QueryOutcome[],metric:'recallAtK01'|'mrr01',clusterIds:string[]){
  const n=Math.min(baseline.length,candidate.length,clusterIds.length);
  const groups=new Map<string,number[]>();
  for(let i=0;i<n;i++){const key=clusterIds[i]||`query:${i}`;const rows=groups.get(key)??[];rows.push(i);groups.set(key,rows);}
  const clusterRows=[...groups.values()];
  const deltaFor=(excluded?:ReadonlySet<number>)=>{
    let delta=0,count=0;
    for(let i=0;i<n;i++){if(excluded?.has(i))continue;delta+=candidate[i]![metric]-baseline[i]![metric];count++;}
    return count?delta/count:0;
  };
  const fullDelta=deltaFor();
  const leaveOneOut:number[]=[];
  if(clusterRows.length>1){
    for(const group of clusterRows)leaveOneOut.push(deltaFor(new Set(group)));
  }
  const min=leaveOneOut.length?Math.min(...leaveOneOut):fullDelta;
  const max=leaveOneOut.length?Math.max(...leaveOneOut):fullDelta;
  const sign=(value:number)=>value>1e-12?1:value< -1e-12?-1:0;
  const fullSign=sign(fullDelta);
  const signFlipCount=fullSign===0?0:leaveOneOut.filter(value=>sign(value)!==fullSign).length;
  return {
    method:'leave-one-conversation-out-sensitivity' as const,
    independentClusters:clusterRows.length,
    evaluations:leaveOneOut.length,
    fullDelta01:Number(fullDelta.toFixed(4)),
    minLeaveOneOutDelta01:Number(min.toFixed(4)),
    maxLeaveOneOutDelta01:Number(max.toFixed(4)),
    maxAbsoluteShift01:Number(leaveOneOut.length?Math.max(...leaveOneOut.map(value=>Math.abs(value-fullDelta))).toFixed(4):'0'),
    signFlipCount,
    signSensitive:signFlipCount>0,
    interpretation:'diagnostic-only; delete-one-cluster sensitivity is not a confidence interval',
  };
}

function pairedBootstrapValuesInterval(baseline:number[],candidate:number[],clusterIds:string[],samples:number,seed:number){
  const n=Math.min(baseline.length,candidate.length,clusterIds.length);
  if(!n)return {samples:0,independentClusters:0,lowerBound01:0,medianDelta01:0,upperBound01:0};
  const groups=new Map<string,number[]>();
  for(let i=0;i<n;i++){const key=clusterIds[i]||`query:${i}`;const rows=groups.get(key)??[];rows.push(i);groups.set(key,rows);}
  const clusterRows=[...groups.values()];
  let state=(seed>>>0)||0x6d2b79f5;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const deltas:number[]=[];
  for(let s=0;s<samples;s++){
    let delta=0,weight=0;
    for(let draw=0;draw<clusterRows.length;draw++){
      const sampled=clusterRows[Math.floor(random()*clusterRows.length)]!;
      for(const ix of sampled){delta+=candidate[ix]!-baseline[ix]!;weight++;}
    }
    deltas.push(weight?delta/weight:0);
  }
  deltas.sort((a,b)=>a-b);
  const at=(p:number)=>Number((deltas[Math.min(deltas.length-1,Math.max(0,Math.floor((deltas.length-1)*p)))]??0).toFixed(4));
  return {samples,independentClusters:clusterRows.length,lowerBound01:at(.025),medianDelta01:at(.5),upperBound01:at(.975)};
}

function inspectDataset(rawExamples:MemoryRetrievalBenchmarkExample[],corpus:MemoryItem2[],truncatedExamples:number,droppedExamples:number,truncatedFieldRows:number,malformedRelevantLabelCount:number,malformedConversationAnnotationCount:number){
  const knownIds=new Set(corpus.map(row=>row.id));
  const duplicateIds=new Set<string>();const seenIds=new Set<string>();
  const duplicateRelevantIds=new Set<string>();
  const unknownRelevantIds=new Set<string>();
  for(const row of rawExamples){
    if(seenIds.has(row.id))duplicateIds.add(row.id);seenIds.add(row.id);
    const unique=new Set(row.relevantIds);if(unique.size!==row.relevantIds.length)duplicateRelevantIds.add(row.id);
    for(const id of unique)if(!knownIds.has(id))unknownRelevantIds.add(id);
  }
  const queryCounts=new Map<string,number>();for(const row of rawExamples){const q=normalizeQuery(row.query);queryCounts.set(q,(queryCounts.get(q)??0)+1);}
  const repeatedQueryKeys=[...queryCounts.entries()].filter(([,count])=>count>1).map(([q])=>q);
  const crossSplitQueryLeakageCount=repeatedQueryKeys.filter(q=>new Set(rawExamples.filter(row=>normalizeQuery(row.query)===q).map(row=>row.split)).size>1).length;
  let nearDuplicateCrossSplitPairCount=0;
  for(let i=0;i<rawExamples.length;i++){
    const left=rawExamples[i]!;
    for(let j=i+1;j<rawExamples.length;j++){
      const right=rawExamples[j]!;
      if(left.split===right.split)continue;
      if(queryNearDuplicate(left.query,right.query))nearDuplicateCrossSplitPairCount++;
    }
  }
  const uniqueTrainQueries=new Set(rawExamples.filter(x=>x.split==='train').map(x=>normalizeQuery(x.query))).size;
  const uniqueHoldoutQueries=new Set(rawExamples.filter(x=>x.split==='holdout').map(x=>normalizeQuery(x.query))).size;
  const conversationAnnotationUsed=rawExamples.some(row=>row.conversationId!==undefined);
  const conversationAnnotationComplete=!conversationAnnotationUsed||rawExamples.every(row=>typeof row.conversationId==='string'&&Boolean(row.conversationId.trim()));
  const groupKey=(row:MemoryRetrievalBenchmarkExample)=>row.conversationId?.trim()||`query:${row.id}`;
  const groupSplits=new Map<string,Set<'train'|'holdout'>>();
  for(const row of rawExamples){const key=groupKey(row);const splits=groupSplits.get(key)??new Set<'train'|'holdout'>();splits.add(row.split);groupSplits.set(key,splits);}
  const crossSplitConversationLeakageCount=[...groupSplits.values()].filter(splits=>splits.size>1).length;
  const uniqueTrainConversationGroups=new Set(rawExamples.filter(row=>row.split==='train').map(groupKey)).size;
  const uniqueHoldoutConversationGroups=new Set(rawExamples.filter(row=>row.split==='holdout').map(groupKey)).size;
  const answerableHoldoutGroupCounts=new Map<string,number>();
  const unanswerableHoldoutGroupCounts=new Map<string,number>();
  for(const row of rawExamples){
    if(row.split!=='holdout')continue;
    const target=row.answerable===false?unanswerableHoldoutGroupCounts:answerableHoldoutGroupCounts;
    const key=groupKey(row);target.set(key,(target.get(key)??0)+1);
  }
  const uniqueAnswerableHoldoutConversationGroups=answerableHoldoutGroupCounts.size;
  const uniqueUnanswerableHoldoutConversationGroups=unanswerableHoldoutGroupCounts.size;
  const summarizeClusterSizes=(counts:Map<string,number>)=>{
    const sizes=[...counts.values()].sort((a,b)=>a-b);
    const n=sizes.length,median=n?(n%2?sizes[(n-1)/2]!:((sizes[n/2-1]!+sizes[n/2]!)/2)):0;
    const total=sizes.reduce((sum,value)=>sum+value,0);
    const maximum=n?sizes[n-1]!:0;
    return {clusters:n,queries:total,min:n?sizes[0]!:0,median:Number(median.toFixed(2)),max:maximum,mean:Number((total/Math.max(1,n)).toFixed(2)),largestClusterShare01:Number((maximum/Math.max(1,total)).toFixed(4)),maxToMedianRatio:Number((maximum/Math.max(1,median)).toFixed(2))};
  };
  const answerableHoldoutClusterSizes=summarizeClusterSizes(answerableHoldoutGroupCounts);
  const unanswerableHoldoutClusterSizes=summarizeClusterSizes(unanswerableHoldoutGroupCounts);
  const multiSessionRows=rawExamples.filter(row=>row.category==='multi-session');
  const missingMultiSessionConversationIdCount=multiSessionRows.filter(row=>typeof row.conversationId!=='string'||!row.conversationId.trim()).length;
  const multiSessionConversationAnnotationComplete=missingMultiSessionConversationIdCount===0;
  const languageAnnotationUsed=rawExamples.some(row=>row.language!==undefined);
  const languageAnnotationComplete=!languageAnnotationUsed||rawExamples.every(row=>row.language!==undefined);
  const duplicateExampleIdCount=duplicateIds.size;
  const duplicateRelevantLabelCount=duplicateRelevantIds.size;
  const unknownRelevantMemoryIdCount=unknownRelevantIds.size;
  const duplicateQueryGroupCount=repeatedQueryKeys.length;
  const validForPromotion=truncatedExamples===0&&droppedExamples===0&&truncatedFieldRows===0&&malformedConversationAnnotationCount===0&&duplicateExampleIdCount===0&&duplicateQueryGroupCount===0&&duplicateRelevantLabelCount===0&&malformedRelevantLabelCount===0&&unknownRelevantMemoryIdCount===0&&crossSplitQueryLeakageCount===0&&nearDuplicateCrossSplitPairCount===0&&conversationAnnotationComplete&&crossSplitConversationLeakageCount===0&&multiSessionConversationAnnotationComplete&&languageAnnotationComplete;
  return {sourceExamples:rawExamples.length+truncatedExamples+droppedExamples,acceptedExamples:rawExamples.length,droppedExamples,truncatedExamples,truncatedFieldRows,malformedRelevantLabelCount,malformedConversationAnnotationCount,duplicateExampleIdCount,duplicateQueryGroupCount,duplicateRelevantLabelCount,uniqueTrainQueries,uniqueHoldoutQueries,uniqueTrainConversationGroups,uniqueHoldoutConversationGroups,uniqueAnswerableHoldoutConversationGroups,uniqueUnanswerableHoldoutConversationGroups,answerableHoldoutClusterSizes,unanswerableHoldoutClusterSizes,conversationAnnotationUsed,conversationAnnotationComplete,crossSplitConversationLeakageCount,multiSessionRows:multiSessionRows.length,missingMultiSessionConversationIdCount,multiSessionConversationAnnotationComplete,crossSplitQueryLeakageCount,nearDuplicateCrossSplitPairCount,unknownRelevantMemoryIdCount,languageAnnotationUsed,languageAnnotationComplete,validForPromotion};
}

/**
 * Controlled, non-promoting A/B harness. The candidate runs on a restored clone,
 * while external labels remain the ground truth. Split leakage, duplicate weighting,
 * unknown label IDs, and missing provenance block candidate eligibility. Bootstrap
 * uncertainty is reported on paired holdout queries; no result writes live state.
 */
export function runMemoryOS2RetrievalBenchmark(snapshot: MemoryOSState2, rawExamples: MemoryRetrievalBenchmarkExample[], options: MemoryRetrievalBenchmarkOptions = {}) {
  const now=Number.isFinite(Number(options.now))?Number(options.now):Date.now();
  const k=Math.floor(finiteOption(options.k,5,1,10));
  const minHoldout=Math.floor(finiteOption(options.minHoldoutQueries,8,8,64));
  const minIndependentHoldoutGroups=Math.floor(finiteOption(options.minIndependentHoldoutGroups,8,8,128));
  const minLanguageTrainQueries=Math.floor(finiteOption(options.minLanguageTrainQueries,2,2,32));
  const minLanguageAnswerableHoldoutQueries=Math.floor(finiteOption(options.minLanguageAnswerableHoldoutQueries,8,8,64));
  const minLanguageUnanswerableHoldoutQueries=Math.floor(finiteOption(options.minLanguageUnanswerableHoldoutQueries,2,2,32));
  const minUnanswerableHoldout=Math.floor(finiteOption(options.minUnanswerableHoldoutQueries,4,2,32));
  const minUplift=finiteOption(options.minimumRecallUplift01,.02,0,.25);
  const mrrTolerance=finiteOption(options.maximumMrrRegression01,.01,0,.1);
  const unsupportedRetrievalTolerance=finiteOption(options.maximumUnsupportedRetrievalRegression01,0,0,.25);
  const bootstrapSamples=Math.floor(finiteOption(options.bootstrapSamples,1000,200,5000));
  const seedWasProvided=options.seed!==undefined;
  const requestedSeed=Number(options.seed);
  const seedInputValid=!seedWasProvided||(Number.isSafeInteger(requestedSeed)&&requestedSeed>=1&&requestedSeed<=0xffffffff);
  // Never report a seed that the PRNG does not actually use. Invalid external seeds
  // get a deterministic fallback for diagnostics but block candidate eligibility.
  const providedSeed=seedInputValid&&seedWasProvided?requestedSeed:undefined;
  const rawArray=Array.isArray(rawExamples)?rawExamples:[];
  const maxExamples=Math.floor(finiteOption(options.maxExamples,64,64,512));
  const limited=rawArray.slice(0,maxExamples);const truncatedExamples=Math.max(0,rawArray.length-limited.length);
  // Count malformed raw relevance labels before the normalization step drops blank/non-string entries.
  const malformedRelevantLabelCount=limited.reduce((count,row)=>count+(Array.isArray(row?.relevantIds)?row.relevantIds.filter((id:unknown)=>typeof id!=='string'||!id.trim()).length:0),0);
  let droppedExamples=0;
  // Bounded copies remain diagnostic-only if the source labels/text would be clipped.
  const truncatedFieldRows=limited.filter(row=>Boolean(row&&((typeof row.id==='string'&&row.id.length>120)||(typeof row.query==='string'&&row.query.length>500)||(typeof row.conversationId==='string'&&row.conversationId.length>160)||(Array.isArray(row.relevantIds)&&(row.relevantIds.length>24||row.relevantIds.some(id=>typeof id==='string'&&id.length>160)))))).length;
  const malformedConversationAnnotationCount=limited.filter(row=>row&&row.conversationId!==undefined&&(typeof row.conversationId!=='string'||!row.conversationId.trim())).length;
  const examples=limited.filter((row):row is MemoryRetrievalBenchmarkExample=>{
    const valid=Boolean(row&&typeof row.id==='string'&&row.id.trim()&&typeof row.query==='string'&&row.query.trim()&&Array.isArray(row.relevantIds)&&(row.language===undefined||row.language==='en'||row.language==='ru'||row.language==='other')&&(row.category===undefined||MEMORY_RETRIEVAL_TASK_CATEGORIES.includes(row.category))&&(row.answerable===undefined||typeof row.answerable==='boolean')&&(row.conversationId===undefined||(typeof row.conversationId==='string'&&Boolean(row.conversationId.trim())&&row.conversationId.length<=160))&&(row.answerable===false?row.relevantIds.length===0:row.relevantIds.slice(0,24).some(x=>typeof x==='string'&&x.trim()))&&(row.split==='train'||row.split==='holdout'));
    if(!valid)droppedExamples++;
    return valid;
  }).map(row=>({id:row.id.trim().slice(0,120),query:row.query.trim().slice(0,500),...(row.language===undefined?{}:{language:row.language}),...(row.category===undefined?{}:{category:row.category}),...(row.conversationId===undefined?{}:{conversationId:row.conversationId.trim()}),relevantIds:row.relevantIds.filter(x=>typeof x==='string'&&x.trim()).slice(0,24).map(x=>x.trim().slice(0,160)),split:row.split,answerable:row.answerable!==false})).filter(row=>row.answerable===false||row.relevantIds.length>0).sort((a,b)=>a.split.localeCompare(b.split)||normalizeQuery(a.query).localeCompare(normalizeQuery(b.query))||a.id.localeCompare(b.id));
  const sourceItems=Array.isArray(snapshot?.items)?snapshot.items:[];
  const boundedSourceItems=sourceItems.slice(0,1600);
  const malformedCorpusRows=boundedSourceItems.filter(m=>!m||typeof m.id!=='string'||!m.id.trim()||typeof m.content!=='string').length;
  const validItems=boundedSourceItems.filter((m):m is MemoryItem2=>Boolean(m&&typeof m.id==='string'&&m.id.trim()&&typeof m.content==='string'));
  const corpusIds=new Set<string>();const duplicateCorpusIds=new Set<string>();
  for(const item of validItems){if(corpusIds.has(item.id))duplicateCorpusIds.add(item.id);corpusIds.add(item.id);}
  const truncatedCorpusItems=Math.max(0,sourceItems.length-boundedSourceItems.length);
  const corpusIntegrity={sourceItems:sourceItems.length,acceptedItems:validItems.length,malformedRows:malformedCorpusRows,duplicateIdCount:duplicateCorpusIds.size,truncatedItems:truncatedCorpusItems,validForPromotion:malformedCorpusRows===0&&duplicateCorpusIds.size===0&&truncatedCorpusItems===0};
  const corpus=validItems;
  const dataIntegrity=inspectDataset(examples,corpus,truncatedExamples,droppedExamples,truncatedFieldRows,malformedRelevantLabelCount,malformedConversationAnnotationCount);
  dataIntegrity.validForPromotion=dataIntegrity.validForPromotion&&corpusIntegrity.validForPromotion;
  const train=examples.filter(x=>x.split==='train');const holdout=examples.filter(x=>x.split==='holdout');
  // A real corpus-scoped Okapi BM25 baseline, not the former binary token-overlap
  // score. Index only current, recall-eligible rows at the fixed benchmark timestamp.
  const bm25K1=1.2,bm25B=.75;
  const bm25Documents=corpus.filter(m=>isCurrent(m,now)).map(m=>{
    const tokens=tokenSequence(m.content),tf=new Map<string,number>();
    for(const token of tokens)tf.set(token,(tf.get(token)??0)+1);
    return {m,tokens,tf,length:Math.max(1,tokens.length)};
  });
  const bm25DocumentFrequency=new Map<string,number>();
  let bm25TotalLength=0;
  for(const doc of bm25Documents){
    bm25TotalLength+=doc.length;
    for(const token of new Set(doc.tokens))bm25DocumentFrequency.set(token,(bm25DocumentFrequency.get(token)??0)+1);
  }
  const bm25AverageLength=Math.max(1,bm25TotalLength/Math.max(1,bm25Documents.length));
  const baselineConfiguration={name:'Okapi BM25',k1:bm25K1,b:bm25B,tokenization:'NFKC Unicode words of length >=2 plus standalone single-digit numbers',queryTermFrequency:'unique terms',corpusScope:'current, non-dormant, non-quarantined memories at fixed benchmark timestamp',documentCount:bm25Documents.length,averageDocumentLength:Number(bm25AverageLength.toFixed(4))};
  const baselineConfigurationFingerprint=createHash('sha256').update(JSON.stringify(baselineConfiguration)).digest('hex');
  const bm25Score=(query:string,doc:typeof bm25Documents[number])=>{
    const uniqueQueryTokens=new Set(queryTokens(query));
    if(!uniqueQueryTokens.size||!bm25Documents.length)return 0;
    let score=0;
    for(const token of uniqueQueryTokens){
      const frequency=doc.tf.get(token)??0;if(!frequency)continue;
      const df=bm25DocumentFrequency.get(token)??0;
      const idf=Math.log(1+(bm25Documents.length-df+.5)/(df+.5));
      const denominator=frequency+bm25K1*(1-bm25B+bm25B*doc.length/bm25AverageLength);
      score+=idf*(frequency*(bm25K1+1))/Math.max(1e-12,denominator);
    }
    return score;
  };
  const baseline=(query:string,limit:number):BenchmarkRetrievalResult=>{
    const started=performance.now();
    const items=bm25Documents.map(doc=>({m:doc.m,score:bm25Score(query,doc)}))
      .filter(row=>row.score>0)
      .sort((a,b)=>b.score-a.score||a.m.id.localeCompare(b.m.id))
      .slice(0,limit).map(row=>row.m);
    return {items,latencyMs:Math.max(0,performance.now()-started),isolationSetupMs:0};
  };
  // Both arms must see the exact same bounded corpus. The report still blocks promotion
  // when sourceItems exceeds the limit, but candidate retrieval must not secretly inspect
  // rows that the baseline was forbidden to index.
  const boundedSnapshotForBenchmark = { ...structuredClone(snapshot), items: structuredClone(corpus) } as MemoryOSState2;
  const candidate=(query:string,limit:number):BenchmarkRetrievalResult=>{const setupStarted=performance.now();const isolated=new MemoryOS2({metadataRecallEnabled:options.metadataRecallEnabled===true});isolated.restore(structuredClone(boundedSnapshotForBenchmark));const setupMs=performance.now()-setupStarted;const started=performance.now();const items=isolated.retrieve(query,limit,0,0,{temporalMode:'at',asOfAt:now},true) as MemoryItem2[];return {items,latencyMs:Math.max(0,performance.now()-started),isolationSetupMs:setupMs};};

  const baselineEval=evaluate(holdout,baseline,k,now);const candidateEval=evaluate(holdout,candidate,k,now);
  const trainBaseline=evaluate(train,baseline,k,now);const trainCandidate=evaluate(train,candidate,k,now);
  const datasetFingerprint=stableFingerprint(examples);const corpusHash=corpusFingerprint(corpus);const retrievalConfigHash=retrievalConfigurationFingerprint(snapshot,options);
  const seed=providedSeed??Number.parseInt(createHash('sha256').update(`${datasetFingerprint}:${corpusHash}`).digest('hex').slice(0,8),16);
  const confidence={
    method:'paired-conversation-cluster-bootstrap-percentile-interval' as const,
    samplingUnit:dataIntegrity.conversationAnnotationUsed?'conversation':'query',
    independentHoldoutGroups:dataIntegrity.uniqueAnswerableHoldoutConversationGroups,
    seed,
    recallAtK01:pairedBootstrapInterval(baselineEval.outcomes,candidateEval.outcomes,'recallAtK01',candidateEval.outcomeClusterIds,bootstrapSamples,seed),
    mrr01:pairedBootstrapInterval(baselineEval.outcomes,candidateEval.outcomes,'mrr01',candidateEval.outcomeClusterIds,bootstrapSamples,seed^0x9e3779b9),
    unsupportedRetrievalRate01:pairedBootstrapValuesInterval(baselineEval.unsupportedRetrievalOutcomes,candidateEval.unsupportedRetrievalOutcomes,candidateEval.unsupportedClusterIds,bootstrapSamples,seed^0x85ebca6b),
    clusterSensitivity:{
      recallAtK01:clusterLeaveOneOutSensitivity(baselineEval.outcomes,candidateEval.outcomes,'recallAtK01',candidateEval.outcomeClusterIds),
      mrr01:clusterLeaveOneOutSensitivity(baselineEval.outcomes,candidateEval.outcomes,'mrr01',candidateEval.outcomeClusterIds),
      interpretation:'diagnostic-only; influence analysis cannot replace independent holdout evidence',
    },
  };
  const evaluateLanguageSlice=(language:MemoryRetrievalLanguage)=>{
    const languageTrain=train.filter(row=>row.language===language);
    const languageHoldout=holdout.filter(row=>row.language===language);
    const languageAnswerableHoldout=languageHoldout.filter(row=>row.answerable!==false).length;
    const languageUnanswerableHoldout=languageHoldout.filter(row=>row.answerable===false).length;
    const languageBaseline=evaluate(languageHoldout,baseline,k,now);
    const languageCandidate=evaluate(languageHoldout,candidate,k,now);
    const languageSeed=((seed^(language==='en'?0x13579bdf:language==='ru'?0x2468ace0:0x9e3779b9))>>>0)||1;
    const languageConfidence={
      method:'paired-conversation-cluster-bootstrap-percentile-interval' as const,
      samplingUnit:languageHoldout.some(row=>row.conversationId!==undefined)?'conversation':'query',
      independentHoldoutGroups:new Set(languageHoldout.map(row=>row.conversationId?.trim()||`query:${row.id}`)).size,
      seed:languageSeed,
      recallAtK01:pairedBootstrapInterval(languageBaseline.outcomes,languageCandidate.outcomes,'recallAtK01',languageCandidate.outcomeClusterIds,bootstrapSamples,languageSeed),
      mrr01:pairedBootstrapInterval(languageBaseline.outcomes,languageCandidate.outcomes,'mrr01',languageCandidate.outcomeClusterIds,bootstrapSamples,languageSeed^0x9e3779b9),
      unsupportedRetrievalRate01:pairedBootstrapValuesInterval(languageBaseline.unsupportedRetrievalOutcomes,languageCandidate.unsupportedRetrievalOutcomes,languageCandidate.unsupportedClusterIds,bootstrapSamples,languageSeed^0x85ebca6b),
      clusterSensitivity:{
        recallAtK01:clusterLeaveOneOutSensitivity(languageBaseline.outcomes,languageCandidate.outcomes,'recallAtK01',languageCandidate.outcomeClusterIds),
        mrr01:clusterLeaveOneOutSensitivity(languageBaseline.outcomes,languageCandidate.outcomes,'mrr01',languageCandidate.outcomeClusterIds),
        interpretation:'diagnostic-only; influence analysis cannot replace independent holdout evidence',
      },
    };
    const languageRecallDelta=languageCandidate.metrics.recallAtK01-languageBaseline.metrics.recallAtK01;
    const languageMrrDelta=languageCandidate.metrics.mrr01-languageBaseline.metrics.mrr01;
    const languageAbstentionSafe=languageCandidate.metrics.unsupportedRetrievalRate01<=languageBaseline.metrics.unsupportedRetrievalRate01+unsupportedRetrievalTolerance;
    const languageAbstentionConfidenceSafe=languageConfidence.unsupportedRetrievalRate01.upperBound01<=unsupportedRetrievalTolerance;
    const languageMrrConfidenceSafe=languageConfidence.mrr01.lowerBound01>=-mrrTolerance;
    const languageNoUnsafeResults=languageCandidate.metrics.quarantinedResultCount===0&&languageCandidate.metrics.staleResultCount===0&&languageCandidate.metrics.futureResultCount===0&&languageCandidate.metrics.dormantResultCount===0&&languageCandidate.metrics.invalidEpistemicStatusResultCount===0&&languageCandidate.metrics.invalidResultRate01<=languageBaseline.metrics.invalidResultRate01;
    const gates={
      sufficientTrainQueries:languageTrain.length>=minLanguageTrainQueries,
      sufficientAnswerableHoldoutQueries:languageAnswerableHoldout>=minLanguageAnswerableHoldoutQueries,
      sufficientUnanswerableHoldoutQueries:languageUnanswerableHoldout>=minLanguageUnanswerableHoldoutQueries,
      sufficientIndependentHoldoutGroups:languageConfidence.recallAtK01.independentClusters>=minIndependentHoldoutGroups,
      minimumRecallUplift:languageRecallDelta>=minUplift,
      recallUpliftConfidenceSupported:languageConfidence.recallAtK01.lowerBound01>0,
      mrrPointEstimateNonInferior:languageMrrDelta>=-mrrTolerance,
      mrrConfidenceNonInferioritySupported:languageMrrConfidenceSafe,
      noUnsafeCandidateResults:languageNoUnsafeResults,
      abstentionNonInferiority:languageAbstentionSafe,
      abstentionConfidenceNonInferioritySupported:languageAbstentionConfidenceSafe,
    };
    return {
      language,
      trainQueries:languageTrain.length,
      holdoutQueries:languageHoldout.length,
      answerableHoldoutQueries:languageAnswerableHoldout,
      unanswerableHoldoutQueries:languageUnanswerableHoldout,
      metrics:{baseline:languageBaseline.metrics,candidate:languageCandidate.metrics,train:{
        baseline:evaluate(languageTrain,baseline,k,now).metrics,
        candidate:evaluate(languageTrain,candidate,k,now).metrics,
      }},
      deltas:{recallAtK01:Number(languageRecallDelta.toFixed(4)),mrr01:Number(languageMrrDelta.toFixed(4))},
      confidence:languageConfidence,
      gates,
      eligible:Object.values(gates).every(Boolean),
    };
  };
  const languageSlices:Partial<Record<MemoryRetrievalLanguage,ReturnType<typeof evaluateLanguageSlice>>>={};
  for(const language of ['en','ru','other'] as const){
    if(examples.some(row=>row.language===language))languageSlices[language]=evaluateLanguageSlice(language);
  }
  const provenanceInput=options.datasetProvenance??{};
  const provenance={datasetId:textField(provenanceInput.datasetId,120),datasetVersion:textField(provenanceInput.datasetVersion,120),sourceRef:textField(provenanceInput.sourceRef,240),labelingProtocol:textField(provenanceInput.labelingProtocol,500),licenseId:textField(provenanceInput.licenseId,120),contentSha256:textField(provenanceInput.contentSha256,64).toLowerCase()};
  const contentHashValid=/^[a-f0-9]{64}$/.test(provenance.contentSha256)&&provenance.contentSha256===datasetFingerprint;
  const provenanceComplete=Boolean(provenance.datasetId&&provenance.datasetVersion&&provenance.sourceRef&&provenance.labelingProtocol&&provenance.licenseId&&contentHashValid);
  const languageAnnotationsUsed=examples.some(row=>row.language!==undefined);
  const languageAnnotationsComplete=dataIntegrity.languageAnnotationComplete;
  const bothRequiredLanguagesPresent=languageSlices.en!==undefined&&languageSlices.ru!==undefined;
  const sufficientLanguageTrainQueriesPerLanguage=(languageSlices.en?.trainQueries??0)>=minLanguageTrainQueries&&(languageSlices.ru?.trainQueries??0)>=minLanguageTrainQueries;
  const sufficientLanguageAnswerableHoldoutPerLanguage=(languageSlices.en?.answerableHoldoutQueries??0)>=minLanguageAnswerableHoldoutQueries&&(languageSlices.ru?.answerableHoldoutQueries??0)>=minLanguageAnswerableHoldoutQueries;
  const sufficientLanguageUnanswerableHoldoutPerLanguage=(languageSlices.en?.unanswerableHoldoutQueries??0)>=minLanguageUnanswerableHoldoutQueries&&(languageSlices.ru?.unanswerableHoldoutQueries??0)>=minLanguageUnanswerableHoldoutQueries;
  const languageQualitySupportedAcrossRequiredLanguages=languageSlices.en?.eligible===true&&languageSlices.ru?.eligible===true;
  const languageStratifiedQualityEligible=languageAnnotationsUsed&&languageAnnotationsComplete&&bothRequiredLanguagesPresent&&sufficientLanguageTrainQueriesPerLanguage&&sufficientLanguageAnswerableHoldoutPerLanguage&&sufficientLanguageUnanswerableHoldoutPerLanguage&&languageQualitySupportedAcrossRequiredLanguages;
  const languageStratificationReason=!languageAnnotationsUsed?'bilingual-language-annotations-required':!languageAnnotationsComplete?'language-annotations-incomplete':!bothRequiredLanguagesPresent?'english-and-russian-required':!sufficientLanguageTrainQueriesPerLanguage?'insufficient-language-train-evidence':!sufficientLanguageAnswerableHoldoutPerLanguage||!sufficientLanguageUnanswerableHoldoutPerLanguage?'insufficient-language-stratified-holdout':!languageQualitySupportedAcrossRequiredLanguages?'language-stratified-quality-not-supported':'language-stratified-quality-supported';
  const languageStratification={
    enabled:languageAnnotationsUsed,
    annotationsComplete:languageAnnotationsUsed&&languageAnnotationsComplete,
    requiredLanguages:['en','ru'] as const,
    minimums:{trainQueriesPerLanguage:minLanguageTrainQueries,answerableHoldoutQueriesPerLanguage:minLanguageAnswerableHoldoutQueries,unanswerableHoldoutQueriesPerLanguage:minLanguageUnanswerableHoldoutQueries,independentHoldoutGroupsPerLanguage:minIndependentHoldoutGroups},
    slices:languageSlices,
    gates:{
      annotationsPresent:languageAnnotationsUsed,
      annotationsComplete:languageAnnotationsUsed&&languageAnnotationsComplete,
      bothRequiredLanguagesPresent,
      sufficientTrainQueriesPerLanguage:sufficientLanguageTrainQueriesPerLanguage,
      sufficientAnswerableHoldoutPerLanguage:sufficientLanguageAnswerableHoldoutPerLanguage,
      sufficientUnanswerableHoldoutPerLanguage:sufficientLanguageUnanswerableHoldoutPerLanguage,
      qualitySupportedAcrossRequiredLanguages:languageQualitySupportedAcrossRequiredLanguages,
      promotionEligible:languageStratifiedQualityEligible,
    },
    eligibleForPromotion:languageStratifiedQualityEligible,
    reason:languageStratificationReason,
  };
  const taskCategoryAnnotationsUsed=examples.some(row=>row.category!==undefined);
  const taskCategoryAnnotationsComplete=!taskCategoryAnnotationsUsed||examples.every(row=>row.category!==undefined);
  const taskCategories=[...new Set(examples.filter(row=>row.category!==undefined).map(row=>row.category!))].sort();
  if(taskCategoryAnnotationsUsed&&!taskCategoryAnnotationsComplete)dataIntegrity.validForPromotion=false;
  const taskCategorySlices:Partial<Record<MemoryRetrievalTaskCategory,unknown>>={};
  if(taskCategoryAnnotationsUsed&&taskCategoryAnnotationsComplete){
    for(const category of taskCategories){
      const slice=holdout.filter(row=>row.category===category);
      if(!slice.length)continue;
      const categoryBaseline=evaluate(slice,baseline,k,now);
      const categoryCandidate=evaluate(slice,candidate,k,now);
      const categoryAnswerableGroups=new Map<string,number>();
      const categoryUnanswerableGroups=new Map<string,number>();
      for(const row of slice){
        const groupId=row.conversationId?.trim()||`query:${row.id}`;
        const target=row.answerable===false?categoryUnanswerableGroups:categoryAnswerableGroups;
        target.set(groupId,(target.get(groupId)??0)+1);
      }
      const summarizeCategoryGroups=(counts:Map<string,number>)=>{
        const sizes=[...counts.values()].sort((a,b)=>a-b),n=sizes.length;
        const median=n?(n%2?sizes[(n-1)/2]!:(sizes[n/2-1]!+sizes[n/2]!)/2):0;
        const total=sizes.reduce((sum,value)=>sum+value,0),maximum=n?sizes[n-1]!:0;
        return {independentConversations:n,queries:total,minClusterSize:n?sizes[0]!:0,medianClusterSize:Number(median.toFixed(2)),maxClusterSize:maximum,largestClusterShare01:Number((maximum/Math.max(1,total)).toFixed(4))};
      };
      taskCategorySlices[category]={
        category,holdoutQueries:slice.length,
        answerableHoldoutQueries:slice.filter(row=>row.answerable!==false).length,
        unanswerableHoldoutQueries:slice.filter(row=>row.answerable===false).length,
        independentAnswerableConversations:categoryAnswerableGroups.size,
        independentUnanswerableConversations:categoryUnanswerableGroups.size,
        answerableClusterSizes:summarizeCategoryGroups(categoryAnswerableGroups),
        unanswerableClusterSizes:summarizeCategoryGroups(categoryUnanswerableGroups),
        baseline:categoryBaseline.metrics,
        candidate:categoryCandidate.metrics,
        deltas:{
          recallAtK01:Number((categoryCandidate.metrics.recallAtK01-categoryBaseline.metrics.recallAtK01).toFixed(4)),
          mrr01:Number((categoryCandidate.metrics.mrr01-categoryBaseline.metrics.mrr01).toFixed(4)),
          unsupportedRetrievalRate01:Number((categoryCandidate.metrics.unsupportedRetrievalRate01-categoryBaseline.metrics.unsupportedRetrievalRate01).toFixed(4)),
        },
        interpretation:'diagnostic-only; no per-category sample-size or confidence promotion gate is applied',
      };
    }
  }
  const taskCategoryStratification={
    enabled:taskCategoryAnnotationsUsed,
    annotationsComplete:taskCategoryAnnotationsUsed&&taskCategoryAnnotationsComplete,
    holdoutOnly:true,
    categories:taskCategories,
    slices:taskCategorySlices,
    autoPromotionInfluence:false,
    reason:!taskCategoryAnnotationsUsed?'task-category-annotations-not-provided':!taskCategoryAnnotationsComplete?'task-category-annotations-incomplete':'diagnostic-task-category-slices-ready',
  };
  const labelledHoldoutQueries=holdout.filter(x=>x.answerable!==false).length;
  const unanswerableHoldoutQueries=holdout.filter(x=>x.answerable===false).length;
  const enoughEvidence=labelledHoldoutQueries>=minHoldout&&dataIntegrity.uniqueTrainQueries>=4&&corpus.length>=12;
  const enoughIndependentHoldoutGroups=confidence.recallAtK01.independentClusters>=minIndependentHoldoutGroups;
  const enoughUnanswerableEvidence=unanswerableHoldoutQueries>=minUnanswerableHoldout;
  const baselineMetrics=baselineEval.metrics;const candidateMetrics=candidateEval.metrics;
  const recallDelta=candidateMetrics.recallAtK01-baselineMetrics.recallAtK01;
  const mrrDelta=candidateMetrics.mrr01-baselineMetrics.mrr01;
  const quarantineSafe=candidateMetrics.quarantinedResultCount===0;
  const staleSafe=candidateMetrics.staleResultCount===0&&candidateMetrics.futureResultCount===0;
  const dormantSafe=candidateMetrics.dormantResultCount===0;
  const epistemicStatusSafe=candidateMetrics.invalidEpistemicStatusResultCount===0;
  const validRateSafe=candidateMetrics.invalidResultRate01<=baselineMetrics.invalidResultRate01;
  const abstentionSafe=candidateMetrics.unsupportedRetrievalRate01<=baselineMetrics.unsupportedRetrievalRate01+unsupportedRetrievalTolerance;
  // Point-estimate non-regression is not enough when the unanswerable holdout is small.
  // Bound the paired bootstrap's upper tail so noisy samples cannot silently pass the gate.
  const abstentionConfidenceNonInferioritySupported=confidence.unsupportedRetrievalRate01.upperBound01<=unsupportedRetrievalTolerance;
  const confidenceSupported=confidence.recallAtK01.lowerBound01>0;
  // Recall uplift alone is insufficient: a point estimate can hide a material but
  // noisy MRR regression. Promotion review requires the paired-bootstrap lower bound
  // for MRR to stay within the configured non-inferiority tolerance.
  const mrrNonInferioritySupported=confidence.mrr01.lowerBound01>=-mrrTolerance;
  const promotionGates={
    bootstrapSeedValid:seedInputValid,
    corpusIntegrity:corpusIntegrity.validForPromotion,
    datasetIntegrity:dataIntegrity.validForPromotion,
    provenanceComplete,
    sufficientEvidence:enoughEvidence,
    sufficientIndependentHoldoutGroups:enoughIndependentHoldoutGroups,
    sufficientUnanswerableEvidence:enoughUnanswerableEvidence,
    minimumRecallUplift:recallDelta>=minUplift,
    recallUpliftConfidenceSupported:confidenceSupported,
    mrrPointEstimateNonInferior:mrrDelta>=-mrrTolerance,
    mrrConfidenceNonInferioritySupported:mrrNonInferioritySupported,
    noUnsafeCandidateResults:quarantineSafe&&staleSafe&&dormantSafe&&epistemicStatusSafe&&validRateSafe,
    abstentionNonInferiority:abstentionSafe,
    abstentionConfidenceNonInferioritySupported,
    languageStratifiedQuality:languageStratifiedQualityEligible,
  };
  const promotionAllowed=Object.values(promotionGates).every(Boolean);
  const reason=!seedInputValid?'invalid-bootstrap-seed':!corpusIntegrity.validForPromotion?'corpus-integrity-failed':!dataIntegrity.validForPromotion?'dataset-integrity-failed':!provenanceComplete?'dataset-provenance-incomplete':!enoughEvidence?'insufficient-labelled-holdout-or-corpus':!enoughIndependentHoldoutGroups?'insufficient-independent-holdout-conversations':!enoughUnanswerableEvidence?'insufficient-unanswerable-holdout':!quarantineSafe?'candidate-returned-quarantined-memory':!staleSafe?'candidate-returned-out-of-window-memory':!dormantSafe?'candidate-returned-dormant-memory':!epistemicStatusSafe?'candidate-returned-invalid-epistemic-status':!validRateSafe?'candidate-result-integrity-regression':!abstentionSafe?'unsupported-retrieval-rate-regression':!abstentionConfidenceNonInferioritySupported?'unsupported-retrieval-regression-not-confidence-bounded':recallDelta<minUplift?'recall-uplift-below-threshold':!confidenceSupported?'recall-uplift-not-confidence-supported':!mrrNonInferioritySupported?'mrr-regression-not-confidence-bounded':mrrDelta < -mrrTolerance?'mrr-regression-exceeds-tolerance':!languageStratifiedQualityEligible?languageStratificationReason:'holdout-gates-passed';
  return {
    schemaVersion:7 as const,benchmark:'memoryos2-retrieval-vs-bm25-baseline',retrievalAlgorithmVersion:RETRIEVAL_ALGORITHM_VERSION,benchmarkProtocolVersion:BENCHMARK_PROTOCOL_VERSION,mode:'offline-clone; no-live-state-mutation' as const,latencyDefinition:'p95 measures retrieval only; isolationSetupP95Ms is reported separately',
    now,k,corpusSize:corpus.length,trainQueries:train.length,holdoutQueries:holdout.length,datasetFingerprint,corpusFingerprint:corpusHash,retrievalConfigurationFingerprint:retrievalConfigHash,corpusIntegrity,
    datasetIntegrity:{...dataIntegrity,validForPromotion:dataIntegrity.validForPromotion&&provenanceComplete,provenanceComplete},
    experimentConfiguration:{seedInputValid,requestedSeed:seedWasProvided?(Number.isFinite(requestedSeed)?requestedSeed:String(options.seed)):'auto-derived',effectiveSeed:seed,candidateMetadataRecallEnabled:options.metadataRecallEnabled===true,maximumMrrRegression01:mrrTolerance,maximumUnsupportedRetrievalRegression01:unsupportedRetrievalTolerance},
    datasetProvenance:{...provenance,contentHashValid},
    baselineConfiguration,baselineConfigurationFingerprint,
    metrics:{baseline:baselineMetrics,candidate:candidateMetrics,train:{baseline:trainBaseline.metrics,candidate:trainCandidate.metrics}},
    deltas:{recallAtK01:Number(recallDelta.toFixed(4)),mrr01:Number(mrrDelta.toFixed(4))},confidence,
    languageStratification,
    taskCategoryStratification,
    promotion:{allowed:promotionAllowed,status:promotionAllowed?'candidate-eligible-for-separate-review':'not-promoted',reason,gates:promotionGates,minimumHoldoutQueries:minHoldout,minimumIndependentHoldoutGroups:minIndependentHoldoutGroups,minimumUnanswerableHoldoutQueries:minUnanswerableHoldout,minimumLanguageTrainQueries:minLanguageTrainQueries,minimumLanguageAnswerableHoldoutQueries:minLanguageAnswerableHoldoutQueries,minimumLanguageUnanswerableHoldoutQueries:minLanguageUnanswerableHoldoutQueries,requiredLanguages:['en','ru'],minimumRecallUplift01:minUplift,maximumMrrRegression01:mrrTolerance,maximumUnsupportedRetrievalRegression01:unsupportedRetrievalTolerance,mrrNonInferioritySupported,abstentionConfidenceNonInferioritySupported,mrrLowerBound01:confidence.mrr01.lowerBound01,requiresIndependentHumanOrCIReview:true},
    guardrails:{minimumUnanswerableHoldoutQueriesRequired:true,minimumIndependentHoldoutConversationGroupsRequired:true,conversationClusterBootstrapRequired:true,multiSessionRowsRequireConversationId:true,conversationCannotCrossTrainHoldout:true,minimumLanguageStratifiedQualityRequired:true,bothEnglishAndRussianRequiredForPromotion:true,perLanguageConfidenceBoundsRequired:true,languageLabelsMustBeExplicit:true,liveMemoryMutated:false,identityOrPolicyChanged:false,labelsInferredFromPredictions:false,holdoutUsedForTraining:false,quarantinedMemoryMayPromote:false,staleEvidenceMayPromote:false,futureEvidenceMayPromote:false,dormantMemoryMayPromote:false,invalidEpistemicStatusMayPromote:false,corpusIntegrityBlocksPromotion:true,splitLeakageBlocksPromotion:true,unknownGroundTruthIdsBlockPromotion:true,unanswerableQueryLabelsRequired:true,unsupportedRetrievalRateMustNotRegress:true,provenanceRequiredForPromotion:true,invalidSeedMayPromote:false,mrrRegressionMustBeConfidenceBounded:true,unsupportedRetrievalRegressionMustBeConfidenceBounded:true,candidateModeExplicit:true,candidateModeAutoPromoted:false,bootstrapSeed:seed},
  };
}
