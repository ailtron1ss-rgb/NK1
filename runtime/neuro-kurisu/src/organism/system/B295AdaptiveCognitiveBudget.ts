/**
 * B295 — Adaptive Cognitive Budget + first OrganismCore decomposition seam.
 *
 * This layer owns neither personality nor memory nor world-model state.
 * It decides how much compute to spend on already-existing subsystems.
 * The plan is bounded, persistent, multi-timescale and evidence-aware.
 *
 * The point is to replace scattered hard-coded cadences with one explicit
 * resource policy. It is intentionally cheap enough for a medium Android
 * device and stable enough to survive restart.
 */

export type B295PerformanceProfile = 'mobile'|'balanced'|'quality'|'research';
export type B295SystemName = 'b289'|'b290'|'b291'|'b292'|'b293'|'b294'|'shadow'|'imagination';

export interface B295BudgetInput {
  tick:number;
  profile:B295PerformanceProfile;
  energy01:number;
  thermal01:number;
  cognitiveLoad01:number;
  uncertainty01:number;
  novelty01:number;
  goalPressure01:number;
  predictionError01:number;
  externalInput01:number;
  autonomy01:number;
  eventLineage01:number;
  causalConfidence01:number;
  memoryLoad01:number;
}

export interface B295BudgetPlan {
  mode:'protect'|'economy'|'balanced'|'explore'|'deep';
  budget01:number;
  neuralIntensity01:number;
  computeDebt01:number;
  cadence:Record<B295SystemName,number>;
  run:Record<B295SystemName,boolean>;
  reasons:string[];
}

export interface B295AdaptiveCognitiveBudgetState {
  version:1;
  tick:number;
  decisions:number;
  lastMode:B295BudgetPlan['mode'];
  budget01:number;
  computeDebt01:number;
  utilityEma01:number;
  costEma01:number;
  thermalGuard01:number;
  lastPlan:B295BudgetPlan;
  accumulatedCost01:number;
  accumulatedUtility01:number;
  protectedCycles:number;
  deepCycles:number;
}

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const ema=(prev:number,next:number,alpha:number)=>prev*(1-alpha)+next*alpha;

const BASE_CADENCE:Record<B295PerformanceProfile,Record<B295SystemName,number>>={
  mobile:{b289:1,b290:256,b291:32,b292:64,b293:4,b294:1,shadow:32,imagination:128},
  balanced:{b289:1,b290:32,b291:16,b292:32,b293:4,b294:1,shadow:24,imagination:64},
  quality:{b289:1,b290:8,b291:8,b292:16,b293:2,b294:1,shadow:16,imagination:32},
  research:{b289:1,b290:4,b291:4,b292:8,b293:1,b294:1,shadow:8,imagination:16}
};

export const defaultB295AdaptiveCognitiveBudget=():B295AdaptiveCognitiveBudgetState=>({
  version:1,tick:0,decisions:0,lastMode:'balanced',budget01:.72,computeDebt01:.12,
  utilityEma01:.52,costEma01:.28,thermalGuard01:.0,
  lastPlan:{mode:'balanced',budget01:.72,neuralIntensity01:.68,computeDebt01:.12,
    cadence:{...BASE_CADENCE.balanced},run:{b289:true,b290:false,b291:false,b292:false,b293:false,b294:false,shadow:false,imagination:false},reasons:['initial']},
  accumulatedCost01:0,accumulatedUtility01:0,protectedCycles:0,deepCycles:0
});

export class B295AdaptiveCognitiveBudget {
  private state=B295AdaptiveCognitiveBudget.normalize(defaultB295AdaptiveCognitiveBudget());

  private static normalize(raw:Partial<B295AdaptiveCognitiveBudgetState>):B295AdaptiveCognitiveBudgetState{
    const d=defaultB295AdaptiveCognitiveBudget();
    const r:any=raw??{};
    const plan=r.lastPlan??d.lastPlan;
    const cadence={...d.lastPlan.cadence,...(plan.cadence??{})};
    const run={...d.lastPlan.run,...(plan.run??{})};
    return {...d,...r,version:1,lastPlan:{...d.lastPlan,...plan,cadence,run,reasons:Array.isArray(plan.reasons)?plan.reasons.slice(-8):['restored']}};
  }

