import type { ActionKind } from '../core/types.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));

export interface RecurrentCausalEpisode {
  id:string;
  memoryId:string|null;
  tick:number;
  action:ActionKind|null;
  activity:number[];
  reward01:number|null;
  surprise01:number;
  credit01:number;
  replayCount:number;
  lastReplayedTick:number;
}

export interface RecurrentCausalMemoryState {
  version:1;
  gamma:number;
  lambda:number;
  encodingCount:number;
  outcomeCount:number;
  replayRuns:number;
  replayedEpisodes:number;
  meanAbsTd01:number;
  delayedCredit01:number;
  episodes:RecurrentCausalEpisode[];
  linkedMemoryIds:string[];
}

export interface RecurrentCausalCredit {
  episodeId:string;
  action:ActionKind|null;
  activity:number[];
  tdError01:number;
  weight01:number;
  delay:number;
}

const defaults=():RecurrentCausalMemoryState=>({version:1,gamma:.88,lambda:.82,encodingCount:0,outcomeCount:0,replayRuns:0,replayedEpisodes:0,meanAbsTd01:0,delayedCredit01:0,episodes:[],linkedMemoryIds:[]});

export class RecurrentCausalMemory {
  private state=defaults();
  restore(raw?:Partial<RecurrentCausalMemoryState>|null){
    const d=defaults(); const r=raw??{};
    this.state={...d,...r,gamma:Math.max(.6,Math.min(.99,Number(r.gamma??d.gamma))),lambda:clamp01(Number(r.lambda??d.lambda)),episodes:Array.isArray(r.episodes)?r.episodes.slice(-384).map((e:any)=>({...e,activity:Array.isArray(e?.activity)?e.activity.slice(0,48).map(clampSigned):[]})):[],linkedMemoryIds:Array.isArray(r.linkedMemoryIds)?r.linkedMemoryIds.slice(-256).map(String):[]};
    // restore gamma on its intended [0.6, 0.99] range without trusting malformed state
    this.state.gamma=Math.max(.6,Math.min(.99,Number(r.gamma??d.gamma)));
  }
  snapshot(){return structuredClone(this.state);}
  linkMemory(memoryId:string){const id=String(memoryId); if(!id)return false; if(!this.state.linkedMemoryIds.includes(id))this.state.linkedMemoryIds=[...this.state.linkedMemoryIds.slice(-255),id]; return true;}
  bindLatestMemory(memoryId:string){const id=String(memoryId); if(!id)return false; const episode=this.state.episodes[this.state.episodes.length-1]; if(episode && episode.reward01==null){episode.memoryId=id; this.linkMemory(id); return true;} return this.linkMemory(id);}
  encodeContext(input:{tick:number;memoryId?:string|null;action?:ActionKind|null;activity:number[];surprise01?:number}){
    const episode:RecurrentCausalEpisode={id:`rcm:${input.tick}:${this.state.encodingCount+1}`,memoryId:input.memoryId??null,tick:input.tick,action:input.action??null,activity:(input.activity??[]).slice(0,48).map(clampSigned),reward01:null,surprise01:clamp01(input.surprise01??0),credit01:0,replayCount:0,lastReplayedTick:0};
    this.state.episodes=[...this.state.episodes.slice(-383),episode]; this.state.encodingCount++; if(episode.memoryId)this.linkMemory(episode.memoryId); return structuredClone(episode);
  }
  recordOutcome(input:{tick:number;action:ActionKind;reward01:number;surprise01?:number;memoryId?:string|null;activity?:number[]}){
    const targetId=input.memoryId??null;
    let episode=this.state.episodes.slice().reverse().find(e=>(targetId==null||e.memoryId===targetId)&&e.reward01==null);
    if(!episode){
      episode=this.encodeContext({tick:input.tick,memoryId:targetId,action:input.action,activity:input.activity??[],surprise01:input.surprise01});
    }
    episode.action=input.action; episode.reward01=clamp01(input.reward01); episode.surprise01=clamp01(input.surprise01??episode.surprise01); this.state.outcomeCount++;
    return structuredClone(episode);
  }
  replay(batch=8,tick=0):RecurrentCausalCredit[]{
    const candidates=this.state.episodes.filter(e=>e.reward01!=null).slice().sort((a,b)=>{
      const score=(e:RecurrentCausalEpisode)=>clamp01((e.reward01??.5)*.45+e.surprise01*.3+Math.min(1,e.replayCount/6)*.1+(e.lastReplayedTick===0?.15:0));
      return score(b)-score(a);
    }).slice(0,Math.max(1,Math.min(32,Math.floor(batch))));
    const credits:RecurrentCausalCredit[]=[];
    for(const e of candidates){
      const idx=this.state.episodes.indexOf(e); const next=this.state.episodes[idx+1];
      const target=clamp01((e.reward01??.5)+(next?.reward01!=null?this.state.gamma*next.reward01:0));
      const predicted=clamp01(.5+e.credit01*.5);
      const td=target-predicted;
      const delay=Math.max(0,(tick-e.tick));
      const weight=clamp01((.25+Math.abs(td)*.75)*(1-Math.min(.65,delay/4096))*((1-this.state.lambda)+this.state.lambda*.9));
      const nextCredit=clamp01(e.credit01*.72+Math.abs(td)*.28);
      e.credit01=nextCredit; e.replayCount++; e.lastReplayedTick=tick;
      credits.push({episodeId:e.id,action:e.action,activity:e.activity.slice(),tdError01:Math.abs(td),weight01:weight,delay});
    }
    this.state.replayRuns++; this.state.replayedEpisodes+=credits.length;
    if(credits.length){const m=credits.reduce((s,c)=>s+c.tdError01,0)/credits.length; this.state.meanAbsTd01=this.state.meanAbsTd01*.9+m*.1; const dc=credits.reduce((s,c)=>s+c.weight01,0)/credits.length; this.state.delayedCredit01=this.state.delayedCredit01*.9+dc*.1;}
    return credits;
  }
  diagnostics(){return {encodingCount:this.state.encodingCount,outcomeCount:this.state.outcomeCount,replayRuns:this.state.replayRuns,replayedEpisodes:this.state.replayedEpisodes,meanAbsTd01:this.state.meanAbsTd01,delayedCredit01:this.state.delayedCredit01,episodeCount:this.state.episodes.length,linkedMemoryCount:this.state.linkedMemoryIds.length};}
}

export function defaultRecurrentCausalMemory(){return defaults();}
