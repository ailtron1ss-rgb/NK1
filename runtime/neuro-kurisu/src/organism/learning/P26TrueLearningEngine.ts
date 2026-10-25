import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import { ParametricPolicyLearner, defaultParametricPolicy, type ParametricPolicyState } from './ParametricPolicyLearner.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P26LearningMetrics {
  outcomeSamples:number;
  onlineUpdates:number;
  replayUpdates:number;
  /** Normalized training exposure, not a generalization claim. */
  trainingExposure01:number;
  /** Count of unique independently verified holdout evidence items accepted by the gate. */
  independentHoldoutSamples:number;
  learningDelta01:number;
  recentLoss01:number;
  generalizationEvidence01:number;
  holdoutBaseline01:number;
  holdoutLearned01:number;
  holdoutDelta01:number;
  lastUpdatedAt:number;
}

export interface VerifiedHoldoutEvidenceInput {
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

export interface StoredVerifiedHoldoutEvidence extends VerifiedHoldoutEvidenceInput {
  recordedAt:number;
}

export interface P26TrueLearningState {
  version:1;
  policy:ParametricPolicyState;
  metrics:P26LearningMetrics;
  processedTraceIds:string[];
  /** Optional on input for backwards compatibility with previous v1 snapshots. */
  holdoutEvidence?:StoredVerifiedHoldoutEvidence[];
  usedHoldoutEvidenceKeys?:string[];
}

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,trainingExposure01:0,independentHoldoutSamples:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],holdoutEvidence:[],usedHoldoutEvidenceKeys:[],
});

const hasUnsafeControl=(value:string)=>[...value].some(ch=>{const n=ch.charCodeAt(0);return n<32||(n>=127&&n<=159);});
const safeEvidenceText=(value:unknown,max=240):string|null=>{
  if(typeof value!=='string')return null;
  const normalized=value.normalize('NFKC');
  if(hasUnsafeControl(normalized))return null;
  const text=normalized.trim();
  return text.length>0&&text.length<=max?text:null;
};
const validEvidenceMetric=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const holdoutIdentityKey=(row:Pick<VerifiedHoldoutEvidenceInput,'taskId'|'protocolId'|'verifierId'|'sampleSetHash'>):string=>
  'sample:'+JSON.stringify([row.taskId,row.protocolId,row.verifierId,row.sampleSetHash]);
