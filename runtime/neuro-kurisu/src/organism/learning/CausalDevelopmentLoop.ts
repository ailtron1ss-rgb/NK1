import type { ActionKind, OrganismState, WorldContext } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIM=16;
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const stateVector=(s:OrganismState)=>[
  s.needs.energy,s.needs.cognitiveLoad,s.needs.uncertainty,s.needs.novelty,s.needs.goalPressure,s.needs.socialNeed,
  s.needs.identityCoherence,s.predictionError,s.attentionBudget,s.selfPredictionError,
  1-s.needs.energy,1-s.needs.cognitiveLoad,1-s.needs.uncertainty,1-s.needs.novelty,1-s.needs.goalPressure,1-s.needs.socialNeed
].map(clamp);
const dist=(a:number[],b:number[])=>{let sum=0;for(let i=0;i<DIM;i++)sum+=(clamp(a[i]??.5)-clamp(b[i]??.5))**2;return clamp(Math.sqrt(sum/DIM)*1.8);};
const hash=(s:string)=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(16)};

export interface CausalDevelopmentSample {
  id:string; at:number; tick:number; taskId:string; action:ActionKind;
  before:number[]; after:number[]; outcome01:number; reward01:number; surprise01:number;
  causalStrength01:number; evidenceQuality01:number; verified:boolean; independent:boolean; contextKey:string;
}

export interface BehavioralSequenceEvidence {
  id:string; sequence:ActionKind[]; occurrences:number; successes:number; verified:number;
  holdoutTrials:number; holdoutSuccesses:number; distinctContexts:number; contextKeys:string[];
  success01:number; holdout01:number; retention01:number; confidence01:number; transfer01:number;
  status:'candidate'|'promoted'|'blocked'; promotedAt:number; lastAt:number; lastOutcome01:number;
  lastContext:string; consecutiveFailures:number; delayedSuccesses:number;
}

export interface BehavioralEpisodeStep {
  tick:number; at:number; taskId:string; action:ActionKind; before:number[]; after:number[];
  outcome01:number; verified:boolean; contextKey:string;
}

export interface BehavioralEpisode {
  id:string; taskId:string; startedAt:number; lastAt:number; steps:BehavioralEpisodeStep[];
}

export interface CausalSkillCandidate {
  id:string; action:ActionKind; taskId:string; contexts:number; uses:number; success01:number; holdout01:number;
  transfer01:number; causal01:number; evidence01:number; status:'candidate'|'promotable'|'blocked'; lastAt:number;
}
export interface CausalDevelopmentLoopState {
  version:2;
  samples:CausalDevelopmentSample[];
  candidates:CausalSkillCandidate[];
  behavioralSequences:BehavioralSequenceEvidence[];
  behavioralEpisodes:BehavioralEpisode[];
  lastBehavioralActionByTask:Record<string,ActionKind>;
  behavioralPromotions:number;
  behavioralBlocks:number;
  behavioralRollbackSignals:number;
  behavioralTransferGain01:number;
  cycles:number;
  worldLearningEvents:number;
  selfLearningEvents:number;
  coupledUpdates:number;
  verifiedUpdates:number;
  holdoutBefore01:number;
  holdoutAfter01:number;
  holdoutDelta01:number;
  transferGain01:number;
  skillPromotions:number;
  skillBlocks:number;
  rollbackSignals:number;
  meanCausalStrength01:number;
  meanEvidence01:number;
  meanCoupling01:number;
  lastDecision:string;
  lastAt:number;
}
export const defaultCausalDevelopmentLoop=():CausalDevelopmentLoopState=>({
  version:2,samples:[],candidates:[],behavioralSequences:[],behavioralEpisodes:[],lastBehavioralActionByTask:{},behavioralPromotions:0,behavioralBlocks:0,behavioralRollbackSignals:0,behavioralTransferGain01:0,cycles:0,worldLearningEvents:0,selfLearningEvents:0,coupledUpdates:0,verifiedUpdates:0,
  holdoutBefore01:.5,holdoutAfter01:.5,holdoutDelta01:0,transferGain01:0,skillPromotions:0,skillBlocks:0,rollbackSignals:0,
  meanCausalStrength01:.5,meanEvidence01:.3,meanCoupling01:.5,lastDecision:'idle',lastAt:0,
});

