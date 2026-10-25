import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import { ParametricPolicyLearner, defaultParametricPolicy, type ParametricPolicyState } from './ParametricPolicyLearner.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const nonEmptyText=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const isHoldoutEvidenceShape=(value:unknown):value is P26VerifiedHoldoutEvidence=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  return nonEmptyText(row.evidenceId)&&row.evidenceId.length<=256&&nonEmptyText(row.taskId)&&row.taskId.length<=256&&
    nonEmptyText(row.protocolId)&&row.protocolId.length<=256&&nonEmptyText(row.verifierId)&&row.verifierId.length<=256&&
    nonEmptyText(row.sampleSetHash)&&row.sampleSetHash.length<=512&&typeof row.baseline01==='number'&&Number.isFinite(row.baseline01)&&row.baseline01>=0&&row.baseline01<=1&&
    typeof row.learned01==='number'&&Number.isFinite(row.learned01)&&row.learned01>=0&&row.learned01<=1&&typeof row.verified==='boolean'&&typeof row.independent==='boolean';
};
const isAcceptedHoldoutEvidence=(value:unknown):value is P26VerifiedHoldoutEvidence=>isHoldoutEvidenceShape(value)&&value.verified===true&&value.independent===true;
export type P26HoldoutEvidenceVerifier=(evidence:Readonly<P26VerifiedHoldoutEvidence>)=>boolean;
const isVerifiedBy=(verifier:P26HoldoutEvidenceVerifier,evidence:unknown):evidence is P26VerifiedHoldoutEvidence=>{
  if(!isAcceptedHoldoutEvidence(evidence))return false;
  try{return verifier(structuredClone(evidence))===true;}catch{return false;}
};

export interface P26LearningMetrics {
  outcomeSamples:number;
  onlineUpdates:number;
  replayUpdates:number;
  learningDelta01:number;
  recentLoss01:number;
  generalizationEvidence01:number;
  holdoutBaseline01:number;
  holdoutLearned01:number;
  holdoutDelta01:number;
  lastUpdatedAt:number;
  trainingExposure01:number;
  independentHoldoutSamples:number;
}

export interface P26VerifiedHoldoutEvidence {
  evidenceId:string; taskId:string; protocolId:string; verifierId:string; sampleSetHash:string;
  baseline01:number; learned01:number; verified:boolean; independent:boolean;
}

