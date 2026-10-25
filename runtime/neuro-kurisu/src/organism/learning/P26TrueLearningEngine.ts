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
  if(!normalized||normalized.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(normalized))return null;
  return normalized;
};
const normalizeVerifiedHoldoutEvidence=(value:unknown):P26VerifiedHoldoutEvidence|null=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Partial<P26VerifiedHoldoutEvidence>;
  const evidenceId=boundedEvidenceId(row.evidenceId);
  const taskId=boundedEvidenceId(row.taskId);
  const protocolId=boundedEvidenceId(row.protocolId);
  const verifierId=boundedEvidenceId(row.verifierId);
  const sampleSetHash=boundedEvidenceId(row.sampleSetHash);
  if(!evidenceId||!taskId||!protocolId||!verifierId||!sampleSetHash)return null;
  if(![row.baseline01,row.learned01].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))return null;
  return {evidenceId,taskId,protocolId,verifierId,sampleSetHash,baseline01:row.baseline01!,learned01:row.learned01!};
};
const isVerifiedHoldoutEvidence=(value:unknown):value is P26VerifiedHoldoutEvidence=>
  normalizeVerifiedHoldoutEvidence(value)!==null;
const safeP26Count=(value:unknown):number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const safeP26Ratio=(value:unknown,fallback=0):number=>
  typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const safeP26Timestamp=(value:unknown):number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const safeP26SignedDelta=(value:unknown):number=>
  typeof value==='number'&&Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;

export const defaultP26TrueLearning=():P26TrueLearningState=>({
  version:1,policy:defaultParametricPolicy(),
  metrics:{outcomeSamples:0,onlineUpdates:0,replayUpdates:0,trainingExposure01:0,independentHoldoutSamples:0,learningDelta01:0,recentLoss01:0,generalizationEvidence01:0,holdoutBaseline01:0,holdoutLearned01:0,holdoutDelta01:0,lastUpdatedAt:0},
  processedTraceIds:[],
  verifiedHoldoutEvidence:[],
});

export interface BodyExtras { external01?:number;boredom01?:number;resourceRisk01?:number;thermalPressure01?:number;bodyCapacity01?:number; }

export interface P26InterleavedExperience {
  state: OrganismState;
  action: ActionKind;
  reward: number;
  nextState: OrganismState;
  surprise?: number;
  extras?: BodyExtras;
}

export interface P26InterleavedTrainingOptions {
  replayEveryNCurrent?: number;
  maxReplayUpdates?: number;
  targetMode?: 'reward' | 'td';
  currentLearningRate01?: number;
  replayLearningRate01?: number;
}

export interface P26InterleavedTrainingResult {
  onlineUpdates: number;
  replayUpdates: number;
  blockedReplayRows: number;
  eligibleReplayRows: number;
  conflictComparisons: number;
  conflictCandidateCap: number;
}

