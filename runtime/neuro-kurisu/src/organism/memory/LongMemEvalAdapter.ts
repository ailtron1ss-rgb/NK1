import { createHash } from 'node:crypto';
import { MemoryOS2, type MemoryItem2 } from '../developmental/MemoryOS2.ts';

export const LONGMEMEVAL_DATASET_ID='xiaowu0162/longmemeval-cleaned';
export const DEFAULT_LONGMEMEVAL_REVISION='98d7416c24c778c2fee6e6f3006e7a073259d48f';
export const LONGMEMEVAL_LICENSE_ID='MIT';
const clamp=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const finiteOption=(value:unknown,fallback:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
const tokenSequence=(value:string)=>String(value).normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}|\p{N}/gu)??[];
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const stableValue=(value:unknown):unknown=>{
 if(Array.isArray(value))return value.map(stableValue);
 if(value&&typeof value==='object'){const row=value as Record<string,unknown>;return Object.fromEntries(Object.keys(row).sort().map(key=>[key,stableValue(row[key])]));}
 if(typeof value==='number'&&!Number.isFinite(value))return String(value);
 return value;
};
const timestamp=(value:unknown,label:string):number=>{
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'){
  const trimmed=value.trim();
  if(/^\d{10,13}$/u.test(trimmed))return trimmed.length===10?Number(trimmed)*1000:Number(trimmed);
  const parsed=Date.parse(trimmed);if(Number.isFinite(parsed))return parsed;
 }
 throw new Error('LongMemEval invalid timestamp: '+label);
};
type LongMemEvalTurn={role:string;content:string};
type LongMemEvalSession={id:string;at:number;content:string};
type LongMemEvalQuestion={id:string;type:string;query:string;at:number;sessions:LongMemEvalSession[];answerSessionIds:string[];answerable:boolean;independenceGroupId:string};
function normalizeQuestion(candidate:unknown,index:number):LongMemEvalQuestion{
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw new Error('LongMemEval row must be an object at index '+index);
 const row=candidate as Record<string,any>;
 const id=typeof row.question_id==='string'?row.question_id.trim():'';
 const query=typeof row.question==='string'?row.question.trim():'';
 const type=typeof row.question_type==='string'?row.question_type.trim().slice(0,80):'';
 if(!id||id.length>160)throw new Error('LongMemEval question_id is missing or oversized at index '+index);
 if(!query||query.length>5000)throw new Error('LongMemEval question is missing or oversized: '+id);
 if(!type)throw new Error('LongMemEval question_type is missing: '+id);
 const at=timestamp(row.question_date,'question_date:'+id);
 const ids=Array.isArray(row.haystack_session_ids)?row.haystack_session_ids:[];
 const dates=Array.isArray(row.haystack_dates)?row.haystack_dates:[];
 const histories=Array.isArray(row.haystack_sessions)?row.haystack_sessions:[];
 if(ids.length<1||ids.length>600||dates.length!==ids.length||histories.length!==ids.length)throw new Error('LongMemEval session arrays are missing or misaligned: '+id);
 const seen=new Set<string>();
 const sessions:LongMemEvalSession[]=ids.map((rawId:unknown,sessionIndex:number)=>{
  const sessionId=typeof rawId==='string'?rawId.trim():'';
  if(!sessionId||sessionId.length>160||seen.has(sessionId))throw new Error('LongMemEval session ID is blank, oversized or duplicated: '+id);
  seen.add(sessionId);
  const sessionAt=timestamp(dates[sessionIndex],'haystack_dates:'+id+':'+sessionIndex);
  const turns=histories[sessionIndex];
  if(!Array.isArray(turns)||turns.length<1||turns.length>256)throw new Error('LongMemEval session turns are invalid: '+id+':'+sessionId);
  const normalizedTurns:LongMemEvalTurn[]=turns.map((turn:unknown,turnIndex:number)=>{
   if(!turn||typeof turn!=='object'||Array.isArray(turn))throw new Error('LongMemEval turn is invalid: '+id+':'+sessionId+':'+turnIndex);
   const item=turn as Record<string,unknown>;
   const role=typeof item.role==='string'?item.role.trim().toLocaleLowerCase():'';
   const content=typeof item.content==='string'?item.content.trim():'';
   if(!role||!content||content.length>16000)throw new Error('LongMemEval turn role/content is invalid: '+id+':'+sessionId+':'+turnIndex);
   return {role:role.slice(0,32),content};
  });
  const content=normalizedTurns.map(turn=>turn.role+': '+turn.content).join('\n');
  if(content.length>32768)throw new Error('LongMemEval session exceeds the 32KiB NK1 memory record bound: '+id+':'+sessionId);
  return {id:sessionId,at:sessionAt,content};
 });
 const rawAnswerIds=Array.isArray(row.answer_session_ids)?row.answer_session_ids:[];
 const answerSessionIds=rawAnswerIds.map((value:unknown)=>typeof value==='string'?value.trim():'').filter(Boolean);
 if(answerSessionIds.length!==new Set(answerSessionIds).size)throw new Error('LongMemEval answer_session_ids contains duplicates: '+id);
 const sessionIds=new Set(sessions.map(session=>session.id));
 for(const answerId of answerSessionIds)if(!sessionIds.has(answerId))throw new Error('LongMemEval unknown answer session: '+id+':'+answerId);
 const abstention=id.toLocaleLowerCase().endsWith('_abs')||type.toLocaleLowerCase()==='abstention';
 if(abstention&&answerSessionIds.length>0)throw new Error('LongMemEval abstention question has answer sessions: '+id);
 if(!abstention&&answerSessionIds.length===0)throw new Error('LongMemEval answerable question has no answer sessions: '+id);
 return {id,type,query,at,sessions,answerSessionIds:[...new Set(answerSessionIds)].sort(),answerable:!abstention,independenceGroupId:''};
}
function normalizeRows(rows:unknown):LongMemEvalQuestion[]{
 if(!Array.isArray(rows)||rows.length<1||rows.length>1000)throw new Error('LongMemEval dataset must be an array with 1–1000 questions');
 const normalized=rows.map(normalizeQuestion);
 const ids=new Set<string>();
 for(const row of normalized){if(ids.has(row.id))throw new Error('LongMemEval duplicate question_id: '+row.id);ids.add(row.id);}
 const sorted=normalized.sort((a,b)=>a.id.localeCompare(b.id));
 // Questions sharing any source session are one statistical unit. This prevents
 // repeated sessions from inflating the effective independent sample count.
 const parent=new Map(sorted.map(row=>[row.id,row.id]));
 const find=(id:string):string=>{const root=parent.get(id)!;if(root===id)return id;const resolved=find(root);parent.set(id,resolved);return resolved;};
 const union=(left:string,right:string)=>{const a=find(left),b=find(right);if(a===b)return;const [first,second]=[a,b].sort();parent.set(second,first);};
 const ownerBySession=new Map<string,string>();
 for(const row of sorted)for(const session of row.sessions){const owner=ownerBySession.get(session.id);if(owner)union(row.id,owner);else ownerBySession.set(session.id,row.id);}
 const membersByRoot=new Map<string,string[]>();
 for(const row of sorted){const root=find(row.id);const members=membersByRoot.get(root)??[];members.push(row.id);membersByRoot.set(root,members);}
 const digestByRoot=new Map([...membersByRoot].map(([root,members])=>[root,digest([...members].sort().join('\\0'))]));
 return sorted.map(row=>({...row,independenceGroupId:digestByRoot.get(find(row.id))!}));
}
function fingerprintQuestions(questions:LongMemEvalQuestion[]){
 const hash=createHash('sha256');
 for(const question of questions)hash.update(JSON.stringify(stableValue(question))).update('\\n');
 return hash.digest('hex');
}
function buildQuestionMemory(question:LongMemEvalQuestion){
 const memory=new MemoryOS2({embeddingProvider:null,metadataRecallEnabled:false});
 const docs:{id:string;sessionId:string;at:number;content:string;tokens:string[];tf:Map<string,number>}[]=[];
 for(const session of question.sessions){
  const questionDigest=digest(question.id).slice(0,20),sessionDigest=digest(session.id).slice(0,20);
  const independenceKey='longmemeval:'+questionDigest+':'+sessionDigest;
  const memoryId='lme:'+digest(question.id+'\0'+session.id).slice(0,40);
  const context={conversationId:question.id,sessionId:session.id,sessionDate:String(session.at),dataset:LONGMEMEVAL_DATASET_ID};
  const evidenceSource={source:'LongMemEval cleaned benchmark',provenanceClass:'external' as const,sourceAuthority01:.8,independenceKey,observedAt:session.at,evidenceFreshnessAt:session.at};
  memory.encode({
   id:memoryId,content:session.content,kind:'episodic',source:'longmemeval-external-benchmark',
   tags:['benchmark','longmemeval'],context,salience:.55,emotionalWeight:0,identityRelevance:0,
   goalRelevance:0,socialRelevance:0,predictionError:0,confidence:.85,epistemicStatus:'fact',
   entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],contradictionLinks:[],
   validFromAt:session.at,validUntilAt:null,observedAt:session.at,provenanceClass:'external',
   sourceAuthority01:.8,independenceKey,evidenceSources:[evidenceSource],evidenceLineageKeys:[independenceKey],
  },{forceDistinct:true,clone:false});
  const tokens=tokenSequence(session.content),tf=new Map<string,number>();
  for(const token of tokens)tf.set(token,(tf.get(token)??0)+1);
  docs.push({id:memoryId,sessionId:session.id,at:session.at,content:session.content,tokens,tf});
 }
 return {memory,docs};
}
function bm25Rank(query:string,docs:ReturnType<typeof buildQuestionMemory>['docs'],at:number,k:number){
 const eligible=docs.filter(doc=>doc.at<=at);
 const queryTerms=new Set(tokenSequence(query));
 if(!eligible.length||!queryTerms.size)return [];
 const df=new Map<string,number>();let totalLength=0;
 for(const doc of eligible){totalLength+=Math.max(1,doc.tokens.length);for(const token of new Set(doc.tokens))df.set(token,(df.get(token)??0)+1);}
 const averageLength=Math.max(1,totalLength/eligible.length),k1=1.2,b=.75;
 return eligible.map(doc=>{
  let score=0;
  for(const token of queryTerms){
   const frequency=doc.tf.get(token)??0;if(!frequency)continue;
   const documentFrequency=df.get(token)??0;
   const idf=Math.log(1+(eligible.length-documentFrequency+.5)/(documentFrequency+.5));
   const denominator=frequency+k1*(1-b+b*Math.max(1,doc.tokens.length)/averageLength);
   score+=idf*(frequency*(k1+1))/Math.max(1e-12,denominator);
  }
  return {doc,score};
 }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.doc.id.localeCompare(b.doc.id)).slice(0,k).map(row=>row.doc.sessionId);
}
const p95=(values:number[])=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return Number(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]?.toFixed(3)??0);};
const mean=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
function scoreResults(retrieved:string[],question:LongMemEvalQuestion,k:number){
 const relevant=new Set(question.answerSessionIds);
 if(!question.answerable)return {recallAtK01:0,mrr01:0,precisionAtK01:0,retrievedCount:retrieved.length,unsupportedRetrieval:retrieved.length>0,correctAbstention:retrieved.length===0,falseAbstention:false};
 const relevantRanks=retrieved.map((id,index)=>relevant.has(id)?index+1:0).filter(rank=>rank>0);
 const relevantRetrieved=relevantRanks.length;
 return {recallAtK01:clamp(relevantRetrieved/relevant.size),mrr01:relevantRanks.length?1/Math.min(...relevantRanks):0,precisionAtK01:clamp(relevantRetrieved/Math.max(1,k)),retrievedCount:retrieved.length,unsupportedRetrieval:false,correctAbstention:false,falseAbstention:relevantRetrieved===0};
}
function aggregate(outcomes:Array<{answerable:boolean;recallAtK01:number;mrr01:number;precisionAtK01:number;unsupportedRetrieval:boolean;correctAbstention:boolean;falseAbstention:boolean;retrievedCount:number;latencyMs:number}>){
 const answerable=outcomes.filter(row=>row.answerable),unanswerable=outcomes.filter(row=>!row.answerable);
 return {
  queries:outcomes.length,answerableQueries:answerable.length,unanswerableQueries:unanswerable.length,
  recallAtK01:clamp(mean(answerable.map(row=>row.recallAtK01))),
  mrr01:clamp(mean(answerable.map(row=>row.mrr01))),
  precisionAtK01:clamp(mean(answerable.map(row=>row.precisionAtK01))),
  unsupportedRetrievalCount:unanswerable.filter(row=>row.unsupportedRetrieval).length,
  unsupportedRetrievalRate01:clamp(mean(unanswerable.map(row=>row.unsupportedRetrieval?1:0))),
  correctAbstentionRate01:clamp(mean(unanswerable.map(row=>row.correctAbstention?1:0))),
  falseAbstentionCount:answerable.filter(row=>row.falseAbstention).length,
  falseAbstentionRate01:clamp(mean(answerable.map(row=>row.falseAbstention?1:0))),
  queryCoverage01:clamp(mean(outcomes.map(row=>row.retrievedCount>0?1:0))),
  latencyP95Ms:p95(outcomes.map(row=>row.latencyMs)),
 };
}
function mulberry32(seed:number){let value=seed>>>0;return ()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const quantile=(values:number[],p:number)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1))]??0;};
function pairedBootstrap(rows:Array<{answerable:boolean;groupId:string;baselineRecall:number;candidateRecall:number;baselineMrr:number;candidateMrr:number;baselineUnsupported:boolean;candidateUnsupported:boolean}>,seeds:number[],samples:number){
 const answerable=rows.filter(row=>row.answerable),unanswerable=rows.filter(row=>!row.answerable);
 const groupMeans=(source:typeof rows,select:(row:typeof rows[number])=>number)=>{
  const groups=new Map<string,number[]>();for(const row of source){const values=groups.get(row.groupId)??[];values.push(select(row));groups.set(row.groupId,values);}
  return [...groups.values()].map(mean);
 };
 const recallGroups=groupMeans(answerable,row=>row.candidateRecall-row.baselineRecall);
 const mrrGroups=groupMeans(answerable,row=>row.candidateMrr-row.baselineMrr);
 const unsupportedGroups=groupMeans(unanswerable,row=>(row.candidateUnsupported?1:0)-(row.baselineUnsupported?1:0));
 const runs=seeds.map(seed=>{
  const rng=mulberry32(seed),recall:number[]=[],mrr:number[]=[],unsupported:number[]=[];
  for(let sample=0;sample<samples;sample++){
   const sampleMean=(source:Array<any>,select:(row:any)=>number)=>{
    if(!source.length)return 0;let total=0;for(let i=0;i<source.length;i++)total+=select(source[Math.floor(rng()*source.length)]);return total/source.length;
   };
   recall.push(sampleMean(recallGroups,value=>value));
   mrr.push(sampleMean(mrrGroups,value=>value));
   unsupported.push(sampleMean(unsupportedGroups,value=>value));
  }
  return {
   seed,
   recallDelta01:mean(recallGroups),
   recallDeltaCi95:{lower01:Number(quantile(recall,.025).toFixed(6)),upper01:Number(quantile(recall,.975).toFixed(6))},
   mrrDelta01:mean(mrrGroups),
   mrrDeltaCi95:{lower01:Number(quantile(mrr,.025).toFixed(6)),upper01:Number(quantile(mrr,.975).toFixed(6))},
   unsupportedRetrievalDelta01:mean(unsupportedGroups),
   unsupportedRetrievalDeltaCi95:{lower01:Number(quantile(unsupported,.025).toFixed(6)),upper01:Number(quantile(unsupported,.975).toFixed(6))},
  };
 });
 return {
  seedCount:runs.length,runs,pairedBootstrapSamples:samples,independentGroupCount:new Set(rows.map(row=>row.groupId)).size,answerableIndependentGroups:recallGroups.length,unanswerableIndependentGroups:unsupportedGroups.length,grouping:'connected-components-of-shared-session-ids',
  recallUpliftSupportedAcrossAllSeeds:runs.length>0&&runs.every(row=>row.recallDeltaCi95.lower01>=.02),
  mrrNonInferioritySupportedAcrossAllSeeds:runs.length>0&&runs.every(row=>row.mrrDeltaCi95.lower01>=-.01),
  unsupportedRetrievalNonInferioritySupportedAcrossAllSeeds:runs.length>0&&runs.every(row=>row.unsupportedRetrievalDeltaCi95.upper01<=0),
 };
}

