import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const clamp11=(x:number)=>clamp(x,-1,1);
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const softmax=(values:number[],temperature:number)=>{const t=Math.max(.05,temperature),m=Math.max(...values);const e=values.map(v=>Math.exp(Math.max(-10,Math.min(10,(v-m)/t))));const s=e.reduce((a,b)=>a+b,0)||1;return e.map(v=>v/s);};
const matrix=(rows:number,cols:number,seed:number,scale=.045)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{let x=(seed+r*131+c*17)|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);x^=x>>>16;return (((x>>>0)/4294967295)*2-1)*scale;}));

export type P2703WorkspaceSource='neural'|'memory'|'world'|'goal'|'self'|'personality'|'causal'|'embodied'|'information'|'developmental';
export interface P2703WorkspaceCandidate { id:string; source:P2703WorkspaceSource; vector:number[]; salience01:number; uncertainty01:number; predictionError01:number; actionBias:Record<ActionKind,number>; }
export interface P2703WorkspaceState {
  version:1; tick:number; cycles:number; capacity:number; latentDim:number; featureDim:number; temperature:number;
  latent:number[]; recurrent:number[][]; sourceWeights:Record<P2703WorkspaceSource,number>; selectedSources:P2703WorkspaceSource[]; selectedIds:string[]; selectionWeights:number[];
  ignition01:number; recurrence01:number; diversity01:number; broadcast01:number; actionInfluence01:number; disagreement01:number; learningUpdates:number; rewardMean01:number; lastReward01:number; broadcastActionBias:Record<ActionKind,number>;
}
const SOURCES:P2703WorkspaceSource[]=['neural','memory','world','goal','self','personality','causal','embodied','information','developmental'];
const defaultState=():P2703WorkspaceState=>({version:1,tick:0,cycles:0,capacity:4,latentDim:24,featureDim:16,temperature:.20,latent:new Array(24).fill(0),recurrent:matrix(24,24,270300,.028),sourceWeights:Object.fromEntries(SOURCES.map(s=>[s,1])) as Record<P2703WorkspaceSource,number>,selectedSources:[],selectedIds:[],selectionWeights:[],ignition01:0,recurrence01:0,diversity01:0,broadcast01:0,actionInfluence01:0,disagreement01:0,learningUpdates:0,rewardMean01:.5,lastReward01:.5,broadcastActionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>});

/** P2703 convergence layer: integrates already-computed subsystems into one bounded recurrent workspace.
 * It is a causal integration mechanism, not a consciousness claim and not a replacement for B282/GlobalWorkspaceSubstrateV2.
 */
