/**
 * BIG PASS 163 — Longitudinal Behavioral Influence Ledger.
 *
 * Tracks whether prior cognitive events are followed by measurable changes in
 * later action selection. It is attribution evidence, not a claim of agency.
 */
export interface BehavioralInfluenceRecord{ id:string; sourceEventId:string; sourceMemoryIds?:string[]; laterTick:number; action:string; baselineScore01:number; observedScore01:number; influence01:number; evidence:string; attribution01:number; at:number; }
export interface BehavioralInfluenceLedgerState{ version:1; observations:number; positiveInfluences:number; meanInfluence01:number; recent:BehavioralInfluenceRecord[]; }
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0)); const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class BehavioralInfluenceLedger{
  private state:BehavioralInfluenceLedgerState={version:1,observations:0,positiveInfluences:0,meanInfluence01:0,recent:[]};
  private anchors=new Map<string,{tick:number;action:string;score01:number;at:number;memoryIds:string[]}>();
  restore(raw?:Partial<BehavioralInfluenceLedgerState>|null){this.state={...this.state,...(raw??{}),recent:Array.isArray(raw?.recent)?raw!.recent.slice(0,128):[]};}
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
