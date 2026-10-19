export interface CognitiveSignal { source:string; value:number }

const clamp01=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

export class UnifiedCognitiveSpine {
  integrate(signals:CognitiveSignal[]) {
    const valid=signals.filter(s=>Number.isFinite(s.value));
    if(!valid.length) return 0;
    const weighted=valid.reduce((sum,s)=>sum+clamp01(s.value),0);
    return clamp01(weighted/valid.length);
  }
}
