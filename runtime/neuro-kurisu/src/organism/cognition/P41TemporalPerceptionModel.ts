import type { ActionKind } from '../core/types.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clampSigned=(n:number)=>Math.max(-1,Math.min(1,Number.isFinite(n)?n:0));
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

type TemporalObservation={
  scene:string;
  audioActivity01:number;
  visionChange01:number;
  uncertainty01:number;
  entities:number;
  cues:string[];
  at:number;
};

interface TemporalPrediction { from:string; predicted:string; confidence01:number; at:number; }

export interface P41TemporalPerceptionState {
  version:1;
  tick:number;
  currentStateKey:string;
  previousStateKey:string;
  transitionCounts:Record<string,Record<string,number>>;
  visits:Record<string,number>;
  history:Array<{key:string;at:number}>;
  predictions:TemporalPrediction[];
  metrics:{predictionAccuracy01:number;transitionConfidence01:number;surprise01:number;temporalBinding01:number;updates:number};
  actionBias:Record<ActionKind,number>;
}

export const defaultP41TemporalPerception=():P41TemporalPerceptionState=>({
  version:1,tick:0,currentStateKey:'unknown',previousStateKey:'unknown',transitionCounts:{},visits:{},history:[],predictions:[],
  metrics:{predictionAccuracy01:0.2,transitionConfidence01:.1,surprise01:0,temporalBinding01:0.1,updates:0},
  actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
});

function stableKey(o:TemporalObservation){
  const scene=o.scene.trim().toLowerCase().slice(0,64)||'unknown';
  const audio=o.audioActivity01>.62?'audio-high':o.audioActivity01>.28?'audio-mid':'audio-low';
  const visual=o.visionChange01>.45?'vision-change':o.visionChange01>.12?'vision-drift':'vision-stable';
  const uncertainty=o.uncertainty01>.7?'uncertain':o.uncertainty01>.35?'mixed':'clear';
  const entities=o.entities>6?'many':o.entities>2?'some':'few';
  const cue=(o.cues[0]??'none').slice(0,32);
  return `${scene}|${audio}|${visual}|${uncertainty}|${entities}|${cue}`;
}

export class P41TemporalPerceptionModel{
  private state=defaultP41TemporalPerception();
  restore(raw?:Partial<P41TemporalPerceptionState>|null){
    const d=defaultP41TemporalPerception(); const r=raw??{};
    this.state={...d,...r,
      transitionCounts:{...(r.transitionCounts??{})},visits:{...(r.visits??{})},
      history:Array.isArray(r.history)?r.history.slice(-128):[],predictions:Array.isArray(r.predictions)?r.predictions.slice(-128):[],
      metrics:{...d.metrics,...(r.metrics??{})},actionBias:{...d.actionBias,...(r.actionBias??{})}};
  }
  snapshot(){return structuredClone(this.state);}

  observe(input:TemporalObservation){
    const key=stableKey(input); const prev=this.state.currentStateKey; this.state.previousStateKey=prev; this.state.currentStateKey=key;
    this.state.visits[key]=(this.state.visits[key]??0)+1;
    if(prev && prev!=='unknown'){
      const row=this.state.transitionCounts[prev]??{}; row[key]=(row[key]??0)+1; this.state.transitionCounts[prev]=row;
      const pred=this.predictFrom(prev); if(pred){
        const actualProb=this.probability(prev,key); const correct=clamp(actualProb*1.15);
        this.state.metrics.predictionAccuracy01=clamp(this.state.metrics.predictionAccuracy01*.88+correct*.12);
        this.state.metrics.surprise01=clamp(this.state.metrics.surprise01*.82+(1-actualProb)*.18);
        this.state.predictions.unshift({from:prev,predicted:pred.at,confidence01:pred.confidence01,at:input.at});
      }
    }
    const prediction=this.predictFrom(key);
    this.state.metrics.transitionConfidence01=clamp(this.state.metrics.transitionConfidence01*.94+(prediction?.confidence01??.08)*.06);
    this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.95+(prev!=='unknown'?.8:.15)*.05);
    this.state.actionBias.verify=clampSigned(this.state.actionBias.verify*.9+this.state.metrics.surprise01*.06);
    this.state.actionBias.explore=clampSigned(this.state.actionBias.explore*.91+(this.state.metrics.transitionConfidence01<.35?.025:0));
    this.state.actionBias.reflect=clampSigned(this.state.actionBias.reflect*.92+Math.abs(this.state.metrics.predictionAccuracy01-.5)*.02);
    this.state.actionBias.wait=clampSigned(this.state.actionBias.wait*.91+(prediction?.confidence01??0)*.025);
    this.state.actionBias.defer=clampSigned(this.state.actionBias.defer*.92+this.state.metrics.surprise01*.018);
    this.state.history=[...this.state.history,{key,at:input.at}].slice(-128);
    this.state.predictions=this.state.predictions.slice(0,128);
    this.state.tick++; this.state.metrics.updates++;
    return this.snapshot();
  }

  private probability(from:string,to:string){const row=this.state.transitionCounts[from]; if(!row)return 0; const total=Object.values(row).reduce((s,n)=>s+n,0)||1; return (row[to]??0)/total;}
  private predictFrom(from:string){
    const row=this.state.transitionCounts[from]; if(!row)return null;
    const entries=Object.entries(row).sort((a,b)=>b[1]-a[1]); if(!entries.length)return null;
    const [predicted,count]=entries[0]; const total=entries.reduce((s,[,n])=>s+n,0)||1;
    return {at:predicted,confidence01:clamp(count/total)};
  }
  nextPrediction(){const p=this.predictFrom(this.state.currentStateKey); return p?{stateKey:p.at,confidence01:p.confidence01}:null;}
  bias(action:ActionKind){return clampSigned(Number(this.state.actionBias[action]??0));}
  summary(){return {currentStateKey:this.state.currentStateKey,previousStateKey:this.state.previousStateKey,nextPrediction:this.nextPrediction(),metrics:this.state.metrics};}
}
