import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import { ParametricPolicyLearner, defaultParametricPolicy, type ParametricPolicyState } from './ParametricPolicyLearner.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P26LearningMetrics {
  outcomeSamples:number;
  onlineUpdates:number;
  replayUpdates:number;
  learningDelta01:number;
  recentLoss01:number;
  /** Exposure is a normalized count of actual online/replay training updates, not evidence of generalization. */
  trainingExposure01:number;
  /** Number of unique independently verified holdout evidence identities accepted. */
  independentHoldoutSamples:number;
  generalizationEvidence01:number;
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
  /** Deduplication identities for accepted independent holdout evidence. */
  verifiedHoldoutEvidenceIds:string[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,learningDelta01:0,recentLoss01:0,trainingExposure01:0,independentHoldoutSamples:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],
  verifiedHoldoutEvidenceIds:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const sourceMetrics:Partial<P26LearningMetrics>=raw?.metrics??{};
    const safeCounter=(value:unknown):number=>
      typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
    const verifiedHoldoutEvidenceIds=Array.isArray(raw?.verifiedHoldoutEvidenceIds)
      ? [...new Set(raw!.verifiedHoldoutEvidenceIds.filter((value):value is string=>
          typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&
          !/[\u0000-\u001f\u007f-\u009f]/.test(value)))].slice(-4096)
      : [];
    const onlineUpdates=safeCounter(sourceMetrics.onlineUpdates);
    const replayUpdates=safeCounter(sourceMetrics.replayUpdates);
    const totalTrainingExposure=onlineUpdates+replayUpdates;
    const metrics:P26LearningMetrics={
      ...d.metrics,
      ...sourceMetrics,
      onlineUpdates,
      replayUpdates,
      outcomeSamples:safeCounter(sourceMetrics.outcomeSamples),
      independentHoldoutSamples:verifiedHoldoutEvidenceIds.length,
      trainingExposure01:clamp(totalTrainingExposure/(totalTrainingExposure+64)),
      // Restore this maturity signal from accepted evidence identities, never from
      // a stale scalar or from the number of parameter updates.
      generalizationEvidence01:clamp(verifiedHoldoutEvidenceIds.length*.05),
    };
    this.state={
      ...d,
      ...(raw??{}),
      metrics,
      processedTraceIds:Array.isArray(raw?.processedTraceIds)
        ? raw!.processedTraceIds.filter((value):value is string=>typeof value==='string'&&value.length>0&&value.length<=512).slice(-4096)
        : [],
      verifiedHoldoutEvidenceIds,
    };
    this.learner.restore(this.state.policy);
  }
  snapshot():P26TrueLearningState{ this.sync(); return structuredClone(this.state); }
  sync(){ this.state.policy=this.learner.snapshot(); }
  private refreshTrainingExposure():void{
    const total=this.state.metrics.onlineUpdates+this.state.metrics.replayUpdates;
    this.state.metrics.trainingExposure01=clamp(total/(total+64));
  }
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
    this.refreshTrainingExposure();
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
    if(updates){this.state.metrics.recentLoss01=clamp(loss/updates);this.refreshTrainingExposure();this.state.metrics.lastUpdatedAt=Date.now();}
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
    const learned=score(holdout); this.state.metrics.replayUpdates+=train.length; this.state.metrics.recentLoss01=clamp(train.length?loss/train.length:0);
    this.refreshTrainingExposure();
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  trainInterleaved(
    fresh:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    replayRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{
      replayEveryNCurrent?:number;maxReplayUpdates?:number;targetMode?:'reward'|'td';
      currentLearningRate01?:number;replayLearningRate01?:number;
    }={},
  ):{
    onlineUpdates:number;replayUpdates:number;blockedReplayRows:number;eligibleReplayRows:number;
    conflictComparisons:number;conflictCandidateCap:number;
  }{
    if(!Array.isArray(fresh)||!Array.isArray(replayRows))throw new TypeError('interleaved-experiences-must-be-arrays');
    if(fresh.length>20_000||replayRows.length>20_000)throw new RangeError('interleaved-experience-limit-exceeded');
    const every=options.replayEveryNCurrent??16;
    const maxReplayUpdates=options.maxReplayUpdates??160;
    const mode=options.targetMode??'td';
    const currentRate=options.currentLearningRate01??.06;
    const replayRate=options.replayLearningRate01??.06;
    if(!Number.isSafeInteger(every)||every<1||every>10_000)throw new RangeError('replay-every-n-current-invalid');
    if(!Number.isSafeInteger(maxReplayUpdates)||maxReplayUpdates<0||maxReplayUpdates>100_000)throw new RangeError('max-replay-updates-invalid');
    if(mode!=='reward'&&mode!=='td')throw new TypeError('interleaved-target-mode-invalid');
    for(const [name,rate] of [['current',currentRate],['replay',replayRate]] as const){
      if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||rate>.3)throw new RangeError(name+'-learning-rate-out-of-range');
    }
    const validState=(state:OrganismState):boolean=>{
      if(!state||typeof state!=='object'||!state.needs)return false;
      const values=[state.needs.energy,state.needs.cognitiveLoad,state.needs.uncertainty,state.needs.socialNeed,
        state.needs.novelty,state.needs.identityCoherence,state.needs.goalPressure,state.predictionError,
        state.attentionBudget,state.selfPredictionError];
      return values.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1);
    };
    const validateRows=(rows:typeof fresh):void=>{
      for(const row of rows){
        if(!row||!ACTIONS.includes(row.action)||!validState(row.state)||!validState(row.nextState)||
           typeof row.reward!=='number'||!Number.isFinite(row.reward)||row.reward<0||row.reward>1||
           (row.surprise!==undefined&&(typeof row.surprise!=='number'||!Number.isFinite(row.surprise)||row.surprise<0||row.surprise>1))){
          throw new TypeError('interleaved-experience-invalid');
        }
      }
    };
    // Validate both streams before the first weight change; malformed replay rows
    // must not leave a partially trained current-task policy.
    validateRows(fresh);
    validateRows(replayRows);
    const conflictCandidateCap=Math.min(64,fresh.length);
    const context=(state:OrganismState)=>[
      state.needs.energy,state.needs.cognitiveLoad,state.needs.uncertainty,state.needs.novelty,
      state.needs.socialNeed,state.needs.goalPressure,state.needs.identityCoherence,
    ];
    const freshContexts=fresh.map(row=>({row,features:context(row.state)}));
    const replayContext=(row:typeof replayRows[number])=>context(row.state);
    const nextValue=(row:typeof fresh[number])=>Math.max(.5,...this.learner.predict(row.nextState).map(prediction=>prediction.value));
    const targetFor=(row:typeof fresh[number])=>mode==='reward'?clamp(row.reward):clamp(row.reward+.78*nextValue(row));
    const policyFrozen=this.learner.snapshot().frozen;
    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0;
    let totalLoss=0,candidateIndex=0,attempts=0;
    const isConflicting=(historical:typeof replayRows[number]):boolean=>{
      if(conflictCandidateCap===0)return false;
      const historicalFeatures=replayContext(historical);
      for(let n=0;n<conflictCandidateCap;n++){
        // Evenly spread the bounded candidate sample across the current stream.
        const index=Math.min(freshContexts.length-1,Math.floor(n*freshContexts.length/conflictCandidateCap));
        const current=freshContexts[index];
        conflictComparisons++;
        if(current.row.action!==historical.action)continue;
        const distance=Math.max(...historicalFeatures.map((value,i)=>Math.abs(value-current.features[i])));
        if(distance<=.12&&Math.abs(current.row.reward-historical.reward)>.25)return true;
      }
      return false;
    };
    for(let i=0;i<fresh.length;i++){
      const row=fresh[i];
      const current=this.learner.train({state:row.state,action:row.action,target01:targetFor(row),learningRate01:currentRate});
      totalLoss+=current.loss01;
      if(!policyFrozen){onlineUpdates++;this.state.metrics.onlineUpdates++;}
      if((i+1)%every!==0||!replayRows.length||replayUpdates>=maxReplayUpdates)continue;
      const historical=replayRows[candidateIndex%replayRows.length];
      candidateIndex++;attempts++;
      if(isConflicting(historical)){
        blockedReplayRows++;
        continue;
      }
      eligibleReplayRows++;
      const replayResult=this.learner.train({
        state:historical.state,action:historical.action,target01:targetFor(historical),
        learningRate01:replayRate,
      });
      totalLoss+=replayResult.loss01;
      if(!policyFrozen){replayUpdates++;this.state.metrics.replayUpdates++;}
      if(attempts>=maxReplayUpdates&&replayUpdates<maxReplayUpdates)break;
    }
    const actualUpdates=onlineUpdates+replayUpdates;
    if(actualUpdates){
      this.state.metrics.recentLoss01=clamp(totalLoss/actualUpdates);
      this.refreshTrainingExposure();
      this.state.metrics.lastUpdatedAt=Date.now();
    }
    this.sync();
    return {onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons,conflictCandidateCap};
  }

  recordHoldout(baseline01:number,learned01:number){
    // Legacy score reporting is diagnostic only; it does not establish provenance.
    this.state.metrics.holdoutBaseline01=clamp(baseline01);
    this.state.metrics.holdoutLearned01=clamp(learned01);
    this.state.metrics.holdoutDelta01=learned01-baseline01;
    this.sync();
    return this.state.metrics.holdoutDelta01;
  }

  recordVerifiedHoldout(evidence:{
    evidenceId:string;taskId:string;protocolId:string;verifierId:string;sampleSetHash:string;
    baseline01:number;learned01:number;verified:boolean;independent:boolean;
  }):{accepted:boolean;reason:string}{
    const identityFields=[evidence?.evidenceId,evidence?.taskId,evidence?.protocolId,evidence?.verifierId,evidence?.sampleSetHash];
    const validIdentity=identityFields.every(value=>
      typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&
      !/[\u0000-\u001f\u007f-\u009f]/.test(value));
    const validScores=typeof evidence?.baseline01==='number'&&Number.isFinite(evidence.baseline01)&&evidence.baseline01>=0&&evidence.baseline01<=1&&
      typeof evidence?.learned01==='number'&&Number.isFinite(evidence.learned01)&&evidence.learned01>=0&&evidence.learned01<=1;
    if(!validIdentity||!validScores)return {accepted:false,reason:'invalid-holdout-evidence'};
    if(evidence.verified!==true||evidence.independent!==true)
      return {accepted:false,reason:'holdout-evidence-not-independent-verified'};
    if(this.state.verifiedHoldoutEvidenceIds.includes(evidence.evidenceId))
      return {accepted:false,reason:'duplicate-holdout-evidence'};
    this.state.verifiedHoldoutEvidenceIds=[...this.state.verifiedHoldoutEvidenceIds,evidence.evidenceId].slice(-4096);
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidenceIds.length;
    this.state.metrics.generalizationEvidence01=clamp(this.state.metrics.independentHoldoutSamples*.05);
    this.state.metrics.holdoutBaseline01=evidence.baseline01;
    this.state.metrics.holdoutLearned01=evidence.learned01;
    this.state.metrics.holdoutDelta01=evidence.learned01-evidence.baseline01;
    this.state.metrics.lastUpdatedAt=Date.now();
    this.sync();
    return {accepted:true,reason:'accepted-independent-holdout'};
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
