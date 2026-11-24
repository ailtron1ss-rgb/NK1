import type { ActionKind } from '../core/types.ts';
import { CanonicalNeuralSubstrate, defaultCanonicalNeuralSubstrate, type CanonicalNeuralInput, type CanonicalNeuralSubstrateState } from './CanonicalNeuralSubstrate.ts';
import { MLSTMNeuralSubstrate, defaultMLSTMNeuralSubstrate, type MLSTMNeuralSubstrateState } from './MLSTMNeuralSubstrate.ts';

export type NeuralSubstrateBackendMode = 'canonical' | 'mlstm-shadow';

export interface NeuralSubstrateBackendState {
  version:1;
  mode:NeuralSubstrateBackendMode;
  canonical:CanonicalNeuralSubstrateState;
  mlstmShadow?:MLSTMNeuralSubstrateState;
  lastShadowComparison?:{
    tick:number;
    canonicalPrediction01:number;
    mlstmPrediction01:number;
    predictionGap01:number;
    canonicalNovelty01:number;
    mlstmNovelty01:number;
  };
}

export interface NeuralSubstrateBackendStep extends ReturnType<CanonicalNeuralSubstrate['step']>{
  backend:'canonical';
  shadow?:ReturnType<MLSTMNeuralSubstrate['step']>;
}

/**
 * Canonical composition root for learnable neural substrate execution.
 *
 * The organism persists exactly one canonical learning state. The mLSTM instance is
 * deliberately a research shadow so importing an alternative substrate cannot silently
 * create a second source of truth for identity, memory, or action policy.
 */
export class NeuralSubstrateBackend {
  readonly canonical=new CanonicalNeuralSubstrate();
  readonly mlstmShadow=new MLSTMNeuralSubstrate(16);
  private mode:NeuralSubstrateBackendMode='canonical';
  private lastShadowComparison:NeuralSubstrateBackendState['lastShadowComparison'];

  restore(raw?:Partial<NeuralSubstrateBackendState>|CanonicalNeuralSubstrateState|null){
    const full = raw && 'canonical' in raw ? raw as Partial<NeuralSubstrateBackendState> : null;
    this.canonical.restore((full?.canonical ?? raw ?? defaultCanonicalNeuralSubstrate()) as Partial<CanonicalNeuralSubstrateState>);
    if(full){
      this.mlstmShadow.restore(full.mlstmShadow ?? defaultMLSTMNeuralSubstrate(16));
      this.mode=full.mode==='mlstm-shadow'?'mlstm-shadow':'canonical';
      this.lastShadowComparison=full.lastShadowComparison;
    }
  }

  /** Compatibility snapshot: canonical learner state remains the single persisted source of truth. */
  snapshot():CanonicalNeuralSubstrateState{ return this.canonical.snapshot(); }
  fullSnapshot(canonicalSnapshot?:CanonicalNeuralSubstrateState):NeuralSubstrateBackendState{
    return {
      version:1, mode:this.mode, canonical:canonicalSnapshot ?? this.canonical.snapshot(),
      mlstmShadow:this.mlstmShadow.snapshot(),
      lastShadowComparison:this.lastShadowComparison ? {...this.lastShadowComparison}:undefined,
    };
  }

  canonicalSnapshot(){ return this.canonical.snapshot(); }
  canonicalDiagnostics(){ return this.canonical.diagnostics(); }
  setMode(mode:NeuralSubstrateBackendMode){ this.mode=mode; }
  getMode(){ return this.mode; }

  step(input:CanonicalNeuralInput):NeuralSubstrateBackendStep{
    const canonical=this.canonical.step(input);
    if(this.mode!=='mlstm-shadow') return {...canonical,backend:'canonical'};
    const shadow=this.mlstmShadow.step({vector:input.vector,tick:input.tick,learningEnabled:false});
    this.lastShadowComparison={
      tick:input.tick,
      canonicalPrediction01:canonical.prediction01,
      mlstmPrediction01:shadow.prediction01,
      predictionGap01:Math.abs(canonical.prediction01-shadow.prediction01),
      canonicalNovelty01:canonical.novelty01,
      mlstmNovelty01:shadow.novelty01,
    };
    return {...canonical,backend:'canonical',shadow};
  }

  bindAction(action:ActionKind,tick:number){ return this.canonical.bindAction(action,tick); }
  activity(){ return this.canonical.activity(); }
  applyReplayCredit(input:Parameters<CanonicalNeuralSubstrate['applyReplayCredit']>[0]){ return this.canonical.applyReplayCredit(input); }
  learnFromOutcome(input:Parameters<CanonicalNeuralSubstrate['learnFromOutcome']>[0]){ return this.canonical.learnFromOutcome(input); }
  holdout(input:Parameters<CanonicalNeuralSubstrate['holdout']>[0]){ return this.canonical.holdout(input); }
  lesion(){ return this.canonical.lesion(); }
  lastShadowComparisonSnapshot(){ return this.lastShadowComparison ? {...this.lastShadowComparison}:null; }
  shadowDiagnostics(){ return this.mlstmShadow.diagnostics(); }
  diagnostics(){ return this.canonical.diagnostics(); }

  /** Reset only the experimental shadow, never the canonical learning state. */
  resetShadow(){ this.mlstmShadow.reset(); this.lastShadowComparison=undefined; }
}

export function defaultNeuralSubstrateBackend():NeuralSubstrateBackendState{
  const backend=new NeuralSubstrateBackend();
  return backend.fullSnapshot();
}
