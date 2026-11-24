import { isSafeLearningIdentity, snapshotPlainData } from './LearningTrustBoundary.ts';

/**
 * Outcome-driven reflection and active curriculum for Neuro-Kurisu.
 * Reflection is a hypothesis generator, not ground truth: promotion still requires
 * independent validation. Inspired by Reflexion, Voyager curriculum, SkillLearnBench
 * and STATE-Bench's outcome-oriented evaluation.
 */
export type ReflectionFailureClass='tool-error'|'timeout'|'permission-denied'|'safety-block'|'postcondition-mismatch'|'resource-exhaustion'|'low-confidence';
export function isReflectionFailureClass(value:unknown):value is ReflectionFailureClass {
  return typeof value==='string'&&(['tool-error','timeout','permission-denied','safety-block','postcondition-mismatch','resource-exhaustion','low-confidence'] as const).includes(value as ReflectionFailureClass);
}
/** Retain only a compact failure taxonomy; never persist free-form feedback text in P23. */
export function classifyLearningFailureReason(notes:unknown):ReflectionFailureClass|undefined {
  if(typeof notes!=='string')return undefined;
  const reason=notes.slice(0,512).toLowerCase();
  if(!reason.trim())return undefined;
  if(/safety|ethical.?gate|policy.?block|blocked by policy|запрет|этическ|заблокир.*политик/.test(reason))return 'safety-block';
  if(/postcondition|post-condition|effect not observed|consequence.*mismatch|expected effect.*(missing|mismatch)|не подтвержд.*результ|расхожд.*последств/.test(reason))return 'postcondition-mismatch';
  if(/timeout|timed out|deadline|таймаут|временн.*лимит|истек.*врем/.test(reason))return 'timeout';
  if(/permission denied|unauthori[sz]ed|forbidden|no permission|нет доступа|не авториз|не разрешено/.test(reason))return 'permission-denied';
  if(/out of memory|resource.?exhaust|budget exceeded|resource limit|cardinality limit|исчерпан.*ресурс|превышен.*лимит/.test(reason))return 'resource-exhaustion';
  if(/low confidence|insufficient evidence|no evidence|confidence too low|низк.*уверенн|недостаточн.*данн|нет доказательств/.test(reason))return 'low-confidence';
  if(/tool error|provider error|gateway error|tool failed|failed tool(?: call| invocation)?|tool call failed|tool invocation failed|adapter error|ошибк.*инструмент|инструмент.*ошибк|сбой.*инструмент|не удалось.*инструмент|ошибк.*провайдер|ошибк.*шлюз/.test(reason))return 'tool-error';
  return undefined;
}
export type FailureKind='prediction-gap'|'low-outcome'|'low-reward-efficiency'|'unexpected-surprise'|'repeated-context-failure'|'stale-skill'|'insufficient-evidence';
export interface ReflectionExperience {
  id:string; contextKey:string; action:string; success:number; predictedUtility:number;
  surprise:number; tick:number; at?:number; reward?:number; failureClass?:ReflectionFailureClass;
}
export interface ReflectionHypothesis {
  key:string; kind:FailureKind; contextKey:string; action:string; occurrences:number;
  /** Number of unique valid observations used for the reported recent-window metrics. */
  sampleCount:number;
  windowStartTick:number; windowEndTick:number;
  observedSuccess01:number; predictedSuccess01:number; predictionGap01:number;
  /** Outcome reward is kept separate from task success so high-cost success can be diagnosed. */
  rewardObserved01?:number; rewardGap01?:number;
  /** Binary pass/fail threshold used for descriptive pass-rate metrics. */
  passThreshold01:number;
  passRate01:number;
  /** Descriptive Wilson interval; not calibrated inference when rows are correlated. */
  wilsonLowerPassRate01:number;
  wilsonUpperPassRate01:number;
  passRateIntervalWidth01:number;
  priority01:number; suggestedNextStep:string; evidenceNeeded:string;
  confidence01:number; sourceExperienceIds:string[]; dominantFailureClass?:ReflectionFailureClass; failureClassOccurrences?:number;
}
export interface LearningTarget {
  id:string; family:string; uncertainty01:number; readiness01:number; transfer01:number;
  novelty01:number; verificationCost01:number; repairValue01:number; blocked?:boolean;
  score01:number; rationale:string[];
}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const num=(x:number,d=0)=>Number.isFinite(x)?x:d;
const compareText=(a:string,b:string)=>a<b?-1:a>b?1:0;
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
  try{
    // Array.isArray can throw for a revoked Proxy; keep the complete boundary fail-closed.
    if(!Array.isArray(value))return null;
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
  try{
    if(value===null||typeof value!=='object'||Array.isArray(value))return null;
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
       (x.reward!==undefined&&!isUnit(x.reward))||(x.failureClass!==undefined&&!isReflectionFailureClass(x.failureClass))||
       (x.at!==undefined&&(!Number.isSafeInteger(x.at)||typeof x.at!=='number'||x.at<0)))return null;
    return {id:x.id,contextKey:x.contextKey,action:x.action,success:x.success,
      predictedUtility:x.predictedUtility,surprise:x.surprise,tick:x.tick,
      ...(x.at===undefined?{}:{at:x.at as number}),...(x.reward===undefined?{}:{reward:x.reward as number}),...(x.failureClass===undefined?{}:{failureClass:x.failureClass as ReflectionFailureClass})};
  }catch{return null;}
}
function sameReflectionExperience(a:ReflectionExperience,b:ReflectionExperience):boolean{
  return a.id===b.id&&a.contextKey===b.contextKey&&a.action===b.action&&a.success===b.success&&
    a.predictedUtility===b.predictedUtility&&a.surprise===b.surprise&&a.tick===b.tick&&(a.at??null)===(b.at??null)&&(a.reward??null)===(b.reward??null)&&(a.failureClass??null)===(b.failureClass??null);
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
    const ordered=[...raw].sort((a,b)=>a.tick-b.tick||(a.at??a.tick)-(b.at??b.tick)||compareText(a.id,b.id)),recent=ordered.slice(-8);
    const success=recent.reduce((s,e)=>s+c(e.success),0)/recent.length;
    const predicted=recent.reduce((s,e)=>s+c(e.predictedUtility),0)/recent.length;
    const surprise=recent.reduce((s,e)=>s+c(e.surprise),0)/recent.length;
    const rewardValues=recent.flatMap(e=>e.reward===undefined?[]:[e.reward]);
    const rewardMean=rewardValues.length?rewardValues.reduce((s,e)=>s+c(e),0)/rewardValues.length:null;
    const failureClassCounts=new Map<ReflectionFailureClass,number>();
    for(const e of recent)if(e.failureClass)failureClassCounts.set(e.failureClass,(failureClassCounts.get(e.failureClass)??0)+1);
    const failureClassRows=[...failureClassCounts.entries()].sort((a,b)=>b[1]-a[1]||compareText(a[0],b[0]));
    const dominantFailureClass=failureClassRows[0]&&failureClassRows[0][1]>=2?failureClassRows[0][0]:undefined;
    const dominantFailureClassCount=dominantFailureClass?failureClassCounts.get(dominantFailureClass)??0:0;
    const reasonRecurrence01=dominantFailureClass?dominantFailureClassCount/recent.length:0;
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
      gap>=.3?'prediction-gap':success<.45?'low-outcome':rewardMean!==null&&rewardMean<.35?'low-reward-efficiency':surprise>=.65?'unexpected-surprise':'insufficient-evidence';
    if(kind==='insufficient-evidence'&&gap<.2&&success>=.5)continue;
    const basePriority=c(.28*gap+.25*(1-success)+.17*surprise+.20*(1-wilsonLower)+.10*Math.min(1,failures/4));
    // Reward is an additional objective only when present in real recorded experience;
    // old rows retain their prior ranking while high-cost successes become diagnosable.
    const rewardAdjustedPriority=rewardMean===null?basePriority:basePriority*.88+(1-rewardMean)*.12;
    const priority=c(dominantFailureClass?rewardAdjustedPriority*.92+reasonRecurrence01*.08:rewardAdjustedPriority);
    const confidence=c((n/(n+4))*(1-intervalWidth)*(1-gap*.30));
    const contextKey=recent[0].contextKey,action=recent[0].action;
    out.push({key,kind,contextKey,action,occurrences:ordered.length,sampleCount:recent.length,
      windowStartTick:recent[0].tick,windowEndTick:recent[recent.length-1].tick,observedSuccess01:success,
      predictedSuccess01:predicted,predictionGap01:gap,...(rewardMean===null?{}:{rewardObserved01:rewardMean,rewardGap01:c(1-rewardMean)}),passThreshold01:REFLECTION_PASS_THRESHOLD,passRate01:passRate,wilsonLowerPassRate01:wilsonLower,
      wilsonUpperPassRate01:wilsonUpper,passRateIntervalWidth01:intervalWidth,priority01:priority,
      suggestedNextStep:dominantFailureClass==='safety-block'?'Inspect the safety-gate preconditions and redesign the action without bypassing the policy':
        dominantFailureClass==='postcondition-mismatch'?'Repair the expected-effect contract and require a fresh observed postcondition before promotion':
        dominantFailureClass==='timeout'?'Isolate the slow step, reduce bounded work and retry only within the declared deadline':
        dominantFailureClass==='permission-denied'?'Check the granted capability and preserve least privilege; do not bypass the permission gate':
        dominantFailureClass==='resource-exhaustion'?'Reduce context, batch or trajectory cardinality and rerun under the same resource budget':
        dominantFailureClass==='low-confidence'?'Gather independent held-out evidence and recalibrate confidence before changing the skill':
        dominantFailureClass==='tool-error'?'Check the adapter contract and typed error, then add bounded retry/backoff if idempotent':
        kind==='repeated-context-failure'?'Create a controlled repair variant and compare it against the current policy':
        kind==='prediction-gap'?'Calibrate the action value and collect an independently checked outcome':
        kind==='unexpected-surprise'?'Inspect the unexpected transition and add a discriminating test':
        kind==='low-outcome'?'Decompose the task and test one changed step at a time':
        kind==='low-reward-efficiency'?'Compare outcome benefit against resource cost and reduce unnecessary steps':
        'Collect more independent outcomes before changing the skill',
      evidenceNeeded:'At least one independent verifier or human-reviewed outcome on a held-out task; self-reflection alone is insufficient',
      confidence01:confidence,sourceExperienceIds:recent.map(e=>e.id),...(dominantFailureClass?{dominantFailureClass,failureClassOccurrences:dominantFailureClassCount}:{})});
  }
  return out.sort((a,b)=>b.priority01-a.priority01||b.confidence01-a.confidence01||b.windowEndTick-a.windowEndTick||compareText(a.contextKey,b.contextKey)||compareText(a.action,b.action)||compareText(a.key,b.key)).slice(0,Math.max(1,Math.min(64,Math.floor(num(limit,12)))));
}
function scoreValidatedLearningTarget(t:LearningTargetInput):LearningTarget{
  const rationale:string[]=[];
  if(t.blocked)return {...t,score01:0,rationale:['blocked prerequisite']};
  // Costs are a penalty, but score01 is a public normalized metric and must stay in [0,1].
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
  try{
    if(value===null||typeof value!=='object'||Array.isArray(value))return null;
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
/** True when a is no worse than b on every learning objective and strictly better on at least one. */
function dominatesLearningTarget(a:LearningTarget,b:LearningTarget):boolean{
  if(a.blocked||b.blocked)return false;
  const left=[a.uncertainty01,a.readiness01,a.transfer01,a.novelty01,1-a.verificationCost01,a.repairValue01];
  const right=[b.uncertainty01,b.readiness01,b.transfer01,b.novelty01,1-b.verificationCost01,b.repairValue01];
  let strict=false;
  for(let i=0;i<left.length;i++){
    if(left[i]<right[i])return false;
    if(left[i]>right[i])strict=true;
  }
  return strict;
}

/**
 * Compute Pareto layers in O(n²) time using a dominance DAG. This preserves
 * candidates with complementary strengths instead of collapsing them into one
 * weighted score; blocked targets are intentionally placed after all eligible ones.
 */
function learningTargetParetoLayers(targets:readonly LearningTarget[]):Map<string,number>{
  const dominated=targets.map(()=>[] as number[]);
  const incoming=targets.map(()=>0);
  for(let i=0;i<targets.length;i++){
    if(targets[i].blocked)continue;
    for(let j=0;j<targets.length;j++){
      if(i===j||targets[j].blocked)continue;
      if(dominatesLearningTarget(targets[i],targets[j])){
        dominated[i].push(j);
        incoming[j]++;
      }
    }
  }
  let frontier:number[]=[];
  for(let i=0;i<targets.length;i++)if(!targets[i].blocked&&incoming[i]===0)frontier.push(i);
  const layers=new Map<string,number>();
  let depth=0;
  while(frontier.length){
    const next:number[]=[];
    for(const index of frontier){
      layers.set(targets[index].id,depth);
      for(const child of dominated[index]){
        incoming[child]--;
        if(incoming[child]===0)next.push(child);
      }
    }
    frontier=next;
    depth++;
  }
  for(const target of targets)if(target.blocked||!layers.has(target.id))layers.set(target.id,Number.MAX_SAFE_INTEGER);
  return layers;
}

export function rankLearningTargets(targets:readonly Omit<LearningTarget,'score01'|'rationale'>[],limit=10,strategy:'weighted-score'|'pareto-frontier'='weighted-score'):LearningTarget[]{
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
  const maximum=Math.max(1,Math.min(50,Math.floor(num(limit,10))));
  const scored=[...byId.values()].map(scoreValidatedLearningTarget);
  const paretoLayers=strategy==='pareto-frontier'?learningTargetParetoLayers(scored):null;
  const compareRanked=(a:LearningTarget,b:LearningTarget):number=>{
    if(paretoLayers){
      const layerDelta=(paretoLayers.get(a.id)??Number.MAX_SAFE_INTEGER)-(paretoLayers.get(b.id)??Number.MAX_SAFE_INTEGER);
      if(layerDelta!==0)return layerDelta;
    }
    return b.score01-a.score01||compareText(a.id,b.id);
  };
  scored.sort(compareRanked);
  // Voyager-style automatic curricula should not fill every slot with repeated
  // variants of a single family when other eligible families have evidence-backed
  // work. Keep each family internally score-ordered, then interleave family heads;
  // the globally best target remains first and a single-family queue is unchanged.
  const families=new Map<string,LearningTarget[]>();
  for(const target of scored){
    const rows=families.get(target.family)??[];
    rows.push(target);
    families.set(target.family,rows);
  }
  const ranked:LearningTarget[]=[];
  while(ranked.length<maximum){
    const heads=[...families.entries()].filter(([,rows])=>rows.length>0)
      .sort((a,b)=>compareRanked(a[1][0],b[1][0]));
    if(!heads.length)break;
    if(heads.length===1){
      ranked.push(...heads[0][1].splice(0,maximum-ranked.length));
      break;
    }
    for(const [,rows] of heads){
      if(ranked.length>=maximum)break;
      ranked.push(rows.shift()!);
    }
  }
  return ranked;
}
