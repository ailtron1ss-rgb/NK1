import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import { ParametricPolicyLearner, defaultParametricPolicy, type ParametricPolicyState } from './ParametricPolicyLearner.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P26LearningMetrics {
  outcomeSamples:number;
  onlineUpdates:number;
  replayUpdates:number;
  /** Bounded training exposure; deliberately separate from independently verified generalization. */
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
  verified:boolean;
  independent:boolean;
}

/** Must be supplied by a host-owned verifier; caller flags alone are not authority. */
export type P26HoldoutEvidenceVerifier=(evidence:Readonly<P26VerifiedHoldoutEvidence>)=>boolean;

export interface P26TrueLearningOptions {
  verifyHoldoutEvidence?:P26HoldoutEvidenceVerifier;
}

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
}

export interface P26TrueLearningState {
  version:1;
  policy:ParametricPolicyState;
  metrics:P26LearningMetrics;
  processedTraceIds:string[];
  holdoutEvidence:P26VerifiedHoldoutEvidence[];
}

function normalizeHoldoutEvidence(value:unknown):P26VerifiedHoldoutEvidence|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const raw=value as Record<string,unknown>;
  const text=(item:unknown,max:number):item is string=>
    typeof item==='string'&&item.length>0&&item.length<=max&&item.trim()===item&&
    !Array.from(item).some(character=>{const code=character.codePointAt(0)??0;return code<=0x1f||(code>=0x7f&&code<=0x9f);});
  if(!text(raw.evidenceId,180)||!text(raw.taskId,180)||!text(raw.protocolId,120)||
    !text(raw.verifierId,120)||!text(raw.sampleSetHash,256)||
    typeof raw.baseline01!=='number'||!Number.isFinite(raw.baseline01)||raw.baseline01<0||raw.baseline01>1||
    typeof raw.learned01!=='number'||!Number.isFinite(raw.learned01)||raw.learned01<0||raw.learned01>1||
    typeof raw.verified!=='boolean'||typeof raw.independent!=='boolean')return null;
  return {
    evidenceId:raw.evidenceId,taskId:raw.taskId,protocolId:raw.protocolId,verifierId:raw.verifierId,
    sampleSetHash:raw.sampleSetHash,baseline01:raw.baseline01,learned01:raw.learned01,
    verified:raw.verified,independent:raw.independent,
  };
}

function holdoutIdentity(evidence:P26VerifiedHoldoutEvidence):string {
  return JSON.stringify([evidence.taskId,evidence.protocolId,evidence.verifierId,evidence.sampleSetHash]);
}

