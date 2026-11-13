const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface NeuralPhaseTransitionState{version:1;cycles:number;regime01:number;instability01:number;stableTicks:number;transitions:number;freeze01:number;lastRegime:string;}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
export const defaultNeuralPhaseTransition=():NeuralPhaseTransitionState=>({version:1,cycles:0,regime01:.5,instability01:.2,stableTicks:0,transitions:0,freeze01:0,lastRegime:'balanced'});
export class NeuralPhaseTransitionDetector{
 private state=defaultNeuralPhaseTransition();
 restore(raw?:Partial<NeuralPhaseTransitionState>|null){const d=defaultNeuralPhaseTransition();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.state={version:1,cycles:cnt(read('cycles'),d.cycles),regime01:clamp(finN(read('regime01'),d.regime01)),instability01:clamp(finN(read('instability01'),d.instability01)),stableTicks:cnt(read('stableTicks'),d.stableTicks),transitions:cnt(read('transitions'),d.transitions),freeze01:clamp(finN(read('freeze01'),d.freeze01)),lastRegime:str(read('lastRegime'),d.lastRegime)};}
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
