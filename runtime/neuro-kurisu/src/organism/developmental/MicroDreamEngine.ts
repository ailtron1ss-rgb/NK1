export interface MicroDream{ id:string;at:number;question:string;simulation:string;confidence:number;}
export interface MicroDreamState{dreams:MicroDream[];cycles:number;version:number;}
export const defaultMicroDream=():MicroDreamState=>({dreams:[],cycles:0,version:1});
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const stableScore=(text:string)=>{let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/0xffffffff;};
export interface MicroDreamEvidence { predictionConfidence01?:number; uncertainty01?:number; memoryEvidence01?:number; novelty01?:number; }
export class MicroDreamEngine{private state=defaultMicroDream();restore(s:MicroDreamState|undefined){this.state={...defaultMicroDream(),...(s??{}),dreams:Array.isArray(s?.dreams)?s!.dreams.slice(0,64):[]};}
simulate(questions:string[],seed:string,evidence:MicroDreamEvidence={}){const q=questions.find(Boolean);if(!q)return null;
  const predictionConfidence=clamp01(evidence.predictionConfidence01??.25), uncertainty=clamp01(evidence.uncertainty01??.5), memoryEvidence=clamp01(evidence.memoryEvidence01??.2), novelty=clamp01(evidence.novelty01??.3);
  const noveltyScore=stableScore(`${seed}|${q}`);
  const confidence=clamp01(.12 + predictionConfidence*.42 + (1-uncertainty)*.24 + memoryEvidence*.14 + novelty*.06 + noveltyScore*.02);
  const dream={id:`dream-${Date.now()}-${Math.floor(noveltyScore*1e6)}`,at:Date.now(),question:q,simulation:`counterfactual:${seed}:${q.slice(0,80)}`,confidence};
  this.state.dreams=[dream,...this.state.dreams].slice(0,64);this.state.cycles++;return dream;}
snapshot(){return structuredClone(this.state);}}
