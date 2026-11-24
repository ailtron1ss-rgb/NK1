import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const dist=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/Math.max(1,Math.max(a.length,b.length)));
const mean=(x:number[])=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;

export interface CausalRegimeNode{ id:number; centroid:number[]; visits:number; confidence01:number; novelty01:number; lastTick:number; }
export interface CausalRegimeEdge{ from:number; to:number; action:ActionKind; probability01:number; reward01:number; count:number; predictionError01:number; causalStrength01:number; }
export interface B2526State{
 version:1; enabled:boolean; tick:number; observations:number; transitions:number; regimeDiscoveries:number;
 nodes:CausalRegimeNode[]; edges:CausalRegimeEdge[]; maxNodes:number; maxEdges:number;
 currentRegime:number|null; previousRegime:number|null; regimeUncertainty01:number; transitionConfidence01:number;
 causalStrength01:number; shift01:number; multiScaleAgreement01:number; actionBias:Record<ActionKind,number>;
 fastLearning01:number; slowLearning01:number; interventions:number; usefulInterventions:number;
 lesionFraction01:number;
}
export const defaultB2526State=():B2526State=>({version:1,enabled:true,tick:0,observations:0,transitions:0,regimeDiscoveries:0,nodes:[],edges:[],maxNodes:96,maxEdges:768,currentRegime:null,previousRegime:null,regimeUncertainty01:.5,transitionConfidence01:.25,causalStrength01:.2,shift01:.5,multiScaleAgreement01:.5,actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,fastLearning01:.25,slowLearning01:.25,interventions:0,usefulInterventions:0,lesionFraction01:0});

