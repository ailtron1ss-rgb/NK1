const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface NeuralEcologyState{version:1;cycles:number;fast01:number;slow01:number;symbolic01:number;episodic01:number;gated01:number;resource01:number;lastChannel:string;}
export const defaultNeuralEcology=():NeuralEcologyState=>({version:1,cycles:0,fast01:.25,slow01:.25,symbolic01:.25,episodic01:.25,gated01:0,resource01:.8,lastChannel:'fast'});
export class NeuralEcologyRouter{
 private state=defaultNeuralEcology();
 restore(raw?:Partial<NeuralEcologyState>|null){const d=defaultNeuralEcology(),r=raw??{};this.state={...d,...r,version:1};}
 snapshot(){return structuredClone(this.state);}
 route(input:{surprise01:number;novelty01:number;goalPressure01:number;memorySalience01:number;energy01:number;causalUncertainty01:number}){
  const s=this.state, surprise=clamp(input.surprise01), novelty=clamp(input.novelty01), goal=clamp(input.goalPressure01), mem=clamp(input.memorySalience01), energy=clamp(input.energy01), causal=clamp(input.causalUncertainty01);
  const scores={fast:surprise*.5+novelty*.35+energy*.15,slow:goal*.45+causal*.35+mem*.2,symbolic:causal*.55+goal*.3+novelty*.15,episodic:mem*.55+surprise*.25+novelty*.2};
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]); const max=Math.max(...Object.values(scores)); const gated=clamp(max*.72+energy*.18+(1-causal)*.1);
  for(const [k,v] of ranked){const p=v/(Object.values(scores).reduce((a,b)=>a+b,0)||1);(s as any)[`${k}01`]=clamp((s as any)[`${k}01`]*.82+p*.18);}
  s.cycles++;s.gated01=gated;s.resource01=clamp(energy*.72+(1-surprise)*.18+(1-causal)*.1);s.lastChannel=ranked[0][0];
  return {channel:ranked[0][0],scores,gated01:gated,resource01:s.resource01};
 }
 summary(){return structuredClone(this.state);}
}
