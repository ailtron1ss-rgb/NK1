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

export interface P26InterleavedExperience {
  state:OrganismState;
  action:ActionKind;
  reward:number;
  nextState:OrganismState;
  surprise?:number;
}

export interface P26InterleavedTrainingOptions {
  replayEveryNCurrent?:number;
  maxReplayUpdates?:number;
  targetMode?:'reward'|'td';
  currentLearningRate01?:number;
  replayLearningRate01?:number;
  conflictCandidateCap?:number;
}

export interface P26InterleavedTrainingResult {
  onlineUpdates:number;
  replayUpdates:number;
  blockedReplayRows:number;
  eligibleReplayRows:number;
  conflictComparisons:number;
  conflictCandidateCap:number;
  /** Actual replay rate after bounding historical influence by replay cadence. */
  effectiveReplayLearningRate01:number;
  meanLoss01:number;
}

function isInterleavedExperience(value:unknown):value is P26InterleavedExperience {
  if(!value || typeof value!=='object') return false;
  const row=value as Record<string,unknown>;
  return !!row.state && typeof row.state==='object' && ACTIONS.includes(row.action as ActionKind) &&
    typeof row.reward==='number' && Number.isFinite(row.reward) && row.reward>=0 && row.reward<=1 &&
    !!row.nextState && typeof row.nextState==='object' &&
    (row.surprise===undefined || (typeof row.surprise==='number' && Number.isFinite(row.surprise) && row.surprise>=0 && row.surprise<=1));
}

function readStateNeed(state:OrganismState,key:string):number {
  const raw=state as unknown as {needs?:Record<string,unknown>};
  const value=raw.needs?.[key];
  return typeof value==='number' && Number.isFinite(value) ? clamp(value) : .5;
}

function stateContextVector(state:OrganismState):number[] {
  const raw=state as unknown as Record<string,unknown>;
  const read=(key:string)=>typeof raw[key]==='number' && Number.isFinite(raw[key]) ? clamp(raw[key] as number) : .5;
  return [
    readStateNeed(state,'energy'),
    readStateNeed(state,'novelty'),
    readStateNeed(state,'uncertainty'),
    readStateNeed(state,'cognitiveLoad'),
    readStateNeed(state,'socialNeed'),
    readStateNeed(state,'identityCoherence'),
    readStateNeed(state,'goalPressure'),
    read('predictionError'),
    read('attentionBudget'),
    read('autonomyScore'),
    read('selfPredictionError'),
    read('lastPredictionConfidence'),
  ];
}

