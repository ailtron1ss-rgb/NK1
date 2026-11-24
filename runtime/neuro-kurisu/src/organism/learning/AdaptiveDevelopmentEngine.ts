import type { ActionKind, IntentCandidate, OrganismDecisionTrace } from '../core/types.ts';

const clamp = (n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIVERSITY_ACTIONS:ActionKind[]=['explore','verify','reflect','respond','defer'];

export interface AdaptiveDevelopmentState {
  version:1;
  cycles:number;
  autonomousCycles:number;
  interventionCount:number;
  actionCounts:Partial<Record<ActionKind,number>>;
  windowSize:number;
  behaviorEntropy01:number;
  diversityPressure01:number;
  explorationPressure01:number;
  noveltyDebt01:number;
  recoveryMode01:number;
  predictionDrift01:number;
  meanSuccess01:number;
  recentSuccesses:number[];
  recentActions:ActionKind[];
  benchmarkRuns:number;
  enduranceSamples:number;
  lastRecommendation:string;
  lastAt:number;
  interventions:Array<{at:number;action:ActionKind;reason:string;score:number}>;
}

export const defaultAdaptiveDevelopment=():AdaptiveDevelopmentState=>({
  version:1,cycles:0,autonomousCycles:0,interventionCount:0,
  actionCounts:{},windowSize:64,behaviorEntropy01:0,diversityPressure01:.25,
  explorationPressure01:.5,noveltyDebt01:.2,recoveryMode01:0,predictionDrift01:0,
  meanSuccess01:.5,recentSuccesses:[],recentActions:[],benchmarkRuns:0,enduranceSamples:0,
  lastRecommendation:'baseline',lastAt:0,interventions:[]
});

function entropy(counts:Partial<Record<ActionKind,number>>){
  const total=ACTIONS.reduce((s,a)=>s+Number(counts[a]||0),0); if(total<=1)return 0;
  const raw=ACTIONS.reduce((h,a)=>{const p=Number(counts[a]||0)/total; return p>0?h-p*Math.log2(p):h;},0);
  return clamp(raw/Math.log2(ACTIONS.length));
}

export class AdaptiveDevelopmentEngine {
  private state=defaultAdaptiveDevelopment();
  restore(value?:Partial<AdaptiveDevelopmentState>|null){
    this.state={...defaultAdaptiveDevelopment(),...(value??{}),actionCounts:{...(value?.actionCounts??{})},recentActions:Array.isArray(value?.recentActions)?value!.recentActions.slice(-64):[],recentSuccesses:Array.isArray(value?.recentSuccesses)?value!.recentSuccesses.slice(-64):[],interventions:Array.isArray(value?.interventions)?value!.interventions.slice(-128):[]};
    this.state.behaviorEntropy01=entropy(this.state.actionCounts);
  }
  snapshot(){return structuredClone(this.state)}
  observeDecision(action:ActionKind, autonomous:boolean, predictionError:number, novelty:number, candidates:IntentCandidate[]){
    this.state.cycles++;
    if(autonomous)this.state.autonomousCycles++; else this.state.interventionCount++;
    this.state.recentActions=[...this.state.recentActions,action].slice(-this.state.windowSize);
    const counts:Partial<Record<ActionKind,number>>={}; for(const a of this.state.recentActions) counts[a]=(counts[a]||0)+1;
    this.state.actionCounts=counts;
    this.state.behaviorEntropy01=entropy(counts);
    const unique=new Set(this.state.recentActions).size;
    const coverage=unique/ACTIONS.length;
    this.state.noveltyDebt01=clamp(this.state.noveltyDebt01*.92 + (1-coverage)*.08);
    this.state.predictionDrift01=clamp(this.state.predictionDrift01*.86 + clamp(predictionError)*.14);
    const lowEntropy=clamp((.48-this.state.behaviorEntropy01)/.48);
    const fewOptions=clamp(1-candidates.filter(c=>c.score>0.08).length/Math.max(1,ACTIONS.length));
    this.state.diversityPressure01=clamp(lowEntropy*.62 + this.state.noveltyDebt01*.28 + fewOptions*.10);
    this.state.explorationPressure01=clamp(.35 + this.state.diversityPressure01*.42 + clamp(novelty)*.18 + this.state.predictionDrift01*.16);
    this.state.lastRecommendation=this.state.diversityPressure01>.65?'increase-behavioral-diversity':this.state.predictionDrift01>.62?'slow-and-verify':'baseline';
    this.state.lastAt=Date.now();
  }
  observeOutcome(success:number){
    const s=clamp(success); this.state.recentSuccesses=[...this.state.recentSuccesses,s].slice(-64);
    this.state.meanSuccess01=this.state.recentSuccesses.reduce((a,b)=>a+b,0)/Math.max(1,this.state.recentSuccesses.length);
    if(s<.4)this.state.recoveryMode01=clamp(this.state.recoveryMode01*.82+.18);
    else this.state.recoveryMode01=clamp(this.state.recoveryMode01*.92-.02);
    this.state.lastAt=Date.now();
  }
  bias(action:ActionKind, input:{external:boolean;energy:number;cognitiveLoad:number;thermal:number;novelty:number;predictionError:number}):number{
    if(input.energy<.28) return action==='rest' ? .08 : 0;
    if(input.thermal>.74) return action==='rest'||action==='wait' ? .10 : action==='explore' ? -.08 : 0;
    let value=0;
    const count=Number(this.state.actionCounts[action]||0);
    const minCount=Math.min(...DIVERSITY_ACTIONS.map(a=>Number(this.state.actionCounts[a]||0)));
    if(!input.external && this.state.diversityPressure01>.36 && count<=minCount) value += .035 + this.state.diversityPressure01*.10;
    if(!input.external && this.state.diversityPressure01>.62 && action==='explore') value += .045*this.state.explorationPressure01;
    if(input.predictionError>.62 && action==='verify') value += .055;
    if(input.predictionError>.7 && action==='reflect') value += .035;
    if(this.state.recoveryMode01>.55 && action==='verify') value += .045;
    if(action==='wait' && !input.external && this.state.diversityPressure01>.72 && input.cognitiveLoad<.72) value -= .045;
    return Math.max(-.12,Math.min(.16,value));
  }
  recommend(candidates:IntentCandidate[], external:boolean):IntentCandidate|null{
    if(external || !candidates.length || this.state.diversityPressure01<.72) return null;
    const counts=this.state.actionCounts;
    const least=DIVERSITY_ACTIONS.slice().sort((a,b)=>Number(counts[a]||0)-Number(counts[b]||0))[0];
    const candidate=candidates.find(c=>c.action===least && c.score>-0.02);
    return candidate??null;
  }
  noteIntervention(action:ActionKind,reason:string,score:number){
    this.state.interventions=[{at:Date.now(),action,reason:reason.slice(0,180),score:clamp(score)},...this.state.interventions].slice(0,128);
  }
  markBenchmark(samples:number){this.state.benchmarkRuns++;this.state.enduranceSamples+=Math.max(0,Math.floor(samples));this.state.lastAt=Date.now();}
}
