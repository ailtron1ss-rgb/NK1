import { createHash, createHmac, randomBytes } from 'node:crypto';
import { MemoryOS2, type MemoryOSState2, type MemoryItem2 } from '../developmental/MemoryOS2.ts';

export type MemoryRetrievalLanguage = 'en' | 'ru' | 'other';

export interface MemoryRetrievalBenchmarkExample {
  id: string;
  query: string;
  relevantIds: string[];
  split: 'train' | 'holdout';
  /** Explicit dataset annotation; never inferred from candidate retrieval output. */
  language?: MemoryRetrievalLanguage;
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
  /** Minimum explicitly unanswerable holdout queries required to evaluate abstention safely. */
  minUnanswerableHoldoutQueries?: number;
  minimumRecallUplift01?: number;
  maximumMrrRegression01?: number;
  /** Maximum tolerated increase in unsupported retrieval rate; default is strict non-inferiority. */
  maximumUnsupportedRetrievalRegression01?: number;
  bootstrapSamples?: number;
  seed?: number;
  datasetProvenance?: MemoryRetrievalBenchmarkProvenance;
  /** Emit a bounded, hashed per-query baseline/candidate trace for an external evaluator. */
  includeQueryEvidence?: boolean;
  /** Ephemeral HMAC key shared across paired bootstrap runs; never serialized into reports. */
  evidenceHashSalt?: string;
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
const canonicalExamples=(rows:MemoryRetrievalBenchmarkExample[])=>[...rows].map(x=>({id:x.id,query:normalizeQuery(x.query),...(x.language===undefined?{}:{language:x.language}),relevantIds:[...x.relevantIds].sort(),split:x.split,answerable:x.answerable!==false})).sort((a,b)=>a.id.localeCompare(b.id)||a.split.localeCompare(b.split)||a.query.localeCompare(b.query)||a.relevantIds.join('\0').localeCompare(b.relevantIds.join('\0')));
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
const retrievalConfigurationFingerprint=(snapshot:MemoryOSState2,options:MemoryRetrievalBenchmarkOptions={})=>createHash('sha256').update(JSON.stringify(canonicalJsonValue({algorithm:RETRIEVAL_ALGORITHM_VERSION,tokenization:'NFKC Unicode words plus standalone single-digit numbers',candidateMetadataRecallEnabled:options.metadataRecallEnabled===true,version:snapshot?.version??null,adaptiveMemoryPolicy:snapshot?.adaptiveMemoryPolicy??null,linkUpdates:snapshot?.linkUpdates??0,semanticQueries:snapshot?.semanticQueries??0}))).digest('hex');
const isCurrent=(m:MemoryItem2,now:number)=>!m.dormant&&m.epistemicStatus!=='quarantined'&&(m.supersededById==null||m.validUntilAt!=null)&&(m.validFromAt==null||Number(m.validFromAt)<=now)&&(m.validUntilAt==null||Number(m.validUntilAt)>now);
function p95(values:number[]){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)]??0;}
function textField(value:unknown,max=200){return typeof value==='string'?value.trim().slice(0,max):'';}

type BenchmarkRetrievalResult = MemoryItem2[] | { items: MemoryItem2[]; latencyMs: number; isolationSetupMs?: number };
type QueryOutcome={recallAtK01:number;mrr01:number};
export interface MemoryRetrievalArmEvidenceV1 {
  memoryIdDigest:string;
  quarantined:boolean;
  stale:boolean;
  future:boolean;
  dormant:boolean;
  invalidEpistemicStatus:boolean;
}
export interface MemoryRetrievalQueryEvidenceV1 {
  exampleIdDigest:string;
  queryDigest:string;
  split:'train'|'holdout';
  language:MemoryRetrievalLanguage;
  answerable:boolean;
  relevantMemoryIdDigests:string[];
  rankedMemory:MemoryRetrievalArmEvidenceV1[];
}
type Evaluation={metrics:RetrievalBenchmarkMetrics;outcomes:QueryOutcome[];unsupportedRetrievalOutcomes:number[];queryEvidence:MemoryRetrievalQueryEvidenceV1[]};