function nonNegativeInteger(value:unknown):number {
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,trainingExposure01:0,independentHoldoutSamples:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],holdoutEvidence:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  private readonly verifyHoldoutEvidence:P26HoldoutEvidenceVerifier;

  constructor(options:P26TrueLearningOptions={}) {
    this.verifyHoldoutEvidence=options.verifyHoldoutEvidence??(()=>false);
  }

  private verifierAccepts(evidence:P26VerifiedHoldoutEvidence):boolean {
    if(evidence.verified!==true||evidence.independent!==true)return false;
    try{return this.verifyHoldoutEvidence(structuredClone(evidence))===true;}catch{return false;}
  }

  private updateTrainingExposure():void {
    this.state.metrics.trainingExposure01=clamp(this.learner.snapshot().updates/160);
  }

  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const metrics={...d.metrics,...(raw?.metrics??{})};
    metrics.outcomeSamples=nonNegativeInteger(metrics.outcomeSamples);
    metrics.onlineUpdates=nonNegativeInteger(metrics.onlineUpdates);
    metrics.replayUpdates=nonNegativeInteger(metrics.replayUpdates);
    metrics.trainingExposure01=clamp((metrics.onlineUpdates+metrics.replayUpdates)/160);

    const restoredEvidence:P26VerifiedHoldoutEvidence[]=[];
    const evidenceIds=new Set<string>(),sampleSets=new Set<string>();
    const rows=Array.isArray(raw?.holdoutEvidence)?raw.holdoutEvidence:[];
    for(const candidate of rows.slice(-4096)){
      const evidence=normalizeHoldoutEvidence(candidate);
      if(!evidence||evidenceIds.has(evidence.evidenceId)||sampleSets.has(holdoutIdentity(evidence))||
        !this.verifierAccepts(evidence))continue;
      evidenceIds.add(evidence.evidenceId);
      sampleSets.add(holdoutIdentity(evidence));
      restoredEvidence.push(evidence);
    }
    metrics.independentHoldoutSamples=restoredEvidence.length;
    metrics.generalizationEvidence01=clamp(Math.min(1,restoredEvidence.length/20));
    if(restoredEvidence.length){
      const latest=restoredEvidence[restoredEvidence.length-1]!;
      metrics.holdoutBaseline01=latest.baseline01;
      metrics.holdoutLearned01=latest.learned01;
      metrics.holdoutDelta01=latest.learned01-latest.baseline01;
    }else{
      metrics.independentHoldoutSamples=0;
      metrics.generalizationEvidence01=0;
    }

    this.state={
      ...d,...(raw??{}),metrics,
      processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.filter(id=>typeof id==='string').slice(-4096):[],
      holdoutEvidence:restoredEvidence,
    };
    this.learner.restore(this.state.policy);
    this.sync();
  }
  snapshot():P26TrueLearningState{ this.sync(); return structuredClone(this.state); }
  sync(){
    this.state.policy=this.learner.snapshot();
    this.state.metrics.trainingExposure01=clamp(this.state.policy.updates/160);
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
    this.updateTrainingExposure();
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
    if(updates){this.state.metrics.recentLoss01=clamp(loss/updates);this.updateTrainingExposure();this.state.metrics.lastUpdatedAt=Date.now();}
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
    // A split made from the replay batch is diagnostic only; it is not independent holdout authority.
    this.updateTrainingExposure();
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now(); this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  /**
   * Interleave fresh task experience with a bounded replay queue. Replay is
   * screened against nearby current-state/action labels first: where a fresh
   * outcome contradicts an old label in an indistinguishable state context,
   * stale replay is blocked. Separable contexts remain eligible for rehearsal.
   * The method does not issue generalization evidence; only recordVerifiedHoldout
   * can do that through the explicitly configured host verifier.
   */
  trainInterleaved(
    fresh:readonly P26InterleavedExperience[],
    replayRows:readonly P26InterleavedExperience[],
    options:P26InterleavedTrainingOptions={},
  ):P26InterleavedTrainingResult {
    if(!Array.isArray(fresh)||!Array.isArray(replayRows))throw new TypeError('interleaved-experience-lanes-must-be-arrays');
    const finiteOption=(value:number|undefined,fallback:number,label:string):number=>{
      if(value===undefined)return fallback;
      if(!Number.isFinite(value))throw new TypeError(label+'-must-be-finite');
      return value;
    };
    const replayEveryNCurrent=Math.max(1,Math.min(10000,Math.floor(finiteOption(options.replayEveryNCurrent,16,'replay-every-n-current'))));
    const maxReplayUpdates=Math.max(0,Math.min(100000,Math.floor(finiteOption(options.maxReplayUpdates,64,'max-replay-updates'))));
    const targetMode=options.targetMode??'td';
    if(targetMode!=='reward'&&targetMode!=='td')throw new TypeError('invalid-interleaved-target-mode');
    const currentLearningRate01=finiteOption(options.currentLearningRate01,.035,'current-learning-rate');
    const replayLearningRate01=finiteOption(options.replayLearningRate01,.025,'replay-learning-rate');
    // Bound the replay/current ratio by scheduling at most one replay update
    // per four fresh updates. Keep the configured per-replay learning rate intact:
    // fewer useful rehearsals are preferable to many tiny updates that fail to
    // recover previously learned tasks.
    const effectiveReplayEveryNCurrent=Math.max(4,replayEveryNCurrent);
    const conflictCandidateCap=Math.max(8,Math.min(128,Math.floor(finiteOption(options.conflictCandidateCap,64,'conflict-candidate-cap'))));
    const bucket=(value:number)=>Math.max(0,Math.min(19,Math.floor(clamp(value)*20)));
    const key=(row:P26InterleavedExperience)=>[
      row.action,bucket(row.state.needs.energy),bucket(row.state.needs.novelty),
    ].join('|');
    const validateRows=(rows:readonly P26InterleavedExperience[])=>{
      for(const row of rows){
        if(!row||!row.state||!row.nextState||!ACTIONS.includes(row.action)||
          typeof row.reward!=='number'||!Number.isFinite(row.reward)||row.reward<0||row.reward>1||
          (row.surprise!==undefined&&(typeof row.surprise!=='number'||!Number.isFinite(row.surprise)||row.surprise<0||row.surprise>1))){
          throw new TypeError('interleaved-experience-invalid');
        }
      }
    };
    validateRows(fresh); validateRows(replayRows);
    const index=new Map<string,P26InterleavedExperience[]>();
    for(const row of fresh){
      const bucketKey=key(row),list=index.get(bucketKey)??[];
      list.push(row);index.set(bucketKey,list);
    }
    const conflictsWithFresh=(oldRow:P26InterleavedExperience):boolean=>{
      const energyBucket=bucket(oldRow.state.needs.energy),noveltyBucket=bucket(oldRow.state.needs.novelty);
      const nearby:P26InterleavedExperience[]=[];
      for(let e=-1;e<=1;e++)for(let n=-1;n<=1;n++){
        const energyIndex=energyBucket+e,noveltyIndex=noveltyBucket+n;
        if(energyIndex<0||energyIndex>19||noveltyIndex<0||noveltyIndex>19)continue;
        const rows=index.get([oldRow.action,energyIndex,noveltyIndex].join('|'));
        if(rows)nearby.push(...rows);
      }
      // Sort by the context dimensions that drive the benchmark's old/new task
      // conflict. Inspect no more than the configured number of neighbours.
      nearby.sort((a,b)=>
        Math.abs(a.state.needs.energy-oldRow.state.needs.energy)-
          Math.abs(b.state.needs.energy-oldRow.state.needs.energy) ||
        Math.abs(a.state.needs.novelty-oldRow.state.needs.novelty)-
          Math.abs(b.state.needs.novelty-oldRow.state.needs.novelty));
      for(const current of nearby.slice(0,conflictCandidateCap)){
        comparisons++;
        const energyDistance=Math.abs(current.state.needs.energy-oldRow.state.needs.energy);
        const noveltyDistance=Math.abs(current.state.needs.novelty-oldRow.state.needs.novelty);
        const uncertaintyDistance=Math.abs(current.state.needs.uncertainty-oldRow.state.needs.uncertainty);
        const cognitiveLoadDistance=Math.abs(current.state.needs.cognitiveLoad-oldRow.state.needs.cognitiveLoad);
        if(energyDistance<=.055&&noveltyDistance<=.055&&uncertaintyDistance<=.055&&
          cognitiveLoadDistance<=.12&&Math.abs(current.reward-oldRow.reward)>=.25)return true;
      }
      return false;
    };
    const targetFor=(row:P26InterleavedExperience):number=>{
      if(targetMode==='reward')return clamp(row.reward);
      const next=Math.max(...this.learner.predict(row.nextState).map(prediction=>prediction.value),.5);
      return clamp(row.reward+.78*next);
    };
    let onlineUpdates=0,replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,comparisons=0,lossSum=0;
    let replayCursor=0;
    const attemptReplay=()=>{
      if(!replayRows.length||replayUpdates>=maxReplayUpdates)return;
      const row=replayRows[replayCursor%replayRows.length]!;
      replayCursor++;
      if(conflictsWithFresh(row)){blockedReplayRows++;return;}
      eligibleReplayRows++;
      const trained=this.learner.train({
        state:row.state,action:row.action,target01:targetFor(row),
        learningRate01:replayLearningRate01,
      });
      replayUpdates++;lossSum+=trained.loss01;
    };
    for(let indexInBatch=0;indexInBatch<fresh.length;indexInBatch++){
      const row=fresh[indexInBatch]!;
      const trained=this.learner.train({
        state:row.state,action:row.action,target01:targetFor(row),
        learningRate01:currentLearningRate01,
      });
      onlineUpdates++;lossSum+=trained.loss01;
      if((indexInBatch+1)%effectiveReplayEveryNCurrent===0)attemptReplay();
    }
    this.state.metrics.outcomeSamples+=onlineUpdates;
    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    const total=onlineUpdates+replayUpdates;
    if(total){
      this.state.metrics.recentLoss01=clamp(lossSum/total);
      this.state.metrics.lastUpdatedAt=Date.now();
    }
    // This is training exposure only; no replay split or synthetic task label
    // is allowed to increment generalizationEvidence01.
    this.updateTrainingExposure();
    this.sync();
    return {onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons:comparisons,conflictCandidateCap};
  }

  /** Record an unauthenticated diagnostic only; this never increases generalization maturity. */
  recordHoldout(baseline01:number,learned01:number){
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;this.sync();
    return this.state.metrics.holdoutDelta01;
  }

  /** Only host-verified, independent evidence may increase generalization maturity. */
  recordVerifiedHoldout(raw:unknown):{accepted:boolean;reason:string}{
    const evidence=normalizeHoldoutEvidence(raw);
    if(!evidence)return {accepted:false,reason:'invalid-holdout-evidence'};
    if(this.state.holdoutEvidence.some(item=>item.evidenceId===evidence.evidenceId||
      holdoutIdentity(item)===holdoutIdentity(evidence))){
      return {accepted:false,reason:'duplicate-holdout-evidence'};
    }
    if(!this.verifierAccepts(evidence))return {accepted:false,reason:'holdout-evidence-not-authenticated'};
    this.state.holdoutEvidence=[...this.state.holdoutEvidence,structuredClone(evidence)].slice(-4096);
    this.state.metrics.independentHoldoutSamples=this.state.holdoutEvidence.length;
    this.state.metrics.generalizationEvidence01=clamp(Math.min(1,this.state.metrics.independentHoldoutSamples/20));
    this.state.metrics.holdoutBaseline01=evidence.baseline01;
    this.state.metrics.holdoutLearned01=evidence.learned01;
    this.state.metrics.holdoutDelta01=evidence.learned01-evidence.baseline01;
    this.state.metrics.lastUpdatedAt=Date.now();
    this.sync();
    return {accepted:true,reason:'verified-independent-holdout-recorded'};
  }
  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{this.sync();return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
