/** BIG PASS 238 — calibrated capability graph: knows what it can/cannot do and seeks gaps. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface CapabilityNode{
 skill:string; competence01:number; confidence01:number; attempts:number; successes:number; gap01:number;
}
export interface CapabilitySelfModelState{
 version:1; cycles:number; nodes:Record<string,CapabilityNode>; lastGap:string; lastGap01:number; calibration01:number;
}
export const defaultCapabilitySelfModel=():CapabilitySelfModelState=>({
 version:1,cycles:0,nodes:{prediction:{skill:'prediction',competence01:.52,confidence01:.4,attempts:0,successes:0,gap01:.48}},lastGap:'prediction',lastGap01:.48,calibration01:.5
});
export class CapabilitySelfModelGraph{
 private state=defaultCapabilitySelfModel();
 restore(raw?:Partial<CapabilitySelfModelState>|null){
  const d=defaultCapabilitySelfModel(),r=raw??{};
  this.state={...d,...r,nodes:{...d.nodes,...(r.nodes??{})},version:1};
 }
 snapshot(){return structuredClone(this.state);}
 observe(input:{skill:string;success01:number;confidence01:number;difficulty01:number}){
  const k=input.skill||'general';
  const n=this.state.nodes[k]??{skill:k,competence01:.35,confidence01:.35,attempts:0,successes:0,gap01:.65};
  n.attempts++; n.successes+=clamp(input.success01)>.55?1:0;
  n.competence01=clamp(n.competence01*.86+clamp(input.success01)*.14);
  n.confidence01=clamp(n.confidence01*.82+clamp(input.confidence01)*.18);
  n.gap01=clamp((1-n.competence01)*.62+(1-n.confidence01)*.18+clamp(input.difficulty01)*.2);
  this.state.nodes[k]=n;
  const entries=Object.values(this.state.nodes).sort((a,b)=>b.gap01-a.gap01);
  this.state.lastGap=entries[0]?.skill??k; this.state.lastGap01=entries[0]?.gap01??0; this.state.cycles++;
  this.state.calibration01=clamp(this.state.calibration01*.94+(1-Math.abs(n.competence01-n.confidence01))*.06);
  return structuredClone(n);
 }
 summary(){return{cycles:this.state.cycles,skills:Object.keys(this.state.nodes).length,lastGap:this.state.lastGap,lastGap01:this.state.lastGap01,calibration01:this.state.calibration01,nodes:structuredClone(this.state.nodes)};}
}
