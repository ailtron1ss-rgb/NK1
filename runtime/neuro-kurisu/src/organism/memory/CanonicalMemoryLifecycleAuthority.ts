import type { P70MemoryLifecycleGovernor } from '../developmental/P70MemoryLifecycleGovernor.ts';
import type { MemoryFabric } from './MemoryFabric.ts';
import type { MemoryConsolidationController, ConsolidationCandidate, ConsolidationDecision } from './MemoryConsolidationController.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const safeCounter=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const safeTick=(value:unknown):number|null=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const safeLabel=(value:unknown,max=128):string|undefined=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():undefined;
const safePlan=(raw:unknown):CanonicalMemoryLifecycleState['lastPlan']=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
  const row=raw as Record<string,unknown>, budgets=row.budgets;
  if(!budgets||typeof budgets!=='object'||Array.isArray(budgets))return undefined;
  const b=budgets as Record<string,unknown>;
  const keys=['traces','events','goals','memories','semanticItems'] as const;
  if(keys.some(key=>safeCounter(b[key],-1)<0))return undefined;
  const action=row.action;
  if(action!=='idle'&&action!=='trim'&&action!=='compact')return undefined;
  return {budgets:{traces:safeCounter(b.traces),events:safeCounter(b.events),goals:safeCounter(b.goals),memories:safeCounter(b.memories),semanticItems:safeCounter(b.semanticItems)},action,pressure01:clamp01(typeof row.pressure01==='number'?row.pressure01:0),hotLoad01:clamp01(typeof row.hotLoad01==='number'?row.hotLoad01:0)};
};
const safeDecisions=(raw:unknown):ConsolidationDecision[]=>{
  if(!Array.isArray(raw))return [];
  const routes=new Set(['hippocampal','cortical','procedural','defer']);
  return raw.slice(0,32).flatMap(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return [];
    const row=value as Record<string,unknown>,id=safeLabel(row.id,128),reason=safeLabel(row.reason,240);
    if(!id||!reason||!routes.has(String(row.route)))return [];
    const numbers=['priority01','plasticity01','retention01','overconsolidationRisk01','reinforcement01'] as const;
    if(numbers.some(key=>typeof row[key]!=='number'||!Number.isFinite(row[key])))return [];
    return [{id,route:row.route as ConsolidationDecision['route'],reason,priority01:clamp01(row.priority01 as number),plasticity01:clamp01(row.plasticity01 as number),retention01:clamp01(row.retention01 as number),overconsolidationRisk01:clamp01(row.overconsolidationRisk01 as number),reinforcement01:clamp01(row.reinforcement01 as number)}];
  });
};

export interface CanonicalMemoryLifecycleInput {
  tick:number;
  at:number;
  traces:number;
  events:number;
  goals:number;
  memories:number;
  semanticItems:number;
  workingSet01:number;
  energy01:number;
  pressure01:number;
  experienceHotCount?:number;
  experienceWarmCount?:number;
  experienceColdCount?:number;
  identityTension01?:number;
}

export interface CanonicalMemoryLifecycleState {
  version:1;
  cycles:number;
  maintenanceRuns:number;
  consolidationRuns:number;
  lastTick:number;
  lastPlan?:ReturnType<P70MemoryLifecycleGovernor['plan']>;
  lastConsolidation:ConsolidationDecision[];
  meanPressure01:number;
  meanMemoryLoad01:number;
}

export const defaultCanonicalMemoryLifecycleState=():CanonicalMemoryLifecycleState=>({
  version:1,
  cycles:0,
  maintenanceRuns:0,
  consolidationRuns:0,
  lastTick:-1,
  lastConsolidation:[],
  meanPressure01:.18,
  meanMemoryLoad01:.18,
});

/**
 * R5: one production authority for memory lifecycle orchestration.
 * MemoryFabric owns canonical retrieval/storage; P70 supplies pressure-aware
 * retention budgets; MemoryConsolidationController supplies bounded routing.
 * Compatibility memories remain read-model projections and are never mutated here.
 */
export class CanonicalMemoryLifecycleAuthority {
  private state=defaultCanonicalMemoryLifecycleState();

  private readonly fabric:MemoryFabric;
  private readonly governor:P70MemoryLifecycleGovernor;
  private readonly consolidator:MemoryConsolidationController;