export interface P26TrueLearningState {
  version:1;
  policy:ParametricPolicyState;
  metrics:P26LearningMetrics;
  processedTraceIds:string[];
  verifiedHoldoutEvidence:P26VerifiedHoldoutEvidence[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0,trainingExposure01:0,independentHoldoutSamples:0},
  processedTraceIds:[],
  verifiedHoldoutEvidence:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  private readonly verifyHoldoutEvidence:P26HoldoutEvidenceVerifier;
  constructor(verifyHoldoutEvidence:P26HoldoutEvidenceVerifier=()=>false){this.verifyHoldoutEvidence=verifyHoldoutEvidence;}
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const rows=Array.isArray(raw?.verifiedHoldoutEvidence)?raw!.verifiedHoldoutEvidence.filter(item=>isVerifiedBy(this.verifyHoldoutEvidence,item)).slice(-4096):[];
    const uniqueEvidence=[...new Map(rows.map(item=>[item.evidenceId,item])).values()];
    this.state={...d,...(raw??{}),metrics:{...d.metrics,...(raw?.metrics??{})},processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.filter((id):id is string=>typeof id==='string'&&id.trim().length>0).slice(-4096):[],verifiedHoldoutEvidence:uniqueEvidence};
    this.learner.restore(this.state.policy);
    this.refreshEvidenceMetrics();
    this.refreshTrainingExposure();
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
    const target=clamp(reward + 0.78*next);
    const shared=clamp(input.sharedLearningSignal01??.5);
    const lr=(.045 + shared*.02) + clamp(input.surprise)*(.03 + shared*.02);
    const r=this.learner.train({state:trace.stateBefore,action,target01:target,learningRate01:lr,extras});
    this.state.metrics.outcomeSamples++;
    this.state.metrics.onlineUpdates++;
    this.state.metrics.learningDelta01=clamp(this.state.metrics.learningDelta01*.97 + (r.predictionAfter-r.predictionBefore)*.03 + Math.abs(r.tdError01)*.02*shared);
    this.state.metrics.recentLoss01=clamp(r.loss01);
    this.state.metrics.lastUpdatedAt=Date.now();
    this.state.processedTraceIds=[trace.id,...this.state.processedTraceIds].slice(0,4096);
    this.sync();
    this.refreshTrainingExposure();
    return {updated:true,loss01:r.loss01};
  }
  replay(experiences:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,extras?:BodyExtras){
    let updates=0,loss=0;
    for(const e of experiences){
      const next=Math.max(...this.learner.predict(e.nextState,extras).map(x=>x.value),.5);
      const target=clamp(e.reward+.78*next);
      const r=this.learner.train({state:e.state,action:e.action,target01:target,learningRate01:.035+clamp(e.surprise??.2)*.03,extras});
      updates++; loss+=r.loss01;
    }
    this.state.metrics.replayUpdates+=updates;
    if(updates){this.state.metrics.recentLoss01=clamp(loss/updates);this.state.metrics.lastUpdatedAt=Date.now();}
    this.sync();
    this.refreshTrainingExposure();
    return {updates,meanLoss01:updates?loss/updates:0};
  }
  trainInterleaved(
    current:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    historical:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{
      replayEveryNCurrent?:number;maxReplayUpdates?:number;targetMode?:'reward'|'td';
      currentLearningRate01?:number;replayLearningRate01?:number;
      conflictCandidateCap?:number;stateSimilarity01?:number;conflictingRewardDelta01?:number;
    }={},
  ):{
    onlineUpdates:number;replayUpdates:number;blockedReplayRows:number;eligibleReplayRows:number;
    conflictComparisons:number;conflictCandidateCap:number;
  }{
    const invalidRows=(rows:unknown):boolean=>!Array.isArray(rows)||rows.some(value=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return true;
      const row=value as Record<string,unknown>;
      return !row.state||typeof row.state!=='object'||!row.nextState||typeof row.nextState!=='object'||
        !ACTIONS.includes(row.action as ActionKind)||typeof row.reward!=='number'||!Number.isFinite(row.reward)||row.reward<0||row.reward>1||
        (row.surprise!==undefined&&(typeof row.surprise!=='number'||!Number.isFinite(row.surprise)));
    });
    if(invalidRows(current)||invalidRows(historical))throw new Error('p26-interleaved-replay-input-invalid');
    const replayEveryNCurrent=options.replayEveryNCurrent??16;
    const maxReplayUpdates=options.maxReplayUpdates??128;
    const targetMode=options.targetMode??'td';
    const currentLearningRate01=options.currentLearningRate01??.12;
    const replayLearningRate01=options.replayLearningRate01??.035;
    const conflictCandidateCap=options.conflictCandidateCap??64;
    const stateSimilarity01=options.stateSimilarity01??.08;
    const conflictingRewardDelta01=options.conflictingRewardDelta01??.25;
    if(!Number.isSafeInteger(replayEveryNCurrent)||replayEveryNCurrent<1||
       !Number.isSafeInteger(maxReplayUpdates)||maxReplayUpdates<0||
       !['reward','td'].includes(targetMode)||
       !Number.isFinite(currentLearningRate01)||currentLearningRate01<=0||currentLearningRate01>1||
       !Number.isFinite(replayLearningRate01)||replayLearningRate01<=0||replayLearningRate01>1||
       !Number.isSafeInteger(conflictCandidateCap)||conflictCandidateCap<8||conflictCandidateCap>128||
       !Number.isFinite(stateSimilarity01)||stateSimilarity01<0||stateSimilarity01>1||
       !Number.isFinite(conflictingRewardDelta01)||conflictingRewardDelta01<0||conflictingRewardDelta01>1){
      throw new Error('p26-interleaved-replay-options-invalid');
    }
    const features=(state:OrganismState)=>this.learner.features(state);
    const currentByAction=new Map<ActionKind,Array<{row:typeof current[number];features:number[]}>>();
    for(const row of current){
      const bucket=currentByAction.get(row.action)??[];
      bucket.push({row,features:features(row.state)});
      currentByAction.set(row.action,bucket);
    }
    const screenedCurrentByAction=new Map<ActionKind,Array<{row:typeof current[number];features:number[]}>>();
    for(const [action,bucket] of currentByAction){
      if(bucket.length<=conflictCandidateCap){screenedCurrentByAction.set(action,bucket);continue;}
      const sampled:Array<{row:typeof current[number];features:number[]}>=[];
      for(let i=0;i<conflictCandidateCap;i++)sampled.push(bucket[Math.floor(i*bucket.length/conflictCandidateCap)]);
      screenedCurrentByAction.set(action,sampled);
    }
    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0;
    let replayCursor=0,loss=0,lossCount=0;
    const targetFor=(row:typeof current[number]):number=>{
      if(targetMode==='reward')return clamp(row.reward);
      const next=Math.max(.5,...this.learner.predict(row.nextState).map(prediction=>prediction.value));
      return clamp(row.reward+.78*next);
    };
    for(let i=0;i<current.length;i++){
      const row=current[i];
      const trained=this.learner.train({state:row.state,action:row.action,target01:targetFor(row),learningRate01:currentLearningRate01});
      onlineUpdates++;loss+=trained.loss01;lossCount++;
      if(!historical.length||maxReplayUpdates===0||(i+1)%replayEveryNCurrent!==0||replayUpdates>=maxReplayUpdates)continue;
      const past=historical[replayCursor%historical.length];replayCursor++;
      const candidates=screenedCurrentByAction.get(past.action)??[];
      const pastFeatures=features(past.state);
      let conflict=false;
      for(const candidate of candidates){
        conflictComparisons++;
        let distance=0;
        for(let k=0;k<Math.min(pastFeatures.length,candidate.features.length);k++){
          distance=Math.max(distance,Math.abs(pastFeatures[k]-candidate.features[k]));
          if(distance>stateSimilarity01)break;
        }
        if(distance<=stateSimilarity01&&Math.abs(past.reward-candidate.row.reward)>=conflictingRewardDelta01){
          conflict=true;break;
        }
      }
      if(conflict){blockedReplayRows++;continue;}
      eligibleReplayRows++;
      const replayed=this.learner.train({state:past.state,action:past.action,target01:targetFor(past),learningRate01:replayLearningRate01});
      replayUpdates++;loss+=replayed.loss01;lossCount++;
    }
    this.state.metrics.outcomeSamples+=onlineUpdates;
    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    if(lossCount){this.state.metrics.recentLoss01=clamp(loss/lossCount);this.state.metrics.lastUpdatedAt=Date.now();}
    this.sync();this.refreshTrainingExposure();
    return {onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons,conflictCandidateCap};
  }

  replayCausalRecords(records:Array<{action:ActionKind;reward01:number;success01:number;surprise01:number;causalStrength01?:number;learningQuality01?:number;policyFeatures01?:number[];replayPriority01?:number}>){
    const usable=records.filter(r=>Array.isArray(r.policyFeatures01)&&r.policyFeatures01.length>=16).slice(0,32);
    if(!usable.length)return {updates:0,meanLoss01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0};
    const holdout=usable.filter((_,i)=>(i+1)%4===0),train=usable.filter((_,i)=>(i+1)%4!==0);
    const score=(rows:typeof usable)=>rows.length?rows.reduce((sum,r)=>sum+this.learner.predictFromFeatures(r.policyFeatures01!,r.action),0)/rows.length:0;
    const baseline=score(holdout); let loss=0;
    for(const r of train){
      const next=Math.max(...this.learner.actionList().map(a=>this.learner.predictFromFeatures(r.policyFeatures01!,a)),.5);
      const target=clamp(r.reward01+.78*next); const priority=clamp(r.replayPriority01??(.24*r.surprise01+.20*clamp(r.causalStrength01??.5)+.56*(r.learningQuality01??.5))); const weight=clamp((r.learningQuality01??.5)*(.45+.35*clamp(r.causalStrength01??.5)+.20*priority));
      loss+=this.learner.trainFeatures({features:r.policyFeatures01!,action:r.action,target01:target,learningRate01:.022+clamp(r.surprise01)*.028+priority*.018,sampleWeight01:weight}).loss01;
    }
    const learned=score(holdout); this.state.metrics.replayUpdates+=train.length; this.state.metrics.recentLoss01=clamp(train.length?loss/train.length:0);
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync(); this.refreshTrainingExposure();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  recordHoldout(baseline01:number,learned01:number){
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;this.sync();
    // This legacy diagnostic alone does not contribute generalization maturity.
    return this.state.metrics.holdoutDelta01;
  }
  recordVerifiedHoldout(evidence:P26VerifiedHoldoutEvidence):{accepted:boolean;reason?:string}{
    if(!isHoldoutEvidenceShape(evidence))return {accepted:false,reason:'invalid-holdout-evidence'};
    if(evidence.verified!==true)return {accepted:false,reason:'holdout-evidence-not-verified'};
    if(evidence.independent!==true)return {accepted:false,reason:'holdout-evidence-not-independent'};
    if(!isVerifiedBy(this.verifyHoldoutEvidence,evidence))return {accepted:false,reason:'holdout-evidence-not-authenticated'};
    if(this.state.verifiedHoldoutEvidence.some(item=>item.evidenceId===evidence.evidenceId))return {accepted:false,reason:'duplicate-holdout-evidence'};
    this.state.verifiedHoldoutEvidence=[...this.state.verifiedHoldoutEvidence,structuredClone(evidence)].slice(-4096);
    this.state.metrics.holdoutBaseline01=clamp(evidence.baseline01);this.state.metrics.holdoutLearned01=clamp(evidence.learned01);this.state.metrics.holdoutDelta01=evidence.learned01-evidence.baseline01;
    this.refreshEvidenceMetrics();this.sync();return {accepted:true};
  }
  private refreshEvidenceMetrics():void{
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidence.length;
    this.state.metrics.generalizationEvidence01=clamp(this.state.verifiedHoldoutEvidence.length*.05);
  }
  private refreshTrainingExposure():void{
    const updates=Math.max(0,this.state.metrics.onlineUpdates)+Math.max(0,this.state.metrics.replayUpdates);
    this.state.metrics.trainingExposure01=clamp(updates/160);
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