function evaluate(examples:MemoryRetrievalBenchmarkExample[], retrieve:(query:string,k:number)=>BenchmarkRetrievalResult, k:number, now:number, includeQueryEvidence=false, digestEvidence?:(value:string)=>string):Evaluation {
  let recall=0,mrr=0,precision=0,covered=0,quarantined=0,stale=0,future=0,dormant=0,invalidEpistemic=0,duplicates=0,invalid=0;
  let answerableQueries=0,unanswerableQueries=0,unsupportedRetrievalCount=0,falseAbstentionCount=0;
  const latency:number[]=[]; const setupLatency:number[]=[]; const outcomes:QueryOutcome[]=[]; const unsupportedRetrievalOutcomes:number[]=[];
  const queryEvidence:MemoryRetrievalQueryEvidenceV1[]=[];
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
    if(includeQueryEvidence){
      if(typeof digestEvidence!=='function')throw new Error('memory-query-evidence-hash-key-required');
      queryEvidence.push({
        exampleIdDigest:digestEvidence(ex.id),
        queryDigest:digestEvidence(normalizeQuery(ex.query)),
        split:ex.split,
        language:ex.language??'other',
        answerable,
        relevantMemoryIdDigests:[...new Set(ex.relevantIds.map(id=>digestEvidence(id)))].sort(),
        rankedMemory:results.filter(row=>Boolean(row?.id)).map(row=>({
          memoryIdDigest:digestEvidence(row.id),
          quarantined:row.epistemicStatus==='quarantined',
          stale:(row.validUntilAt!=null&&Number(row.validUntilAt)<=now)||(row.supersededById!=null&&row.validUntilAt==null),
          future:row.validFromAt!=null&&Number(row.validFromAt)>now,
          dormant:Boolean(row.dormant),
          invalidEpistemicStatus:!['fact','belief','hypothesis','unknown','quarantined'].includes(String(row.epistemicStatus)),
        })),
      });
    }
    if(answerable){
      answerableQueries++;
      const hitIds=new Set(hits.map(row=>row.id));
      const queryRecall=relevant.size?hitIds.size/relevant.size:0;
      const first=results.findIndex(row=>relevant.has(row.id));
      const queryMrr=first>=0?1/(first+1):0;
      outcomes.push({recallAtK01:queryRecall,mrr01:queryMrr});
      recall+=queryRecall;
      // Precision counts unique relevant memory IDs, not duplicate rows for one memory.
      precision+=new Set(hits.map(row=>row.id)).size/k;
      mrr+=queryMrr;
      if(results.length===0)falseAbstentionCount++;
    }else{
      unanswerableQueries++;
      const unsupported=results.length>0?1:0;
      unsupportedRetrievalOutcomes.push(unsupported);
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
  return {metrics,outcomes,unsupportedRetrievalOutcomes,queryEvidence};
}
function pairedBootstrapInterval(baseline:QueryOutcome[],candidate:QueryOutcome[],metric:'recallAtK01'|'mrr01',samples:number,seed:number){
  const n=Math.min(baseline.length,candidate.length);
  if(!n)return {samples:0,lowerBound01:0,medianDelta01:0,upperBound01:0};
  // xorshift32 makes the resampling sequence deterministic across runs and does not
  // depend on platform-specific crypto/random state after the seed is chosen.
  let state=(seed>>>0)||0x6d2b79f5;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const deltas:number[]=[];
  for(let s=0;s<samples;s++){
    let delta=0;
    for(let i=0;i<n;i++){const ix=Math.floor(random()*n);delta+=candidate[ix][metric]-baseline[ix][metric];}
    deltas.push(delta/n);
  }
  deltas.sort((a,b)=>a-b);
  const at=(p:number)=>Number((deltas[Math.min(deltas.length-1,Math.max(0,Math.floor((deltas.length-1)*p)))]??0).toFixed(4));
  return {samples,lowerBound01:at(.025),medianDelta01:at(.5),upperBound01:at(.975)};
}

function pairedBootstrapValuesInterval(baseline:number[],candidate:number[],samples:number,seed:number){
  const n=Math.min(baseline.length,candidate.length);
  if(!n)return {samples:0,lowerBound01:0,medianDelta01:0,upperBound01:0};
  let state=(seed>>>0)||0x6d2b79f5;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const deltas:number[]=[];
  for(let s=0;s<samples;s++){
    let delta=0;
    for(let i=0;i<n;i++){const ix=Math.floor(random()*n);delta+=candidate[ix]-baseline[ix];}
    deltas.push(delta/n);
  }
  deltas.sort((a,b)=>a-b);
  const at=(p:number)=>Number((deltas[Math.min(deltas.length-1,Math.max(0,Math.floor((deltas.length-1)*p)))]??0).toFixed(4));
  return {samples,lowerBound01:at(.025),medianDelta01:at(.5),upperBound01:at(.975)};
}
function inspectDataset(rawExamples:MemoryRetrievalBenchmarkExample[],corpus:MemoryItem2[],truncatedExamples:number,droppedExamples:number,truncatedFieldRows:number,malformedRelevantLabelCount:number){
  const knownIds=new Set(corpus.map(row=>row.id));
  const duplicateIds=new Set<string>();const seenIds=new Set<string>();
  const duplicateRelevantIds=new Set<string>();
  const unknownRelevantIds=new Set<string>();
  for(const row of rawExamples){
    if(seenIds.has(row.id))duplicateIds.add(row.id);seenIds.add(row.id);
    const unique=new Set(row.relevantIds);if(unique.size!==row.relevantIds.length)duplicateRelevantIds.add(row.id);
    for(const id of unique)if(!knownIds.has(id))unknownRelevantIds.add(id);
  }
  // Count repeated normalized query groups explicitly. Cross-split overlap is a hard
  // leakage risk even if each individual row has a unique example ID.
  const queryCounts=new Map<string,number>();for(const row of rawExamples){const q=normalizeQuery(row.query);queryCounts.set(q,(queryCounts.get(q)??0)+1);}
  const repeatedQueryKeys=[...queryCounts.entries()].filter(([,count])=>count>1).map(([q])=>q);
  const crossSplitQueryLeakageCount=repeatedQueryKeys.filter(q=>new Set(rawExamples.filter(row=>normalizeQuery(row.query)===q).map(row=>row.split)).size>1).length;
  // Exact normalization misses tiny edits such as an added trailing word. Detect only
  // very high-overlap 3-token-shingle pairs across train/holdout; short/common queries
  // are intentionally excluded to avoid turning topical similarity into false leakage.
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
  const languageAnnotationUsed=rawExamples.some(row=>row.language!==undefined);
  const languageAnnotationComplete=!languageAnnotationUsed||rawExamples.every(row=>row.language!==undefined);
  const duplicateExampleIdCount=duplicateIds.size;
  const duplicateRelevantLabelCount=duplicateRelevantIds.size;
  const unknownRelevantMemoryIdCount=unknownRelevantIds.size;
  // Same-split duplicate prompts distort independent-query weighting too, so they are
  // reported and block promotion rather than being silently treated as extra evidence.
  const duplicateQueryGroupCount=repeatedQueryKeys.length;
  const validForPromotion=truncatedExamples===0&&droppedExamples===0&&truncatedFieldRows===0&&duplicateExampleIdCount===0&&duplicateQueryGroupCount===0&&duplicateRelevantLabelCount===0&&malformedRelevantLabelCount===0&&unknownRelevantMemoryIdCount===0&&crossSplitQueryLeakageCount===0&&nearDuplicateCrossSplitPairCount===0&&languageAnnotationComplete;
  return {sourceExamples:rawExamples.length+truncatedExamples+droppedExamples,acceptedExamples:rawExamples.length,droppedExamples,truncatedExamples,truncatedFieldRows,malformedRelevantLabelCount,duplicateExampleIdCount,duplicateQueryGroupCount,duplicateRelevantLabelCount,uniqueTrainQueries,uniqueHoldoutQueries,crossSplitQueryLeakageCount,nearDuplicateCrossSplitPairCount,unknownRelevantMemoryIdCount,languageAnnotationUsed,languageAnnotationComplete,validForPromotion};
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
  const truncatedFieldRows=limited.filter(row=>Boolean(row&&((typeof row.id==='string'&&row.id.length>120)||(typeof row.query==='string'&&row.query.length>500)||(Array.isArray(row.relevantIds)&&(row.relevantIds.length>24||row.relevantIds.some(id=>typeof id==='string'&&id.length>160)))))).length;
  const examples=limited.filter((row):row is MemoryRetrievalBenchmarkExample=>{
    const valid=Boolean(row&&typeof row.id==='string'&&row.id.trim()&&typeof row.query==='string'&&row.query.trim()&&Array.isArray(row.relevantIds)&&(row.language===undefined||row.language==='en'||row.language==='ru'||row.language==='other')&&(row.answerable===undefined||typeof row.answerable==='boolean')&&(row.answerable===false?row.relevantIds.length===0:row.relevantIds.slice(0,24).some(x=>typeof x==='string'&&x.trim()))&&(row.split==='train'||row.split==='holdout'));
    if(!valid)droppedExamples++;
    return valid;
  }).map(row=>({id:row.id.trim().slice(0,120),query:row.query.trim().slice(0,500),...(row.language===undefined?{}:{language:row.language}),relevantIds:row.relevantIds.filter(x=>typeof x==='string'&&x.trim()).slice(0,24).map(x=>x.trim().slice(0,160)),split:row.split,answerable:row.answerable!==false})).filter(row=>row.answerable===false||row.relevantIds.length>0).sort((a,b)=>a.split.localeCompare(b.split)||normalizeQuery(a.query).localeCompare(normalizeQuery(b.query))||a.id.localeCompare(b.id));
  const sourceItems=Array.isArray(snapshot?.items)?snapshot.items:[];
  const boundedSourceItems=sourceItems.slice(0,1600);
  const malformedCorpusRows=boundedSourceItems.filter(m=>!m||typeof m.id!=='string'||!m.id.trim()||typeof m.content!=='string').length;
  const validItems=boundedSourceItems.filter((m):m is MemoryItem2=>Boolean(m&&typeof m.id==='string'&&m.id.trim()&&typeof m.content==='string'));
  const corpusIds=new Set<string>();const duplicateCorpusIds=new Set<string>();
  for(const item of validItems){if(corpusIds.has(item.id))duplicateCorpusIds.add(item.id);corpusIds.add(item.id);}
  const truncatedCorpusItems=Math.max(0,sourceItems.length-boundedSourceItems.length);
  const corpusIntegrity={sourceItems:sourceItems.length,acceptedItems:validItems.length,malformedRows:malformedCorpusRows,duplicateIdCount:duplicateCorpusIds.size,truncatedItems:truncatedCorpusItems,validForPromotion:malformedCorpusRows===0&&duplicateCorpusIds.size===0&&truncatedCorpusItems===0};
  const corpus=validItems;
  const dataIntegrity=inspectDataset(examples,corpus,truncatedExamples,droppedExamples,truncatedFieldRows,malformedRelevantLabelCount);
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

  const includeQueryEvidence=options.includeQueryEvidence===true;
  const evidenceHashSalt = includeQueryEvidence
    ? (typeof options.evidenceHashSalt==='string' && /^[a-f0-9]{64}$/i.test(options.evidenceHashSalt)
      ? options.evidenceHashSalt.toLowerCase() : randomBytes(32).toString('hex'))
    : '';
  const digestEvidence=(value:string)=>createHmac('sha256',evidenceHashSalt).update(value).digest('hex');
  const baselineEval=evaluate(holdout,baseline,k,now,includeQueryEvidence,digestEvidence);const candidateEval=evaluate(holdout,candidate,k,now,includeQueryEvidence,digestEvidence);
  const trainBaseline=evaluate(train,baseline,k,now,includeQueryEvidence,digestEvidence);const trainCandidate=evaluate(train,candidate,k,now,includeQueryEvidence,digestEvidence);
  const datasetFingerprint=stableFingerprint(examples);const corpusHash=corpusFingerprint(corpus);const retrievalConfigHash=retrievalConfigurationFingerprint(snapshot,options);
  const seed=providedSeed??Number.parseInt(createHash('sha256').update(`${datasetFingerprint}:${corpusHash}`).digest('hex').slice(0,8),16);
  const confidence={
    method:'paired-query-bootstrap-percentile-interval' as const,
    seed,
    recallAtK01:pairedBootstrapInterval(baselineEval.outcomes,candidateEval.outcomes,'recallAtK01',bootstrapSamples,seed),
    mrr01:pairedBootstrapInterval(baselineEval.outcomes,candidateEval.outcomes,'mrr01',bootstrapSamples,seed^0x9e3779b9),
    unsupportedRetrievalRate01:pairedBootstrapValuesInterval(baselineEval.unsupportedRetrievalOutcomes,candidateEval.unsupportedRetrievalOutcomes,bootstrapSamples,seed^0x85ebca6b),
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
      method:'paired-query-bootstrap-percentile-interval' as const,
      seed:languageSeed,
      recallAtK01:pairedBootstrapInterval(languageBaseline.outcomes,languageCandidate.outcomes,'recallAtK01',bootstrapSamples,languageSeed),
      mrr01:pairedBootstrapInterval(languageBaseline.outcomes,languageCandidate.outcomes,'mrr01',bootstrapSamples,languageSeed^0x9e3779b9),
      unsupportedRetrievalRate01:pairedBootstrapValuesInterval(languageBaseline.unsupportedRetrievalOutcomes,languageCandidate.unsupportedRetrievalOutcomes,bootstrapSamples,languageSeed^0x85ebca6b),
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
    minimums:{trainQueriesPerLanguage:minLanguageTrainQueries,answerableHoldoutQueriesPerLanguage:minLanguageAnswerableHoldoutQueries,unanswerableHoldoutQueriesPerLanguage:minLanguageUnanswerableHoldoutQueries},
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
  const labelledHoldoutQueries=holdout.filter(x=>x.answerable!==false).length;
  const unanswerableHoldoutQueries=holdout.filter(x=>x.answerable===false).length;
  const enoughEvidence=labelledHoldoutQueries>=minHoldout&&dataIntegrity.uniqueTrainQueries>=4&&corpus.length>=12;
  const enoughUnanswerableEvidence=unanswerableHoldoutQueries>=minUnanswerableHoldout;
  const queryEvidence=includeQueryEvidence?{
    schemaVersion:1 as const,
    digestAlgorithm:'hmac-sha256-ephemeral-per-experiment' as const,
    queryNormalization:'NFKC-lower-punctuation-symbol-and-whitespace-normalization' as const,
    k,
    datasetFingerprint,
    corpusFingerprint:corpusHash,
    retrievalConfigurationFingerprint:retrievalConfigHash,
    baselineConfigurationFingerprint,
    corpusMemoryIdDigests:[...new Set(corpus.map(row=>digestEvidence(row.id)))].sort(),
    train:trainBaseline.queryEvidence.map(row=>({
      exampleIdDigest:row.exampleIdDigest,queryDigest:row.queryDigest,language:row.language,split:row.split,
    })),
    holdout:baselineEval.queryEvidence.map((row,index)=>({
      exampleIdDigest:row.exampleIdDigest,
      queryDigest:row.queryDigest,
      language:row.language,
      split:row.split,
      answerable:row.answerable,
      relevantMemoryIdDigests:row.relevantMemoryIdDigests,
      baselineRankedMemory:row.rankedMemory,
      candidateRankedMemory:candidateEval.queryEvidence[index]?.rankedMemory??[],
    })),
  }:undefined;
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
  const reason=!seedInputValid?'invalid-bootstrap-seed':!corpusIntegrity.validForPromotion?'corpus-integrity-failed':!dataIntegrity.validForPromotion?'dataset-integrity-failed':!provenanceComplete?'dataset-provenance-incomplete':!enoughEvidence?'insufficient-labelled-holdout-or-corpus':!enoughUnanswerableEvidence?'insufficient-unanswerable-holdout':!quarantineSafe?'candidate-returned-quarantined-memory':!staleSafe?'candidate-returned-out-of-window-memory':!dormantSafe?'candidate-returned-dormant-memory':!epistemicStatusSafe?'candidate-returned-invalid-epistemic-status':!validRateSafe?'candidate-result-integrity-regression':!abstentionSafe?'unsupported-retrieval-rate-regression':!abstentionConfidenceNonInferioritySupported?'unsupported-retrieval-regression-not-confidence-bounded':recallDelta<minUplift?'recall-uplift-below-threshold':!confidenceSupported?'recall-uplift-not-confidence-supported':!mrrNonInferioritySupported?'mrr-regression-not-confidence-bounded':mrrDelta < -mrrTolerance?'mrr-regression-exceeds-tolerance':!languageStratifiedQualityEligible?languageStratificationReason:'holdout-gates-passed';
  return {
    schemaVersion:6 as const,benchmark:'memoryos2-retrieval-vs-bm25-baseline',retrievalAlgorithmVersion:RETRIEVAL_ALGORITHM_VERSION,mode:'offline-clone; no-live-state-mutation' as const,latencyDefinition:'p95 measures retrieval only; isolationSetupP95Ms is reported separately',
    now,k,corpusSize:corpus.length,trainQueries:train.length,holdoutQueries:holdout.length,datasetFingerprint,corpusFingerprint:corpusHash,retrievalConfigurationFingerprint:retrievalConfigHash,corpusIntegrity,
    datasetIntegrity:{...dataIntegrity,validForPromotion:dataIntegrity.validForPromotion&&provenanceComplete,provenanceComplete},
    experimentConfiguration:{seedInputValid,requestedSeed:seedWasProvided?(Number.isFinite(requestedSeed)?requestedSeed:String(options.seed)):'auto-derived',effectiveSeed:seed,candidateMetadataRecallEnabled:options.metadataRecallEnabled===true,maximumMrrRegression01:mrrTolerance,maximumUnsupportedRetrievalRegression01:unsupportedRetrievalTolerance},
    datasetProvenance:{...provenance,contentHashValid},
    baselineConfiguration,baselineConfigurationFingerprint,
    metrics:{baseline:baselineMetrics,candidate:candidateMetrics,train:{baseline:trainBaseline.metrics,candidate:trainCandidate.metrics}},
    deltas:{recallAtK01:Number(recallDelta.toFixed(4)),mrr01:Number(mrrDelta.toFixed(4))},confidence,
    languageStratification,
    ...(queryEvidence?{queryEvidence}:{}),
    promotion:{allowed:promotionAllowed,status:promotionAllowed?'candidate-eligible-for-separate-review':'not-promoted',reason,gates:promotionGates,minimumHoldoutQueries:minHoldout,minimumUnanswerableHoldoutQueries:minUnanswerableHoldout,minimumLanguageTrainQueries:minLanguageTrainQueries,minimumLanguageAnswerableHoldoutQueries:minLanguageAnswerableHoldoutQueries,minimumLanguageUnanswerableHoldoutQueries:minLanguageUnanswerableHoldoutQueries,requiredLanguages:['en','ru'],minimumRecallUplift01:minUplift,maximumMrrRegression01:mrrTolerance,maximumUnsupportedRetrievalRegression01:unsupportedRetrievalTolerance,mrrNonInferioritySupported,abstentionConfidenceNonInferioritySupported,mrrLowerBound01:confidence.mrr01.lowerBound01,requiresIndependentHumanOrCIReview:true},
    guardrails:{minimumUnanswerableHoldoutQueriesRequired:true,minimumLanguageStratifiedQualityRequired:true,bothEnglishAndRussianRequiredForPromotion:true,perLanguageConfidenceBoundsRequired:true,languageLabelsMustBeExplicit:true,liveMemoryMutated:false,identityOrPolicyChanged:false,labelsInferredFromPredictions:false,holdoutUsedForTraining:false,quarantinedMemoryMayPromote:false,staleEvidenceMayPromote:false,futureEvidenceMayPromote:false,dormantMemoryMayPromote:false,invalidEpistemicStatusMayPromote:false,corpusIntegrityBlocksPromotion:true,splitLeakageBlocksPromotion:true,unknownGroundTruthIdsBlockPromotion:true,unanswerableQueryLabelsRequired:true,unsupportedRetrievalRateMustNotRegress:true,provenanceRequiredForPromotion:true,invalidSeedMayPromote:false,mrrRegressionMustBeConfidenceBounded:true,unsupportedRetrievalRegressionMustBeConfidenceBounded:true,candidateModeExplicit:true,candidateModeAutoPromoted:false,bootstrapSeed:seed},
  };
}
