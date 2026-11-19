import { createHash, randomUUID } from 'node:crypto';
import { CorrectionRuleMemory, emptyCorrectionRuleMemorySnapshot, type CorrectionReviewVerifier, type CorrectionRuleAssessment, type CorrectionRuleMemorySnapshot, type ReviewedCorrectionObservation } from './CorrectionRuleMemory.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';
import type { ActionKind, IntentCandidate, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import type { AdaptivePolicyEngine, AdaptivePolicyState } from './AdaptivePolicyEngine.ts';
import { selectReplayBatch, type ReplaySelectionOptions } from './ReplaySelectionPolicy.ts';
import { selectCausalReplayBatch } from './CausalReplaySampler.ts';
import { adaptiveReplayLearningRate, adaptiveReplayOptions, bellmanTarget, calibratedConfidence, forgettingRisk, repairOpportunity, scoreReplayPriority, transferConfidence, wilsonLowerBound } from './MultiSourceLearningMechanisms.ts';
import { MIN_TRANSFER_SIMILARITY01, retrievedSkillBias } from './SkillRetrievalAugmentation.ts';
import { classifyLearningFailureReason, isReflectionFailureClass, rankLearningTargets, reflectOnOutcomes, type LearningTarget, type ReflectionFailureClass } from './OutcomeReflectionCurriculum.ts';
import { isAuthenticVerifiedSkillPromotionProposal, type VerifiedSkillPromotionProposal } from './VerifiedSkillPromotion.ts';
import { evaluateSkillLearnBenchCandidate, type SkillLearnBenchCandidateEvaluation, type SkillLearnBenchCandidateGateOptions, type SkillLearnBenchCandidateGateReport } from './SkillLearnBenchAdapter.ts';
import { bindIndependentEvaluationToVerifiedShadowEvidence, bindReflectiveReportsToVerifiedShadowEvidence, type ReflectiveEvidenceBindingReport } from './HermesVerifiedEvidenceBinding.ts';
import { compareMatchedIndependentEvaluations } from './IndependentSkillCandidateEvaluator.ts';
import type { LearningFitnessJournalDiagnostics, LearningFitnessJournalSink } from './LearningFitnessJournal.ts';
import type { LearningLifecycleEventEntry, LearningLifecycleJournalDiagnostics, LearningLifecycleJournalSink } from './LearningLifecycleJournal.ts';
import type { LearningRobustMetricSummary } from './LearningRobustMetrics.ts';
import { planSkillRevision, type SkillRevisionPlan } from './SkillRevisionPlan.ts';
import { generateLocalSkillRevision, type SkillRevisionChatProvider } from './P23LocalModelSkillRevisionGenerator.ts';
import type { SkillShadowEvidenceVerifier } from './VersionedSkillCandidateStore.ts';
import { VersionedSkillCandidateStore, type ActiveSkillVersion, type SkillPromotionApproval, type SkillRollbackApproval, type SkillShadowObservation, type SkillRevisionProvenance, type VersionedSkillCandidate } from './VersionedSkillCandidateStore.ts';

/**
 * Single source of truth for the guarded reflective-skill promotion policy.
 * Metrics, independent evaluation and the durable journal read these same values.
 */
export const P23_REFLECTIVE_PROMOTION_POLICY = Object.freeze({
  minimumValidationFamilies: 1,
  minimumHoldoutFamilies: 1,
  minimumValidationFamilyTasks: 2,
  minimumHoldoutFamilyTasks: 2,
  maximumValidationTaskRegression01: 0.20,
  maximumValidationFamilyRegression01: 0.10,
  maximumHoldoutRegression01: 0.02,
  maximumHoldoutFamilyRegression01: 0.10,
  minimumValidationFamilySeeds: 3,
  minimumHoldoutFamilySeeds: 3,
  confidenceLevel: 0.95,
  bootstrapResamples: 2000,
});
const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

/** Continuous replay salience: poor outcomes and prediction misses matter without a brittle success threshold. */
export function outcomeReplaySalience(success:number,predictedUtility:number):number {
  return clamp(.2+.55*(1-clamp(success))+.25*Math.abs(clamp(success)-clamp(predictedUtility)));
}
const now = () => Date.now();
const safeText = (x:unknown,max=220) => String(x ?? '').slice(0,max);

function bucket(x:number, size=4) { return Math.max(0, Math.min(size-1, Math.round(clamp(x) * (size-1)))); }

export interface LearningExperience {
  id:string;
  traceId:string;
  tick:number;
  at:number;
  contextKey:string;
  nextContextKey:string;
  action:ActionKind;
  predictedUtility:number;
  predictedConfidence:number;
  success:number;
  reward:number;
  surprise:number;
  outcomeAt:number;
  /** Immutable replay features captured with the outcome; optional for v1 legacy rows. */
  goalPressure01?:number;
  causalStrength01?:number;
  replayFeatures01?:number[];
  /** Compact reason class only; raw feedback notes are never persisted in P23 experience rows. */
  failureClass?:ReflectionFailureClass;
}

export interface ReplayUpdateRecord {
  id:string;
  traceId:string;
  contextKey:string;
  nextContextKey:string;
  action:ActionKind;
  reward:number;
  target:number;
  valueBefore:number;
  valueAfter:number;
  tdError:number;
  learningRate:number;
  at:number;
}

export interface ShadowEvaluationRecord {
  traceId:string;
  tick:number;
  contextKey:string;
  actual:ActionKind;
  baseline:ActionKind;
  agreed:boolean;
  actualSuccess:number;
  baselineWasBetterPrediction:boolean;
  baselineReason:string;
  at:number;
}

export interface PolicySkillRecord {
  id:string;
  contextKey:string;
  action:ActionKind;
  totalUses:number;
  trainUses:number;
  validationUses:number;
  trainSuccess01:number;
  validationSuccess01:number;
  confidence01:number;
  status:'candidate'|'promoted'|'rejected';
  createdAt:number;
  updatedAt:number;
  validationWindowStartTick:number;
  validationWindowEndTick:number;
}

export interface AblationRecord {
  traceId:string;
  tick:number;
  module:'adaptive-policy';
  actual:ActionKind;
  ablated:ActionKind;
  changed:boolean;
  scoreLoss01:number;
  reason:string;
  at:number;
}

export interface EvidenceDebtItem {
  id:string;
  contextKey:string;
  action:ActionKind;
  priority01:number;
  uncertainty01:number;
  estimatedVerificationCost01:number;
  informationGainPerCost01:number;
  reason:string;
  createdAt:number;
  lastSeenAt:number;
}

export interface CognitiveChecksum {
  digest:string;
  at:number;
  tick:number;
  verifiedAt:number;
  verificationFailures:number;
}

export interface P23LearningMetrics {
  outcomes:number;
  experiences:number;
  replayUpdates:number;
  shadowComparisons:number;
  shadowAgreement01:number;
  decisionPredictionComparisons:number;
  decisionPredictionCalibration01:number;
  /** @deprecated Compatibility alias; use decisionPredictionComparisons. */
  alternativePredictionComparisons:number;
  /** @deprecated Compatibility alias; use decisionPredictionCalibration01. */
  alternativePredictionCalibration01:number;
  /** @deprecated Compatibility alias; this is model-alternative calibration, not physical counterfactual intervention. */
  counterfactualComparisons:number;
  /** @deprecated Compatibility alias for alternativePredictionCalibration01. */
  counterfactualCalibration01:number;
  skillCandidates:number;
  skillPromotions:number;
  skillRejections:number;
  ablationComparisons:number;
  ablationChangedRate01:number;
  checksumFailures:number;
  evidenceDebtOpen:number;
  learningDelta01:number;
  predictionError01:number;
  recentPredictionError01:number;
  replayMeanAbsTdError01:number;
  lastLearningAt:number;
}

export type RevisedCandidateEvaluator = (input: {
  /** Exact untrusted generated payload to execute in the independent evaluation harness. */
  payload: unknown;
  /** SHA-256 of canonical payload bytes; the returned evaluation must bind to this exact value. */
  payloadFingerprint: string;
  baseline: { validation: SkillLearnBenchCandidateEvaluation['reports']; holdout: SkillLearnBenchCandidateEvaluation['reports'] };
  previousEvaluation: { validation: SkillLearnBenchCandidateEvaluation['reports']; holdout: SkillLearnBenchCandidateEvaluation['reports'] };
}) => Promise<{ payloadFingerprint: string; evaluationFingerprint: string; evaluation: { validation: SkillLearnBenchCandidateEvaluation['reports']; holdout: SkillLearnBenchCandidateEvaluation['reports'] } }>
  | { payloadFingerprint: string; evaluationFingerprint: string; evaluation: { validation: SkillLearnBenchCandidateEvaluation['reports']; holdout: SkillLearnBenchCandidateEvaluation['reports'] } };

const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
};
const isPersistedText=(value:unknown,max=512):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&
  !Array.from(value).some(character=>{
    const code=character.charCodeAt(0);
    return code<=0x1f||code===0x7f||(code>=0x80&&code<=0x9f);
  });
const isPersistedCounter=(value:unknown):value is number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const isPersistedUnit=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const persistedCounter=(value:unknown,fallback:number):number=>
  isPersistedCounter(value)?value:fallback;
const persistedTime=(value:unknown,fallback:number):number=>
  isPersistedCounter(value)?value:fallback;
const isPersistedAction=(value:unknown):value is ActionKind=>
  typeof value==='string'&&ACTIONS.includes(value as ActionKind);

