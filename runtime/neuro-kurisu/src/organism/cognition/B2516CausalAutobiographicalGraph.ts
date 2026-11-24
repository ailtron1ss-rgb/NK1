import type { ActionKind } from '../core/types.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const sig=(v:number[])=>v.slice(0,8).map(x=>Math.round(clamp((Number(x)||0),0,1)*4)).join('');
export interface B2516Edge{count:number;reward01:number;error01:number;verified01:number;confidence01:number;lastTick:number;action:ActionKind;from:string;to:string;}
export interface B2516State{version:1;enabled:boolean;tick:number;cycles:number;learningUpdates:number;nodes:number;edges:number;verifiedEdges:number;causalConfidence01:number;autobiographicalContinuity01:number;actionBias:Record<ActionKind,number>;edgesMap:Record<string,B2516Edge>;lastStateKey:string;lastAction:ActionKind;lesionFraction01:number;}
export const defaultB2516State=():B2516State=>({version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,nodes:0,edges:0,verifiedEdges:0,causalConfidence01:.32,autobiographicalContinuity01:.55,actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,edgesMap:{},lastStateKey:'root',lastAction:'wait',lesionFraction01:0});
export class B2516CausalAutobiographicalGraph{
 readonly systemName='cognition:b2516-causal-autobiographical-graph' as const; private state=defaultB2516State();
 snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2516State>|null){const d=defaultB2516State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,actionBias:{...d.actionBias,...(r.actionBias??{})},edgesMap:{...d.edgesMap,...(r.edgesMap??{})}};}
 setEnabled(x:boolean){this.state.enabled=!!x} setLesion(x:number){this.state.lesionFraction01=clamp(x)}
 beforeDecision(i:{tick:number;stateLatent:number[];goalLatent?:number[];identityLatent?:number[];uncertainty01:number;predictionError01:number;baseUtilities?:Partial<Record<ActionKind,number>>}){
  const key=sig(i.stateLatent),bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;let supporting=0;
  if(this.state.enabled){for(const action of ACTIONS){const edges=Object.values(this.state.edgesMap).filter(e=>e.from===key&&e.action===action);if(edges.length){const e=edges.sort((a,b)=>b.lastTick-a.lastTick)[0]!;const prior=(e.reward01-.5)*.13*e.confidence01*(1-this.state.lesionFraction01);bias[action]=clamp(prior,-.06,.06);supporting+=e.confidence01;}}}
  const coherence=clamp(.42+Math.min(.42,supporting*.04)+.16*(1-i.predictionError01));this.state.lastStateKey=key;this.state.tick=i.tick;this.state.cycles++;this.state.actionBias=bias;this.state.autobiographicalContinuity01=clamp(this.state.autobiographicalContinuity01*.97+coherence*.03);
  return {actionBias:{...bias},stateKey:key,causalConfidence01:this.state.causalConfidence01,autobiographicalContinuity01:this.state.autobiographicalContinuity01};
 }
 afterOutcome(i:{tick:number;stateLatent:number[];nextStateLatent?:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number}){
    if(!this.state.enabled)return;
    const from=sig(i.stateLatent),to=sig(i.nextStateLatent??i.stateLatent),key=`${from}|${i.action}|${to}`,old=this.state.edgesMap[key];
    const verified=clamp(i.verified01),lr=verified>.5?.14:.035;
    const rec:B2516Edge=old??{count:0,reward01:.5,error01:.5,verified01:0,confidence01:.25,lastTick:i.tick,action:i.action,from,to};
    rec.count++;rec.reward01=clamp(rec.reward01*(1-lr)+i.reward01*lr);rec.error01=clamp(rec.error01*(1-lr)+i.predictionError01*lr);
    rec.verified01=clamp(rec.verified01*.95+verified*.05);
    rec.confidence01=clamp(rec.confidence01*.93+((1-rec.error01)*.5+rec.verified01*.5)*.07);rec.lastTick=i.tick;
    this.state.edgesMap[key]=rec;this.state.nodes=new Set(Object.values(this.state.edgesMap).flatMap(e=>[e.from,e.to])).size;this.state.edges=Object.keys(this.state.edgesMap).length;
    this.state.learningUpdates++;if(verified>.5)this.state.verifiedEdges++;this.state.causalConfidence01=clamp(this.state.causalConfidence01*.94+rec.confidence01*.06);this.state.tick=i.tick;this.state.lastAction=i.action;
  if(this.state.edges>256){const keep=Object.entries(this.state.edgesMap).sort((a,b)=>b[1].lastTick-a[1].lastTick).slice(0,256);this.state.edgesMap=Object.fromEntries(keep);this.state.edges=keep.length;}
 }
 diagnostics(){return structuredClone(this.state)}
}
