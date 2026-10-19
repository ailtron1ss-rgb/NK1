export interface SubsystemProbeRecord { name:string; ok:boolean; latencyMs:number; at:number; error?:string; }
export interface SubsystemFlightRecord { calls:number; failures:number; meanLatencyMs:number; lastAt:number; recent:SubsystemProbeRecord[]; }

/** Bounded runtime diagnostics kept outside subject state and persistence. */
export class SubsystemFlightRecorder {
  private readonly rows = new Map<string, SubsystemFlightRecord>();
  private readonly maxRecent:number;
  constructor(maxRecent=16) { this.maxRecent=Math.max(4,Math.floor(maxRecent)); }
  record(name:string, input:{ok:boolean;latencyMs:number;error?:string;at?:number}) {
    const prev=this.rows.get(name) ?? {calls:0,failures:0,meanLatencyMs:0,lastAt:0,recent:[]};
    const calls=prev.calls+1;
    const row:{calls:number;failures:number;meanLatencyMs:number;lastAt:number;recent:SubsystemProbeRecord[]}={
      calls,
      failures:prev.failures+(input.ok?0:1),
      meanLatencyMs:prev.meanLatencyMs+(input.latencyMs-prev.meanLatencyMs)/calls,
      lastAt:input.at??Date.now(),
      recent:[{name,ok:input.ok,latencyMs:Math.max(0,input.latencyMs),at:input.at??Date.now(),error:input.error?.slice(0,160)},...prev.recent].slice(0,this.maxRecent),
    };
    this.rows.set(name,row);
  }
  snapshot(){return Object.fromEntries([...this.rows].map(([name,row])=>[name,{...row,recent:row.recent.map(x=>({...x}))}])) as Record<string,SubsystemFlightRecord>;}
  summary(){
    const rows=[...this.rows.entries()];
    const calls=rows.reduce((n,[,r])=>n+r.calls,0),failures=rows.reduce((n,[,r])=>n+r.failures,0);
    return {subsystems:rows.length,calls,failures,failureRate01:failures/Math.max(1,calls),meanLatencyMs:rows.length?rows.reduce((s,[,r])=>s+r.meanLatencyMs,0)/rows.length:0};
  }
}
