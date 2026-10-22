import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const containsControlCharacter=(value:string):boolean=>Array.from(value).some(character=>{
  const code=character.codePointAt(0)??0;
  return code<=0x1f||(code>=0x7f&&code<=0x9f);
});
const normalizeBoundedId=(value:unknown,maxLength:number):string=>{
  if(typeof value!=='string')return '';
  const normalized=value.normalize('NFKC');
  // Reject control-bearing input before trim: otherwise a leading/trailing
  // newline or tab could be erased and alias a different valid identity.
  if(containsControlCharacter(normalized))return '';
  const trimmed=normalized.trim();
  if(!trimmed||trimmed.length>maxLength)return '';
  return trimmed;
};
const normalizeTraceId=(value:unknown)=>normalizeBoundedId(value,180);
const normalizeTaskId=(value:unknown)=>normalizeBoundedId(value,120);
const CAUSAL_ACTIONS: readonly ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];

export interface CausalExperienceRecord {
  id:string;
  tick:number;
  at:number;
  traceId:string;
  action:ActionKind;
  taskId:string;
  reward01:number;
  success01:number;
  surprise01:number;
  predictionError01:number;
  novelty01:number;
  uncertainty01:number;
  energyBefore01:number;
  energyAfter01:number;
  stateDelta01:number;
  causalStrength01:number;
  identityRelevance01:number;
  goalPressure01:number;
  consolidated:boolean;
  provenance:'runtime-outcome'|'experience-replay'|'skill-repair'|'external';
  stateGrounded:boolean;
  sourceMemoryId?:string;
  evidenceKey?:string;
  policyFeatures01?:number[];
  learningQuality01?:number;
  replayEligible?:boolean;
  replayPriority01?:number;
  replayCount?:number;
  lastReplayedAt?:number;
}

export interface CausalExperienceState {
  version:4;
  observations:number;
  outcomes:number;
  consolidated:number;
  records:CausalExperienceRecord[];
  rolling:{surprise01:number;predictionError01:number;causalStrength01:number;learningOpportunity01:number};
  lastConsolidatedAt:number;
  behavioralImpact01:number;
  behavioralContextSamples:number;
  behavioralDivergence01:number;
  recordedTraceIds?:string[];
}

export interface CausalLearningPacket {
  records:CausalExperienceRecord[];
  learningOpportunity01:number;
  meanReward01:number;
  meanSurprise01:number;
  meanCausalStrength01:number;
}

export function defaultCausalExperienceStream():CausalExperienceState {
  return {version:4,observations:0,outcomes:0,consolidated:0,records:[],rolling:{surprise01:0,predictionError01:0,causalStrength01:0,learningOpportunity01:0},lastConsolidatedAt:0,behavioralImpact01:0,behavioralContextSamples:0,behavioralDivergence01:0};
}

function vector(state:OrganismState){
  const n=state.needs;
  return [n.energy,n.cognitiveLoad,n.uncertainty,n.novelty,n.goalPressure,n.socialNeed,n.identityCoherence,state.predictionError,state.attentionBudget,state.selfPredictionError];
}

function distance(a:number[],b:number[]){
  const n=Math.min(a.length,b.length); if(!n)return 0;
  let sum=0; for(let i=0;i<n;i++)sum+=(clamp01(a[i])-clamp01(b[i]))**2;
  return clamp01(Math.sqrt(sum/n)*1.8);
}