function sanitizeIdList(value:unknown,limit:number):string[]{
  if(!Array.isArray(value))return [];
  const result:string[]=[],seen=new Set<string>();
  for(const item of value){
    if(!isPersistedText(item,512)||seen.has(item))continue;
    seen.add(item);result.push(item);
    if(result.length>=limit)break;
  }
  return result;
}
function sanitizeRows<T>(value:unknown,limit:number,parse:(item:unknown)=>T|null,identity:(item:T)=>string):T[]{
  if(!Array.isArray(value))return [];
  const result:T[]=[],seen=new Set<string>();
  for(const item of value){
    let parsed:T|null=null;
    try{parsed=parse(item);}catch{parsed=null;}
    if(parsed===null)continue;
    const key=identity(parsed);
    if(seen.has(key))continue;
    seen.add(key);result.push(parsed);
    if(result.length>=limit)break;
  }
  return result;
}
function parseLearningExperience(value:unknown):LearningExperience|null{
  if(!isPlainRecord(value))return null;
  const x=value;
  if(!isPersistedText(x.id,600)||!isPersistedText(x.traceId,512)||x.id!==`exp-${x.traceId}`||
     !isPersistedCounter(x.tick)||!isPersistedCounter(x.at)||!isPersistedCounter(x.outcomeAt)||
     !isPersistedText(x.contextKey,256)||!isPersistedText(x.nextContextKey,256)||!isPersistedAction(x.action)||
     !isPersistedUnit(x.predictedUtility)||!isPersistedUnit(x.predictedConfidence)||
     !isPersistedUnit(x.success)||!isPersistedUnit(x.reward)||!isPersistedUnit(x.surprise)||
     (x.goalPressure01!==undefined&&!isPersistedUnit(x.goalPressure01))||
     (x.causalStrength01!==undefined&&!isPersistedUnit(x.causalStrength01))||
     (x.failureClass!==undefined&&!isReflectionFailureClass(x.failureClass)))return null;
  const replayFeatures=x.replayFeatures01;
  if(replayFeatures!==undefined&&(!Array.isArray(replayFeatures)||replayFeatures.length!==16||Array.from({length:replayFeatures.length},(_,index)=>replayFeatures[index]).some(value=>!isPersistedUnit(value))))return null;
  return {id:x.id,traceId:x.traceId,tick:x.tick,at:x.at,contextKey:x.contextKey,nextContextKey:x.nextContextKey,
    action:x.action,predictedUtility:x.predictedUtility,predictedConfidence:x.predictedConfidence,
    success:x.success,reward:x.reward,surprise:x.surprise,outcomeAt:x.outcomeAt,
    ...(x.goalPressure01===undefined?{}:{goalPressure01:x.goalPressure01}),
    ...(x.causalStrength01===undefined?{}:{causalStrength01:x.causalStrength01}),
    ...(replayFeatures===undefined?{}:{replayFeatures01:[...replayFeatures]}),...(x.failureClass===undefined?{}:{failureClass:x.failureClass})};
}
function parseReplayUpdate(value:unknown):ReplayUpdateRecord|null{
  if(!isPlainRecord(value))return null;
  const x=value;
  if(!isPersistedText(x.id,600)||!isPersistedText(x.traceId,512)||x.id!==`replay-${x.traceId}`||
     !isPersistedText(x.contextKey,256)||!isPersistedText(x.nextContextKey,256)||!isPersistedAction(x.action)||
     !isPersistedUnit(x.reward)||!isPersistedUnit(x.target)||!isPersistedUnit(x.valueBefore)||!isPersistedUnit(x.valueAfter)||
     typeof x.tdError!=='number'||!Number.isFinite(x.tdError)||x.tdError< -1||x.tdError>1||
     !isPersistedUnit(x.learningRate)||!isPersistedCounter(x.at))return null;
  return {id:x.id,traceId:x.traceId,contextKey:x.contextKey,nextContextKey:x.nextContextKey,action:x.action,
    reward:x.reward,target:x.target,valueBefore:x.valueBefore,valueAfter:x.valueAfter,tdError:x.tdError,
    learningRate:x.learningRate,at:x.at};
}
function parseShadowRecord(value:unknown):ShadowEvaluationRecord|null{
  if(!isPlainRecord(value))return null;
  const x=value;
  if(!isPersistedText(x.traceId,512)||!isPersistedCounter(x.tick)||!isPersistedText(x.contextKey,256)||
     !isPersistedAction(x.actual)||!isPersistedAction(x.baseline)||typeof x.agreed!=='boolean'||
     x.agreed!==(x.actual===x.baseline)||!isPersistedUnit(x.actualSuccess)||
     typeof x.baselineWasBetterPrediction!=='boolean'||!isPersistedText(x.baselineReason,1024)||!isPersistedCounter(x.at))return null;
  return {traceId:x.traceId,tick:x.tick,contextKey:x.contextKey,actual:x.actual,baseline:x.baseline,agreed:x.agreed,
    actualSuccess:x.actualSuccess,baselineWasBetterPrediction:x.baselineWasBetterPrediction,
    baselineReason:x.baselineReason,at:x.at};
}
function parsePolicySkill(value:unknown):PolicySkillRecord|null{
  if(!isPlainRecord(value))return null;
  const x=value;
  if(!isPersistedText(x.id,512)||!isPersistedText(x.contextKey,256)||!isPersistedAction(x.action)||
     !isPersistedCounter(x.totalUses)||!isPersistedCounter(x.trainUses)||!isPersistedCounter(x.validationUses)||
     x.trainUses+x.validationUses>x.totalUses||!isPersistedUnit(x.trainSuccess01)||!isPersistedUnit(x.validationSuccess01)||
     !isPersistedUnit(x.confidence01)||!['candidate','promoted','rejected'].includes(String(x.status))||
     !isPersistedCounter(x.createdAt)||!isPersistedCounter(x.updatedAt)||!isPersistedCounter(x.validationWindowStartTick)||
     !isPersistedCounter(x.validationWindowEndTick)||x.validationWindowEndTick<x.validationWindowStartTick)return null;
  return {id:x.id,contextKey:x.contextKey,action:x.action,totalUses:x.totalUses,trainUses:x.trainUses,
    validationUses:x.validationUses,trainSuccess01:x.trainSuccess01,validationSuccess01:x.validationSuccess01,
    confidence01:x.confidence01,status:x.status as PolicySkillRecord['status'],createdAt:x.createdAt,updatedAt:x.updatedAt,
    validationWindowStartTick:x.validationWindowStartTick,validationWindowEndTick:x.validationWindowEndTick};
}
function parseAblation(value:unknown):AblationRecord|null{
  if(!isPlainRecord(value))return null;
  const x=value;
  if(!isPersistedText(x.traceId,512)||!isPersistedCounter(x.tick)||x.module!=='adaptive-policy'||
     !isPersistedAction(x.actual)||!isPersistedAction(x.ablated)||typeof x.changed!=='boolean'||
     x.changed!==(x.actual!==x.ablated)||!isPersistedUnit(x.scoreLoss01)||!isPersistedText(x.reason,1024)||
     !isPersistedCounter(x.at))return null;
  return {traceId:x.traceId,tick:x.tick,module:'adaptive-policy',actual:x.actual,ablated:x.ablated,
    changed:x.changed,scoreLoss01:x.scoreLoss01,reason:x.reason,at:x.at};
}
function parseEvidenceDebt(value:unknown):EvidenceDebtItem|null{
  if(!isPlainRecord(value))return null;
  const x=value;
  if(!isPersistedText(x.id,768)||!isPersistedText(x.contextKey,256)||!isPersistedAction(x.action)||
     !isPersistedUnit(x.priority01)||!isPersistedUnit(x.uncertainty01)||!isPersistedUnit(x.estimatedVerificationCost01)||
     !isPersistedUnit(x.informationGainPerCost01)||!isPersistedText(x.reason,1024)||
     !isPersistedCounter(x.createdAt)||!isPersistedCounter(x.lastSeenAt))return null;
  return {id:x.id,contextKey:x.contextKey,action:x.action,priority01:x.priority01,uncertainty01:x.uncertainty01,
    estimatedVerificationCost01:x.estimatedVerificationCost01,informationGainPerCost01:x.informationGainPerCost01,
    reason:x.reason,createdAt:x.createdAt,lastSeenAt:x.lastSeenAt};
}
function sanitizeChecksum(value:unknown,fallback:CognitiveChecksum):CognitiveChecksum{
  const x=isPlainRecord(value)?value:{};
  const digest=typeof x.digest==='string'&&(x.digest===''||/^[a-f0-9]{64}$/.test(x.digest))?x.digest:fallback.digest;
  return {digest,at:persistedTime(x.at,fallback.at),tick:persistedCounter(x.tick,fallback.tick),
    verifiedAt:persistedTime(x.verifiedAt,fallback.verifiedAt),
    verificationFailures:persistedCounter(x.verificationFailures,fallback.verificationFailures)};
}
function sanitizeMetrics(value:unknown,fallback:P23LearningMetrics):P23LearningMetrics{
  const x=isPlainRecord(value)?value:{};
  const result={...fallback};
  const counters:(keyof P23LearningMetrics)[]=[
    'outcomes','experiences','replayUpdates','shadowComparisons','decisionPredictionComparisons',
    'alternativePredictionComparisons','counterfactualComparisons','skillCandidates','skillPromotions',
    'skillRejections','ablationComparisons','checksumFailures','evidenceDebtOpen',
  ];
  const scores:(keyof P23LearningMetrics)[]=[
    'shadowAgreement01','decisionPredictionCalibration01','alternativePredictionCalibration01',
    'counterfactualCalibration01','ablationChangedRate01','learningDelta01','predictionError01',
    'recentPredictionError01','replayMeanAbsTdError01',
  ];
  const target=result as unknown as Record<string,number>;
  for(const key of counters)target[key]=persistedCounter(x[key],fallback[key]);
  for(const key of scores)target[key]=isPersistedUnit(x[key])?x[key] as number:fallback[key];
  target.lastLearningAt=persistedTime(x.lastLearningAt,fallback.lastLearningAt);
  return result;
}

export interface P23LearningState {
  version:1;
  /** Additive reviewed-correction memory; older version-1 snapshots default to empty. */
  correctionRules: CorrectionRuleMemorySnapshot;
  processedTraceIds:string[];
  replayedTraceIds:string[];
  experiences:LearningExperience[];
  replayUpdates:ReplayUpdateRecord[];
  shadow:ShadowEvaluationRecord[];
  skills:PolicySkillRecord[];
  ablations:AblationRecord[];
  evidenceDebt:EvidenceDebtItem[];
  checksum:CognitiveChecksum;
  metrics:P23LearningMetrics;
}

export const defaultP23Learning = ():P23LearningState => ({
  version:1,
  correctionRules:emptyCorrectionRuleMemorySnapshot(),
  processedTraceIds:[],
  replayedTraceIds:[],
  experiences:[],
  replayUpdates:[],
  shadow:[],
  skills:[],
  ablations:[],
  evidenceDebt:[],
  checksum:{digest:'',at:0,tick:0,verifiedAt:0,verificationFailures:0},
  metrics:{outcomes:0,experiences:0,replayUpdates:0,shadowComparisons:0,shadowAgreement01:0,decisionPredictionComparisons:0,decisionPredictionCalibration01:0,alternativePredictionComparisons:0,alternativePredictionCalibration01:0,counterfactualComparisons:0,counterfactualCalibration01:0,skillCandidates:0,skillPromotions:0,skillRejections:0,ablationComparisons:0,ablationChangedRate01:0,checksumFailures:0,evidenceDebtOpen:0,learningDelta01:0,predictionError01:0,recentPredictionError01:0,replayMeanAbsTdError01:0,lastLearningAt:0},
});

function contextKey(state:Pick<OrganismState,'needs'>):string {
  const n=state.needs;
  return `e${bucket(n.energy)}|c${bucket(n.cognitiveLoad)}|u${bucket(n.uncertainty)}|n${bucket(n.novelty)}|g${bucket(n.goalPressure)}|s${bucket(n.socialNeed)}`;
}

/** Conservative nearest-context matching: transfer is allowed only when at least five of six normalized context buckets match. */
function contextSimilarity(a:string,b:string):number {
  const left=a.split('|'), right=b.split('|');
  if(left.length!==6 || right.length!==6) return 0;
  let matches=0;
  for(let i=0;i<6;i++) if(left[i]===right[i]) matches++;
  return matches/6;
}

function baselineAction(state:OrganismState):{action:ActionKind;reason:string} {
  const n=state.needs;
  if (n.energy < .28 || n.cognitiveLoad > .82) return {action:'rest',reason:'resource preservation'};
  if (n.uncertainty > .68 && n.novelty < .45) return {action:'verify',reason:'uncertainty-first baseline'};
  if (n.novelty > .66) return {action:'explore',reason:'novelty-first baseline'};
  if (n.socialNeed > .62) return {action:'respond',reason:'social-need baseline'};
  if (n.goalPressure > .68) return {action:'verify',reason:'goal-pressure baseline'};
  return {action:'reflect',reason:'low-pressure conservative baseline'};
}

/** Reflective skill candidates are bounded before generation and before sandbox evaluation.
 * This is a resource/attack-surface guard, not a quality or promotion decision. */
export const MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES = 256 * 1024;

export function assertReflectiveSkillPayloadWithinBudget(value:unknown, label='candidate'):string {
  let detached: unknown;
  try { detached=snapshotPlainData(value); }
  catch (error) {
    const message=error instanceof Error?error.message:'';
    if(message==='independent-evaluator-snapshot-cycle') throw new Error('p23-canonicalization-circular-value');
    if(message==='independent-evaluator-snapshot-non-finite-number') throw new Error('p23-canonicalization-non-finite-number');
    throw new Error('p23-reflective-skill-payload-data-boundary-rejected:' + label);
  }
  const canonical = canonicalize(detached);
  const bytes = Buffer.byteLength(canonical, 'utf8');
  if (bytes > MAX_REFLECTIVE_SKILL_PAYLOAD_BYTES) {
    throw new Error('p23-reflective-skill-payload-too-large:' + label + ':' + bytes);
  }
  return canonical;
}

function canonicalize(
  value:unknown,
  ancestors = new Set<object>(),
  depth=0,
  budget:{nodes:number;textUnits:number}={nodes:0,textUnits:0},
):string {
  // Keep payload/evaluation fingerprints byte-compatible for JSON-like data while
  // refusing getters, sparse arrays, hidden/symbol fields, non-plain values and bombs.
  if (typeof value === 'string') {
    budget.textUnits+=value.length;
    if(budget.textUnits>4*1024*1024)throw new Error('p23-canonicalization-size-limit');
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('p23-canonicalization-non-finite-number');
  }
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('p23-canonicalization-value-not-json-serializable');
    return encoded;
  }
  if(depth>64||budget.nodes>=100_000)throw new Error('p23-canonicalization-size-limit');
  budget.nodes++;
  if (ancestors.has(value)) throw new Error('p23-canonicalization-circular-value');
  const isArray=Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if(isArray&&prototype!==Array.prototype)throw new Error('p23-canonicalization-array-prototype-invalid');
  if (!isArray && prototype !== Object.prototype && prototype !== null) {
    throw new Error('p23-canonicalization-non-plain-object');
  }
  ancestors.add(value);
  try {
    if (isArray) {
      const keys=Reflect.ownKeys(value);
      const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
      const length=lengthDescriptor?.value;
      if(!lengthDescriptor||!Number.isSafeInteger(length)||length<0||length>100_000||keys.length!==length+1) {
        throw new Error('p23-canonicalization-array-shape-invalid');
      }
      const encoded:string[]=[];
      for(let index=0;index<length;index++){
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        if(!descriptor||!('value' in descriptor)||descriptor.get||descriptor.set||!descriptor.enumerable) {
          throw new Error('p23-canonicalization-array-entry-invalid');
        }
        encoded.push(canonicalize(descriptor.value,ancestors,depth+1,budget));
      }
      return '['+encoded.join(',')+']';
    }
    const keys=Reflect.ownKeys(value);
    const fields:Array<[string,unknown]>=[];
    for(const key of keys){
      if(typeof key!=='string')throw new Error('p23-canonicalization-symbol-key-invalid');
      budget.textUnits+=key.length;
      if(budget.textUnits>4*1024*1024)throw new Error('p23-canonicalization-size-limit');
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!('value' in descriptor)||descriptor.get||descriptor.set) {
        throw new Error('p23-canonicalization-accessor-invalid');
      }
      if(!descriptor.enumerable)continue;
      if(descriptor.value===undefined)continue;
      fields.push([key,descriptor.value]);
    }
    fields.sort(([a],[b])=>a<b?-1:a>b?1:0);
    return '{'+fields.map(([key,fieldValue])=>JSON.stringify(key)+':'+canonicalize(fieldValue,ancestors,depth+1,budget)).join(',')+'}';
  } finally {
    ancestors.delete(value);
  }
}

export class P23LearningEngine {
  private state = defaultP23Learning();
  private correctionRuleMemory = new CorrectionRuleMemory();
  private replaySelectionOptions: ReplaySelectionOptions = { maxBatchSize:64, recentQuota:32 };
  private verifiedSkillStore: VersionedSkillCandidateStore | null = null;
  private learningFitnessJournal: LearningFitnessJournalSink | null = null;
  private learningLifecycleJournal: LearningLifecycleJournalSink | null = null;

