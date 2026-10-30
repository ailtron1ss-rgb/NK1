import type { P70MemoryLifecycleGovernor } from '../developmental/P70MemoryLifecycleGovernor.ts';
import type { MemoryFabric } from './MemoryFabric.ts';
import type { MemoryConsolidationController, ConsolidationCandidate, ConsolidationDecision } from './MemoryConsolidationController.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const safeCounter=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const safeTick=(value:unknown):number|null=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const safeLabel=(value:unknown,max=128):string|undefined=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():undefined;

/** Copy only own enumerable data fields from untrusted persisted records. */
const ownRecord=(value:unknown):Record<string,unknown> => {
  if(value===null||typeof value!=='object'||Array.isArray(value))return Object.create(null) as Record<string,unknown>;
  const result=Object.create(null) as Record<string,unknown>;
  let keys:string[];
  try{keys=Object.keys(value);}catch{return result;}
  for(const key of keys.slice(0,64)){
    try{
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))continue;
      Object.defineProperty(result,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
    }catch{/* ignore invalid persisted fields */}
  }
  return result;
};
const ownArrayValues=(value:unknown,max:number):{values:unknown[];valid:boolean}=>{
  if(!Array.isArray(value))return {values:[],valid:false};
  try{
    const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
    if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||typeof lengthDescriptor.value!=='number'||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0)return {values:[],valid:false};
    const length=lengthDescriptor.value;
    const values:unknown[]=[];
    let valid=length<=max;
    for(let i=0;i<Math.min(length,max);i++){
      const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
      if(!descriptor||!Object.hasOwn(descriptor,'value')){valid=false;continue;}
      values.push(descriptor.value);
    }
    return {values,valid};
  }catch{return {values:[],valid:false};}
};

const safePlan=(raw:unknown):CanonicalMemoryLifecycleState['lastPlan']=>{
  const row=ownRecord(raw);
  const b=ownRecord(row.budgets);
  const keys=['traces','events','goals','memories','semanticItems'] as const;
  if(keys.some(key=>!Object.hasOwn(b,key)||safeCounter(b[key],-1)<0))return undefined;
  const action=row.action;
  if(action!=='idle'&&action!=='trim'&&action!=='compact')return undefined;
  return {budgets:{traces:safeCounter(b.traces),events:safeCounter(b.events),goals:safeCounter(b.goals),memories:safeCounter(b.memories),semanticItems:safeCounter(b.semanticItems)},action,pressure01:clamp01(typeof row.pressure01==='number'?row.pressure01:0),hotLoad01:clamp01(typeof row.hotLoad01==='number'?row.hotLoad01:0)};
};
const safeDecisions=(raw:unknown):ConsolidationDecision[]=>{
  const array=ownArrayValues(raw,32);
  if(!array.valid)return [];
  const routes=new Set(['hippocampal','cortical','procedural','defer']);
  return array.values.flatMap(value=>{
    const row=ownRecord(value),id=safeLabel(row.id,128),reason=safeLabel(row.reason,240);
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
    const source=ownRecord(raw);
    if(source.version!==undefined&&source.version!==1)throw new Error('Unsupported canonical memory lifecycle state version');
    const lastPlan=safePlan(source.lastPlan);
    this.state={
      version:1,
      cycles:safeCounter(source.cycles),
      maintenanceRuns:safeCounter(source.maintenanceRuns),
      consolidationRuns:safeCounter(source.consolidationRuns),
      lastTick:source.lastTick===-1?-1:(safeTick(source.lastTick)??-1),
      ...(lastPlan?{lastPlan}:{}),
      lastConsolidation:safeDecisions(source.lastConsolidation),
      meanPressure01:clamp01(typeof source.meanPressure01==='number'&&Number.isFinite(source.meanPressure01)?source.meanPressure01:d.meanPressure01),
      meanMemoryLoad01:clamp01(typeof source.meanMemoryLoad01==='number'&&Number.isFinite(source.meanMemoryLoad01)?source.meanMemoryLoad01:d.meanMemoryLoad01),
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
    if(this.state.cycles>=Number.MAX_SAFE_INTEGER){
      throw new RangeError('Canonical memory lifecycle counter reached its safe integer limit');
    }
    const pressure=clamp01(input.pressure01);
    const memoryLoad=clamp01(input.workingSet01);
    // Governor.plan() records its own counters. Roll it back if the canonical
    // fabric maintenance fails, so retrying the same tick cannot double-count.
    const governorBefore=this.governor.snapshot();
    try{
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
      this.state.maintenanceRuns=maintenance.skipped?this.state.maintenanceRuns:Math.min(Number.MAX_SAFE_INTEGER,this.state.maintenanceRuns+1);
      return {plan,maintenance,consolidation:[]};
    }catch(error){
      this.governor.restore(governorBefore);
      throw error;
    }
  }

  consolidate(input:{candidates:ConsolidationCandidate[];batchSize?:number;pressure01?:number;awake01?:number}){
    const decisions=input.candidates.length
      ? this.consolidator.rank(input.candidates,{batchSize:input.batchSize??4,pressure01:clamp01(input.pressure01??0.5),awake01:clamp01(input.awake01??1)})
      : [];
    if(input.candidates.length)this.state.consolidationRuns=Math.min(Number.MAX_SAFE_INTEGER,this.state.consolidationRuns+1);
    this.state.lastConsolidation=decisions;
    return decisions;
  }

  maintainCanonical(input:{tick:number;pressure01?:number;maxItems?:number;hotBudget?:number;warmBudget?:number;coldBudget?:number;identityTension01?:number}){
    const tick=safeTick(input.tick);
    if(tick===null||tick<this.state.lastTick)throw new Error('Canonical memory lifecycle tick must not decrease and must be a non-negative safe integer');
    // run() already performs canonical maintenance for this tick. A second
    // consolidation-path request is an idempotent no-op, including after restore.
    if(tick===this.state.lastTick)return {skipped:true,changed:0};
    const result=this.fabric.maintain({...input,tick});
    this.state.maintenanceRuns=result.skipped?this.state.maintenanceRuns:Math.min(Number.MAX_SAFE_INTEGER,this.state.maintenanceRuns+1);
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