  restore(raw?:Partial<B295AdaptiveCognitiveBudgetState>|null){this.state=B295AdaptiveCognitiveBudget.normalize(raw??defaultB295AdaptiveCognitiveBudget());}
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {...this.state,lastPlan:structuredClone(this.state.lastPlan)};}
  metrics(){return {tick:this.state.tick,budget01:this.state.budget01,computeDebt01:this.state.computeDebt01,utilityEma01:this.state.utilityEma01,costEma01:this.state.costEma01,mode:this.state.lastMode,protectedCycles:this.state.protectedCycles,deepCycles:this.state.deepCycles};}
  currentPlan(){return this.state.lastPlan;}

  plan(input:B295BudgetInput):B295BudgetPlan{
    const i={...input};
    const stress=clamp01(i.thermal01*.36+i.cognitiveLoad01*.24+i.uncertainty01*.14+i.memoryLoad01*.10+this.state.computeDebt01);
    const energyPenalty=clamp01(1-i.energy01);
    const urgency=clamp01(i.goalPressure01*.28+i.predictionError01*.24+i.novelty01*.16+i.externalInput01*.10+i.autonomy01*.12+(1-i.causalConfidence01)*.10);
    const evidence=clamp01(i.eventLineage01*.45+i.causalConfidence01*.35+(1-i.uncertainty01)*.20);
    const thermalGuard=clamp01(i.thermal01*.72+(i.energy01<.30?.35:0));
    const rawBudget=clamp01(.86-stress*.42-energyPenalty*.20+urgency*.24+evidence*.10);

    let mode:B295BudgetPlan['mode']='balanced';
    const reasons:string[]=[];
    if(i.thermal01>.72 || i.energy01<.24 || i.cognitiveLoad01>.86){mode='protect';reasons.push('resource-protection');}
    else if(urgency>.70 && evidence>.55 && i.energy01>.62 && i.thermal01<.55){mode='deep';reasons.push('high-value-deep-processing');}
    else if(rawBudget<.38){mode='economy';reasons.push('budget-pressure');}
    else if(urgency>.72 && i.energy01>.50 && i.thermal01<.62){mode='explore';reasons.push('high-autonomous-urgency');}
    else reasons.push('stable-multitimescale');

    const cadenceBase={...BASE_CADENCE[i.profile]};
    const factor=mode==='protect'?2.5:mode==='economy'?1.7:mode==='balanced'?1:mode==='explore'?.80:.62;
    const cadence:Record<B295SystemName,number>=Object.fromEntries(Object.entries(cadenceBase).map(([k,v])=>[k,Math.max(1,Math.round(v*factor))])) as Record<B295SystemName,number>;
    // Fast loops are allowed to stay fast. Slow loops become slower under stress.
    cadence.b289=1; cadence.b294=1;
    if(mode==='protect'){cadence.b293=Math.max(cadence.b293,8);cadence.b290=Math.max(cadence.b290,128);cadence.shadow=Math.max(cadence.shadow,64);cadence.imagination=Math.max(cadence.imagination,256);}
    if(mode==='deep'){cadence.b291=Math.max(2,cadence.b291);cadence.b293=Math.max(1,cadence.b293);cadence.imagination=Math.max(4,cadence.imagination);}

    const budget01=clamp01(rawBudget-this.state.computeDebt01*.18+this.state.utilityEma01*.08);
    const neuralIntensity01=clamp01(budget01*(.68+urgency*.24+(1-i.causalConfidence01)*.08));
    const computeDebt01=clamp01(this.state.computeDebt01*.90 + Math.max(0,(.60-budget01))*.15 + energyPenalty*.04);
    const shouldRun=(name:B295SystemName)=>i.tick%cadence[name]===0;
    const run={
      b289:true,
      b290:shouldRun('b290'),
      b291:shouldRun('b291') || mode==='deep',
      b292:shouldRun('b292'),
      b293:shouldRun('b293'),
      b294:true,
      shadow:shouldRun('shadow') && mode!=='protect',
      imagination:shouldRun('imagination') && (mode==='explore'||mode==='deep')
    };
    if(mode==='protect') reasons.push('protect-mode-disables-shadow-and-imagination');
    if(input.causalConfidence01<.35) reasons.push('low-causal-confidence');
    if(input.eventLineage01<.35) reasons.push('low-event-lineage');

    const plan:B295BudgetPlan={mode,budget01,neuralIntensity01,computeDebt01,cadence,run,reasons};
    this.state={...this.state,tick:i.tick,decisions:this.state.decisions+1,lastMode:mode,budget01,computeDebt01,thermalGuard01:thermalGuard,lastPlan:plan};
    if(mode==='protect')this.state.protectedCycles++;
    if(mode==='deep')this.state.deepCycles++;
    return plan;
  }

  observeOutcome(input:{cost01:number;utility01:number;predictionError01:number;accepted01:boolean;tick:number}){
    const cost=clamp01(input.cost01),utility=clamp01(input.utility01),pe=clamp01(input.predictionError01);
    this.state.costEma01=ema(this.state.costEma01,cost,.08);
    this.state.utilityEma01=ema(this.state.utilityEma01,utility,.09);
    this.state.computeDebt01=clamp01(this.state.computeDebt01*.88+cost*.08+pe*.03-(input.accepted01?.03:0));
    this.state.accumulatedCost01+=cost; this.state.accumulatedUtility01+=utility; this.state.tick=input.tick;
  }
}