export class CausalExperienceStream {
  private state=defaultCausalExperienceStream();
  private readonly maxRecords:number;
  private readonly recordedOutcomeTraceIds=new Set<string>();
  private readonly maxRecordedTraceIds=4096;
  constructor(maxRecords=1024){ this.maxRecords=Math.max(64,Math.min(4096,Math.floor(maxRecords))); }
  restore(raw?:Partial<CausalExperienceState>|null){
    const d=defaultCausalExperienceStream(),r=raw??{};
    const restoredRows:CausalExperienceRecord[]=Array.isArray(r.records)
      ? r.records.slice(-this.maxRecords)
        .map(record=>({...record,traceId:normalizeTraceId(record?.traceId)}))
        .filter(record=>Boolean(record.traceId))
      : [];
    const firstByTraceId=new Map<string,CausalExperienceRecord>();
    const conflictingTraceIds=new Set<string>();
    const uniqueRows:CausalExperienceRecord[]=[];
    for(const record of restoredRows){
      const prior=firstByTraceId.get(record.traceId);
      if(!prior){
        firstByTraceId.set(record.traceId,record);
        uniqueRows.push(record);
      }else if(JSON.stringify(prior)!==JSON.stringify(record)){
        // Distinct persisted records became the same identity after NFKC.
        // Quarantine every row for that identity rather than choosing one result.
        conflictingTraceIds.add(record.traceId);
      }
      // An exact duplicate row is safely collapsed to the first copy.
    }
    const records=uniqueRows.filter(record=>!conflictingTraceIds.has(record.traceId));
    this.state={
      ...d,...r,
      records,
      rolling:{...d.rolling,...(r.rolling??{})},
      recordedTraceIds:Array.isArray(r.recordedTraceIds)?r.recordedTraceIds.map(normalizeTraceId).filter(Boolean).slice(-this.maxRecordedTraceIds):[],
    };
    this.recordedOutcomeTraceIds.clear();
    for(const id of this.state.recordedTraceIds??[])this.recordedOutcomeTraceIds.add(id);
    // Keep both valid and quarantined event identities in the bounded dedup guard.
    // This prevents a malformed historical collision from being reintroduced as new data.
    for(const record of restoredRows)this.recordedOutcomeTraceIds.add(record.traceId);
    while(this.recordedOutcomeTraceIds.size>this.maxRecordedTraceIds)this.recordedOutcomeTraceIds.delete(this.recordedOutcomeTraceIds.values().next().value!);
    this.state.recordedTraceIds=[...this.recordedOutcomeTraceIds];
    this.recomputeBehavioralImpact();
  }
  snapshot(){return structuredClone(this.state);}
  observe(trace:OrganismDecisionTrace):void{
    this.state.observations++;
    // Observation alone is not an outcome and must not suppress its later record.
    // Observation is intentionally cheap: it never evicts causal records. The stream waits for outcome before creating a sample.
  }
  recordOutcome(trace:OrganismDecisionTrace,stateAfter:OrganismState,input:{reward01:number;success01:number;surprise01:number;novelty01:number}):CausalExperienceRecord|null{
    if(!trace.selected)return null;
    const traceId=normalizeTraceId(trace.id);
    if(!traceId||this.recordedOutcomeTraceIds.has(traceId)||this.state.records.some(r=>r.traceId===traceId))return null;
    const before=vector(trace.stateBefore),after=vector(stateAfter);
    const stateDelta=distance(before,after);
    const surprise=clamp01(input.surprise01);
    const predictionError=clamp01(trace.stateBefore.predictionError);
    const novelty=clamp01(input.novelty01);
    const uncertainty=clamp01(trace.stateBefore.needs.uncertainty);
    const reward=clamp01(input.reward01),success=clamp01(input.success01);
    const outcomeMagnitude=clamp01(Math.abs(reward-.5)*1.6+Math.abs(success-.5)*.8);
    const causalStrength=clamp01(stateDelta*.34+predictionError*.24+surprise*.18+outcomeMagnitude*.16+novelty*.08);
    const learningOpportunity=clamp01(causalStrength*.58+surprise*.18+predictionError*.14+novelty*.10);
    const id=`cx-${trace.tick}-${traceId}`;
    const record:CausalExperienceRecord={
      id, tick:trace.tick, at:Date.now(), traceId, action:trace.selected.action,
      taskId:trace.selected.goalId??trace.selected.action, reward01:reward, success01:success,
      surprise01:surprise, predictionError01:predictionError, novelty01:novelty, uncertainty01:uncertainty,
      energyBefore01:clamp01(trace.stateBefore.needs.energy), energyAfter01:clamp01(stateAfter.needs.energy),
      stateDelta01:stateDelta, causalStrength01:causalStrength,
      identityRelevance01:clamp01(trace.stateBefore.needs.identityCoherence), goalPressure01:clamp01(trace.stateBefore.needs.goalPressure),
      consolidated:false, provenance:'runtime-outcome', stateGrounded:true,
      policyFeatures01:this.policyFeatureVector(trace.stateBefore),
      learningQuality01:clamp01(.45+causalStrength*.45+surprise*.10), replayEligible:true, replayPriority01:clamp01(.24*surprise+.20*predictionError+.18*causalStrength+.12*novelty+.10*uncertainty+.08*clamp01(trace.stateBefore.needs.identityCoherence)+.08*clamp01(trace.stateBefore.needs.goalPressure)+.06*clamp01(.45+causalStrength*.45+surprise*.10)), replayCount:0, lastReplayedAt:0,
    };
    this.state.records.push(record); if(this.state.records.length>this.maxRecords)this.state.records=this.state.records.slice(-this.maxRecords);
    this.recordedOutcomeTraceIds.add(traceId);
    while(this.recordedOutcomeTraceIds.size>this.maxRecordedTraceIds)this.recordedOutcomeTraceIds.delete(this.recordedOutcomeTraceIds.values().next().value!);
    this.state.recordedTraceIds=[...this.recordedOutcomeTraceIds];
    this.state.outcomes++;
    this.state.rolling.surprise01=clamp01(this.state.rolling.surprise01*.92+surprise*.08);
    this.state.rolling.predictionError01=clamp01(this.state.rolling.predictionError01*.92+predictionError*.08);
    this.state.rolling.causalStrength01=clamp01(this.state.rolling.causalStrength01*.9+causalStrength*.1);
    this.state.rolling.learningOpportunity01=clamp01(this.state.rolling.learningOpportunity01*.9+learningOpportunity*.1);
    this.recomputeBehavioralImpact();
    return structuredClone(record);
  }
  recordExternalLearningEvent(input:{tick:number;taskId:string;action:ActionKind;reward01:number;success01:number;surprise01:number;novelty01:number;uncertainty01?:number;identityRelevance01?:number;goalPressure01?:number;causalStrength01?:number;traceId?:string;provenance?:CausalExperienceRecord['provenance'];stateGrounded?:boolean;sourceMemoryId?:string;evidenceKey?:string}):CausalExperienceRecord|null{
    const taskCandidate=typeof input.taskId==='string'?input.taskId.normalize('NFKC'):'';
    if(!taskCandidate.trim())throw new Error('causal-external-task-id-required');
    // Preserve the raw normalized value until control-character validation;
    // trimming here would erase a leading/trailing newline or tab.
    const taskId=normalizeTaskId(taskCandidate);
    if(!taskId)throw new Error('causal-external-task-id-invalid');
    if(!CAUSAL_ACTIONS.includes(input.action))throw new Error('causal-external-action-invalid');
    const eventTick=Math.max(0,Math.floor(Number.isFinite(input.tick)?input.tick:0));
    const reward=clamp01(input.reward01),success=clamp01(input.success01),surprise=clamp01(input.surprise01),novelty=clamp01(input.novelty01),uncertainty=clamp01(input.uncertainty01??.5);
    const identityRelevance=clamp01(input.identityRelevance01??0),goalPressure=clamp01(input.goalPressure01??0);
    const provenance=input.provenance??'external',stateGrounded=Boolean(input.stateGrounded);
    const sourceMemoryId=input.sourceMemoryId,evidenceKey=input.evidenceKey;
    const causal=clamp01(input.causalStrength01??(surprise*.35+novelty*.15+Math.abs(reward-.5)*.25+Math.abs(success-.5)*.25));
    const at=Date.now();
    const id=`cx-ext-${eventTick}-${taskId}-${at}`;
    const traceId=input.traceId===undefined?normalizeTraceId(id):normalizeTraceId(input.traceId);
    if(!traceId)throw new Error('causal-external-trace-id-invalid');
    const prior=this.state.records.find(record=>record.traceId===traceId);
    if(prior){
      // Stable source identity is idempotent only for the same normalized payload.
      // A reused ID with changed evidence must surface as a conflict, not be silently ignored.
      const samePayload=prior.provenance===provenance&&prior.tick===eventTick&&prior.taskId===taskId&&prior.action===input.action&&
        prior.reward01===reward&&prior.success01===success&&prior.surprise01===surprise&&prior.novelty01===novelty&&
        prior.uncertainty01===uncertainty&&prior.identityRelevance01===identityRelevance&&prior.goalPressure01===goalPressure&&
        prior.causalStrength01===causal&&prior.stateGrounded===stateGrounded&&
        prior.sourceMemoryId===sourceMemoryId&&prior.evidenceKey===evidenceKey;
      if(!samePayload)throw new Error('causal-external-trace-id-conflict');
      return structuredClone(prior);
    }
    if(this.recordedOutcomeTraceIds.has(traceId)){
      // The event is known but its bounded record has been evicted. Do not create
      // another outcome when an upstream bridge retries an identity we still remember.
      return null;
    }
    const record:CausalExperienceRecord={
      id, tick:eventTick, at, traceId, action:input.action,
      taskId, reward01:reward, success01:success, surprise01:surprise,
      predictionError01:surprise*.6, novelty01:novelty, uncertainty01:uncertainty, energyBefore01:.5,
      energyAfter01:clamp01(.5-success*.08), stateDelta01:clamp01(Math.abs(success-.5)*.7+surprise*.3), causalStrength01:causal,
      identityRelevance01:identityRelevance, goalPressure01:goalPressure,
      consolidated:false, provenance, stateGrounded,
      sourceMemoryId, evidenceKey,
      learningQuality01:clamp01((stateGrounded?0.45:0.18)+causal*.45+novelty*.10), replayEligible:stateGrounded, replayPriority01:clamp01(.24*surprise+.20*(surprise*.6)+.18*causal+.12*novelty+.10*uncertainty+.08*identityRelevance+.08*goalPressure+.06*clamp01((stateGrounded?0.45:0.18)+causal*.45+novelty*.10)), replayCount:0, lastReplayedAt:0,
    };
    this.state.records.push(record); if(this.state.records.length>this.maxRecords)this.state.records=this.state.records.slice(-this.maxRecords);
    this.recordedOutcomeTraceIds.add(traceId);
    while(this.recordedOutcomeTraceIds.size>this.maxRecordedTraceIds)this.recordedOutcomeTraceIds.delete(this.recordedOutcomeTraceIds.values().next().value!);
    this.state.recordedTraceIds=[...this.recordedOutcomeTraceIds];
    this.state.outcomes++; this.recomputeBehavioralImpact(); this.state.rolling.surprise01=clamp01(this.state.rolling.surprise01*.92+surprise*.08); this.state.rolling.predictionError01=clamp01(this.state.rolling.predictionError01*.92+record.predictionError01*.08); this.state.rolling.causalStrength01=clamp01(this.state.rolling.causalStrength01*.9+causal*.1); this.state.rolling.learningOpportunity01=clamp01(this.state.rolling.learningOpportunity01*.9+(causal*.58+surprise*.18+novelty*.1)*.1); return structuredClone(record);
  }
  private policyFeatureVector(state:OrganismState):number[]{
    const n=state.needs;
    return [n.energy,n.cognitiveLoad,n.uncertainty,n.novelty,n.goalPressure,n.socialNeed,n.identityCoherence,state.predictionError,state.attentionBudget,state.selfPredictionError,1-n.energy,1-n.cognitiveLoad,1-n.uncertainty,1-n.novelty,1-n.goalPressure,n.energy<.25?1:0].map(clamp01);
  }
  prioritizedReplayCandidates(limit=32,at=Date.now()){
    const now=Number.isFinite(at)?Number(at):Date.now();
    const rows=this.state.records.filter(r=>r.replayEligible!==false&&Array.isArray(r.policyFeatures01)&&r.policyFeatures01.length>=16);
    const score=(r:CausalExperienceRecord)=>{
      const ageDays=Math.max(0,now-r.at)/86400000;
      const ageBoost=clamp01(Math.min(1,ageDays/3))*.05;
      const repeatPenalty=clamp01((r.replayCount??0)/6)*.14;
      const recencyPenalty=(r.lastReplayedAt&&now>=r.lastReplayedAt)?clamp01(1-(now-r.lastReplayedAt)/(6*3600000))*.12:0;
      const quality=clamp01(r.learningQuality01??.5);
      return clamp01(.24*r.surprise01+.20*r.predictionError01+.18*r.causalStrength01+.12*r.novelty01+.10*r.uncertainty01+.08*r.identityRelevance01+.08*r.goalPressure01+.06*quality+ageBoost-repeatPenalty-recencyPenalty);
    };
    const ranked=rows.map(r=>({...r,replayPriority01:score(r)}));
    const selected:typeof ranked=[];
    const taskCounts=new Map<string,number>(),contextCounts=new Map<string,number>();
    const wanted=Math.max(1,Math.min(64,Math.floor(limit)));
    // Maximal-marginal-relevance selection: retain high-value surprises while
    // stopping one task/context from consuming the whole replay batch.
    while(selected.length<wanted&&ranked.length){
      let bestIndex=0,bestAdjusted=-Infinity;
      for(let i=0;i<ranked.length;i++){
        const candidate=ranked[i];
        const base=candidate.replayPriority01??0;
        const taskSeen=taskCounts.get(candidate.taskId)??0;
        const contextSeen=contextCounts.get(this.contextKey(candidate))??0;
        const adjusted=base-Math.min(.42,taskSeen*.24+contextSeen*.08);
        if(adjusted>bestAdjusted){bestAdjusted=adjusted;bestIndex=i;}
      }
      const [chosen]=ranked.splice(bestIndex,1);
      selected.push(chosen);
      taskCounts.set(chosen.taskId,(taskCounts.get(chosen.taskId)??0)+1);
      const key=this.contextKey(chosen);
      contextCounts.set(key,(contextCounts.get(key)??0)+1);
    }
    return selected.map(r=>structuredClone(r));
  }
  policyReplayCandidates(limit=32,at=Date.now()){ return this.prioritizedReplayCandidates(limit,at); }
  markReplay(ids:string[],at=Date.now()){
    const wanted=new Set(ids.map(String));
    for(const r of this.state.records){ if(!wanted.has(r.id)) continue; r.replayCount=(r.replayCount??0)+1; r.lastReplayedAt=at; r.replayPriority01=clamp01((r.replayPriority01??0)*.78); }
    return ids.length;
  }