export class P2703GlobalWorkspaceConvergence {
  private state=defaultState();
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2703WorkspaceState>|null){const d=defaultState(),r:any=raw??{};this.state={...d,...r,version:1,latent:Array.isArray(r.latent)?r.latent.slice(0,24).concat(new Array(Math.max(0,24-r.latent.length)).fill(0)).slice(0,24):d.latent,recurrent:Array.isArray(r.recurrent)?Array.from({length:24},(_,i)=>Array.isArray(r.recurrent[i])?r.recurrent[i].slice(0,24).concat(new Array(Math.max(0,24-(r.recurrent[i]?.length??0))).fill(0)).slice(0,24):d.recurrent[i]):d.recurrent,sourceWeights:{...d.sourceWeights,...(r.sourceWeights??{})},selectedSources:Array.isArray(r.selectedSources)?r.selectedSources.slice(0,4):[],selectedIds:Array.isArray(r.selectedIds)?r.selectedIds.slice(0,4):[],selectionWeights:Array.isArray(r.selectionWeights)?r.selectionWeights.slice(0,4):[]};}
  step(input:{tick:number;candidates:P2703WorkspaceCandidate[];uncertainty01:number;predictionError01:number;computeBudget01?:number}){
    const candidates=input.candidates.slice(0,32).map(c=>({...c,vector:c.vector.slice(0,this.state.featureDim),salience01:clamp(c.salience01),uncertainty01:clamp(c.uncertainty01),predictionError01:clamp(c.predictionError01)}));
    if(!candidates.length){this.state.tick=input.tick;this.state.cycles++;return this.result();}
    const context=this.state.latent.slice(0,16);
    const scores=candidates.map(c=>{const v=c.vector;let similarity=0;for(let j=0;j<v.length;j++)similarity+=(v[j]??0)*(context[j]??0);const sourceGain=this.state.sourceWeights[c.source]??1;return Math.log(.05+c.salience01)*.62+similarity*.025+sourceGain*.11-c.uncertainty01*.12-c.predictionError01*.08;});
    const probs=softmax(scores,this.state.temperature),ranked=candidates.map((c,i)=>({c,p:probs[i]??0,score:scores[i]??0})).sort((a,b)=>b.p-a.p).slice(0,this.state.capacity);
    const denom=ranked.reduce((s,x)=>s+x.p,0)||1;const weights=ranked.map(x=>x.p/denom);const next=new Array(this.state.latentDim).fill(0);
    for(let k=0;k<ranked.length;k++){const v=ranked[k]!.c.vector,w=weights[k]??0;for(let j=0;j<next.length;j++)next[j]+=w*(v[j%Math.max(1,v.length)]??0);}
    const prev=this.state.latent;for(let j=0;j<next.length;j++){let rec=0;for(let i=0;i<prev.length;i++)rec+=this.state.recurrent[j]![i]!*(prev[i]??0);next[j]=tanh(next[j]+rec*.18);}
    let similarity=0,aa=0,bb=0;for(let j=0;j<24;j++){similarity+=(prev[j]??0)*next[j]!;aa+=(prev[j]??0)**2;bb+=next[j]!**2;}similarity/=Math.max(1e-9,Math.sqrt(aa*bb));
    const diversity=new Set(ranked.map(x=>x.c.source)).size/Math.max(1,ranked.length),meanSalience=ranked.reduce((s,x)=>s+x.c.salience01,0)/Math.max(1,ranked.length),concentration=weights.reduce((s,x)=>s+x*x,0);
    const ignition=clamp(meanSalience*.45+(1-concentration)*.18+diversity*.20+Math.max(0,similarity)*.17);
    // P2704 contentful broadcast: the workspace now exports the selected coalition's
    // actual action content instead of deriving action influence from source-name length.
    // This makes the workspace causally testable: changing a selected candidate's
    // action bias must change the downstream policy signal.
    const broadcastActionBias=Object.fromEntries(ACTIONS.map(action=>{
      let value=0;
      for(let k=0;k<ranked.length;k++) value+=(weights[k]??0)*clamp11(ranked[k]!.c.actionBias[action]??0);
      return [action,clamp11(value)];
    })) as Record<ActionKind,number>;
    this.state={...this.state,tick:input.tick,cycles:this.state.cycles+1,latent:next,selectedSources:ranked.map(x=>x.c.source),selectedIds:ranked.map(x=>x.c.id),selectionWeights:weights,ignition01:ignition,recurrence01:clamp(Math.max(0,similarity)*.7+ignition*.3),diversity01:clamp(diversity),broadcast01:clamp(ignition*(.58+diversity*.42)),disagreement01:clamp((1-concentration)*.65+input.uncertainty01*.20+input.predictionError01*.15),broadcastActionBias};
    let actionInfluence=0;for(const item of ranked){const c=item.c;const actionValues=Object.values(c.actionBias) as number[]; actionInfluence+=Math.abs(weights[ranked.indexOf(item)]??0)*actionValues.reduce((a:number,b:number)=>a+Math.abs(b),0);}this.state.actionInfluence01=clamp(actionInfluence*3.5);
    return this.result();
  }
  actionBias(action:ActionKind){
    const content=clamp11(this.state.broadcastActionBias[action]??0);
    // A small recurrent latent contribution preserves the workspace's endogenous
    // state while keeping contentful candidate evidence as the dominant signal.
    const latentSignal=this.state.latent.reduce((sum,v,k)=>sum+v*((((k+1)*(ACTIONS.indexOf(action)+3))%17)-8)/8,0)/Math.max(1,this.state.latent.length);
    return clamp11(content*.070+clamp11(latentSignal)*.010)*(0.45+0.55*this.state.broadcast01);
  }
  broadcastVector(){return this.state.latent.slice(0,16).map(v=>clamp11(v*this.state.broadcast01));}
  learnOutcome(input:{reward01:number;verified01:number;predictionError01:number}){const reward=clamp(input.reward01),error=clamp(input.predictionError01),verified=clamp(input.verified01);const baseline=this.state.rewardMean01;const td=(reward-baseline)*(0.5+.5*verified)-(error-.5)*.18;this.state.rewardMean01=baseline*.97+reward*.03;this.state.lastReward01=reward;for(const source of this.state.selectedSources){const old=this.state.sourceWeights[source]??1;this.state.sourceWeights[source]=clamp(old+td*.018,.55,1.65);}for(let i=0;i<24;i++)for(let j=0;j<24;j++){const e=(this.state.latent[j]??0)*(this.state.latent[i]??0);this.state.recurrent[i]![j]=clamp11(this.state.recurrent[i]![j]!+td*.0008*e);}this.state.learningUpdates++;}
  result(){return {selectedSources:this.state.selectedSources.slice(),selectedIds:this.state.selectedIds.slice(),selectionWeights:this.state.selectionWeights.slice(),ignition01:this.state.ignition01,recurrence01:this.state.recurrence01,diversity01:this.state.diversity01,broadcast01:this.state.broadcast01,actionInfluence01:this.state.actionInfluence01,disagreement01:this.state.disagreement01,broadcastActionBias:{...this.state.broadcastActionBias},broadcastVector:this.broadcastVector()};}
  diagnostics(){return {...this.result(),cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,sourceWeights:{...this.state.sourceWeights},broadcastActionBias:{...this.state.broadcastActionBias},rewardMean01:this.state.rewardMean01};}
}
export const defaultP2703Workspace=defaultState;
