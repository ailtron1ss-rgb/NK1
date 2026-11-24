/** BIG PASS 241 — integration spine for the new neuro-digital substrate. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface HybridNeuroCognitiveState{
 version:1; cycles:number; fusion01:number; neuroSymbolic01:number; causalConfidence01:number;
 developmentalReadiness01:number; integration01:number; lastDomain:string;
}
export const defaultHybridNeuroCognitive=():HybridNeuroCognitiveState=>({version:1,cycles:0,fusion01:.45,neuroSymbolic01:.4,causalConfidence01:.45,developmentalReadiness01:.4,integration01:.45,lastDomain:'none'});
export class HybridNeuroCognitiveLoop{
 private state=defaultHybridNeuroCognitive();
 restore(raw?:Partial<HybridNeuroCognitiveState>|null){
  const d=defaultHybridNeuroCognitive(),r=raw??{}; this.state={...d,...r,version:1};
 }
 snapshot(){return structuredClone(this.state);}
 integrate(input:{domain:string;coherence01:number;concept01:number;causal01:number;structuralFitness01:number;plasticity01:number;stability01:number;capabilityGap01:number}){
  const c=clamp(input.coherence01),s=clamp(input.concept01),ca=clamp(input.causal01),sf=clamp(input.structuralFitness01);
  const p=clamp(input.plasticity01),st=clamp(input.stability01),g=clamp(input.capabilityGap01);
  this.state.cycles++; this.state.lastDomain=input.domain;
  this.state.fusion01=clamp(this.state.fusion01*.82+(c*.42+sf*.18+st*.2)*.18);
  this.state.neuroSymbolic01=clamp(this.state.neuroSymbolic01*.82+s*.18);
  this.state.causalConfidence01=clamp(this.state.causalConfidence01*.85+ca*.15);
  this.state.developmentalReadiness01=clamp(this.state.developmentalReadiness01*.84+(p*.35+st*.25+(1-g)*.4)*.16);
  this.state.integration01=clamp(this.state.integration01*.8+(this.state.fusion01*.35+this.state.neuroSymbolic01*.2+this.state.causalConfidence01*.25+this.state.developmentalReadiness01*.2)*.2);
  return structuredClone(this.state);
 }
 summary(){return structuredClone(this.state);}
}
