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
  state: OrganismState;
  action: ActionKind;
  reward: number;
  nextState: OrganismState;
  surprise?: number;
}

export interface P26InterleavedOptions {
  /** Run one rehearsal attempt after each N newly observed samples. */
  replayEveryNCurrent?: number;
  /** Maximum number of historical rows considered in one call, including rejected conflicts. */
  maxReplayUpdates?: number;
  /** Use raw task feedback for controlled diagnostics or a one-step TD target for live-style learning. */
  targetMode?: 'reward' | 'td';
  currentLearningRate01?: number;
  replayLearningRate01?: number;
  /** Upper bound on old/current context comparisons for one historical row. */
  conflictCandidateCap?: number;
}

export interface P26InterleavedReport {
  onlineUpdates: number;
  replayUpdates: number;
  blockedReplayRows: number;
  eligibleReplayRows: number;
  conflictComparisons: number;
  conflictCandidateCap: number;
  meanOnlineLoss01: number;
  meanReplayLoss01: number;
}

function assertFiniteExperienceState(state: OrganismState, label: string): void {
  if (!state || typeof state !== 'object' || !state.needs || typeof state.needs !== 'object') {
    throw new TypeError(`${label}-state-must-have-needs`);
  }
  const needs = state.needs as unknown as Record<string, unknown>;
  for (const key of ['energy', 'cognitiveLoad', 'uncertainty', 'novelty', 'goalPressure', 'socialNeed', 'identityCoherence']) {
    if (typeof needs[key] !== 'number' || !Number.isFinite(needs[key] as number)) {
      throw new TypeError(`${label}-state-need-${key}-must-be-finite`);
    }
  }
  for (const [key, value] of [
    ['predictionError', state.predictionError],
    ['attentionBudget', state.attentionBudget],
  ] as const) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${label}-state-${key}-must-be-finite`);
    }
  }
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
   * Interleave current learning with bounded replay from prior tasks.
   *
   * Replay is screened against the current batch in a coarse state-context grid:
   * same-action examples that have near-identical energy/novelty but contradictory
   * targets are withheld, preserving plasticity when the same observable context
   * receives a different label. Distinct contexts remain eligible for rehearsal.
   * The comparison budget is hard-bounded per replay candidate.
   */
  trainInterleaved(
    current: P26InterleavedExperience[],
    replayRows: P26InterleavedExperience[],
    options: P26InterleavedOptions = {},
    extras?: BodyExtras,
  ): P26InterleavedReport {
    if (!Array.isArray(current) || !Array.isArray(replayRows)) {
      throw new TypeError('interleaved-batches-must-be-arrays');
    }
    const replayEveryNCurrent = options.replayEveryNCurrent ?? 16;
    const maxReplayUpdates = options.maxReplayUpdates ?? Math.min(64, replayRows.length);
    const conflictCandidateCap = options.conflictCandidateCap ?? 64;
    const targetMode = options.targetMode ?? 'td';
    const currentLearningRate01 = options.currentLearningRate01 ?? .06;
    const replayLearningRate01 = options.replayLearningRate01 ?? .035;
    if (!Number.isSafeInteger(replayEveryNCurrent) || replayEveryNCurrent < 1 || replayEveryNCurrent > 100000) {
      throw new RangeError('interleaved-replay-interval-invalid');
    }
    if (!Number.isSafeInteger(maxReplayUpdates) || maxReplayUpdates < 0 || maxReplayUpdates > 100000) {
      throw new RangeError('interleaved-replay-budget-invalid');
    }
    if (!Number.isSafeInteger(conflictCandidateCap) || conflictCandidateCap < 8 || conflictCandidateCap > 128) {
      throw new RangeError('interleaved-conflict-candidate-cap-invalid');
    }
    if (targetMode !== 'reward' && targetMode !== 'td') {
      throw new TypeError('interleaved-target-mode-invalid');
    }
    for (const [label, rate] of [['current', currentLearningRate01], ['replay', replayLearningRate01]] as const) {
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) {
        throw new RangeError(`interleaved-${label}-learning-rate-invalid`);
      }
    }

    // Preflight both streams before mutation. A malformed historical sample must
    // not cause a partial current-task update, and vice versa.
    const validateRows = (rows: P26InterleavedExperience[], label: string) => rows.map((row, index) => {
      if (!row || typeof row !== 'object' || !ACTIONS.includes(row.action)) {
        throw new TypeError(`${label}-row-${index}-invalid-action`);
      }
      if (typeof row.reward !== 'number' || !Number.isFinite(row.reward) ||
          (row.surprise !== undefined && (typeof row.surprise !== 'number' || !Number.isFinite(row.surprise)))) {
        throw new TypeError(`${label}-row-${index}-feedback-must-be-finite`);
      }
      assertFiniteExperienceState(row.state, `${label}-row-${index}-current`);
      assertFiniteExperienceState(row.nextState, `${label}-row-${index}-next`);
      return { ...row };
    });
    const fresh = validateRows(current, 'current');
    const historical = validateRows(replayRows, 'replay');

    const targetFor = (row: P26InterleavedExperience): number => {
      if (targetMode === 'reward') return clamp(row.reward);
      const next = Math.max(...this.learner.predict(row.nextState, extras).map(value => value.value), .5);
      return clamp(row.reward + .78 * next);
    };
    // Fix target labels before changing weights. This keeps conflict detection
    // independent of the order in which online updates happen.
    const currentTargets = fresh.map(targetFor);
    const replayTargets = historical.map(targetFor);

    const energyWidth = .125;
    const noveltyWidth = .25;
    const energyBin = (row: P26InterleavedExperience) =>
      Math.floor(clamp(row.state.needs.energy) / energyWidth);
    const noveltyBin = (row: P26InterleavedExperience) =>
      Math.floor(clamp(row.state.needs.novelty) / noveltyWidth);
    const bucketKey = (row: P26InterleavedExperience) =>
      `${row.action}|${energyBin(row)}|${noveltyBin(row)}`;
    const currentBuckets = new Map<string, Array<{ row: P26InterleavedExperience; target: number }>>();
    fresh.forEach((row, index) => {
      const key = bucketKey(row);
      const bucket = currentBuckets.get(key) ?? [];
      // Keep the index bounded even if a producer supplies a highly repetitive batch.
      if (bucket.length < conflictCandidateCap) bucket.push({ row, target: currentTargets[index] });
      else {
        const replacementIndex = index % conflictCandidateCap;
        bucket[replacementIndex] = { row, target: currentTargets[index] };
      }
      currentBuckets.set(key, bucket);
    });

    const isContradictoryContext = (
      replayRow: P26InterleavedExperience,
      replayTarget: number,
    ): { conflict: boolean; comparisons: number } => {
      const e = energyBin(replayRow);
      const n = noveltyBin(replayRow);
      let comparisons = 0;
      for (let de = -1; de <= 1; de++) {
        for (let dn = -1; dn <= 1; dn++) {
          const bucket = currentBuckets.get(`${replayRow.action}|${e + de}|${n + dn}`) ?? [];
          for (const candidate of bucket) {
            if (comparisons >= conflictCandidateCap) return { conflict: false, comparisons };
            comparisons++;
            const sameContext =
              Math.abs(clamp(candidate.row.state.needs.energy) - clamp(replayRow.state.needs.energy)) <= .14 &&
              Math.abs(clamp(candidate.row.state.needs.novelty) - clamp(replayRow.state.needs.novelty)) <= .28;
            const conflictingTarget = Math.abs(candidate.target - replayTarget) >= .30;
            if (sameContext && conflictingTarget) return { conflict: true, comparisons };
          }
        }
      }
      return { conflict: false, comparisons };
    };

    let onlineUpdates = 0, replayUpdates = 0, blockedReplayRows = 0, eligibleReplayRows = 0;
    let conflictComparisons = 0, onlineLoss = 0, replayLoss = 0, replayAttempts = 0, replayCursor = 0;
    const replayBudget = Math.min(maxReplayUpdates, historical.length);
    for (let index = 0; index < fresh.length; index++) {
      const row = fresh[index];
      const online = this.learner.train({
        state: row.state, action: row.action, target01: currentTargets[index],
        learningRate01: currentLearningRate01, extras,
      });
      onlineUpdates++;
      onlineLoss += online.loss01;

      if (!historical.length || replayAttempts >= replayBudget ||
          (index + 1) % replayEveryNCurrent !== 0) continue;

      const replayIndex = replayCursor % historical.length;
      replayCursor++;
      replayAttempts++;
      const replayRow = historical[replayIndex];
      const decision = isContradictoryContext(replayRow, replayTargets[replayIndex]);
      conflictComparisons += decision.comparisons;
      if (decision.conflict) {
        blockedReplayRows++;
        continue;
      }
      eligibleReplayRows++;
      const rehearsed = this.learner.train({
        state: replayRow.state, action: replayRow.action, target01: replayTargets[replayIndex],
        learningRate01: replayLearningRate01, sampleWeight01: .75,
        extras,
      });
      replayUpdates++;
      replayLoss += rehearsed.loss01;
    }

    this.state.metrics.outcomeSamples += onlineUpdates;
    this.state.metrics.onlineUpdates += onlineUpdates;
    this.state.metrics.replayUpdates += replayUpdates;
    const totalLoss = onlineUpdates + replayUpdates;
    this.state.metrics.recentLoss01 = clamp(totalLoss ? (onlineLoss + replayLoss) / totalLoss : 0);
    this.state.metrics.trainingExposure01 = clamp(Math.min(1, this.learner.snapshot().updates / 160));
    if (totalLoss > 0) this.state.metrics.lastUpdatedAt = Date.now();
    this.sync();
    return {
      onlineUpdates, replayUpdates, blockedReplayRows, eligibleReplayRows,
      conflictComparisons, conflictCandidateCap,
      meanOnlineLoss01: onlineUpdates ? onlineLoss / onlineUpdates : 0,
      meanReplayLoss01: replayUpdates ? replayLoss / replayUpdates : 0,
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
