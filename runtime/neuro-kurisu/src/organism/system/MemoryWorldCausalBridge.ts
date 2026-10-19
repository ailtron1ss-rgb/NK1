export type MemoryWorldCausalStatus = 'candidate'|'verified'|'contested';

export interface MemoryWorldCausalLink {
  id:string;
  tick:number;
  at:number;
  memoryIds:string[];
  query:string;
  influence01:number;
  predictionWithoutMemory01:number;
  predictionWithMemory01:number;
  delta01:number;
  replayDelta01:number;
  status:MemoryWorldCausalStatus;
  provenance:string;
}

export interface MemoryWorldCausalBridgeState {
  version:1;
  applications:number;
  verifiedLinks:number;
  contestedLinks:number;
  lastVerifiedTick:number;
  lastInfluence01:number;
  recent:MemoryWorldCausalLink[];
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export const defaultMemoryWorldCausalBridge=():MemoryWorldCausalBridgeState=>({
  version:1, applications:0, verifiedLinks:0, contestedLinks:0,
  lastVerifiedTick:-1, lastInfluence01:0, recent:[],
});

export class MemoryWorldCausalBridge {
  private state=defaultMemoryWorldCausalBridge();
  private readonly capacity:number;
  constructor(capacity=96){this.capacity=capacity;}
  restore(raw?:Partial<MemoryWorldCausalBridgeState>|null):void{
    const base=defaultMemoryWorldCausalBridge();
    this.state={
      ...base,
      ...(raw??{}),
      version:1,
      applications:Math.max(0,Number(raw?.applications??0)),
      verifiedLinks:Math.max(0,Number(raw?.verifiedLinks??0)),
      contestedLinks:Math.max(0,Number(raw?.contestedLinks??0)),
      lastVerifiedTick:Number(raw?.lastVerifiedTick??-1),
      lastInfluence01:clamp(Number(raw?.lastInfluence01??0)),
      recent:Array.isArray(raw?.recent)?raw.recent.slice(0,this.capacity).map((x:any)=>this.clean(x)):[],
    };
  }
  record(input:{tick:number;at:number;memoryIds:string[];query:string;predictionWithoutMemory01:number;predictionWithMemory01:number;replayDelta01:number;provenance?:string}):MemoryWorldCausalLink{
    const delta=Math.abs(clamp(input.predictionWithMemory01)-clamp(input.predictionWithoutMemory01));
    const replay=Math.abs(clamp(input.replayDelta01));
    const influence=clamp(delta*.7+replay*.3);
    const status:MemoryWorldCausalStatus=influence>=.015 && input.memoryIds.length>0?'verified':influence<.005?'candidate':'contested';
    const link:MemoryWorldCausalLink={
      id:`mwc-${input.tick}-${this.state.applications+1}`,
      tick:Math.max(0,Math.floor(input.tick)),at:Number(input.at),memoryIds:[...new Set(input.memoryIds)].slice(0,8),
      query:String(input.query).slice(0,240),influence01:influence,
      predictionWithoutMemory01:clamp(input.predictionWithoutMemory01),predictionWithMemory01:clamp(input.predictionWithMemory01),
      delta01:delta,replayDelta01:replay,status,provenance:String(input.provenance??'memory-evidence->world-prediction'),
    };
    this.state.applications++;
    this.state.lastInfluence01=influence;
    if(status==='verified'){this.state.verifiedLinks++;this.state.lastVerifiedTick=link.tick;}
    if(status==='contested')this.state.contestedLinks++;
    this.state.recent=[link,...this.state.recent].slice(0,this.capacity);
    return structuredClone(link);
  }
  verifiedForTick(tick:number):boolean{return this.state.recent.some(x=>x.tick===tick&&x.status==='verified');}
  snapshot():MemoryWorldCausalBridgeState{return structuredClone(this.state);}
  diagnostics(){return {applications:this.state.applications,verifiedLinks:this.state.verifiedLinks,contestedLinks:this.state.contestedLinks,lastVerifiedTick:this.state.lastVerifiedTick,lastInfluence01:this.state.lastInfluence01,verificationRate01:clamp(this.state.verifiedLinks/Math.max(1,this.state.applications))};}
  private clean(raw:any):MemoryWorldCausalLink{
    return {id:String(raw?.id??''),tick:Math.max(0,Number(raw?.tick??0)),at:Number(raw?.at??0),memoryIds:Array.isArray(raw?.memoryIds)?raw.memoryIds.map(String).slice(0,8):[],query:String(raw?.query??''),influence01:clamp(Number(raw?.influence01??0)),predictionWithoutMemory01:clamp(Number(raw?.predictionWithoutMemory01??0)),predictionWithMemory01:clamp(Number(raw?.predictionWithMemory01??0)),delta01:clamp(Number(raw?.delta01??0)),replayDelta01:clamp(Number(raw?.replayDelta01??0)),status:['candidate','verified','contested'].includes(raw?.status)?raw.status:'candidate',provenance:String(raw?.provenance??'')};
  }
}
