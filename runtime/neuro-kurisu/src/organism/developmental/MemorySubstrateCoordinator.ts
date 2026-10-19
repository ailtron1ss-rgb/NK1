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
const tokens=(s:string)=>new Set(normalize(s).split(/[^\p{L}\p{N}_-]+/u).filter(x=>x.length>2).slice(0,48));
const similarityFromTokens=(a:Set<string>,b:Set<string>)=>{
  if(!a.size||!b.size)return 0;
  let common=0;for(const token of a)if(b.has(token))common++;
  return common/Math.max(1,a.size+b.size-common);
};

export class MemorySubstrateCoordinator{
  inspect(memoryOS:MemoryOSState2,continuum:MemoryRecord[]):MemorySubstrateInspection{
    const canonical=memoryOS.items.map(x=>({id:x.id,content:normalize(x.content)})).filter(x=>x.content).map(x=>({...x,terms:tokens(x.content)}));
    // Build a lightweight inverted index once. The previous all-pairs comparison
    // tokenized every pair (O(continuum × canonical × text)); this narrows each
    // candidate set to shared terms while preserving the same Jaccard score.
    const byTerm=new Map<string,number[]>();
    const exactByContent=new Map<string,number[]>();
    canonical.forEach((item,index)=>{
      const exact=exactByContent.get(item.content)??[];exact.push(index);exactByContent.set(item.content,exact);
      for(const term of item.terms){const posting=byTerm.get(term)??[];posting.push(index);byTerm.set(term,posting);}
    });
    let overlap=0,strong=0,weighted=0;
    for(const row of continuum){
      const content=normalize(`${row.summary} ${row.evidence.join(' ')}`);
      let best=exactByContent.has(content)?1:0;
      if(best<1){
        const queryTerms=tokens(content);
        const candidateIndexes=new Set<number>();
        for(const term of queryTerms)for(const index of byTerm.get(term)??[])candidateIndexes.add(index);
        for(const index of candidateIndexes){
          best=Math.max(best,similarityFromTokens(queryTerms,canonical[index]!.terms));
          if(best===1)break;
        }
      }
      weighted+=best;if(best>=.42){overlap++;if(best>=.62)strong++;}
    }
    const semanticOverlap01=continuum.length?weighted/continuum.length:0;
    const compatibilityOnlyContinuumItems=Math.max(0,continuum.length-overlap);
    return {canonicalAuthority:'memoryOS2',memoryOSItems:memoryOS.items.length,continuumItems:continuum.length,semanticOverlap01,strongMatches:strong,compatibilityOnlyContinuumItems,recommendation:semanticOverlap01>=.55?'consolidate-reads':compatibilityOnlyContinuumItems?'compatibility-projection':'healthy'};
  }
  compatibilityInput(row:MemoryRecord):Parameters<MemoryOS2['encode']>[0] {
    const kind = row.kind==='episode'?'episodic':row.kind==='pattern'?'semantic':row.kind==='self-model'?'identity':row.kind==='goal-learning'?'procedural':'episodic';
    const observedAt=Number.isFinite(Number(row.lastRetrievedAt))&&Number(row.lastRetrievedAt)>0?Number(row.lastRetrievedAt):Number(row.createdAt)||Date.now();
    const sourceEventIds=[...new Set((Array.isArray(row.sourceEventIds)?row.sourceEventIds:[]).map(String).filter(Boolean))].slice(-12);
    const associationIds=[...new Set((Array.isArray(row.associationIds)?row.associationIds:[]).map(String).filter(Boolean))].slice(-12);
    const independenceKey=`multi-timescale:${String(row.id).slice(0,72)}`;
    return {
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
      source: 'multi-timescale-compatibility', provenanceClass:'derived', sourceAuthority01:.52, independenceKey, observedAt, evidenceFreshnessAt:observedAt,
      evidenceSources:[{source:'multi-timescale-compatibility',provenanceClass:'derived',sourceAuthority01:.52,independenceKey,observedAt,evidenceFreshnessAt:observedAt}],
      // Legacy IDs are preserved in context, not injected as live links: MemoryOS2
      // rebuilds semantic/temporal graph edges against canonical IDs during encode.
      entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
      tags: [`timescale:${row.timescale}`, `kind:${row.kind}`],
      context: { originalId: row.id, timescale: row.timescale, legacySource: 'multi-timescale-memory', legacyAssociationIds:associationIds.join(','), legacySourceEventIds:sourceEventIds.join(',') },
    };
  }

  compatibilityInputs(rows:MemoryRecord[],limit=32):Array<Parameters<MemoryOS2['encode']>[0]> {
    const seen=new Set<string>();
    const inputs:Array<Parameters<MemoryOS2['encode']>[0]>=[];
    for(const row of rows.slice(0,Math.max(0,Math.min(64,Math.floor(limit))))){
      const key=`${row.kind}|${row.summary}|${row.evidence.slice(-2).join('|')}`;
      if(seen.has(key))continue;
      seen.add(key);
      inputs.push(this.compatibilityInput(row));
    }
    return inputs;
  }

  /** Legacy adapter only; production restore and ingest are routed through MemoryFabric. */
  ingestCompatibilityRecord(memoryOS:MemoryOS2, row:MemoryRecord): MemoryItem2 {
    return memoryOS.encode(this.compatibilityInput(row));
  }

  consolidateCompatibility(memoryOS:MemoryOS2, rows:MemoryRecord[], limit=32):number {
    return memoryOS.reconcile(this.compatibilityInputs(rows,limit)).ids.length;
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
        sourceEventIds:[...new Set([...(item.temporalLinks??[]),...(String(item.context?.legacySourceEventIds??'').split(',').filter(Boolean))])].slice(-12),
        associationIds:[...new Set([...(item.semanticLinks??[]),...(String(item.context?.legacyAssociationIds??'').split(',').filter(Boolean))])].slice(-12),
      } as MemoryRecord));
  }

  lightweightCanonicalItems(memoryOS:MemoryOSState2,limit=32):Array<Pick<MemoryItem2,'id'|'content'|'kind'|'confidence'|'epistemicStatus'>>{
    return memoryOS.items.slice(0,Math.max(1,Math.min(128,Math.floor(limit)))).map(x=>({id:x.id,content:x.content,kind:x.kind,confidence:x.confidence,epistemicStatus:x.epistemicStatus}));
  }
}