const holdoutIdKey=(evidenceId:string):string=>'id:'+evidenceId;

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    const restoredEvidence:StoredVerifiedHoldoutEvidence[]=[];
    const seenIds=new Set<string>(),seenSamples=new Set<string>();
    const rawEvidence=Array.isArray(raw?.holdoutEvidence)?raw!.holdoutEvidence!.slice(-1024):[];
    for(const value of rawEvidence){
      if(!value||typeof value!=='object'||value.verified!==true||value.independent!==true||
        !validEvidenceMetric(value.baseline01)||!validEvidenceMetric(value.learned01)||
        !Number.isFinite(value.recordedAt)||value.recordedAt<0)continue;
      const evidenceId=safeEvidenceText(value.evidenceId,180),taskId=safeEvidenceText(value.taskId,180),
        protocolId=safeEvidenceText(value.protocolId,180),verifierId=safeEvidenceText(value.verifierId,180),
        sampleSetHash=safeEvidenceText(value.sampleSetHash,300);
      if(!evidenceId||!taskId||!protocolId||!verifierId||!sampleSetHash)continue;
      const row:StoredVerifiedHoldoutEvidence={evidenceId,taskId,protocolId,verifierId,sampleSetHash,
        baseline01:value.baseline01,learned01:value.learned01,verified:true,independent:true,recordedAt:value.recordedAt};
      const identity=holdoutIdentityKey(row);
      if(seenIds.has(evidenceId)||seenSamples.has(identity))continue;
      seenIds.add(evidenceId);seenSamples.add(identity);restoredEvidence.push(row);
    }
    const usedKeys=new Set<string>();
    if(Array.isArray(raw?.usedHoldoutEvidenceKeys))for(const key of raw!.usedHoldoutEvidenceKeys!){
      if(typeof key==='string'&&key.length>4&&key.length<=1024&&!hasUnsafeControl(key))usedKeys.add(key);
    }
    for(const row of restoredEvidence){usedKeys.add(holdoutIdKey(row.evidenceId));usedKeys.add(holdoutIdentityKey(row));}
    this.state={...d,...(raw??{}),metrics:{...d.metrics,...(raw?.metrics??{})},
      processedTraceIds:Array.isArray(raw?.processedTraceIds)?raw!.processedTraceIds.slice(-4096):[],
      holdoutEvidence:restoredEvidence,usedHoldoutEvidenceKeys:[...usedKeys].slice(-4096)};
    this.learner.restore(this.state.policy);
    this.refreshDerivedMetrics();
  }
  snapshot():P26TrueLearningState{ this.refreshDerivedMetrics();this.sync();return structuredClone(this.state); }
  sync(){ this.state.policy=this.learner.snapshot(); }
  private refreshDerivedMetrics():void{
    const metrics=this.state.metrics;
    metrics.trainingExposure01=clamp(Math.min(1,(Math.max(0,metrics.onlineUpdates)+Math.max(0,metrics.replayUpdates))/160));
    metrics.independentHoldoutSamples=(this.state.holdoutEvidence??[]).length;
    // Parameter updates and internal train/holdout splits are not independent proof.
    // Only accepted verified-holdout evidence may advance this maturity signal.
    metrics.generalizationEvidence01=clamp(Math.min(1,metrics.independentHoldoutSamples/20));
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
    this.state.metrics.lastUpdatedAt=Date.now();
    this.state.processedTraceIds=[trace.id,...this.state.processedTraceIds].slice(0,4096);
    this.refreshDerivedMetrics();
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
    this.refreshDerivedMetrics();
    this.sync();
    return {updates,meanLoss01:updates?loss/updates:0};
  }
  /**
   * Interleave fresh online updates with bounded rehearsal from prior experience.
   * Historical labels that contradict fresh outcomes in an indistinguishable state
   * are quarantined for this run; separated contexts (for example, novelty bands)
   * remain eligible. Every fresh and replay update is still a normal policy update.
   */
  trainInterleaved(
    currentRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    replayRows:Array<{state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number}>,
    options:{replayEveryNCurrent?:number;maxReplayUpdates?:number;targetMode?:'reward'|'td';currentLearningRate01?:number;replayLearningRate01?:number}={},
  ){
    const candidateCap=64;
    const replayEvery=Math.max(1,Math.min(4096,Math.floor(Number.isFinite(options.replayEveryNCurrent)?Number(options.replayEveryNCurrent):16)));
    const maxReplay=Math.max(0,Math.min(10000,Math.floor(Number.isFinite(options.maxReplayUpdates)?Number(options.maxReplayUpdates):160)));
    const currentRate=Number.isFinite(options.currentLearningRate01)?Math.max(.002,Math.min(.30,Number(options.currentLearningRate01))):.045;
    const replayRate=Number.isFinite(options.replayLearningRate01)?Math.max(.002,Math.min(.30,Number(options.replayLearningRate01))):.035;
    const targetMode=options.targetMode==='reward'?'reward':'td';
    type Example={state:OrganismState;action:ActionKind;reward:number;nextState:OrganismState;surprise?:number};
    type Indexed={row:Example;index:number;energy:number;novelty:number;key:string};
    const safeRow=(value:Example)=>Boolean(value&&value.state&&value.nextState&&value.state.needs&&value.nextState.needs&&
      ACTIONS.includes(value.action)&&Number.isFinite(value.reward)&&Number.isFinite(value.state.needs.energy)&&
      Number.isFinite(value.state.needs.novelty)&&Number.isFinite(value.state.needs.cognitiveLoad)&&
      Number.isFinite(value.state.needs.uncertainty)&&Number.isFinite(value.state.needs.goalPressure)&&
      Number.isFinite(value.state.needs.socialNeed)&&Number.isFinite(value.state.needs.identityCoherence));
    const historical:Indexed[]=replayRows.flatMap((row,index)=>safeRow(row)?[{
      row,index,energy:clamp(row.state.needs.energy),novelty:clamp(row.state.needs.novelty),
      key:`${index}:${row.action}:${clamp(row.state.needs.energy).toFixed(4)}:${clamp(row.state.needs.novelty).toFixed(4)}:${clamp(row.reward).toFixed(4)}`,
    }]:[]);
    const replayByAction=new Map<ActionKind,Indexed[]>();
    for(const item of historical){const rows=replayByAction.get(item.row.action)??[];rows.push(item);replayByAction.set(item.row.action,rows);}
    for(const rows of replayByAction.values())rows.sort((a,b)=>a.energy-b.energy||a.novelty-b.novelty||a.index-b.index);

    const lowerBound=(rows:Indexed[],energy:number)=>{
      let lo=0,hi=rows.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].energy<energy)lo=mid+1;else hi=mid;}
      return lo;
    };
    const targetFor=(row:Example)=>{
      const reward=clamp(row.reward);
      if(targetMode==='reward')return reward;
      const next=Math.max(.5,...this.learner.predict(row.nextState).map(prediction=>prediction.value));
      return clamp(reward+.78*next);
    };
    const isContradictoryContext=(fresh:Example,old:Example)=>{
      const a=fresh.state.needs,b=old.state.needs;
      const noveltyGap=Math.abs(clamp(a.novelty)-clamp(b.novelty));
      // A large novelty separation is an explicit context signal, not proof that
      // two experiences conflict. It permits selective transfer across distinct modes.
      if(noveltyGap>.35)return false;
      const sameContext=Math.abs(clamp(a.energy)-clamp(b.energy))<=.075&&
        Math.abs(clamp(a.cognitiveLoad)-clamp(b.cognitiveLoad))<=.12&&
        Math.abs(clamp(a.uncertainty)-clamp(b.uncertainty))<=.12&&
        Math.abs(clamp(a.goalPressure)-clamp(b.goalPressure))<=.15&&
        Math.abs(clamp(a.socialNeed)-clamp(b.socialNeed))<=.12&&
        Math.abs(clamp(a.identityCoherence)-clamp(b.identityCoherence))<=.18&&
        Math.abs(clamp(fresh.state.predictionError)-clamp(old.state.predictionError))<=.16;
      return sameContext&&Math.abs(clamp(fresh.reward)-clamp(old.reward))>.28;
    };

    let onlineUpdates=0,replayUpdates=0,loss=0,conflictComparisons=0;
    const usedReplay=new Set<string>(),blockedReplay=new Set<string>(),eligibleReplay=new Set<string>();
    for(let index=0;index<currentRows.length;index++){
      const fresh=currentRows[index];
      if(!safeRow(fresh))continue;
      const outcome=this.learner.train({state:fresh.state,action:fresh.action,target01:targetFor(fresh),
        learningRate01:currentRate});
      onlineUpdates++;loss+=outcome.loss01;
      if(maxReplay===0||replayUpdates>=maxReplay||(index+1)%replayEvery!==0)continue;
      const rows=replayByAction.get(fresh.action)??[];
      if(!rows.length)continue;
      const position=lowerBound(rows,clamp(fresh.state.needs.energy));
      const start=Math.max(0,Math.min(Math.max(0,rows.length-candidateCap),position-Math.floor(candidateCap/2)));
      const pool=rows.slice(start,Math.min(rows.length,start+candidateCap));
      for(const candidate of pool){
        if(replayUpdates>=maxReplay)break;
        if(usedReplay.has(candidate.key)||blockedReplay.has(candidate.key))continue;
        conflictComparisons++;
        if(isContradictoryContext(fresh,candidate.row)){
          blockedReplay.add(candidate.key);
          continue;
        }
        eligibleReplay.add(candidate.key);
        usedReplay.add(candidate.key);
        const trained=this.learner.train({state:candidate.row.state,action:candidate.row.action,
          target01:targetFor(candidate.row),learningRate01:replayRate});
        replayUpdates++;loss+=trained.loss01;
        break;
      }
    }
    this.state.metrics.onlineUpdates+=onlineUpdates;
    this.state.metrics.replayUpdates+=replayUpdates;
    if(onlineUpdates+replayUpdates){
      this.state.metrics.outcomeSamples+=onlineUpdates;
      this.state.metrics.recentLoss01=clamp(loss/(onlineUpdates+replayUpdates));
      this.state.metrics.lastUpdatedAt=Date.now();
    }
    this.refreshDerivedMetrics();
    this.sync();
    return {
      onlineUpdates,replayUpdates,blockedReplayRows:blockedReplay.size,eligibleReplayRows:eligibleReplay.size,
      conflictComparisons,conflictCandidateCap:candidateCap,
      meanLoss01:onlineUpdates+replayUpdates?loss/(onlineUpdates+replayUpdates):0,
      trainingExposure01:this.state.metrics.trainingExposure01,
      generalizationEvidence01:this.state.metrics.generalizationEvidence01,
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
    // The internal split is useful diagnostics, but not independent verified evidence.
    this.state.metrics.holdoutBaseline01=baseline; this.state.metrics.holdoutLearned01=learned; this.state.metrics.holdoutDelta01=learned-baseline; this.state.metrics.lastUpdatedAt=Date.now();
    this.refreshDerivedMetrics();this.sync();
    return {updates:train.length,meanLoss01:train.length?loss/train.length:0,holdoutBaseline01:baseline,holdoutLearned01:learned,holdoutDelta01:learned-baseline};
  }

  recordHoldout(baseline01:number,learned01:number){
    // Legacy aggregate input has no independent provenance, so it is diagnostic only.
    this.state.metrics.holdoutBaseline01=clamp(baseline01);this.state.metrics.holdoutLearned01=clamp(learned01);this.state.metrics.holdoutDelta01=learned01-baseline01;
    this.refreshDerivedMetrics();this.sync();
    return this.state.metrics.holdoutDelta01;
  }

  recordVerifiedHoldout(input:VerifiedHoldoutEvidenceInput):{accepted:boolean;reason:string;generalizationEvidence01:number;independentHoldoutSamples:number}{
    const evidenceId=safeEvidenceText(input?.evidenceId,180),taskId=safeEvidenceText(input?.taskId,180),
      protocolId=safeEvidenceText(input?.protocolId,180),verifierId=safeEvidenceText(input?.verifierId,180),
      sampleSetHash=safeEvidenceText(input?.sampleSetHash,300);
    if(!evidenceId||!taskId||!protocolId||!verifierId||!sampleSetHash||
      !validEvidenceMetric(input?.baseline01)||!validEvidenceMetric(input?.learned01)){
      this.refreshDerivedMetrics();
      return {accepted:false,reason:'invalid-holdout-evidence',generalizationEvidence01:this.state.metrics.generalizationEvidence01,independentHoldoutSamples:this.state.metrics.independentHoldoutSamples};
    }
    if(input.verified!==true||input.independent!==true){
      this.refreshDerivedMetrics();
      return {accepted:false,reason:'holdout-evidence-not-verified-independent',generalizationEvidence01:this.state.metrics.generalizationEvidence01,independentHoldoutSamples:this.state.metrics.independentHoldoutSamples};
    }
    const row:StoredVerifiedHoldoutEvidence={evidenceId,taskId,protocolId,verifierId,sampleSetHash,
      baseline01:input.baseline01,learned01:input.learned01,verified:true,independent:true,recordedAt:Date.now()};
    const idKey=holdoutIdKey(evidenceId),sampleKey=holdoutIdentityKey(row);
    const used=new Set(this.state.usedHoldoutEvidenceKeys??[]);
    if(used.has(idKey)||used.has(sampleKey)){
      this.refreshDerivedMetrics();
      return {accepted:false,reason:'duplicate-holdout-evidence',generalizationEvidence01:this.state.metrics.generalizationEvidence01,independentHoldoutSamples:this.state.metrics.independentHoldoutSamples};
    }
    this.state.holdoutEvidence=[...(this.state.holdoutEvidence??[]),row].slice(-1024);
    this.state.usedHoldoutEvidenceKeys=[...used,idKey,sampleKey].slice(-4096);
    this.state.metrics.holdoutBaseline01=input.baseline01;
    this.state.metrics.holdoutLearned01=input.learned01;
    this.state.metrics.holdoutDelta01=input.learned01-input.baseline01;
    this.state.metrics.lastUpdatedAt=Date.now();
    this.refreshDerivedMetrics();
    this.sync();
    return {accepted:true,reason:'accepted',generalizationEvidence01:this.state.metrics.generalizationEvidence01,independentHoldoutSamples:this.state.metrics.independentHoldoutSamples};
  }

  freeze(){this.learner.setFrozen(true);this.sync();}
  unfreeze(){this.learner.setFrozen(false);this.sync();}
  metrics():P26LearningMetrics{this.refreshDerivedMetrics();return {...this.state.metrics};}
  actionList(){return [...ACTIONS];}
}