  private contextKey(r:CausalExperienceRecord){return `${r.taskId}|e${Math.floor(r.energyBefore01*4)}|u${Math.floor(r.uncertainty01*4)}|n${Math.floor(r.novelty01*4)}|g${Math.floor(r.goalPressure01*4)}`;}
  private recomputeBehavioralImpact(){
    const buckets=new Map<string,CausalExperienceRecord[]>();
    for(const r of this.state.records){const k=this.contextKey(r);const arr=buckets.get(k)??[];arr.push(r);buckets.set(k,arr);}
    let weighted=0,weight=0,divergence=0,samples=0;
    for(const rows of buckets.values()){if(rows.length<4)continue; const early=rows.slice(0,Math.max(2,Math.floor(rows.length/2))); const late=rows.slice(-Math.max(2,Math.floor(rows.length/2)));
      const share=(xs:CausalExperienceRecord[],action:ActionKind)=>xs.filter(x=>x.action===action).length/Math.max(1,xs.length);
      const actions=[...new Set(rows.map(x=>x.action))]; let d=0; for(const a of actions)d+=Math.abs(share(early,a)-share(late,a));
      const normalized=clamp01(d/2); const evidence=clamp01(rows.reduce((s,x)=>s+x.causalStrength01,0)/rows.length); weighted+=normalized*evidence; weight+=evidence; divergence+=normalized; samples+=1;
    }
    this.state.behavioralContextSamples=samples;this.state.behavioralDivergence01=samples?clamp01(divergence/samples):0;this.state.behavioralImpact01=weight?clamp01(weighted/weight):0;
  }

