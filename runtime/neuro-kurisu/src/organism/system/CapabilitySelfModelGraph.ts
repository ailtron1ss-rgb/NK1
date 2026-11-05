/** BIG PASS 238 — calibrated capability graph: knows what it can/cannot do and seeks gaps. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface CapabilityNode{
 skill:string; competence01:number; confidence01:number; attempts:number; successes:number; gap01:number;
}
export interface CapabilitySelfModelState{
 version:1; cycles:number; nodes:Record<string,CapabilityNode>; lastGap:string; lastGap01:number; calibration01:number;
}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const sanNode=(x:unknown,key:string):CapabilityNode|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {skill:str(r.skill,key),competence01:clamp(finN(r.competence01,.5)),confidence01:clamp(finN(r.confidence01,.4)),attempts:cnt(r.attempts,0),successes:cnt(r.successes,0),gap01:clamp(finN(r.gap01,.5))};};
export const defaultCapabilitySelfModel=():CapabilitySelfModelState=>({
 version:1,cycles:0,nodes:{prediction:{skill:'prediction',competence01:.52,confidence01:.4,attempts:0,successes:0,gap01:.48}},lastGap:'prediction',lastGap01:.48,calibration01:.5
});
export class CapabilitySelfModelGraph{
 private state=defaultCapabilitySelfModel();
 restore(raw?:Partial<CapabilitySelfModelState>|null){
  const d=defaultCapabilitySelfModel();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
  const nRaw=(read('nodes')&&typeof read('nodes')==='object')?read('nodes') as Record<string,unknown>:{};const nodes:Record<string,CapabilityNode>={};for(const k of Object.keys(nRaw)){const n=sanNode(nRaw[k],k);if(n)nodes[k]=n;}
  this.state={version:1,cycles:cnt(read('cycles'),d.cycles),nodes,lastGap:str(read('lastGap'),d.lastGap),lastGap01:clamp(finN(read('lastGap01'),d.lastGap01)),calibration01:clamp(finN(read('calibration01'),d.calibration01))};
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