  /** Configure a bounded replay ablation; defaults remain 64 total / 32 recent. */
  configureReplaySelection(options: ReplaySelectionOptions):void {
    const requestedCapacity = options.maxBatchSize === undefined ? 64 : Math.floor(Number.isFinite(options.maxBatchSize) ? options.maxBatchSize : 64);
    const maxBatchSize = Math.max(1, Math.min(64, requestedCapacity));
    const requestedRecent = options.recentQuota === undefined ? Math.floor(maxBatchSize / 2) : Math.floor(Number.isFinite(options.recentQuota) ? options.recentQuota : Math.floor(maxBatchSize / 2));
    this.replaySelectionOptions = { maxBatchSize, recentQuota:Math.max(0, Math.min(maxBatchSize, requestedRecent)) };
  }

  restore(raw?:Partial<P23LearningState>|null):void {
    const d=defaultP23Learning();
    if(raw!==undefined&&raw!==null&&!isPlainRecord(raw))throw new TypeError('P23 persisted learning state must be a plain object');
    const source=(raw??{}) as Partial<P23LearningState>;
    if(source.version!==undefined&&source.version!==1)throw new RangeError('unsupported P23 learning state version');
    // Read this additive field only through an own data descriptor: persisted getters must never execute.
    let rawCorrectionRules:unknown;
    try {
      const descriptor=Object.getOwnPropertyDescriptor(source,'correctionRules');
      rawCorrectionRules=descriptor&&'value'in descriptor?descriptor.value:undefined;
    } catch { rawCorrectionRules=undefined; }
    this.correctionRuleMemory.restore(rawCorrectionRules);
    // Parse untrusted persistence into fresh rows; newest-first histories retain their valid prefix.
    const experiences=sanitizeRows(source.experiences,1024,parseLearningExperience,row=>row.traceId);
    const replayUpdates=sanitizeRows(source.replayUpdates,512,parseReplayUpdate,row=>row.traceId);
    const shadow=sanitizeRows(source.shadow,512,parseShadowRecord,row=>row.traceId);
    const skills=sanitizeRows(source.skills,256,parsePolicySkill,row=>row.id);
    const ablations=sanitizeRows(source.ablations,512,parseAblation,row=>row.traceId);
    const evidenceDebt=sanitizeRows(source.evidenceDebt,256,parseEvidenceDebt,row=>row.id);
    // Reconcile dedupe caches with durable rows; restored rows must not be applied twice.
    // Persisted caches are already ordered newest-first. Preserve that order on
    // restore, then reconcile IDs recoverable from durable rows when a cache is absent.
    const processedTraceIds=sanitizeIdList([
      ...(Array.isArray(source.processedTraceIds)?source.processedTraceIds:[]),...experiences.map(row=>row.traceId),
    ],2048);
    const replayedTraceIds=sanitizeIdList([
      ...(Array.isArray(source.replayedTraceIds)?source.replayedTraceIds:[]),...replayUpdates.map(row=>row.traceId),
    ],2048);
    const checksum=sanitizeChecksum(source.checksum,d.checksum);
    const metrics=sanitizeMetrics(source.metrics,d.metrics);
    metrics.outcomes=Math.max(metrics.outcomes,experiences.length);
    metrics.evidenceDebtOpen=evidenceDebt.filter(row=>row.priority01>.45).length;
    metrics.skillCandidates=skills.filter(row=>row.status==='candidate').length;
    if(this.verifiedSkillStore)metrics.skillPromotions=this.verifiedSkillStore.snapshot().active.length;
    else metrics.skillPromotions=skills.filter(row=>row.status==='promoted').length;
    const restoredLastLearningAt=metrics.lastLearningAt;
    this.state={version:1,correctionRules:this.correctionRuleMemory.snapshot(),processedTraceIds,replayedTraceIds,experiences,replayUpdates,shadow,skills,ablations,evidenceDebt,checksum,metrics};
    this.recomputeMetrics();
    this.state.metrics.lastLearningAt=restoredLastLearningAt;
  }

  snapshot():P23LearningState {
    this.state.correctionRules=this.correctionRuleMemory.snapshot();
    return structuredClone(this.state);
  }

  /** Supply the trusted verifier used to authenticate human/reviewer correction evidence. */
  configureCorrectionReviewVerifier(verifier:CorrectionReviewVerifier):void {
    this.correctionRuleMemory.configureReviewVerifier(verifier);
  }

  /** Record an explicitly reviewed correction; raw outcome repetition is not accepted as correction evidence. */
  recordReviewedCorrection(observation:ReviewedCorrectionObservation):{duplicate:boolean;rule:CorrectionRuleAssessment} {
    const result=this.correctionRuleMemory.record(observation);
    this.state.correctionRules=this.correctionRuleMemory.snapshot();
    return result;
  }

  /** Read correction-rule maturity for the cognition/goal planner; recommendations never activate gates. */
  correctionRules():CorrectionRuleAssessment[] {
    return this.correctionRuleMemory.rules();
  }

  /**
   * Turn reviewed corrections into ordinary planner-compatible learning targets.
   * This surfaces repair work to the existing Pareto curriculum without making a
   * correction a policy override or silently activating a gate.
   */
  correctionLearningTargets(limit=8):LearningTarget[] {
    const severityValue:Record<CorrectionRuleAssessment['severity'],number>={
      low:.25,medium:.5,high:.8,critical:1,
    };
    const proposals=this.correctionRuleMemory.rules().map(rule=>{
      const rootCause=rule.rootCauses[0]??'other';
      const recurrence=Math.min(1,rule.observationCount/4);
      return {
        id:'correction-rule-'+rule.ruleId,
        family:'correction-'+rootCause,
        uncertainty01:1/(rule.observationCount+1),
        readiness01:rule.stage==='gate-candidate'?1:rule.observationCount>=2?.72:.45,
        transfer01:rootCause==='context-pressure'?.72:.42,
        novelty01:rootCause==='edge-case'?.62:.36,
        verificationCost01:rule.requiresIndependentApproval?.85:.45,
        repairValue01:Math.max(severityValue[rule.severity],.25+.55*recurrence),
        blocked:false,
      };
    });
    return rankLearningTargets(proposals,limit,'pareto-frontier');
  }

  /**
   * Diagnose a learning attempt without granting execution or promotion authority.
   * The report is an evidence-linked set of hypotheses, never proof of learning.
   * Input is detached through the shared trust boundary before any field is read.
   */
  diagnoseLearningAttempt(input: {
    taskId: string;
    objective: string;
    outcome: "success" | "failure" | "unknown";
    observedBehavior?: string;
    expectedBehavior?: string;
    errorMessages?: string[];
  }): {
    schemaVersion: 1;
    taskId: string;
    objective: string;
    outcome: "success" | "failure" | "unknown";
    failureSignals: string[];
    failureClasses: ReflectionFailureClass[];
    hypotheses: string[];
    nextExperiments: string[];
    confidence: number;
    confidenceSemantics: "heuristic-evidence-coverage-not-calibrated";
    evidenceFingerprint: string;
    promotionEligible: false;
  } {
    const data = snapshotPlainData<Record<string, unknown>>(input, {
      maxDepth: 4,
      maxNodes: 256,
      maxStringUnits: 16_384,
    });
    const normalize = (value: string): string =>
      value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    const requiredText = (field: string): string => {
      const value = data[field];
      if (typeof value !== "string") {
        throw new TypeError(`learning-attempt-diagnosis-${field}-must-be-string`);
      }
      return normalize(value);
    };
    const taskId = requiredText("taskId").slice(0, 200);
    const objective = requiredText("objective").slice(0, 1000);
    if (!taskId) throw new TypeError("learning-attempt-diagnosis-task-id-required");
    if (!objective) throw new TypeError("learning-attempt-diagnosis-objective-required");

    const outcomeValue = data.outcome;
    if (outcomeValue !== "success" && outcomeValue !== "failure" && outcomeValue !== "unknown") {
      throw new TypeError("learning-attempt-diagnosis-outcome-invalid");
    }
    const outcome = outcomeValue;
    if (data.observedBehavior !== undefined && typeof data.observedBehavior !== "string") {
      throw new TypeError("learning-attempt-diagnosis-observed-behavior-must-be-string");
    }
    if (data.expectedBehavior !== undefined && typeof data.expectedBehavior !== "string") {
      throw new TypeError("learning-attempt-diagnosis-expected-behavior-must-be-string");
    }
    if (data.errorMessages !== undefined && !Array.isArray(data.errorMessages)) {
      throw new TypeError("learning-attempt-diagnosis-errors-must-be-array");
    }
    const observed = normalize(typeof data.observedBehavior === "string" ? data.observedBehavior : "").slice(0, 2000);
    const expected = normalize(typeof data.expectedBehavior === "string" ? data.expectedBehavior : "").slice(0, 2000);
    const errors = (Array.isArray(data.errorMessages) ? data.errorMessages : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalize(value))
      .filter(Boolean)
      .slice(0, 12)
      .map((value) => value.slice(0, 500));

    const failureSignals: string[] = [];
    if (outcome === "failure") failureSignals.push("task_failed");
    if (errors.length) failureSignals.push("explicit_error_evidence");
    if (!observed) failureSignals.push("missing_observation");
    if (expected && observed && expected !== observed) failureSignals.push("expected_observed_mismatch");

    const failureClasses: ReflectionFailureClass[] = [];
    const addFailureClass = (value: ReflectionFailureClass | undefined): void => {
      if (value && !failureClasses.includes(value)) failureClasses.push(value);
    };
    for (const error of errors) addFailureClass(classifyLearningFailureReason(error));
    if (expected && observed && expected !== observed) addFailureClass("postcondition-mismatch");
    if (!observed || outcome === "unknown" || (outcome === "failure" && failureClasses.length === 0)) {
      addFailureClass("low-confidence");
    }

    const hypotheses: string[] = [];
    const nextExperiments: string[] = [];
    if (failureClasses.includes("safety-block")) {
      hypotheses.push("A safety or ethical gate blocked the trajectory; treat this as a hard constraint, not a performance defect.");
      nextExperiments.push("Pause performance optimization; review the safety decision independently before preparing a remediation candidate.");
    }
    if (!observed) {
      hypotheses.push("Insufficient observable evidence to diagnose the attempt reliably.");
      nextExperiments.push("Repeat with structured input, action, output, and error capture.");
    }
    if (errors.length) {
      hypotheses.push("A tool, runtime, or dependency error may have interrupted the intended trajectory.");
      nextExperiments.push("Reproduce the first error in isolation and vary one dependency at a time.");
    }
    if (expected && observed && expected !== observed) {
      hypotheses.push("Observed behavior diverges from the declared expected behavior.");
      nextExperiments.push("Create a minimal counterexample and compare candidate against baseline.");
    }
    if (outcome === "failure" && errors.length === 0) {
      hypotheses.push("Failure may stem from planning, reasoning, or acceptance criteria rather than a runtime exception.");
      nextExperiments.push("Add an explicit success predicate and capture intermediate decisions before retrying.");
    }
    if (outcome === "unknown") {
      hypotheses.push("Outcome is not labeled strongly enough to support a learning or promotion decision.");
      nextExperiments.push("Obtain an independent evaluator verdict before changing the active skill.");
    }
    if (outcome === "success" && failureSignals.length === 0) {
      hypotheses.push("Candidate success is not yet evidence of generalized skill improvement.");
      nextExperiments.push("Run held-out cases and regression tests against the previous baseline.");
    }

    // This is a heuristic evidence-coverage score, not a calibrated probability
    // and not a caller-provided confidence value.
    const confidence = clamp(
      0.15 + 0.10 + (outcome === "unknown" ? 0 : 0.10) +
      (observed ? 0.25 : 0) + (expected ? 0.20 : 0) +
      (errors.length ? 0.15 : 0) + (failureClasses.some((item) => item !== "low-confidence") ? 0.05 : 0)
    );
    const evidenceFingerprint = createHash("sha256").update(JSON.stringify({
      taskId, objective, outcome, observedBehavior: observed,
      expectedBehavior: expected, errorMessages: errors,
    })).digest("hex");

    return {
      schemaVersion: 1,
      taskId,
      objective,
      outcome,
      failureSignals,
      failureClasses,
      hypotheses,
      nextExperiments: Array.from(new Set(nextExperiments)),
      confidence,
      confidenceSemantics: "heuristic-evidence-coverage-not-calibrated",
      evidenceFingerprint,
      promotionEligible: false,
    };
  }

  /**
   * Opt into verified skill activation. When configured, the runtime resolver
   * uses only active versions from this store; locally inferred promotion labels
   * remain diagnostics and cannot affect action bias.
   */
  configureVerifiedSkillLifecycle(store:VersionedSkillCandidateStore):void {
    this.verifiedSkillStore = store;
    this.state.metrics.skillPromotions = store.snapshot().active.length;
  }

  /**
   * Attach an optional append-only, hash-chained journal for production fitness decisions.
   * Journal failures fail closed before promotion; no prompt/task/individual holdout rows are recorded.
   */
  configureLearningFitnessJournal(journal:LearningFitnessJournalSink|null):void {
    if(journal!==null && (!journal || typeof journal.recordFitnessDecision!=='function')) {
      throw new Error('P23 learning fitness journal sink invalid');
    }
    this.learningFitnessJournal=journal;
  }

  /** Configure the runtime default without replacing a sink explicitly supplied by the host. */
  configureLearningFitnessJournalIfAbsent(journal:LearningFitnessJournalSink):void {
    if(!journal || typeof journal.recordFitnessDecision!=='function') {
      throw new Error('P23 learning fitness journal sink invalid');
    }
    if(this.learningFitnessJournal===null) this.learningFitnessJournal=journal;
  }

