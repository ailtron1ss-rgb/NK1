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

  trainInterleaved(
    currentRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    replayRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{
      replayEveryNCurrent?:number;
      maxReplayUpdates?:number;
      targetMode?:'reward'|'td';
      currentLearningRate01?:number;
      replayLearningRate01?:number;
      conflictCandidateCap?:number;
      contextSimilarityThreshold01?:number;
      conflictTargetMargin01?:number;
      extras?:BodyExtras;
    }={},
  ):{
    onlineUpdates:number;
    replayUpdates:number;
    blockedReplayRows:number;
    eligibleReplayRows:number;
    conflictComparisons:number;
    conflictCandidateCap:number;
  }{
    if(!Array.isArray(currentRows)||!Array.isArray(replayRows)) throw new TypeError('interleaved-experiences-must-be-arrays');
    const replayEveryNCurrent=options.replayEveryNCurrent??8;
    const maxReplayUpdates=options.maxReplayUpdates??128;
    const conflictCandidateCap=options.conflictCandidateCap??64;
    const targetMode=options.targetMode??'td';
    const currentLearningRate01=options.currentLearningRate01??.06;
    const replayLearningRate01=options.replayLearningRate01??.035;
    const contextSimilarityThreshold01=options.contextSimilarityThreshold01??.12;
    const conflictTargetMargin01=options.conflictTargetMargin01??.25;
    if(!Number.isSafeInteger(replayEveryNCurrent)||replayEveryNCurrent<1) throw new RangeError('replay-stride-must-be-positive-integer');
    if(!Number.isSafeInteger(maxReplayUpdates)||maxReplayUpdates<0) throw new RangeError('max-replay-updates-must-be-nonnegative-integer');
    if(!Number.isSafeInteger(conflictCandidateCap)||conflictCandidateCap<8||conflictCandidateCap>128) throw new RangeError('conflict-candidate-cap-out-of-range');
    if(targetMode!=='reward'&&targetMode!=='td') throw new RangeError('invalid-interleaved-target-mode');
    for(const [name,value] of [
      ['current-learning-rate',currentLearningRate01],
      ['replay-learning-rate',replayLearningRate01],
      ['context-similarity-threshold',contextSimilarityThreshold01],
      ['conflict-target-margin',conflictTargetMargin01],
    ] as const){
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1) throw new RangeError(name+'-out-of-range');
    }

    type Experience=typeof currentRows[number];
    type IndexedExperience={row:Experience;features:number[];energyBin:number;noveltyBin:number};
    const bucketWidth=.16;
    const bin=(value:number)=>Math.floor(clamp(value)/bucketWidth);
    const byActionAndContext=new Map<string,IndexedExperience[]>();
    const contextKey=(action:ActionKind,energyBin:number,noveltyBin:number)=>action+'|'+energyBin+'|'+noveltyBin;
    const validateRows=(rows:Experience[],name:string):IndexedExperience[]=>{
      const indexed:IndexedExperience[]=[];
      for(let index=0;index<rows.length;index++){
        const row=rows[index];
        if(!row||typeof row!=='object') throw new TypeError(name+'['+index+']-must-be-object');
        if(!ACTIONS.includes(row.action)) throw new RangeError(name+'['+index+']-invalid-action');
        if(typeof row.reward!=='number'||!Number.isFinite(row.reward)||row.reward<0||row.reward>1) throw new RangeError(name+'['+index+']-reward-out-of-range');
        if(row.surprise!==undefined&&(typeof row.surprise!=='number'||!Number.isFinite(row.surprise)||row.surprise<0||row.surprise>1)) throw new RangeError(name+'['+index+']-surprise-out-of-range');
        const features=this.learner.features(row.state,options.extras,row.action);
        if(targetMode==='td') this.learner.features(row.nextState,options.extras);
        const energy=Number(row.state.needs.energy),novelty=Number(row.state.needs.novelty);
        if(!Number.isFinite(energy)||!Number.isFinite(novelty)) throw new RangeError(name+'['+index+']-context-features-must-be-finite');
        indexed.push({row,features,energyBin:bin(energy),noveltyBin:bin(novelty)});
      }
      return indexed;
    };

    // Preflight the whole batch before any weight changes. A malformed late row
    // cannot leave the learner partially updated.
    const indexedCurrent=validateRows(currentRows,'current');
    const indexedReplay=validateRows(replayRows,'replay');
    for(const item of indexedCurrent){
      const key=contextKey(item.row.action,item.energyBin,item.noveltyBin);
      const bucket=byActionAndContext.get(key)??[];
      bucket.push(item);
      byActionAndContext.set(key,bucket);
    }

    const blockedReplay=new Set<number>();
    const eligibleReplay:Experience[]=[];
    let conflictComparisons=0;
    const featureDimensions=[0,1,2,3,4,5,6,7,8,9,10,11,12,13];
    for(let replayIndex=0;replayIndex<indexedReplay.length;replayIndex++){
      const historical=indexedReplay[replayIndex];
      const localCandidates:IndexedExperience[]=[];
      for(let energyOffset=-1;energyOffset<=1;energyOffset++){
        for(let noveltyOffset=-1;noveltyOffset<=1;noveltyOffset++){
          const bucket=byActionAndContext.get(contextKey(
            historical.row.action,
            historical.energyBin+energyOffset,
            historical.noveltyBin+noveltyOffset,
          ));
          if(bucket) localCandidates.push(...bucket);
        }
      }
      // Evenly sample a deterministic shortlist when a cell contains many rows.
      // This bounds comparisons independently of the history-buffer size.
      const candidates=localCandidates.length<=conflictCandidateCap
        ? localCandidates
        : Array.from({length:conflictCandidateCap},(_,i)=>localCandidates[Math.floor(i*localCandidates.length/conflictCandidateCap)]);
      let conflict=false;
      for(const candidate of candidates){
        conflictComparisons++;
        let maxDifference=0;
        for(const dimension of featureDimensions){
          maxDifference=Math.max(maxDifference,Math.abs((historical.features[dimension]??0)-(candidate.features[dimension]??0)));
        }
        if(maxDifference>contextSimilarityThreshold01) continue;
        if(Math.abs(historical.row.reward-candidate.row.reward)>=conflictTargetMargin01){
          conflict=true;
          break;
        }
      }
      if(conflict) blockedReplay.add(replayIndex);
      else eligibleReplay.push(historical.row);
    }

    const learningEnabled=!this.learner.snapshot().frozen;
    // When replay is intentionally much slower than current learning, a dense
    // schedule can still accumulate too much historical influence. Scale that
    // lower replay rate for short strides, but preserve equal-rate rehearsal where
    // both separated contexts need comparable reinforcement.
    const replayRateIsMateriallyLower=replayLearningRate01<currentLearningRate01*.5;
    const replayFrequencyScale=replayRateIsMateriallyLower?Math.min(1,replayEveryNCurrent/4):1;
    const effectiveReplayLearningRate01=replayLearningRate01*replayFrequencyScale;
    let onlineUpdates=0,replayUpdates=0,lossSum=0;
    let eligibleCursor=0;
    const trainOne=(row:Experience,learningRate01:number)=>{
      const tdTarget=targetMode==='reward'
        ? clamp(row.reward)
        : clamp(row.reward+.78*Math.max(...this.learner.predict(row.nextState,options.extras).map(prediction=>prediction.value),.5));
      const result=this.learner.train({
        state:row.state,action:row.action,target01:tdTarget,learningRate01,extras:options.extras,
      });
      lossSum+=result.loss01;
      return result;
    };
    for(let index=0;index<indexedCurrent.length;index++){
      trainOne(indexedCurrent[index].row,currentLearningRate01);
      if(learningEnabled) onlineUpdates++;
      if((index+1)%replayEveryNCurrent!==0||replayUpdates>=maxReplayUpdates||!eligibleReplay.length) continue;
      const row=eligibleReplay[eligibleCursor%eligibleReplay.length];
      eligibleCursor++;
      trainOne(row,effectiveReplayLearningRate01);
      if(learningEnabled) replayUpdates++;
    }

    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    this.state.metrics.outcomeSamples+=onlineUpdates;
    if(onlineUpdates+replayUpdates>0){
      this.state.metrics.recentLoss01=clamp(lossSum/(onlineUpdates+replayUpdates));
      this.state.metrics.trainingExposure01=clamp(Math.min(1,this.learner.snapshot().updates/160));
      this.state.metrics.lastUpdatedAt=Date.now();
    }
    this.sync();
    return {
      onlineUpdates,replayUpdates,blockedReplayRows:blockedReplay.size,
      eligibleReplayRows:eligibleReplay.length,conflictComparisons,conflictCandidateCap,
    };
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
