export interface AdaptiveValueWeights { curiosity:number; truth:number; autonomy:number; evidence:number; care:number; responsibility:number; social:number; updatedAt:number; plasticityBudget:number; }
export interface ValueRevision { id:string; value:keyof Pick<AdaptiveValueWeights,'curiosity'|'truth'|'autonomy'|'evidence'|'care'|'responsibility'|'social'>; before:number; after:number; delta:number; success:number; surprise:number; at:number; }
export const DEFAULT_ADAPTIVE_VALUES:AdaptiveValueWeights={ curiosity:0.90, truth:0.98, autonomy:0.94, evidence:0.95, care:0.78, responsibility:0.90, social:0.60, updatedAt:Date.now(), plasticityBudget:0.08 };
export class ValuePlasticity {
  private weights={...DEFAULT_ADAPTIVE_VALUES};
  restore(v:Partial<AdaptiveValueWeights>|undefined){this.weights={...DEFAULT_ADAPTIVE_VALUES,...(v||{})};}
  snapshot(){return {...this.weights};}
  update(signal:{value:keyof AdaptiveValueWeights; success:number; surprise:number}):ValueRevision|null{
    const k=signal.value; if(!(k in this.weights) || k==='updatedAt'||k==='plasticityBudget') return null;
    const rate=0.005*this.weights.plasticityBudget; const before=(this.weights as any)[k] as number;
    const delta=(signal.success-0.5)*(1+signal.surprise*0.5)*rate;
    const after=Math.max(0.1,Math.min(1,before+delta));
    (this.weights as any)[k]=after; this.weights.updatedAt=Date.now();
    if (Math.abs(after-before) < 0.00001) return null;
    return { id:`value-${Date.now()}-${Math.random().toString(16).slice(2)}`, value:k as any, before, after, delta:after-before, success:Math.max(0,Math.min(1,signal.success)), surprise:Math.max(0,Math.min(1,signal.surprise)), at:Date.now() };
  }
}