  /** Safe aggregate view of fitness learning history for diagnostics/dashboard consumers. */
  learningFitnessJournalDiagnostics():
    LearningFitnessJournalDiagnostics |
    {configured:false;available:false} |
    {configured:true;available:false;reason:'readback-unavailable'|'journal-read-failed'} {
    const journal=this.learningFitnessJournal;
    if(!journal) return {configured:false,available:false};
    const snapshot=journal.snapshotDiagnostics;
    if(typeof snapshot!=='function') return {configured:true,available:false,reason:'readback-unavailable'};
    try {
      return snapshot.call(journal);
    } catch {
      // Diagnostics should surface a bounded health status; promotion itself remains
      // fail-closed because recordFitnessDecision errors are not swallowed.
      return {configured:true,available:false,reason:'journal-read-failed'};
    }
  }

  /** Attach an append-only journal for final activation/rejection outcomes. */
  configureLearningLifecycleJournal(journal:LearningLifecycleJournalSink|null):void {
    if(journal!==null && (!journal || typeof journal.recordLifecycleEvent!=='function')) {
      throw new Error('P23 learning lifecycle journal sink invalid');
    }
    this.learningLifecycleJournal=journal;
  }

  /** Configure the runtime default without replacing an explicitly supplied host sink. */
  configureLearningLifecycleJournalIfAbsent(journal:LearningLifecycleJournalSink):void {
    if(!journal || typeof journal.recordLifecycleEvent!=='function') {
      throw new Error('P23 learning lifecycle journal sink invalid');
    }
    if(this.learningLifecycleJournal===null) this.learningLifecycleJournal=journal;
  }

  /** Privacy-filtered aggregate status; pending intents indicate unresolved post-activation evidence. */
  learningLifecycleJournalDiagnostics():
    LearningLifecycleJournalDiagnostics |
    {configured:false;available:false} |
    {configured:true;available:false;reason:'readback-unavailable'|'journal-read-failed'} {
    const journal=this.learningLifecycleJournal;
    if(!journal) return {configured:false,available:false};
    if(typeof journal.snapshotDiagnostics!=='function') return {configured:true,available:false,reason:'readback-unavailable'};
    try {
      return journal.snapshotDiagnostics();
    } catch {
      return {configured:true,available:false,reason:'journal-read-failed'};
    }
  }

  /**
   * Reconcile uncertain activation attempts against the authoritative versioned
   * skill store. The journal's own event history is not promotion authority.
   * Only an exact skill/version/payload match can be recorded as active.
   */
  reconcileLearningLifecycleOutcomes():
    {configured:true;available:true;observedPending:number;observedUnknown:number;reconciledActive:number;reconciledNotCurrentlyActive:number;unresolved:number} |
    {configured:false;available:false;reason:'journal-unconfigured'|'store-unconfigured'} |
    {configured:true;available:false;reason:'readback-unavailable'|'journal-reconciliation-failed'} {
    const journal=this.learningLifecycleJournal;
    if(!journal) return {configured:false,available:false,reason:'journal-unconfigured'};
    if(!this.verifiedSkillStore) return {configured:false,available:false,reason:'store-unconfigured'};
    if(typeof journal.readAll!=='function') return {configured:true,available:false,reason:'readback-unavailable'};
    try {
      const entries:LearningLifecycleEventEntry[]=journal.readAll();
      const store=this.verifiedSkillStore.snapshot();
      const terminalAttempts=new Set(entries.filter(entry =>
        entry.event==='promotion-rejected' ||
        entry.event==='activation-confirmed' ||
        entry.event==='activation-failed' ||
        entry.event==='activation-reconciled-active' ||
        entry.event==='activation-reconciled-not-currently-active',
      ).map(entry=>entry.attemptId));
      const unknownByAttempt=new Map(entries
        .filter(entry=>entry.event==='activation-outcome-unknown')
        .map(entry=>[entry.attemptId,entry] as const));
      // An abrupt process exit can leave only the durable intent. Reconcile it too,
      // but prefer the explicit unknown event when one exists for the same attempt.
      const pendingIntents=entries.filter(entry =>
        entry.event==='activation-intent' && !terminalAttempts.has(entry.attemptId),
      );
      let reconciledActive=0;
      let reconciledNotCurrentlyActive=0;
      let unresolved=0;
      for(const intent of pendingIntents) {
        const event=unknownByAttempt.get(intent.attemptId) ?? intent;
        const candidate=store.candidates.find(item =>
          item.candidateId===event.candidateId &&
          item.skillId===event.skillId &&
          item.version===event.candidateVersion &&
          item.payloadFingerprint===event.payloadFingerprint,
        );
        if(!candidate) {
          unresolved++;
          continue;
        }
        const active=store.active.find(item =>
          item.skillId===event.skillId &&
          item.version===event.candidateVersion &&
          item.payloadFingerprint===event.payloadFingerprint,
        );
        const common={
          recordedAt:now(),
          attemptId:event.attemptId,
          candidateId:event.candidateId,
          skillId:event.skillId,
          candidateVersion:event.candidateVersion,
          payloadFingerprint:event.payloadFingerprint,
          evaluationFingerprint:event.evaluationFingerprint,
          planFingerprint:event.planFingerprint,
          environmentFingerprint:event.environmentFingerprint,
        };
        if(active) {
          journal.recordLifecycleEvent({
            ...common,
            event:'activation-reconciled-active',
            reasonCodes:[],
            activatedVersion:active.version,
          });
          reconciledActive++;
        } else if(candidate.status!=='active') {
          journal.recordLifecycleEvent({
            ...common,
            event:'activation-reconciled-not-currently-active',
            reasonCodes:['store-confirms-not-currently-active'],
            activatedVersion:null,
          });
          reconciledNotCurrentlyActive++;
        } else {
          // An active candidate without the matching active record is inconsistent;
          // never turn it into a success or a failure based on an incomplete snapshot.
          unresolved++;
        }
      }
      return {
        configured:true,
        available:true,
        observedPending:pendingIntents.length,
        observedUnknown:pendingIntents.filter(intent=>unknownByAttempt.has(intent.attemptId)).length,
        reconciledActive,
        reconciledNotCurrentlyActive,
        unresolved,
      };
    } catch {
      return {configured:true,available:false,reason:'journal-reconciliation-failed'};
    }
  }

  /** Read-only view of the durable staged/active skill lifecycle; null means not configured. */
  verifiedSkillCandidateSnapshot() {
    return this.verifiedSkillStore?.snapshot() ?? null;
  }

  /**
   * Run the Hermes-inspired multi-axis candidate assessment from the canonical
   * learning engine. This is deliberately diagnostic-only: trial reports are not
   * signed outcome artifacts, so this method cannot stage, approve, or activate
   * a skill. The authenticated outcome ledger remains the promotion authority.
   */
  evaluateReflectiveSkillCandidate(
    baseline: { validation: SkillLearnBenchCandidateEvaluation['reports']; holdout: SkillLearnBenchCandidateEvaluation['reports'] },
    candidate: { validation: SkillLearnBenchCandidateEvaluation['reports']; holdout: SkillLearnBenchCandidateEvaluation['reports'] },
    options: SkillLearnBenchCandidateGateOptions = {},
  ): SkillLearnBenchCandidateGateReport {
    return evaluateSkillLearnBenchCandidate(baseline, candidate, options);
  }

  /**
   * Convert candidate fitness into concrete, evidence-linked revision targets.
   * Safety failures suppress all performance tuning; this plan never mutates a skill.
   */
  planReflectiveSkillRevision(
    candidateEvaluation:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    fitness:Readonly<SkillLearnBenchCandidateGateReport>,
  ):SkillRevisionPlan {
    return planSkillRevision(candidateEvaluation.validation,candidateEvaluation.holdout,fitness);
  }

