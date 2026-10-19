const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface DualTimescaleMemoryState{version:1;cycles:number;fast01:number;slow01:number;transfer01:number;stability01:number;interference01:number;consolidations:number;}
export const defaultDualTimescaleMemory=():DualTimescaleMemoryState=>({version:1,cycles:0,fast01:.4,slow01:.4,transfer01:0,stability01:.6,interference01:.2,consolidations:0});
export class DualTimescaleMemoryBridge{
 private state=defaultDualTimescaleMemory();
 restore(raw?:Partial<DualTimescaleMemoryState>|null){const d=defaultDualTimescaleMemory(),r=raw??{};this.state={...d,...r,version:1};}
 snapshot(){return structuredClone(this.state);}
 update(input:{novelty01:number;predictionError01:number;repeat01:number;reliability01:number;energy01:number}){
  const s=this.state,n=clamp(input.novelty01),e=clamp(input.predictionError01),r=clamp(input.repeat01),q=clamp(input.reliability01),energy=clamp(input.energy01);
  s.fast01=clamp(s.fast01*.68+(n*.38+e*.32+r*.18+q*.12)*.32);
  const transfer=clamp(r*.35+q*.35+(1-e)*.2+n*.1)*energy;
  s.slow01=clamp(s.slow01*.92+transfer*.08);
  s.transfer01=transfer;s.interference01=clamp(e*.48+(1-q)*.32+n*.2);s.stability01=clamp(s.stability01*.9+s.slow01*.1);
  if(transfer>.58){s.consolidations++;}
  s.cycles++; return {fast01:s.fast01,slow01:s.slow01,transfer01:transfer,stability01:s.stability01,interference01:s.interference01,consolidated:transfer>.58};
 }
 summary(){return structuredClone(this.state);}
}
