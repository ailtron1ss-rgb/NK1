/**
 * BIG PASS 163 — Longitudinal Behavioral Influence Ledger.
 *
 * Tracks whether prior cognitive events are followed by measurable changes in
 * later action selection. It is attribution evidence, not a claim of agency.
 */
export interface BehavioralInfluenceRecord{ id:string; sourceEventId:string; sourceMemoryIds?:string[]; laterTick:number; action:string; baselineScore01:number; observedScore01:number; influence01:number; evidence:string; attribution01:number; at:number; }
export interface BehavioralInfluenceLedgerState{ version:1; observations:number; positiveInfluences:number; meanInfluence01:number; recent:BehavioralInfluenceRecord[]; }
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0)); const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const sanitizeRecord=(v:unknown):BehavioralInfluenceRecord|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,120),sourceEventId:typeof r.sourceEventId==='string'?r.sourceEventId.slice(0,120):'',sourceMemoryIds:Array.isArray(r.sourceMemoryIds)?r.sourceMemoryIds.filter((x):x is string=>typeof x==='string').map(x=>x.slice(0,120)).slice(0,16):[],laterTick:cnt(r.laterTick,0),action:typeof r.action==='string'?r.action.slice(0,80):'',baselineScore01:c(finN(r.baselineScore01,0)),observedScore01:c(finN(r.observedScore01,0)),influence01:clamp(finN(r.influence01,0)),evidence:typeof r.evidence==='string'?r.evidence.slice(0,240):'',attribution01:c(finN(r.attribution01,0)),at:Math.max(0,finN(r.at,0))};};
export class BehavioralInfluenceLedger{
  private state:BehavioralInfluenceLedgerState={version:1,observations:0,positiveInfluences:0,meanInfluence01:0,recent:[]};
  private anchors=new Map<string,{tick:number;action:string;score01:number;at:number;memoryIds:string[]}>();
  restore(raw?:Partial<BehavioralInfluenceLedgerState>|null){const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let recent:BehavioralInfluenceRecord[]=[];try{const r=read('recent');if(Array.isArray(r))recent=r.map(sanitizeRecord).filter((x):x is BehavioralInfluenceRecord=>x!==null).slice(-128);}catch{recent=[];}this.state={version:1,observations:cnt(read('observations'),0),positiveInfluences:cnt(read('positiveInfluences'),0),meanInfluence01:clamp(finN(read('meanInfluence01'),0)),recent};}
  anchor(eventId:string,input:{tick:number;action:string;score01:number;at?:number;memoryIds?:string[]}){if(!eventId)return;this.anchors.set(eventId,{tick:Math.floor(input.tick),action:String(input.action),score01:Math.max(0,Math.min(1,input.score01)),at:Number(input.at??Date.now()),memoryIds:[...(input.memoryIds??[])].map(String).slice(0,16)});if(this.anchors.size>256){const first=this.anchors.keys().next().value as string|undefined;if(first)this.anchors.delete(first);}}
  observeFuture(eventId:string,input:{tick:number;action:string;score01:number;at?:number}):BehavioralInfluenceRecord|null{
    const anchor=this.anchors.get(eventId);if(!anchor||input.tick<=anchor.tick)return null;
    const influence=clamp(input.score01-anchor.score01);
    const memoryIds=Array.isArray((anchor as any).memoryIds)?[...(anchor as any).memoryIds]:[]; const attribution=c((Math.abs(influence)*.65)+(memoryIds.length?0.2:0)+(.15*(input.action===anchor.action?1:0))); const row:BehavioralInfluenceRecord={id:`bil:${Date.now()}:${this.state.observations+1}`,sourceEventId:eventId,sourceMemoryIds:memoryIds,laterTick:Math.floor(input.tick),action:String(input.action),baselineScore01:anchor.score01,observedScore01:Math.max(0,Math.min(1,input.score01)),influence01:influence,evidence:input.action===anchor.action?'same-action-repeat':'action-divergence',attribution01:attribution,at:Number(input.at??Date.now())};
    const n=this.state.observations+1;this.state={...this.state,observations:n,positiveInfluences:this.state.positiveInfluences+(influence>0?1:0),meanInfluence01:this.state.meanInfluence01*(n-1)/n+influence/n,recent:[row,...this.state.recent].slice(0,128)};return structuredClone(row);
  }
  snapshot(){return structuredClone(this.state);}
}
export const defaultBehavioralInfluenceLedger=()=>({version:1 as const,observations:0,positiveInfluences:0,meanInfluence01:0,recent:[]});
