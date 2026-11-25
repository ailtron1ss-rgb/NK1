/**
 * BIG PASS 164 — Appraisal-based emotion episodes.
 *
 * This layer sits above interoceptive homeostasis and intrinsic motivation.
 * It deliberately models emotion as a time-bound appraisal episode instead of
 * a single scalar. It does not claim phenomenal feeling; it produces causal
 * control signals that can alter attention, memory salience and action tendency.
 */
import { types } from 'node:util';

export type EmotionLabel = 'curiosity'|'calm'|'joy'|'anxiety'|'frustration'|'sadness'|'anger'|'protective';
export type EmotionActionTendency = 'explore'|'engage'|'verify'|'reflect'|'rest'|'protect'|'withdraw'|'approach';

export interface EmotionEpisode {
  id:string; tick:number; at:number; label:EmotionLabel; actionTendency:EmotionActionTendency;
  valence01:number; arousal01:number; dominance01:number;
  appraisal:{relevance01:number; goalCongruence01:number; controllability01:number; novelty01:number; selfRelevance01:number; socialMeaning01:number; uncertainty01:number};
  interoceptiveDelta:{stress01:number; energy01:number; load01:number; attentionCapture01:number};
  memorySalienceMultiplier01:number;
  confidence01:number;
  cause:string;
}

export interface FeelingEpisode { id:string; tick:number; at:number; label:EmotionLabel; intensity01:number; interoceptiveMismatch01:number; selfAccessConfidence01:number; bodilyFocus01:number; causeEmotionId:string; }

export interface InteroceptiveAffectState {
  cycles:number;
  meanMismatch01:number;
  lastMismatch01:number;
  regulationPressure01:number;
  stability01:number;
  recovery01:number;
  predictionCalibration01:number;
  lastObserved:{energy01:number;thermal01:number;capacity01:number;load01:number};
  predicted:{energy01:number;thermal01:number;capacity01:number;load01:number};
  lastAt:number; timebaseInitialized:boolean; recentSampleIds:string[];
  duplicateObservations:number; outOfOrderObservations:number; invalidObservations:number;
}

export interface EmotionOutcomeCalibration {
  attempts:number;
  meanSuccess01:number;
  meanSurprise01:number;
  meanBenefit01:number;
}

/** Slow affective state is separate from time-bounded emotion episodes. */
export interface AffectMoodState {
  version:1; valence01:number; arousal01:number; stress01:number; socialSafety01:number;
  lastAt:number; lastEpisodeId:string|null; lastOutcomeId:string|null; events:number; interoceptiveSamples:number; interoceptiveDurationMs:number;
  outcomeUpdates:number; verifiedOutcomeUpdates:number;
  recoveryActive:boolean; recoveryStartedAt:number; recoveryStartDistance01:number; recoveryLastDistance01:number;
  recoverySamples:number; meanRecoveryRate01:number; resilience01:number; resilienceConfidence01:number;
}
export interface AffectMoodFrameV1 {
  schemaVersion:1; valence01:number; arousal01:number; stress01:number; socialSafety01:number;
  deviation01:number; recoveryRate01:number; resilience01:number; resilienceConfidence01:number;
  sampledAt:number; ageMs:number; freshness01:number;
}
export type EmotionAffectFrameSource='emotion-appraisal'|'appraisal-summary'|'cognitive-field-fallback'|'default';
export interface EmotionAffectFrameV1 {
  schemaVersion:1; stateVersion:number; tick:number; episodeId:string|null; feelingId:string|null;
  label:EmotionLabel; actionTendency:EmotionActionTendency; valence01:number; arousal01:number; dominance01:number;
  intensity01:number; confidence01:number; stress01:number; sampledAt:number; ageMs:number; freshness01:number;
  cause:string; source:EmotionAffectFrameSource; mood:AffectMoodFrameV1;
}

export interface EmotionAppraisalState {
  version:2; episodes:number; lastTick:number; lastAt:number; lastLabel:EmotionLabel;
  meanArousal01:number; meanValence01:number; meanStress01:number; meanAttentionCapture01:number;
  history:EmotionEpisode[];
  feelings:FeelingEpisode[];
  interoception:InteroceptiveAffectState;
  mood:AffectMoodState;
  outcomes:Record<string,EmotionOutcomeCalibration>;
  recentOutcomeIds:string[];
  duplicateOutcomes:number;
  invalidOutcomes:number;
  outOfOrderOutcomes:number;
}


const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signedPrior=(x:number)=>Math.max(-.045,Math.min(.045,Number.isFinite(x)?x:0));
type AffectAction='respond'|'explore'|'verify'|'rest'|'reflect'|'wait'|'defer';
const AFFECT_ACTIONS:ReadonlySet<AffectAction>=new Set(['respond','explore','verify','rest','reflect','wait','defer']);
const TENDENCY_ACTION:Record<EmotionActionTendency,AffectAction>={explore:'explore',engage:'respond',verify:'verify',reflect:'reflect',rest:'rest',protect:'rest',withdraw:'wait',approach:'respond'};
const TENDENCY_PRIORS:Record<EmotionActionTendency,Partial<Record<AffectAction,number>>>={
  explore:{explore:.045,verify:.006,rest:-.010,respond:-.008,wait:-.008,defer:-.008},
  engage:{respond:.040,explore:.008,wait:-.012,defer:-.012},
  verify:{verify:.042,explore:-.025,respond:-.010},reflect:{reflect:.042,explore:-.018,respond:-.006},
  rest:{rest:.045,explore:-.035,respond:-.014},protect:{rest:.038,verify:.018,explore:-.040,respond:-.025},
  withdraw:{wait:.038,defer:.038,rest:.016,respond:-.038,explore:-.024},
  approach:{respond:.042,explore:.014,wait:-.018,defer:-.018},
};
const REGULATION_PRIORS:Record<AffectAction,number>={respond:-.018,explore:-.045,verify:.024,rest:.050,reflect:.018,wait:.012,defer:.018};
function canonicalAffectAction(action:string):AffectAction|null {
  if(AFFECT_ACTIONS.has(action as AffectAction))return action as AffectAction;
  return Object.prototype.hasOwnProperty.call(TENDENCY_ACTION,action)?TENDENCY_ACTION[action as EmotionActionTendency]:null;
}
const defaultAffectMood=():AffectMoodState=>({
  version:1,valence01:.5,arousal01:.22,stress01:.18,socialSafety01:.55,lastAt:0,lastEpisodeId:null,lastOutcomeId:null,
  events:0,interoceptiveSamples:0,interoceptiveDurationMs:0,outcomeUpdates:0,verifiedOutcomeUpdates:0,
  recoveryActive:false,recoveryStartedAt:0,recoveryStartDistance01:0,
  recoveryLastDistance01:0,recoverySamples:0,meanRecoveryRate01:0,resilience01:.5,resilienceConfidence01:0,
});
const emptyInteroception=():InteroceptiveAffectState=>({
  cycles:0, meanMismatch01:.18, lastMismatch01:.18, regulationPressure01:.18, stability01:.72, recovery01:.5, predictionCalibration01:.5,
  lastObserved:{energy01:.68,thermal01:.2,capacity01:.72,load01:.38},
  predicted:{energy01:.68,thermal01:.2,capacity01:.72,load01:.38},
  lastAt:0,timebaseInitialized:false,recentSampleIds:[],duplicateObservations:0,outOfOrderObservations:0,invalidObservations:0,
});
const empty=():EmotionAppraisalState=>({version:2,episodes:0,lastTick:-1,lastAt:0,lastLabel:'calm',meanArousal01:0.22,meanValence01:0.5,meanStress01:0.2,meanAttentionCapture01:0.2,history:[],feelings:[],interoception:emptyInteroception(),mood:defaultAffectMood(),outcomes:{},recentOutcomeIds:[],duplicateOutcomes:0,invalidOutcomes:0,outOfOrderOutcomes:0});

