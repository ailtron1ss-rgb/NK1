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
export function reflectOnOutcomes(rows:readonly ReflectionExperience[],limit=12):ReflectionHypothesis[]{
  const groups=new Map<string,ReflectionExperience[]>();
  for(const e of rows){
    if(!e||!e.id||!e.contextKey||!e.action)continue;
    const key=JSON.stringify([e.contextKey,e.action]),g=groups.get(key)??[];g.push(e);groups.set(key,g);
  }
  const out:ReflectionHypothesis[]=[];
  for(const [key,raw] of groups){
    const ordered=[...raw].sort((a,b)=>a.tick-b.tick),recent=ordered.slice(-8);
    const success=recent.reduce((s,e)=>s+c(e.success),0)/recent.length;
    const predicted=recent.reduce((s,e)=>s+c(e.predictedUtility),0)/recent.length;
    const surprise=recent.reduce((s,e)=>s+c(e.surprise),0)/recent.length;
    const gap=Math.abs(success-predicted),failures=recent.filter(e=>e.success<.45).length;
    const kind:FailureKind=recent.length<4?'insufficient-evidence':failures>=3?'repeated-context-failure':
      gap>=.3?'prediction-gap':success<.45?'low-outcome':surprise>=.65?'unexpected-surprise':'insufficient-evidence';
    if(kind==='insufficient-evidence'&&gap<.2&&success>=.5)continue;
    const priority=c(.34*gap+.30*(1-success)+.20*surprise+.16*Math.min(1,failures/4));
    const confidence=c((1-Math.exp(-recent.length/5))*(1-gap*.45));
    const contextKey=recent[0].contextKey,action=recent[0].action;
    out.push({key,kind,contextKey,action,occurrences:ordered.length,observedSuccess01:success,
      predictedSuccess01:predicted,predictionGap01:gap,priority01:priority,
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
export function scoreLearningTarget(t:Omit<LearningTarget,'score01'|'rationale'>):LearningTarget{
  const rationale:string[]=[];
  if(t.blocked)return {...t,score01:0,rationale:['blocked prerequisite']};
  const score01=c(.23*c(t.uncertainty01)+.20*c(t.readiness01)+.18*c(t.transfer01)+
    .12*c(t.novelty01)+.20*c(t.repairValue01)-.17*c(t.verificationCost01));
  if(t.repairValue01>=.65)rationale.push('repairs recurring failure');
  if(t.transfer01>=.65)rationale.push('transfers to multiple task families');
  if(t.readiness01>=.6)rationale.push('ready for useful learning');
  if(t.uncertainty01>=.65)rationale.push('high information value');
  if(t.verificationCost01>=.7)rationale.push('expensive to verify');
  return {...t,score01,rationale};
}
export function rankLearningTargets(targets:readonly Omit<LearningTarget,'score01'|'rationale'>[],limit=10):LearningTarget[]{
  return targets.map(scoreLearningTarget).sort((a,b)=>b.score01-a.score01||a.id.localeCompare(b.id))
    .slice(0,Math.max(1,Math.min(50,Math.floor(num(limit,10)))));
}