function stateContextDistance(a:OrganismState,b:OrganismState):number {
  const left=a as unknown as Record<string,unknown>;
  const right=b as unknown as Record<string,unknown>;
  if(typeof left.worldContextVersion==='number' && typeof right.worldContextVersion==='number' &&
     left.worldContextVersion!==right.worldContextVersion) return 1;
  const av=stateContextVector(a),bv=stateContextVector(b);
  return Math.max(...av.map((value,index)=>Math.abs(value-(bv[index]??value))));
}

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
  /**
   * Train on new outcomes while selectively rehearsing historical rows.
   * Replay is rejected when a nearby same-action state carries a contradictory
   * reward; the search is context-aware and bounded to prevent quadratic scans.
   */
  trainInterleaved(
    currentExperiences:P26InterleavedExperience[],
    replayExperiences:P26InterleavedExperience[],
    options:P26InterleavedTrainingOptions={},
    extras?:BodyExtras,
  ):P26InterleavedTrainingResult {
    if(!Array.isArray(currentExperiences) || !Array.isArray(replayExperiences)) {
      throw new TypeError('interleaved learning expects current and replay arrays');
    }
    for(const row of currentExperiences) if(!isInterleavedExperience(row)) {
      throw new TypeError('interleaved current experience is malformed');
    }
    for(const row of replayExperiences) if(!isInterleavedExperience(row)) {
      throw new TypeError('interleaved replay experience is malformed');
    }
    const targetMode=options.targetMode??'td';
    if(targetMode!=='reward' && targetMode!=='td') throw new TypeError('interleaved target mode must be reward or td');
    const replayEveryNCurrent=Number.isSafeInteger(options.replayEveryNCurrent)
      ? Math.max(1,Math.min(4096,options.replayEveryNCurrent!)) : 8;
    const maxReplayUpdates=Number.isSafeInteger(options.maxReplayUpdates)
      ? Math.max(0,Math.min(10000,options.maxReplayUpdates!)) : 64;
    const candidateCap=Number.isSafeInteger(options.conflictCandidateCap)
      ? Math.max(1,Math.min(128,options.conflictCandidateCap!)) : 64;
    const currentLearningRate01=Number.isFinite(options.currentLearningRate01)
      ? clamp(options.currentLearningRate01!) : .05;
    const replayLearningRate01=Number.isFinite(options.replayLearningRate01)
      ? clamp(options.replayLearningRate01!) : .035;
    // If the caller requests a lower per-sample historical rate than the
    // current rate, dense cadence can still make its aggregate weight dominate.
    // Bound that case to 10% of the current step per replay stride. An equal or
    // higher configured replay rate is an explicit balanced-retention choice.
    const effectiveReplayLearningRate01 = replayLearningRate01 < currentLearningRate01
      ? Math.min(replayLearningRate01, currentLearningRate01 * 0.1 * replayEveryNCurrent)
      : replayLearningRate01;

    const candidatesByActionAndEnergy=new Map<string,P26InterleavedExperience[]>();
    const energyBucket=(state:OrganismState)=>Math.round(readStateNeed(state,'energy')*20);
    for(const row of currentExperiences) {
      const key=`${row.action}|${energyBucket(row.state)}`;
      const bucket=candidatesByActionAndEnergy.get(key)??[];
      bucket.push(row);
      candidatesByActionAndEnergy.set(key,bucket);
    }

    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0;
    let onlineLoss=0,replayLoss=0,replayCursor=0;
    const targetFor=(row:P26InterleavedExperience)=>{
      if(targetMode==='reward') return clamp(row.reward);
      const next=Math.max(...this.learner.predict(row.nextState,extras).map(p=>p.value),.5);
      return clamp(row.reward+.78*next);
    };
    const conflictsWithCurrent=(historical:P26InterleavedExperience)=>{
      let compared=0;
      const center=energyBucket(historical.state);
      let conflict=false;
      search: for(let offset=-2;offset<=2;offset+=1) {
        const candidates=candidatesByActionAndEnergy.get(`${historical.action}|${center+offset}`)??[];
        for(const current of candidates) {
          if(compared>=candidateCap) break search;
          compared++;
          if(Math.abs(current.reward-historical.reward)>=.5 &&
             stateContextDistance(current.state,historical.state)<=.35) {
            conflict=true;
            break search;
          }
        }
      }
      conflictComparisons+=compared;
      return conflict;
    };

    for(let index=0;index<currentExperiences.length;index+=1) {
      const current=currentExperiences[index];
      const trained=this.learner.train({
        state:current.state,action:current.action,target01:targetFor(current),
        learningRate01:currentLearningRate01,extras,
      });
      onlineUpdates+=1;
      onlineLoss+=trained.loss01;

      // maxReplayUpdates counts successful historical optimizer steps only.
      // A rejected conflict cannot spend the budget or starve later valid rows.
      if(!replayExperiences.length || (index+1)%replayEveryNCurrent!==0 ||
         replayUpdates>=maxReplayUpdates) continue;
      const historical=replayExperiences[replayCursor%replayExperiences.length];
      replayCursor+=1;
      if(conflictsWithCurrent(historical)) {
        blockedReplayRows+=1;
        continue;
      }
      eligibleReplayRows+=1;
      const replayResult=this.learner.train({
        state:historical.state,action:historical.action,target01:targetFor(historical),
        learningRate01:effectiveReplayLearningRate01,extras,
      });
      replayUpdates+=1;
      replayLoss+=replayResult.loss01;
    }

    this.state.metrics.outcomeSamples+=onlineUpdates;
    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    const total=onlineUpdates+replayUpdates;
    if(total>0) {
      this.state.metrics.recentLoss01=clamp((onlineLoss+replayLoss)/total);
      this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));
      this.state.metrics.lastUpdatedAt=Date.now();
      this.sync();
    }
    return {
      onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,
      conflictComparisons,conflictCandidateCap:candidateCap,
      effectiveReplayLearningRate01,
      meanLoss01:total?(onlineLoss+replayLoss)/total:0,
    };
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