const EMOTION_LABELS = new Set<EmotionLabel>(['curiosity','calm','joy','anxiety','frustration','sadness','anger','protective']);
const ACTION_TENDENCIES = new Set<EmotionActionTendency>(['explore','engage','verify','reflect','rest','protect','withdraw','approach']);
const APPRAISAL_KEYS = ['relevance01','goalCongruence01','controllability01','novelty01','selfRelevance01','socialMeaning01','uncertainty01'] as const;
const DELTA_KEYS = ['stress01','energy01','load01','attentionCapture01'] as const;
const INTERO_KEYS = ['meanMismatch01','lastMismatch01','regulationPressure01','stability01','recovery01','predictionCalibration01'] as const;
const BODY_KEYS = ['energy01','thermal01','capacity01','load01'] as const;
const MAX_INTEROCEPTIVE_ELAPSED_MS=24*60*60_000;
const interoceptiveAlpha=(elapsedMs:number,tauMs:number)=>1-Math.exp(-Math.min(MAX_INTEROCEPTIVE_ELAPSED_MS,Math.max(0,elapsedMs))/tauMs);

/** Copy own data properties only; accessors and hostile Proxy traps fail closed. */
const MAX_SNAPSHOT_RECORD_KEYS = 256;

function ownDataRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || types.isProxy(value)) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_SNAPSHOT_RECORD_KEYS) return null;
    const output: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string') return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch { return null; }
}

