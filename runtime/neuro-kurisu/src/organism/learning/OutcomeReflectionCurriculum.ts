import { isSafeLearningIdentity, snapshotPlainData } from './LearningTrustBoundary.ts';

/**
 * Outcome-driven reflection and active curriculum for Neuro-Kurisu.
 * Reflection is a hypothesis generator, not ground truth: promotion still requires
 * independent validation. Inspired by Reflexion, Voyager curriculum, SkillLearnBench
 * and STATE-Bench's outcome-oriented evaluation.
 */
export type FailureKind='prediction-gap'|'low-outcome'|'unexpected-surprise'|'repeated-context-failure'|'stale-skill'|'insufficient-evidence';
export interface ReflectionExperience {
  id:string; contextKey:string; action:string; success:number; predictedUtility:number;
  surprise:number; tick:number; at?:number;
}
export interface ReflectionHypothesis {
  key:string; kind:FailureKind; contextKey:string; action:string; occurrences:number;
  observedSuccess01:number; predictedSuccess01:number; predictionGap01:number;
  priority01:number; suggestedNextStep:string; evidenceNeeded:string;
  confidence01:number; sourceExperienceIds:string[];
}
export interface LearningTarget {
  id:string; family:string; uncertainty01:number; readiness01:number; transfer01:number;
  novelty01:number; verificationCost01:number; repairValue01:number; blocked?:boolean;
  score01:number; rationale:string[];
}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const num=(x:number,d=0)=>Number.isFinite(x)?x:d;
const MAX_REFLECTION_ROWS=4096;
const MAX_LEARNING_TARGETS=512;
const REFLECTION_PASS_THRESHOLD=0.5;
type LearningTargetInput=Omit<LearningTarget,'score01'|'rationale'>;

const isPlainRecord=(value:unknown):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  return prototype===Object.prototype||prototype===null;
};
const isUnit=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;

/** Read an array through own data descriptors only. Accessors, sparse arrays,
 * foreign prototypes, oversized batches and reflection errors fail closed. */
function boundedArrayEntries(value:unknown,maxLength:number):unknown[]|null{
  if(!Array.isArray(value))return null;
  try{
    if(Object.getPrototypeOf(value)!==Array.prototype)return null;
    const keys=Reflect.ownKeys(value);
    const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
    const length=lengthDescriptor?.value;
    if(!lengthDescriptor||!Number.isSafeInteger(length)||length<0||length>maxLength||keys.length!==length+1)return null;
    const entries:unknown[]=[];
    for(let i=0;i<length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!('value'in descriptor)||descriptor.get||descriptor.set||!descriptor.enumerable)return null;
      entries.push(descriptor.value);
    }
    return entries;
  }catch{return null;}
}
function readPersistedExperienceId(value:unknown):string|null{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  try{
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptor=Object.getOwnPropertyDescriptor(value,'id');
    return descriptor&&'value'in descriptor&&isSafeLearningIdentity(descriptor.value,512)?descriptor.value:null;
  }catch{return null;}
}
function snapshotReflectionExperience(value:unknown):ReflectionExperience|null{
  try{
    const detached=snapshotPlainData(value);
    if(!isPlainRecord(detached))return null;
    const x=detached;
    if(!isSafeLearningIdentity(x.id,512)||!isSafeLearningIdentity(x.contextKey,256)||
       !isSafeLearningIdentity(x.action,96)||!Number.isSafeInteger(x.tick)||typeof x.tick!=='number'||x.tick<0||
       !isUnit(x.success)||!isUnit(x.predictedUtility)||!isUnit(x.surprise)||
       (x.at!==undefined&&(!Number.isSafeInteger(x.at)||typeof x.at!=='number'||x.at<0)))return null;
    return {id:x.id,contextKey:x.contextKey,action:x.action,success:x.success,
      predictedUtility:x.predictedUtility,surprise:x.surprise,tick:x.tick,
      ...(x.at===undefined?{}:{at:x.at as number})};
  }catch{return null;}
}
function sameReflectionExperience(a:ReflectionExperience,b:ReflectionExperience):boolean{
  return a.id===b.id&&a.contextKey===b.contextKey&&a.action===b.action&&a.success===b.success&&
    a.predictedUtility===b.predictedUtility&&a.surprise===b.surprise&&a.tick===b.tick&&(a.at??null)===(b.at??null);
}
const TARGET_KEYS=new Set(['id','family','uncertainty01','readiness01','transfer01','novelty01','verificationCost01','repairValue01','blocked']);
function snapshotLearningTarget(value:unknown):LearningTargetInput|null{
  try{
    const detached=snapshotPlainData(value);
    if(!isPlainRecord(detached)||Object.keys(detached).some(key=>!TARGET_KEYS.has(key)))return null;
    const x=detached;
    if(!isSafeLearningIdentity(x.id,128)||!isSafeLearningIdentity(x.family,128)||
       !isUnit(x.uncertainty01)||!isUnit(x.readiness01)||!isUnit(x.transfer01)||
       !isUnit(x.novelty01)||!isUnit(x.verificationCost01)||!isUnit(x.repairValue01)||
       (x.blocked!==undefined&&typeof x.blocked!=='boolean'))return null;
    return {id:x.id,family:x.family,uncertainty01:x.uncertainty01,readiness01:x.readiness01,
      transfer01:x.transfer01,novelty01:x.novelty01,verificationCost01:x.verificationCost01,
      repairValue01:x.repairValue01,...(x.blocked===undefined?{}:{blocked:x.blocked as boolean})};
  }catch{return null;}
}

