export type P2853SlowMemoryPhase='wake'|'quiet'|'sleepRecent'|'sleepPrior'|'transfer';

export interface P2853SlowMemoryConsolidationState {
  version:1;
  enabled:boolean;
  slots:number;
  prototypes:number[][];
  visits:number[];
  updates:number;
  retrievals:number;
  contextHits:number;
  transferBlends:number;
  agreement01:number;
  stability01:number;
  lastContextId:number;
  lastPhase:P2853SlowMemoryPhase;
}

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const cleanContext=(x:number)=>Math.max(0,Math.min(7,Math.floor(Number.isFinite(x)?x:0)));

export const defaultP2853SlowMemoryConsolidation=():P2853SlowMemoryConsolidationState=>({
  version:1,
  enabled:true,
  slots:8,
  prototypes:Array.from({length:8},()=>new Array(16).fill(0)),
  visits:new Array(8).fill(0),
  updates:0,retrievals:0,contextHits:0,transferBlends:0,
  agreement01:.5,stability01:.5,lastContextId:0,lastPhase:'wake',
});

export class P2853SlowMemoryConsolidationController {
  private state=defaultP2853SlowMemoryConsolidation();

  retrieve(contextId:number,cue:number[],budget01:number,phase:P2853SlowMemoryPhase){
    const slot=cleanContext(contextId),proto=this.state.prototypes[slot]!,cue16=cue.slice(0,16);
    if(!this.state.enabled)return {vector:new Array(16).fill(0),strength01:0,similarity01:.5,visits:0};
    let dot=0,a2=0,b2=0;
    for(let k=0;k<16;k++){const a=cue16[k]??0,b=proto[k]??0;dot+=a*b;a2+=a*a;b2+=b*b;}
    const similarity=a2&&b2?clamp((dot/Math.sqrt(a2*b2)+1)/2):.5;
    const visits=this.state.visits[slot]??0;
    const phaseGain=phase==='sleepPrior'?1:phase==='sleepRecent'?.84:phase==='transfer'?.72:phase==='quiet'?.48:.34;
    const matchGate=visits>0?clamp((similarity-.52)*2.6):0;
    const strength=clamp((.08+.28*Math.min(1,visits/8))*matchGate*phaseGain*(.55+.45*clamp(budget01)),0,.38);
    this.state.retrievals++;
    if(visits>0)this.state.contextHits++;
    if(phase==='transfer')this.state.transferBlends++;
    this.state.lastContextId=slot;
    this.state.lastPhase=phase;
    this.state.agreement01=clamp(this.state.agreement01*.96+similarity*.04);
    return {vector:proto.slice(),strength01:strength,similarity01:similarity,visits};
  }

  compatibility(contextId:number,cue:number[]){
    if(!this.state.enabled)return 0;
    const slot=cleanContext(contextId),proto=this.state.prototypes[slot]!,cue16=cue.slice(0,16);
    if((this.state.visits[slot]??0)<=0)return .5;
    let dot=0,a2=0,b2=0;
    for(let k=0;k<16;k++){const a=cue16[k]??0,b=proto[k]??0;dot+=a*b;a2+=a*a;b2+=b*b;}
    return a2&&b2?clamp((dot/Math.sqrt(a2*b2)+1)/2):.5;
  }

  observe(contextId:number,vector:number[],reward01:number,error01:number,verified01:number,novelty01:number,phase:P2853SlowMemoryPhase,budget01:number){
    const slot=cleanContext(contextId),target=this.state.prototypes[slot]!,v=vector.slice(0,16);
    if(!this.state.enabled)return {eta:0,agreement01:.5,slot};
    const stability=clamp(.55+.45*(1-clamp(error01)));
    const evidence=clamp(.45*clamp(verified01)+.20*(1-clamp(novelty01))+.20*stability+.15*clamp(reward01));
    const phaseScale=phase==='sleepPrior'?1.45:phase==='sleepRecent'?1.10:phase==='transfer'?.86:phase==='quiet'?.62:.44;
    const eta=clamp((.0045+.010*evidence)*phaseScale*(.55+.45*clamp(budget01)),.002,.028);
    let distance=0;
    for(let k=0;k<16;k++){
      const before=target[k]??0,source=clamp(Number(v[k]??0),-1,1);
      distance+=Math.abs(source-before);
      target[k]=clamp(before+(source-before)*eta,-1,1);
    }
    this.state.visits[slot]=Math.min(65535,(this.state.visits[slot]??0)+1);
    this.state.updates++;
    this.state.lastContextId=slot;
    this.state.lastPhase=phase;
    const agreement=clamp(1-distance/16);
    this.state.agreement01=clamp(this.state.agreement01*.94+agreement*.06);
    this.state.stability01=clamp(this.state.stability01*.985+(1-clamp(error01))*.015);
    return {eta,agreement01:agreement,slot};
  }

  snapshot(){return structuredClone(this.state);}

  restore(raw?:Partial<P2853SlowMemoryConsolidationState>|null){
    const d=defaultP2853SlowMemoryConsolidation(),r:any=raw??{};
    const matrix=(v:any)=>Array.isArray(v)?Array.from({length:8},(_,i)=>Array.isArray(v[i])?v[i].slice(0,16).concat(new Array(Math.max(0,16-v[i].length)).fill(0)).slice(0,16):new Array(16).fill(0)):d.prototypes.map(x=>x.slice());
    const visits=Array.isArray(r.visits)?r.visits.slice(0,8).concat(new Array(Math.max(0,8-r.visits.length)).fill(0)).slice(0,8):d.visits.slice();
    const phase=(['wake','quiet','sleepRecent','sleepPrior','transfer'] as const).includes(r.lastPhase)?r.lastPhase:d.lastPhase;
    this.state={...d,...structuredClone(r),version:1,enabled:r.enabled!==false,slots:8,prototypes:matrix(r.prototypes),visits:visits.map((x:number)=>Math.max(0,Math.floor(Number(x)||0))),updates:Math.max(0,Math.floor(Number(r.updates)||0)),retrievals:Math.max(0,Math.floor(Number(r.retrievals)||0)),contextHits:Math.max(0,Math.floor(Number(r.contextHits)||0)),transferBlends:Math.max(0,Math.floor(Number(r.transferBlends)||0)),agreement01:clamp(Number(r.agreement01??d.agreement01)),stability01:clamp(Number(r.stability01??d.stability01)),lastContextId:cleanContext(Number(r.lastContextId??0)),lastPhase:phase};
  }

  setEnabled(enabled:boolean){this.state.enabled=Boolean(enabled);}
  metrics(){return this.snapshot();}
}
