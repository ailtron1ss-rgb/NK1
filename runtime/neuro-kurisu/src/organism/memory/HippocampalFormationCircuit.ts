import { cosineSimilarity as cosine } from '../core/NumericPrimitives.ts';
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
function norm(v:number[]){const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;return v.map(x=>x/n);}
function sparse(v:number[],keep=12){const idx=v.map((x,i)=>[Math.abs(x),i] as const).sort((a,b)=>b[0]-a[0]).slice(0,Math.max(1,Math.min(v.length,keep)));const out=new Array(v.length).fill(0);for(const [,i] of idx)out[i]=v[i]??0;return norm(out);}

export interface HippocampalFormationTrace { memoryId:string; dg:number[]; ca3:number[]; ca1:number[]; subiculum:number[]; tick:number; replayCount:number; uncertainty01:number; }
export interface HippocampalFormationState {
  version:1; encodingCount:number; recalls:number; replayRuns:number; separated01:number; completed01:number; predictionError01:number;
  regions:{dg:boolean;ca3:boolean;ca1:boolean;subiculum:boolean};
  traces:HippocampalFormationTrace[]; lastRecall:{memoryId:string|null;separation01:number;completion01:number;predictionError01:number;uncertainty01:number};
}
const defaults=():HippocampalFormationState=>({version:1,encodingCount:0,recalls:0,replayRuns:0,separated01:0,completed01:0,predictionError01:0,regions:{dg:true,ca3:true,ca1:true,subiculum:true},traces:[],lastRecall:{memoryId:null,separation01:0,completion01:0,predictionError01:0,uncertainty01:1}});

/** Functional hippocampal circuit abstraction: DG separation -> CA3 associative completion -> CA1 prediction/comparison -> subiculum output. */
export class HippocampalFormationCircuit {
  readonly systemName='memory:hippocampal-formation-circuit' as const;
  private state=defaults();
  private readonly maxTraces:number;
  constructor(maxTraces=192){this.maxTraces=maxTraces;}
  restore(raw?:Partial<HippocampalFormationState>|null){const d=defaults(),r=raw??{};this.state={...d,...r,regions:{...d.regions,...(r.regions??{})},traces:Array.isArray(r.traces)?r.traces.slice(-this.maxTraces).map((x:any)=>({...x,dg:Array.isArray(x?.dg)?x.dg.slice(0,64):[],ca3:Array.isArray(x?.ca3)?x.ca3.slice(0,64):[],ca1:Array.isArray(x?.ca1)?x.ca1.slice(0,64):[],subiculum:Array.isArray(x?.subiculum)?x.subiculum.slice(0,64):[]})):[],lastRecall:{...d.lastRecall,...(r.lastRecall??{})}};}
  snapshot(){return structuredClone(this.state);}
  setRegionEnabled(region:'dg'|'ca3'|'ca1'|'subiculum',enabled:boolean){this.state.regions[region]=Boolean(enabled);}
  encode(memoryId:string,vector:number[],tick=0,uncertainty01=0){
    const base=norm(vector.slice(0,64));
    const dg=this.state.regions.dg?sparse(base,Math.max(6,Math.round(base.length*.18))):base.slice();
    const prior=this.state.traces.map(t=>({t,sim:cosine(dg,t.dg)})).sort((a,b)=>b.sim-a.sim)[0];
    const ca3=this.state.regions.ca3 ? norm(dg.map((x,i)=>x*.7+(prior?.t.ca3[i]??0)*.3)) : dg.slice();
    const ca1=this.state.regions.ca1 ? norm(ca3.map((x,i)=>x*.65+base[i]*.35)) : ca3.slice();
    const sub=this.state.regions.subiculum?norm(ca1.map((x,i)=>x*.8+base[i]*.2)):ca1.slice();
    const err=clamp01(1-clamp01((cosine(base,ca1)+1)/2));
    const uncertainty=clamp01(uncertainty01*.7+err*.3);
    const existing=this.state.traces.find(t=>t.memoryId===memoryId);
    if(existing){existing.dg=dg;existing.ca3=ca3;existing.ca1=ca1;existing.subiculum=sub;existing.tick=tick;existing.uncertainty01=uncertainty;}
    else {this.state.traces.unshift({memoryId,dg,ca3,ca1,subiculum:sub,tick,replayCount:0,uncertainty01:uncertainty});if(this.state.traces.length>this.maxTraces)this.state.traces.length=this.maxTraces;}
    this.state.encodingCount++;
    return {separation01:clamp01(1-(prior?.sim??0)),predictionError01:err,uncertainty01:uncertainty};
  }
  recall(vector:number[],tick=0){
    const base=norm(vector.slice(0,64));
    const cue=this.state.regions.dg?sparse(base,Math.max(6,Math.round(base.length*.18))):base;
    const ranked=this.state.traces.map(t=>({t,sim:cosine(cue,t.dg)})).sort((a,b)=>b.sim-a.sim);
    const best=ranked[0];
    const rawSeparation=clamp01(1-(ranked[1]?.sim??0));
    const separation=this.state.regions.dg?clamp01(.5+.5*rawSeparation):clamp01(.2*rawSeparation);
    const completionBase=best?clamp01((cosine(base,best.t.ca3)+1)/2):0;
    const completion=this.state.regions.ca3?completionBase:clamp01(completionBase*.55);
    const predictionError=this.state.regions.ca1&&best?clamp01(1-((cosine(base,best.t.ca1)+1)/2)):clamp01(1-completion);
    const uncertainty=clamp01(.45*(1-(best?.sim??0))+.35*predictionError+.20*(ranked.length<2?1:0));
    this.state.recalls++;this.state.lastRecall={memoryId:best?.t.memoryId??null,separation01:separation,completion01:completion,predictionError01:predictionError,uncertainty01:uncertainty};
    this.state.separated01=clamp01(this.state.separated01*.9+separation*.1);this.state.completed01=clamp01(this.state.completed01*.9+completion*.1);this.state.predictionError01=clamp01(this.state.predictionError01*.9+predictionError*.1);
    return {memoryId:best?.t.memoryId??null,separation01:separation,completion01:completion,predictionError01:predictionError,uncertainty01:uncertainty,tick};
  }
  replay(batch=8,tick=0){const selected=this.state.traces.slice().sort((a,b)=>(b.uncertainty01+b.replayCount*.02)-(a.uncertainty01+a.replayCount*.02)).slice(0,Math.max(1,Math.min(32,Math.floor(batch))));for(const t of selected)t.replayCount++;this.state.replayRuns++;return selected.map(t=>t.memoryId);}
  recallFeatures(vector:number[],tick=0){const r=this.recall(vector,tick);return [r.separation01,r.completion01,1-r.predictionError01,1-r.uncertainty01,Math.min(1,this.state.replayRuns/16)];}
  diagnostics(){return {...this.state.lastRecall,encodingCount:this.state.encodingCount,recalls:this.state.recalls,replayRuns:this.state.replayRuns,traceCount:this.state.traces.length,regions:{...this.state.regions}};}
}