export interface LongMemEvalMemoryBenchmarkOptions {
 datasetRevision:string;
 datasetFileSha256:string;
 k?:number;
 bootstrapSamples?:number;
 seeds?:number[];
 minAnswerableQueries?:number;
 minUnanswerableQueries?:number;
 minIndependentGroups?:number;
}
export function runLongMemEvalMemoryBenchmark(rawRows:unknown,options:LongMemEvalMemoryBenchmarkOptions){
 const revision=String(options.datasetRevision??'').toLowerCase();
 const fileSha=String(options.datasetFileSha256??'').toLowerCase();
 if(!/^[a-f0-9]{40}$/u.test(revision))throw new Error('LongMemEval datasetRevision must be a pinned 40-character commit SHA');
 if(!/^[a-f0-9]{64}$/u.test(fileSha))throw new Error('LongMemEval datasetFileSha256 must be a SHA-256 digest');
 const questions=normalizeRows(rawRows);
 const datasetFingerprint=fingerprintQuestions(questions);
 const answerableCount=questions.filter(row=>row.answerable).length,unanswerableCount=questions.length-answerableCount;
 const k=Math.floor(finiteOption(options.k,5,1,10));
 const bootstrapSamples=Math.floor(finiteOption(options.bootstrapSamples,2000,200,5000));
 const seeds=[...new Set((options.seeds??[13,29,53,71,101]).map(Number).filter(seed=>Number.isSafeInteger(seed)&&seed>0&&seed<=0xffffffff))];
 if(seeds.length<3)throw new Error('LongMemEval paired bootstrap requires at least three distinct valid seeds');
 const perQuestion:any[]=[],baselineOutcomes:any[]=[],candidateOutcomes:any[]=[],paired:any[]=[];
 let sessionCount=0;
 for(const question of questions){
  const {memory,docs}=buildQuestionMemory(question);sessionCount+=docs.length;
  const baselineStart=performance.now();
  const baselineIds=bm25Rank(question.query,docs,question.at,k);
  const baselineLatency=Math.max(0,performance.now()-baselineStart);
  const candidateStart=performance.now();
  const candidateItems=memory.previewRetrieve(question.query,k,0,0,{temporalMode:'at',asOfAt:question.at}) as MemoryItem2[];
  const candidateLatency=Math.max(0,performance.now()-candidateStart);
  const candidateIds=candidateItems.map(item=>String(item.context?.sessionId??'')).filter(Boolean);
  const baselineScore=scoreResults(baselineIds,question,k),candidateScore=scoreResults(candidateIds,question,k);
  baselineOutcomes.push({...baselineScore,answerable:question.answerable,latencyMs:baselineLatency});
  candidateOutcomes.push({...candidateScore,answerable:question.answerable,latencyMs:candidateLatency});
  paired.push({answerable:question.answerable,groupId:question.independenceGroupId,baselineRecall:baselineScore.recallAtK01,candidateRecall:candidateScore.recallAtK01,baselineMrr:baselineScore.mrr01,candidateMrr:candidateScore.mrr01,baselineUnsupported:baselineScore.unsupportedRetrieval,candidateUnsupported:candidateScore.unsupportedRetrieval});
  const fingerprintSalt=revision+'\0'+fileSha;
  perQuestion.push({
   questionIdDigest:digest(fingerprintSalt+'\0question\0'+question.id),
   queryDigest:digest(fingerprintSalt+'\0query\0'+question.query),
   questionType:question.type,answerable:question.answerable,independenceGroupDigest:digest(fingerprintSalt+'\\0group\\0'+question.independenceGroupId),relevantSessionCount:question.answerSessionIds.length,
   baseline:{recallAtK01:baselineScore.recallAtK01,mrr01:baselineScore.mrr01,precisionAtK01:baselineScore.precisionAtK01,retrievedCount:baselineScore.retrievedCount,unsupportedRetrieval:baselineScore.unsupportedRetrieval,rankedSessionDigests:baselineIds.map(id=>digest(fingerprintSalt+'\0session\0'+id))},
   candidate:{recallAtK01:candidateScore.recallAtK01,mrr01:candidateScore.mrr01,precisionAtK01:candidateScore.precisionAtK01,retrievedCount:candidateScore.retrievedCount,unsupportedRetrieval:candidateScore.unsupportedRetrieval,rankedSessionDigests:candidateIds.map(id=>digest(fingerprintSalt+'\0session\0'+id))},
  });
 }
 const datasetFingerprint=digest(JSON.stringify(stableValue(questions)));
 const baseline=aggregate(baselineOutcomes),candidate=aggregate(candidateOutcomes);
 const confidence=pairedBootstrap(paired,seeds,bootstrapSamples);
 const minAnswerable=Math.floor(finiteOption(options.minAnswerableQueries,20,1,500));
 const minUnanswerable=Math.floor(finiteOption(options.minUnanswerableQueries,8,1,500));
 const minIndependentGroups=Math.floor(finiteOption(options.minIndependentGroups,20,1,500));
 return {
  schemaVersion:1,evaluation:'longmemeval-s-memory-retrieval',generatedAt:new Date().toISOString(),
  mode:'offline-only; per-question isolated corpus; no-live-memory-mutation; no-auto-promotion',
  sourceDataset:{
   datasetId:LONGMEMEVAL_DATASET_ID,datasetRevision:revision,
   sourceRef:`https://huggingface.co/datasets/${LONGMEMEVAL_DATASET_ID}/tree/${revision}`,
   licenseId:LONGMEMEVAL_LICENSE_ID,languages:['en'],questionCount:questions.length,sessionCount,
   fileSha256:fileSha,datasetFingerprint,
  },
  experiment:{candidateMode:'canonical-memoryos2',baseline:'Okapi BM25 per question corpus',k,bootstrapSamples,seeds},
  sampleAdequacy:{answerableQueries:answerableCount,unanswerableQueries:unanswerableCount,independentGroups:confidence.independentGroupCount,minimumAnswerableQueries:minAnswerable,minimumUnanswerableQueries:minUnanswerable,minimumIndependentGroups:minIndependentGroups,enoughAnswerableQueries:answerableCount>=minAnswerable,enoughUnanswerableQueries:unanswerableCount>=minUnanswerable,enoughIndependentGroups:confidence.independentGroupCount>=minIndependentGroups},
  metrics:{baseline,candidate,deltas:{
   recallAtK01:Number((candidate.recallAtK01-baseline.recallAtK01).toFixed(6)),
   mrr01:Number((candidate.mrr01-baseline.mrr01).toFixed(6)),
   precisionAtK01:Number((candidate.precisionAtK01-baseline.precisionAtK01).toFixed(6)),
   unsupportedRetrievalRate01:Number((candidate.unsupportedRetrievalRate01-baseline.unsupportedRetrievalRate01).toFixed(6)),
   correctAbstentionRate01:Number((candidate.correctAbstentionRate01-baseline.correctAbstentionRate01).toFixed(6)),
   falseAbstentionRate01:Number((candidate.falseAbstentionRate01-baseline.falseAbstentionRate01).toFixed(6)),
  }},
  confidence,
  guardrails:{sameQuestionCorpusForBaselineAndCandidate:true,crossQuestionRetrievalLeakage:false,rawQueriesIncluded:false,rawSessionContentIncluded:false,liveMemoryMutation:false,bilingualPromotionEligible:false,promotionRequiresIndependentReview:true,candidateModeAutoPromoted:false},
  promotion:{allowed:false,status:'requires-independent-bilingual-review',reason:'LongMemEval is English-only and cannot satisfy NK1’s RU/EN independent holdout contract. This benchmark is diagnostic evidence only; no automatic promotion is permitted.'},
  perQuestion,
 };
}