export class P26TrueLearningEngine{
  readonly learner=new ParametricPolicyLearner();
  private state=defaultP26TrueLearning();
  restore(raw?:Partial<P26TrueLearningState>|null){
    const d=defaultP26TrueLearning();
    if(raw?.version!==undefined&&raw.version!==1)throw new RangeError('unsupported P26 true-learning state version');
    const evidenceById=new Map<string,P26VerifiedHoldoutEvidence>();
    for(const rawEvidence of Array.isArray(raw?.verifiedHoldoutEvidence)?raw!.verifiedHoldoutEvidence:[]){
      const evidence=normalizeVerifiedHoldoutEvidence(rawEvidence);
      if(!evidence||evidenceById.has(evidence.evidenceId))continue;
      evidenceById.set(evidence.evidenceId,evidence);
      if(evidenceById.size>=4096)break;
    }
    const verifiedHoldoutEvidence=[...evidenceById.values()];
    const sourceMetrics=raw?.metrics??{};
    const outcomeSamples=safeP26Count(sourceMetrics.outcomeSamples);
    const onlineUpdates=Math.min(outcomeSamples,safeP26Count(sourceMetrics.onlineUpdates));
    const replayUpdates=safeP26Count(sourceMetrics.replayUpdates);
    const holdoutBaseline01=safeP26Ratio(sourceMetrics.holdoutBaseline01);
    const holdoutLearned01=safeP26Ratio(sourceMetrics.holdoutLearned01);
    this.learner.restore(raw?.policy);
    const processedTraceIds=Array.isArray(raw?.processedTraceIds)
      ? [...new Set(raw!.processedTraceIds.filter((value):value is string=>
          typeof value==='string'&&value.length>0&&value.length<=256&&value.trim().length>0&&
          !/[\\u0000-\\u001f\\u007f-\\u009f]/.test(value)))].slice(-4096)
      : [];
    this.state={
      version:1,
      policy:this.learner.snapshot(),
      metrics:{
        outcomeSamples,
        onlineUpdates,
        replayUpdates,
        trainingExposure01:0,
        independentHoldoutSamples:verifiedHoldoutEvidence.length,
        learningDelta01:safeP26Ratio(sourceMetrics.learningDelta01),
        recentLoss01:safeP26Ratio(sourceMetrics.recentLoss01),
        generalizationEvidence01:clamp(verifiedHoldoutEvidence.length*.05),
        holdoutBaseline01,
        holdoutLearned01,
        holdoutDelta01:safeP26SignedDelta(holdoutLearned01-holdoutBaseline01),
        lastUpdatedAt:safeP26Timestamp(sourceMetrics.lastUpdatedAt),
      },
      processedTraceIds,
      verifiedHoldoutEvidence,
    };
    this.updateTrainingExposure();
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
  /**
   * Interleave verified/current task examples with bounded, conflict-gated replay.
   * Replay from a similar state/action with a contradictory reward is suppressed;
   * distinguishable contexts remain eligible for rehearsal.
   */
  trainInterleaved(
    fresh: P26InterleavedExperience[],
    replayRows: P26InterleavedExperience[],
    options: P26InterleavedTrainingOptions = {},
  ): P26InterleavedTrainingResult {
    if (!Array.isArray(fresh) || !Array.isArray(replayRows)) throw new Error('interleaved-batches-must-be-arrays');
    const replayEvery = options.replayEveryNCurrent ?? 8;
    const maxReplay = options.maxReplayUpdates ?? 64;
    const currentRate = options.currentLearningRate01 ?? .05;
    const replayRate = options.replayLearningRate01 ?? .03;
    const targetMode = options.targetMode ?? 'td';
    if (!Number.isSafeInteger(replayEvery) || replayEvery < 1) throw new Error('replay-interval-must-be-positive-integer');
    if (!Number.isSafeInteger(maxReplay) || maxReplay < 0 || maxReplay > 4096) throw new Error('replay-update-cap-invalid');
    if (typeof currentRate !== 'number' || !Number.isFinite(currentRate)) throw new Error('current-learning-rate-must-be-finite');
    if (typeof replayRate !== 'number' || !Number.isFinite(replayRate)) throw new Error('replay-learning-rate-must-be-finite');
    if (targetMode !== 'reward' && targetMode !== 'td') throw new Error('interleaved-target-mode-invalid');

    const preflight = (row: P26InterleavedExperience, rate: number) => {
      if (!row || typeof row !== 'object') throw new Error('interleaved-row-invalid');
      if (typeof row.reward !== 'number' || !Number.isFinite(row.reward) || row.reward < 0 || row.reward > 1) {
        throw new Error('interleaved-reward-invalid');
      }
      if (row.surprise !== undefined &&
          (typeof row.surprise !== 'number' || !Number.isFinite(row.surprise) || row.surprise < 0 || row.surprise > 1)) {
        throw new Error('interleaved-surprise-invalid');
      }
      this.learner.validateTrainingInput({
        state: row.state, action: row.action, target01: row.reward,
        learningRate01: rate, extras: row.extras,
      });
      this.learner.validateTrainingInput({
        state: row.nextState, action: row.action, target01: row.reward,
        learningRate01: rate, extras: row.extras,
      });
    };
    // Atomic input validation before the first SGD update.
    for (const row of fresh) preflight(row, currentRate);
    for (const row of replayRows) preflight(row, replayRate);

    const conflictCandidateCap = 64;
    const candidateCount = Math.min(conflictCandidateCap, fresh.length);
    const candidates = candidateCount === 0 ? [] : Array.from({ length: candidateCount }, (_, i) =>
      fresh[Math.min(fresh.length - 1, Math.floor(i * fresh.length / candidateCount))],
    );
    const sameContext = (a: OrganismState, b: OrganismState): boolean => {
      const an = a.needs, bn = b.needs;
      return Math.abs(an.energy - bn.energy) <= .18 &&
        Math.abs(an.novelty - bn.novelty) <= .18 &&
        Math.abs(an.uncertainty - bn.uncertainty) <= .20 &&
        Math.abs(an.cognitiveLoad - bn.cognitiveLoad) <= .20 &&
        Math.abs(an.goalPressure - bn.goalPressure) <= .20 &&
        Math.abs(an.socialNeed - bn.socialNeed) <= .20 &&
        Math.abs(an.identityCoherence - bn.identityCoherence) <= .20;
    };

    let blockedReplayRows = 0;
    let eligibleReplayRows = 0;
    let conflictComparisons = 0;
    const eligible: P26InterleavedExperience[] = [];
    for (const prior of replayRows) {
      let conflict = false;
      for (const current of candidates) {
        conflictComparisons++;
        if (current.action === prior.action &&
            Math.abs(current.reward - prior.reward) >= .35 &&
            sameContext(current.state, prior.state)) {
          conflict = true;
          break;
        }
      }
      if (conflict) blockedReplayRows++;
      else { eligibleReplayRows++; eligible.push(prior); }
    }

    const computeTarget = (row: P26InterleavedExperience): number => {
      if (targetMode === 'reward') return clamp(row.reward);
      const nextValue = Math.max(.5, ...this.learner.predict(row.nextState, row.extras).map(p => p.value));
      return clamp(row.reward + .78 * nextValue);
    };
    let onlineUpdates = 0;
    let replayUpdates = 0;
    let totalLoss = 0;
    let nextReplay = 0;
    for (let i = 0; i < fresh.length; i++) {
      const row = fresh[i];
      const result = this.learner.train({
        state: row.state, action: row.action, target01: computeTarget(row),
        learningRate01: currentRate, extras: row.extras,
      });
      onlineUpdates++;
      totalLoss += result.loss01;
      this.state.metrics.learningDelta01 = clamp(
        this.state.metrics.learningDelta01 * .97 +
        (result.predictionAfter - result.predictionBefore) * .03 +
        Math.abs(result.tdError01) * .02,
      );
      if ((i + 1) % replayEvery === 0 && replayUpdates < maxReplay && nextReplay < eligible.length) {
        const prior = eligible[nextReplay++];
        const replayResult = this.learner.train({
          state: prior.state, action: prior.action, target01: computeTarget(prior),
          learningRate01: replayRate, extras: prior.extras,
        });
        replayUpdates++;
        totalLoss += replayResult.loss01;
        this.state.metrics.learningDelta01 = clamp(
          this.state.metrics.learningDelta01 * .97 +
          (replayResult.predictionAfter - replayResult.predictionBefore) * .03 +
          Math.abs(replayResult.tdError01) * .02,
        );
      }
    }
    this.state.metrics.outcomeSamples += onlineUpdates;
    this.state.metrics.onlineUpdates += onlineUpdates;
    this.state.metrics.replayUpdates += replayUpdates;
    this.updateTrainingExposure();
    const applied = onlineUpdates + replayUpdates;
    if (applied) {
      this.state.metrics.recentLoss01 = clamp(totalLoss / applied);
      this.state.metrics.lastUpdatedAt = Date.now();
    }
    this.sync();
    return { onlineUpdates, replayUpdates, blockedReplayRows, eligibleReplayRows, conflictComparisons, conflictCandidateCap };
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
