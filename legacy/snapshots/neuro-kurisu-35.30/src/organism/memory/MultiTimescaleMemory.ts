import type { ConsolidatedMemory } from '../core/types.ts';

export interface MemoryRecord extends ConsolidatedMemory {
  timescale: 'working' | 'episodic' | 'semantic' | 'autobiographical';
  retrievalCount: number;
  lastRetrievedAt: number;
  confidence: number;
  sourceEventIds: string[];
  embedding?: number[];
  consolidationScore01?: number;
  associationIds?: string[];
}

export class MultiTimescaleMemory {
  private working: MemoryRecord[] = [];
  private episodic: MemoryRecord[] = [];
  private semantic: MemoryRecord[] = [];
  private autobiographical: MemoryRecord[] = [];
  private readonly textTokenCache=new Map<string,Set<string>>();
  restore(rows: MemoryRecord[] = []) {
    this.working=[]; this.episodic=[]; this.semantic=[]; this.autobiographical=[]; this.textTokenCache.clear();
    for (const row of rows) this.add(row);
  }
  add(row: MemoryRecord) {
    this.remove(row.id);
    const enriched={...row,embedding:Array.isArray(row.embedding)?row.embedding.slice(0,24).map(Number):this.embed(`${row.summary} ${row.evidence.join(' ')}`),consolidationScore01:Math.max(0,Math.min(1,Number(row.consolidationScore01??(row.salience*.45+row.confidence*.35))))};
    row=enriched as MemoryRecord;
    const target = row.timescale==='working' ? this.working : row.timescale==='semantic' ? this.semantic : row.timescale==='autobiographical' ? this.autobiographical : this.episodic;
    target.unshift(structuredClone(row)); target.splice(200);
  }
  promote(id: string, timescale: MemoryRecord['timescale']) {
    const all=[...this.working,...this.episodic,...this.semantic,...this.autobiographical];
    const row=all.find(r=>r.id===id); if(!row) return;
    this.remove(id); this.add({...row, timescale, lastRetrievedAt:Date.now()});
  }
  private tokensFor(row:MemoryRecord){const hit=this.textTokenCache.get(row.id);if(hit)return hit;const value=new Set(`${row.summary} ${row.evidence.join(' ')}`.toLowerCase().split(/\s+/).filter(Boolean));if(this.textTokenCache.size>=512){const first=this.textTokenCache.keys().next().value as string|undefined;if(first)this.textTokenCache.delete(first);}this.textTokenCache.set(row.id,value);return value;}
  private embed(text:string){ const v=new Array(24).fill(0); for(let i=0;i<text.length;i++){ const c=text.charCodeAt(i); v[(c+i*7)%24]+=((c%17)-8)/120; } const norm=Math.sqrt(v.reduce((a,b)=>a+b*b,0))||1; return v.map(x=>x/norm); }
  private cosine(a:number[]|undefined,b:number[]){ if(!a||!a.length)return 0; let d=0,na=0,nb=0; for(let i=0;i<Math.min(a.length,b.length);i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];} return na&&nb?Math.max(-1,Math.min(1,d/Math.sqrt(na*nb))):0; }

  retrieve(query: string, limit=8) {
    const q=query.toLowerCase(); const qEmbedding=this.embed(query); const now=Date.now(); const top:Array<{m:MemoryRecord;score:number}>=[];
    const consider=(m:MemoryRecord)=>{
      const score=this.score(m,q,now)+Math.max(0,this.cosine(m.embedding,qEmbedding))*.28+(m.consolidationScore01??0)*.08;
      let at=top.length; while(at>0&&top[at-1]!.score<score)at--;
      if(at<limit)top.splice(at,0,{m,score}); if(top.length>limit)top.pop();
    };
    for(const m of this.autobiographical)consider(m);
    for(const m of this.semantic)consider(m);
    for(const m of this.episodic)consider(m);
    for(const m of this.working)consider(m);
    return top.map(x=>{x.m.retrievalCount++; x.m.lastRetrievedAt=now; return structuredClone(x.m);});
  }
  snapshot(options:{clone?:boolean;compact?:boolean}={}) {
    const rows=[...this.autobiographical.slice(0,48),...this.semantic.slice(0,48),...this.episodic.slice(0,48),...this.working.slice(0,16)].slice(0,160);
    if (!options.compact) return options.clone===false ? rows : rows.map(x=>structuredClone(x));
    const compacted=rows.map(x=>({ ...x, evidence:x.evidence.slice(-6), sourceEventIds:x.sourceEventIds.slice(-8) }));
    return options.clone===false ? compacted : compacted.map(x=>structuredClone(x));
  }
  private remove(id:string){ for(const arr of [this.working,this.episodic,this.semantic,this.autobiographical]) { const i=arr.findIndex(x=>x.id===id); if(i>=0) arr.splice(i,1); } }
  private score(m:MemoryRecord,q:string,now=Date.now()){
    const hay=this.tokensFor(m); const qTokens=q.split(/\s+/).filter(Boolean);
    const hits=qTokens.reduce((n,t)=>n+(hay.has(t)?1:0),0);
    const age=Math.max(0,now-m.createdAt)/86400000;
    const decay=m.timescale==='working'?Math.exp(-age/0.02):m.timescale==='episodic'?Math.exp(-age/7):m.timescale==='semantic'?Math.exp(-age/180):Math.exp(-age/365);
    const consolidation=m.consolidationScore01??0; return hits*0.28 + m.salience*0.22 + m.confidence*0.18 + consolidation*0.12 + Math.min(0.12,m.retrievalCount*0.006) + decay*0.20;
  }
}
