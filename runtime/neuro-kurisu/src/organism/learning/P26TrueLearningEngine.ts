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
  trainingExposure01:number;
  generalizationEvidence01:number;
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
  /** Recent unique authenticated holdout evidence IDs, persisted for replay-safe deduplication. */
  verifiedHoldoutEvidenceIds:string[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,learningDelta01:0,recentLoss01:0,trainingExposure01:0,generalizationEvidence01:0,independentHoldoutSamples:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],
  verifiedHoldoutEvidenceIds:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const evidenceIds=Array.isArray(raw?.verifiedHoldoutEvidenceIds)
      ? [...new Set(raw!.verifiedHoldoutEvidenceIds.filter((id):id is string=>typeof id==='string'&&id.trim().length>0))].slice(-4096)
      : [];
    const processedTraceIds=Array.isArray(raw?.processedTraceIds)
      ? [...new Set(raw!.processedTraceIds.filter((id):id is string=>typeof id==='string'&&id.trim().length>0))].slice(-4096)
      : [];
    this.state={
      ...d,
      ...(raw??{}),
      metrics:{...d.metrics,...(raw?.metrics??{})},
      processedTraceIds,
      verifiedHoldoutEvidenceIds:evidenceIds,
    };
    // Restored metrics are untrusted input: never let NaN/Infinity poison telemetry.
    for(const key of ['outcomeSamples','onlineUpdates','replayUpdates','independentHoldoutSamples'] as const){
      const value=this.state.metrics[key];
      this.state.metrics[key]=Number.isSafeInteger(value)&&value>=0?value:0;
    }
    for(const key of ['learningDelta01','recentLoss01','trainingExposure01','generalizationEvidence01','holdoutBaseline01','holdoutLearned01'] as const){
      const value=this.state.metrics[key];
      this.state.metrics[key]=typeof value==='number'&&Number.isFinite(value)?clamp(value):0;
    }
    this.state.metrics.holdoutDelta01=typeof this.state.metrics.holdoutDelta01==='number'&&Number.isFinite(this.state.metrics.holdoutDelta01)?this.state.metrics.holdoutDelta01:0;
    this.state.metrics.lastUpdatedAt=typeof this.state.metrics.lastUpdatedAt==='number'&&Number.isFinite(this.state.metrics.lastUpdatedAt)&&this.state.metrics.lastUpdatedAt>=0?this.state.metrics.lastUpdatedAt:0;
    this.learner.restore(this.state.policy);
    this.state.policy=this.learner.snapshot();
    // Training exposure measures updates only; generalization requires unique,
    // authenticated, independent holdout evidence and survives restore by ID.
    this.state.metrics.trainingExposure01=clamp(Math.min(1,this.state.policy.updates/160));
    this.state.metrics.independentHoldoutSamples=evidenceIds.length;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,evidenceIds.length/20));
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
      const target=clamp(e.reward+.78*next);
      const r=this.learner.train({state:e.state,action:e.action,target01:target,learningRate01:.035+clamp(e.surprise??.2)*.03,extras});
      updates++; loss+=r.loss01;
    }
    this.state.metrics.replayUpdates+=updates;
    if(updates){this.state.metrics.recentLoss01=clamp(loss/updates);this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));this.state.metrics.lastUpdatedAt=Date.now();}
    this.sync();
    return {updates,meanLoss01:updates?loss/updates:0};
  }
  /**
   * Train current experience while selectively rehearsing historical rows.
   * Historical labels are screened against bounded same-action current examples;
   * a near-identical context with a contradictory reward blocks the old row.
   * This is a synthetic replay mechanism, not independent holdout evidence.
   */
  trainInterleaved(
    current:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    historical:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{replayEveryNCurrent?:number;maxReplayUpdates?:number;targetMode?:'reward'|'td';currentLearningRate01?:number;replayLearningRate01?:number;conflictCandidateCap?:number}={}
  ){
    if(!Array.isArray(current)||!Array.isArray(historical)) throw new TypeError('interleaved-experience-must-be-arrays');
    const every=Number.isSafeInteger(options.replayEveryNCurrent)&&Number(options.replayEveryNCurrent)>0
      ?Math.min(4096,Number(options.replayEveryNCurrent)):16;
    const maxAttempts=options.maxReplayUpdates===undefined?160
      :(Number.isSafeInteger(options.maxReplayUpdates)&&options.maxReplayUpdates>=0?Math.min(4096,options.maxReplayUpdates):0);
    const candidateCap=options.conflictCandidateCap===undefined?64
      :(Number.isSafeInteger(options.conflictCandidateCap)?Math.max(8,Math.min(128,options.conflictCandidateCap)):64);
    const currentRate=options.currentLearningRate01??.18;
    const replayRate=options.replayLearningRate01??.045;
    if(!Number.isFinite(currentRate)||currentRate<=0||currentRate>1) throw new RangeError('current-learning-rate-out-of-range');
    if(!Number.isFinite(replayRate)||replayRate<=0||replayRate>1) throw new RangeError('replay-learning-rate-out-of-range');
    const targetMode=options.targetMode??'td';
    const validRow=(row:unknown):row is {state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}=>{
      if(!row||typeof row!=='object')return false;
      const r=row as any;
      return Boolean(r.state&&typeof r.state==='object'&&r.nextState&&typeof r.nextState==='object'
        &&ACTIONS.includes(r.action)&&typeof r.reward==='number'&&Number.isFinite(r.reward)
        &&(r.surprise===undefined||(typeof r.surprise==='number'&&Number.isFinite(r.surprise))));
    };
    if(!current.every(validRow)||!historical.every(validRow))throw new TypeError('interleaved-experience-row-invalid');
    const targetFor=(row:{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number})=>{
      if(targetMode==='reward')return clamp(row.reward);
      const next=Math.max(...this.learner.predict(row.nextState).map(p=>p.value),.5);
      return clamp(row.reward+.78*next);
    };
    const byAction=new Map<ActionKind,Array<{features:number[];reward:number}>>();
    for(const row of current){
      const list=byAction.get(row.action)??[];
      list.push({features:this.learner.features(row.state,undefined,row.action),reward:clamp(row.reward)});
      byAction.set(row.action,list);
    }
    const conflictsWithCurrent=(prior:typeof historical[number])=>{
      const candidates=byAction.get(prior.action)??[];
      if(!candidates.length)return false;
      const priorFeatures=this.learner.features(prior.state,undefined,prior.action);
      const checks=Math.min(candidateCap,candidates.length);
      for(let j=0;j<checks;j++){
        const idx=checks===1?0:Math.floor(j*(candidates.length-1)/(checks-1));
        const fresh=candidates[idx];
        let maxDistance=0;
        for(let k=0;k<Math.min(priorFeatures.length,fresh.features.length);k++)
          maxDistance=Math.max(maxDistance,Math.abs(priorFeatures[k]-fresh.features[k]));
        // Nearby states with contradictory targets indicate stale replay, while
        // explicitly separated novelty/context lanes remain eligible for rehearsal.
        if(maxDistance<=.22&&Math.abs(clamp(prior.reward)-fresh.reward)>=.30)return true;
      }
      return false;
    };
    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0,attempts=0,totalLoss=0;
    let replayCursor=0;
    for(let i=0;i<current.length;i++){
      const row=current[i];
      const trained=this.learner.train({state:row.state,action:row.action,target01:targetFor(row),learningRate01:currentRate});
      onlineUpdates++;totalLoss+=trained.loss01;
      if((i+1)%every!==0||attempts>=maxAttempts||!historical.length)continue;
      const prior=historical[replayCursor%historical.length];replayCursor++;attempts++;
      const candidates=byAction.get(prior.action)??[];
      conflictComparisons+=Math.min(candidateCap,candidates.length);
      if(conflictsWithCurrent(prior)){blockedReplayRows++;continue;}
      eligibleReplayRows++;
      const replayed=this.learner.train({state:prior.state,action:prior.action,target01:targetFor(prior),learningRate01:replayRate});
      replayUpdates++;totalLoss+=replayed.loss01;
    }
    this.state.metrics.outcomeSamples+=onlineUpdates;
    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    const totalUpdates=onlineUpdates+replayUpdates;
    if(totalUpdates){
      this.state.metrics.recentLoss01=clamp(totalLoss/totalUpdates);
      this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));
      this.state.metrics.lastUpdatedAt=Date.now();
    }
    this.sync();
    return {onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons,conflictCandidateCap:candidateCap,meanLoss01:totalUpdates?totalLoss/totalUpdates:0};
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
    this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));
    // These in-memory split rows are useful diagnostics, not independent verified evidence.
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  recordVerifiedHoldout(evidence:{
    evidenceId:string;taskId:string;protocolId:string;verifierId:string;sampleSetHash:string;
    baseline01:number;learned01:number;verified:boolean;independent:boolean;
  }):{accepted:boolean;reason?:string}{
    if(!evidence||typeof evidence!=='object')return {accepted:false,reason:'invalid-holdout-evidence'};
    if(evidence.verified!==true)return {accepted:false,reason:'holdout-evidence-not-verified'};
    if(evidence.independent!==true)return {accepted:false,reason:'holdout-evidence-not-independent'};
    for(const key of ['evidenceId','taskId','protocolId','verifierId','sampleSetHash'] as const){
      if(typeof evidence[key]!=='string'||!evidence[key].trim())return {accepted:false,reason:'holdout-evidence-identity-invalid'};
    }
    for(const key of ['baseline01','learned01'] as const){
      const value=evidence[key];
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)return {accepted:false,reason:'holdout-score-out-of-range'};
    }
    if(this.state.verifiedHoldoutEvidenceIds.includes(evidence.evidenceId))return {accepted:false,reason:'duplicate-holdout-evidence'};
    this.state.verifiedHoldoutEvidenceIds=[evidence.evidenceId,...this.state.verifiedHoldoutEvidenceIds].slice(0,4096);
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidenceIds.length;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,this.state.metrics.independentHoldoutSamples/20));
    this.state.metrics.holdoutBaseline01=evidence.baseline01;
    this.state.metrics.holdoutLearned01=evidence.learned01;
    this.state.metrics.holdoutDelta01=evidence.learned01-evidence.baseline01;
    this.state.metrics.lastUpdatedAt=Date.now();
    this.sync();
    return {accepted:true};
  }

  recordHoldout(baseline01:number,learned01:number){
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;this.sync();
    return this.state.metrics.holdoutDelta01;
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
