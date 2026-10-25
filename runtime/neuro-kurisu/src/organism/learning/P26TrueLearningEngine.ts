import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import { ParametricPolicyLearner, defaultParametricPolicy, type ParametricPolicyState } from './ParametricPolicyLearner.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P26LearningMetrics {
  outcomeSamples:number;
  onlineUpdates:number;
  replayUpdates:number;
  trainingExposure01:number;
  independentHoldoutSamples:number;
  learningDelta01:number;
  recentLoss01:number;
  generalizationEvidence01:number;
  holdoutBaseline01:number;
  holdoutLearned01:number;
  holdoutDelta01:number;
  lastUpdatedAt:number;
}

export interface P26VerifiedHoldoutEvidence {
  evidenceId:string;
  taskId:string;
  protocolId:string;
  verifierId:string;
  sampleSetHash:string;
  baseline01:number;
  learned01:number;
}

export interface P26TrueLearningState {
  version:1;
  policy:ParametricPolicyState;
  metrics:P26LearningMetrics;
  processedTraceIds:string[];
  verifiedHoldoutEvidence:P26VerifiedHoldoutEvidence[];
}

const boundedEvidenceId=(value:unknown,max=256):string|null=>{
  if(typeof value!=='string')return null;
  const normalized=value.normalize('NFKC').trim();
  if(!normalized||normalized.length>max||/[\\u0000-\\u001f\\u007f-\\u009f]/.test(normalized))return null;
  return normalized;
};
const isVerifiedHoldoutEvidence=(value:unknown):value is P26VerifiedHoldoutEvidence=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Partial<P26VerifiedHoldoutEvidence>;
  return [row.evidenceId,row.taskId,row.protocolId,row.verifierId,row.sampleSetHash].every(v=>boundedEvidenceId(v)!==null)&&
    [row.baseline01,row.learned01].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1);
};

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,trainingExposure01:0,independentHoldoutSamples:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],
  verifiedHoldoutEvidence:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const verifiedHoldoutEvidence=Array.isArray(raw?.verifiedHoldoutEvidence)
      ? raw!.verifiedHoldoutEvidence.filter(isVerifiedHoldoutEvidence).slice(-4096)
      : [];
    this.state={
      ...d,
      ...(raw??{}),
      metrics:{...d.metrics,...(raw?.metrics??{})},
      processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.slice(-4096):[],
      verifiedHoldoutEvidence,
    };
    this.state.metrics.independentHoldoutSamples=verifiedHoldoutEvidence.length;
    this.state.metrics.generalizationEvidence01=clamp(verifiedHoldoutEvidence.length*.05);
    this.updateTrainingExposure();
    this.learner.restore(this.state.policy);
  }
  private updateTrainingExposure(){
    const exposures=Math.max(0,this.state.metrics.onlineUpdates)+Math.max(0,this.state.metrics.replayUpdates);
    this.state.metrics.trainingExposure01=clamp(1-Math.exp(-exposures/32));
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
    this.updateTrainingExposure();
    this.state.metrics.learningDelta01=clamp(this.state.metrics.learningDelta01*.97 + (r.predictionAfter-r.predictionBefore)*.03 + Math.abs(r.tdError01)*.02*shared);
    this.state.metrics.recentLoss01=clamp(r.loss01);
    this.state.metrics.lastUpdatedAt=Date.now();
    this.state.processedTraceIds=[trace.id,...this.state.processedTraceIds].slice(0,4096);
    this.sync();
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
    if(updates){this.updateTrainingExposure();this.state.metrics.recentLoss01=clamp(loss/updates);this.state.metrics.lastUpdatedAt=Date.now();}
    this.sync();
    return {updates,meanLoss01:updates?loss/updates:0};
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
    const learned=score(holdout); this.state.metrics.replayUpdates+=train.length; this.updateTrainingExposure(); this.state.metrics.recentLoss01=clamp(train.length?loss/train.length:0);
    // A split derived from training records is a diagnostic only. Only the separately
    // verified holdout-recording path may increase generalizationEvidence01.
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  recordHoldout(baseline01:number,learned01:number){
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;this.sync();
    // Legacy unverified diagnostics do not change generalization eligibility.
    return this.state.metrics.holdoutDelta01;
  }
  recordVerifiedHoldout(input:{
    evidenceId:string;taskId:string;protocolId:string;verifierId:string;sampleSetHash:string;
    baseline01:number;learned01:number;verified:boolean;independent:boolean;
  }):{accepted:boolean;reason?:string}{
    if(!input||input.verified!==true)return {accepted:false,reason:'holdout-evidence-not-verified'};
    if(input.independent!==true)return {accepted:false,reason:'holdout-evidence-not-independent'};
    const evidence:P26VerifiedHoldoutEvidence={
      evidenceId:boundedEvidenceId(input.evidenceId)??'',
      taskId:boundedEvidenceId(input.taskId)??'',
      protocolId:boundedEvidenceId(input.protocolId)??'',
      verifierId:boundedEvidenceId(input.verifierId)??'',
      sampleSetHash:boundedEvidenceId(input.sampleSetHash)??'',
      baseline01:input.baseline01,
      learned01:input.learned01,
    };
    if(!isVerifiedHoldoutEvidence(evidence))return {accepted:false,reason:'holdout-evidence-invalid'};
    const prior=this.state.verifiedHoldoutEvidence.find(row=>row.evidenceId===evidence.evidenceId);
    if(prior){
      if(JSON.stringify(prior)!==JSON.stringify(evidence))return {accepted:false,reason:'holdout-evidence-conflict'};
      return {accepted:false,reason:'duplicate-holdout-evidence'};
    }
    this.state.verifiedHoldoutEvidence=[...this.state.verifiedHoldoutEvidence,evidence].slice(-4096);
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidence.length;
    this.state.metrics.generalizationEvidence01=clamp(this.state.metrics.independentHoldoutSamples*.05);
    this.state.metrics.holdoutBaseline01=evidence.baseline01;
    this.state.metrics.holdoutLearned01=evidence.learned01;
    this.state.metrics.holdoutDelta01=evidence.learned01-evidence.baseline01;
    this.state.metrics.lastUpdatedAt=Date.now();
    this.sync();
    return {accepted:true};
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