function ownDataArray(value: unknown, max = 128): unknown[] | null {
  try {
    if (types.isProxy(value) || !Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = (descriptors as Record<string, PropertyDescriptor>).length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > max) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch { return null; }
}

function boundedNumber(value: unknown, fallback: number, min = 0, max = 1): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}
function validCounter(value: unknown, fallback: number, min = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : fallback;
}
function validText(value: unknown, max = 256): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}
function validEmotionEpisode(value: unknown): EmotionEpisode | null {
  const row = ownDataRecord(value);
  if (!row) return null;
  const appraisal = ownDataRecord(row.appraisal);
  const delta = ownDataRecord(row.interoceptiveDelta);
  if (!appraisal || !delta || !EMOTION_LABELS.has(row.label as EmotionLabel) ||
      !ACTION_TENDENCIES.has(row.actionTendency as EmotionActionTendency) ||
      !validText(row.id) || !validText(row.cause, 512) ||
      !Number.isSafeInteger(row.tick) || (row.tick as number) < 0 ||
      typeof row.at !== 'number' || !Number.isFinite(row.at) || (row.at as number) < 0) return null;
  for (const key of APPRAISAL_KEYS) if (typeof appraisal[key] !== 'number' || !Number.isFinite(appraisal[key] as number) || (appraisal[key] as number) < 0 || (appraisal[key] as number) > 1) return null;
  for (const key of DELTA_KEYS) if (typeof delta[key] !== 'number' || !Number.isFinite(delta[key] as number) || (delta[key] as number) < 0 || (delta[key] as number) > 1) return null;
  for (const key of ['valence01','arousal01','dominance01','memorySalienceMultiplier01','confidence01'] as const) {
    const maximum = key === 'memorySalienceMultiplier01' ? 2 : 1;
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key] as number) || (row[key] as number) < 0 || (row[key] as number) > maximum) return null;
  }
  return {
    id:row.id as string, tick:row.tick as number, at:row.at as number,
    label:row.label as EmotionLabel, actionTendency:row.actionTendency as EmotionActionTendency,
    valence01:row.valence01 as number, arousal01:row.arousal01 as number, dominance01:row.dominance01 as number,
    appraisal:Object.fromEntries(APPRAISAL_KEYS.map(key=>[key,appraisal[key]])) as EmotionEpisode['appraisal'],
    interoceptiveDelta:Object.fromEntries(DELTA_KEYS.map(key=>[key,delta[key]])) as EmotionEpisode['interoceptiveDelta'],
    memorySalienceMultiplier01:row.memorySalienceMultiplier01 as number,
    confidence01:row.confidence01 as number, cause:row.cause as string,
  };
}
function validFeelingEpisode(value: unknown): FeelingEpisode | null {
  const row=ownDataRecord(value);
  if(!row || !EMOTION_LABELS.has(row.label as EmotionLabel) ||
    !validText(row.id) || !validText(row.causeEmotionId) ||
    !Number.isSafeInteger(row.tick) || (row.tick as number)<0 ||
    typeof row.at!=='number' || !Number.isFinite(row.at) || (row.at as number)<0) return null;
  for(const key of ['intensity01','interoceptiveMismatch01','selfAccessConfidence01','bodilyFocus01'] as const)
    if(typeof row[key]!=='number' || !Number.isFinite(row[key] as number) || (row[key] as number)<0 || (row[key] as number)>1) return null;
  return {
    id:row.id as string, tick:row.tick as number, at:row.at as number, label:row.label as EmotionLabel,
    intensity01:row.intensity01 as number, interoceptiveMismatch01:row.interoceptiveMismatch01 as number,
    selfAccessConfidence01:row.selfAccessConfidence01 as number, bodilyFocus01:row.bodilyFocus01 as number,
    causeEmotionId:row.causeEmotionId as string,
  };
}
function restoreInteroception(value: unknown, fallback: InteroceptiveAffectState): InteroceptiveAffectState {
  const row=ownDataRecord(value);
  if(!row) return fallback;
  const lastObserved=ownDataRecord(row.lastObserved);
  const predicted=ownDataRecord(row.predicted);
  if(!lastObserved || !predicted) return fallback;
  const lastAtValid=typeof row.lastAt==='number'&&Number.isFinite(row.lastAt)&&row.lastAt>=0&&row.lastAt<=Date.now()+250;
  const timebaseInitialized=row.timebaseInitialized===true&&lastAtValid;
  const recentSampleIds=ownDataArray(row.recentSampleIds,64)?.filter((x):x is string=>validText(x,180)!==null) as string[]|undefined;
  for(const key of BODY_KEYS) {
    if(typeof lastObserved[key]!=='number' || !Number.isFinite(lastObserved[key] as number) || (lastObserved[key] as number)<0 || (lastObserved[key] as number)>1 ||
       typeof predicted[key]!=='number' || !Number.isFinite(predicted[key] as number) || (predicted[key] as number)<0 || (predicted[key] as number)>1) return fallback;
  }
  for(const key of INTERO_KEYS) if(typeof row[key]!=='number' || !Number.isFinite(row[key] as number) || (row[key] as number)<0 || (row[key] as number)>1) return fallback;
  return {
    cycles:validCounter(row.cycles,0),
    meanMismatch01:row.meanMismatch01 as number, lastMismatch01:row.lastMismatch01 as number,
    regulationPressure01:row.regulationPressure01 as number, stability01:row.stability01 as number,
    recovery01:row.recovery01 as number, predictionCalibration01:row.predictionCalibration01 as number,
    lastObserved:Object.fromEntries(BODY_KEYS.map(key=>[key,lastObserved[key]])) as InteroceptiveAffectState['lastObserved'],
    predicted:Object.fromEntries(BODY_KEYS.map(key=>[key,predicted[key]])) as InteroceptiveAffectState['predicted'],
    lastAt:timebaseInitialized?Number(row.lastAt):0,timebaseInitialized,recentSampleIds:recentSampleIds??[],
    duplicateObservations:validCounter(row.duplicateObservations,0),
    outOfOrderObservations:validCounter(row.outOfOrderObservations,0),
    invalidObservations:validCounter(row.invalidObservations,0),
  };
}
function restoreAffectMood(value:unknown):AffectMoodState {
  const d=defaultAffectMood(),row=ownDataRecord(value);
  if(!row||row.version!==1)return d;
  const keys=['valence01','arousal01','stress01','socialSafety01','recoveryStartDistance01','recoveryLastDistance01','meanRecoveryRate01','resilience01','resilienceConfidence01'] as const;
  for(const key of keys)if(typeof row[key]!=='number'||!Number.isFinite(row[key] as number)||(row[key] as number)<0||(row[key] as number)>1)return d;
  if(typeof row.lastAt!=='number'||!Number.isFinite(row.lastAt)||row.lastAt<0||row.lastAt>Date.now()+250||
    typeof row.recoveryStartedAt!=='number'||!Number.isFinite(row.recoveryStartedAt)||row.recoveryStartedAt<0||row.recoveryStartedAt>row.lastAt+250||
    typeof row.recoveryActive!=='boolean'||(row.lastEpisodeId!==null&&!validText(row.lastEpisodeId)))return d;
  return {version:1,valence01:row.valence01 as number,arousal01:row.arousal01 as number,stress01:row.stress01 as number,socialSafety01:row.socialSafety01 as number,
    lastAt:row.lastAt,lastEpisodeId:row.lastEpisodeId as string|null,events:validCounter(row.events,0),interoceptiveSamples:validCounter(row.interoceptiveSamples,0),
    recoveryActive:row.recoveryActive,recoveryStartedAt:row.recoveryStartedAt,recoveryStartDistance01:row.recoveryStartDistance01 as number,
    lastOutcomeId:row.lastOutcomeId===null?null:validText(row.lastOutcomeId),
    outcomeUpdates:validCounter(row.outcomeUpdates,0),verifiedOutcomeUpdates:validCounter(row.verifiedOutcomeUpdates,0),
    recoveryLastDistance01:row.recoveryLastDistance01 as number,recoverySamples:validCounter(row.recoverySamples,0),interoceptiveDurationMs:validCounter(row.interoceptiveDurationMs,0),
    meanRecoveryRate01:row.meanRecoveryRate01 as number,resilience01:row.resilience01 as number,resilienceConfidence01:row.resilienceConfidence01 as number};
}
function moodDistance(m:AffectMoodState):number {
  const v=(m.valence01-.5)/.5,a=(m.arousal01-.22)/.78,s=(m.stress01-.18)/.82,q=(m.socialSafety01-.55)/.55;
  return c(Math.sqrt(v*v*.42+a*a*.18+s*s*.32+q*q*.08));
}
function advanceMood(m:AffectMoodState,at:number):{mood:AffectMoodState;elapsedMs:number} {
  if(!Number.isFinite(at)||at<0||at<m.lastAt)return {mood:m,elapsedMs:0};
  const elapsedMs=m.lastAt===0?1000:Math.min(8*60*60_000,Math.max(0,at-m.lastAt));
  if(elapsedMs<=0)return {mood:m,elapsedMs:0};
  const decay=(v:number,b:number,tau:number)=>b+(v-b)*Math.exp(-elapsedMs/tau);
  return {elapsedMs,mood:{...m,valence01:c(decay(m.valence01,.5,45*60_000)),arousal01:c(decay(m.arousal01,.22,6*60_000)),
    stress01:c(decay(m.stress01,.18,30*60_000)),socialSafety01:c(decay(m.socialSafety01,.55,90*60_000)),lastAt:at}};
}
function recordMoodRecovery(previous:AffectMoodState,next:AffectMoodState,elapsedMs:number,at:number):AffectMoodState {
  if(!next.recoveryActive||elapsedMs<1000)return next;
  const before=next.recoveryLastDistance01>0?next.recoveryLastDistance01:moodDistance(previous),after=moodDistance(next);
  const improvement=Math.max(0,before-after),minutes=elapsedMs/60_000;
  if(improvement>.001&&minutes>0){
    const samples=Math.min(Number.MAX_SAFE_INTEGER,next.recoverySamples+1),rate=c(improvement/minutes/.22),mean=c(next.meanRecoveryRate01*.8+rate*.2);
    next={...next,recoverySamples:samples,meanRecoveryRate01:mean,resilience01:c(.25+mean*.75),resilienceConfidence01:c(samples/8)};
  }
  const complete=after<Math.max(.045,next.recoveryStartDistance01*.12)||at-next.recoveryStartedAt>3*60*60_000;
  return {...next,recoveryLastDistance01:after,recoveryActive:complete?false:next.recoveryActive};
}
function applyEpisodeToMood(m:AffectMoodState,e:EmotionEpisode):AffectMoodState {
  const {mood:decayed,elapsedMs}=advanceMood(m,e.at),advanced=recordMoodRecovery(m,decayed,elapsedMs,e.at);
  const intensity=c(e.arousal01*.52+Math.abs(e.valence01-.5)*.28+e.interoceptiveDelta.attentionCapture01*.20);
  const weight=c(e.confidence01*(.3+intensity*.7)),step=(v:number,t:number,r:number,limit:number)=>v+Math.max(-limit,Math.min(limit,(t-v)*r*weight));
  const social=e.appraisal.socialMeaning01>.45;
  const next:AffectMoodState={...advanced,valence01:c(step(advanced.valence01,e.valence01,.14,.045)),
    arousal01:c(step(advanced.arousal01,e.arousal01,.15,.05)),stress01:c(step(advanced.stress01,e.interoceptiveDelta.stress01,.16,.055)),
    socialSafety01:social?c(step(advanced.socialSafety01,.5+(e.valence01-.5)*.65,.08,.025)):advanced.socialSafety01,
    lastAt:Math.max(advanced.lastAt,e.at),lastEpisodeId:e.id,events:Math.min(Number.MAX_SAFE_INTEGER,advanced.events+1)};
  const deviation=moodDistance(next);
  return intensity>.32&&deviation>.06?{...next,recoveryActive:true,recoveryStartedAt:next.lastAt,recoveryStartDistance01:deviation,recoveryLastDistance01:deviation}:next;
}
function updateMoodFromBody(m:AffectMoodState,pressure:number,mismatch:number,at:number):AffectMoodState {
  const {mood:advanced,elapsedMs}=advanceMood(m,at);
  if(elapsedMs<=0)return advanced;
  const alpha=(tau:number)=>1-Math.exp(-elapsedMs/tau);
  const next:AffectMoodState={...advanced,valence01:c(advanced.valence01+(c(.53-pressure*.22-mismatch*.08)-advanced.valence01)*alpha(8*60_000)),
    arousal01:c(advanced.arousal01+(c(.18+pressure*.42+mismatch*.14)-advanced.arousal01)*alpha(2*60_000)),
    stress01:c(advanced.stress01+(c(.12+pressure*.68+mismatch*.16)-advanced.stress01)*alpha(3*60_000)),
    interoceptiveSamples:Math.min(Number.MAX_SAFE_INTEGER,advanced.interoceptiveSamples+1),
    interoceptiveDurationMs:Math.min(Number.MAX_SAFE_INTEGER,advanced.interoceptiveDurationMs+elapsedMs)};
  return recordMoodRecovery(m,next,elapsedMs,at);
}
function projectMood(m:AffectMoodState,now:number):AffectMoodFrameV1 {
  const safe=restoreAffectMood(m),projectedAt=Math.max(now,safe.lastAt),{mood}=advanceMood(safe,projectedAt);
  const sampledAt=safe.lastAt>0?safe.lastAt:projectedAt,ageMs=safe.lastAt>0?Math.max(0,projectedAt-safe.lastAt):0;
  return {schemaVersion:1,valence01:mood.valence01,arousal01:mood.arousal01,stress01:mood.stress01,socialSafety01:mood.socialSafety01,
    deviation01:moodDistance(mood),recoveryRate01:mood.meanRecoveryRate01,resilience01:mood.resilience01,resilienceConfidence01:mood.resilienceConfidence01,
    sampledAt,ageMs,freshness01:c(Math.exp(-ageMs/(24*60*60_000)))};
}

