/** BIG PASS 239 — compiler between continuous neural traces and symbolic concepts. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface ConceptPrototype{label:string;centroid:number[];confidence01:number;uses:number;success01:number;}
export interface NeuroSymbolicCompilerState{version:1;cycles:number;compiled:number;concepts:Record<string,ConceptPrototype>;mappingCoherence01:number;lastConcept:string;}
export const defaultNeuroSymbolicCompiler=():NeuroSymbolicCompilerState=>({version:1,cycles:0,compiled:0,concepts:{},mappingCoherence01:.5,lastConcept:'none'});
function cosine(a:number[],b:number[]){const n=Math.min(a.length,b.length);let d=0,aa=0,bb=0;for(let i=0;i<n;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?clamp((d/Math.sqrt(aa*bb)+1)/2):0;}
export class NeuroSymbolicConceptCompiler{
 private state=defaultNeuroSymbolicCompiler();restore(raw?:Partial<NeuroSymbolicCompilerState>|null){const d=defaultNeuroSymbolicCompiler(),r=raw??{};this.state={...d,...r,concepts:{...d.concepts,...(r.concepts??{})},version:1};}snapshot(){return structuredClone(this.state);}
 compile(input:{label:string;latent:number[];outcome01:number;novelty01:number}){const label=input.label||'unknown',latent=input.latent.map(clamp).slice(0,16),existing=Object.values(this.state.concepts);let best:ConceptPrototype|undefined,bestSim=0;for(const c of existing){const sim=cosine(latent,c.centroid);if(sim>bestSim){bestSim=sim;best=c;}}if(!best||bestSim<.76){best={label,centroid:latent,confidence01:.35,uses:0,success01:.5};this.state.concepts[label]=best;this.state.compiled++;}else{best.centroid=best.centroid.map((v,i)=>clamp(v*.86+(latent[i]??v)*.14));}
best.uses++;best.success01=clamp(best.success01*.9+clamp(input.outcome01)*.1);best.confidence01=clamp(best.confidence01*.9+(bestSim||.55)*.1);this.state.cycles++;this.state.lastConcept=best.label;this.state.mappingCoherence01=clamp(this.state.mappingCoherence01*.88+(bestSim||.55)*.12);return{label:best.label,similarity01:bestSim,confidence01:best.confidence01,isNew:existing.indexOf(best)<0};}
 summary(){return{cycles:this.state.cycles,compiled:this.state.compiled,concepts:Object.keys(this.state.concepts).length,mappingCoherence01:this.state.mappingCoherence01,lastConcept:this.state.lastConcept};}
}