export class CausalDevelopmentLoop {
  private state=defaultCausalDevelopmentLoop();
  restore(raw?:Partial<CausalDevelopmentLoopState>|null){const d=defaultCausalDevelopmentLoop(),r=raw??{};this.state={...d,...r,version:2,
    behavioralSequences:Array.isArray((r as any).behavioralSequences)?(r as any).behavioralSequences.slice(0,64).map((x:any)=>({...x,sequence:Array.isArray(x.sequence)?x.sequence.filter((a:any)=>ACTIONS.includes(a)).slice(0,4):[],contextKeys:Array.isArray(x.contextKeys)?Array.from(new Set(x.contextKeys.map((v:any)=>String(v).slice(0,240)))).slice(0,16):[]})):[],
    behavioralEpisodes:Array.isArray((r as any).behavioralEpisodes)?(r as any).behavioralEpisodes.slice(0,24).map((x:any)=>({...x,steps:Array.isArray(x.steps)?x.steps.slice(-8).map((st:any)=>({...st,before:Array.isArray(st.before)?st.before.slice(0,DIM).map(clamp):new Array(DIM).fill(.5),after:Array.isArray(st.after)?st.after.slice(0,DIM).map(clamp):new Array(DIM).fill(.5)})):[]})):[],
    lastBehavioralActionByTask:((r as any).lastBehavioralActionByTask&&typeof (r as any).lastBehavioralActionByTask==='object')?Object.fromEntries(Object.entries((r as any).lastBehavioralActionByTask).slice(-32).map(([k,v])=>[String(k).slice(0,96),(ACTIONS.includes(v as any)?v:'wait') as ActionKind])):{},
    behavioralPromotions:Math.max(0,Math.floor(Number((r as any).behavioralPromotions??0))), behavioralBlocks:Math.max(0,Math.floor(Number((r as any).behavioralBlocks??0))), behavioralRollbackSignals:Math.max(0,Math.floor(Number((r as any).behavioralRollbackSignals??0))), behavioralTransferGain01:clamp(Number((r as any).behavioralTransferGain01??0)),
    samples:Array.isArray(r.samples)?r.samples.slice(-192).map((s:any)=>({...s,before:Array.isArray(s.before)?s.before.slice(0,DIM).map(clamp):new Array(DIM).fill(.5),after:Array.isArray(s.after)?s.after.slice(0,DIM).map(clamp):new Array(DIM).fill(.5)})):[],
    candidates:Array.isArray(r.candidates)?r.candidates.slice(-64):[]};}
  snapshot(){return structuredClone(this.state);}
  beginCycle(){this.state.cycles++;}

  contextKey(world?:WorldContext|null, state?:OrganismState, taskId='general'){
    const location=world?.location??'none';
    const facts=(world?.facts??[]).slice(-4).map(String).sort().join(',');
    const objects=(world?.objects??[]).slice(0,4).map(o=>`${o.id}:${o.label}:${o.visible?'1':'0'}`).join(',');
    const needs=state?`e${Math.round(state.needs.energy*4)}u${Math.round(state.needs.uncertainty*4)}g${Math.round(state.needs.goalPressure*4)}`:'none';
    return `${String(taskId).slice(0,64)}|${location}|${facts}|${objects}|${needs}`.slice(0,240);
  }

  observeOutcome(input:{tick:number;at:number;taskId:string;action:ActionKind;before:OrganismState;after:OrganismState;reward01:number;success01:number;surprise01:number;verified:boolean;independent:boolean;worldTransition?:boolean;externalEvidence?:boolean;contextKey:string}){
    const before=stateVector(input.before), after=stateVector(input.after);
    const selfDelta=dist(before,after);
    const reward=clamp(input.reward01), success=clamp(input.success01), surprise=clamp(input.surprise01);
    const evidence=clamp((input.verified?.52:0)+(input.independent?.28:0)+(input.externalEvidence?.12:0)+(input.worldTransition?.08:0));
    const causal=clamp(.34*(1-surprise)+.26*Math.abs(reward-.5)*1.8+.22*selfDelta+.18*(input.worldTransition?1:0));
    const sample:CausalDevelopmentSample={id:`cdl:${input.tick}:${hash(`${input.taskId}|${input.action}|${input.contextKey}`)}`,at:input.at,tick:input.tick,taskId:String(input.taskId).slice(0,96),action:input.action,before,after,outcome01:success,reward01:reward,surprise01:surprise,causalStrength01:causal,evidenceQuality01:evidence,verified:Boolean(input.verified),independent:Boolean(input.independent),contextKey:String(input.contextKey).slice(0,240)};
    this.state.samples=[sample,...this.state.samples.filter(x=>x.id!==sample.id)].slice(0,192);
    this.state.meanCausalStrength01=clamp(this.state.meanCausalStrength01*.94+causal*.06);
    this.state.meanEvidence01=clamp(this.state.meanEvidence01*.94+evidence*.06);
    const contextCoupling=clamp(.5+.5*(1-dist(before,after))*(.5+causal*.5));
    this.state.meanCoupling01=clamp(this.state.meanCoupling01*.95+contextCoupling*.05);
    this.state.coupledUpdates++;
    if(input.worldTransition)this.state.worldLearningEvents++;
    this.state.selfLearningEvents++;
    if(input.verified)this.state.verifiedUpdates++;
    this.upsertCandidate(sample);
    const behavioral=this.updateBehavioralSequence(sample);
    this.state.lastAt=input.at;
    this.state.lastDecision=input.verified?'verified-coupled-update':'internal-coupled-update';
    return {selfDelta01:selfDelta,causalStrength01:causal,evidenceQuality01:evidence,coupling01:contextCoupling,behavioral,...behavioral,candidate:this.state.candidates.find(c=>c.id===this.candidateId(sample))??null};
  }

