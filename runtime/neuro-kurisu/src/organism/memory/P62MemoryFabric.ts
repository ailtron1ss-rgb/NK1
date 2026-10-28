/**
 * P62 — Memory Fabric.
 *
 * A read-side unifier for the existing memory stores. It intentionally does
 * not create another durable memory database: it merges evidence from the
 * canonical stores, deduplicates it, detects source conflicts and returns a
 * bounded recall packet for the current cognitive moment.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P62SourceItem {id:string;content:string;kind:string;confidence01:number;salience01:number;source:string;status?:string;}
export interface P62BeliefItem {id:string;claim:string;confidence:number;status:string;evidence:string[];contradictions:string[];}
export interface P62Input {query:string;memoryOS:P62SourceItem[];multiTimescale:P62SourceItem[];semanticNodes:Array<{id:string;label:string;type:string;salience:number}>;beliefs:P62BeliefItem[];maxItems?:number;}
export interface P62Hit {id:string;content:string;kind:string;source:string;confidence01:number;relevance01:number;support01:number;conflict01:number;provenance:string[];}
export interface P62Frame {query:string;hits:P62Hit[];sourcesUsed:string[];sourceDiversity01:number;semanticCoverage01:number;conflictPressure01:number;redundancy01:number;retrievalQuality01:number;at:number;}
export interface P62State {version:1;queries:number;hits:number;conflictEvents:number;meanQuality01:number;meanCoverage01:number;meanConflict01:number;lastFrame:P62Frame|null;history:P62Frame[];}
export const defaultP62=():P62State=>({version:1,queries:0,hits:0,conflictEvents:0,meanQuality01:.5,meanCoverage01:.3,meanConflict01:.15,lastFrame:null,history:[]});
const tokenise=(s:string)=>new Set((s.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu)??[]).slice(0,64));
function sim(a:Set<string>,b:Set<string>){if(!a.size||!b.size)return 0;let h=0;for(const x of b)if(a.has(x))h++;return h/Math.max(1,new Set([...a,...b]).size);}
export class P62MemoryFabric{
 private state=defaultP62();
 restore(raw?:Partial<P62State>|null){const d=defaultP62(),r=raw??{};this.state={...d,...r,history:Array.isArray(r.history)?r.history.slice(-16):[]};}
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){
  return {
   ...this.state,
   lastFrame:this.state.lastFrame ? structuredClone(this.state.lastFrame) : null,
   history:this.state.history.slice(0,8).map(frame=>structuredClone(frame)),
  };
 }
 recall(input:P62Input):P62Frame{
   const query=String(input.query??'').slice(0,220),q=tokenise(query),rows=new Map<string,P62Hit>();
   const add=(item:P62SourceItem,weight:number)=>{const relevance=clamp(sim(q,tokenise(item.content))*.68+item.salience01*.2+item.confidence01*.12)*weight; if(relevance<.035)return; const existing=rows.get(item.id); if(existing){existing.relevance01=clamp(Math.max(existing.relevance01,relevance)+.04);existing.provenance=[...new Set([...existing.provenance,item.source])].slice(0,6);existing.support01=clamp(existing.support01*.72+item.confidence01*.28);} else rows.set(item.id,{id:item.id,content:item.content.slice(0,240),kind:item.kind,source:item.source,confidence01:clamp(item.confidence01),relevance01:relevance,support01:clamp(item.confidence01),conflict01:0,provenance:[item.source]});};
   input.memoryOS.slice(0,64).forEach(x=>add(x,.34)); input.multiTimescale.slice(0,64).forEach(x=>add(x,.27)); input.semanticNodes.slice(0,64).forEach(x=>add({id:`semantic:${x.id}`,content:x.label,kind:x.type,confidence01:.62,salience01:x.salience,source:'semantic-graph'},.2)); input.beliefs.slice(0,64).forEach(b=>add({id:`belief:${b.id}`,content:b.claim,kind:'belief',confidence01:b.confidence,salience01:.66,source:'belief-store'},.32));
   const claims=input.beliefs.filter(b=>b.contradictions.length||b.status==='contradicted');
   const hits=[...rows.values()].sort((a,b)=>b.relevance01-a.relevance01 || b.support01-a.support01 || a.id.localeCompare(b.id)).slice(0,Math.max(1,Math.min(12,input.maxItems??8)));
   for(const h of hits){const matching=claims.some(c=>tokenOverlap(c.claim,h.content)>.42);if(matching)h.conflict01=.68;}
   const sources=new Set(hits.flatMap(h=>h.provenance)); const coverage=clamp(hits.reduce((s,h)=>s+h.relevance01,0)/Math.max(1,hits.length)); const redundancy=clamp(hits.length<=1?0:hits.reduce((s,h,i)=>s+(hits.slice(0,i).some(p=>tokenOverlap(p.content,h.content)>.72)?1:0),0)/Math.max(1,hits.length)); const conflict=clamp(hits.reduce((s,h)=>s+h.conflict01,0)/Math.max(1,hits.length)); const diversity=clamp(sources.size/4); const quality=clamp(coverage*.42+diversity*.16+(1-redundancy)*.16+(1-conflict)*.16+Math.min(1,hits.length/8)*.1);
   const frame:P62Frame={query,hits,sourcesUsed:[...sources],sourceDiversity01:diversity,semanticCoverage01:coverage,conflictPressure01:conflict,redundancy01:redundancy,retrievalQuality01:quality,at:Date.now()}; this.state.queries++;this.state.hits+=hits.length; if(conflict>.25)this.state.conflictEvents++;this.state.meanQuality01=clamp(this.state.meanQuality01*.94+quality*.06);this.state.meanCoverage01=clamp(this.state.meanCoverage01*.94+coverage*.06);this.state.meanConflict01=clamp(this.state.meanConflict01*.94+conflict*.06);this.state.lastFrame=frame;this.state.history=[frame,...this.state.history].slice(0,16); return structuredClone(frame);
 }
 summary(){return {queries:this.state.queries,hits:this.state.hits,conflictEvents:this.state.conflictEvents,meanQuality01:this.state.meanQuality01,meanCoverage01:this.state.meanCoverage01,meanConflict01:this.state.meanConflict01};}
}
function tokenOverlap(a:string,b:string){return sim(tokenise(a),tokenise(b));}