function restoreOutcomes(value: unknown): Record<string,EmotionOutcomeCalibration> {
  const row=ownDataRecord(value);
  if(!row || Object.keys(row).length>128) return {};
  const output: Record<string,EmotionOutcomeCalibration> = {};
  for(const [legacyKey,raw] of Object.entries(row)) {
    if(!legacyKey || legacyKey.length>64) return {};
    const key=canonicalAffectAction(legacyKey);
    if(!key)continue;
    const item=ownDataRecord(raw);
    if(!item || !Number.isSafeInteger(item.attempts) || (item.attempts as number)<0) return {};
    for(const metric of ['meanSuccess01','meanSurprise01','meanBenefit01'])
      if(typeof item[metric]!=='number' || !Number.isFinite(item[metric] as number) || (item[metric] as number)<0 || (item[metric] as number)>1) return {};
    const incoming={attempts:item.attempts as number,meanSuccess01:item.meanSuccess01 as number,meanSurprise01:item.meanSurprise01 as number,meanBenefit01:item.meanBenefit01 as number};
    const previous=output[key];
    if(!previous){output[key]=incoming;continue;}
    const total=Math.min(Number.MAX_SAFE_INTEGER,previous.attempts+incoming.attempts);
    if(total===0){output[key]=incoming;continue;}
    const weight=incoming.attempts/Math.max(1,total),prior=1-weight;
    output[key]={attempts:total,meanSuccess01:c(previous.meanSuccess01*prior+incoming.meanSuccess01*weight),
      meanSurprise01:c(previous.meanSurprise01*prior+incoming.meanSurprise01*weight),
      meanBenefit01:c(previous.meanBenefit01*prior+incoming.meanBenefit01*weight)};
  }
  return output;
}

