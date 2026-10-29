import type { CognitiveFrame, CognitiveDomain } from './CognitiveFrame.ts';
import type { CognitiveSpineDecision } from '../system/CognitiveSpineScheduler.ts';
import type { CognitivePressureFieldState } from '../cognition/CognitivePressureField.ts';
import type { OrganismSystemContract } from './OrganismSystemContract.ts';

export type CognitiveExecutionOperation = 'perception'|'memory'|'world-rollout'|'research'|'shadow'|'project'|'slow-cognition';
export type ExecutionTier = 'critical'|'hot'|'warm'|'cold';

export interface CognitiveExecutionStats {
  runs:number;
  skips:number;
  forced:number;
  opportunities:number;
  estimatedCost01:number;
  estimatedSavings01:number;
  lastReason:string;
}

export interface CognitiveOrganismMetabolism {
  domain:CognitiveDomain;
  priority01:number;
  budgetShare01:number;
  estimatedLoad01:number;
  active:boolean;
}

export interface CognitiveExecutionPlan {
  version:1;
  tick:number;
  mode:CognitiveSpineDecision['mode'];
  reason:string;
  run:Record<CognitiveExecutionOperation,boolean>;
  cost01:Record<CognitiveExecutionOperation,number>;
  informationGain01:Record<CognitiveExecutionOperation,number>;
  expectedValue01:Record<CognitiveExecutionOperation,number>;
  metabolism:Record<CognitiveDomain,CognitiveOrganismMetabolism>;
  stats:Record<CognitiveExecutionOperation,CognitiveExecutionStats>;
}

const OPS:CognitiveExecutionOperation[]=['perception','memory','world-rollout','research','shadow','project','slow-cognition'];
const TIER:Record<CognitiveExecutionOperation,ExecutionTier>={
  perception:'hot',memory:'hot','world-rollout':'warm',research:'cold',shadow:'warm',project:'warm','slow-cognition':'cold',
};
const TIER_ORDER:Record<ExecutionTier,number>={critical:0,hot:1,warm:2,cold:3};
const BASE_COST:Record<CognitiveExecutionOperation,number>={perception:.035,memory:.025,'world-rollout':.12,research:.28,shadow:.08,project:.10,'slow-cognition':.18};
const DOMAIN:Record<CognitiveExecutionOperation,CognitiveDomain>={perception:'embodiment',memory:'memory','world-rollout':'world',research:'research',shadow:'self',project:'agency','slow-cognition':'governance'};
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

function freshStats():CognitiveExecutionStats{return {runs:0,skips:0,forced:0,opportunities:0,estimatedCost01:0,estimatedSavings01:0,lastReason:'initial'};}
function defaultStats():Record<CognitiveExecutionOperation,CognitiveExecutionStats>{return Object.fromEntries(OPS.map(op=>[op,freshStats()])) as Record<CognitiveExecutionOperation,CognitiveExecutionStats>;}

function defaultMetabolism():Record<CognitiveDomain,CognitiveOrganismMetabolism>{
  const domains:CognitiveDomain[]=['self','world','memory','agency','embodiment','research','governance'];
  return Object.fromEntries(domains.map(domain=>[domain,{domain,priority01:0,budgetShare01:0,estimatedLoad01:0,active:false}])) as Record<CognitiveDomain,CognitiveOrganismMetabolism>;
}


export const defaultCognitiveExecutionPlanner=()=>({
  version:1 as const, tick:0, mode:'balanced' as CognitiveSpineDecision['mode'], reason:'initial',
  run:{perception:true,memory:true,'world-rollout':true,research:false,shadow:false,project:false,'slow-cognition':false},
  cost01:{perception:0,memory:0,'world-rollout':0,research:0,shadow:0,project:0,'slow-cognition':0},
  informationGain01:{perception:0,memory:0,'world-rollout':0,research:0,shadow:0,project:0,'slow-cognition':0},
  expectedValue01:{perception:0,memory:0,'world-rollout':0,research:0,shadow:0,project:0,'slow-cognition':0},
  metabolism:defaultMetabolism(),
  stats:defaultStats(),
});

/**
 * Compiles one compact execution plan from normalized signals + the existing spine
 * decision. It is intentionally a pure routing layer: it cannot mutate cognition.
 */
export class CognitiveExecutionPlanner{
  private plan:CognitiveExecutionPlan=defaultCognitiveExecutionPlanner();

  restore(raw?:Partial<CognitiveExecutionPlan>|null){
    const d=defaultCognitiveExecutionPlanner();
    this.plan={...d,...(raw??{}),run:{...d.run,...(raw?.run??{})},cost01:{...d.cost01,...(raw?.cost01??{})},informationGain01:{...d.informationGain01,...(raw?.informationGain01??{})},expectedValue01:{...d.expectedValue01,...(raw?.expectedValue01??{})},metabolism:{...d.metabolism,...(raw?.metabolism??{})},stats:{...d.stats}};
    for(const op of OPS)this.plan.stats[op]={...d.stats[op],...(raw?.stats?.[op]??{})};
  }

