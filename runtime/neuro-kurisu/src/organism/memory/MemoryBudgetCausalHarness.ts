import { MemoryOS2, type MemoryItem2, type MemoryTemporalQueryOptions } from '../developmental/MemoryOS2.ts';

type HarnessMemory = Omit<MemoryItem2,'id'|'createdAt'|'lastAccessAt'|'retrievalCount'|'revisionHistory'|'dormant'|'semanticVector'|'temperature01'|'residencyTier'> & {id?:string};
export interface MemoryCausalQuery { query:string; expectedId:string; options?:MemoryTemporalQueryOptions; }
export interface MemoryCausalHarnessResult {
  items:number;
  queries:number;
  budgetBytes:number;
  controlBytes:number;
  controlHits:number;
  budgetHits:number;
  hitLoss01:number;
  counterfactualRegret01:number;
  evictionCount:number;
  meanEvictedBytes:number;
  missedExpectedIds:string[];
  deterministic:true;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

/**
 * Matched causal A/B harness for memory eviction.
 * The control keeps the same experience stream with a non-binding byte budget;
 * the treatment receives the identical stream under a bounded byte budget.
 * Query order and query payload are shared, so hit loss is measured against a
 * retained control rather than inferred from the treatment after eviction.
 */
export class MemoryBudgetCausalHarness {
  run(input:{items:HarnessMemory[];queries:MemoryCausalQuery[];budgetBytes:number}):MemoryCausalHarnessResult {
    const budgetBytes=Math.max(16384,Math.floor(Number(input.budgetBytes)));
    const control=new MemoryOS2();
    const treatment=new MemoryOS2();
    const encodeBoth=(item:HarnessMemory)=>{control.encode(item);treatment.encode(item);};
    for(const item of input.items)encodeBoth(item);
    control.enforceByteBudget({maxBytes:Math.max(1024*1024*1024,control.budgetDiagnostics().estimatedBytes+1),reason:'r24-retained-control'});
    treatment.enforceByteBudget({maxBytes:budgetBytes,reason:'r24-causal-treatment'});
    let controlHits=0,budgetHits=0;
    const missed:string[]=[];
    for(const q of input.queries){
      const cHit=control.retrieve(q.query,8,0,0,q.options).some(row=>row.id===q.expectedId);
      const t=treatment.retrieve(q.query,8,0,0,q.options).some(row=>row.id===q.expectedId);
      if(cHit)controlHits++;
      if(t)budgetHits++; else if(cHit)missed.push(q.expectedId);
    }
    const comparable=Math.max(1,controlHits);
    const hitLoss01=clamp((controlHits-budgetHits)/comparable);
    const controlBytes=control.budgetDiagnostics().estimatedBytes;
    const treatmentDiagnostics=treatment.budgetDiagnostics();
    const witnesses=treatment.snapshot().evictionWitnesses;
    const counterfactualRegret01=clamp(witnesses.length? witnesses.reduce((s,w)=>s+w.counterfactualRegret01,0)/witnesses.length : 0);
    return {
      items:input.items.length,queries:input.queries.length,budgetBytes,controlBytes,
      controlHits,budgetHits,hitLoss01,counterfactualRegret01,
      evictionCount:treatmentDiagnostics.budgetEvictions,
      meanEvictedBytes:witnesses.length?witnesses.reduce((s,w)=>s+w.bytes,0)/witnesses.length:0,
      missedExpectedIds:[...new Set(missed)],deterministic:true,
    };
  }
}
