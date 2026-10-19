import type { ActionKind } from '../core/types.ts';
import { cosineSimilarity01 as cosine } from '../core/NumericPrimitives.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const DIM = 64;
const clamp = (x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const tanh = (x:number)=>Math.tanh(Number.isFinite(x)?x:0);

const hash=(x:number)=>{x|=0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.05)=>((hash(seed)/0xffffffff)*2-1)*scale;

export interface B2515State{
  version:1; enabled:boolean; tick:number; cycles:number; learningUpdates:number;
  latent:number[]; coherence01:number; conflict01:number; reliability01:number; precision01:number;
  actionBias:Record<ActionKind,number>; sourceReliability01:number[]; predictionError01:number;
  verifiedUpdates:number; autonomousUpdates:number; latentDrift01:number; lesionFraction01:number;
  sourceMass01:number[];
}
export interface B2515Input{
  tick:number; neuralLatent?:number[]; worldLatent?:number[]; bodyLatent?:number[]; selfLatent?:number[];
  semanticLatent?:number[]; futureLatent?:number[]; identityLatent?:number[]; goalLatent?:number[]; personalityLatent?:number[];
  baseUtilities?:Partial<Record<ActionKind,number>>; uncertainty01:number; predictionError01:number; novelty01:number; autonomy01:number; verified01?:number;
}

const defaultBias=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
export const defaultB2515State=():B2515State=>({version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,latent:new Array(DIM).fill(0),coherence01:.58,conflict01:.18,reliability01:.58,precision01:.58,actionBias:defaultBias(),sourceReliability01:[.68,.68,.68,.68,.68,.68,.68,.68,.68],predictionError01:.45,verifiedUpdates:0,autonomousUpdates:0,latentDrift01:0,lesionFraction01:0,sourceMass01:new Array(9).fill(1/9)});

export class B2515UnifiedOrganismLatentFabric{
  readonly systemName='cognition:b2515-unified-organism-latent-fabric' as const;
  private state=defaultB2515State();
  private sourceNames=['neural','world','body','self','semantic','future','identity','goal','personality'] as const;
  private actionHead:number[][]=ACTIONS.map((_,a)=>Array.from({length:16},(_,k)=>rand(251500+a*100+k,.035)));
  snapshot(){return structuredClone({...this.state,actionHead:this.actionHead});}
  restore(raw?:Partial<B2515State>&{actionHead?:number[][]}|null){const d=defaultB2515State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,actionBias:{...d.actionBias,...(r.actionBias??{})},latent:Array.from({length:DIM},(_,i)=>Number(r.latent?.[i]??0)),sourceReliability01:Array.from({length:9},(_,i)=>clamp(r.sourceReliability01?.[i]??d.sourceReliability01[i])),sourceMass01:Array.from({length:9},(_,i)=>clamp(r.sourceMass01?.[i]??d.sourceMass01[i]))};if(Array.isArray(r.actionHead))this.actionHead=ACTIONS.map((_,a)=>Array.from({length:16},(_,k)=>Number(r.actionHead?.[a]?.[k]??this.actionHead[a]![k])));}
  setEnabled(x:boolean){this.state.enabled=!!x;}
  setLesion(fraction01:number){this.state.lesionFraction01=clamp(fraction01);}
  latentVector(){return this.state.latent.slice();}
  beforeDecision(i:B2515Input){
    this.state.tick=i.tick;
    if(!this.state.enabled)return {latent:this.state.latent.slice(),actionBias:defaultBias(),coherence01:this.state.coherence01,conflict01:this.state.conflict01,reliability01:this.state.reliability01,precision01:this.state.precision01};
    const src=[i.neuralLatent,i.worldLatent,i.bodyLatent,i.selfLatent,i.semanticLatent,i.futureLatent,i.identityLatent,i.goalLatent,i.personalityLatent];
    const weights=src.map((v,k)=>this.state.sourceReliability01[k]!* (0.72+0.28*(v?.length?1:0)));
    const total=weights.reduce((a,b)=>a+b,0)||1;
    const fused=new Array(DIM).fill(0);
    const norms:number[]=[];
    for(let k=0;k<src.length;k++){
      const v=src[k]??[]; const norm=v.length?Math.min(1,Math.sqrt(v.slice(0,32).reduce((s,x)=>s+(Number(x)||0)**2,0)/(Math.min(32,v.length)))):.15; norms.push(norm);
      for(let d=0;d<DIM;d++) fused[d]+=((Number(v[d%Math.max(1,v.length)])||0)*2-1)*weights[k]/total;
    }
    const lesionScale=1-this.state.lesionFraction01;
    for(let d=0;d<DIM;d++){const recurrent=0.16*Math.tanh(this.state.latent[d]!)*lesionScale;fused[d]=clamp(.5+.5*tanh(fused[d]*.62+recurrent));}
    const drift=1-cosine(this.state.latent.map(x=>2*x-1),fused.map(x=>2*x-1));
    const pairConflict=1-cosine((i.selfLatent??[]).slice(0,32),(i.futureLatent??[]).slice(0,32));
    const coherence=clamp(.25+0.52*cosine(fused.slice(0,32),fused.slice(32))+0.23*(1-pairConflict));
    const conflict=clamp(.45*pairConflict+.35*(i.predictionError01??.5)+.20*(i.uncertainty01??.5));
    const precision=clamp((1-conflict)*.7+coherence*.3);
    const actionBias=defaultBias();
    for(let ai=0;ai<ACTIONS.length;ai++){
      let s=0;for(let k=0;k<16;k++)s+=this.actionHead[ai]![k]!*(fused[(k*4+ai*3)%DIM]!-0.5);
      const utility=(i.baseUtilities?.[ACTIONS[ai]!]??.5)-.5;
      actionBias[ACTIONS[ai]!] = clamp(Math.tanh(s*1.35+utility*.18)*(0.055*precision*lesionScale),-.07,.07);
    }
    this.state.latent=fused;this.state.cycles++;this.state.coherence01=coherence;this.state.conflict01=conflict;this.state.precision01=precision;this.state.reliability01=clamp(.55+.35*precision+.10*(1-i.predictionError01));this.state.latentDrift01=drift;this.state.sourceMass01=weights.map(w=>w/total);this.state.actionBias=actionBias;
    return {latent:fused.slice(),actionBias:{...actionBias},coherence01:coherence,conflict01:conflict,reliability01:this.state.reliability01,precision01:precision};
  }
  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number;nextLatent?:number[]}){
    if(!this.state.enabled)return;
    const error=clamp(i.predictionError01),gain=((i.verified01??0)*.7)*(0.0018)*(1-error)*(.6+.4*this.state.precision01);
    const ai=ACTIONS.indexOf(i.action);
    if(ai>=0){for(let k=0;k<16;k++){const idx=(k*4+ai*3)%DIM;const target=(i.reward01-.5)*(this.state.latent[idx]!-.5);this.actionHead[ai]![k]=Math.max(-.12,Math.min(.12,this.actionHead[ai]![k]!+gain*target));}}
    const quality=clamp((1-error)*.52+i.verified01*.33+i.autonomous01*.15);
    this.state.sourceReliability01=this.state.sourceReliability01.map(r=>clamp(r*(.992)+(quality*.008)));
    this.state.predictionError01=clamp(this.state.predictionError01*.92+error*.08);this.state.learningUpdates++;if(i.verified01>.5)this.state.verifiedUpdates++;if(i.autonomous01>.5)this.state.autonomousUpdates++;this.state.tick=i.tick;
    if(i.nextLatent?.length){const target=i.nextLatent.slice(0,DIM);const d=1-cosine(this.state.latent.map(x=>2*x-1),target.map(x=>2*x-1));this.state.latentDrift01=clamp(this.state.latentDrift01*.9+d*.1);}
  }
  diagnostics(){return structuredClone(this.state);}
  lesion(fraction01=.5){const before=this.state.precision01;this.setLesion(fraction01);const out=this.beforeDecision({tick:this.state.tick+1,neuralLatent:this.state.latent,baseUtilities:Object.fromEntries(ACTIONS.map(a=>[a,.5])),uncertainty01:this.state.conflict01,predictionError01:this.state.predictionError01,novelty01:.5,autonomy01:.5});this.setLesion(0);return {causalDrop01:clamp(before-out.precision01),before01:before,after01:out.precision01};}
}