export class EmotionAppraisalEngine {
  private state=empty();
  restore(raw?:Partial<EmotionAppraisalState>|null){
    const d=empty();
    const r=ownDataRecord(raw);
    if(!r || (r.version !== undefined && r.version !== 2)) { this.state=d; return; }
    const history=ownDataArray(r.history);
    const feelings=ownDataArray(r.feelings);
    const restoredHistory=history ? history.map(validEmotionEpisode) : null;
    const restoredFeelings=feelings ? feelings.map(validFeelingEpisode) : null;
    const validHistory:EmotionEpisode[]=[];
    if(restoredHistory && restoredHistory.every(Boolean)){
      const seenEpisodeIds=new Set<string>();
      for(const episode of restoredHistory as EmotionEpisode[]){
        if(seenEpisodeIds.has(episode.id))continue;
        seenEpisodeIds.add(episode.id);
        validHistory.push(episode);
      }
    }
    const validFeelings:FeelingEpisode[]=[];
    if(restoredFeelings && restoredFeelings.every(Boolean)){
      const seenFeelingIds=new Set<string>();
      for(const feeling of restoredFeelings as FeelingEpisode[]){
        if(seenFeelingIds.has(feeling.id)||!validHistory.some(episode=>episode.id===feeling.causeEmotionId))continue;
        seenFeelingIds.add(feeling.id);
        validFeelings.push(feeling);
      }
    }
    // History is newest-first. Its newest validated row is authoritative for the last-event fields.
    // The lifetime episode counter may exceed retained history, but cannot be smaller than it.
    const latest=validHistory[0];
    this.state={
      version:2,
      episodes:Math.max(validHistory.length,validCounter(r.episodes,0)),
      lastTick:latest?.tick ?? validCounter(r.lastTick,-1,-1),
      lastAt:latest?.at ?? (typeof r.lastAt==='number' && Number.isFinite(r.lastAt) && r.lastAt>=0 ? r.lastAt : 0),
      lastLabel:latest?.label ?? (EMOTION_LABELS.has(r.lastLabel as EmotionLabel) ? r.lastLabel as EmotionLabel : d.lastLabel),
      meanArousal01:boundedNumber(r.meanArousal01,d.meanArousal01),
      meanValence01:boundedNumber(r.meanValence01,d.meanValence01),
      meanStress01:boundedNumber(r.meanStress01,d.meanStress01),
      meanAttentionCapture01:boundedNumber(r.meanAttentionCapture01,d.meanAttentionCapture01),
      history:validHistory,
      feelings:validFeelings,
      interoception:restoreInteroception(r.interoception,d.interoception),
      mood:restoreAffectMood(r.mood),
      outcomes:restoreOutcomes(r.outcomes),
      recentOutcomeIds:(ownDataArray(r.recentOutcomeIds,512)??[]).map(value=>validText(value,256)).filter((value):value is string=>value!==null).slice(-512),
      duplicateOutcomes:validCounter(r.duplicateOutcomes,0),
      invalidOutcomes:validCounter(r.invalidOutcomes,0),
      outOfOrderOutcomes:validCounter(r.outOfOrderOutcomes,0),
    };
  }
  snapshot(){return structuredClone(this.state);}
  moodSnapshot(now=Date.now()):AffectMoodFrameV1{return projectMood(this.state.mood,Number.isFinite(now)&&now>=0?now:this.state.mood.lastAt);}

  observeInteroception(input:{energy01:number;thermal01:number;capacity01:number;load01:number;homeostaticPressure01?:number;at?:number;sampleId?:string}):InteroceptiveAffectState{
    const st=this.state.interoception,now=Date.now(),requestedAt=input.at===undefined?now:input.at;
    const numeric=[input.energy01,input.thermal01,input.capacity01,input.load01,input.homeostaticPressure01??0];
    if(typeof requestedAt!=='number'||!Number.isFinite(requestedAt)||requestedAt<0||requestedAt>now+250||
       !numeric.every(value=>typeof value==='number'&&Number.isFinite(value))){
      this.state.interoception={...st,invalidObservations:Math.min(Number.MAX_SAFE_INTEGER,st.invalidObservations+1)};
      return structuredClone(this.state.interoception);
    }
    const sampleId=input.sampleId===undefined?null:validText(input.sampleId,180);
    if(input.sampleId!==undefined&&!sampleId){
      this.state.interoception={...st,invalidObservations:Math.min(Number.MAX_SAFE_INTEGER,st.invalidObservations+1)};
      return structuredClone(this.state.interoception);
    }
    if(sampleId&&st.recentSampleIds.includes(sampleId)){
      this.state.interoception={...st,duplicateObservations:Math.min(Number.MAX_SAFE_INTEGER,st.duplicateObservations+1)};
      return structuredClone(this.state.interoception);
    }
    if(st.timebaseInitialized&&requestedAt<st.lastAt){
      this.state.interoception={...st,outOfOrderObservations:Math.min(Number.MAX_SAFE_INTEGER,st.outOfOrderObservations+1)};
      return structuredClone(this.state.interoception);
    }
    const elapsedMs=st.timebaseInitialized?Math.min(MAX_INTEROCEPTIVE_ELAPSED_MS,Math.max(0,requestedAt-st.lastAt)):(st.cycles===0?1_000:0);
    const actual={energy01:c(input.energy01),thermal01:c(input.thermal01),capacity01:c(input.capacity01),load01:c(input.load01)};
    const errors=[Math.abs(actual.energy01-st.predicted.energy01),Math.abs(actual.thermal01-st.predicted.thermal01),Math.abs(actual.capacity01-st.predicted.capacity01),Math.abs(actual.load01-st.predicted.load01)];
    const mismatch=c(errors[0]*.28+errors[1]*.18+errors[2]*.30+errors[3]*.24);
    const pressure=c(mismatch*.46+c(input.homeostaticPressure01??0)*.54);
    const stable=c(1-mismatch);
    const recovery=c(actual.energy01*.35+actual.capacity01*.35+(1-actual.thermal01)*.15+(1-actual.load01)*.15);
    const predictionAlpha=interoceptiveAlpha(elapsedMs,5_000);
    const meanAlpha=interoceptiveAlpha(elapsedMs,30_000);
    const pressureTau=pressure>st.regulationPressure01?12_000:45_000;
    const pressureAlpha=interoceptiveAlpha(elapsedMs,pressureTau);
    const recoveryAlpha=interoceptiveAlpha(elapsedMs,45_000);
    const nextPred={
      energy01:c(st.predicted.energy01+(actual.energy01-st.predicted.energy01)*predictionAlpha),
      thermal01:c(st.predicted.thermal01+(actual.thermal01-st.predicted.thermal01)*predictionAlpha),
      capacity01:c(st.predicted.capacity01+(actual.capacity01-st.predicted.capacity01)*predictionAlpha),
      load01:c(st.predicted.load01+(actual.load01-st.predicted.load01)*predictionAlpha),
    };
    const n=Math.min(Number.MAX_SAFE_INTEGER,st.cycles+1);
    const recentSampleIds=sampleId?[...st.recentSampleIds.filter(id=>id!==sampleId),sampleId].slice(-64):st.recentSampleIds;
    this.state.interoception={...st,cycles:n,lastAt:requestedAt,timebaseInitialized:true,recentSampleIds,
      meanMismatch01:c(st.meanMismatch01+(mismatch-st.meanMismatch01)*meanAlpha),lastMismatch01:mismatch,
      regulationPressure01:c(st.regulationPressure01+(pressure-st.regulationPressure01)*pressureAlpha),
      stability01:c(st.stability01+(stable-st.stability01)*meanAlpha),
      recovery01:c(st.recovery01+(recovery-st.recovery01)*recoveryAlpha),
      predictionCalibration01:c(st.predictionCalibration01+((1-mismatch)-st.predictionCalibration01)*meanAlpha),
      lastObserved:actual,predicted:nextPred};
    if(requestedAt>=this.state.mood.lastAt)this.state.mood=updateMoodFromBody(this.state.mood,pressure,mismatch,requestedAt);
    return structuredClone(this.state.interoception);
  }

