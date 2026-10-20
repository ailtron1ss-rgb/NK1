import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import { ParametricPolicyLearner, defaultParametricPolicy, type ParametricPolicyState } from './ParametricPolicyLearner.ts';
import { selectCausalReplayBatch } from './CausalReplaySampler.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
// Rewards and values share [0,1]; normalize the Bellman mixture instead of clipping
// reward + gamma * next-value, which otherwise pushes low-reward targets toward 0.5.
const tdTarget01=(reward:number,nextValue:number,gamma=.78)=>clamp((clamp(reward)+gamma*clamp(nextValue))/(1+gamma));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P26LearningMetrics {
  outcomeSamples:number;
  onlineUpdates:number;
  replayUpdates:number;
  learningDelta01:number;
  recentLoss01:number;
  generalizationEvidence01:number;
  trainingExposure01:number;
  independentHoldoutSamples:number;
  holdoutBaseline01:number;
  holdoutLearned01:number;
  holdoutDelta01:number;
  lastUpdatedAt:number;
}

export interface P26TrueLearningState {
  version:1;
  policy:ParametricPolicyState;
  metrics:P26LearningMetrics;
  processedTraceIds:string[];
  holdoutEvidenceIds:string[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,trainingExposure01:0,independentHoldoutSamples:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],holdoutEvidenceIds:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    this.state={...d,...(raw??{}),metrics:{...d.metrics,...(raw?.metrics??{})},processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.slice(-4096):[],holdoutEvidenceIds:Array.isArray(raw?.holdoutEvidenceIds)?raw!.holdoutEvidenceIds.map(String).slice(-512):[]};
    this.learner.restore(this.state.policy);
  }
  snapshot():P26TrueLearningState{ this.sync(); return structuredClone(this.state); }
  sync(){ this.state.policy=this.learner.snapshot(); }
  predict(state:OrganismState,extras?:BodyExtras){return this.learner.predict(state,extras);}
  bias(state:OrganismState,action:ActionKind,baseUtility:number,extras?:BodyExtras){
    const p=this.learner.value(state,action,extras);
    if(this.state.policy.updates<3) return 0;
    const confidence=1-p.uncertainty01;
    return Math.max(-0.09,Math.min(0.09,(p.value-baseUtility) * (0.05 + confidence*0.12)));
  }
  observeTrace(trace:OrganismDecisionTrace,stateAfter:OrganismState,input:{success:number;reward:number;surprise:number;sharedLearningSignal01?:number},extras?:BodyExtras){
    if(!trace.selected || this.state.processedTraceIds.includes(trace.id)) return {updated:false,loss01:0};
    const action=trace.selected.action;
    const next=Math.max(...this.learner.predict(stateAfter,extras).map(p=>p.value),0.5);
    const reward=clamp(input.reward);
    const target=tdTarget01(reward,next);
    const shared=clamp(input.sharedLearningSignal01??.5);
    const lr=(.045 + shared*.02) + clamp(input.surprise)*(.03 + shared*.02);
    const r=this.learner.train({state:trace.stateBefore,action,target01:target,learningRate01:lr,extras});
    this.state.metrics.outcomeSamples++;
    this.state.metrics.onlineUpdates++;
    this.state.metrics.learningDelta01=clamp(this.state.metrics.learningDelta01*.97 + (r.predictionAfter-r.predictionBefore)*.03 + Math.abs(r.tdError01)*.02*shared);
    this.state.metrics.recentLoss01=clamp(r.loss01);
    this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));
    this.state.metrics.lastUpdatedAt=Date.now();
    this.state.processedTraceIds=[trace.id,...this.state.processedTraceIds].slice(0,4096);
    this.sync();
    return {updated:true,loss01:r.loss01};
  }
  replay(experiences:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,extras?:BodyExtras){
    let updates=0,loss=0;
    for(const e of experiences){
      const next=Math.max(...this.learner.predict(e.nextState,extras).map(x=>x.value),.5);
      const target=tdTarget01(e.reward,next);
      const r=this.learner.train({state:e.state,action:e.action,target01:target,learningRate01:.10+clamp(e.surprise??.2)*.06,extras});
      updates++; loss+=r.loss01;
    }
    this.state.metrics.replayUpdates+=updates;
    if(updates){this.state.metrics.recentLoss01=clamp(loss/updates);this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));this.state.metrics.lastUpdatedAt=Date.now();}
    this.sync();
    return {updates,meanLoss01:updates?loss/updates:0};
  }
  /**
   * Interleave fresh outcomes with bounded rehearsal. Near-identical states whose
   * verified rewards strongly disagree are treated as a distribution-shift conflict:
   * replay is blocked for those records so stale outcomes cannot dominate plasticity.
   * Without an explicit context signal, conflicting labels are not jointly learnable.
   */
  trainInterleaved(
    current:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    replayRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{replayEveryNCurrent?:number;maxReplayUpdates?:number;targetMode?:'td'|'reward';conflictDistance01?:number;conflictRewardGap01?:number;conflictCandidateCap?:number;currentLearningRate01?:number;replayLearningRate01?:number}={},
    extras?:BodyExtras,
  ){
    const stride=Math.max(1,Math.min(32,Math.floor(options.replayEveryNCurrent??4)));
    const replayCap=Math.max(0,Math.min(4096,Math.floor(options.maxReplayUpdates??1024)));
    if(!current.length)return {onlineUpdates:0,replayUpdates:0,blockedReplayRows:0,eligibleReplayRows:0,conflictComparisons:0,conflictCandidateCap:64,meanLoss01:0};
    const conflictDistance=Math.max(0,Math.min(.2,options.conflictDistance01??.035));
    const conflictRewardGap=Math.max(.1,Math.min(1,options.conflictRewardGap01??.45));
    // Bound the conflict preflight: large streams must not create an O(replay × current)
    // latency spike. Evenly spaced representatives make the approximation deterministic.
    const conflictCandidateCap=Math.max(8,Math.min(128,Math.floor(options.conflictCandidateCap??64)));
    const vector=(e:{state:OrganismState;action:ActionKind})=>this.learner.features(e.state,extras,e.action);
    const distance=(a:number[],b:number[])=>Math.sqrt(a.reduce((sum,value,i)=>sum+(value-(b[i]??0))**2,0)/Math.max(1,a.length));
    const freshByAction=new Map<ActionKind,Array<{row:typeof current[number];features:number[]}>>();
    for(const row of current){const group=freshByAction.get(row.action)??[];group.push({row,features:vector(row)});freshByAction.set(row.action,group);}
    const eligible:Array<{row:typeof replayRows[number];features:number[]}> = [];
    let blockedReplayRows=0,conflictComparisons=0;
    for(const row of replayRows){
      const features=vector(row), candidates=freshByAction.get(row.action)??[];
      let nearestDistance=Number.POSITIVE_INFINITY,nearestReward:number|undefined;
      const sampleCount=Math.min(candidates.length,conflictCandidateCap);
      for(let sample=0;sample<sampleCount;sample++){
        const index=sampleCount===candidates.length?sample:Math.floor(sample*(candidates.length-1)/Math.max(1,sampleCount-1));
        const candidate=candidates[index];
        if(!candidate)continue;
        conflictComparisons++;
        const d=distance(features,candidate.features);
        if(d<nearestDistance){nearestDistance=d;nearestReward=candidate.row.reward;}
      }
      const conflicts=nearestReward!==undefined&&nearestDistance<=conflictDistance&&Math.abs(clamp(row.reward)-clamp(nearestReward))>=conflictRewardGap;
      if(conflicts)blockedReplayRows++;else eligible.push({row,features});
    }
    let onlineUpdates=0,replayUpdates=0,loss=0,replayCursor=eligible.length?this.learner.snapshot().updates%eligible.length:0;
    const update=(e:{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number},isReplay:boolean)=>{
      const next=Math.max(...this.learner.predict(e.nextState,extras).map(x=>x.value),.5);
      const target=options.targetMode==='reward'?clamp(e.reward):tdTarget01(e.reward,next);
      const surprise=clamp(e.surprise??.2);
      const configured=isReplay?options.replayLearningRate01:options.currentLearningRate01;
      const learningRate01=configured===undefined?(isReplay ? (0.012+surprise*0.018) : (0.045+surprise*0.04)):Math.max(.003,Math.min(.30,configured));
      const result=this.learner.train({state:e.state,action:e.action,target01:target,learningRate01,extras});
      loss+=result.loss01;
      if(isReplay)replayUpdates++;else onlineUpdates++;
    };
    for(let i=0;i<current.length;i++){
      update(current[i],false);
      if((i+1)%stride===0&&replayUpdates<replayCap&&eligible.length){
        update(eligible[replayCursor%eligible.length].row,true);
        replayCursor++;
      }
    }
    this.state.metrics.outcomeSamples+=onlineUpdates;
    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    this.state.metrics.recentLoss01=clamp(loss/Math.max(1,onlineUpdates+replayUpdates));
    this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));
    this.state.metrics.lastUpdatedAt=Date.now();
    this.sync();
    return {onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows:eligible.length,conflictComparisons,conflictCandidateCap,meanLoss01:loss/Math.max(1,onlineUpdates+replayUpdates)};
  }

  replayCausalRecords(records:Array<{id?:string;tick?:number;taskId?:string;action:ActionKind;reward01:number;success01:number;surprise01:number;causalStrength01?:number;learningQuality01?:number;policyFeatures01?:number[];replayPriority01?:number}>){
    // Runtime and benchmark share the same bounded, deterministic sampler.
    // The holdout below remains an in-batch diagnostic, not an independent task holdout.
    const usable=selectCausalReplayBatch(records,{maxBatchSize:32,recentQuota:8});
    if(!usable.length)return {updates:0,meanLoss01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,holdoutEvidenceGrade:'insufficient' as const};
    const holdout=usable.filter((_,i)=>(i+1)%4===0),train=usable.filter((_,i)=>(i+1)%4!==0);
    const score=(rows:typeof usable)=>rows.length?rows.reduce((sum,r)=>sum+this.learner.predictFromFeatures(r.policyFeatures01!,r.action),0)/rows.length:0;
    const baseline=score(holdout); let loss=0;
    for(const r of train){
      const next=Math.max(...this.learner.actionList().map(a=>this.learner.predictFromFeatures(r.policyFeatures01!,a)),.5);
      const target=tdTarget01(r.reward01,next); const priority=clamp(r.replayPriority01??(.24*r.surprise01+.20*clamp(r.causalStrength01??.5)+.56*(r.learningQuality01??.5))); const weight=clamp((r.learningQuality01??.5)*(.45+.35*clamp(r.causalStrength01??.5)+.20*priority));
      loss+=this.learner.trainFeatures({features:r.policyFeatures01!,action:r.action,target01:target,learningRate01:.022+clamp(r.surprise01)*.028+priority*.018,sampleWeight01:weight}).loss01;
    }
    const learned=score(holdout); this.state.metrics.replayUpdates+=train.length; this.state.metrics.recentLoss01=clamp(train.length?loss/train.length:0);
    // Do not promote generalizationEvidence01 from a same-call split: records may have
    // influenced online training or earlier replay. This score is diagnostic only.
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline,holdoutEvidenceGrade:'in-batch-diagnostic' as const};
  }

  /** Diagnostic only: this legacy API carries no independent verifier provenance. */
  recordHoldout(baseline01:number,learned01:number){
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;this.sync();
    return this.state.metrics.holdoutDelta01;
  }

  /** Register evidence from a frozen, independently verified task holdout.
   * Training exposure and same-batch diagnostics must never count as generalization evidence.
   */
  recordVerifiedHoldout(input:{
    evidenceId:string;taskId:string;protocolId:string;verifierId:string;sampleSetHash:string;
    baseline01:number;learned01:number;verified:boolean;independent:boolean;
  }){
    const fields=[input.evidenceId,input.taskId,input.protocolId,input.verifierId,input.sampleSetHash].map(x=>String(x??'').trim());
    if(fields.some(x=>!x)||!input.verified||!input.independent)return {accepted:false,reason:'missing-independent-verifier-provenance',generalizationEvidence01:this.state.metrics.generalizationEvidence01};
    const evidenceId=fields.join('|').slice(0,512);
    if(this.state.holdoutEvidenceIds.includes(evidenceId))return {accepted:false,reason:'duplicate-holdout-evidence',generalizationEvidence01:this.state.metrics.generalizationEvidence01};
    this.state.holdoutEvidenceIds=[...this.state.holdoutEvidenceIds,evidenceId].slice(-512);
    this.state.metrics.independentHoldoutSamples++;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,this.state.metrics.independentHoldoutSamples/20));
    this.state.metrics.holdoutBaseline01=clamp(input.baseline01);
    this.state.metrics.holdoutLearned01=clamp(input.learned01);
    this.state.metrics.holdoutDelta01=this.state.metrics.holdoutLearned01-this.state.metrics.holdoutBaseline01;
    this.state.metrics.lastUpdatedAt=Date.now();this.sync();
    return {accepted:true,reason:'independent-verified-holdout',generalizationEvidence01:this.state.metrics.generalizationEvidence01};
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
