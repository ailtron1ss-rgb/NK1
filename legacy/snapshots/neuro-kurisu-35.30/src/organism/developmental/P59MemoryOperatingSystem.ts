/**
 * P59 — Memory Operating System.
 *
 * Coordinates the already existing MemoryOS2 / UnifiedMemory / event history
 * without creating a fourth competing memory store. It decides what should be
 * encoded, reconsolidated, promoted or left dormant and exposes memory health.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P59Input {tick:number;at:number;eventCount:number;memoryCount:number;retrievalHits:number;predictionError01:number;identity01:number;goalPressure01:number;novelty01:number;uncertainty01:number;dayAge01?:number;}
export type P59Mode='maintenance'|'encode'|'reconsolidate'|'compress'|'protect';
export interface P59Plan {mode:P59Mode;priority01:number;retentionBias01:number;reasons:string[];}
export interface P59State {version:1;cycles:number;encodes:number;reconsolidations:number;compressions:number;protectedCycles:number;meanHealth01:number;meanRetention01:number;lastPlan:P59Plan|null;history:Array<{tick:number;at:number;mode:P59Mode;health01:number;retention01:number}>;}
export const defaultP59=():P59State=>({version:1,cycles:0,encodes:0,reconsolidations:0,compressions:0,protectedCycles:0,meanHealth01:.72,meanRetention01:.62,lastPlan:null,history:[]});
export class P59MemoryOperatingSystem{
 private state=defaultP59();
 restore(raw?:Partial<P59State>|null){const d=defaultP59(),r=raw??{};this.state={...d,...r,history:Array.isArray(r.history)?r.history.slice(-96):[]};}
 snapshot(){return structuredClone(this.state);}
 plan(input:P59Input):P59Plan{
  const saturation=clamp(input.memoryCount/1600),retrieval=clamp(input.retrievalHits/8),pe=clamp(input.predictionError01),id=clamp(input.identity01),gp=clamp(input.goalPressure01),n=clamp(input.novelty01),u=clamp(input.uncertainty01),age=clamp(input.dayAge01??0);
  const health=clamp(.34*(1-saturation)+.18*retrieval+.18*id+.12*(1-pe)+.10*(1-u)+.08*(1-age));
  const retain=clamp(.35*id+.22*gp+.18*retrieval+.12*pe+.08*n+.05*(1-saturation));
  const pressure={
   protect: (1-id)*.55 + age*.25 + pe*.20,
   compress: saturation*.58 + Math.max(0,n-.55)*.08 + Math.max(0,age-.7)*.34,
   reconsolidate: pe*.34 + id*.20 + retrieval*.20 + gp*.14 + u*.12,
   encode: n*.34 + gp*.20 + u*.18 + pe*.16 + (1-retrieval)*.12,
   maintenance: (1-saturation)*.25 + (1-pe)*.22 + (1-u)*.18 + retrieval*.35,
  } as Record<P59Mode,number>;
  const mode=(Object.entries(pressure).sort((a,b)=>b[1]-a[1])[0]?.[0]??'maintenance') as P59Mode;
  const reasons:string[]=[]; if(saturation>.75)reasons.push('memory-saturation'); if(pe>.45)reasons.push('prediction-error'); if(retrieval>.55)reasons.push('retrieval-use'); if(id<.8)reasons.push('identity-protection'); if(n>.6)reasons.push('novel-input'); if(!reasons.length)reasons.push('routine-maintenance');
  const plan={mode,priority01:clamp(pressure[mode]),retentionBias01:retain,reasons};
  this.state.cycles++; if(mode==='encode')this.state.encodes++; if(mode==='reconsolidate')this.state.reconsolidations++; if(mode==='compress')this.state.compressions++; if(mode==='protect')this.state.protectedCycles++;
  this.state.meanHealth01=clamp(this.state.meanHealth01*.95+health*.05);this.state.meanRetention01=clamp(this.state.meanRetention01*.95+retain*.05);this.state.lastPlan=plan;this.state.history=[{tick:input.tick,at:input.at,mode,health01:health,retention01:retain},...this.state.history].slice(0,96);
  return structuredClone(plan);
 }
 summary(){return {cycles:this.state.cycles,encodes:this.state.encodes,reconsolidations:this.state.reconsolidations,compressions:this.state.compressions,protectedCycles:this.state.protectedCycles,meanHealth01:this.state.meanHealth01,meanRetention01:this.state.meanRetention01,lastPlan:this.state.lastPlan};}
}
