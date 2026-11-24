export interface ModelSwitchTrial{requestId:string;backendA:string;backendB:string;latencyAms:number;latencyBms:number;semanticSimilarity01:number;identityConsistency01:number;constraintConsistency01:number;qualityA01:number|null;qualityB01:number|null;at:number;}
export interface ModelSwitchBenchmarkState{version:1;trials:number;accepted:number;rejected:number;lastDelta01:number;history:ModelSwitchTrial[];}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultModelSwitchBenchmark=():ModelSwitchBenchmarkState=>({version:1,trials:0,accepted:0,rejected:0,lastDelta01:0,history:[]});
const tokenSet=(s:string)=>new Set((s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]));
const jaccard=(a:Set<string>,b:Set<string>)=>{let i=0;for(const x of a)if(b.has(x))i++;const u=new Set([...a,...b]).size;return u?i/u:0;};
export class ModelSwitchBenchmark{
 private state=defaultModelSwitchBenchmark();
 restore(s:ModelSwitchBenchmarkState|undefined){this.state={...defaultModelSwitchBenchmark(),...(s??{}),history:Array.isArray(s?.history)?s!.history.slice(-96):[]};}
 snapshot(){return structuredClone(this.state);}
 compare(input:{requestId:string;backendA:string;backendB:string;responseA:string;responseB:string;latencyAms:number;latencyBms:number;qualityA01?:number|null;qualityB01?:number|null;identityAnchor?:string;constraints?:string[]}):ModelSwitchTrial{
  const semantic=jaccard(tokenSet(input.responseA),tokenSet(input.responseB));
  const anchor=input.identityAnchor?c(jaccard(tokenSet(`${input.identityAnchor}`),new Set([...tokenSet(input.responseA),...tokenSet(input.responseB)]))*1.15):semantic;
  const constraints=(input.constraints??[]).map(x=>{const token=String(x).trim().toLowerCase();if(!token)return 1;const a=input.responseA.toLowerCase().includes(token);const b=input.responseB.toLowerCase().includes(token);return a===b?1:0;});
  const constraint=constraints.length?constraints.reduce<number>((a,b)=>a+b,0)/constraints.length:1;
  const qa=input.qualityA01==null?null:c(input.qualityA01); const qb=input.qualityB01==null?null:c(input.qualityB01); const qualityDelta=qa!=null&&qb!=null?Math.abs(qa-qb):0;
  const delta=c(.46*semantic+.30*anchor+.24*constraint-qualityDelta*.15);
  const trial={requestId:input.requestId,backendA:input.backendA,backendB:input.backendB,latencyAms:Math.max(0,input.latencyAms),latencyBms:Math.max(0,input.latencyBms),semanticSimilarity01:semantic,identityConsistency01:anchor,constraintConsistency01:constraint,qualityA01:qa,qualityB01:qb,at:Date.now()};
  this.state.trials++;this.state.lastDelta01=delta;if(delta>=.64)this.state.accepted++;else this.state.rejected++;this.state.history=[trial,...this.state.history].slice(0,96);return structuredClone(trial);
 }
}
