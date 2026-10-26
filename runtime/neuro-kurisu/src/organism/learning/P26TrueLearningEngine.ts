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
  verifiedHoldoutEvidenceIds:string[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,trainingExposure01:0,independentHoldoutSamples:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],
  verifiedHoldoutEvidenceIds:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export interface P26VerifiedHoldoutEvidence {
  evidenceId:string;
  taskId:string;
  protocolId:string;
  verifierId:string;
  sampleSetHash:string;
  baseline01:number;
  learned01:number;
  verified:boolean;
  independent:boolean;
  at?:number;
}

export interface P26InterleavedRecord {
  state:OrganismState;
  action:ActionKind;
  reward:number;
  nextState?:OrganismState;
  surprise?:number;
}

export interface P26InterleavedOptions {
  replayEveryNCurrent?:number;
  maxReplayUpdates?:number;
  targetMode?:'reward'|'td';
  currentLearningRate01?:number;
  replayLearningRate01?:number;
  conflictCandidateCap?:number;
}

interface PreparedP26InterleavedRecord extends P26InterleavedRecord {
  features:number[];
}

const isPlainRecord=(value:unknown):value is Record<string,unknown> =>
  value!==null&&typeof value==='object'&&!Array.isArray(value);

const ownData=(value:unknown,key:string):unknown=>{
  if(!isPlainRecord(value))return undefined;
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return undefined;
  return descriptor.value;
};

const boundedMetric=(value:unknown,fallback=0):number=>
  typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;

const safeCounter=(value:unknown):number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;

const boundedText=(value:unknown,maxLength:number):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=maxLength&&value===value.trim()&&
  !Array.from(value).some(character=>{
    const code=character.charCodeAt(0);
    return code<32||(code>=127&&code<=159);
  });

const greatestCommonDivisor=(left:number,right:number):number=>{
  let a=Math.abs(Math.trunc(left)),b=Math.abs(Math.trunc(right));
  while(b!==0){const remainder=a%b;a=b;b=remainder;}
  return a;
};

/**
 * Pick a deterministic full-cycle stride so replay does not stay paired with
 * the same current-row index when both batches have the same ordering/length.
 */
