import type { ActionKind } from '../core/types.ts';

export interface CausalReplayCandidate {
  id?: string;
  tick?: number;
  taskId?: string;
  action: ActionKind;
  surprise01: number;
  causalStrength01?: number;
  learningQuality01?: number;
  replayPriority01?: number;
  policyFeatures01?: number[];
}

export interface CausalReplaySelectionOptions {
  maxBatchSize?: number;
  recentQuota?: number;
}

const finite01=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const priority=(row:CausalReplayCandidate)=>finite01(row.replayPriority01??(.24*finite01(row.surprise01)+.20*finite01(row.causalStrength01??.5)+.56*finite01(row.learningQuality01??.5)));
const tick=(row:CausalReplayCandidate)=>Number.isFinite(row.tick)?Number(row.tick):0;
const id=(row:CausalReplayCandidate,index:number)=>String(row.id??`anonymous:${tick(row)}:${row.action}:${index}`);
const stratum=(row:CausalReplayCandidate)=> {
  const features=Array.isArray(row.policyFeatures01)?row.policyFeatures01:[];
  const coarse=features.slice(0,6).map(v=>Math.round(finite01(v)*3)).join('.');
  return `${row.action}|${coarse}`;
};
const byPriority=(a:{row:CausalReplayCandidate;index:number},b:{row:CausalReplayCandidate;index:number})=>
  priority(b.row)-priority(a.row)||tick(b.row)-tick(a.row)||id(a.row,a.index).localeCompare(id(b.row,b.index));

/**
 * Deterministic bounded replay sampler shared by P26 runtime and its benchmark.
 * It guarantees a recent window, then chooses one high-priority representative
 * per action/coarse-state stratum before filling by evidence-weighted priority.
 * Priority is a scheduling heuristic, never a claim that an outcome is correct.
 */
export function selectCausalReplayBatch<T extends CausalReplayCandidate>(
  input:readonly T[],
  options:CausalReplaySelectionOptions={},
):T[] {
  const requested=options.maxBatchSize===undefined?32:Math.floor(Number.isFinite(options.maxBatchSize)?options.maxBatchSize:32);
  const cap=Math.max(1,Math.min(128,requested));
  const requestedRecent=options.recentQuota===undefined?Math.min(8,Math.floor(cap/4)):Math.floor(Number.isFinite(options.recentQuota)?options.recentQuota:Math.min(8,Math.floor(cap/4)));
  const recentQuota=Math.max(0,Math.min(cap,requestedRecent));
  const indexed=input.map((row,index)=>({row,index})).filter(x=>Array.isArray(x.row.policyFeatures01)&&x.row.policyFeatures01.length>=16);
  const deduped=new Map<string,{row:T;index:number}>();
  for(const item of indexed){
    const key=id(item.row,item.index);
    const prior=deduped.get(key);
    if(!prior||tick(item.row)>tick(prior.row))deduped.set(key,item as {row:T;index:number});
  }
  const all=[...deduped.values()];
  if(all.length<=cap)return all.sort((a,b)=>tick(a.row)-tick(b.row)||id(a.row,a.index).localeCompare(id(b.row,b.index))).map(x=>x.row);
  const recent=all.slice().sort((a,b)=>tick(b.row)-tick(a.row)||id(a.row,a.index).localeCompare(id(b.row,b.index))).slice(0,recentQuota);
  const selected=new Map<string,{row:T;index:number}>();
  for(const item of recent)selected.set(id(item.row,item.index),item);
  const historical=all.filter(item=>!selected.has(id(item.row,item.index)));
  const groups=new Map<string,typeof historical>();
  for(const item of historical){const key=stratum(item.row);const group=groups.get(key)??[];group.push(item);groups.set(key,group);}
  const representatives=[...groups.values()].map(group=>group.slice().sort(byPriority)[0]).sort(byPriority);
  for(const item of representatives){if(selected.size>=cap)break;selected.set(id(item.row,item.index),item);}
  if(selected.size<cap)for(const item of historical.slice().sort(byPriority)){if(selected.size>=cap)break;selected.set(id(item.row,item.index),item);}
  return [...selected.values()].sort((a,b)=>tick(a.row)-tick(b.row)||id(a.row,a.index).localeCompare(id(b.row,b.index))).map(x=>x.row);
}