export function reflectOnOutcomes(rows:readonly ReflectionExperience[],limit=12):ReflectionHypothesis[]{
  const rawRows=boundedArrayEntries(rows,MAX_REFLECTION_ROWS);
  if(!rawRows)return [];
  const byId=new Map<string,ReflectionExperience>(),invalidIds=new Set<string>(),conflicts=new Set<string>();
  for(const raw of rawRows){
    const rawId=readPersistedExperienceId(raw);
    const experience=snapshotReflectionExperience(raw);
    if(!experience){
      if(rawId)invalidIds.add(rawId);
      continue;
    }
    if(invalidIds.has(experience.id)){conflicts.add(experience.id);continue;}
    const prior=byId.get(experience.id);
    if(prior){
      if(!sameReflectionExperience(prior,experience))conflicts.add(experience.id);
      continue; // Exact duplicates are idempotent; conflicting identities are quarantined below.
    }
    byId.set(experience.id,experience);
  }
  for(const id of invalidIds)byId.delete(id);
  for(const id of conflicts)byId.delete(id);
  const groups=new Map<string,ReflectionExperience[]>();
  for(const e of byId.values()){
    const key=JSON.stringify([e.contextKey,e.action]),g=groups.get(key)??[];
    g.push(e);groups.set(key,g);
  }
  const out:ReflectionHypothesis[]=[];
  for(const [key,raw] of groups){
    const ordered=[...raw].sort((a,b)=>a.tick-b.tick||(a.at??a.tick)-(b.at??b.tick)||a.id.localeCompare(b.id)),recent=ordered.slice(-8);
    const success=recent.reduce((s,e)=>s+c(e.success),0)/recent.length;
    const predicted=recent.reduce((s,e)=>s+c(e.predictedUtility),0)/recent.length;
    const surprise=recent.reduce((s,e)=>s+c(e.surprise),0)/recent.length;
    const gap=Math.abs(success-predicted),failures=recent.filter(e=>e.success<REFLECTION_PASS_THRESHOLD).length;
    // Use a declared binary task-success threshold for a conservative descriptive
    // interval. Evidence rows may be temporally correlated, so this interval is not
    // an independently calibrated confidence claim or a promotion credential.
    const passCount=recent.filter(e=>e.success>=REFLECTION_PASS_THRESHOLD).length;
    const passRate=passCount/recent.length,z=1.96,z2=z*z,n=recent.length;
    const denominator=1+z2/n;
    const center=passRate+z2/(2*n);
    const radius=z*Math.sqrt((passRate*(1-passRate)+z2/(4*n))/n);
    const wilsonLower=c((center-radius)/denominator);
    const wilsonUpper=c((center+radius)/denominator);
    const intervalWidth=c(wilsonUpper-wilsonLower);
    const kind:FailureKind=recent.length<4?'insufficient-evidence':failures>=3?'repeated-context-failure':
      gap>=.3?'prediction-gap':success<.45?'low-outcome':surprise>=.65?'unexpected-surprise':'insufficient-evidence';
    if(kind==='insufficient-evidence'&&gap<.2&&success>=.5)continue;
    const priority=c(.28*gap+.25*(1-success)+.17*surprise+.20*(1-wilsonLower)+.10*Math.min(1,failures/4));
    const confidence=c((n/(n+4))*(1-intervalWidth)*(1-gap*.30));
    const contextKey=recent[0].contextKey,action=recent[0].action;
    out.push({key,kind,contextKey,action,occurrences:ordered.length,observedSuccess01:success,
      predictedSuccess01:predicted,predictionGap01:gap,passThreshold01:REFLECTION_PASS_THRESHOLD,passRate01:passRate,wilsonLowerPassRate01:wilsonLower,
      wilsonUpperPassRate01:wilsonUpper,passRateIntervalWidth01:intervalWidth,priority01:priority,
      suggestedNextStep:kind==='repeated-context-failure'?'Create a controlled repair variant and compare it against the current policy':
        kind==='prediction-gap'?'Calibrate the action value and collect an independently checked outcome':
        kind==='unexpected-surprise'?'Inspect the unexpected transition and add a discriminating test':
        kind==='low-outcome'?'Decompose the task and test one changed step at a time':
        'Collect more independent outcomes before changing the skill',
      evidenceNeeded:'At least one independent verifier or human-reviewed outcome on a held-out task; self-reflection alone is insufficient',
      confidence01:confidence,sourceExperienceIds:recent.map(e=>e.id)});
  }
  return out.sort((a,b)=>b.priority01-a.priority01).slice(0,Math.max(1,Math.min(64,Math.floor(num(limit,12)))));
}
function scoreValidatedLearningTarget(t:LearningTargetInput):LearningTarget{
  const rationale:string[]=[];
  if(t.blocked)return {...t,score01:0,rationale:['blocked prerequisite']};
  const score01=c(.23*t.uncertainty01+.20*t.readiness01+.18*t.transfer01+
    .12*t.novelty01+.20*t.repairValue01-.17*t.verificationCost01);
  if(t.repairValue01>=.65)rationale.push('repairs recurring failure');
  if(t.transfer01>=.65)rationale.push('transfers to multiple task families');
  if(t.readiness01>=.6)rationale.push('ready for useful learning');
  if(t.uncertainty01>=.65)rationale.push('high information value');
  if(t.verificationCost01>=.7)rationale.push('expensive to verify');
  return {...t,score01,rationale};
}
export function scoreLearningTarget(t:Omit<LearningTarget,'score01'|'rationale'>):LearningTarget{
  const safe=snapshotLearningTarget(t);
  if(!safe)throw new TypeError('invalid-learning-target-input');
  return scoreValidatedLearningTarget(safe);
}
function readTargetIdentity(value:unknown):string|null{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  try{
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptor=Object.getOwnPropertyDescriptor(value,'id');
    return descriptor&&'value'in descriptor&&isSafeLearningIdentity(descriptor.value,128)?descriptor.value:null;
  }catch{return null;}
}
function sameLearningTarget(a:LearningTargetInput,b:LearningTargetInput):boolean{
  return a.id===b.id&&a.family===b.family&&a.uncertainty01===b.uncertainty01&&
    a.readiness01===b.readiness01&&a.transfer01===b.transfer01&&a.novelty01===b.novelty01&&
    a.verificationCost01===b.verificationCost01&&a.repairValue01===b.repairValue01&&
    (a.blocked??false)===(b.blocked??false);
}
export function rankLearningTargets(targets:readonly Omit<LearningTarget,'score01'|'rationale'>[],limit=10):LearningTarget[]{
  const rawTargets=boundedArrayEntries(targets,MAX_LEARNING_TARGETS);
  if(!rawTargets)return [];
  const byId=new Map<string,LearningTargetInput>(),invalidIds=new Set<string>(),conflicts=new Set<string>();
  for(const raw of rawTargets){
    const rawId=readTargetIdentity(raw);
    const target=snapshotLearningTarget(raw);
    if(!target){
      if(rawId)invalidIds.add(rawId);
      continue;
    }
    if(invalidIds.has(target.id)){conflicts.add(target.id);continue;}
    const previous=byId.get(target.id);
    if(previous){
      if(!sameLearningTarget(previous,target))conflicts.add(target.id);
      continue; // repeated identical proposals cannot occupy multiple curriculum slots
    }
    byId.set(target.id,target);
  }
  for(const id of invalidIds)byId.delete(id);
  for(const id of conflicts)byId.delete(id);
  return [...byId.values()].map(scoreValidatedLearningTarget)
    .sort((a,b)=>b.score01-a.score01||a.id.localeCompare(b.id))
    .slice(0,Math.max(1,Math.min(50,Math.floor(num(limit,10)))));
}