  recent(limit=64){return this.state.records.slice(-Math.max(1,Math.min(256,Math.floor(limit)))).map(x=>structuredClone(x));}
  learningPacket(limit=64):CausalLearningPacket{
    const rows=this.recent(limit); if(!rows.length)return {records:[],learningOpportunity01:0,meanReward01:.5,meanSurprise01:0,meanCausalStrength01:0};
    const mean=(fn:(r:CausalExperienceRecord)=>number)=>rows.reduce((s,r)=>s+fn(r),0)/rows.length;
    return {records:rows,learningOpportunity01:clamp01(mean(r=>r.causalStrength01*.6+r.surprise01*.2+r.predictionError01*.2)),meanReward01:clamp01(mean(r=>r.reward01)),meanSurprise01:clamp01(mean(r=>r.surprise01)),meanCausalStrength01:clamp01(mean(r=>r.causalStrength01))};
  }
  consolidate(limit=32,at=Date.now()){
    // Only evidence grounded in an actual state transition may become consolidated memory.
    const ranked=this.state.records.filter(r=>!r.consolidated&&r.stateGrounded);
    const rows:CausalExperienceRecord[]=[];
    const taskCounts=new Map<string,number>(),contextCounts=new Map<string,number>();
    const wanted=Math.max(1,Math.min(128,Math.floor(limit)));
    while(rows.length<wanted&&ranked.length){
      let bestIndex=0,bestAdjusted=-Infinity;
      for(let i=0;i<ranked.length;i++){
        const candidate=ranked[i];
        const taskSeen=taskCounts.get(candidate.taskId)??0;
        const contextSeen=contextCounts.get(this.contextKey(candidate))??0;
        const adjusted=candidate.causalStrength01+candidate.surprise01-Math.min(1.1,taskSeen*.55+contextSeen*.20);
        if(adjusted>bestAdjusted){bestAdjusted=adjusted;bestIndex=i;}
      }
      const [chosen]=ranked.splice(bestIndex,1);
      rows.push(chosen);
      taskCounts.set(chosen.taskId,(taskCounts.get(chosen.taskId)??0)+1);
      const key=this.contextKey(chosen);
      contextCounts.set(key,(contextCounts.get(key)??0)+1);
    }
    const eligible=rows.filter(r=>r.causalStrength01>=.44||r.surprise01>=.55||r.identityRelevance01>=.78);
    for(const r of eligible)r.consolidated=true;
    this.state.consolidated+=eligible.length; if(eligible.length)this.state.lastConsolidatedAt=at;
    return eligible.map(r=>structuredClone(r));
  }
  summary(){return {version:4,observations:this.state.observations,outcomes:this.state.outcomes,consolidated:this.state.consolidated,records:this.state.records.length,rolling:{...this.state.rolling},lastConsolidatedAt:this.state.lastConsolidatedAt,behavioralImpact01:this.state.behavioralImpact01,behavioralContextSamples:this.state.behavioralContextSamples,behavioralDivergence01:this.state.behavioralDivergence01};}
}
