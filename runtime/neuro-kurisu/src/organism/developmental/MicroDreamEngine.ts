export interface MicroDream{
  id:string;
  at:number;
  question:string;
  simulation:string;
  confidence:number;
  kind?:'question'|'association';
  sourceMemoryIds?:string[];
  sharedTerms?:string[];
  /** Association dreams remain hypotheses until a separate evidence-gated promotion step. */
  validationStatus?:'candidate'|'validated'|'rejected';
}
export interface MicroDreamState{
  dreams:MicroDream[];
  cycles:number;
  version:number;
  associationCandidates:number;
  deduplicatedAssociations:number;
  lastAssociativeSweepAt:number;
}
export interface DreamMemoryInput {
  id:string;
  content:string;
  confidence01?:number;
  salience01?:number;
  semanticLinks?:string[];
  entities?:string[];
}
export interface MicroDreamEvidence {
  predictionConfidence01?:number;
  uncertainty01?:number;
  memoryEvidence01?:number;
  novelty01?:number;
  at?:number;
}
export const defaultMicroDream=():MicroDreamState=>({
  dreams:[],cycles:0,version:2,associationCandidates:0,deduplicatedAssociations:0,lastAssociativeSweepAt:0
});
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const stableScore=(text:string)=>{let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/0xffffffff;};
const STOPWORDS=new Set([
  'about','after','again','also','and','are','been','before','between','but','can','could','does','each','for','from','have','into','just','more','most','not','only','other','our','out','over','same','some','such','than','that','their','them','there','these','they','this','those','through','under','very','was','were','what','when','where','which','while','with','would',
  'без','более','был','была','были','быть','весь','вот','для','если','есть','еще','ещё','или','как','когда','который','между','может','можно','мне','много','над','нам','нас','него','нее','неё','них','но','об','один','она','они','оно','они','при','про','сам','себя','так','также','там','тем','то','только','того','тоже','уже','что','чтобы','эта','это','эти','этот'
]);
const tokens=(text:string):string[]=>[...new Set(String(text??'').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu)??[])].filter(token=>!STOPWORDS.has(token));
export class MicroDreamEngine{
  private state=defaultMicroDream();
  restore(s:MicroDreamState|undefined){
    const d=defaultMicroDream(),r:any=s??{};
    this.state={
      ...d,...r,version:2,
      dreams:Array.isArray(r.dreams)?r.dreams.slice(0,64).map((dream:any)=>({
        ...dream,
        kind:dream?.kind==='association'?'association':'question',
        sourceMemoryIds:Array.isArray(dream?.sourceMemoryIds)?dream.sourceMemoryIds.filter((x:any)=>typeof x==='string').slice(0,2):[],
        sharedTerms:Array.isArray(dream?.sharedTerms)?dream.sharedTerms.filter((x:any)=>typeof x==='string').slice(0,8):[],
        validationStatus:['candidate','validated','rejected'].includes(dream?.validationStatus)?dream.validationStatus:'candidate',
      })):[],
      associationCandidates:Math.max(0,Math.floor(Number(r.associationCandidates)||0)),
      deduplicatedAssociations:Math.max(0,Math.floor(Number(r.deduplicatedAssociations)||0)),
      lastAssociativeSweepAt:Math.max(0,Number(r.lastAssociativeSweepAt)||0),
    };
  }
  snapshot(){return structuredClone(this.state);}
  simulate(questions:string[],seed:string,evidence:MicroDreamEvidence={}){
    const q=questions.find(Boolean);if(!q)return null;
    const at=Number.isFinite(evidence.at)?Math.max(0,Number(evidence.at)):Date.now();
    const predictionConfidence=clamp01(evidence.predictionConfidence01??.25), uncertainty=clamp01(evidence.uncertainty01??.5), memoryEvidence=clamp01(evidence.memoryEvidence01??.2), novelty=clamp01(evidence.novelty01??.3);
    const noveltyScore=stableScore(`${seed}|${q}`);
    const confidence=clamp01(.12 + predictionConfidence*.42 + (1-uncertainty)*.24 + memoryEvidence*.14 + novelty*.06 + noveltyScore*.02);
    const dream:MicroDream={id:`dream-${Math.floor(at)}-${Math.floor(noveltyScore*1e6)}`,at,question:q,simulation:`counterfactual:${seed}:${q.slice(0,80)}`,confidence,kind:'question',validationStatus:'candidate'};
    this.state.dreams=[dream,...this.state.dreams.filter(d=>d.id!==dream.id)].slice(0,64);
    this.state.cycles++;
    return structuredClone(dream);
  }
  /**
   * HYVE-inspired dreaming pass: look for bounded, explainable bridges between memories.
   * Only creates candidate hypotheses. It never writes links back into canonical memory.
   */
  dreamAssociations(memories:DreamMemoryInput[],seed:string,evidence:MicroDreamEvidence={}){
    const at=Number.isFinite(evidence.at)?Math.max(0,Number(evidence.at)):Date.now();
    const bounded=(Array.isArray(memories)?memories:[]).slice(0,24).filter(m=>m&&typeof m.id==='string'&&m.id.trim()&&typeof m.content==='string'&&m.content.trim());
    const corpus=bounded.map(m=>({m,terms:tokens([m.content,...(Array.isArray(m.entities)?m.entities:[])].join(' '))}));
    const df=new Map<string,number>();
    for(const row of corpus)for(const term of row.terms)df.set(term,(df.get(term)??0)+1);
    const candidates:Array<{a:typeof corpus[number];b:typeof corpus[number];terms:string[];score:number;distinctness:number}>=[];
    for(let i=0;i<corpus.length;i++){
      const a=corpus[i]!;
      for(let j=i+1;j<corpus.length;j++){
        const b=corpus[j]!;
        if(a.m.id===b.m.id)continue;
        if((a.m.semanticLinks??[]).includes(b.m.id)||(b.m.semanticLinks??[]).includes(a.m.id))continue;
        const common=a.terms.filter(term=>b.terms.includes(term)).sort((x,y)=>x.localeCompare(y));
        if(common.length<2)continue;
        const union=new Set([...a.terms,...b.terms]);
        const jaccard=common.length/Math.max(1,union.size);
        if(jaccard>.62)continue;
        const weighted=common.reduce((sum,term)=>sum+Math.log(1+(corpus.length+1)/(1+(df.get(term)??1))),0);
        const distinctness=clamp01(1-jaccard);
        const quality=clamp01(.45*(clamp01(a.m.confidence01??.5)+clamp01(b.m.confidence01??.5))*.5+.20*(clamp01(a.m.salience01??.5)+clamp01(b.m.salience01??.5))*.5+.20*distinctness+.15*clamp01(weighted/6));
        candidates.push({a,b,terms:common.slice(0,8),score:quality*weighted*distinctness,distinctness});
      }
    }
    candidates.sort((x,y)=>y.score-x.score||x.a.m.id.localeCompare(y.a.m.id)||x.b.m.id.localeCompare(y.b.m.id));
    const generated:MicroDream[]=[];
    let deduplicated=0;
    const cooldownMs=6*60*60*1000;
    for(const candidate of candidates){
      if(generated.length>=3)break;
      const ids=[candidate.a.m.id,candidate.b.m.id].sort((x,y)=>x.localeCompare(y));
      const existing=this.state.dreams.find(d=>d.kind==='association'&&Array.isArray(d.sourceMemoryIds)&&d.sourceMemoryIds.length===2&&[...d.sourceMemoryIds].sort((x,y)=>x.localeCompare(y)).join('\u0000')===ids.join('\u0000'));
      if(existing&&Math.abs(at-existing.at)<cooldownMs){deduplicated++;continue;}
      const averageConfidence=(clamp01(candidate.a.m.confidence01??.5)+clamp01(candidate.b.m.confidence01??.5))*.5;
      const grounding=clamp01(evidence.memoryEvidence01??.2),uncertainty=clamp01(evidence.uncertainty01??.5),novelty=clamp01(evidence.novelty01??.3);
      const confidence=clamp01(.10+.22*averageConfidence+.18*grounding+.12*uncertainty+.14*novelty+.14*candidate.distinctness+.10*clamp01(candidate.score));
      const key=ids.join('\u0000');
      const identity=Math.floor(stableScore(`${seed}|association|${key}`)*1e9);
      const left=candidate.a.m.content.trim().slice(0,96),right=candidate.b.m.content.trim().slice(0,96);
      generated.push({
        id:`dream-association-${identity}`,at,
        question:`Could these memory strands be related: ${left} ↔ ${right}?`,
        simulation:`association-hypothesis:${ids[0]}<->${ids[1]};shared=${candidate.terms.join(',')}`,
        confidence,kind:'association',sourceMemoryIds:ids,sharedTerms:candidate.terms,validationStatus:'candidate',
      });
    }
    this.state.cycles++;
    this.state.associationCandidates+=generated.length;
    this.state.deduplicatedAssociations+=deduplicated;
    this.state.lastAssociativeSweepAt=at;
    if(generated.length)this.state.dreams=[...generated,...this.state.dreams.filter(d=>!generated.some(g=>g.id===d.id))].slice(0,64);
    return {generated:generated.length,deduplicated,candidates:generated.map(d=>structuredClone(d)),consideredMemories:corpus.length};
  }
  diagnostics(){
    return {dreams:this.state.dreams.length,cycles:this.state.cycles,associationCandidates:this.state.associationCandidates,deduplicatedAssociations:this.state.deduplicatedAssociations,lastAssociativeSweepAt:this.state.lastAssociativeSweepAt,unvalidatedAssociations:this.state.dreams.filter(d=>d.kind==='association'&&d.validationStatus==='candidate').length};
  }
}