  compile(frame:CognitiveFrame, spine:CognitiveSpineDecision, remainingBudget01:number, pressure?:CognitivePressureFieldState, contracts?:ReadonlyArray<Pick<OrganismSystemContract,'name'|'estimatedCost01'|'cadenceCycles'|'phase'|'executionRank'>>):CognitiveExecutionPlan{
    const budget=clamp(remainingBudget01);
    const plan=defaultCognitiveExecutionPlanner() as CognitiveExecutionPlan;
    plan.tick=frame.tick;plan.mode=spine.mode;plan.reason=`${frame.reason};spine=${spine.reason};interrupt=${frame.interrupt?.type??'none'}:${(frame.interrupt?.priority01??0).toFixed(2)}`;
    const shadowEscalation=(pressure?.sources?.shadowEscalation01??0)>.5;
    const highDemand=frame.deepDemand01>.66||frame.predictionError01>.55||frame.goalPressure01>.72||shadowEscalation;
    const lowResource=frame.energy01<.30||frame.cognitiveCapacity01<.28||frame.thermal01>.72||frame.ramPressure01>.78||budget<.24;
    // External input wakes perception/memory, but does not automatically force
    // expensive warm/cold cognition. Deep work must earn its compute budget.
    const interruptForced=Boolean(frame.interrupt?.active && (frame.interrupt?.priority01??0)>.78);
    const forced = (highDemand || interruptForced) && !lowResource;

    const domainList: CognitiveDomain[]=['self','world','memory','agency','embodiment','research','governance'];
    const contractByDomain = new Map((contracts ?? []).map(c=>[c.name,c]));
    const rawWeights:Record<CognitiveDomain,number> = {} as Record<CognitiveDomain,number>;
    for(const domain of domainList){
      const active=Boolean(frame.domains[domain]);
      const contract=contractByDomain.get(domain);
      const priority=clamp((frame.expectedInformationGain01*.42)+(frame.goalPressure01*.14)+(domain==='governance'?frame.uncertainty01*.10:0)+(pressure?.domains?.[domain]??0)*.34);
      const criticality=contract?.phase==='critical' ? 1.28 : contract?.phase==='hot' ? 1.08 : contract?.phase==='warm' ? .94 : .72;
      const cheapness=1/(.55+(contract?.estimatedCost01??.2));
      const cadenceFactor=1/Math.max(1,contract?.cadenceCycles??1);
      rawWeights[domain]=Math.max(.01, criticality*(.45+priority*.75)*(.70+cheapness*.30)*(active?1:0.28)*(domain==='research'?(.65+(pressure?.informationUrgency01 ?? 0)*.65):1)*(domain==='governance'?1.12:1));
      plan.metabolism[domain]={domain,priority01:priority,budgetShare01:0,estimatedLoad01:active?clamp(frame.complexity01*(domain==='embodiment'?1.2:domain==='memory'?.85:1)):0,active};
      // Cadence factors are discounts in (0, 1]; the former >1 guard made this adjustment unreachable.
      if(cadenceFactor<1) rawWeights[domain]*=cadenceFactor;
    }
    const totalWeight=Math.max(.01,Object.values(rawWeights).reduce((sum,x)=>sum+x,0));
    for(const domain of domainList) plan.metabolism[domain].budgetShare01=clamp(rawWeights[domain]/totalWeight);
    const governanceFloor=.08;
    const currentGovernance=plan.metabolism.governance.budgetShare01;
    if(currentGovernance<governanceFloor){
      const deficit=governanceFloor-currentGovernance;
      const donorDomains=domainList.filter(domain=>domain!=='governance');
      const donorTotal=donorDomains.reduce((sum,domain)=>sum+plan.metabolism[domain].budgetShare01,0);
      plan.metabolism.governance.budgetShare01=governanceFloor;
      if(donorTotal>0) for(const domain of donorDomains) plan.metabolism[domain].budgetShare01=clamp(plan.metabolism[domain].budgetShare01-(deficit*(plan.metabolism[domain].budgetShare01/donorTotal)));
    }
    let budgetRemaining=budget;
    for(const op of [...OPS].sort((a,b)=>TIER_ORDER[TIER[a]]-TIER_ORDER[TIER[b]]||OPS.indexOf(a)-OPS.indexOf(b))){
      const domain=frame.domains[DOMAIN[op]];
      const metabolism=plan.metabolism[DOMAIN[op]];
      const tier=TIER[op];
      const spineRun=(op==='research'||op==='world-rollout'||op==='shadow'||op==='project')?spine.run[op]:true;
      const organBase = contractByDomain.get(DOMAIN[op])?.estimatedCost01;
      const base=BASE_COST[op] * (organBase == null ? 1 : (0.72 + organBase * 0.8));
      const complexity=(1+frame.complexity01*.55+frame.thermal01*.20+frame.ramPressure01*.18);
      const cost=clamp(base*complexity);
      const informationGain=clamp(frame.expectedInformationGain01*(domain?.62:.20)+frame.goalPressure01*.08+(pressure?.informationUrgency01??0)*.08);
      const organCapacity=clamp(budget*(0.36+metabolism.budgetShare01*2.15));
      const cheap=cost<=organCapacity;
      const organCadence = contractByDomain.get(DOMAIN[op])?.cadenceCycles ?? 1;
      const rankBoost=clamp(((10-(contractByDomain.get(DOMAIN[op])?.executionRank??9))/10)*.06);
      const pressureBoost=clamp((pressure?.domains?.[DOMAIN[op]]??0)*.24 + rankBoost);
      const resourceFactor=clamp(.35+budget*.72)*clamp(.45+frame.cognitiveCapacity01*.72)*clamp(.60+frame.energy01*.40)*clamp(.55+frame.attentionBudget01*.55);
      const urgencyFactor=clamp(.45+frame.goalPressure01*.35+frame.predictionError01*.35+frame.uncertainty01*.25);
      const dirtyBoost=(frame.dirtyDomains?.[DOMAIN[op]] ?? false) ? .14 : -.08;
      const epistemicGain=clamp(informationGain*(.58+urgencyFactor*.42)+pressureBoost*.18+dirtyBoost);
      // Expected value is a net compute benefit, not a raw gain/cost ratio.
      // This avoids making cheap operations look infinitely valuable when the
      // epistemic signal is tiny, which is especially important on mobile.
      const expectedValue=clamp(epistemicGain*resourceFactor-cost+pressureBoost*.08);
      plan.expectedValue01[op]=expectedValue;
      const valueThreshold = tier==='critical' ? .02 : tier==='hot' ? .02 : tier==='warm' ? .08 : .14;
      const pressureAllows=pressureBoost>.18;
      let run=false;
      if(op==='perception') run=domain && (frame.externalInput||frame.tick%4===0||spine.mode==='deep');
      else if(op==='memory') run=domain && (frame.externalInput||frame.predictionError01>.20||frame.tick%4===0);
      else if(op==='slow-cognition') run=domain && (spine.mode==='deep'||shadowEscalation||frame.tick % Math.max(8,organCadence)===0) && !lowResource;
      else run=domain && spineRun && (forced || (pressureAllows && (expectedValue>=valueThreshold || pressureBoost>.34 || spine.mode==='deep')));

      // Hard safety rule: governance does not disappear under pressure; slow work does.
      if(op==='slow-cognition' && (frame.thermal01>.80||frame.ramPressure01>.86||frame.energy01<.18)) run=false;
      if((tier==='cold'||tier==='warm') && lowResource && !forced) run=false;
      // `forced` raises priority but never creates compute capacity: a scheduled plan
      // must fit the remaining aggregate budget, not only each operation's local share.
      let budgetBlocked=false;
      if(run&&cost>budgetRemaining+1e-9){run=false;budgetBlocked=true;}
      if(run)budgetRemaining=Math.max(0,budgetRemaining-cost);
      plan.run[op]=Boolean(run);
      plan.cost01[op]=run?cost:0;
      plan.informationGain01[op]=run?informationGain:0;
      const s=plan.stats[op]; s.opportunities+=1;
      if(run){s.runs+=1;s.forced+=forced?1:0;s.estimatedCost01=clamp(s.estimatedCost01*.95+cost*.05);s.lastReason=`run:${tier};evc=${expectedValue.toFixed(2)};cheap=${cheap};forced=${forced}`;}
      else{s.skips+=1;s.estimatedSavings01=clamp(s.estimatedSavings01*.95+cost*.05);s.lastReason=`skip:${budgetBlocked?'budget-exhausted':!domain?'domain-cold':!spineRun?'spine-gated':lowResource?'resource-guard':expectedValue<valueThreshold?'evc-low':'cadence'}`;}
    }
    this.plan=plan;
    return this.snapshot();
  }

  snapshot():CognitiveExecutionPlan{
    return { ...this.plan, run:{...this.plan.run}, cost01:{...this.plan.cost01}, informationGain01:{...this.plan.informationGain01}, expectedValue01:{...this.plan.expectedValue01}, metabolism:Object.fromEntries(Object.entries(this.plan.metabolism).map(([k,v])=>[k,{...v}])) as Record<CognitiveDomain,CognitiveOrganismMetabolism>, stats:Object.fromEntries(OPS.map(op=>[op,{...this.plan.stats[op]}])) as Record<CognitiveExecutionOperation,CognitiveExecutionStats> };
  }

  cumulativeSavings01(){
    const rows=OPS.map(op=>this.plan.stats[op]);
    const skipped=rows.reduce((s,r)=>s+r.skips,0), opportunities=rows.reduce((s,r)=>s+r.opportunities,0);
    return clamp(skipped/Math.max(1,opportunities));
  }
}
