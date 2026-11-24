import type { MemoryOSState2, MemoryItem2 } from './MemoryOS2.ts';
import type { MemoryRecord } from '../memory/MultiTimescaleMemory.ts';
import { MemoryOS2 } from './MemoryOS2.ts';

export interface MemorySubstrateInspection {
  canonicalAuthority:'memoryOS2';
  memoryOSItems:number;
  continuumItems:number;
  semanticOverlap01:number;
  strongMatches:number;
  compatibilityOnlyContinuumItems:number;
  recommendation:'consolidate-reads'|'compatibility-projection'|'healthy';
}

const normalize=(s:string)=>String(s).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim().slice(0,240);
const similarity=(a:string,b:string)=>{
  const aa=new Set(normalize(a).split(/[^\p{L}\p{N}_-]+/u).filter(x=>x.length>2).slice(0,48));
  const bb=new Set(normalize(b).split(/[^\p{L}\p{N}_-]+/u).filter(x=>x.length>2).slice(0,48));
  if(!aa.size||!bb.size)return 0;
  let common=0;for(const t of aa)if(bb.has(t))common++;
  return common/Math.max(1,aa.size+bb.size-common);
};

export class MemorySubstrateCoordinator{
  inspect(memoryOS:MemoryOSState2,continuum:MemoryRecord[]):MemorySubstrateInspection{
    const canonical=memoryOS.items.map(x=>({id:x.id,content:normalize(x.content)})).filter(x=>x.content);
    let overlap=0,strong=0,weighted=0;
    for(const row of continuum){
      const content=normalize(`${row.summary} ${row.evidence.join(' ')}`);let best=0;
      for(const item of canonical){best=Math.max(best,item.content===content?1:similarity(content,item.content));}
      weighted+=best;if(best>=.42){overlap++;if(best>=.62)strong++;}
    }
    const semanticOverlap01=continuum.length?weighted/continuum.length:0;
    const compatibilityOnlyContinuumItems=Math.max(0,continuum.length-overlap);
    return {canonicalAuthority:'memoryOS2',memoryOSItems:memoryOS.items.length,continuumItems:continuum.length,semanticOverlap01,strongMatches:strong,compatibilityOnlyContinuumItems,recommendation:semanticOverlap01>=.55?'consolidate-reads':compatibilityOnlyContinuumItems?'compatibility-projection':'healthy'};
  }
  ingestCompatibilityRecord(memoryOS:MemoryOS2, row:MemoryRecord): MemoryItem2 {
    const kind = row.kind==='episode'?'episodic':row.kind==='pattern'?'semantic':row.kind==='self-model'?'identity':row.kind==='goal-learning'?'procedural':'episodic';
    return memoryOS.encode({
      kind,
      content: `${row.summary}${row.evidence.length ? ` | evidence: ${row.evidence.slice(-2).join(' | ')}` : ''}`.slice(0,720),
      salience: row.salience,
      emotionalWeight: 0,
      identityRelevance: kind==='identity' ? .82 : .18,
      goalRelevance: kind==='procedural' ? .72 : .18,
      socialRelevance: 0,
      predictionError: .35,
      confidence: row.confidence,
      epistemicStatus: 'belief',
      source: 'multi-timescale-compatibility',
      entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
      tags: [`timescale:${row.timescale}`, `kind:${row.kind}`],
      context: { originalId: row.id, timescale: row.timescale, legacySource: 'multi-timescale-memory' },
    });
  }
  consolidateCompatibility(memoryOS:MemoryOS2, rows:MemoryRecord[], limit=32):number {
    const seen=new Set<string>();
    const inputs:any[]=[];
    for(const row of rows.slice(0,Math.max(0,Math.min(64,Math.floor(limit))))){
      const key=`${row.kind}|${row.summary}|${row.evidence.slice(-2).join('|')}`;
      if(seen.has(key))continue;
      seen.add(key);
      inputs.push({
        kind:row.kind==='episode'?'episodic':row.kind==='pattern'?'semantic':row.kind==='self-model'?'identity':row.kind==='goal-learning'?'procedural':'episodic',
        content:`${row.summary}${row.evidence.length ? ` | evidence: ${row.evidence.slice(-2).join(' | ')}` : ''}`.slice(0,720),
        salience:row.salience,
        emotionalWeight:0,
        identityRelevance:row.kind==='self-model'?0.82:0.18,
        goalRelevance:row.kind==='goal-learning'?0.72:0.18,
        socialRelevance:0,
        predictionError:0.35,
        confidence:row.confidence,
        epistemicStatus:'belief',
        source:'multi-timescale-compatibility',
        entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],
        tags:[`timescale:${row.timescale}`,`kind:${row.kind}`],
        context:{originalId:row.id,timescale:row.timescale,legacySource:'multi-timescale-memory'},
      });
    }
    return memoryOS.reconcile(inputs).ids.length;
  }


  projectCompatibilityRecords(memoryOS: MemoryOSState2, limit = 48): MemoryRecord[] {
    const max = Math.max(1, Math.min(96, Math.floor(limit)));
    const now = Date.now();
    return memoryOS.items
      .filter(item => !item.dormant && item.epistemicStatus !== 'quarantined')
      .slice()
      .sort((a,b) => (b.salience + b.identityRelevance + b.goalRelevance) - (a.salience + a.identityRelevance + a.goalRelevance))
      .slice(0, max)
      .map((item, index) => ({
        id: item.id,
        kind: item.kind === 'episodic' ? 'episode' : item.kind === 'identity' || item.kind === 'autobiographical' ? 'self-model' : item.kind === 'procedural' ? 'goal-learning' : 'pattern',
        summary: item.content.slice(0, 360),
        salience: item.salience,
        evidence: [item.source],
        createdAt: item.createdAt || now,
        timescale: item.kind === 'semantic' ? 'semantic' : item.kind === 'identity' || item.kind === 'autobiographical' ? 'autobiographical' : item.kind === 'working' ? 'working' : 'episodic',
        retrievalCount: item.retrievalCount,
        lastRetrievedAt: item.lastAccessAt,
        confidence: item.confidence,
        sourceEventIds: (item.temporalLinks ?? []).slice(-4),
      } as MemoryRecord));
  }

  lightweightCanonicalItems(memoryOS:MemoryOSState2,limit=32):Array<Pick<MemoryItem2,'id'|'content'|'kind'|'confidence'|'epistemicStatus'>>{
    return memoryOS.items.slice(0,Math.max(1,Math.min(128,Math.floor(limit)))).map(x=>({id:x.id,content:x.content,kind:x.kind,confidence:x.confidence,epistemicStatus:x.epistemicStatus}));
  }
}
