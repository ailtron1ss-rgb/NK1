import type { MemoryItem2 } from '../developmental/MemoryOS2.ts';

const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tokenize=(text:string)=>String(text??'').toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu)??[];
function hashToken(token:string){let h=2166136261>>>0;for(const ch of token){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function textVector(text:string,dim=48){const v=new Array(dim).fill(0);for(const tok of tokenize(text)){const h=hashToken(tok);v[h%dim]+=1;v[(h>>>8)%dim]-=.35;}const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;return v.map(x=>x/n);}
function cosine(a:number[],b:number[]){const n=Math.min(a.length,b.length);let dot=0,na=0,nb=0;for(let i=0;i<n;i++){dot+=(a[i]??0)*(b[i]??0);na+=(a[i]??0)**2;nb+=(b[i]??0)**2;}return na&&nb?dot/Math.sqrt(na*nb):0;}
function normalise(v:number[]){const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;return v.map(x=>x/n);}

export interface HippocampalTrace {
  id:string;
  memoryId:string;
  vector:number[];
  tick:number;
  at:number;
  importance01:number;
  replayCount:number;
  lastReplayedTick:number;
  source:string;
}

export interface SemanticSchema {
  id:string;
  vector:number[];
  count:number;
  confidence01:number;
  firstTick:number;
  lastTick:number;
  sourceMix:Record<string,number>;
}

export interface HippocampalMemoryState {
  version:1;
  encodingCount:number;
  replayRuns:number;
  replayedTraces:number;
  consolidationRuns:number;
  schemaUpdates:number;
  traces:HippocampalTrace[];
  schemas:SemanticSchema[];
  lastRecall:{query:string;episodeId:string|null;schemaId:string|null;similarity01:number;at:number};
  lastReplay:{ids:string[];meanImportance01:number;at:number};
}

const defaults=():HippocampalMemoryState=>({
  version:1,encodingCount:0,replayRuns:0,replayedTraces:0,consolidationRuns:0,schemaUpdates:0,
  traces:[],schemas:[],lastRecall:{query:'',episodeId:null,schemaId:null,similarity01:0,at:0},lastReplay:{ids:[],meanImportance01:0,at:0}
});

/**
 * Fast episodic / slow schema learning substrate inspired by complementary-learning-systems ideas.
 * MemoryOS2 remains the canonical persisted memory store; this module learns compact temporal
 * representations from those memories and feeds retrieval/replay signals back into CentralBrain.
 */
export class HippocampalMemorySubstrate {
  readonly systemName='memory:hippocampal-substrate' as const;
  private state=defaults();
  private readonly maxTraces:number;
  private readonly maxSchemas:number;

  constructor(options:{maxTraces?:number;maxSchemas?:number}={}){
    this.maxTraces=Math.max(64,Math.min(384,Math.floor(options.maxTraces??192)));
    this.maxSchemas=Math.max(8,Math.min(64,Math.floor(options.maxSchemas??24)));
  }

  restore(raw?:Partial<HippocampalMemoryState>|null){
    const d=defaults();const r=raw??{};
    this.state={...d,...r,
      traces:Array.isArray(r.traces)?r.traces.slice(-this.maxTraces).map((x:any)=>({...x,vector:Array.isArray(x?.vector)?x.vector.slice(0,64):new Array(64).fill(0)})):[],
      schemas:Array.isArray(r.schemas)?r.schemas.slice(-this.maxSchemas).map((x:any)=>({...x,vector:Array.isArray(x?.vector)?x.vector.slice(0,64):new Array(64).fill(0),sourceMix:{...(x?.sourceMix??{})}})):[],
      lastRecall:{...d.lastRecall,...(r.lastRecall??{})},lastReplay:{...d.lastReplay,...(r.lastReplay??{}),ids:Array.isArray(r.lastReplay?.ids)?r.lastReplay!.ids.slice(0,32):[]}
    };
  }

  snapshot(){return structuredClone(this.state);}

  private bindVector(memory:MemoryItem2,centralLatent:number[]=[]){
    const out=new Array(64).fill(0);
    const text=Array.isArray(memory.semanticVector)&&memory.semanticVector.length?memory.semanticVector.slice(0,48):textVector(memory.content,48);
    for(let i=0;i<48;i++)out[i]=clamp11(text[i]??0);
    for(let i=0;i<16;i++){
      const a=centralLatent[i]??0;
      const b=centralLatent[(i*3+7)%Math.max(1,centralLatent.length)]??0;
      out[48+i]=clamp11(a*.72+b*.28);
    }
    return normalise(out);
  }

  encode(memory:MemoryItem2, input:{centralLatent?:number[];tick:number;at:number}){
    const existing=this.state.traces.find(x=>x.memoryId===memory.id);
    const vector=this.bindVector(memory,input.centralLatent??[]);
    const importance=clamp01(memory.salience*.34+memory.predictionError*.2+memory.identityRelevance*.18+memory.goalRelevance*.13+memory.emotionalWeight*.08+memory.confidence*.07);
    if(existing){
      existing.vector=normalise(existing.vector.map((v,i)=>v*.78+(vector[i]??0)*.22));
      existing.tick=input.tick;existing.at=input.at;existing.importance01=clamp01(existing.importance01*.82+importance*.18);
    } else {
      this.state.traces.unshift({id:`hip:${memory.id}`,memoryId:memory.id,vector,tick:input.tick,at:input.at,importance01:importance,replayCount:0,lastReplayedTick:0,source:memory.source});
      if(this.state.traces.length>this.maxTraces)this.state.traces.length=this.maxTraces;
    }
    this.state.encodingCount++;
    return this.state.traces.find(x=>x.memoryId===memory.id)!;
  }

  recall(query:string,limit=4,at=0){
    const q=normalise(textVector(query,64));
    const episode=this.state.traces.slice().map(t=>({t,score:clamp01((cosine(q,t.vector)+1)/2)*.72+t.importance01*.18+Math.min(1,t.replayCount/6)*.10})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(8,limit)));
    const schema=this.state.schemas.slice().map(s=>({s,score:clamp01((cosine(q,s.vector)+1)/2)*.9+s.confidence01*.1})).sort((a,b)=>b.score-a.score)[0]??null;
    const best=episode[0]??null;
    this.state.lastRecall={query:String(query).slice(0,180),episodeId:best?.t.memoryId??null,schemaId:schema?.s.id??null,similarity01:best?.score??0,at:Number.isFinite(at)?at:0};
    return {episodes:episode.map(x=>({memoryId:x.t.memoryId,score01:x.score,replayCount:x.t.replayCount,importance01:x.t.importance01})),schema:schema?{id:schema.s.id,score01:schema.score,confidence01:schema.s.confidence01}:null};
  }

  recallFeatures(query:string,at=0){
    const r=this.recall(query,3,at);const out:number[]=[];
    for(const x of r.episodes.slice(0,2)){out.push(x.score01,x.importance01,Math.min(1,x.replayCount/8));}
    if(r.schema)out.push(r.schema.score01,r.schema.confidence01); else out.push(0,0);
    const last=this.state.lastRecall;
    out.push(last.similarity01,Math.min(1,this.state.replayedTraces/64),Math.min(1,this.state.schemaUpdates/64));
    return out.slice(0,12);
  }

  replay(batch=8,tick=0,at=Date.now()){
    const n=Math.max(1,Math.min(32,Math.floor(batch)));
    const selected=this.state.traces.slice().sort((a,b)=>{
      const score=(x:HippocampalTrace)=>x.importance01*.6+(1-Math.min(1,Math.max(0,tick-x.tick)/2400))*.18+Math.min(.15,x.replayCount*.01)+((x.lastReplayedTick===0)?0.07:0);
      return score(b)-score(a);
    }).slice(0,n);
    for(const t of selected){t.replayCount++;t.lastReplayedTick=tick;}
    this.state.replayRuns++;this.state.replayedTraces+=selected.length;
    this.state.lastReplay={ids:selected.map(x=>x.memoryId),meanImportance01:selected.length?selected.reduce((s,x)=>s+x.importance01,0)/selected.length:0,at};
    return selected.map(x=>structuredClone(x));
  }

  consolidate(batch=8,tick=0,at=Date.now()){
    const selected=this.replay(batch,tick,at);
    const ordered=selected.slice().sort((a,b)=>b.importance01-a.importance01);
    const created:string[]=[];
    for(const trace of ordered){
      let best:SemanticSchema|null=null;let bestSim=-1;
      for(const schema of this.state.schemas){const sim=cosine(trace.vector,schema.vector);if(sim>bestSim){bestSim=sim;best=schema;}}
      const shouldCreate=!best||bestSim<.58;
      if(shouldCreate){
        if(this.state.schemas.length>=this.maxSchemas){
          this.state.schemas.sort((a,b)=>(a.confidence01+a.count*.01)-(b.confidence01+b.count*.01));
          this.state.schemas.shift();
        }
        const schema:SemanticSchema={id:`schema:${tick}:${this.state.schemaUpdates+1}`,vector:trace.vector.slice(),count:1,confidence01:clamp01(.45+trace.importance01*.4),firstTick:trace.tick,lastTick:tick,sourceMix:{[trace.source]:1}};
        this.state.schemas.push(schema);best=schema;created.push(schema.id);this.state.schemaUpdates++;
      } else if(best){
        const lr=1/Math.min(20,best.count+1);
        best.vector=normalise(best.vector.map((v,i)=>v*(1-lr)+(trace.vector[i]??0)*lr));
        best.count++;best.lastTick=tick;best.confidence01=clamp01(best.confidence01*.94+trace.importance01*.06);best.sourceMix[trace.source]=(best.sourceMix[trace.source]??0)+1;this.state.schemaUpdates++;
      }
    }
    this.state.consolidationRuns++;
    return {replayed:selected.length,schemas:this.state.schemas.length,createdSchemaIds:created,updated:this.state.schemaUpdates};
  }

  diagnostics(){
    return {encodingCount:this.state.encodingCount,replayRuns:this.state.replayRuns,replayedTraces:this.state.replayedTraces,consolidationRuns:this.state.consolidationRuns,schemaUpdates:this.state.schemaUpdates,traceCount:this.state.traces.length,schemaCount:this.state.schemas.length,lastRecall:structuredClone(this.state.lastRecall),lastReplay:structuredClone(this.state.lastReplay)};
  }
}