  /**
   * Request a revision from the application's configured skill generator and stage
   * its output through the canonical verified-candidate lifecycle. The generator
   * receives validation evidence only. Holdout scores and case data are gate-only and
   * remain opaque to optimization to prevent iterative tuning against the test set.
   */
  async generateAndStageReflectiveSkillRevision(
    proposal:VerifiedSkillPromotionProposal,
    skillId:string,
    sourceCandidateId:string,
    rawBaseline:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    rawCandidateEvaluation:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    generate:(request:{
      sourcePayload:unknown;
      datasetFingerprint:string;
      optimizerInstruction:string;
      validationEvidence:SkillLearnBenchCandidateEvaluation['reports'];
      targets:SkillRevisionPlan['targets'];
      holdoutPolicy:{resultsWithheld:true;requiresFreshIndependentEvaluation:true};
    })=>Promise<unknown>|unknown,
    evaluateRevisedCandidate:RevisedCandidateEvaluator,
    rawOptions:SkillLearnBenchCandidateGateOptions={},
    sourceEvidenceFingerprint?: string,
  ):Promise<{candidate:VersionedSkillCandidate;fitness:SkillLearnBenchCandidateGateReport;plan:SkillRevisionPlan}> {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    if(sourceEvidenceFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(sourceEvidenceFingerprint)) {
      throw new Error('repair evidence fingerprint must be a canonical SHA-256 digest');
    }
    if(typeof generate!=='function') throw new Error('configured skill revision generator is required');
    if(typeof evaluateRevisedCandidate!=='function') throw new Error('independent post-generation candidate evaluator is required');
    // Reject unauthentic or failed promotion evidence before spending resources on
    // model generation. The store repeats this check at staging as a second boundary.
    if(!isAuthenticVerifiedSkillPromotionProposal(proposal) || proposal.schemaVersion!==1 ||
       proposal.gate?.accepted!==true || proposal.canActivateAutomatically!==false ||
       proposal.authenticatedEvidenceRows<1 || proposal.unauthenticatedEvidenceRows!==0 ||
       !/^[a-f0-9]{64}$/.test(proposal.datasetFingerprint) ||
       !/^[a-f0-9]{64}$/.test(proposal.proposalId) || !/^[a-f0-9]{64}$/.test(proposal.outcomeFingerprint)) {
      throw new Error('reflective revision requires an authentic accepted proposal backed exclusively by authenticated evidence');
    }
    let baseline: {validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']};
    let candidateEvaluation: {validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']};
    let options: SkillLearnBenchCandidateGateOptions;
    try {
      baseline=snapshotPlainData(rawBaseline) as typeof rawBaseline;
      candidateEvaluation=snapshotPlainData(rawCandidateEvaluation) as typeof rawCandidateEvaluation;
      options=snapshotPlainData(rawOptions) as SkillLearnBenchCandidateGateOptions;
    } catch {
      throw new Error('reflective revision input data-boundary rejected');
    }
    if(!baseline||typeof baseline!=='object'||Array.isArray(baseline)||
       !candidateEvaluation||typeof candidateEvaluation!=='object'||Array.isArray(candidateEvaluation)||
       !options||typeof options!=='object'||Array.isArray(options)) {
      throw new Error('reflective revision input data-boundary rejected');
    }
    const source=this.verifiedSkillStore.snapshot().candidates.find(item=>item.candidateId===sourceCandidateId);
    if(!source || source.skillId!==skillId || source.status==='rolled-back') {
      throw new Error('reflective revision source candidate is missing, mismatched, or rolled back');
    }
    const sourceCanonicalPayload=assertReflectiveSkillPayloadWithinBudget(source.payload,'source');
    const fitness=this.evaluateReflectiveSkillCandidate(baseline,candidateEvaluation,options);
    const plan=this.planReflectiveSkillRevision(candidateEvaluation,fitness);
    if(plan.blockedBySafety) throw new Error('reflective revision blocked: resolve safety violations before performance optimization');
    if(plan.targets.length===0) throw new Error('reflective revision has no evidence-backed target; no candidate was staged');
    const rawGeneratedPayload=await generate({
      sourcePayload:snapshotPlainData(source.payload),
      datasetFingerprint:proposal.datasetFingerprint,
      optimizerInstruction:plan.optimizerInstruction,
      validationEvidence:snapshotPlainData(candidateEvaluation.validation) as SkillLearnBenchCandidateEvaluation['reports'],
      targets:snapshotPlainData(plan.targets) as SkillRevisionPlan['targets'],
      // Holdout results are gate-only. Never feed their scores, direction, or case data back into optimization.
      holdoutPolicy:{resultsWithheld:true,requiresFreshIndependentEvaluation:true},
    });
    let revisedPayload: unknown;
    try { revisedPayload=snapshotPlainData(rawGeneratedPayload); }
    catch { throw new Error('skill revision generator returned data outside the plain-data boundary'); }
    if(revisedPayload===undefined || revisedPayload===null || (typeof revisedPayload==='string'&&!revisedPayload.trim())) {
      throw new Error('skill revision generator returned an empty payload');
    }
    const canonicalPayload=assertReflectiveSkillPayloadWithinBudget(revisedPayload,'generated');
    // Do not spend an independent sandbox evaluation on a no-op artifact. The
    // staging method repeats this invariant after evaluation as a second boundary.
    if(canonicalPayload===sourceCanonicalPayload) {
      throw new Error('reflective revision payload is unchanged from its source candidate');
    }
    const payloadFingerprint=createHash('sha256').update(canonicalPayload).digest('hex');
    const rawFresh=await evaluateRevisedCandidate({
      payload:snapshotPlainData(revisedPayload),
      payloadFingerprint,
      baseline:snapshotPlainData(baseline) as typeof baseline,
      previousEvaluation:snapshotPlainData(candidateEvaluation) as typeof candidateEvaluation,
    });
    let fresh: Awaited<ReturnType<RevisedCandidateEvaluator>>;
    try { fresh=snapshotPlainData(rawFresh) as Awaited<ReturnType<RevisedCandidateEvaluator>>; }
    catch { throw new Error('independent evaluator returned data outside the plain-data boundary'); }
    if(!fresh || typeof fresh!=='object' || fresh.payloadFingerprint!==payloadFingerprint ||
       fresh.evaluationFingerprint!==createHash('sha256').update(canonicalize(fresh.evaluation)).digest('hex') ||
       !fresh.evaluation || !Array.isArray(fresh.evaluation.validation) || fresh.evaluation.validation.length===0 ||
       !Array.isArray(fresh.evaluation.holdout) || fresh.evaluation.holdout.length===0) {
      throw new Error('independent evaluator did not return non-empty validation/holdout reports bound to the exact generated payload');
    }
    return this.stageReflectiveSkillRevision(
      proposal,skillId,sourceCandidateId,revisedPayload,baseline,fresh.evaluation,fresh.evaluationFingerprint,options,
      sourceEvidenceFingerprint,
    );
  }

  /**
   * First-party wiring for the bounded local-model generator. Callers no longer need
   * to hand-write an adapter callback; the canonical evidence, shadow evaluation,
   * staging and promotion gates remain in generateAndStageReflectiveSkillRevision.
   */
  async generateAndStageReflectiveSkillRevisionWithLocalModel(
    provider:SkillRevisionChatProvider,
    proposal:VerifiedSkillPromotionProposal,
    skillId:string,
    sourceCandidateId:string,
    baseline:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    candidateEvaluation:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    evaluateRevisedCandidate:RevisedCandidateEvaluator,
    options:SkillLearnBenchCandidateGateOptions={},
    sourceEvidenceFingerprint?:string,
  ):Promise<{candidate:VersionedSkillCandidate;fitness:SkillLearnBenchCandidateGateReport;plan:SkillRevisionPlan}> {
    return this.generateAndStageReflectiveSkillRevision(
      proposal,skillId,sourceCandidateId,baseline,candidateEvaluation,
      request=>generateLocalSkillRevision(provider,request),
      evaluateRevisedCandidate,options,sourceEvidenceFingerprint,
    );
  }

  /**
   * Turn a Hermes-style revision plan into a new versioned shadow candidate.
   * The caller supplies the revised payload produced by its configured skill
   * generator; this engine never fabricates skill content or edits the current
   * candidate in place. Safety violations block staging, and the store still
   * requires an authentic evidence-backed proposal. Promotion remains separate.
   */
  private stageReflectiveSkillRevision(
    proposal:VerifiedSkillPromotionProposal,
    skillId:string,
    sourceCandidateId:string,
    revisedPayload:unknown,
    baseline:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    candidateEvaluation:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    evaluationFingerprint:string,
    options:SkillLearnBenchCandidateGateOptions={},
    sourceEvidenceFingerprint?: string,
  ):{candidate:VersionedSkillCandidate;fitness:SkillLearnBenchCandidateGateReport;plan:SkillRevisionPlan} {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    if(!skillId?.trim()) throw new Error('skillId must be non-empty');
    const fitness=this.evaluateReflectiveSkillCandidate(baseline,candidateEvaluation,options);
    const plan=this.planReflectiveSkillRevision(candidateEvaluation,fitness);
    if(plan.blockedBySafety) throw new Error('reflective revision blocked: resolve safety violations before performance optimization');
    if(plan.targets.length===0) throw new Error('reflective revision has no evidence-backed target; no candidate was staged');
    const current=this.verifiedSkillStore.snapshot();
    const source=current.candidates.find(item=>item.candidateId===sourceCandidateId);
    if(!source || source.skillId!==skillId || source.status==='rolled-back') {
      throw new Error('reflective revision source candidate is missing, mismatched, or rolled back');
    }
    const sourcePayload=assertReflectiveSkillPayloadWithinBudget(source.payload,'source');
    const revisedCanonical=assertReflectiveSkillPayloadWithinBudget(revisedPayload,'staged');
    if(sourcePayload===revisedCanonical) {
      throw new Error('reflective revision payload is unchanged from its source candidate');
    }
    if(!/^[a-f0-9]{64}$/.test(evaluationFingerprint)) throw new Error('independent candidate evaluation fingerprint is required');
    const revisionProvenance:SkillRevisionProvenance={
      schemaVersion:1,
      evaluationFingerprint,
      sourceCandidateId:source.candidateId,
      planFingerprint:createHash('sha256').update(canonicalize(plan)).digest('hex'),
      datasetFingerprint:proposal.datasetFingerprint,
      ...(sourceEvidenceFingerprint ? { sourceEvidenceFingerprint } : {}),
      dimensions:plan.targets.map(target=>target.dimension),
      createdAt:now(),
    };
    // stageCandidate validates proposal authenticity and authenticated evidence.
    // The revision lineage is persisted on the new version; shadow execution
    // and signed human approval are still required before runtime activation.
    const candidate=this.verifiedSkillStore.stageCandidate(proposal,skillId,revisedPayload,revisionProvenance);
    return {candidate,fitness,plan};
  }

  /**
   * Require every reflective trial to resolve to a verified signed shadow receipt.
   * This only validates provenance; it cannot stage, approve, or activate a skill.
   */
  bindReflectiveCandidateEvidence(
    reports: SkillLearnBenchCandidateEvaluation['reports'],
    observations: readonly SkillShadowObservation[],
    candidate: Readonly<VersionedSkillCandidate>,
    verifyEvidence: SkillShadowEvidenceVerifier,
  ): ReflectiveEvidenceBindingReport {
    return bindReflectiveReportsToVerifiedShadowEvidence(reports, observations, candidate, verifyEvidence);
  }

  /**
   * Bind P23 independent evaluation provenance to signed Hermes shadow receipts.
   * The evaluation envelope must already have passed its own digest and matched-plan
   * checks. This method adds receipt identity/outcome binding only; it does not
   * authenticate quality scores or grant candidate lifecycle authority.
   */
  bindIndependentEvaluationEvidence(
    evaluation: Parameters<typeof bindIndependentEvaluationToVerifiedShadowEvidence>[0],
    observations: readonly SkillShadowObservation[],
    candidate: Readonly<VersionedSkillCandidate>,
    verifyEvidence: SkillShadowEvidenceVerifier,
  ): ReflectiveEvidenceBindingReport {
    return bindIndependentEvaluationToVerifiedShadowEvidence(evaluation, observations, candidate, verifyEvidence);
  }

  stageVerifiedSkillCandidate(proposal:VerifiedSkillPromotionProposal, skill:PolicySkillRecord):VersionedSkillCandidate {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    const ratio01 = (value:number) => Number.isFinite(value) && value >= 0 && value <= 1;
    const safeCount = (value:number) => Number.isSafeInteger(value) && value >= 0;
    const validSkill = Boolean(skill) &&
      typeof skill.id === 'string' && skill.id.trim().length > 0 &&
      typeof skill.contextKey === 'string' && skill.contextKey.trim().length > 0 &&
      ACTIONS.includes(skill.action) &&
      skill.status === 'candidate' &&
      safeCount(skill.totalUses) && safeCount(skill.trainUses) && safeCount(skill.validationUses) &&
      skill.trainUses + skill.validationUses <= skill.totalUses &&
      ratio01(skill.trainSuccess01) && ratio01(skill.validationSuccess01) && ratio01(skill.confidence01) &&
      Number.isFinite(skill.createdAt) && skill.createdAt > 0 &&
      Number.isFinite(skill.updatedAt) && skill.updatedAt >= skill.createdAt &&
      safeCount(skill.validationWindowStartTick) && safeCount(skill.validationWindowEndTick) &&
      skill.validationWindowEndTick >= skill.validationWindowStartTick;
    if (!validSkill) throw new Error('candidate policy skill record is malformed or outside canonical P23 bounds');
    return this.verifiedSkillStore.stageCandidate(proposal,skill.id,skill);
  }

  recordVerifiedSkillShadow(candidateId:string,observation:SkillShadowObservation):VersionedSkillCandidate {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    return this.verifiedSkillStore.recordShadowObservation(candidateId,observation);
  }

  /**
   * Legacy report-only promotion route intentionally disabled.
   *
   * Signed shadow receipts bind candidate/run/task identity and binary outcome;
   * they do not authenticate trajectory or skill-quality metrics. A caller-owned
   * report array therefore cannot authorize production promotion, even if its
   * arithmetic is internally consistent. Use approveIndependentlyEvaluatedSkillCandidate,
   * which checks the fingerprinted independent evaluation envelope and its matched
   * task/seed/split/environment/manifest provenance before activation.
   *
   * @deprecated Report-only reflective fitness is advisory and must not promote.
   */
  approveReflectiveVerifiedSkillCandidate(
    candidateId:string,
    approval:SkillPromotionApproval,
    baseline:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    candidateEvaluation:{validation:SkillLearnBenchCandidateEvaluation['reports'];holdout:SkillLearnBenchCandidateEvaluation['reports']},
    verifyEvidence:SkillShadowEvidenceVerifier,
    minShadowRuns=3,
    options:SkillLearnBenchCandidateGateOptions={},
  ):{active:ActiveSkillVersion;fitness:SkillLearnBenchCandidateGateReport;evidenceBinding:ReflectiveEvidenceBindingReport} {
    throw new Error(
      'report-only reflective promotion is disabled; use approveIndependentlyEvaluatedSkillCandidate with a fingerprinted independent evaluation envelope',
    );
  }

  /**
   * Promotion entry point for a candidate evaluated by the independent P23
   * evaluator and joined to Hermes signed shadow receipts. It binds the exact
   * staged payload and persisted evaluation fingerprint before fitness gating;
   * the store still re-verifies receipts and authenticated approval at commit.
   */
  approveIndependentlyEvaluatedSkillCandidate(
    candidateId:string,
    approval:SkillPromotionApproval,
    baseline:Parameters<typeof compareMatchedIndependentEvaluations>[0],
    evaluation:Parameters<typeof compareMatchedIndependentEvaluations>[1] & Parameters<typeof bindIndependentEvaluationToVerifiedShadowEvidence>[0],
    verifyEvidence:SkillShadowEvidenceVerifier,
    minShadowRuns=3,
  ):{active:ActiveSkillVersion;fitness:SkillLearnBenchCandidateGateReport & {
    matchedTrialCount:number;
    matchedValidationTrialCount:number;
    matchedHoldoutTrialCount:number;
    validationFamiliesEvaluatedForSeedCoverage:number;
    holdoutFamiliesEvaluatedForSeedCoverage:number;
    validationFamiliesWithSufficientSeeds:number;
    holdoutFamiliesWithSufficientSeeds:number;
    validationFamilySeedCoverageFailures:number;
    holdoutFamilySeedCoverageFailures:number;
    validationFamiliesEvaluatedForConfidenceInterval:number;
    holdoutFamiliesEvaluatedForConfidenceInterval:number;
    validationFamilyConfidenceBoundFailures:number;
    holdoutFamilyConfidenceBoundFailures:number;
    validationFamilyMeanDelta:number|null;
    validationFamilyLowerBoundMinimum:number|null;
    validationFamilyUpperBoundMaximum:number|null;
    holdoutFamilyMeanDelta:number|null;
    holdoutFamilyLowerBoundMinimum:number|null;
    holdoutFamilyUpperBoundMaximum:number|null;
    environmentFingerprint:string;
    planFingerprint:string;
    learningRobustDiagnostics:{diagnosticOnly:true;validation:LearningRobustMetricSummary;holdout:LearningRobustMetricSummary};
  };evidenceBinding:ReflectiveEvidenceBindingReport} {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    // Detach hostile caller-owned envelopes before any property access. In
    // particular, do not let getters/Proxies run before the independent evaluator's
    // own canonical digest boundary is reached.
    try {
      baseline=snapshotPlainData(baseline) as typeof baseline;
      evaluation=snapshotPlainData(evaluation) as typeof evaluation;
    } catch {
      throw new Error('independent promotion input data-boundary rejected');
    }
    if(!evaluation || typeof evaluation!=='object' || !evaluation.evaluation ||
       typeof evaluation.evaluation!=='object' || !Array.isArray(evaluation.evaluation.validation) ||
       !Array.isArray(evaluation.evaluation.holdout) || !evaluation.evaluation.provenance ||
       !baseline || typeof baseline!=='object') {
      throw new Error('matched independent baseline and candidate envelopes are required');
    }
    const snapshot=this.verifiedSkillStore.snapshot();
    const staged=snapshot.candidates.find(item=>item.candidateId===candidateId);
    if(!staged || staged.status!=='shadow') throw new Error('independent promotion requires an existing shadow candidate');
    if(evaluation.payloadFingerprint!==staged.payloadFingerprint) {
      throw new Error('independent evaluation payload does not match the exact staged candidate');
    }
    if(!staged.revisionProvenance?.evaluationFingerprint ||
       staged.revisionProvenance.evaluationFingerprint!==evaluation.evaluationFingerprint) {
      throw new Error('independent evaluation fingerprint does not match staged candidate revision provenance');
    }
    // Never gate on a caller-supplied collection of baseline reports. The
    // evaluator proves one-to-one task/trial/seed/split joins and identical
    // plan/environment/manifest before computing the paired SkillLearnBench gate.
    // Production activation must exercise domain-level checks on BOTH splits:
    // canonical task-family labels come from the evaluator's trusted manifest,
    // not from the skill/caller. Diagnostic callers can remain legacy-compatible,
    // but the promotion authority must not silently skip family generalization.
    const policy=P23_REFLECTIVE_PROMOTION_POLICY;
    const fitness=compareMatchedIndependentEvaluations(baseline,evaluation,{
      minimumValidationFamilies:policy.minimumValidationFamilies,
      minimumHoldoutFamilies:policy.minimumHoldoutFamilies,
      minimumValidationFamilyTasks:policy.minimumValidationFamilyTasks,
      minimumHoldoutFamilyTasks:policy.minimumHoldoutFamilyTasks,
      maximumValidationTaskRegression01:policy.maximumValidationTaskRegression01,
      maximumValidationFamilyRegression01:policy.maximumValidationFamilyRegression01,
      maximumHoldoutRegression01:policy.maximumHoldoutRegression01,
      maximumHoldoutFamilyRegression01:policy.maximumHoldoutFamilyRegression01,
    },{
      minimumValidationFamilySeeds:policy.minimumValidationFamilySeeds,
      minimumHoldoutFamilySeeds:policy.minimumHoldoutFamilySeeds,
      confidenceLevel:policy.confidenceLevel,
      bootstrapResamples:policy.bootstrapResamples,
    });
    this.learningFitnessJournal?.recordFitnessDecision({
      recordedAt:now(),
      candidateId:staged.candidateId,
      payloadFingerprint:staged.payloadFingerprint,
      evaluationFingerprint:evaluation.evaluationFingerprint,
      planFingerprint:fitness.planFingerprint,
      environmentFingerprint:fitness.environmentFingerprint,
      decision:fitness.eligible?'fitness-accepted':'fitness-rejected',
      reasonCodes:[...fitness.reasons],
      matchedTrialCount:fitness.matchedTrialCount,
      matchedValidationTrialCount:fitness.matchedValidationTrialCount,
      matchedHoldoutTrialCount:fitness.matchedHoldoutTrialCount,
      minimumValidationFamilies:policy.minimumValidationFamilies,
      minimumHoldoutFamilies:policy.minimumHoldoutFamilies,
      minimumValidationFamilyTasks:policy.minimumValidationFamilyTasks,
      minimumHoldoutFamilyTasks:policy.minimumHoldoutFamilyTasks,
      maximumValidationTaskRegression01:policy.maximumValidationTaskRegression01,
      maximumValidationFamilyRegression01:policy.maximumValidationFamilyRegression01,
      maximumHoldoutRegression01:policy.maximumHoldoutRegression01,
      maximumHoldoutFamilyRegression01:policy.maximumHoldoutFamilyRegression01,
      minimumValidationFamilySeeds:policy.minimumValidationFamilySeeds,
      minimumHoldoutFamilySeeds:policy.minimumHoldoutFamilySeeds,
      confidenceLevel:policy.confidenceLevel,
      bootstrapResamples:policy.bootstrapResamples,
      validation:{
        familiesEvaluated:fitness.validationFamiliesEvaluatedForConfidenceInterval,
        familiesWithSufficientSeeds:fitness.validationFamiliesWithSufficientSeeds,
        seedCoverageFailures:fitness.validationFamilySeedCoverageFailures,
        confidenceBoundFailures:fitness.validationFamilyConfidenceBoundFailures,
        meanDelta:fitness.validationFamilyMeanDelta,
        minimumLowerBound:fitness.validationFamilyLowerBoundMinimum,
        maximumUpperBound:fitness.validationFamilyUpperBoundMaximum,
      },
      holdout:{
        familiesEvaluated:fitness.holdoutFamiliesEvaluatedForConfidenceInterval,
        familiesWithSufficientSeeds:fitness.holdoutFamiliesWithSufficientSeeds,
        seedCoverageFailures:fitness.holdoutFamilySeedCoverageFailures,
        confidenceBoundFailures:fitness.holdoutFamilyConfidenceBoundFailures,
        meanDelta:fitness.holdoutFamilyMeanDelta,
        minimumLowerBound:fitness.holdoutFamilyLowerBoundMinimum,
        maximumUpperBound:fitness.holdoutFamilyUpperBoundMaximum,
      },
    });
    const lifecycleAttemptId=randomUUID();
    if(!fitness.eligible) {
      try {
        this.learningLifecycleJournal?.recordLifecycleEvent({
          recordedAt:now(),
          attemptId:lifecycleAttemptId,
          candidateId:staged.candidateId,
          skillId:staged.skillId,
          candidateVersion:staged.version,
          payloadFingerprint:staged.payloadFingerprint,
          evaluationFingerprint:evaluation.evaluationFingerprint,
          planFingerprint:fitness.planFingerprint,
          environmentFingerprint:fitness.environmentFingerprint,
          event:'promotion-rejected',
          reasonCodes:['fitness-gate-rejected'],
          activatedVersion:null,
        });
      } catch { /* Preserve the authoritative rejection; no activation side effect occurred. */ }
      throw new Error(`independent reflective fitness gate rejected candidate: ${fitness.reasons.join(',')}`);
    }
    // Bind against the exact receipts persisted on the candidate; caller-supplied
    // alternate receipts cannot be used to pass this pre-promotion check.
    let evidenceBinding:ReflectiveEvidenceBindingReport;
    try {
      evidenceBinding=this.bindIndependentEvaluationEvidence(
        evaluation,staged.shadowObservations,staged,verifyEvidence,
      );
    } catch (error) {
      try {
        this.learningLifecycleJournal?.recordLifecycleEvent({
          recordedAt:now(),
          attemptId:lifecycleAttemptId,
          candidateId:staged.candidateId,
          skillId:staged.skillId,
          candidateVersion:staged.version,
          payloadFingerprint:staged.payloadFingerprint,
          evaluationFingerprint:evaluation.evaluationFingerprint,
          planFingerprint:fitness.planFingerprint,
          environmentFingerprint:fitness.environmentFingerprint,
          event:'promotion-rejected',
          reasonCodes:['verified-shadow-evidence-binding-error'],
          activatedVersion:null,
        });
      } catch { /* Preserve the authoritative binding error; no activation side effect occurred. */ }
      throw error;
    }
    if(!evidenceBinding.accepted) {
      try {
        this.learningLifecycleJournal?.recordLifecycleEvent({
          recordedAt:now(),
          attemptId:lifecycleAttemptId,
          candidateId:staged.candidateId,
          skillId:staged.skillId,
          candidateVersion:staged.version,
          payloadFingerprint:staged.payloadFingerprint,
          evaluationFingerprint:evaluation.evaluationFingerprint,
          planFingerprint:fitness.planFingerprint,
          environmentFingerprint:fitness.environmentFingerprint,
          event:'promotion-rejected',
          reasonCodes:['verified-shadow-evidence-binding-rejected'],
          activatedVersion:null,
        });
      } catch { /* Preserve the authoritative rejection; no activation side effect occurred. */ }
      throw new Error(`independent evidence binding rejected candidate: ${evidenceBinding.reasons.join(',')}`);
    }
    // Durable intent is required before the irreversible activation step. If this
    // write fails, activation is not attempted and the caller can safely retry.
    this.learningLifecycleJournal?.recordLifecycleEvent({
      recordedAt:now(),
      attemptId:lifecycleAttemptId,
      candidateId:staged.candidateId,
      skillId:staged.skillId,
      candidateVersion:staged.version,
      payloadFingerprint:staged.payloadFingerprint,
      evaluationFingerprint:evaluation.evaluationFingerprint,
      planFingerprint:fitness.planFingerprint,
      environmentFingerprint:fitness.environmentFingerprint,
      event:'activation-intent',
      reasonCodes:[],
      activatedVersion:null,
    });
    let active:ActiveSkillVersion;
    try {
      active=this.promoteVerifiedSkillCandidateAfterGate(candidateId,approval,minShadowRuns);
    } catch (error) {
      try {
        this.learningLifecycleJournal?.recordLifecycleEvent({
          recordedAt:now(),
          attemptId:lifecycleAttemptId,
          candidateId:staged.candidateId,
          skillId:staged.skillId,
          candidateVersion:staged.version,
          payloadFingerprint:staged.payloadFingerprint,
          evaluationFingerprint:evaluation.evaluationFingerprint,
          planFingerprint:fitness.planFingerprint,
          environmentFingerprint:fitness.environmentFingerprint,
          event:'activation-outcome-unknown',
          reasonCodes:['activation-result-uncertain'],
          activatedVersion:null,
        });
      } catch { /* Preserve the original activation failure; pending intent remains visible. */ }
      throw error;
    }
    try {
      this.learningLifecycleJournal?.recordLifecycleEvent({
        recordedAt:now(),
        attemptId:lifecycleAttemptId,
        candidateId:staged.candidateId,
        skillId:staged.skillId,
        candidateVersion:staged.version,
        payloadFingerprint:staged.payloadFingerprint,
        evaluationFingerprint:evaluation.evaluationFingerprint,
        planFingerprint:fitness.planFingerprint,
        environmentFingerprint:fitness.environmentFingerprint,
        event:'activation-confirmed',
        reasonCodes:[],
        activatedVersion:active.version,
      });
    } catch { /* Never turn a committed activation into a reported failure. Pending intent exposes missing final evidence. */ }
    return {active,fitness,evidenceBinding};
  }

  approveVerifiedSkillCandidate(
    candidateId:string,
    approval:SkillPromotionApproval,
    minShadowRuns=3,
  ):ActiveSkillVersion {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    const staged=this.verifiedSkillStore.snapshot().candidates.find(item=>item.candidateId===candidateId);
    // Reflective revisions carry evaluation provenance and must pass the matched
    // independent-evaluation gate above. Do not let callers skip it via this
    // lower-level compatibility API after shadow execution.
    if(staged?.revisionProvenance) {
      throw new Error('reflective revision candidates require the independent evaluation promotion gate');
    }
    return this.promoteVerifiedSkillCandidateAfterGate(candidateId,approval,minShadowRuns);
  }

  /** Finalize only after a public entry point has already enforced its policy gate. */
  private promoteVerifiedSkillCandidateAfterGate(
    candidateId:string,
    approval:SkillPromotionApproval,
    minShadowRuns:number,
  ):ActiveSkillVersion {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    let detachedApproval:SkillPromotionApproval;
    try { detachedApproval=snapshotPlainData(approval) as SkillPromotionApproval; }
    catch { throw new Error('skill promotion approval data-boundary rejected'); }
    if(!detachedApproval || typeof detachedApproval!=='object' || Array.isArray(detachedApproval)) {
      throw new Error('skill promotion approval data-boundary rejected');
    }
    const active=this.verifiedSkillStore.approveAndPromote(candidateId,detachedApproval,minShadowRuns);
    this.state.metrics.skillPromotions=this.verifiedSkillStore.snapshot().active.length;
    return active;
  }

  rollbackVerifiedSkillCandidate(candidateId:string,approval:SkillRollbackApproval):ActiveSkillVersion|null {
    if(!this.verifiedSkillStore) throw new Error('verified skill lifecycle store is not configured');
    const restored = this.verifiedSkillStore.rollback(candidateId,approval);
    this.state.metrics.skillPromotions = this.verifiedSkillStore.snapshot().active.length;
    return restored;
  }

  recordExperience(trace:OrganismDecisionTrace,stateAfter:OrganismState,outcome:{success:number;reward:number;surprise:number;notes?:unknown},policy:AdaptivePolicyEngine):void {
    if (!trace?.selected||!isPersistedText(trace.id,512)||!isPersistedCounter(trace.tick)||
        !isPersistedCounter(trace.createdAt)||!ACTIONS.includes(trace.selected.action)||
        !isPersistedUnit(trace.selected.predictedUtility)||!isPersistedUnit(trace.selected.confidence)||
        this.state.processedTraceIds.includes(trace.id)) return;
    // Outcome labels and predicted probabilities share a [0,1] contract. Do not
    // clamp malformed external feedback into apparently valid evidence.
    if (![outcome.success,outcome.reward,outcome.surprise].every(isPersistedUnit)) return;
    const key=contextKey(trace.stateBefore), nextKey=contextKey(stateAfter);
    const failureClass=classifyLearningFailureReason(outcome.notes);
    const record:LearningExperience={
      id:`exp-${trace.id}`,
      traceId:trace.id,
      tick:trace.tick,
      at:trace.createdAt,
      contextKey:key,
      nextContextKey:nextKey,
      action:trace.selected.action,
      predictedUtility:clamp(trace.selected.predictedUtility),
      predictedConfidence:clamp(trace.selected.confidence),
      success:clamp(outcome.success),
      reward:clamp(outcome.reward),
      surprise:clamp(outcome.surprise),
      outcomeAt:now(),
      ...(failureClass?{failureClass}:{}),
       goalPressure01:clamp(trace.stateBefore.needs.goalPressure),
       causalStrength01:clamp(trace.reasoningSignals?.causalConfidence01 ?? trace.reasoningSignals?.causalStrength01 ?? .5),
       replayFeatures01:[
         clamp(trace.stateBefore.needs.energy),clamp(trace.stateBefore.needs.cognitiveLoad),clamp(trace.stateBefore.needs.uncertainty),
         clamp(trace.stateBefore.needs.socialNeed),clamp(trace.stateBefore.needs.novelty),clamp(trace.stateBefore.needs.identityCoherence),
         clamp(trace.stateBefore.needs.goalPressure),clamp(trace.stateBefore.predictionError),
         clamp(trace.stateBefore.attentionBudget),clamp(trace.stateBefore.autonomyScore),
         clamp(trace.stateBefore.selfPredictionError),clamp(trace.stateBefore.lastPredictionConfidence),
         clamp(outcome.success),clamp(outcome.reward),clamp(outcome.surprise),
         clamp(1-Math.abs(clamp(outcome.success)-clamp(trace.selected.predictedUtility))),
       ],
    };
    this.state.experiences=[record,...this.state.experiences].slice(0,1024);
    this.state.processedTraceIds=[record.traceId,...this.state.processedTraceIds.filter(id=>id!==record.traceId)].slice(0,2048);
    this.state.metrics.outcomes++;
    this.state.metrics.experiences=this.state.experiences.length;
    this.state.metrics.lastLearningAt=now();
    this.updateEvidenceDebt(record);
    this.evaluateShadow(trace,outcome.success);
    this.evaluateAdaptiveAblation(trace, policy);
    this.recomputeSkills();
    this.recomputeMetrics();
  }

  replayPending(traces:OrganismDecisionTrace[],policy:AdaptivePolicyEngine):number {
    let updates=0;
    // Build a first-write-wins trace index once; replay batches can include many traces
    // and should not repeatedly scan the full experience store for the same identity.
    const experiencesByTraceId=new Map<string,LearningExperience>();
    for(const experience of this.state.experiences){
      if(!experiencesByTraceId.has(experience.traceId)) experiencesByTraceId.set(experience.traceId,experience);
    }
    const replayedTraceIds=new Set(this.state.replayedTraceIds);
    const eligible=traces.filter(trace=>{
      try {
        if(!trace?.selected||!trace.outcome||replayedTraceIds.has(trace.id))return false;
        const exp=experiencesByTraceId.get(trace.id);
        // A caller-supplied trace object is only a lookup handle, not the outcome
        // authority. Reject stale or same-ID/different-action/context rows before
        // their auxiliary features can influence replay selection.
        return Boolean(exp&&trace.id===exp.traceId&&trace.tick===exp.tick&&
          trace.selected.action===exp.action&&contextKey(trace.stateBefore)===exp.contextKey);
      } catch { return false; }
    });
    // Selection is shared with the standalone benchmark so production and evaluation
    // exercise the same policy. Recent quota is configurable at the selector boundary.
    const newestTick=eligible.reduce((latest,trace)=>Math.max(latest,trace.tick),0);
    const frequencies=new Map<string,number>();
    for(const trace of eligible){
      const key=`${contextKey(trace.stateBefore)}|${trace.selected!.action}`;
      frequencies.set(key,(frequencies.get(key)??0)+1);
    }
    const ranked=eligible.map(trace=>{
      const exp=experiencesByTraceId.get(trace.id)!;
      const key=`${exp.contextKey}|${exp.action}`;
      const priority=scoreReplayPriority(exp,newestTick,frequencies.get(key)??1);
      const priorUpdates=policy.estimate(exp.contextKey,exp.action,.5).updates;
      // Bridge Will-style goal relevance and spaced-repetition diminishing returns
      // into the actual production replay path. These signals rank samples only;
      // the recorded outcome remains the learning target and is not rewritten.
      return {
        trace,experience:exp,id:trace.id,tick:trace.tick,contextKey:exp.contextKey,action:exp.action,
        surprise:priority.priority01,
        novelty:priority.novelty01,
        salience:outcomeReplaySalience(exp.success,exp.predictedUtility),
        goalPriority:trace.stateBefore.needs.goalPressure,
        replayCount:priorUpdates,
      };
    });
    const metrics=this.state.metrics;
    const adaptiveOptions=adaptiveReplayOptions(this.replaySelectionOptions,{
      predictionError01:metrics.predictionError01,recentPredictionError01:metrics.recentPredictionError01,
      replayTdError01:metrics.replayMeanAbsTdError01,evidenceDebt01:clamp(metrics.evidenceDebtOpen/16),
      memoryPressure01:clamp(this.state.experiences.length/1024),energy01:1,
    },ranked.length);
    // Explicit replay controls define the hard ablation budget and recency quota;
    // adaptive health still influences ranking and age half-life, not these caps.
    const options:ReplaySelectionOptions={
      ...adaptiveOptions,
      maxBatchSize:Math.min(this.replaySelectionOptions.maxBatchSize??64,ranked.length),
      recentQuota:Math.min(this.replaySelectionOptions.recentQuota??32,this.replaySelectionOptions.maxBatchSize??64,ranked.length),
    };
    // Use the causal sampler as a bounded diversity prefilter, then retain the
    // adaptive multi-signal selector as the final authority for the replay batch.
    // This connects causal/recent-stratum coverage without discarding existing
    // salience, novelty, goal-priority, replay-count, and health-adaptive ranking.
    const causalCandidates=ranked.map(item=>{
      const trace=item.trace;
      const exp=item.experience;
      const needs=trace.stateBefore.needs;
      const causalStrength=clamp(exp.causalStrength01 ?? trace.reasoningSignals.causalConfidence01 ?? trace.reasoningSignals.causalStrength01 ?? .5);
      const learningQuality=clamp(1-Math.abs(exp.success-exp.predictedUtility));
      // New rows replay from the immutable feature snapshot stored with their
      // outcome. Older v1 rows predate that snapshot, so they use the matched trace
      // only as a compatibility fallback; their reward/labels still come from exp.
      const policyFeatures01=exp.replayFeatures01 ?? [
        clamp(needs.energy),clamp(needs.cognitiveLoad),clamp(needs.uncertainty),
        clamp(needs.socialNeed),clamp(needs.novelty),clamp(needs.identityCoherence),
        clamp(needs.goalPressure),clamp(trace.stateBefore.predictionError),
        clamp(trace.stateBefore.attentionBudget),clamp(trace.stateBefore.autonomyScore),
        clamp(trace.stateBefore.selfPredictionError),clamp(trace.stateBefore.lastPredictionConfidence),
        exp.success,exp.reward,exp.surprise,learningQuality,
      ];
      return {
        ...item,
        surprise01:clamp(item.surprise),
        causalStrength01:causalStrength,
        learningQuality01:learningQuality,
        replayPriority01:clamp(.60*item.surprise+.20*causalStrength+.20*learningQuality),
        goalPriority:exp.goalPressure01 ?? needs.goalPressure,
        policyFeatures01:policyFeatures01.map(clamp),
      };
    });
    const adaptiveCapacity=Math.max(1,Math.min(64,options.maxBatchSize??64));
    const causalCandidatesSelected=selectCausalReplayBatch(causalCandidates,{
      maxBatchSize:Math.min(128,Math.max(adaptiveCapacity,adaptiveCapacity*2)),
      recentQuota:Math.min(128,Math.max(0,(options.recentQuota??0)*2)),
    });
    const ordered=selectReplayBatch(causalCandidatesSelected,options);
    for (const item of ordered) {
      const trace=item.trace;
      const exp=item.experience;
      const before=policy.estimate(exp.contextKey,exp.action,.5);
      const nextValues=ACTIONS.map(a=>policy.estimate(exp.nextContextKey,a,.5).value);
      const target=bellmanTarget(exp.reward,nextValues,.76);
      const tdError=target-before.value;
      const lr=adaptiveReplayLearningRate({baseRate:.035,tdError:target-before.value,surprise01:exp.surprise,confidence01:exp.predictedConfidence,replayCount:before.updates});
      policy.update(exp.contextKey,exp.action,exp.reward,exp.nextContextKey,ACTIONS,lr,.76,exp.surprise);
      const after=policy.estimate(exp.contextKey,exp.action,.5);
      this.state.replayUpdates=[{
        id:`replay-${trace.id}`,
        traceId:trace.id,
        contextKey:exp.contextKey,
        nextContextKey:exp.nextContextKey,
        action:exp.action,
        reward:exp.reward,
        target,
        valueBefore:before.value,
        valueAfter:after.value,
        tdError,
        learningRate:lr,
        at:now(),
      },...this.state.replayUpdates].slice(0,512);
      this.state.replayedTraceIds=[trace.id,...this.state.replayedTraceIds].slice(0,2048);
      updates++;
    }
    if(updates){
      this.state.metrics.replayUpdates += updates;
      this.state.metrics.lastLearningAt=now();
      this.recomputeSkills();
      this.recomputeMetrics();
    }
    return updates;
  }

  evaluateShadow(trace:OrganismDecisionTrace,success:number):ShadowEvaluationRecord|null {
    if(!trace.selected) return null;
    const baseline=baselineAction(trace.stateBefore);
    const predictedByActual=trace.predictedOutcomes.find(x=>x.action===trace.selected!.action)?.utility ?? trace.selected.predictedUtility;
    const predictedByBaseline=trace.predictedOutcomes.find(x=>x.action===baseline.action)?.utility ?? .5;
    const rec:ShadowEvaluationRecord={
      traceId:trace.id,tick:trace.tick,contextKey:contextKey(trace.stateBefore),actual:trace.selected.action,baseline:baseline.action,agreed:trace.selected.action===baseline.action,
      actualSuccess:clamp(success),baselineWasBetterPrediction:predictedByBaseline>predictedByActual+.08,baselineReason:baseline.reason,at:now(),
    };
    this.state.shadow=[rec,...this.state.shadow.filter(x=>x.traceId!==trace.id)].slice(0,512);
    this.state.metrics.shadowComparisons=this.state.shadow.length;
    this.recomputeMetrics();
    return structuredClone(rec);
  }

  evaluateAdaptiveAblation(trace:OrganismDecisionTrace,policy:AdaptivePolicyEngine):AblationRecord|null {
    if(!trace.selected) return null;
    const key=contextKey(trace.stateBefore);
    const scores=trace.candidates.map(candidate=>{
      const adaptiveBias=policy.bias(key,candidate.action,candidate.predictedUtility);
      return {...candidate, ablatedScore:candidate.score-adaptiveBias};
    });
    scores.sort((a,b)=>b.ablatedScore-a.ablatedScore);
    const ablated=scores[0]?.action ?? trace.selected.action;
    const actualScore=trace.candidates.find(c=>c.action===trace.selected!.action)?.score ?? trace.selected.score;
    const ablatedScore=scores.find(c=>c.action===trace.selected!.action)?.ablatedScore ?? actualScore;
    const rec:AblationRecord={traceId:trace.id,tick:trace.tick,module:'adaptive-policy',actual:trace.selected.action,ablated,changed:ablated!==trace.selected.action,scoreLoss01:clamp(actualScore-ablatedScore),reason:ablated!==trace.selected.action?'adaptive-policy changed action ranking':'adaptive-policy did not change top action',at:now()};
    this.state.ablations=[rec,...this.state.ablations.filter(x=>x.traceId!==trace.id)].slice(0,512);
    this.state.metrics.ablationComparisons=this.state.ablations.length;
    this.recomputeMetrics();
    return structuredClone(rec);
  }

  private recomputeSkills():void {
    const groups=new Map<string,LearningExperience[]>();
    for(const e of this.state.experiences){const key=`${e.contextKey}|${e.action}`; const arr=groups.get(key)??[]; arr.push(e); groups.set(key,arr);}
    let candidates=0;
    for(const [key,itemsRaw] of groups){
      const items=itemsRaw.slice().sort((a,b)=>a.tick-b.tick);
      if(items.length<8) continue;
      const train=Math.max(4,Math.floor(items.length*.6));
      const trainItems=items.slice(0,train), validation=items.slice(train);
      const trainSuccess=trainItems.reduce((s,x)=>s+x.success,0)/trainItems.length;
      const valSuccess=validation.reduce((s,x)=>s+x.success,0)/validation.length;
      const confidence=clamp(.25+Math.min(.5,items.length/24*.5)*(1-Math.abs(valSuccess-trainSuccess)));
      const action=items[0].action;
      const id=`p23-skill-${key}`;
      const existing=this.state.skills.find(s=>s.id===id);
      const validationLowerBound=wilsonLowerBound(Math.round(valSuccess*validation.length),validation.length);
      const calibrated=calibratedConfidence(items.length,valSuccess,Math.abs(valSuccess-trainSuccess));
      const status:PolicySkillRecord['status']=valSuccess<=.42 && validation.length>=4 ? 'rejected' :
        valSuccess>=.70 && trainSuccess>=.64 && confidence>=.4 && validationLowerBound>=.30 && calibrated>=.4 ? 'promoted' : 'candidate';
      if(status==='candidate') candidates++;
      const record:PolicySkillRecord={id,contextKey:items[0].contextKey,action,totalUses:items.length,trainUses:train,validationUses:validation.length,trainSuccess01:clamp(trainSuccess),validationSuccess01:clamp(valSuccess),confidence01:confidence,status,createdAt:existing?.createdAt??now(),updatedAt:now(),validationWindowStartTick:validation[0]?.tick??items[0].tick,validationWindowEndTick:validation.at(-1)?.tick??items.at(-1)!.tick};
      if(!existing || status!==existing.status || record.totalUses!==existing.totalUses || record.validationWindowEndTick!==existing.validationWindowEndTick || Math.abs(record.validationSuccess01-existing.validationSuccess01)>.02){
        const idx=this.state.skills.findIndex(s=>s.id===id); if(idx>=0)this.state.skills[idx]=record; else this.state.skills.unshift(record);
      }
    }
    this.state.skills=this.state.skills.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,256);
    this.state.metrics.skillCandidates=candidates;
    this.state.metrics.skillPromotions=this.verifiedSkillStore ? this.verifiedSkillStore.snapshot().active.length : this.state.skills.filter(s=>s.status==='promoted').length;
    this.state.metrics.skillRejections=this.state.skills.filter(s=>s.status==='rejected').length;
  }

  private effectiveSkills():PolicySkillRecord[] {
    if(!this.verifiedSkillStore) return this.state.skills;
    return this.verifiedSkillStore.snapshot().active.flatMap(active=>{
      const value=active.payload as Partial<PolicySkillRecord>|null;
      if(!value || value.id!==active.skillId || typeof value.contextKey!=='string' ||
         !ACTIONS.includes(value.action as ActionKind) || !Number.isFinite(value.confidence01) ||
         !Number.isFinite(value.validationSuccess01) || !Number.isSafeInteger(value.validationUses) ||
         (value.validationUses as number)<1) return [];
      return [{...(value as PolicySkillRecord),status:'promoted' as const,updatedAt:active.activatedAt}];
    });
  }

  topSkills(limit=12):PolicySkillRecord[]{return this.effectiveSkills().filter(s=>s.status==='promoted').slice(0,limit).map(x=>structuredClone(x));}
  skillBias(state:OrganismState, action:ActionKind):number {
    const key=contextKey(state);
    const skills=this.effectiveSkills();
    const exact=skills.find(x=>x.contextKey===key&&x.action===action);
    if(exact){
      // Skills are durable but not immortal: stale evidence gradually loses
      // influence, reaching zero after 180 days without fresh validation.
      const ageMs=Math.max(0,now()-exact.updatedAt);
      const retention=ageMs>=180*24*60*60*1000?0:1-forgettingRisk({lastValidatedAt:exact.updatedAt,now:now(),halfLifeMs:30*24*60*60*1000,gapMs:ageMs});
      if(exact.status==='promoted') return clamp(exact.confidence01*.05*retention);
      if(exact.status==='rejected') return retention===0?0:-clamp(exact.confidence01*.03*retention);
      return 0;
    }

    // Retrieval-augmented transfer ranks the small evidence-backed skill subset first.
    // The legacy conservative neighbor path remains as a fallback if no candidate qualifies.
    const retrievedBias = retrievedSkillBias({ contextKey:key, action, now:now(), limit:5 }, skills);
    if (retrievedBias !== 0) return retrievedBias;

    // Transfer only across a tightly neighboring context and only from held-out
    // evidence. Positive evidence wins conflicts; negative transfer is smaller and
    // acts only when no validated positive neighbor exists, limiting overreaction.
    let bestPositive=0;
    let bestNegative=0;
    for(const row of skills){
      if(row.action!==action || row.validationUses<4 || row.confidence01<.4) continue;
      const similarity=contextSimilarity(key,row.contextKey);
      if(similarity<MIN_TRANSFER_SIMILARITY01) continue;
      const support=Math.min(1,row.validationUses/8);
      const calibratedTransfer=transferConfidence({shared:Math.round(similarity*6),total:6,sourceValidation01:row.validationSuccess01,independentN:row.validationUses,distance01:1-similarity});
      if(row.status==='promoted' && row.validationSuccess01>=.70){
        const transfer=clamp(row.confidence01*calibratedTransfer*.02*((similarity-.70)/.30)*support);
        if(transfer>bestPositive) bestPositive=transfer;
      } else if(row.status==='rejected' && row.validationSuccess01<=.42){
        // A rejected skill is evidence against this action in similar contexts,
        // but it must never penalize as strongly as a locally validated success.
        const penalty=clamp(row.confidence01*calibratedTransfer*.008*((similarity-.70)/.30)*support);
        if(penalty>bestNegative) bestNegative=penalty;
      }
    }
    return bestPositive>0 ? bestPositive : (bestNegative>0 ? -bestNegative : 0);
  }
  verificationPressure01():number {
    return clamp(this.state.evidenceDebt.filter(x=>x.priority01>.45).reduce((m,x)=>Math.max(m,repairOpportunity({recurrence:1,severity01:x.priority01,uncertainty01:x.uncertainty01,expectedGain01:x.informationGainPerCost01,cost01:x.estimatedVerificationCost01})),0));
  }

  evidenceDebt(limit=12):EvidenceDebtItem[]{return this.state.evidenceDebt.slice().sort((a,b)=>repairOpportunity({recurrence:1,severity01:b.priority01,uncertainty01:b.uncertainty01,expectedGain01:b.informationGainPerCost01,cost01:b.estimatedVerificationCost01})-repairOpportunity({recurrence:1,severity01:a.priority01,uncertainty01:a.uncertainty01,expectedGain01:a.informationGainPerCost01,cost01:a.estimatedVerificationCost01})).slice(0,limit).map(x=>structuredClone(x));}

  /**
   * Turn the newest persisted interaction outcomes into diagnostic hypotheses.
   * This is a read-only bridge from actual replay rows to reflection; it never
   * writes labels, changes weights, or grants candidate-promotion authority.
   */
  diagnoseRecentLearningAttempts(limit=20) {
    const boundedLimit=Math.max(0,Math.min(100,Number.isFinite(limit)?Math.floor(limit):20));
    if(boundedLimit===0)return [];
    // Experience history is canonical newest-first: recordExperience prepends,
    // and restore preserves the validated newest-first prefix. Select that prefix
    // directly; taking the tail and reversing can return old outcomes when bounded.
    return this.state.experiences.slice(0,boundedLimit).map(experience=>{
      const outcome: 'success'|'failure'|'unknown' = experience.success>=.8
        ? 'success' : experience.success<=.2 ? 'failure' : 'unknown';
      // Stored classes are advisory replay metadata, not verifier receipts. Normalize their spelling into the same vocabulary the classifier consumes, without granting promotion authority.
      const errors=experience.failureClass ? [experience.failureClass.replace(/-/gu,' ')] : [];
      return this.diagnoseLearningAttempt({
        taskId:experience.traceId,
        objective:`Review ${experience.action} outcome in context ${experience.contextKey}.`,
        outcome,
        observedBehavior:`observed success=${experience.success.toFixed(3)}; predicted utility=${experience.predictedUtility.toFixed(3)}; reward=${experience.reward.toFixed(3)}; surprise=${experience.surprise.toFixed(3)}.`,
        errorMessages:errors,
      });
    });
  }
  /** Evidence-backed reflections: suggestions only, never treated as verified labels. */
  reflectionHypotheses(limit=12) {
    return reflectOnOutcomes(this.state.experiences.map(e=>({
      id:e.id, contextKey:e.contextKey, action:e.action, success:e.success,
      predictedUtility:e.predictedUtility, surprise:e.surprise, tick:e.tick, at:e.at, reward:e.reward, failureClass:e.failureClass,
    })),limit);
  }

  /** Rank the next learning targets from current failure debt and reflection hypotheses. */
  recommendLearningTargets(limit=10) {
    const reflections=this.reflectionHypotheses(Math.max(12,limit));
    const debt=this.evidenceDebt(Math.max(12,limit)).map(row=>({
      id:row.id, family:`verification-debt:${row.action}`, uncertainty01:row.uncertainty01,
      readiness01:clamp(1-row.estimatedVerificationCost01),
      // Information gain per cost estimates the value of checking this item;
      // it is not evidence that the skill transfers to another task family.
      transfer01:0,
      novelty01:row.uncertainty01, verificationCost01:row.estimatedVerificationCost01,
      repairValue01:row.priority01, blocked:false,
    }));
    const reflected=reflections.map(row=>({
      id:`reflection:${row.key}`, family:`reflection:${row.kind}:${row.action}`,
      // Prioritise both calibration error and conservative observed failure risk.
      // The Wilson interval is descriptive only; the evidence may be correlated.
      uncertainty01:clamp(.45*row.predictionGap01+.55*(1-row.wilsonLowerPassRate01)),
      readiness01:row.confidence01,
      // Same-context recurrence demonstrates a repair opportunity, not transfer.
      // Transfer stays unavailable until multi-context/held-out evidence is supplied.
      transfer01:0,
      novelty01:clamp(.65*row.priority01+.35*(1-row.passRate01)),
      verificationCost01:.45, repairValue01:row.priority01, blocked:false,
    }));
    const seen=new Set<string>();
    const candidates=[...debt,...reflected].filter(row=>{if(seen.has(row.id))return false;seen.add(row.id);return true;});
    return rankLearningTargets(candidates,limit,'pareto-frontier');
  }

  private updateEvidenceDebt(e:LearningExperience):void {
    const key=`${e.contextKey}|${e.action}`;
    let row=this.state.evidenceDebt.find(x=>x.id===`debt-${key}`);
    const uncertainty=clamp(.35 + Math.abs(e.success-e.predictedUtility)*.65 + e.surprise*.18);
    const priority=clamp(uncertainty*.72 + (1-e.predictedConfidence)*.28);
    const cost=clamp(.18 + e.predictedUtility*.32 + (e.action==='verify'?.05:0));
    const ig=clamp(priority/Math.max(.08,cost));
    if(e.action==='verify' && e.success>=.7){
      if(row){ row.priority01=clamp(row.priority01*.45); row.uncertainty01=clamp(row.uncertainty01*.55); row.lastSeenAt=now(); }
    } else if(!row){
      row={id:`debt-${key}`,contextKey:e.contextKey,action:e.action,priority01:priority,uncertainty01:uncertainty,estimatedVerificationCost01:cost,informationGainPerCost01:ig,reason:'observed outcome disagreed with or weakly supported prior prediction',createdAt:now(),lastSeenAt:now()};
      this.state.evidenceDebt=[row,...this.state.evidenceDebt].slice(0,256);
    } else {
      row.priority01=clamp(row.priority01*.82+priority*.18);row.uncertainty01=clamp(row.uncertainty01*.82+uncertainty*.18);row.informationGainPerCost01=clamp(row.informationGainPerCost01*.82+ig*.18);row.lastSeenAt=now();
    }
    this.state.evidenceDebt=this.state.evidenceDebt.filter(x=>x.priority01>.08).slice(0,256);
    this.state.metrics.evidenceDebtOpen=this.state.evidenceDebt.filter(x=>x.priority01>.45).length;
  }

  sealChecksum(material:unknown,tick:number):string {
    const digest=createHash('sha256').update(canonicalize(material)).digest('hex');
    this.state.checksum={digest,at:now(),tick,verifiedAt:this.state.checksum.verifiedAt,verificationFailures:this.state.checksum.verificationFailures};
    return digest;
  }

  verifyChecksum(material:unknown):boolean {
    if(!this.state.checksum.digest) { this.state.checksum.verifiedAt=now(); return true; }
    const digest=createHash('sha256').update(canonicalize(material)).digest('hex');
    const ok=digest===this.state.checksum.digest;
    this.state.checksum.verifiedAt=now();
    if(!ok){this.state.checksum.verificationFailures++;this.state.metrics.checksumFailures++;}
    return ok;
  }

  learningSummary():P23LearningMetrics & {topSkills:PolicySkillRecord[];evidenceDebt:EvidenceDebtItem[];checksum:CognitiveChecksum;reflections:ReturnType<P23LearningEngine['reflectionHypotheses']>;recentAttemptDiagnoses:ReturnType<P23LearningEngine['diagnoseRecentLearningAttempts']>;nextLearningTargets:ReturnType<P23LearningEngine['recommendLearningTargets']>} {
    return {...this.state.metrics,topSkills:this.topSkills(8),evidenceDebt:this.evidenceDebt(8),checksum:structuredClone(this.state.checksum),reflections:this.reflectionHypotheses(8),recentAttemptDiagnoses:this.diagnoseRecentLearningAttempts(8),nextLearningTargets:this.recommendLearningTargets(8)};
  }

  private recomputeMetrics():void {
    this.state.metrics.experiences=this.state.experiences.length;
    this.state.metrics.replayUpdates=this.state.replayUpdates.length;
    this.state.metrics.shadowComparisons=this.state.shadow.length;
    this.state.metrics.shadowAgreement01=this.state.shadow.length?this.state.shadow.filter(x=>x.agreed).length/this.state.shadow.length:0;
    // New experience and replay rows are prepended, so index 0 is the newest.
    const calibrated=this.state.experiences.slice(0,256);
    this.state.metrics.decisionPredictionComparisons=calibrated.length;
    this.state.metrics.decisionPredictionCalibration01=calibrated.length?clamp(1-calibrated.reduce((s,e)=>s+Math.abs(e.success-e.predictedUtility),0)/calibrated.length):0;
    this.state.metrics.alternativePredictionComparisons=this.state.metrics.decisionPredictionComparisons;
    this.state.metrics.alternativePredictionCalibration01=this.state.metrics.decisionPredictionCalibration01;
    this.state.metrics.counterfactualComparisons=this.state.metrics.decisionPredictionComparisons;
    this.state.metrics.counterfactualCalibration01=this.state.metrics.decisionPredictionCalibration01;
    this.state.metrics.ablationComparisons=this.state.ablations.length;
    this.state.metrics.ablationChangedRate01=this.state.ablations.length?this.state.ablations.filter(x=>x.changed).length/this.state.ablations.length:0;
    const predictionErrors=this.state.experiences.map(e=>Math.abs(e.success-e.predictedUtility));
    const recentErrors=this.state.experiences.slice(0,64).map(e=>Math.abs(e.success-e.predictedUtility));
    const replayErrors=this.state.replayUpdates.slice(0,128).map(x=>Math.abs(x.tdError));
    const mean=predictionErrors.length?predictionErrors.reduce((s,x)=>s+x,0)/predictionErrors.length:0;
    const recentMean=recentErrors.length?recentErrors.reduce((s,x)=>s+x,0)/recentErrors.length:0;
    const earlyErrors=this.state.experiences.slice(-64).map(e=>Math.abs(e.success-e.predictedUtility));
    const earlyMean=earlyErrors.length?earlyErrors.reduce((s,x)=>s+x,0)/earlyErrors.length:0;
    this.state.metrics.predictionError01=clamp(mean);
    this.state.metrics.recentPredictionError01=clamp(recentMean);
    this.state.metrics.replayMeanAbsTdError01=clamp(replayErrors.length?replayErrors.reduce((s,x)=>s+x,0)/replayErrors.length:0);
    this.state.metrics.learningDelta01=earlyMean>0?clamp((earlyMean-recentMean)/earlyMean):0;
    this.state.metrics.lastLearningAt=this.state.metrics.lastLearningAt||now();
  }
}