const interleavedReplayStride=(length:number):number=>{
  if(length<=1)return 1;
  let stride=Math.max(1,Math.floor(length*0.61803398875));
  while(greatestCommonDivisor(stride,length)!==1){
    stride+=1;
    if(stride>=length)stride=1;
  }
  return stride;
};

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const rawRoot=isPlainRecord(raw)?raw:{};
    const rawMetrics=isPlainRecord(ownData(rawRoot,'metrics'))?ownData(rawRoot,'metrics') as Record<string,unknown>:{};
    const policyRaw=ownData(rawRoot,'policy');
    const traceIdsRaw=ownData(rawRoot,'processedTraceIds');
    const evidenceIdsRaw=ownData(rawRoot,'verifiedHoldoutEvidenceIds');
    const validIds=(value:unknown,max:number):string[]=>{
      if(!Array.isArray(value))return [];
      const seen=new Set<string>(),result:string[]=[];
      for(const item of value){
        if(!boundedText(item,192)||seen.has(item))continue;
        seen.add(item);result.push(item);
      }
      return result.slice(-max);
    };
    const processedTraceIds=validIds(traceIdsRaw,4096);
    const verifiedHoldoutEvidenceIds=validIds(evidenceIdsRaw,4096);
    const metrics:P26LearningMetrics={
      outcomeSamples:safeCounter(ownData(rawMetrics,'outcomeSamples')),
      onlineUpdates:safeCounter(ownData(rawMetrics,'onlineUpdates')),
      replayUpdates:safeCounter(ownData(rawMetrics,'replayUpdates')),
      learningDelta01:boundedMetric(ownData(rawMetrics,'learningDelta01')),
      recentLoss01:boundedMetric(ownData(rawMetrics,'recentLoss01')),
      // A persisted scalar is not evidence provenance. Recomputed below from verified IDs.
      generalizationEvidence01:0,
      trainingExposure01:0,
      independentHoldoutSamples:verifiedHoldoutEvidenceIds.length,
      holdoutBaseline01:boundedMetric(ownData(rawMetrics,'holdoutBaseline01')),
      holdoutLearned01:boundedMetric(ownData(rawMetrics,'holdoutLearned01')),
      holdoutDelta01:typeof ownData(rawMetrics,'holdoutDelta01')==='number'&&Number.isFinite(ownData(rawMetrics,'holdoutDelta01') as number)
        ?Math.max(-1,Math.min(1,ownData(rawMetrics,'holdoutDelta01') as number)):0,
      lastUpdatedAt:typeof ownData(rawMetrics,'lastUpdatedAt')==='number'&&Number.isFinite(ownData(rawMetrics,'lastUpdatedAt') as number)&&
        (ownData(rawMetrics,'lastUpdatedAt') as number)>=0?ownData(rawMetrics,'lastUpdatedAt') as number:0,
    };
    this.state={
      version:1,
      policy:isPlainRecord(policyRaw)?policyRaw as unknown as ParametricPolicyState:d.policy,
      metrics,
      processedTraceIds,
      verifiedHoldoutEvidenceIds,
    };
    this.learner.restore(this.state.policy);
    this.state.policy=this.learner.snapshot();
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidenceIds.length;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,this.state.metrics.independentHoldoutSamples*.05));
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
    this.refreshTrainingExposure();
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
    this.refreshTrainingExposure();
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
    // This within-batch diagnostic is not an independent verification protocol.
    // It must never increase the certified generalization-evidence score.
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now();
    this.refreshTrainingExposure(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  private refreshTrainingExposure(){
    const exposure=this.state.metrics.onlineUpdates+this.state.metrics.replayUpdates;
    this.state.metrics.trainingExposure01=clamp(Math.min(1,exposure/1000));
    this.state.metrics.independentHoldoutSamples=this.state.verifiedHoldoutEvidenceIds.length;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,this.state.metrics.independentHoldoutSamples*.05));
  }

  recordVerifiedHoldout(evidence:P26VerifiedHoldoutEvidence):{
    accepted:boolean;reason?:string;independentHoldoutSamples:number;generalizationEvidence01:number;
  }{
    const reject=(reason:string)=>({
      accepted:false,reason,
      independentHoldoutSamples:this.state.verifiedHoldoutEvidenceIds.length,
      generalizationEvidence01:this.state.metrics.generalizationEvidence01,
    });
    if(!isPlainRecord(evidence))return reject('holdout-evidence-must-be-a-record');
    const fields=['evidenceId','taskId','protocolId','verifierId','sampleSetHash','baseline01','learned01','verified','independent','at'];
    if(fields.some(key=>{
      if(!Object.prototype.hasOwnProperty.call(evidence,key))return key!=='at';
      const d=Object.getOwnPropertyDescriptor(evidence,key);
      return !d||!Object.prototype.hasOwnProperty.call(d,'value');
    }))return reject('holdout-evidence-accessor-or-missing-field');
    const evidenceId=ownData(evidence,'evidenceId');
    const taskId=ownData(evidence,'taskId');
    const protocolId=ownData(evidence,'protocolId');
    const verifierId=ownData(evidence,'verifierId');
    const sampleSetHash=ownData(evidence,'sampleSetHash');
    if(!boundedText(evidenceId,192)||!boundedText(taskId,128)||!boundedText(protocolId,128)||
      !boundedText(verifierId,128)||!boundedText(sampleSetHash,256))return reject('holdout-evidence-identity-invalid');
    if(ownData(evidence,'verified')!==true)return reject('holdout-not-verified');
    if(ownData(evidence,'independent')!==true)return reject('holdout-not-independent');
    const baseline01=ownData(evidence,'baseline01');
    const learned01=ownData(evidence,'learned01');
    if(typeof baseline01!=='number'||!Number.isFinite(baseline01)||baseline01<0||baseline01>1||
      typeof learned01!=='number'||!Number.isFinite(learned01)||learned01<0||learned01>1) {
      return reject('holdout-score-invalid');
    }
    const at=ownData(evidence,'at');
    if(at!==undefined&&(typeof at!=='number'||!Number.isFinite(at)||at<0))return reject('holdout-timestamp-invalid');
    if(this.state.verifiedHoldoutEvidenceIds.includes(evidenceId))return reject('duplicate-holdout-evidence');
    this.state.verifiedHoldoutEvidenceIds=[evidenceId,...this.state.verifiedHoldoutEvidenceIds].slice(0,4096);
    this.state.metrics.holdoutBaseline01=baseline01;
    this.state.metrics.holdoutLearned01=learned01;
    this.state.metrics.holdoutDelta01=learned01-baseline01;
    this.state.metrics.lastUpdatedAt=at===undefined?Date.now():at;
    this.refreshTrainingExposure();
    this.sync();
    return {
      accepted:true,
      independentHoldoutSamples:this.state.metrics.independentHoldoutSamples,
      generalizationEvidence01:this.state.metrics.generalizationEvidence01,
    };
  }

  private assertInterleavedState(value:unknown,label:string){
    if(!isPlainRecord(value))throw new TypeError(label+'-state-must-be-a-record');
    const ownRequired=(record:Record<string,unknown>,key:string)=>{
      const descriptor=Object.getOwnPropertyDescriptor(record,key);
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError(label+'-state-field-invalid:'+key);
      return descriptor.value;
    };
    const needsValue=ownRequired(value,'needs');
    if(!isPlainRecord(needsValue))throw new TypeError(label+'-state-must-have-needs');
    for(const key of ['energy','cognitiveLoad','uncertainty','socialNeed','novelty','identityCoherence','goalPressure']){
      const metric=ownRequired(needsValue,key);
      if(typeof metric!=='number'||!Number.isFinite(metric)||metric<0||metric>1)throw new TypeError(label+'-state-need-invalid:'+key);
    }
    for(const key of ['predictionError','attentionBudget','autonomyScore','selfPredictionError']){
      const metric=ownRequired(value,key);
      if(typeof metric!=='number'||!Number.isFinite(metric)||metric<0||metric>1)throw new TypeError(label+'-state-metric-invalid:'+key);
    }
  }

  private prepareInterleavedRows(rows:P26InterleavedRecord[],label:string):PreparedP26InterleavedRecord[]{
    if(!Array.isArray(rows))throw new TypeError(label+'-rows-must-be-an-array');
    if(rows.length>8192)throw new RangeError(label+'-rows-exceed-budget');
    return rows.map((candidate,index)=>{
      if(!isPlainRecord(candidate))throw new TypeError(label+'-row-must-be-a-record:'+index);
      const read=(key:string):unknown=>{
        const descriptor=Object.getOwnPropertyDescriptor(candidate,key);
        if(!descriptor)return undefined;
        if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError(label+'-row-accessor:'+key);
        return descriptor.value;
      };
      const state=read('state');
      const action=read('action');
      const reward=read('reward');
      const nextState=read('nextState');
      const surprise=read('surprise');
      this.assertInterleavedState(state,label+'-'+index);
      if(typeof action!=='string'||!ACTIONS.includes(action as ActionKind))throw new TypeError(label+'-action-invalid:'+index);
      if(typeof reward!=='number'||!Number.isFinite(reward)||reward<0||reward>1)throw new TypeError(label+'-reward-invalid:'+index);
      if(nextState!==undefined)this.assertInterleavedState(nextState,label+'-next-'+index);
      if(surprise!==undefined&&(typeof surprise!=='number'||!Number.isFinite(surprise)||surprise<0||surprise>1)) {
        throw new TypeError(label+'-surprise-invalid:'+index);
      }
      const stateTyped=state as OrganismState;
      const actionTyped=action as ActionKind;
      const features=this.learner.features(stateTyped,undefined,actionTyped);
      if(!features.every(Number.isFinite))throw new TypeError(label+'-features-not-finite:'+index);
      return {state:stateTyped,action:actionTyped,reward,nextState:nextState as OrganismState|undefined,surprise:surprise as number|undefined,features};
    });
  }

  trainInterleaved(
    currentRows:P26InterleavedRecord[],
    replayRows:P26InterleavedRecord[],
    options:P26InterleavedOptions={},
  ):{
    onlineUpdates:number;replayUpdates:number;blockedReplayRows:number;eligibleReplayRows:number;
    conflictComparisons:number;conflictCandidateCap:number;meanLoss01:number;
  }{
    const replayEvery=options.replayEveryNCurrent??8;
    const maxReplay=options.maxReplayUpdates??256;
    const targetMode=options.targetMode??'td';
    const currentRate=options.currentLearningRate01??.06;
    const replayRate=options.replayLearningRate01??.035;
    const rawCap=options.conflictCandidateCap??64;
    if(!Number.isSafeInteger(replayEvery)||replayEvery<1||replayEvery>128)throw new RangeError('replay-every-current-invalid');
    if(!Number.isSafeInteger(maxReplay)||maxReplay<0||maxReplay>8192)throw new RangeError('max-replay-updates-invalid');
    if(targetMode!=='reward'&&targetMode!=='td')throw new TypeError('interleaved-target-mode-invalid');
    for(const [label,rate] of [['current',currentRate],['replay',replayRate]] as const){
      if(typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>1)throw new RangeError(label+'-learning-rate-must-be-finite-and-in-0-1');
    }
    if(!Number.isSafeInteger(rawCap)||rawCap<1)throw new RangeError('conflict-candidate-cap-invalid');
    const conflictCandidateCap=Math.max(8,Math.min(128,rawCap));
    const current=this.prepareInterleavedRows(currentRows,'current');
    const replay=this.prepareInterleavedRows(replayRows,'replay');
    if(current.length===0)return {onlineUpdates:0,replayUpdates:0,blockedReplayRows:0,eligibleReplayRows:0,conflictComparisons:0,conflictCandidateCap,meanLoss01:0};
    const replayStride=interleavedReplayStride(replay.length);
    // Rotate the permutation between successful batches. Metrics are already
    // canonical and persisted, so no second scheduler state is required.
    const replayOffset=Math.floor(this.state.metrics.onlineUpdates/current.length)%Math.max(1,replay.length);

    // Both sets are fully validated before the model is touched. A runtime failure
    // still rolls back learner weights/counters and learning metrics as one operation.
    this.sync();
    const modelBefore=this.learner.snapshot();
    const stateBefore=structuredClone(this.state);
    const frozen=modelBefore.frozen===true;
    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0,lossTotal=0,lossCount=0;
    const trainOne=(row:PreparedP26InterleavedRecord,rate:number)=>{
      const target=targetMode==='reward'||!row.nextState
        ?row.reward
        :clamp(row.reward+.78*Math.max(...this.learner.predict(row.nextState).map(prediction=>prediction.value),.5));
      const result=this.learner.train({state:row.state,action:row.action,target01:target,learningRate01:rate});
      lossTotal+=result.loss01;lossCount++;
    };
    try{
      for(let i=0;i<current.length;i++){
        // Rehearse before the current observation so the freshest experience has the
        // final gradient in each scheduled slot. This prevents stride=1 replay from
        // systematically overwriting the just-processed current-task update.
        if(replay.length&&maxReplay>0&&(i+1)%replayEvery===0&&replayUpdates<maxReplay){
          const candidateIndex=(replayOffset+i*replayStride)%replay.length;
          const candidate=replay[candidateIndex];
          const startIndex=candidateIndex%current.length;
          let conflict=false;
          const comparisons=Math.min(conflictCandidateCap,current.length);
          for(let offset=0;offset<comparisons;offset++){
            // Deterministically spread the bounded screen across the full current batch;
            // scanning only a contiguous slice can miss a nearby contradictory example.
            const rowIndex=(startIndex+Math.floor(offset*current.length/comparisons))%current.length;
            const row=current[rowIndex];
            conflictComparisons++;
            if(row.action!==candidate.action||Math.abs(row.reward-candidate.reward)<.45)continue;
            let maxFeatureDelta=0;
            for(let k=0;k<Math.min(row.features.length,candidate.features.length)-1;k++){
              maxFeatureDelta=Math.max(maxFeatureDelta,Math.abs(row.features[k]-candidate.features[k]));
              if(maxFeatureDelta>.18)break;
            }
            if(maxFeatureDelta<=.18){conflict=true;break;}
          }
          if(conflict)blockedReplayRows++;
          else {
            eligibleReplayRows++;
            trainOne(candidate,replayRate);
            if(!frozen)replayUpdates++;
          }
        }
        trainOne(current[i],currentRate);
        if(!frozen)onlineUpdates++;
      }
      this.state.metrics.onlineUpdates+=onlineUpdates;
      this.state.metrics.replayUpdates+=replayUpdates;
      this.state.metrics.outcomeSamples+=onlineUpdates;
      if(lossCount)this.state.metrics.recentLoss01=clamp(lossTotal/lossCount);
      if(onlineUpdates||replayUpdates)this.state.metrics.lastUpdatedAt=Date.now();
      this.refreshTrainingExposure();
      this.sync();
      return {onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons,conflictCandidateCap,meanLoss01:lossCount?lossTotal/lossCount:0};
    }catch(error){
      this.learner.restore(modelBefore);
      this.state=stateBefore;
      this.sync();
      throw error;
    }
  }

  recordHoldout(baseline01:number,learned01:number){
    if(typeof baseline01!=='number'||!Number.isFinite(baseline01)||baseline01<0||baseline01>1||
      typeof learned01!=='number'||!Number.isFinite(learned01)||learned01<0||learned01>1) {
      throw new RangeError('holdout-diagnostic-scores-must-be-finite-and-in-0-1');
    }
    this.state.metrics.holdoutBaseline01=baseline01;
    this.state.metrics.holdoutLearned01=learned01;
    this.state.metrics.holdoutDelta01=learned01-baseline01;
    // Diagnostics intentionally do not alter independent generalization evidence.
    this.sync();
    return this.state.metrics.holdoutDelta01;
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
