import type { ActionKind } from '../core/types.ts';

export interface NeuralCausalSignature {
  learningUpdates:number;
  replayUpdates:number;
  predictionError01:number;
  plasticity01:number;
  recurrentCoherence01:number;
  neuralConfidence01:number;
  groundingReliability01:number;
}

export interface NeuralCausalTraceRecord {
  tick:number;
  action:ActionKind|null;
  reward01:number;
  external01:boolean;
  verified01:number;
  independent01:number;
  evidence01:number;
  predictionErrorBefore01:number;
  predictionErrorAfter01:number;
  neuralChange01:number;
  learningDelta:number;
  replayDelta:number;
  causalLink01:number;
  ablationRequired:boolean;
  reason:string;
}

export interface NeuralCausalTraceState {
  version:1;
  traces:number;
  externallyGroundedTraces:number;
  verifiedTraces:number;
  meanNeuralChange01:number;
  meanCausalLink01:number;
  meanPredictionErrorDelta01:number;
  learningDeltas:number;
  replayDeltas:number;
  last:NeuralCausalTraceRecord|null;
  history:NeuralCausalTraceRecord[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const normDelta=(a:number,b:number,scale:number)=>clamp(Math.abs(Number(b||0)-Number(a||0))/Math.max(.0001,scale));
export const defaultNeuralCausalTraceState=():NeuralCausalTraceState=>({version:1,traces:0,externallyGroundedTraces:0,verifiedTraces:0,meanNeuralChange01:0,meanCausalLink01:0,meanPredictionErrorDelta01:0,learningDeltas:0,replayDeltas:0,last:null,history:[]});

export class NeuralCausalTraceLedger {
  private state=defaultNeuralCausalTraceState();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<NeuralCausalTraceState>|null){const d=defaultNeuralCausalTraceState(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,last:r.last?structuredClone(r.last):null,history:Array.isArray(r.history)?r.history.slice(-256):[]};}

  record(input:{tick:number;action:ActionKind|null;reward01:number;external01:boolean;verified01:number;independent01:number;evidence01:number;before:NeuralCausalSignature;after:NeuralCausalSignature;reason?:string}):NeuralCausalTraceRecord {
    const neuralChange01=clamp(
      .18*normDelta(input.before.predictionError01,input.after.predictionError01,.5)+
      .18*normDelta(input.before.plasticity01,input.after.plasticity01,.35)+
      .16*normDelta(input.before.recurrentCoherence01,input.after.recurrentCoherence01,.35)+
      .16*normDelta(input.before.neuralConfidence01,input.after.neuralConfidence01,.35)+
      .12*normDelta(input.before.groundingReliability01,input.after.groundingReliability01,.5)+
      .10*normDelta(input.before.learningUpdates,input.after.learningUpdates,2)+
      .10*normDelta(input.before.replayUpdates,input.after.replayUpdates,2)
    );
    const learningDelta=Math.max(0,input.after.learningUpdates-input.before.learningUpdates);
    const replayDelta=Math.max(0,input.after.replayUpdates-input.before.replayUpdates);
    const predictionErrorDelta=Math.abs(input.after.predictionError01-input.before.predictionError01);
    const causalLink01=clamp(
      .24*input.verified01+
      .16*input.independent01+
      .18*input.evidence01+
      .18*neuralChange01+
      .10*clamp(learningDelta/2)+
      .06*clamp(replayDelta/2)+
      .08*(1-clamp(predictionErrorDelta))
    );
    const rec:NeuralCausalTraceRecord={tick:input.tick,action:input.action,reward01:clamp(input.reward01),external01:Boolean(input.external01),verified01:clamp(input.verified01),independent01:clamp(input.independent01),evidence01:clamp(input.evidence01),predictionErrorBefore01:clamp(input.before.predictionError01),predictionErrorAfter01:clamp(input.after.predictionError01),neuralChange01,learningDelta,replayDelta,causalLink01,ablationRequired:true,reason:String(input.reason??'neural-state-change-recorded; causal attribution requires intervention/ablation')};
    this.state.traces++;
    this.state.externallyGroundedTraces+=input.external01?1:0;
    this.state.verifiedTraces+=input.verified01>.5?1:0;
    const a=.10;
    this.state.meanNeuralChange01=clamp(this.state.meanNeuralChange01*(1-a)+neuralChange01*a);
    this.state.meanCausalLink01=clamp(this.state.meanCausalLink01*(1-a)+causalLink01*a);
    this.state.meanPredictionErrorDelta01=clamp(this.state.meanPredictionErrorDelta01*(1-a)+predictionErrorDelta*a);
    this.state.learningDeltas+=learningDelta;this.state.replayDeltas+=replayDelta;
    this.state.last=rec;this.state.history=[rec,...this.state.history].slice(0,256);
    return rec;
  }
}