  private candidateId(s:CausalDevelopmentSample){return `${s.taskId}|${s.action}`;}
  private upsertCandidate(s:CausalDevelopmentSample){
    const id=this.candidateId(s);let c=this.state.candidates.find(x=>x.id===id);
    if(!c){c={id,action:s.action,taskId:s.taskId,contexts:0,uses:0,success01:.5,holdout01:.5,transfer01:0,causal01:.5,evidence01:0,status:'candidate',lastAt:s.at};this.state.candidates.unshift(c);}
    c.uses++; if(s.outcome01>=.62)c.success01=clamp(c.success01*.9+.1*s.outcome01);else c.success01=clamp(c.success01*.94+.06*s.outcome01);
    const distinct=new Set(this.state.samples.filter(x=>x.taskId===s.taskId&&x.action===s.action).map(x=>x.contextKey)); c.contexts=Math.min(32,distinct.size);
    c.causal01=clamp(c.causal01*.86+s.causalStrength01*.14); c.evidence01=clamp(c.evidence01*.86+s.evidenceQuality01*.14);
    const other=this.state.samples.filter(x=>x.taskId!==s.taskId&&x.action===s.action).slice(0,24);
    const similar=other.length?other.reduce((sum,x)=>sum+(1-dist(x.before,s.before))*x.outcome01,0)/other.length:.5;
    c.transfer01=clamp(c.transfer01*.88+similar*.12);
    if(c.uses%4===0)c.holdout01=clamp(c.holdout01*.75+(s.verified?s.outcome01:.5)*.25);
    const promotable=c.uses>=8&&c.contexts>=3&&c.success01>=.72&&c.holdout01>=.62&&c.causal01>=.55&&c.evidence01>=.55&&c.transfer01>=.58;
    if(promotable)c.status='promotable'; else if(c.uses>=10&&c.success01<.45)c.status='blocked';
    if(c.status==='blocked')this.state.skillBlocks++;
    this.state.candidates=this.state.candidates.slice(0,64);
    if(promotable)this.state.skillPromotions=Math.max(this.state.skillPromotions,this.state.candidates.filter(x=>x.status==='promotable').length);
  }

