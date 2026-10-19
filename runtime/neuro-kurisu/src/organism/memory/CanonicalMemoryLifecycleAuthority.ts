import type { P70MemoryLifecycleGovernor } from '../developmental/P70MemoryLifecycleGovernor.ts';
import type { MemoryFabric } from './MemoryFabric.ts';
import type { MemoryConsolidationController, ConsolidationCandidate, ConsolidationDecision } from './MemoryConsolidationController.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

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
    this.state={
      ...d,
      ...(raw??{}),
      lastConsolidation:Array.isArray(raw?.lastConsolidation)?raw!.lastConsolidation.slice(0,32):[],
      lastPlan:raw?.lastPlan,
    };
  }

  snapshot(){return structuredClone(this.state);}

  run(input:CanonicalMemoryLifecycleInput){
    const pressure=clamp01(input.pressure01);
    const memoryLoad=clamp01(input.workingSet01);
    const plan=this.governor.plan(input);
    const maintenance=this.fabric.maintain({
      tick:input.tick,
      pressure01:pressure,
      maxItems:plan.budgets.memories,
      hotBudget:plan.budgets.memories>=520?64:48,
      warmBudget:plan.budgets.memories>=520?256:192,
      coldBudget:Math.max(256,Math.min(960,plan.budgets.memories)),
      identityTension01:input.identityTension01??0,
    });
    this.state.cycles++;
    this.state.lastTick=input.tick;
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
    const result=this.fabric.maintain(input);
    this.state.maintenanceRuns+=result.skipped?0:1;
    this.state.lastTick=input.tick;
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
