export interface BoundedRecurrentState {
  version:1; dimension:number; updates:number; resets:number; spectralProxy01:number; state:number[]; lastInput:number[]; leak01:number; gain01:number; bounded01:number;
}
export interface RecurrentStep { state:number[]; energy01:number; saturation01:number; bounded01:number; }
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const norm=(v:number[])=>Math.sqrt(v.reduce((s,x)=>s+x*x,0));
const stableHash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export class BoundedRecurrentStateSubstrate {
  private readonly inputWeights:number[][]; private readonly recurrentWeights:number[][]; private state:BoundedRecurrentState;
  constructor(dimension=16,seed='r23'){
    const d=Math.max(4,Math.min(64,Math.floor(dimension)));
    const weight=(kind:string,i:number,j:number)=>(((stableHash(`${seed}:${kind}:${i}:${j}`)%2001)/1000)-1)*.035;
    this.inputWeights=Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>weight('i',i,j)));
    this.recurrentWeights=Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>weight('r',i,j)));
    this.state={version:1,dimension:d,updates:0,resets:0,spectralProxy01:.18,state:new Array(d).fill(0),lastInput:new Array(d).fill(0),leak01:.42,gain01:.86,bounded01:1};
  }
  restore(raw?:Partial<BoundedRecurrentState>|null){if(!raw)return;const d=this.state.dimension;this.state={...this.state,...raw,version:1,dimension:d,state:Array.from({length:d},(_,i)=>clamp(Number(raw.state?.[i]??0))),lastInput:Array.from({length:d},(_,i)=>clamp(Number(raw.lastInput?.[i]??0)))};}
  reset(){this.state.state.fill(0);this.state.lastInput.fill(0);this.state.resets++;}
  step(input:number[]):RecurrentStep{
    const x=Array.from({length:this.state.dimension},(_,i)=>clamp(Number(input[i]??0)));
    const prev=this.state.state.slice(); const next=new Array(this.state.dimension).fill(0); let saturation=0;
    for(let i=0;i<this.state.dimension;i++){
      let z=0; for(let j=0;j<this.state.dimension;j++)z+=(this.inputWeights[i]?.[j]??0)*(x[j]??0)+(this.recurrentWeights[i]?.[j]??0)*(prev[j]??0);
      const y=tanh(z*this.state.gain01); next[i]=clamp(prev[i]*(1-this.state.leak01)+y*this.state.leak01); if(Math.abs(next[i])>.94)saturation++;
    }
    const energy=clamp01(norm(next)/Math.sqrt(this.state.dimension));
    this.state.state=next; this.state.lastInput=x; this.state.updates++; this.state.bounded01=saturation/Math.max(1,this.state.dimension)<.25?1:clamp01(1-saturation/this.state.dimension); this.state.spectralProxy01=clamp01(this.state.spectralProxy01*.98+energy*.02);
    return {state:next.slice(),energy01:energy,saturation01:clamp01(saturation/this.state.dimension),bounded01:this.state.bounded01};
  }
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {updates:this.state.updates,resets:this.state.resets,dimension:this.state.dimension,spectralProxy01:this.state.spectralProxy01,bounded01:this.state.bounded01,energy01:clamp01(norm(this.state.state)/Math.sqrt(this.state.dimension))};}
}
export function defaultBoundedRecurrentStateSubstrate(){return new BoundedRecurrentStateSubstrate().snapshot();}