  constructor(
    fabric:MemoryFabric,
    governor:P70MemoryLifecycleGovernor,
    consolidator:MemoryConsolidationController,
  ){
    this.fabric=fabric;
    this.governor=governor;
    this.consolidator=consolidator;
  }

  restore(raw?:Partial<CanonicalMemoryLifecycleState>|null){
    const d=defaultCanonicalMemoryLifecycleState();
    if(raw?.version!==undefined&&raw.version!==1)throw new Error('Unsupported canonical memory lifecycle state version');
    const lastPlan=safePlan(raw?.lastPlan);
    this.state={
      version:1,
      cycles:safeCounter(raw?.cycles),
      maintenanceRuns:safeCounter(raw?.maintenanceRuns),
      consolidationRuns:safeCounter(raw?.consolidationRuns),
      lastTick:raw?.lastTick===-1?-1:(safeTick(raw?.lastTick)??-1),
      ...(lastPlan?{lastPlan}:{}),
      lastConsolidation:safeDecisions(raw?.lastConsolidation),
      meanPressure01:clamp01(typeof raw?.meanPressure01==='number'&&Number.isFinite(raw.meanPressure01)?raw.meanPressure01:d.meanPressure01),
      meanMemoryLoad01:clamp01(typeof raw?.meanMemoryLoad01==='number'&&Number.isFinite(raw.meanMemoryLoad01)?raw.meanMemoryLoad01:d.meanMemoryLoad01),
    };
  }

  snapshot(){return structuredClone(this.state);}

  private assertNextTick(value:unknown):number {
    const tick=safeTick(value);
    if(tick===null||tick<=this.state.lastTick)throw new Error('Canonical memory lifecycle tick must be a strictly increasing non-negative safe integer');
    return tick;
  }

  run(input:CanonicalMemoryLifecycleInput){
    const tick=this.assertNextTick(input.tick);
    const pressure=clamp01(input.pressure01);
    const memoryLoad=clamp01(input.workingSet01);
    const plan=this.governor.plan(input);
    const maintenance=this.fabric.maintain({
      tick,
      pressure01:pressure,
      maxItems:plan.budgets.memories,
      hotBudget:plan.budgets.memories>=520?64:48,
      warmBudget:plan.budgets.memories>=520?256:192,
      coldBudget:Math.max(256,Math.min(960,plan.budgets.memories)),
      identityTension01:input.identityTension01??0,
    });
    this.state.cycles++;
    this.state.lastTick=tick;
    this.state.lastPlan=plan;
    this.state.lastConsolidation=[];
    this.state.meanPressure01=clamp01(this.state.meanPressure01*.97+pressure*.03);
    this.state.meanMemoryLoad01=clamp01(this.state.meanMemoryLoad01*.97+memoryLoad*.03);
    this.state.maintenanceRuns+=maintenance.skipped?0:1;
    return {plan,maintenance,consolidation:[]};
  }

  consolidate(input:{candidates:ConsolidationCandidate[];batchSize?:number;pressure01?:number;awake01?:number}){
    const decisions=input.candidates.length
      ? this.consolidator.rank(input.candidates,{batchSize:input.batchSize??4,pressure01:clamp01(input.pressure01??0.5),awake01:clamp01(input.awake01??1)})
      : [];
    this.state.consolidationRuns+=input.candidates.length?1:0;
    this.state.lastConsolidation=decisions;
    return decisions;
  }

  maintainCanonical(input:{tick:number;pressure01?:number;maxItems?:number;hotBudget?:number;warmBudget?:number;coldBudget?:number;identityTension01?:number}){
    const tick=this.assertNextTick(input.tick);
    const result=this.fabric.maintain({...input,tick});
    this.state.maintenanceRuns+=result.skipped?0:1;
    this.state.lastTick=tick;
    this.state.meanPressure01=clamp01(this.state.meanPressure01*.97+clamp01(input.pressure01??0)*.03);
    return result;
  }

  lifecycleDiagnostics(){
    return {
      ...this.state,
      governor:this.governor.snapshot(),
      fabric:this.fabric.inspect(),
      consolidation:this.consolidator.diagnostics(),
    };
  }
}
