export interface OrganismAttentionState { target:string; reason:string; salience:number; confidence:number; budget:number; inhibited:string[]; switchedAt:number; }
export function attend(opts:{target:string;reason:string;salience:number;confidence:number;budget:number; inhibit?:string[]}):OrganismAttentionState{
  return { target:opts.target, reason:opts.reason, salience:Math.max(0,Math.min(1,opts.salience)), confidence:Math.max(0,Math.min(1,opts.confidence)), budget:Math.max(0,Math.min(1,opts.budget)), inhibited:[...(opts.inhibit||[])].slice(0,8), switchedAt:Date.now() };
}
