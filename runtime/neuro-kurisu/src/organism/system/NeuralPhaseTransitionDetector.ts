const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface NeuralPhaseTransitionState{version:1;cycles:number;regime01:number;instability01:number;stableTicks:number;transitions:number;freeze01:number;lastRegime:string;}
export const defaultNeuralPhaseTransition=():NeuralPhaseTransitionState=>({version:1,cycles:0,regime01:.5,instability01:.2,stableTicks:0,transitions:0,freeze01:0,lastRegime:'balanced'});
export class NeuralPhaseTransitionDetector{
 private state=defaultNeuralPhaseTransition();
 restore(raw?:Partial<NeuralPhaseTransitionState>|null){const d=defaultNeuralPhaseTransition(),r=raw??{};this.state={...d,...r,version:1};}
 snapshot(){return structuredClone(this.state);}
 observe(input:{predictionError01:number;coherence01:number;plasticity01:number;stability01:number;energy01:number}){
  const s=this.state,e=clamp(input.predictionError01),c=clamp(input.coherence01),p=clamp(input.plasticity01),st=clamp(input.stability01),en=clamp(input.energy01);
  const instability=clamp(e*.42+(1-c)*.25+p*.16+(1-st)*.12+(1-en)*.05); const regime=clamp(c*.38+st*.34+(1-instability)*.28);
  const newRegime=instability>.72?'unstable':regime>.72?'stable':'balanced'; if(newRegime!==s.lastRegime)s.transitions++;
  if(newRegime==='stable')s.stableTicks++; else s.stableTicks=0;
  s.cycles++;s.instability01=instability;s.regime01=regime;s.freeze01=clamp((instability-.62)*2);s.lastRegime=newRegime;
  return {regime01:regime,instability01:instability,freeze01:s.freeze01,regime:newRegime,transitionCount:s.transitions};
 }
 summary(){return structuredClone(this.state);}
}
