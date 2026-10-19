const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const cosine=(a:number[],b:number[])=>{let d=0,na=0,nb=0;for(let i=0;i<Math.min(a.length,b.length);i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return na&&nb?clamp((d/Math.sqrt(na*nb)+1)/2):0;};

export interface NeuralMemoryEpisode {
 id:string; tick:number; context:number[]; action:string|null; reward01:number; predictionError01:number; verified01:number; novelty01:number; salience01:number; recalled:number;
 source:string; sequenceKey:string|null; predecessorId:string|null; reconsolidationCount:number; protected01:number; lastRecalledTick:number;
}
export interface NeuralMemorySemantic { prototype:number[]; support:number; stability01:number; lastTick:number; sourceKinds:string[];}
export interface NeuralMemoryContinuityState {
 version:2; episodes:NeuralMemoryEpisode[]; semantic:NeuralMemorySemantic[]; encodings:number; recalls:number; consolidations:number; interference01:number; retention01:number; lastRecall01:number;
 sequenceHits:number; reconsolidations:number; controlledForgetting:number; falseMemoryRejections:number; causalLinks:number;
}
export const defaultNeuralMemoryContinuity=():NeuralMemoryContinuityState=>({version:2,episodes:[],semantic:[],encodings:0,recalls:0,consolidations:0,interference01:0,retention01:.5,lastRecall01:0,sequenceHits:0,reconsolidations:0,controlledForgetting:0,falseMemoryRejections:0,causalLinks:0});

/** P2844: fast episodic memory + slow semantic consolidation + sequence/provenance/reconsolidation/forgetting controls. */
export class NeuralMemoryContinuityCore{
 private state=defaultNeuralMemoryContinuity();
 restore(raw?:Partial<NeuralMemoryContinuityState>|null){
  const d=defaultNeuralMemoryContinuity(),r:any=raw??{};
  this.state={...d,...r,version:2,
   episodes:Array.isArray(r.episodes)?r.episodes.slice(-192).map((e:any)=>({...e,context:Array.isArray(e.context)?e.context.slice(0,24):[],source:String(e.source??'runtime'),sequenceKey:e.sequenceKey==null?null:String(e.sequenceKey),predecessorId:e.predecessorId==null?null:String(e.predecessorId),reconsolidationCount:Number(e.reconsolidationCount??0),protected01:clamp(Number(e.protected01??0)),lastRecalledTick:Number(e.lastRecalledTick??0)})):[],
   semantic:Array.isArray(r.semantic)?r.semantic.slice(-24).map((s:any)=>({...s,prototype:Array.isArray(s.prototype)?s.prototype.slice(0,24):[],support:Number(s.support??0),stability01:clamp(Number(s.stability01??.5)),lastTick:Number(s.lastTick??0),sourceKinds:Array.isArray(s.sourceKinds)?s.sourceKinds.slice(0,8).map(String):[]})):[]
  };
 }
 snapshot(){return structuredClone(this.state);}
 encode(input:{tick:number;context:number[];action?:string|null;reward01:number;predictionError01:number;verified01:number;novelty01:number;source?:string;sequenceKey?:string|null;predecessorId?:string|null;protected01?:number}){
  const context=input.context.slice(0,24).map(x=>clamp(Number(x))); const salience=clamp(.24*input.novelty01+.28*input.predictionError01+.30*input.verified01+.18*Math.abs(input.reward01-.5));
  const predecessor=input.predecessorId??null; if(predecessor&&this.state.episodes.some(e=>e.id===predecessor))this.state.causalLinks++;
  const ep:NeuralMemoryEpisode={id:`nmc:${input.tick}:${this.state.encodings+1}`,tick:input.tick,context,action:input.action??null,reward01:clamp(input.reward01),predictionError01:clamp(input.predictionError01),verified01:clamp(input.verified01),novelty01:clamp(input.novelty01),salience01:salience,recalled:0,source:String(input.source??'runtime'),sequenceKey:input.sequenceKey??null,predecessorId:predecessor,reconsolidationCount:0,protected01:clamp(input.protected01??(input.verified01*.55+input.novelty01*.15)),lastRecalledTick:0};
  this.state.episodes.unshift(ep);this.state.episodes=this.state.episodes.slice(0,192);this.state.encodings++;
  return {id:ep.id,salience01:salience,episodeDepth:this.state.episodes.length};
 }
 recall(context:number[],limit=4,tick=0){
  const q=context.slice(0,24).map(x=>clamp(Number(x))); const rows=this.state.episodes.map(ep=>({ep,score:cosine(ep.context,q)*.52+ep.salience01*.20+ep.verified01*.14+ep.protected01*.08+Math.min(.06,ep.recalled*.007)})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit));
  for(const r of rows){r.ep.recalled++;r.ep.lastRecalledTick=tick; if(r.score>.72){r.ep.reconsolidationCount++;r.ep.salience01=clamp(r.ep.salience01*.90+.10*r.score);r.ep.protected01=clamp(r.ep.protected01*.92+.08*r.score);this.state.reconsolidations++;}}
  const gain=rows.length?rows.reduce((s,r)=>s+r.score,0)/rows.length:0; this.state.recalls++;this.state.lastRecall01=gain;this.state.retention01=clamp(this.state.retention01*.95+gain*.05);return rows.map(r=>({...r.ep,score01:r.score}));
 }
 semanticRecall(context:number[],limit=4){ const q=context.slice(0,24).map(x=>clamp(Number(x))); return this.state.semantic.map((s,i)=>({s,score:cosine(s.prototype,q)*.72+s.stability01*.18+Math.min(.10,s.support*.01),i})).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit)).map(r=>({prototype:r.s.prototype.slice(),score01:r.score,support:r.s.support,stability01:r.s.stability01})); }
 sequenceRecall(sequenceKey:string,limit=8){
  const rows=this.state.episodes.filter(e=>e.sequenceKey===sequenceKey).sort((a,b)=>a.tick-b.tick).slice(-Math.max(1,limit));
  let hits=0;for(let i=1;i<rows.length;i++)if(rows[i]!.predecessorId===rows[i-1]!.id)hits++;this.state.sequenceHits+=hits;return {episodes:rows.map(e=>structuredClone(e)),order01:rows.length<2?1:hits/Math.max(1,rows.length-1)};
 }
 consolidate(tick:number,quota01=.5){
  const q=clamp(quota01),candidates=this.state.episodes.filter(e=>e.verified01>=.65&&e.salience01>=.35).sort((a,b)=>(b.salience01+b.protected01)-(a.salience01+a.protected01)).slice(0,48);let promoted=0;
  for(const ep of candidates){const nearest=this.state.semantic.map((s,i)=>({i,sim:cosine(s.prototype,ep.context)})).sort((a,b)=>b.sim-a.sim)[0];
   if(nearest&&nearest.sim>.72){const s=this.state.semantic[nearest.i]!;const w=clamp(.04+q*.12);s.prototype=s.prototype.map((v,i)=>v*(1-w)+(ep.context[i]??0)*w);s.support++;s.stability01=clamp(s.stability01*.94+.06*ep.verified01);s.lastTick=tick;if(!s.sourceKinds.includes(ep.source))s.sourceKinds=[...s.sourceKinds,ep.source].slice(-8);
   } else if(this.state.semantic.length<24){this.state.semantic.push({prototype:ep.context.slice(),support:1,stability01:ep.verified01,lastTick:tick,sourceKinds:[ep.source]});}
   else {this.state.falseMemoryRejections++;continue;}
   promoted++;
  }
  this.state.consolidations+=promoted;this.state.interference01=clamp(this.state.episodes.slice(0,32).reduce((s,e)=>s+Math.max(0,e.recalled-2),0)/Math.max(1,this.state.episodes.slice(0,32).length*8));return {promoted,semanticDepth:this.state.semantic.length,interference01:this.state.interference01};
 }
 forget(nowTick:number,olderThanTicks=256,minimumQuality01=.24){
  const before=this.state.episodes.length;this.state.episodes=this.state.episodes.filter(e=>e.protected01>=.78||e.verified01>=.55||e.salience01>=minimumQuality01||nowTick-e.tick<=olderThanTicks);const removed=before-this.state.episodes.length;this.state.controlledForgetting+=removed;this.state.retention01=clamp(this.state.retention01*.98+(this.state.episodes.length/192)*.02);return {removed,remaining:this.state.episodes.length};
 }
 diagnostics(){return {version:2,encodings:this.state.encodings,recalls:this.state.recalls,consolidations:this.state.consolidations,episodeDepth:this.state.episodes.length,semanticDepth:this.state.semantic.length,retention01:this.state.retention01,interference01:this.state.interference01,lastRecall01:this.state.lastRecall01,sequenceHits:this.state.sequenceHits,reconsolidations:this.state.reconsolidations,controlledForgetting:this.state.controlledForgetting,falseMemoryRejections:this.state.falseMemoryRejections,causalLinks:this.state.causalLinks};}
}