export class B2526MultiscaleCausalRegimeGraph{
 private state=defaultB2526State(); readonly systemName='cognition:b2526-multiscale-causal-regime-graph' as const;
 snapshot(){return structuredClone(this.state)}
 restore(raw?:Partial<B2526State>|null){const d=defaultB2526State(),r:any=raw??{};this.state={...d,...structuredClone(r),nodes:Array.isArray(r.nodes)?structuredClone(r.nodes):[],edges:Array.isArray(r.edges)?structuredClone(r.edges):[],actionBias:{...d.actionBias,...(r.actionBias??{})},version:1}}
 setEnabled(v:boolean){this.state.enabled=!!v} setLesion(v:number){this.state.lesionFraction01=clamp(v)}
 private nearest(context:number[]){let best:CausalRegimeNode|undefined,bd=Infinity;for(const n of this.state.nodes){const d=dist(context,n.centroid);if(d<bd){bd=d;best=n}}return {node:best,d:bd}}
 beforeDecision(i:{tick:number;context:number[];baseUtilities:Record<ActionKind,number>;uncertainty01:number;novelty01:number;predictionError01:number;computeBudget01:number}){
  const zero=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>; if(!this.state.enabled)return {actionBias:zero,regimeUncertainty01:this.state.regimeUncertainty01,shift01:this.state.shift01,currentRegime:this.state.currentRegime};
  this.state.tick=i.tick;this.state.observations++;const context=i.context.slice(0,24);const n=this.nearest(context);const shift=clamp(n.d*.9+i.novelty01*.1);
  this.state.shift01=clamp(this.state.shift01*.86+shift*.14);this.state.regimeUncertainty01=clamp(this.state.regimeUncertainty01*.88+(n.node?Math.min(1,n.d*2):1)*.12);
  if(!n.node||n.d>.30){const id=(this.state.nodes.at(-1)?.id??0)+1;this.state.nodes.push({id,centroid:context.slice(),visits:1,confidence01:.35,novelty01:shift,lastTick:i.tick});this.state.currentRegime=id;this.state.regimeDiscoveries++;}
  else {this.state.previousRegime=this.state.currentRegime;this.state.currentRegime=n.node.id;n.node.centroid=n.node.centroid.map((v,k)=>v*.92+(context[k]??0)*.08);n.node.visits++;n.node.confidence01=clamp(n.node.confidence01*.94+(1-shift)*.06);n.node.novelty01=clamp(n.node.novelty01*.9+shift*.1);n.node.lastTick=i.tick;}
  if(this.state.nodes.length>this.state.maxNodes)this.state.nodes.splice(0,this.state.nodes.length-this.state.maxNodes);
  const bias=zero; for(const a of ACTIONS){const rows=this.state.edges.filter(e=>e.from===this.state.currentRegime&&e.action===a).sort((x,y)=>y.count-x.count).slice(0,8);if(rows.length){const z=mean(rows.map(e=>e.probability01));const q=mean(rows.map(e=>e.reward01));const c=mean(rows.map(e=>e.causalStrength01));bias[a]=clamp((z*.10+q*.10+c*.06-i.uncertainty01*.015)*.35*(1-this.state.lesionFraction01),-.055,.055)}}
  const intervention=(this.state.shift01>.58||this.state.regimeUncertainty01>.65||i.predictionError01>.62)&&i.computeBudget01>.25;if(intervention)this.state.interventions++;
  if(intervention){bias.explore+=.010*(1-this.state.lesionFraction01);bias.verify+=.008*(1-this.state.lesionFraction01)}
  this.state.actionBias=bias;this.state.multiScaleAgreement01=clamp(this.state.fastLearning01*.55+this.state.slowLearning01*.45);
  return {actionBias:{...bias},regimeUncertainty01:this.state.regimeUncertainty01,shift01:this.state.shift01,currentRegime:this.state.currentRegime,intervention};
 }
 afterOutcome(i:{tick:number;preContext:number[];postContext:number[];action:ActionKind;reward01:number;predictionError01:number;intervention?:boolean}){
  if(!this.state.enabled)return;const pre=this.nearest(i.preContext.slice(0,24)).node;const post=this.nearest(i.postContext.slice(0,24)).node;if(!pre||!post)return;
  const key=this.state.edges.find(e=>e.from===pre.id&&e.to===post.id&&e.action===i.action);const success=i.reward01>=.5?1:0; if(key){const lr=.10/(1+key.count*.01);key.probability01=clamp(key.probability01*(1-lr)+1*lr);key.reward01=clamp(key.reward01*(1-lr)+i.reward01*lr);key.predictionError01=clamp(key.predictionError01*(1-lr)+i.predictionError01*lr);key.causalStrength01=clamp(key.causalStrength01*(1-lr)+Math.abs(i.reward01-.5)*2*lr);key.count++}else this.state.edges.push({from:pre.id,to:post.id,action:i.action,probability01:.55,reward01:clamp(i.reward01),count:1,predictionError01:clamp(i.predictionError01),causalStrength01:clamp(Math.abs(i.reward01-.5)*2)});
  if(this.state.edges.length>this.state.maxEdges)this.state.edges.splice(0,this.state.edges.length-this.state.maxEdges);
  this.state.transitions++;this.state.fastLearning01=clamp(this.state.fastLearning01*.95+(1-i.predictionError01)*.05);this.state.slowLearning01=clamp(this.state.slowLearning01*.995+(1-i.predictionError01)*.005);this.state.transitionConfidence01=clamp(this.state.transitionConfidence01*.93+(1-i.predictionError01)*.07);this.state.causalStrength01=clamp(this.state.causalStrength01*.94+Math.abs(i.reward01-.5)*2*.06);if(i.intervention&&i.predictionError01<.4)this.state.usefulInterventions++;
 }
 metrics(){return {nodes:this.state.nodes.length,edges:this.state.edges.length,observations:this.state.observations,transitions:this.state.transitions,regimeDiscoveries:this.state.regimeDiscoveries,currentRegime:this.state.currentRegime,regimeUncertainty01:this.state.regimeUncertainty01,transitionConfidence01:this.state.transitionConfidence01,causalStrength01:this.state.causalStrength01,shift01:this.state.shift01,multiScaleAgreement01:this.state.multiScaleAgreement01,interventions:this.state.interventions,usefulInterventions:this.state.usefulInterventions,actionBias:{...this.state.actionBias}}}
}
