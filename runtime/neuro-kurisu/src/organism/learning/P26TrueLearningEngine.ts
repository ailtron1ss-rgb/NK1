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

export interface P26TrueLearningState {
  version:1;
  policy:ParametricPolicyState;
  metrics:P26LearningMetrics;
  processedTraceIds:string[];
  verifiedHoldoutEvidenceIds:string[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,trainingExposure01:0,independentHoldoutSamples:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],verifiedHoldoutEvidenceIds:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const ids=Array.isArray(raw?.verifiedHoldoutEvidenceIds)
      ? [...new Set(raw!.verifiedHoldoutEvidenceIds.filter(id=>typeof id==='string'&&id.trim().length>0&&id.length<=180))].slice(0,2048)
      : [];
    const safeCount=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,1_000_000):0;
    const metrics={...d.metrics,...(raw?.metrics??{})};
    metrics.onlineUpdates=safeCount(metrics.onlineUpdates);
    metrics.replayUpdates=safeCount(metrics.replayUpdates);
    metrics.independentHoldoutSamples=ids.length;
    metrics.generalizationEvidence01=clamp(Math.min(1,ids.length*.05));
    metrics.trainingExposure01=clamp((metrics.onlineUpdates+metrics.replayUpdates)/160);
    this.state={...d,...(raw??{}),metrics,processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.filter(id=>typeof id==='string').slice(0,4096):[],verifiedHoldoutEvidenceIds:ids};
    this.learner.restore(this.state.policy);
    this.sync();
  }
  snapshot():P26TrueLearningState{ this.sync(); return structuredClone(this.state); }
  sync(){ this.state.policy=this.learner.snapshot(); this.state.metrics.trainingExposure01=clamp((this.state.metrics.onlineUpdates+this.state.metrics.replayUpdates)/160); }
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
    return {updates,meanLoss01:updates?loss/updates:0};
  }
  /**
   * Bounded online/replay interleaving with same-context contradiction screening.
   * Replay labels that contradict recent feedback for near-identical states are
   * quarantined for this cycle rather than allowed to overwrite fresh learning.
   */
  trainInterleaved(
    currentRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    replayRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{
      replayEveryNCurrent:number;
      maxReplayUpdates:number;
      targetMode:'reward'|'td';
      currentLearningRate01:number;
      replayLearningRate01?:number;
      conflictCandidateCap?:number;
    },
  ):{
    onlineUpdates:number;replayUpdates:number;blockedReplayRows:number;eligibleReplayRows:number;
    conflictComparisons:number;conflictCandidateCap:number;
  }{
    if(!Array.isArray(currentRows)||!Array.isArray(replayRows))throw new Error('interleaved-rows-must-be-arrays');
    if(!options||!Number.isSafeInteger(options.replayEveryNCurrent)||options.replayEveryNCurrent<1)throw new Error('replay-interval-invalid');
    if(!Number.isSafeInteger(options.maxReplayUpdates)||options.maxReplayUpdates<0)throw new Error('replay-update-limit-invalid');
    if(options.targetMode!=='reward'&&options.targetMode!=='td')throw new Error('interleaved-target-mode-invalid');
    const validRate=(rate:unknown)=>typeof rate==='number'&&Number.isFinite(rate)&&rate>=0&&rate<=1;
    if(!validRate(options.currentLearningRate01))throw new Error('current-learning-rate-invalid');
    const replayRate=options.replayLearningRate01??.035;
    if(!validRate(replayRate))throw new Error('replay-learning-rate-invalid');
    const conflictCandidateCap=Math.max(8,Math.min(128,Math.floor(options.conflictCandidateCap??64)));
    const validState=(state:OrganismState)=>{
      if(!state||typeof state!=='object'||!state.needs||typeof state.needs!=='object')throw new Error('interleaved-state-invalid');
      const needs=state.needs;
      const values=[needs.energy,needs.cognitiveLoad,needs.uncertainty,needs.socialNeed,needs.novelty,
        needs.identityCoherence,needs.goalPressure,state.predictionError,state.attentionBudget,
        state.selfPredictionError,state.autonomyScore,state.lastPredictionConfidence];
      if(values.some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0||value>1))throw new Error('interleaved-state-invalid');
    };
    const validRows=(rows:typeof currentRows)=>{
      for(const row of rows){
        if(!row||typeof row!=='object'||!ACTIONS.includes(row.action)||
          typeof row.reward!=='number'||!Number.isFinite(row.reward)||row.reward<0||row.reward>1||
          (row.surprise!==undefined&&(typeof row.surprise!=='number'||!Number.isFinite(row.surprise)||row.surprise<0||row.surprise>1))){
          throw new Error('interleaved-row-invalid');
        }
        validState(row.state);
        validState(row.nextState);
      }
    };
    // Validate the whole input before the first update so malformed later rows
    // cannot leave a partially-mutated policy snapshot behind.
    validRows(currentRows);
    validRows(replayRows);
    const stateFeatures=new Map<OrganismState,number[]>();
    const features=(state:OrganismState)=>{
      let value=stateFeatures.get(state);
      if(!value){value=this.learner.features(state);stateFeatures.set(state,value);}
      return value;
    };
    const closeState=(a:OrganismState,b:OrganismState)=>{
      const x=features(a),y=features(b),n=Math.min(x.length,y.length);
      if(!n||x.length!==y.length)return false;
      let square=0;
      for(let i=0;i<n;i++)square+=(x[i]!-y[i]!)**2;
      return Math.sqrt(square/n)<=.065;
    };
    const targetFor=(row:typeof currentRows[number])=>{
      if(options.targetMode==='reward')return row.reward;
      const next=Math.max(.5,...this.learner.predict(row.nextState).map(prediction=>prediction.value));
      return clamp(row.reward+.78*next);
    };
    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0,lossTotal=0;
    let replayCursor=0;
    for(let index=0;index<currentRows.length;index++){
      const row=currentRows[index]!;
      const current=this.learner.train({
        state:row.state,action:row.action,target01:targetFor(row),
        learningRate01:options.currentLearningRate01,
      });
      onlineUpdates++;
      lossTotal+=current.loss01;
      this.state.metrics.outcomeSamples++;
      this.state.metrics.onlineUpdates++;
      this.state.metrics.learningDelta01=clamp(
        this.state.metrics.learningDelta01*.97+(current.predictionAfter-current.predictionBefore)*.03+
        Math.abs(current.tdError01)*.02,
      );
      this.state.metrics.recentLoss01=clamp(current.loss01);
      this.state.metrics.lastUpdatedAt=Date.now();

      if(!replayRows.length||replayUpdates>=options.maxReplayUpdates||(index+1)%options.replayEveryNCurrent!==0)continue;
      const replay=replayRows[replayCursor++%replayRows.length]!;
      let conflict=false;
      const start=Math.max(0,index-conflictCandidateCap+1);
      for(let candidateIndex=start;candidateIndex<=index;candidateIndex++){
        const fresh=currentRows[candidateIndex]!;
        conflictComparisons++;
        if(fresh.action===replay.action&&Math.abs(fresh.reward-replay.reward)>=.35&&closeState(fresh.state,replay.state)){
          conflict=true;
          break;
        }
      }
      if(conflict){
        blockedReplayRows++;
        continue;
      }
      eligibleReplayRows++;
      const replayResult=this.learner.train({
        state:replay.state,action:replay.action,target01:targetFor(replay),
        learningRate01:replayRate,
      });
      replayUpdates++;
      lossTotal+=replayResult.loss01;
    }
    this.state.metrics.replayUpdates+=replayUpdates;
    if(onlineUpdates+replayUpdates){
      this.state.metrics.recentLoss01=clamp(lossTotal/(onlineUpdates+replayUpdates));
      this.state.metrics.lastUpdatedAt=Date.now();
    }
    this.sync();
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
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  recordHoldout(baseline01:number,learned01:number){
    // Diagnostic-only legacy path: aggregate scores without independent provenance
    // must never advance the generalization maturity signal.
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;this.sync();
    return this.state.metrics.holdoutDelta01;
  }
  recordVerifiedHoldout(evidence:{
    evidenceId:string;taskId:string;protocolId:string;verifierId:string;sampleSetHash:string;
    baseline01:number;learned01:number;verified:boolean;independent:boolean;
  }):{accepted:boolean;reason?:string}{
    if(!evidence||typeof evidence!=='object')return {accepted:false,reason:'malformed-holdout-evidence'};
    const identity=[evidence.evidenceId,evidence.taskId,evidence.protocolId,evidence.verifierId,evidence.sampleSetHash];
    if(identity.some(value=>typeof value!=='string'||value.trim().length===0||value.length>512)||
      !Number.isFinite(evidence.baseline01)||!Number.isFinite(evidence.learned01)||
      evidence.baseline01<0||evidence.baseline01>1||evidence.learned01<0||evidence.learned01>1){
      return {accepted:false,reason:'malformed-holdout-evidence'};
    }
    if(evidence.verified!==true||evidence.independent!==true)return {accepted:false,reason:'holdout-evidence-not-verified-and-independent'};
    if(this.state.verifiedHoldoutEvidenceIds.includes(evidence.evidenceId))return {accepted:false,reason:'duplicate-holdout-evidence'};
    this.state.verifiedHoldoutEvidenceIds=[evidence.evidenceId,...this.state.verifiedHoldoutEvidenceIds].slice(0,2048);
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidenceIds.length;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,this.state.metrics.independentHoldoutSamples*.05));
    this.state.metrics.holdoutBaseline01=evidence.baseline01;
    this.state.metrics.holdoutLearned01=evidence.learned01;
    this.state.metrics.holdoutDelta01=evidence.learned01-evidence.baseline01;
    this.state.metrics.lastUpdatedAt=Date.now();
    this.sync();
    return {accepted:true};
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{this.sync();return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