  private sequenceId(sequence:ActionKind[]){return sequence.join('>');}
  private sequenceContexts(sequence:ActionKind[]){const id=this.sequenceId(sequence);return this.state.behavioralSequences.find(x=>x.id===id);}
  private updateBehavioralSequence(sample:CausalDevelopmentSample){
    const task=sample.taskId;
    let episode=this.state.behavioralEpisodes.find(x=>x.taskId===task && sample.at-x.lastAt<=120000);
    if(!episode){episode={id:`be:${task}:${sample.tick}`,taskId:task,startedAt:sample.at,lastAt:sample.at,steps:[]};this.state.behavioralEpisodes=[episode,...this.state.behavioralEpisodes].slice(0,24);}
    const step:BehavioralEpisodeStep={tick:sample.tick,at:sample.at,taskId:task,action:sample.action,before:sample.before,after:sample.after,outcome01:sample.outcome01,verified:sample.verified,contextKey:sample.contextKey};
    episode.steps=[...episode.steps,step].slice(-8);episode.lastAt=sample.at;this.state.lastBehavioralActionByTask[task]=sample.action;
    const maxLen=Math.min(4,episode.steps.length);
    for(const len of [2,3,4].filter(n=>n<=maxLen)){
      const steps=episode.steps.slice(-len),sequence=steps.map(x=>x.action),id=this.sequenceId(sequence);
      let c=this.state.behavioralSequences.find(x=>x.id===id);
      if(!c){c={id,sequence,occurrences:0,successes:0,verified:0,holdoutTrials:0,holdoutSuccesses:0,distinctContexts:0,contextKeys:[],success01:.5,holdout01:.5,retention01:.5,confidence01:.12,transfer01:0,status:'candidate',promotedAt:0,lastAt:0,lastOutcome01:0,lastContext:'',consecutiveFailures:0,delayedSuccesses:0};this.state.behavioralSequences.unshift(c);}
      const outcome=steps.reduce((a,b)=>a+b.outcome01,0)/Math.max(1,steps.length);
      const context=steps.map(x=>x.contextKey).join('::').slice(0,240);
      const seenContext=c.contextKeys.some(k=>k===context);
      const holdout=!seenContext && c.occurrences>0;
      c.occurrences++; if(outcome>=.62)c.successes++; if(steps.every(x=>x.verified))c.verified++;
      if(holdout){c.holdoutTrials++;if(outcome>=.62)c.holdoutSuccesses++;c.holdout01=clamp(c.holdout01*.72+(outcome>=.62?1:0)*.28);}
      if(!seenContext)c.contextKeys=[context,...c.contextKeys].slice(0,16);c.distinctContexts=c.contextKeys.length;
      const gap=sample.at-c.lastAt; if(c.lastAt>0 && gap>=6000 && outcome>=.62)c.delayedSuccesses++;
      c.success01=clamp(c.success01*.84+outcome*.16);c.retention01=clamp(c.retention01*.9+((gap>=6000&&outcome>=.62)?1:(c.lastOutcome01>=.62&&outcome>=.62?.72:.45))*.1);
      c.confidence01=clamp(c.confidence01*.86+Math.min(1,c.occurrences/8)*.08+Math.min(1,c.verified/4)*.06);
      const diversityScore=clamp((c.distinctContexts-1)/5);
      const transferTarget=clamp(diversityScore*.62+outcome*.38);
      c.transfer01=clamp(c.transfer01*.84+transferTarget*.16);
      c.lastOutcome01=outcome;c.lastAt=sample.at;c.lastContext=context;
      if(outcome<.4)c.consecutiveFailures++;else c.consecutiveFailures=0;
      const promotable=c.occurrences>=5&&c.distinctContexts>=3&&c.successes/Math.max(1,c.occurrences)>=.72&&c.verified>=3&&c.holdoutTrials>=2&&c.holdout01>=.62&&c.retention01>=.58&&c.transfer01>=.50;
      if(c.status==='candidate'&&promotable){c.status='promoted';c.promotedAt=sample.at;this.state.behavioralPromotions++;}
      else if(c.status==='promoted'&&c.consecutiveFailures>=2){c.status='blocked';this.state.behavioralBlocks++;this.state.behavioralRollbackSignals++;}
    }
    this.state.behavioralSequences=this.state.behavioralSequences.slice(0,64);
    return this.behavioralSequenceOutcome(task);
  }
  private behavioralSequenceOutcome(taskId:string){
    const episode=this.state.behavioralEpisodes.find(x=>x.taskId===taskId); const seq=episode?.steps.slice(-4).map(x=>x.action)??[];
    return {sequence:seq,observedStates:episode?.steps.slice(-4).map(x=>x.after)??[],promoted:this.state.behavioralSequences.filter(x=>x.status==='promoted').slice(0,8),blocks:this.state.behavioralBlocks};
  }
  behavioralSkillPrior(action:ActionKind,taskId:string,state:OrganismState){
    const target=stateVector(state), task=String(taskId||'general');
    const episode=this.state.behavioralEpisodes.find(x=>x.taskId===task); const recent=episode?.steps.slice(-3).map(x=>x.action)??[];
    const candidates=this.state.behavioralSequences.filter(x=>x.status==='promoted'&&x.sequence.length>=2&&x.occurrences>=5).slice(0,32);
    let bestBias=0,bestConfidence=0,bestSequence:string|null=null;
    for(const c of candidates){
      const prefix=c.sequence.slice(0,-1);if(prefix.length>recent.length)continue;
      const suffix=recent.slice(-prefix.length);if(prefix.some((a,i)=>a!==suffix[i]))continue;
      const prototype=this.state.samples.find(s=>s.action===c.sequence[0]);if(!prototype)continue;
      const sim=1-dist(target,prototype.before);if(sim<.68)continue;
      const q=clamp(.32*c.success01+.24*c.holdout01+.18*c.retention01+.14*c.transfer01+.12*c.confidence01);
      const bias=(c.sequence.at(-1)===action?1:-1)*Math.min(.035,Math.max(0,q-.55)*.08*sim);
      if(Math.abs(bias)>Math.abs(bestBias)){bestBias=bias;bestConfidence=clamp(sim*q);bestSequence=c.id;}
    }
    return {bias01:bestBias,confidence01:bestConfidence,eligible:Boolean(bestSequence),sequenceId:bestSequence};
  }
  behavioralDiagnostics(){return {episodes:this.state.behavioralEpisodes.length,sequences:this.state.behavioralSequences.length,promoted:this.state.behavioralSequences.filter(x=>x.status==='promoted').length,blocked:this.state.behavioralBlocks,rollbackSignals:this.state.behavioralRollbackSignals,transferGain01:this.state.behavioralTransferGain01,top:this.state.behavioralSequences.filter(x=>x.status!=='blocked').slice(0,12).map(x=>({sequence:x.sequence,occurrences:x.occurrences,success01:x.success01,holdout01:x.holdout01,retention01:x.retention01,transfer01:x.transfer01,status:x.status}))};}
  noteBehavioralPrior(result:{bias01:number;eligible:boolean}){if(!result.eligible)return;this.state.behavioralTransferGain01=clamp(this.state.behavioralTransferGain01*.95+Math.max(0,result.bias01)*.4*.05);}

