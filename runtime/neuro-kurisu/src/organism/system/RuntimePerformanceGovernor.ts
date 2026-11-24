/**
 * PASS 05 — runtime performance feedback loop.
 *
 * Measures the real cost of completed cognitive cycles and converts it into a
 * bounded pressure signal for the resource economy / phone scheduler.
 * This module does not change cognitive semantics; it only constrains work
 * envelopes when the host is actually struggling.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface RuntimePerformanceGovernorState {
  version:1;
  samples:number;
  totalWallMs:number;
  emaWallMs:number;
  p95WallMs:number;
  maxWallMs:number;
  emaCpuMs:number;
  maxHeapUsedBytes:number;
  maxRssBytes:number;
  performancePressure01:number;
  memoryPressure01:number;
  cpuPressure01:number;
  slowCycleCount:number;
  memoryPressureCount:number;
  targetCycleMs:number;
  lastWallMs:number;
  lastCpuMs:number;
  lastHeapUsedBytes:number;
  lastRssBytes:number;
  lastReason:string;
}

export interface RuntimePerformanceDecision {
  performancePressure01:number;
  memoryPressure01:number;
  cpuPressure01:number;
  effectiveLastStepMs:number;
  maintenanceMultiplier01:number;
  schedulerMultiplier01:number;
  reasonCodes:string[];
}

const defaults=(targetCycleMs=1200):RuntimePerformanceGovernorState=>({
  version:1,samples:0,totalWallMs:0,emaWallMs:0,p95WallMs:0,maxWallMs:0,emaCpuMs:0,
  maxHeapUsedBytes:0,maxRssBytes:0,performancePressure01:0,memoryPressure01:0,cpuPressure01:0,
  slowCycleCount:0,memoryPressureCount:0,targetCycleMs:Math.max(250,targetCycleMs),lastWallMs:0,lastCpuMs:0,
  lastHeapUsedBytes:0,lastRssBytes:0,lastReason:'startup'
});

export function defaultRuntimePerformanceGovernor(targetCycleMs=1200){ return defaults(targetCycleMs); }

export class RuntimePerformanceGovernor {
  private state=defaults();
  private recentWallMs:number[]=[];

  constructor(targetCycleMs=1200){ this.state=defaults(targetCycleMs); }

  restore(raw?:Partial<RuntimePerformanceGovernorState>|null):void{
    const d=defaults(Number(raw?.targetCycleMs??this.state.targetCycleMs));
    this.state={...d,...structuredClone(raw??{}),version:1,targetCycleMs:Math.max(250,Number(raw?.targetCycleMs??d.targetCycleMs))};
    this.recentWallMs=[];
    this.state.p95WallMs=Math.max(0,Number(this.state.p95WallMs||0));
    this.state.performancePressure01=clamp(Number(this.state.performancePressure01??0));
    this.state.memoryPressure01=clamp(Number(this.state.memoryPressure01??0));
    this.state.cpuPressure01=clamp(Number(this.state.cpuPressure01??0));
  }

  snapshot():RuntimePerformanceGovernorState{ return structuredClone(this.state); }

  record(input:{wallMs:number;cpuMs?:number;heapUsedBytes?:number;rssBytes?:number;thermal01?:number;ramPressure01?:number}):RuntimePerformanceDecision{
    const wall=Math.max(0,Number(input.wallMs)||0);
    const cpu=Math.max(0,Number(input.cpuMs??0)||0);
    const heap=Math.max(0,Number(input.heapUsedBytes??0)||0);
    const rss=Math.max(0,Number(input.rssBytes??0)||0);
    const thermal=clamp(Number(input.thermal01??0));
    const ram=clamp(Number(input.ramPressure01??0));

    this.state.samples+=1;
    this.state.totalWallMs+=wall;
    this.state.emaWallMs=this.state.samples===1?wall:this.state.emaWallMs*.82+wall*.18;
    this.state.emaCpuMs=this.state.samples===1?cpu:this.state.emaCpuMs*.82+cpu*.18;
    this.state.maxWallMs=Math.max(this.state.maxWallMs,wall);
    this.state.maxHeapUsedBytes=Math.max(this.state.maxHeapUsedBytes,heap);
    this.state.maxRssBytes=Math.max(this.state.maxRssBytes,rss);
    this.state.lastWallMs=wall;
    this.state.lastCpuMs=cpu;
    this.state.lastHeapUsedBytes=heap;
    this.state.lastRssBytes=rss;

    this.recentWallMs=[...this.recentWallMs,wall].slice(-64);
    const sorted=[...this.recentWallMs].sort((a,b)=>a-b);
    const p95Index=Math.max(0,Math.ceil(sorted.length*.95)-1);
    this.state.p95WallMs=sorted[p95Index]??wall;

    const target=Math.max(250,this.state.targetCycleMs);
    const latencyPressure=clamp((this.state.p95WallMs/target-.70)/1.30);
    const cpuPressure=clamp((this.state.emaCpuMs/target-.35)/.95);
    const hostRamPressure=clamp(ram);
    const pressure=clamp(Math.max(latencyPressure*.62,cpuPressure*.18,hostRamPressure*.12,thermal*.08));
    const heapPressure=heap>0?clamp((heap-64*1024*1024)/(256*1024*1024-64*1024*1024)):0;
    const memoryPressure=clamp(Math.max(hostRamPressure,heapPressure));

    const wasSlow=wall>target*1.35;
    if(wasSlow)this.state.slowCycleCount+=1;
    if(hostRamPressure>.78 || memoryPressure>.78)this.state.memoryPressureCount+=1;
    this.state.performancePressure01=pressure;
    this.state.memoryPressure01=memoryPressure;
    this.state.cpuPressure01=cpuPressure;

    const reasons:string[]=[];
    if(latencyPressure>.35)reasons.push('slow-cycle');
    if(cpuPressure>.35)reasons.push('cpu-cost');
    if(memoryPressure>.55)reasons.push('memory-pressure');
    if(thermal>.72)reasons.push('thermal-pressure');
    if(!reasons.length)reasons.push('nominal');
    this.state.lastReason=reasons.join(',');

    return this.decision();
  }

  decision():RuntimePerformanceDecision{
    const p=clamp(this.state.performancePressure01);
    const maintenanceMultiplier=1+clamp(p*.90);
    const schedulerMultiplier=1+clamp(p*1.25);
    return {
      performancePressure01:p,
      memoryPressure01:clamp(this.state.memoryPressure01),
      cpuPressure01:clamp(this.state.cpuPressure01),
      effectiveLastStepMs:Math.max(this.state.lastWallMs,this.state.p95WallMs),
      maintenanceMultiplier01:maintenanceMultiplier,
      schedulerMultiplier01:schedulerMultiplier,
      reasonCodes:this.state.lastReason.split(',').filter(Boolean),
    };
  }
}