  recordOutcome(input:{
    emotionId?:string;decisionId?:string;at?:number;verified01?:number;
    action:string;success01:number;surprise01:number;regulationCost01?:number;
  }):EmotionOutcomeCalibration{
    const key=canonicalAffectAction(String(input.action));
    if(!key)throw new RangeError('unsupported-affect-outcome-action');
    const existing=this.state.outcomes[key]??{attempts:0,meanSuccess01:.5,meanSurprise01:.5,meanBenefit01:.5};
    const reject=()=>{
      this.state.invalidOutcomes=Math.min(Number.MAX_SAFE_INTEGER,this.state.invalidOutcomes+1);
      return structuredClone(existing);
    };
    const decisionId=input.decisionId===undefined?null:validText(input.decisionId,256);
    if(input.decisionId!==undefined&&!decisionId)return reject();
    if(decisionId&&this.state.recentOutcomeIds.includes(decisionId)){
      this.state.duplicateOutcomes=Math.min(Number.MAX_SAFE_INTEGER,this.state.duplicateOutcomes+1);
      return structuredClone(existing);
    }
    const now=Date.now(),at=input.at===undefined?now:input.at;
    const verified01=input.verified01===undefined?.2:input.verified01;
    const cost01=input.regulationCost01===undefined?0:input.regulationCost01;
    const values=[input.success01,input.surprise01,cost01,verified01];
    if(typeof at!=='number'||!Number.isFinite(at)||at<0||at>now+250||
       !values.every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1)||
       (input.emotionId!==undefined&&(!validText(input.emotionId)||!this.state.history.some(e=>e.id===input.emotionId)))){
      return reject();
    }
    const recentOutcomeIds=decisionId?[...this.state.recentOutcomeIds.filter(id=>id!==decisionId),decisionId].slice(-512):this.state.recentOutcomeIds;
    const previousMood=this.state.mood;
    const previous=this.state.outcomes[key]??{attempts:0,meanSuccess01:.5,meanSurprise01:.5,meanBenefit01:.5};
    const success=input.success01,surprise=input.surprise01,cost=cost01;
    const benefit=c(success*.62+(1-surprise)*.24+(1-cost)*.14);
    const attempts=Math.min(Number.MAX_SAFE_INTEGER,previous.attempts+1);
    const row={
      attempts,
      meanSuccess01:c(previous.meanSuccess01+(success-previous.meanSuccess01)/attempts),
      meanSurprise01:c(previous.meanSurprise01+(surprise-previous.meanSurprise01)/attempts),
      meanBenefit01:c(previous.meanBenefit01+(benefit-previous.meanBenefit01)/attempts),
    };
    let mood=previousMood;
    let outOfOrderOutcomes=this.state.outOfOrderOutcomes;
    if(at<previousMood.lastAt){
      outOfOrderOutcomes=Math.min(Number.MAX_SAFE_INTEGER,outOfOrderOutcomes+1);
    }else{
      const {mood:advanced}=advanceMood(previousMood,at);
      const evidenceWeight=.12+.88*verified01;
      const valenceTarget=c(.5+(success-.5)*.32+(.5-surprise)*.16-(cost-.5)*.12);
      const stressTarget=c(.18+(1-success)*.34+surprise*.20+cost*.18);
      const arousalTarget=c(.22+surprise*.24+cost*.16);
      const nudge=(current:number,target:number,rate:number,limit:number)=>
        current+Math.max(-limit,Math.min(limit,(target-current)*rate*evidenceWeight));
      const next:AffectMoodState={
        ...advanced,
        valence01:c(nudge(advanced.valence01,valenceTarget,.10,.022)),
        arousal01:c(nudge(advanced.arousal01,arousalTarget,.10,.018)),
        stress01:c(nudge(advanced.stress01,stressTarget,.11,.026)),
        lastAt:at,lastOutcomeId:decisionId??previousMood.lastOutcomeId,
        outcomeUpdates:Math.min(Number.MAX_SAFE_INTEGER,advanced.outcomeUpdates+1),
        verifiedOutcomeUpdates:verified01>=.8?Math.min(Number.MAX_SAFE_INTEGER,advanced.verifiedOutcomeUpdates+1):advanced.verifiedOutcomeUpdates,
      };
      const distance=moodDistance(next);
      mood=next;
      if(distance>.06&&!next.recoveryActive){
        mood={...next,recoveryActive:true,recoveryStartedAt:at,recoveryStartDistance01:distance,recoveryLastDistance01:distance};
      }
    }
    this.state={
      ...this.state,outcomes:{...this.state.outcomes,[key]:row},recentOutcomeIds,outOfOrderOutcomes,mood,
    };
    return structuredClone(row);
  }
  outcomeCalibration(action:string):EmotionOutcomeCalibration|null{const key=canonicalAffectAction(String(action)),row=key?this.state.outcomes[key]:null;return row?structuredClone(row):null;}
  appraise(input:{tick:number;at?:number;goalPressure01?:number;goalCongruence01?:number;controllability01?:number;novelty01?:number;selfRelevance01?:number;socialMeaning01?:number;uncertainty01?:number;predictionError01?:number;homeostaticPressure01?:number;energy01?:number;success01?:number;external?:boolean}):EmotionEpisode{
    const a={relevance01:c(Math.max(input.goalPressure01??0,input.predictionError01??0,input.homeostaticPressure01??0)),goalCongruence01:c(input.goalCongruence01??(input.success01??.5)),controllability01:c(input.controllability01??(1-(input.uncertainty01??.35))),novelty01:c(input.novelty01??.35),selfRelevance01:c(input.selfRelevance01??.5),socialMeaning01:c(input.socialMeaning01??0),uncertainty01:c(input.uncertainty01??.35)};
    const arousal=c(a.relevance01*.20+a.novelty01*.19+a.uncertainty01*.20+(input.predictionError01??0)*.17+(input.homeostaticPressure01??0)*.15+this.state.interoception.regulationPressure01*.09);
    const valence=c(.5+(a.goalCongruence01-.5)*.48+a.controllability01*.10-(a.uncertainty01*.16)+((input.success01??.5)-.5)*.45);
    const stress=c((1-a.controllability01)*.30+a.uncertainty01*.20+(input.predictionError01??0)*.22+(input.homeostaticPressure01??0)*.18+this.state.interoception.lastMismatch01*.10);
    const dominance=c(a.controllability01*.62+a.selfRelevance01*.18+(input.success01??.5)*.20);
    let label:EmotionLabel='calm'; let actionTendency:EmotionActionTendency='engage';
    if(stress>.72 && a.controllability01<.4){label='anxiety';actionTendency='verify';}
    else if(stress>.58 && a.controllability01>.55){label='protective';actionTendency='protect';}
    else if((input.predictionError01??0)>.62 && a.controllability01<.45){label='frustration';actionTendency='reflect';}
    else if(a.socialMeaning01>.72 && valence<.38){label='sadness';actionTendency='withdraw';}
    else if(a.socialMeaning01>.72 && valence>.66){label='joy';actionTendency='approach';}
    else if(a.novelty01>.64 && a.uncertainty01>.35){label='curiosity';actionTendency='explore';}
    else if(valence<.34 && dominance>.65){label='anger';actionTendency='protect';}
    const attentionCapture=c(arousal*.55+a.relevance01*.25+a.selfRelevance01*.20);
    const n=this.state.episodes+1;
    const episode:EmotionEpisode={id:`emo:${Math.max(0,Math.floor(input.tick))}:${Number(input.at??Date.now())}:${n}`,tick:Math.max(0,Math.floor(input.tick)),at:Number(input.at??Date.now()),label,actionTendency,valence01:valence,arousal01:arousal,dominance01:dominance,appraisal:a,interoceptiveDelta:{stress01:stress,energy01:c(-stress*.12+((input.success01??.5)-.5)*.08+0.06),load01:c(arousal*.24),attentionCapture01:attentionCapture},memorySalienceMultiplier01:c(.8+attentionCapture*.7),confidence01:c(.45+a.relevance01*.35+a.controllability01*.20),cause:input.external?'external-experience':'internal-state'};
    this.state={...this.state,episodes:n,lastTick:episode.tick,lastAt:episode.at,lastLabel:episode.label,meanArousal01:c(this.state.meanArousal01*(n-1)/n+episode.arousal01/n),meanValence01:c(this.state.meanValence01*(n-1)/n+episode.valence01/n),meanStress01:c(this.state.meanStress01*(n-1)/n+stress/n),meanAttentionCapture01:c(this.state.meanAttentionCapture01*(n-1)/n+attentionCapture/n),history:[episode,...this.state.history].slice(0,128),mood:applyEpisodeToMood(this.state.mood,episode)};
    return structuredClone(episode);
  }

  /** Functional feeling-access layer: transforms an emotion episode into an explicitly
   * body-linked self-report candidate. It represents access to an internal episode,
   * not a claim of phenomenal experience. */
  inferFeeling(episode:EmotionEpisode,input:{energy01:number;cognitiveLoad01:number;uncertainty01:number;selfFocus01?:number}):FeelingEpisode{
    const bodyMismatch=this.state.interoception.lastMismatch01;
    const mismatch=c(bodyMismatch*.45 + Math.abs(episode.interoceptiveDelta.stress01-c(input.uncertainty01))*.30 + c(input.cognitiveLoad01)*.25);
    const bodilyFocus=c(.35+episode.interoceptiveDelta.attentionCapture01*.35+c(input.selfFocus01??.5)*.30);
    const intensity=c(episode.arousal01*.52+Math.abs(episode.valence01-.5)*.28+episode.interoceptiveDelta.attentionCapture01*.20);
    const feeling:FeelingEpisode={id:`feel:${episode.id}`,tick:episode.tick,at:episode.at,label:episode.label,intensity01:intensity,interoceptiveMismatch01:mismatch,selfAccessConfidence01:c(.46+episode.confidence01*.30+bodilyFocus*.24),bodilyFocus01:bodilyFocus,causeEmotionId:episode.id};
    this.state.feelings=[feeling,...this.state.feelings.filter(f=>f.id!==feeling.id)].slice(0,128);
    return structuredClone(feeling);
  }
  latestFeeling():FeelingEpisode|null{return this.state.feelings[0]?structuredClone(this.state.feelings[0]):null;}

  regulationPressure01():number{return this.state.interoception.regulationPressure01;}

  actionBias(action:string,now=Date.now()):number{
    const e=this.state.history[0],key=canonicalAffectAction(action);
    if(!e||!key||!Number.isFinite(now))return 0;
    const intero=this.state.interoception,calibration=this.state.outcomes[key];
    const learned=calibration&&calibration.attempts>=3?(calibration.meanBenefit01-.5)*.035*c((calibration.attempts-2)/4):0;
    const confidenceGate=c((e.confidence01-.45)/.40),attentionGate=c(.35+e.interoceptiveDelta.attentionCapture01*.65);
    const pressure=c(intero.regulationPressure01),m=this.state.mood,moodAge=Math.max(0,now-m.lastAt);
    const unverifiedOutcomeEvidence=Math.max(0,m.outcomeUpdates-m.verifiedOutcomeUpdates)*.15;
    const moodEvidence=c((m.events*2+m.verifiedOutcomeUpdates*2+unverifiedOutcomeEvidence+m.interoceptiveDurationMs/60_000)/8);
    const moodFreshness=Math.exp(-moodAge/(24*60*60_000));
    const stress=c((m.stress01-.18)/.82),lowValence=c((.5-m.valence01)/.5);
    const moodPrior:Record<AffectAction,number>={respond:-.008*stress,explore:-.012*stress+.005*c((m.valence01-.5)/.5)*(1-stress),
      verify:.010*stress+.003*lowValence,rest:.014*stress,reflect:.008*stress+.003*lowValence,wait:.003*stress,defer:.003*stress};
    const acute=TENDENCY_PRIORS[e.actionTendency]?.[key]??0;
    // Synthetic/test clocks (e.g. 1001) are valid within their own time domain.
    // The short half-life belongs to the acute episode only; applying it to mood,
    // homeostatic pressure and learned outcome evidence would erase slow affect
    // from action selection even though those sources retain their own freshness.
    const comparableEpochMs=now>=1e11&&e.at>=1e11;
    const acuteFreshness=comparableEpochMs?Math.exp(-Math.max(0,now-e.at)/60_000):1;
    const prior=acute*acuteFreshness+pressure*REGULATION_PRIORS[key]+learned+
      moodPrior[key]*moodEvidence*moodFreshness;
    return signedPrior(prior*confidenceGate*attentionGate);
  }

  summary(){return {episodes:this.state.episodes,lastLabel:this.state.lastLabel,meanArousal01:this.state.meanArousal01,meanValence01:this.state.meanValence01,meanStress01:this.state.meanStress01,meanAttentionCapture01:this.state.meanAttentionCapture01,interoception:structuredClone(this.state.interoception),mood:this.moodSnapshot(),outcomes:structuredClone(this.state.outcomes)};}

}
const LABEL_TENDENCIES:Record<EmotionLabel,EmotionActionTendency>={curiosity:'explore',calm:'engage',joy:'approach',anxiety:'verify',frustration:'reflect',sadness:'withdraw',anger:'protect',protective:'protect'};
export function projectEmotionAffectFrame(input:{stateVersion?:unknown;now?:unknown;stateAt?:unknown;appraisal?:unknown;cognitiveField?:unknown}):EmotionAffectFrameV1 {
  const stateVersion=validCounter(input.stateVersion,0),now=typeof input.now==='number'&&Number.isFinite(input.now)&&input.now>=0?input.now:Date.now();
  const app=ownDataRecord(input.appraisal),field=ownDataRecord(input.cognitiveField);
  const history=app?ownDataArray(app.history):null,rows=history?.map(validEmotionEpisode)??null;
  const episode=rows&&rows.every(Boolean)?(rows[0] as EmotionEpisode|undefined)??null:null;
  const feelings=app?ownDataArray(app.feelings):null,feelingsValid=feelings?.map(validFeelingEpisode)??null;
  const feeling=episode&&feelingsValid&&feelingsValid.every(Boolean)?(feelingsValid as FeelingEpisode[]).find(v=>v.causeEmotionId===episode.id)??null:null;
  const fieldLabel=field&&EMOTION_LABELS.has(field.dominantEmotion as EmotionLabel)?field.dominantEmotion as EmotionLabel:null;
  const appLabel=app&&EMOTION_LABELS.has(app.lastLabel as EmotionLabel)?app.lastLabel as EmotionLabel:null;
  const stateAt=typeof input.stateAt==='number'&&Number.isFinite(input.stateAt)&&input.stateAt>=0?input.stateAt:now;
  let label:EmotionLabel='calm',tendency:EmotionActionTendency='engage',valence=.5,arousal=.22,dominance=.5,intensity=0,confidence=0,stress=0,sampledAt=0;
  let episodeId:string|null=null,feelingId:string|null=null,cause='baseline',source:EmotionAffectFrameSource='default';
  if(episode&&episode.tick<=stateVersion&&episode.at<=now+250){
    label=episode.label;tendency=episode.actionTendency;valence=episode.valence01;arousal=episode.arousal01;dominance=episode.dominance01;
    intensity=feeling?.intensity01??c(arousal*.52+Math.abs(valence-.5)*.28+episode.interoceptiveDelta.attentionCapture01*.20);
    confidence=feeling?Math.min(episode.confidence01,feeling.selfAccessConfidence01):episode.confidence01;
    stress=episode.interoceptiveDelta.stress01;sampledAt=episode.at;episodeId=episode.id;feelingId=feeling?.id??null;cause=episode.cause;source='emotion-appraisal';
  }else if(app&&appLabel&&typeof app.lastAt==='number'&&Number.isFinite(app.lastAt)&&app.lastAt<=now+250){
    label=appLabel;tendency=LABEL_TENDENCIES[label];valence=boundedNumber(app.meanValence01,.5);arousal=boundedNumber(app.meanArousal01,.22);
    intensity=boundedNumber(app.meanAttentionCapture01,.2);confidence=boundedNumber(ownDataRecord(app.interoception)?.predictionCalibration01,.5);
    stress=boundedNumber(app.meanStress01,.2);sampledAt=app.lastAt;cause='restored-appraisal-summary';source='appraisal-summary';
  }else if(field&&(fieldLabel!==null||Number.isFinite(field.valence01)||Number.isFinite(field.arousal01))){
    label=fieldLabel??'calm';tendency=LABEL_TENDENCIES[label];valence=boundedNumber(field.valence01,.5);arousal=boundedNumber(field.arousal01,.22);
    dominance=boundedNumber(field.dominance01,.5);intensity=c(arousal*.52+Math.abs(valence-.5)*.28);confidence=.35;
    stress=c((1-dominance)*.28+arousal*.22);sampledAt=stateAt;cause=validText(field.rationale,512)??'cognitive-field-fallback';source='cognitive-field-fallback';
  }
  const hasSample=source!=='default',ageMs=hasSample?Math.max(0,now-sampledAt):30_000;
  const freshness01=c(1-Math.min(ageMs,30_000)/30_000),intensity01=c(intensity*freshness01),present= intensity01<.12?'calm':label;
  const mood=app?restoreAffectMood(app.mood):defaultAffectMood();
  return {schemaVersion:1,stateVersion,tick:episode?.tick??(app?validCounter(app.lastTick,stateVersion,-1):stateVersion),
    episodeId,feelingId,label:present,actionTendency:present==='calm'&&intensity01<.12?'engage':tendency,
    valence01:c(.5+(valence-.5)*freshness01),arousal01:c(.22+(arousal-.22)*freshness01),dominance01:c(.5+(dominance-.5)*freshness01),
    intensity01,confidence01:c(confidence*freshness01),stress01:c(stress*freshness01),sampledAt,ageMs,freshness01,cause,source,mood:projectMood(mood,now)};
}
export const defaultEmotionAppraisalState=()=>empty();