  evaluateHoldout(baseline01:number,post01:number){this.state.holdoutBefore01=clamp(baseline01);this.state.holdoutAfter01=clamp(post01);this.state.holdoutDelta01=post01-baseline01;return {baseline01:this.state.holdoutBefore01,post01:this.state.holdoutAfter01,delta01:this.state.holdoutDelta01};}
  noteTransfer(bias01:number, eligible:boolean){if(!eligible)return;this.state.transferGain01=clamp(this.state.transferGain01*.94+Math.max(0,bias01)*1.8*.06);this.state.lastDecision=bias01>=0?'positive-transfer':'negative-transfer';}
  noteRollback(){this.state.rollbackSignals++;this.state.lastDecision='rollback-signal';}
  diagnostics(){
    return {
      cycles:this.state.cycles, samples:this.state.samples.length,
      worldLearningEvents:this.state.worldLearningEvents, selfLearningEvents:this.state.selfLearningEvents,
      coupledUpdates:this.state.coupledUpdates, verifiedUpdates:this.state.verifiedUpdates,
      meanCausalStrength01:this.state.meanCausalStrength01, meanEvidence01:this.state.meanEvidence01, meanCoupling01:this.state.meanCoupling01,
      holdout:{before01:this.state.holdoutBefore01,after01:this.state.holdoutAfter01,delta01:this.state.holdoutDelta01},
      transferGain01:this.state.transferGain01,
      skillCandidates:this.state.candidates.filter(x=>x.status==='promotable').length,
      skillBlocks:this.state.skillBlocks, rollbackSignals:this.state.rollbackSignals,
      behavioral:this.behavioralDiagnostics(), lastDecision:this.state.lastDecision, lastAt:this.state.lastAt
    };
  }
  actionPrior(action:ActionKind,taskId:string,state:OrganismState){
    const v=stateVector(state), candidates=this.state.samples.filter(s=>s.action===action&&s.taskId!==taskId&&s.evidenceQuality01>=.5).slice(0,32);if(!candidates.length)return {bias01:0,confidence01:0,eligible:false};
    let num=0,den=0;for(const s of candidates){const sim=1-dist(v,s.before);if(sim<.7)continue;const w=sim*(.4+.6*s.evidenceQuality01)*(.5+.5*s.causalStrength01);num+=(s.outcome01-.5)*w;den+=w;}if(!den)return {bias01:0,confidence01:0,eligible:false};
    return {bias01:Math.max(-.028,Math.min(.028,num/den*.08)),confidence01:clamp(den/8),eligible:true};
  }
}
