import { createHash } from 'node:crypto';
import { stableJson as serializeStableJson } from '../../core/StableSerialization.ts';
import type { IntentCandidate, OrganismNeeds } from '../../core/types.ts';
import { DeterministicHnswIndex } from './WillHnswIndex.ts';

export const WILL_INTEGRATION_SCHEMA = 1 as const;
export const WILL_SOURCE_VERSION = '0.10.0';

const clamp = (v:number,min=0,max=1) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
const stableJson = (value:unknown):string => serializeStableJson(value);
const sha256 = (value:unknown):string => createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
const hashString = (value:string):number => {
  let h = 2166136261 >>> 0;
  for (let i=0;i<value.length;i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
};

export interface WillVectorRecord { id:string; vector:number[]; textHash:string; createdAt:number; }
export interface WillVectorState { version:1; dimension:number; seed:number; engine?:'deterministic-hnsw'; m?:number; efSearch?:number; entryId?:string|null; promoted?:boolean; benchmark?:unknown; records:WillVectorRecord[]; queryCount:number; hitCount:number; }
export interface WillContextBudgetEntry { tick:number; source:string; estimatedTokens:number; retainedTokens:number; droppedTokens:number; reason:string; at:number; }
export interface WillTransportEnvelope { id:string; type:string; source:string; createdAt:number; tickHint?:number; correlationId?:string; payload:unknown; payloadHash:string; envelopeHash:string; }
export interface WillAck { envelopeId:string; accepted:boolean; at:number; reason?:string; }
export interface WillTransportSeenEnvelope { id:string; requestHash:string; createdAt:number; }
export interface WillTransportState { version:1; queue:WillTransportEnvelope[]; pending:WillTransportEnvelope[]; acked:string[]; acks:WillAck[]; replay:WillTransportEnvelope[]; inboundCount:number; dedupedAcks:number; seenEnvelopes:WillTransportSeenEnvelope[]; idempotencyConflicts:number; rejectedAcks:number; ackConflicts:number; rejectedEnvelopes:number; queueBackpressure:number; }
export type WillTransportErrorCode = 'transport-envelope-invalid'|'transport-envelope-id-conflict'|'transport-envelope-history-unknown'|'transport-queue-full';
export class WillTransportError extends Error {
  readonly code:WillTransportErrorCode;
  constructor(code:WillTransportErrorCode, message:string=code){ super(message); this.name='WillTransportError'; this.code=code; }
}
export type WillAckResult =
  | { ok:true; envelopeId:string; accepted:boolean; reused:boolean; outcomeKnown:boolean }
  | { ok:false; error:'transport-ack-invalid'|'transport-envelope-not-found'|'transport-ack-conflict'; envelopeId?:string; priorAccepted?:boolean };
export interface WillRecordAnchor { seq:number; at:number; type:string; payloadDigest:string; digest:string; previousDigest:string; }
export interface WillDossier { handle:string; aliases:string[]; kind:string; familiarity01:number; valence01:number; reliability01:number; encounterCount:number; lastAt:number; suspectedSameAs:string[]; trust01:number; attachment01:number; reputation01:number; }
export interface WillConversationAim { id:string; target:string; openedAt:number; completionCondition:string; expectedReplyType:string; open:boolean; lastAt:number; }
export interface WillCompetenceArtifact { id:string; action:string; uses:number; successes:number; /** Fractional effective count of independently verified outcome evidence. */ verifiedUses?:number; successRate01:number; confidence01:number; cost01:number; updatedAt:number; }

export interface WillIntegrationState {
  version:1;
  source:{ package:string; version:string; integratedAt:string; mode:'canonical-adapter'; };
  counters:{ decisionCycles:number; outcomeObservations:number; pmaExports:number; pmaValidations:number; fidelityChecks:number; envelopes:number; indexedVectors:number; contextCuts:number; policyDenials:number; duplicateEntityMerges:number; };
  agency:{ weights:Record<string,number>; lastEntropy01:number; lastWinner:string|null; lastScores:Array<{action:string;base01:number;will01:number;delta01:number}>; selectedSince:number; settledAction:string|null; justEnactedAction:string|null; };
  policy:{ denied:number; escalated:number; available:number; unavailable:number; lastVerdict:string|null; };
  context:{ budgetTokens:number; entries:WillContextBudgetEntry[]; lastCutReason:string|null; };
  social:{ dossiers:WillDossier[]; conversations:WillConversationAim[]; aliases:Record<string,string>; };
  competence:{ artifacts:WillCompetenceArtifact[]; };
  pma:{ lastFingerprint:string|null; lastSchema:number; lastValidated:boolean; lastFidelity01:number; };
  llm:{ completions:number; failures:number; lastProvider:string|null; lastModel:string|null; lastLatencyMs:number; };
  transport:WillTransportState;
  vector:WillVectorState;
  recordChain:{ version:1; head:string; nextSeq:number; baseSeq:number; baseDigest:string; anchors:WillRecordAnchor[]; };
}

const DEFAULT_WEIGHTS:Record<string,number> = {
  goal:.30, reward:.25, novelty:.10, drive:.25, habit:.20, plan:.30, will:.30, social:.30,
  cost:.20, inhibition:.30, risk:.20, repeat:.30, settled:.30,
};

function defaultState():WillIntegrationState {
  return {
    version:1,
    source:{package:'@mindot/will',version:WILL_SOURCE_VERSION,integratedAt:'2026-10-08',mode:'canonical-adapter'},
    counters:{decisionCycles:0,outcomeObservations:0,pmaExports:0,pmaValidations:0,fidelityChecks:0,envelopes:0,indexedVectors:0,contextCuts:0,policyDenials:0,duplicateEntityMerges:0},
    agency:{weights:{...DEFAULT_WEIGHTS},lastEntropy01:0,lastWinner:null,lastScores:[],selectedSince:0,settledAction:null,justEnactedAction:null},
    policy:{denied:0,escalated:0,available:0,unavailable:0,lastVerdict:null},
    context:{budgetTokens:0,entries:[],lastCutReason:null},
    social:{dossiers:[],conversations:[],aliases:{}},
    competence:{artifacts:[]},
    pma:{lastFingerprint:null,lastSchema:0,lastValidated:false,lastFidelity01:0},
    llm:{completions:0,failures:0,lastProvider:null,lastModel:null,lastLatencyMs:0},
    transport:{version:1,queue:[],pending:[],acked:[],acks:[],replay:[],inboundCount:0,dedupedAcks:0,seenEnvelopes:[],idempotencyConflicts:0,rejectedAcks:0,ackConflicts:0,rejectedEnvelopes:0,queueBackpressure:0},
    vector:{version:1,engine:'deterministic-hnsw',dimension:32,seed:42,m:8,efSearch:32,entryId:null,promoted:false,benchmark:null,records:[],queryCount:0,hitCount:0},
    recordChain:{version:1,head:'',nextSeq:0,baseSeq:-1,baseDigest:'',anchors:[]},
  };
}

function seededVector(text:string,dimension:number,seed=42):number[]{
  const v=new Array(dimension).fill(0); const normalized=text.normalize('NFKC').toLowerCase();
  for(let i=0;i<normalized.length;i++){
    const h=hashString(`${seed}:${normalized[i]}:${i%7}`); const idx=h%dimension; const sign=(h&1)?1:-1; v[idx]+=sign*(.5+((h>>>8)&255)/255);
  }
  const words=normalized.split(/\s+/).filter(Boolean);
  for(let i=0;i<words.length;i++){
    const h=hashString(`${seed}:w:${words[i]}`); const idx=h%dimension; v[idx]+=1.5+((h>>>9)&127)/127;
  }
  const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1; return v.map(x=>x/n);
}

export interface WillAgencyContext {
  needs:OrganismNeeds;
  goalRelevance01?:number;
  driveUrgency01?:number;
  planBias01?:number;
  willBias01?:number;
  socialPrior01?:number;
  inhibition01?:number;
  risk01?:number;
  settledAction?:string|null;
  justEnactedAction?:string|null;
  policyAvailable?:boolean;
}

export class WillIntegrationBridge {
  private state:WillIntegrationState = defaultState();
  private readonly vectors = new DeterministicHnswIndex({dimension:32,seed:42,m:8,efSearch:32});

  snapshot():WillIntegrationState { return structuredClone(this.state); }
  restore(input?:Partial<WillIntegrationState>){
    if(!input){ this.state=defaultState(); this.vectors.restore(this.state.vector); return; }
    this.state={...defaultState(),...input,
      counters:{...defaultState().counters,...(input.counters??{})},
      agency:{...defaultState().agency,...(input.agency??{}),weights:{...DEFAULT_WEIGHTS,...(input.agency?.weights??{})}},
      policy:{...defaultState().policy,...(input.policy??{})},
      context:{...defaultState().context,...(input.context??{}),entries:(input.context?.entries??[]).slice(-128)},
      social:{...defaultState().social,...(input.social??{}),dossiers:(input.social?.dossiers??[]).slice(-256),conversations:(input.social?.conversations??[]).slice(-128)},
      competence:{...defaultState().competence, artifacts:(input.competence?.artifacts??[]).slice(-256).map((raw:any)=>{
        const uses=Math.max(0,Number.isFinite(Number(raw?.uses))?Number(raw.uses):0);
        const hasVerifiedLedger=Number.isFinite(Number(raw?.verifiedUses))&&Number(raw.verifiedUses)>=0;
        // Older snapshots counted unverified success as competence. There is no safe way
        // to reconstruct verification retroactively, so start those skills at neutral confidence.
        const verifiedUses=hasVerifiedLedger?Math.max(0,Number(raw.verifiedUses)):0;
        const successes=hasVerifiedLedger?clamp(Number(raw?.successes),0,verifiedUses):0;
        return {...raw,uses,verifiedUses,successes,successRate01:verifiedUses>0?clamp(successes/verifiedUses):0,confidence01:hasVerifiedLedger?clamp(Number(raw?.confidence01??.5)):.5};
      })},
      pma:{...defaultState().pma,...(input.pma??{})},
      llm:{...defaultState().llm,...(input.llm??{})},
      transport:{...defaultState().transport,...(input.transport??{}),queue:(input.transport?.queue??[]).slice(-256),pending:(input.transport?.pending??[]).slice(-256),acked:(input.transport?.acked??[]).slice(-1024),acks:(input.transport?.acks??[]).slice(-512),replay:(input.transport?.replay??[]).slice(-512),seenEnvelopes:(input.transport?.seenEnvelopes??[]).slice(-4096)},
      vector:{...defaultState().vector,...(input.vector??{}),records:(input.vector?.records??[]).slice(-512)},
      recordChain:{...defaultState().recordChain,...(input.recordChain??{}),anchors:(input.recordChain?.anchors??[]).slice(-512)},
    };
    // Backfill the bounded idempotency index from snapshots written before this contract existed.
    for (const env of [...this.state.transport.queue, ...this.state.transport.pending, ...this.state.transport.replay]) {
      if (!env || typeof env.id !== 'string' || this.state.transport.seenEnvelopes.some(x => x.id === env.id)) continue;
      this.state.transport.seenEnvelopes.push({ id:env.id, requestHash:this.transportRequestHash(env), createdAt:Number.isFinite(env.createdAt) ? env.createdAt : 0 });
    }
    this.state.transport.seenEnvelopes = this.state.transport.seenEnvelopes.slice(-4096);
    this.vectors.restore(this.state.vector);
  }

  private anchor(type:string,payload:unknown,at=this.state.recordChain.nextSeq){
    const previousDigest=this.state.recordChain.head;
    const payloadDigest=sha256(payload);
    const digest=sha256({seq:this.state.recordChain.nextSeq,type,payloadDigest,previousDigest});
    this.state.recordChain.anchors.push({seq:this.state.recordChain.nextSeq,at,type,payloadDigest,digest,previousDigest});
    if(this.state.recordChain.anchors.length>512){
      const firstRetained=this.state.recordChain.anchors[this.state.recordChain.anchors.length-512]!;
      this.state.recordChain.baseSeq=firstRetained.seq-1;
      this.state.recordChain.baseDigest=firstRetained.previousDigest;
      this.state.recordChain.anchors=this.state.recordChain.anchors.slice(-512);
    }
    this.state.recordChain.nextSeq++;
    this.state.recordChain.head=digest;
    return digest;
  }

  rankCandidates(candidates:IntentCandidate[],context:WillAgencyContext):IntentCandidate[]{
    const w=this.state.agency.weights;
    const needs=context.needs;
    const goalRel=clamp(context.goalRelevance01 ?? needs.goalPressure);
    const drive=clamp(context.driveUrgency01 ?? ((1-needs.energy)*.55 + needs.goalPressure*.45));
    const plan=clamp(context.planBias01 ?? 0);
    const will=clamp(context.willBias01 ?? 0);
    const social=clamp(context.socialPrior01 ?? needs.socialNeed);
    const inhibition=clamp(context.inhibition01 ?? needs.cognitiveLoad*.35);
    const risk=clamp(context.risk01 ?? needs.uncertainty*.35);
    // Apply a strictly bounded score delta in-place before the canonical arbiter.
    // Keep the unmodified values so diagnostics describe the actual contribution rather
    // than accidentally recording the post-adjustment score as the baseline.
    const rows=candidates.map(c=>{
      const baseScore=clamp(c.score);
      const baseUtility=clamp(c.predictedUtility);
      const baseConfidence=clamp(c.confidence);
      const habit=clamp(this.skillArtifact(c.action)?.confidence01 ?? (baseConfidence*.72));
      const novelty=1-habit;
      const reward=baseUtility;
      const cost=clamp(c.predictedCost);
      const just=context.justEnactedAction===c.action ? 1 : 0;
      const settled=context.settledAction===c.action ? 1 : 0;
      const activation=w.goal*goalRel+w.reward*reward+w.novelty*novelty+w.drive*drive+w.habit*habit+w.plan*plan+w.will*will+w.social*social-w.cost*cost-w.inhibition*inhibition-w.risk*risk-w.repeat*just+w.settled*settled;
      return {c,activation,baseScore,baseUtility,baseConfidence,delta01:0,will01:0};
    });
    const activations=rows.map(x=>x.activation); const max=Math.max(...activations,0); const ex=activations.map(a=>Math.exp(a-max)); const sum=ex.reduce((s,x)=>s+x,0)||1;
    let entropy=0; ex.forEach(e=>{const p=e/sum; if(p>0) entropy-=p*Math.log(p);}); entropy=clamp(entropy/Math.log(Math.max(2,rows.length)));
    for(const row of rows){
      row.will01=1/(1+Math.exp(-row.activation));
      row.delta01=(row.will01-.5)*.08; // absolute contribution is capped at +/- 0.04
      row.c.score=clamp(row.baseScore+row.delta01);
      row.c.predictedUtility=clamp(row.baseUtility+row.delta01*.65);
      row.c.confidence=clamp(row.baseConfidence*.95+row.will01*.05);
      row.delta01=row.c.score-row.baseScore;
    }
    rows.sort((a,b)=>b.activation-a.activation || a.c.action.localeCompare(b.c.action));
    this.state.agency.lastEntropy01=entropy; this.state.agency.lastWinner=rows[0]?.c.action??null;
    this.state.agency.lastScores=rows.slice(0,12).map(({c,baseScore,will01,delta01})=>({action:c.action,base01:baseScore,will01,delta01}));
    this.state.counters.decisionCycles++; this.anchor('agency-decision',{entropy01:entropy,winner:this.state.agency.lastWinner,scores:this.state.agency.lastScores});
    // Candidate order is intentionally preserved for stable IDs and policy traceability.
    // Their scores now carry the bounded signal for the next, canonical policy/arbitration step.
    return candidates;
  }

  observeDecision(input:{tick:number;action:string;policyAvailable:boolean;context?:string;at?:number}){
    const at=input.at??Date.now(); this.state.agency.settledAction=input.action; this.state.agency.justEnactedAction=input.action; this.state.agency.selectedSince=at;
    if(input.policyAvailable) this.state.policy.available++; else { this.state.policy.unavailable++; this.state.policy.denied++; this.state.counters.policyDenials++; }
    this.state.policy.lastVerdict=input.policyAvailable?'ALLOW':'DENY';
    this.anchor('decision-commit',{tick:input.tick,action:input.action,policyAvailable:input.policyAvailable,context:input.context??''},at);
  }

  observeOutcome(input:{tick:number;action:string;success01:number;verified01?:number;surprise01?:number;reason?:string;at?:number}){
    const at=input.at??Date.now(); const verified=clamp(input.verified01??0); const success=clamp(input.success01); const surprise=clamp(input.surprise01??Math.abs(.5-success));
    this.state.counters.outcomeObservations++;
    const prev=this.state.competence.artifacts.find(a=>a.action===input.action);
    const uses=(prev?.uses??0)+1;
    const prevVerifiedUses=Math.max(0,Number(prev?.verifiedUses??0));
    const evidenceWeight=verified>=.5?verified:0;
    const verifiedUses=prevVerifiedUses+evidenceWeight;
    // Only verified outcome evidence can change skill success-rate/confidence. An observed
    // but unverified success is recorded as an observation, never as learned competence.
    const successes=(prev?.successes??0)+success*evidenceWeight;
    const priorConfidence=clamp(prev?.confidence01??.5);
    const confidence01=evidenceWeight>0?clamp(priorConfidence*.75 + success*.25*evidenceWeight + .08*evidenceWeight):priorConfidence;
    const artifact:WillCompetenceArtifact={id:`will-skill:${hashString(input.action).toString(16)}`,action:input.action,uses,verifiedUses,successes,successRate01:verifiedUses>0?clamp(successes/verifiedUses):0,confidence01,cost01:clamp(.25+surprise*.5),updatedAt:at};
    this.state.competence.artifacts=[...this.state.competence.artifacts.filter(a=>a.action!==input.action),artifact].slice(-256);
    this.anchor('outcome',{tick:input.tick,action:input.action,success01:success,verified01:verified,evidenceWeight,successCredited01:success*evidenceWeight,surprise01:surprise,reason:input.reason??''},at);
  }

  recordContextCut(input:{tick:number;source:string;budgetTokens:number;retainedTokens:number;droppedTokens:number;reason:string;at?:number}){
    const entry:WillContextBudgetEntry={...input,estimatedTokens:input.retainedTokens+input.droppedTokens,at:input.at??Date.now()}; this.state.context.budgetTokens=Math.max(0,Math.floor(input.budgetTokens)); this.state.context.entries=[...this.state.context.entries,entry].slice(-128); this.state.context.lastCutReason=input.reason; this.state.counters.contextCuts++;
    this.anchor('context-cut',entry,entry.at);
  }

  upsertDossier(input:{handle:string;alias?:string;kind?:string;valence01?:number;reliability01?:number;trust01?:number;attachment01?:number;reputation01?:number;at?:number}){
    const at=input.at??Date.now(); const handle=input.handle.trim().toLowerCase() || 'unknown'; const alias=input.alias?.trim(); const existing=this.state.social.dossiers.find(d=>d.handle===handle);
    if(existing){ existing.encounterCount++; existing.lastAt=at; existing.familiarity01=clamp(existing.familiarity01*.9+.1); existing.valence01=clamp(existing.valence01*.8+clamp(input.valence01??existing.valence01)*.2); existing.reliability01=clamp(existing.reliability01*.85+clamp(input.reliability01??existing.reliability01)*.15); existing.trust01=clamp(existing.trust01*.88+clamp(input.trust01??existing.trust01)*.12); existing.attachment01=clamp(existing.attachment01*.92+clamp(input.attachment01??existing.attachment01)*.08); existing.reputation01=clamp(existing.reputation01*.85+clamp(input.reputation01??existing.reputation01)*.15); if(alias&&!existing.aliases.includes(alias)) existing.aliases.push(alias); }
    else this.state.social.dossiers.push({handle,aliases:alias?[alias]:[],kind:input.kind??'entity',familiarity01:.1,valence01:clamp(input.valence01??.5),reliability01:clamp(input.reliability01??.5),encounterCount:1,lastAt:at,suspectedSameAs:[],trust01:clamp(input.trust01??.5),attachment01:clamp(input.attachment01??.1),reputation01:clamp(input.reputation01??.5)});
    if(alias) this.state.social.aliases[alias.toLowerCase()]=handle;
    this.anchor('known-entity',{handle,alias:alias??null},at);
    return this.state.social.dossiers.find(d=>d.handle===handle)!;
  }

  openConversation(input:{id:string;target:string;completionCondition:string;expectedReplyType:string;at?:number}){
    const at=input.at??Date.now(); this.state.social.conversations=[...this.state.social.conversations.filter(c=>c.id!==input.id),{...input,openedAt:at,open:true,lastAt:at}].slice(-128); this.anchor('conversation-open',input,at);
  }
  closeConversation(id:string,at=Date.now()){ const c=this.state.social.conversations.find(x=>x.id===id); if(c){c.open=false;c.lastAt=at;this.anchor('conversation-close',{id},at);} }

  indexText(id:string,text:string,at=Date.now()){
    if(!text.trim()) return; const vector=seededVector(text,this.state.vector.dimension,this.state.vector.seed); const record={id,vector,textHash:sha256(text),createdAt:at}; this.vectors.upsert(record); const snapshot=this.vectors.snapshot(); this.state.vector.records=snapshot.records.slice(-512); this.state.vector.engine='deterministic-hnsw'; this.state.vector.m=snapshot.m; this.state.vector.efSearch=snapshot.efSearch; this.state.vector.entryId=snapshot.entryId; this.state.counters.indexedVectors++;
    this.anchor('vector-index',{id,textHash:record.textHash},at);
  }
  searchText(text:string,k=5){ const results=this.vectors.search(seededVector(text,this.state.vector.dimension,this.state.vector.seed),k); this.state.vector.queryCount++; this.state.vector.hitCount += results.length; return results; }
  benchmarkVectorIndex(queries:string[]=[],k=5,efSearch=this.state.vector.efSearch??32){
    const samples=queries.length?queries.slice(0,64):this.state.vector.records.slice(0,16).map(r=>r.id);
    const vectors=samples.map(text=>text.includes(' ') ? seededVector(text,this.state.vector.dimension,this.state.vector.seed) : this.state.vector.records.find(r=>r.id===text)?.vector).filter((v):v is number[]=>Array.isArray(v));
    const result=this.vectors.benchmark(vectors,k,efSearch); this.state.vector.benchmark=result; this.state.vector.promoted=result.promoted; this.anchor('vector-benchmark',result); return result;
  }
  verifyRecordChain(){
    let previous=this.state.recordChain.baseDigest||''; let lastSeq=this.state.recordChain.baseSeq??-1;
    for(const anchor of this.state.recordChain.anchors){ if(anchor.previousDigest!==previous) return {ok:false,reason:'previous-digest-mismatch',seq:anchor.seq}; if(anchor.seq<=lastSeq) return {ok:false,reason:'sequence-regression',seq:anchor.seq}; const expected=sha256({seq:anchor.seq,type:anchor.type,payloadDigest:anchor.payloadDigest,previousDigest:anchor.previousDigest}); if(expected!==anchor.digest) return {ok:false,reason:'digest-mismatch',seq:anchor.seq}; previous=anchor.digest; lastSeq=anchor.seq; }
    const tail=this.state.recordChain.anchors.at(-1)?.digest??this.state.recordChain.baseDigest??''; if(this.state.recordChain.anchors.length>0 && tail!==this.state.recordChain.head) return {ok:false,reason:'head-mismatch'}; return {ok:true,head:this.state.recordChain.head,anchors:this.state.recordChain.anchors.length,baseSeq:this.state.recordChain.baseSeq??-1};
  }

  private transportRequestHash(input:{id:string;type:string;source:string;payload?:unknown;payloadHash?:string;tickHint?:number;correlationId?:string}):string {
    const payloadHash = typeof input.payloadHash === 'string' ? input.payloadHash : sha256(input.payload);
    return sha256({ id:input.id, type:input.type, source:input.source, payloadHash, tickHint:input.tickHint ?? null, correlationId:input.correlationId ?? null });
  }
  private rememberTransportEnvelope(env:WillTransportEnvelope, requestHash=this.transportRequestHash(env)) {
    const prior = this.state.transport.seenEnvelopes.find(x => x.id === env.id);
    if (prior) { prior.requestHash=requestHash; prior.createdAt=env.createdAt; }
    else this.state.transport.seenEnvelopes.push({ id:env.id, requestHash, createdAt:env.createdAt });
    this.state.transport.seenEnvelopes = this.state.transport.seenEnvelopes.slice(-4096);
  }
  private activeTransportEnvelope(id:string):WillTransportEnvelope|undefined {
    return this.state.transport.queue.find(e=>e.id===id)
      ?? this.state.transport.pending.find(e=>e.id===id)
      ?? this.state.transport.replay.find(e=>e.id===id);
  }
  private normalizeTransportEnvelope(input:{id:string;type:string;source:string;payload:unknown;createdAt?:number;tickHint?:number;correlationId?:string}):WillTransportEnvelope {
    const id = typeof input?.id === 'string' ? input.id.trim() : '';
    const type = typeof input?.type === 'string' ? input.type.trim() : '';
    const source = typeof input?.source === 'string' ? input.source.trim() : '';
    if (!id || id.length > 256 || !type || type.length > 128 || !source || source.length > 256) throw new WillTransportError('transport-envelope-invalid','id, type and source must be non-empty bounded strings');
    const createdAt = input.createdAt === undefined ? Date.now() : Number(input.createdAt);
    if (!Number.isFinite(createdAt) || createdAt < 0) throw new WillTransportError('transport-envelope-invalid','createdAt must be a finite non-negative number');
    const tickHint = input.tickHint === undefined ? undefined : Number(input.tickHint);
    if (tickHint !== undefined && (!Number.isSafeInteger(tickHint) || tickHint < 0)) throw new WillTransportError('transport-envelope-invalid','tickHint must be a non-negative safe integer');
    const correlationId = input.correlationId === undefined ? undefined : (typeof input.correlationId === 'string' ? input.correlationId.trim() : '');
    if (correlationId !== undefined && (!correlationId || correlationId.length > 256)) throw new WillTransportError('transport-envelope-invalid','correlationId must be a non-empty bounded string when supplied');
    let serialized:string|undefined;
    try { serialized = stableJson(input.payload); } catch { throw new WillTransportError('transport-envelope-invalid','payload must be JSON-serializable'); }
    if (typeof serialized !== 'string' || serialized.length > 262144) throw new WillTransportError('transport-envelope-invalid','payload must be JSON-serializable and at most 256 KiB');
    let payload:unknown;
    try { payload = JSON.parse(serialized); } catch { throw new WillTransportError('transport-envelope-invalid','payload must be valid JSON data'); }
    const payloadHash = sha256(payload);
    const body = { id, type, source, createdAt, ...(tickHint === undefined ? {} : {tickHint}), ...(correlationId === undefined ? {} : {correlationId}), payload, payloadHash };
    return { ...body, envelopeHash:sha256(body) };
  }
  enqueue(input:{id:string;type:string;source:string;payload:unknown;createdAt?:number;tickHint?:number;correlationId?:string}){
    const env = this.normalizeTransportEnvelope(input);
    const requestHash = this.transportRequestHash(env);
    const seen = this.state.transport.seenEnvelopes.find(x => x.id === env.id);
    if (seen) {
      if (seen.requestHash !== requestHash) {
        this.state.transport.idempotencyConflicts++;
        this.anchor('transport-id-conflict',{ id:env.id, existingRequestHash:seen.requestHash, incomingRequestHash:requestHash },env.createdAt);
        throw new WillTransportError('transport-envelope-id-conflict','an envelope id is already bound to a different logical request');
      }
      const existing = this.activeTransportEnvelope(env.id);
      if (existing) return structuredClone(existing);
      // The envelope was accepted earlier but has aged out of the bounded queues/history. Never re-enqueue it.
      const restored = { ...env, createdAt:seen.createdAt, envelopeHash:'' };
      const { envelopeHash: _discard, ...rehashBody } = restored;
      restored.envelopeHash = sha256(rehashBody);
      return structuredClone(restored);
    }
    const active = this.activeTransportEnvelope(env.id);
    if (active) {
      const activeHash = this.transportRequestHash(active);
      if (activeHash !== requestHash) {
        this.state.transport.idempotencyConflicts++;
        this.anchor('transport-id-conflict',{ id:env.id, existingRequestHash:activeHash, incomingRequestHash:requestHash },env.createdAt);
        throw new WillTransportError('transport-envelope-id-conflict','an envelope id is already bound to a different logical request');
      }
      this.rememberTransportEnvelope(active,activeHash);
      return structuredClone(active);
    }
    if (this.state.transport.acked.includes(env.id)) {
      this.state.transport.rejectedEnvelopes++;
      this.anchor('transport-id-history-unknown',{ id:env.id },env.createdAt);
      throw new WillTransportError('transport-envelope-history-unknown','the envelope id was seen in the legacy ACK window but its request fingerprint has expired');
    }
    if (this.state.transport.queue.length >= 256) {
      this.state.transport.queueBackpressure++;
      this.anchor('transport-queue-backpressure',{ id:env.id, queueDepth:this.state.transport.queue.length },env.createdAt);
      throw new WillTransportError('transport-queue-full','transport queue is full; no queued envelope was discarded');
    }
    this.rememberTransportEnvelope(env,requestHash);
    this.state.transport.queue.push(env);
    this.state.transport.inboundCount++;
    this.state.counters.envelopes++;
    this.anchor('transport-inbound',env,env.createdAt);
    return structuredClone(env);
  }
  drainQueue(max=32){
    const requested = Number.isFinite(Number(max)) ? Math.floor(Number(max)) : 32;
    const count = Math.max(1,Math.min(256,requested));
    const availablePending = Math.max(0,256-this.state.transport.pending.length);
    const out:WillTransportEnvelope[]=[];
    while(this.state.transport.queue.length && out.length<Math.min(count,availablePending)) {
      const env=this.state.transport.queue.shift()!;
      if(this.state.transport.acked.includes(env.id) || this.state.transport.pending.some(x=>x.id===env.id)) continue;
      out.push(env);
    }
    this.state.transport.pending.push(...out);
    for(const env of out) if(!this.state.transport.replay.some(x=>x.id===env.id && x.envelopeHash===env.envelopeHash)) this.state.transport.replay.push(env);
    this.state.transport.replay=this.state.transport.replay.slice(-512);
    return structuredClone(out);
  }
  ackDetailed(input:WillAck):WillAckResult {
    const envelopeId=typeof input?.envelopeId==='string'?input.envelopeId.trim():'';
    const accepted=input?.accepted;
    const at=input?.at===undefined?Date.now():Number(input.at);
    const reason=input?.reason===undefined?undefined:String(input.reason).slice(0,500);
    if(!envelopeId || envelopeId.length>256 || typeof accepted!=='boolean' || !Number.isFinite(at) || at<0) {
      this.state.transport.rejectedAcks++;
      this.anchor('transport-ack-rejected',{ envelopeId:envelopeId||null, reason:'invalid-ack' },Number.isFinite(at)&&at>=0?at:Date.now());
      return {ok:false,error:'transport-ack-invalid',...(envelopeId?{envelopeId}:{})};
    }
    if(this.state.transport.acked.includes(envelopeId)) {
      const prior=this.state.transport.acks.find(x=>x.envelopeId===envelopeId);
      if(prior && (prior.accepted!==accepted || (prior.reason??'')!==(reason??''))) {
        this.state.transport.ackConflicts++;
        this.anchor('transport-ack-conflict',{envelopeId,priorAccepted:prior.accepted,incomingAccepted:accepted},at);
        return {ok:false,error:'transport-ack-conflict',envelopeId,priorAccepted:prior.accepted};
      }
      this.state.transport.dedupedAcks++;
      return {ok:true,envelopeId,accepted:prior?.accepted??accepted,reused:true,outcomeKnown:!!prior};
    }
    const known=this.activeTransportEnvelope(envelopeId);
    if(!known) {
      this.state.transport.rejectedAcks++;
      this.anchor('transport-ack-rejected',{envelopeId,reason:'unknown-envelope'},at);
      return {ok:false,error:'transport-envelope-not-found',envelopeId};
    }
    const ack:WillAck={envelopeId,accepted,at,...(reason===undefined?{}:{reason})};
    this.state.transport.acked.push(envelopeId);
    this.state.transport.acked=this.state.transport.acked.slice(-1024);
    this.state.transport.acks.push(ack);
    this.state.transport.acks=this.state.transport.acks.slice(-512);
    this.state.transport.queue=this.state.transport.queue.filter(e=>e.id!==envelopeId);
    this.state.transport.pending=this.state.transport.pending.filter(e=>e.id!==envelopeId);
    this.anchor('transport-ack',ack,at);
    return {ok:true,envelopeId,accepted,reused:false,outcomeKnown:true};
  }
  ack(input:WillAck){ const result=this.ackDetailed(input); return result.ok && !result.reused; }

  recordLanguageCompletion(input:{provider:string;model?:string;success:boolean;latencyMs:number;at?:number}){ const at=input.at??Date.now(); this.state.llm.completions++; if(!input.success)this.state.llm.failures++; this.state.llm.lastProvider=input.provider||null; this.state.llm.lastModel=input.model||null; this.state.llm.lastLatencyMs=Math.max(0,Number(input.latencyMs)||0); this.anchor('llm-completion',{provider:input.provider,model:input.model??null,success:input.success,latencyMs:this.state.llm.lastLatencyMs},at); }

  replayTransport(limit=16) {
    const requested=Number.isFinite(Number(limit))?Math.floor(Number(limit)):16;
    const count=Math.max(1,Math.min(128,requested));
    const history=this.state.transport.replay.slice(-count);
    const out:WillTransportEnvelope[]=[];
    for(const original of history) {
      // A replay may itself enter replay history after being drained; never recursively replay a replay.
      if(original.id.startsWith('replay:')) continue;
      const replayId=`replay:${original.id}:${sha256(original.envelopeHash).slice(0,12)}`;
      const seen=this.state.transport.seenEnvelopes.find(x=>x.id===replayId);
      const occupied=this.state.transport.acked.includes(replayId)
        || this.state.transport.queue.some(e=>e.id===replayId)
        || this.state.transport.pending.some(e=>e.id===replayId)
        || !!seen;
      if(occupied) continue;
      if(this.state.transport.queue.length>=256) break;
      const payload={replayOf:original.id,original:original.payload};
      const createdAt=original.createdAt;
      const body={id:replayId,type:original.type,source:original.source,createdAt,...(original.tickHint===undefined?{}:{tickHint:original.tickHint}),correlationId:original.correlationId??original.id,payload,payloadHash:sha256(payload)};
      const envelope:WillTransportEnvelope={...body,envelopeHash:sha256(body)};
      this.rememberTransportEnvelope(envelope,this.transportRequestHash(envelope));
      this.state.transport.queue.push(envelope);
      this.state.counters.envelopes++;
      out.push(structuredClone(envelope));
      this.anchor('transport-replay',{originalId:original.id,replayId},original.createdAt);
    }
    return out;
  }

  buildCompactPma(input:{subjectId:string;identity?:unknown;state?:unknown;goals?:unknown;memories?:unknown;skills?:unknown;social?:unknown;at?:number}){
    const at=input.at??Date.now(); const compact={schemaVersion:1,subjectId:input.subjectId,exportedAt:at,identity:input.identity??null,state:input.state??null,goals:input.goals??[],memorySummary:Array.isArray(input.memories)?input.memories.slice(0,128):[],competence:this.state.competence.artifacts.slice(-128),knownEntities:this.state.social.dossiers.slice(-128),conversationAims:this.state.social.conversations.filter(c=>c.open).slice(-32),transport:{acked:this.state.transport.acked.slice(-64)},recordHead:this.state.recordChain.head,source:{package:'@mindot/will',version:WILL_SOURCE_VERSION}};
    const fingerprint=sha256(compact); this.state.pma.lastFingerprint=fingerprint; this.state.pma.lastSchema=1; this.state.counters.pmaExports++; this.anchor('pma-export',{subjectId:input.subjectId,fingerprint},at); return {...compact,fingerprint};
  }

  validatePma(pma:unknown){
    const p=(pma??{}) as any; const ok=Boolean(p && p.schemaVersion===1 && typeof p.subjectId==='string' && typeof p.fingerprint==='string' && p.source?.version===WILL_SOURCE_VERSION && sha256({...p,fingerprint:undefined})!==undefined);
    const recalculated=(()=>{ if(!p||typeof p!=='object') return ''; const clone={...p}; delete clone.fingerprint; return sha256(clone); })(); const exact=ok && recalculated===p.fingerprint;
    this.state.pma.lastValidated=exact; this.state.counters.pmaValidations++; this.anchor('pma-validate',{ok:exact,fingerprint:p?.fingerprint??null}); return {ok:exact,expectedFingerprint:recalculated,actualFingerprint:p?.fingerprint??null};
  }
  fidelity(a:any,b:any){ const fields=['subjectId','schemaVersion','identity','state','goals','memorySummary','competence','knownEntities','conversationAims']; let score=0; for(const f of fields) if(stableJson(a?.[f])===stableJson(b?.[f])) score++; const result=score/fields.length; this.state.pma.lastFidelity01=result; this.state.counters.fidelityChecks++; this.anchor('pma-fidelity',{score01:result,fields:fields.length}); return result; }

  private skillArtifact(action:string){ return this.state.competence.artifacts.find(a=>a.action===action); }
  competenceForAction(action:string){ return this.skillArtifact(action)??null; }
  allCompetenceArtifacts(){ return structuredClone(this.state.competence.artifacts); }
  exportCompetenceBundle(){
    const body={schemaVersion:1,source:{package:'@mindot/will',version:WILL_SOURCE_VERSION},exportedAt:Date.now(),artifacts:this.state.competence.artifacts.slice(-256)};
    return {...body,fingerprint:sha256(body)};
  }
  validateCompetenceBundle(bundle:unknown){
    const input=bundle as any; if(!input || input.schemaVersion!==1 || !Array.isArray(input.artifacts) || typeof input.fingerprint!=='string') return {ok:false,reason:'invalid-bundle'};
    const clone={schemaVersion:1,source:input.source,exportedAt:input.exportedAt,artifacts:input.artifacts}; const expected=sha256(clone);
    return {ok:expected===input.fingerprint,expectedFingerprint:expected,actualFingerprint:input.fingerprint};
  }
  listDossiers(){ return structuredClone(this.state.social.dossiers); }
  listConversations(){ return structuredClone(this.state.social.conversations); }
  diagnostics() {
    return {
      schemaVersion: WILL_INTEGRATION_SCHEMA,
      source: this.state.source,
      counters: this.state.counters,
      agency: this.state.agency,
      policy: this.state.policy,
      pma: this.state.pma,
      llm: this.state.llm,
      social: {
        dossiers: this.state.social.dossiers.length,
        openConversations: this.state.social.conversations.filter(c => c.open).length,
      },
      competence: { skills: this.state.competence.artifacts.length },
      transport: {
        queued: this.state.transport.queue.length,
        pending: this.state.transport.pending.length,
        acked: this.state.transport.acked.length,
        replayable: this.state.transport.replay.length,
        dedupedAcks: this.state.transport.dedupedAcks,
        idempotencyConflicts: this.state.transport.idempotencyConflicts,
        rejectedAcks: this.state.transport.rejectedAcks,
        ackConflicts: this.state.transport.ackConflicts,
        rejectedEnvelopes: this.state.transport.rejectedEnvelopes,
        queueBackpressure: this.state.transport.queueBackpressure,
        idempotencyIndexEntries: this.state.transport.seenEnvelopes.length,
      },
      vector: {
        engine: this.state.vector.engine ?? 'deterministic-hnsw',
        records: this.state.vector.records.length,
        queries: this.state.vector.queryCount,
        hits: this.state.vector.hitCount,
        promotion: !!(this.state.vector as any).promoted,
        benchmark: (this.state.vector as any).benchmark ?? null,
      },
      recordChain: {
        head: this.state.recordChain.head,
        anchors: this.state.recordChain.anchors.length,
        integrity: this.verifyRecordChain(),
      },
    };
  }
}

export function defaultWillIntegrationState():WillIntegrationState{return defaultState();}
