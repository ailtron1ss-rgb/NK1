import type { WillVectorRecord, WillVectorState } from './WillIntegrationBridge.ts';

const clamp01 = (v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const distance = (a:number[], b:number[]) => {
  const n=Math.max(a.length,b.length,1); let sum=0;
  for(let i=0;i<n;i++){ const d=(a[i]??0)-(b[i]??0); sum+=d*d; }
  return Math.sqrt(sum);
};

export interface WillHnswConfig { dimension:number; seed:number; m:number; efSearch:number; }
export interface WillVectorBenchmark {
  engine:'deterministic-hnsw';
  corpus:number;
  queries:number;
  k:number;
  efSearch:number;
  recallAtK01:number;
  exactComparisons:number;
  graphComparisons:number;
  graphReduction01:number;
  promoted:boolean;
  threshold:{recallAtK01:number; reduction01:number; minCorpus:number};
}

type NodeRecord = WillVectorRecord & { level:number; links:Record<number,string[]> };

function seededLevel(id:string,seed:number,maxLevel=6):number{
  let h=2166136261>>>0;
  const s=`${seed}:${id}`;
  for(let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
  let level=0;
  while(level<maxLevel && (h & 0x07)===0){ level++; h=(h*1664525+1013904223)>>>0; }
  return level;
}

export class DeterministicHnswIndex {
  readonly config:WillHnswConfig;
  private readonly records=new Map<string,NodeRecord>();
  private entryId:string|null=null;

  constructor(config:Partial<WillHnswConfig>={}){
    this.config={dimension:Math.max(4,Math.floor(config.dimension??32)),seed:(config.seed??42)>>>0,m:Math.max(2,Math.floor(config.m??8)),efSearch:Math.max(8,Math.floor(config.efSearch??32))};
  }

  upsert(record:WillVectorRecord):void{
    const node:NodeRecord={...record,vector:record.vector.slice(0,this.config.dimension),level:seededLevel(record.id,this.config.seed),links:{}};
    this.records.set(record.id,node);
    if(!this.entryId || !this.records.has(this.entryId) || node.level>this.records.get(this.entryId)!.level) this.entryId=record.id;
    this.rebuildLocalLinks(record.id);
  }

  delete(id:string):void{ this.records.delete(id); for(const node of this.records.values()) for(const ids of Object.values(node.links)) node.links=Object.fromEntries(Object.entries(node.links).map(([level,list])=>[level,list.filter(x=>x!==id)])); if(this.entryId===id) this.entryId=Array.from(this.records.values()).sort((a,b)=>b.level-a.level||a.id.localeCompare(b.id))[0]?.id??null; }

  private rebuildLocalLinks(id:string):void{
    const node=this.records.get(id); if(!node) return;
    for(let level=0;level<=node.level;level++){
      const peers=[...this.records.values()].filter(r=>r.id!==id && r.level>=level).map(r=>({id:r.id,d:distance(node.vector,r.vector)})).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).slice(0,this.config.m).map(x=>x.id);
      node.links[level]=peers;
      for(const peerId of peers){
        const peer=this.records.get(peerId)!;
        const list=peer.links[level]??[];
        if(!list.includes(id)) list.push(id);
        peer.links[level]=list.map(x=>({x,d:distance(peer.vector,this.records.get(x)?.vector??[])})).sort((a,b)=>a.d-b.d||a.x.localeCompare(b.x)).slice(0,this.config.m).map(x=>x.x);
      }
    }
  }

  private greedyEntry(query:number[],distanceTo:(id:string)=>number):{id:string|null;comparisons:number}{
    let current=this.entryId; let comparisons=0; if(!current) return {id:null,comparisons};
    let improved=true; const maxLevel=this.records.get(current)?.level??0;
    for(let level=maxLevel;level>0 && current;level--){
      improved=true;
      while(improved){
        improved=false; const node=this.records.get(current); if(!node) break; const base=distanceTo(node.id); comparisons++;
        for(const peerId of node.links[level]??[]){ const peer=this.records.get(peerId); if(!peer) continue; const d=distanceTo(peer.id); comparisons++; if(d<base || (d===base&&peer.id<node.id)){ current=peer.id; improved=true; break; } }
      }
    }
    return {id:current,comparisons};
  }

  private searchDetailed(vector:number[],k=5,efSearch=this.config.efSearch):{results:Array<{id:string;score01:number;textHash:string;distance:number}>;comparisons:number}{
    if(this.records.size===0) return {results:[],comparisons:0};
    const q=vector.slice(0,this.config.dimension);
    const distances=new Map<string,number>();
    let comparisons=0;
    const distanceTo=(id:string)=>{
      const cached=distances.get(id); if(cached!==undefined) return cached;
      const node=this.records.get(id); const d=distance(q,node?.vector??[]); distances.set(id,d); comparisons++; return d;
    };
    const greedy=this.greedyEntry(q,distanceTo);
    comparisons+=greedy.comparisons;
    const visited=new Set<string>(); const candidates:string[]=[];
    if(greedy.id) candidates.push(greedy.id);
    const queue=(greedy.id?[greedy.id]:[]); let budget=Math.max(k,Math.floor(efSearch));
    while(queue.length && budget>0){
      const id=queue.shift()!; if(visited.has(id)) continue; visited.add(id); const node=this.records.get(id); if(!node) continue;
      candidates.push(id); budget--;
      for(const peerId of node.links[0]??[]) if(!visited.has(peerId)) queue.push(peerId);
      queue.sort((a,b)=>distanceTo(a)-distanceTo(b)||a.localeCompare(b));
    }
    const unique=[...new Set(candidates)];
    const results=unique.map(id=>{ const r=this.records.get(id)!; const d=distanceTo(id); return {id,score01:clamp01(1/(1+d)),textHash:r.textHash,distance:d}; }).sort((a,b)=>b.score01-a.score01||a.id.localeCompare(b.id)).slice(0,Math.max(1,k));
    return {results,comparisons};
  }

  search(vector:number[],k=5,efSearch=this.config.efSearch){ return this.searchDetailed(vector,k,efSearch).results; }

  exactSearch(vector:number[],k=5):Array<{id:string;score01:number;textHash:string;distance:number}>{
    const q=vector.slice(0,this.config.dimension); return [...this.records.values()].map(r=>{const d=distance(q,r.vector); return {id:r.id,score01:clamp01(1/(1+d)),textHash:r.textHash,distance:d};}).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,Math.max(1,k));
  }

  benchmark(queries:number[][],k=5,efSearch=this.config.efSearch,threshold={recallAtK01:.95,reduction01:.2,minCorpus:32}):WillVectorBenchmark{
    let recall=0, graphComparisons=0;
    for(const q of queries){
      const exact=this.exactSearch(q,k).map(x=>x.id); const approx=this.searchDetailed(q,k,efSearch); const set=new Set(exact); recall += approx.results.filter(x=>set.has(x.id)).length/Math.max(1,k); graphComparisons += approx.comparisons;
    }
    const exactComparisons=queries.length*this.records.size; const meanRecall=queries.length?recall/queries.length:1; const reduction01=exactComparisons?Math.max(0,1-graphComparisons/exactComparisons):0;
    return {engine:'deterministic-hnsw',corpus:this.records.size,queries:queries.length,k,efSearch,recallAtK01:meanRecall,exactComparisons,graphComparisons,graphReduction01:reduction01,promoted:this.records.size>=threshold.minCorpus&&meanRecall>=threshold.recallAtK01&&reduction01>=threshold.reduction01,threshold};
  }

  snapshot():WillVectorState & {engine:'deterministic-hnsw';m:number;efSearch:number;entryId:string|null}{
    return {version:1,engine:'deterministic-hnsw',dimension:this.config.dimension,seed:this.config.seed,m:this.config.m,efSearch:this.config.efSearch,entryId:this.entryId,records:[...this.records.values()].map(r=>({id:r.id,vector:r.vector.slice(),textHash:r.textHash,createdAt:r.createdAt})),queryCount:0,hitCount:0};
  }

  restore(state?:Partial<WillVectorState> & {m?:number;efSearch?:number}){ this.records.clear(); this.entryId=null; for(const r of state?.records??[]) this.upsert(r); if(state?.entryId && this.records.has(state.entryId)) this.entryId=state.entryId; }
}
