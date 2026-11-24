import type { ActionKind } from '../core/types.ts';
import { cosineSimilarity01 as cosine } from '../core/NumericPrimitives.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const N = 48, E = 40, I = 8, MAX_PROTO = 64, MAX_REPLAY = 24;
const clamp = (x:number,a=0,b=1) => Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const signed = (x:number) => clamp(x,-1,1);
const mean = (xs:number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
const dot = (a:number[],b:number[]) => a.reduce((z,x,i)=>z+x*(b[i]??0),0);

const softmax = (xs:number[],t=.2) => { const q=Math.max(.04,t),z=Math.max(...xs),e=xs.map(v=>Math.exp((v-z)/q)),s=e.reduce((a,b)=>a+b,0)||1; return e.map(v=>v/s); };
const hash = (x:number) => { x|=0; x=Math.imul(x^(x>>>16),0x21f0aaad); x=Math.imul(x^(x>>>15),0x735a2d97); return (x^(x>>>13))>>>0; };
const rand = (seed:number,scale=.05) => ((hash(seed)/0xffffffff)*2-1)*scale;

export interface B2502Synapse { pre:number; post:number; weight:number; delay:number; active:boolean; eligibility01:number; stp01:number; age:number; }
export interface B2502Prototype { vector:number[]; action:ActionKind; utility:number; reward01:number; precision01:number; mass01:number; tick:number; }
export interface B2502Replay { vector:number[]; action:ActionKind; reward01:number; surprise01:number; tick:number; }
export interface B2502State {
  version:1; enabled:boolean; tick:number; cycles:number; learningUpdates:number; replaySteps:number; prototypeHits:number; prototypeCreates:number;
  eRate01:number; iRate01:number; sparsity01:number; homeostasis01:number; plasticity01:number; causalEffect01:number; precision01:number;
  actionBias:number[]; actionUtility:number[]; actionGate:number[]; membrane:number[]; spikes:number[]; synapses:B2502Synapse[];
  prototypes:B2502Prototype[]; replay:B2502Replay[]; lastContext:number[]; lastAction:ActionKind|null; lesion:boolean;
}
export interface B2502Input { tick:number; context01:number[]; baseUtilities:Record<ActionKind,number>; latent01?:number[]; precision01?:number; uncertainty01:number; novelty01:number; predictionError01:number; energy01:number; motivation01:number; }
export interface B2502Output { actionBias:Record<ActionKind,number>; neuralUtility:Record<ActionKind,number>; actionGate:Record<ActionKind,number>; eRate01:number; iRate01:number; sparsity01:number; precision01:number; replayGain01:number; prototypeGain01:number; bottleneckGain01:number; selectedAction:ActionKind; }

export const defaultB2502State = ():B2502State => ({
  version:1, enabled:true, tick:0, cycles:0, learningUpdates:0, replaySteps:0, prototypeHits:0, prototypeCreates:0,
  eRate01:.08, iRate01:.12, sparsity01:.84, homeostasis01:.5, plasticity01:.35, causalEffect01:0, precision01:.5,
  actionBias:ACTIONS.map(()=>0), actionUtility:ACTIONS.map(()=>.5), actionGate:ACTIONS.map(()=>.5),
  membrane:Array(N).fill(0), spikes:Array(N).fill(0),
  synapses:Array.from({length:N*5},(_,k)=>{ const post=k%N; const pre=(post*11+Math.floor(k/N)*7+5)%N; return {pre,post,weight:rand(2502000+k,.055),delay:1+(k%4),active:true,eligibility01:0,stp01:.5,age:0}; }),
  prototypes:[], replay:[], lastContext:Array(32).fill(0), lastAction:null, lesion:false,
});

export class B2502EINeuralReplayField {
  readonly systemName='cognition:b2502-ei-neural-replay-field' as const;
  private state=defaultB2502State();
  private incoming:number[][]=Array.from({length:N},()=>[]);
  constructor(){ this.rebuildIndex(); }
  snapshot(){ return structuredClone(this.state); }
  restore(raw?:Partial<B2502State>|null){
    const d=defaultB2502State(), r:any=raw??{};
    this.state={...d,...structuredClone(r),version:1,
      synapses:Array.isArray(r.synapses)?r.synapses:d.synapses,
      prototypes:Array.isArray(r.prototypes)?r.prototypes.slice(-MAX_PROTO):[],
      replay:Array.isArray(r.replay)?r.replay.slice(-MAX_REPLAY):[],
      membrane:Array.from({length:N},(_,i)=>signed(r.membrane?.[i]??0)),
      spikes:Array.from({length:N},(_,i)=>clamp(r.spikes?.[i]??0)),
      lastContext:Array.from({length:32},(_,i)=>signed(r.lastContext?.[i]??0))};
    this.rebuildIndex();
  }
  setEnabled(x:boolean){this.state.enabled=!!x;}
  setLesion(x:boolean){this.state.lesion=!!x;}
  private rebuildIndex(){ this.incoming=Array.from({length:N},()=>[]); this.state.synapses.forEach((s,k)=>{if(s.post>=0&&s.post<N)this.incoming[s.post]!.push(k);}); }
  private activation(i:B2502Input){
    const ctx=Array.from({length:32},(_,k)=>signed(((i.context01[k%i.context01.length]??.5)-.5)*2));
    const dep=i.uncertainty01>.68||i.predictionError01>.6?2:1;
    let mem=this.state.membrane.slice(), spikes=this.state.spikes.slice(); let eRate=0,iRate=0;
    for(let pass=0;pass<dep;pass++){
      const nm=new Array(N).fill(0), ns=new Array(N).fill(0);
      for(let n=0;n<N;n++){
        let z=.035+ctx[n%32]*.22+ctx[(n*13+5)%32]*.10;
        if(n>=E) z-=.02;
        if(!this.state.lesion) for(const idx of this.incoming[n]??[]){
          const s=this.state.synapses[idx]!; if(!s.active)continue;
          const d=this.state.spikes[s.pre]??0; z+=s.weight*d*(s.stp01*.7+.3);
        }
        if(n>=E) z += mean(mem.slice(0,E))*.22;
        else z -= mean(mem.slice(E))*.10;
        nm[n]=signed(mem[n]*.52+z);
        if(nm[n] > (n<E?.27:.19)){ns[n]=1;nm[n]=.06; if(n<E)eRate++; else iRate++;}
      }
      mem=nm; spikes=ns;
    }
    eRate/=Math.max(1,E*dep); iRate/=Math.max(1,I*dep);
    this.state.lastContext=ctx; this.state.membrane=mem; this.state.spikes=spikes;
    this.state.eRate01=eRate; this.state.iRate01=iRate; this.state.sparsity01=clamp(1-(eRate+iRate)/2);
    return {ctx,spikes,mem};
  }
  beforeDecision(i:B2502Input):B2502Output{
    const base=ACTIONS.map(a=>clamp(i.baseUtilities[a]??.5));
    if(!this.state.enabled){
      const best=ACTIONS[base.indexOf(Math.max(...base))]??'wait';
      return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as any,neuralUtility:Object.fromEntries(ACTIONS.map((a,k)=>[a,base[k]])) as any,actionGate:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as any,eRate01:0,iRate01:0,sparsity01:1,precision01:.5,replayGain01:0,prototypeGain01:0,bottleneckGain01:0,selectedAction:best};
    }
    const {ctx,spikes,mem}=this.activation(i);
    const memCos=this.state.prototypes.length?Math.max(...this.state.prototypes.map(p=>cosine(ctx,p.vector))):.5;
    const precision=clamp(.25+.42*(1-i.uncertainty01)+.20*(1-i.predictionError01)+.13*this.state.homeostasis01);
    const utility=ACTIONS.map((a,k)=>{
      const readout=clamp(.5+dot(spikes,this.state.actionUtility.map((x,j)=>x*(1+((j+k)%3)*.02)))/(N*.65));
      const rec=clamp(.5+dot(mem,this.state.actionUtility.map((x,j)=>(x-.5)*(((j+k)%5)+1)))/(N*2));
      const proto=this.state.prototypes.filter(p=>p.action===a).slice(-8);
      const pu=proto.length?proto.reduce((z,p)=>z+cosine(ctx,p.vector)*p.utility,0)/proto.length:.5;
      return clamp(.36*readout+.24*rec+.20*pu+.20*base[k]);
    });
    const p=softmax(utility.map((u,k)=>(u-.5)*(1+1.8*precision)+(base[k]-.5)*.35),.18-.04*precision);
    const chosen=ACTIONS[p.indexOf(Math.max(...p))]??'wait';
    const bias=utility.map((u,k)=>clamp((u-base[k])*.38,-.14,.14));
    const gate=p.map(q=>clamp(.48*precision+.52*(1-Math.abs(q-1/7)*1.5)));
    this.state.tick=i.tick;this.state.cycles++;this.state.actionBias=bias;this.state.actionUtility=utility;this.state.actionGate=gate;this.state.precision01=precision;this.state.lastAction=chosen;
    this.state.homeostasis01=clamp(this.state.homeostasis01*.92+.08*(1-Math.abs(.10-this.state.eRate01)*2.5));
    return {actionBias:Object.fromEntries(ACTIONS.map((a,k)=>[a,bias[k]!])) as any,neuralUtility:Object.fromEntries(ACTIONS.map((a,k)=>[a,utility[k]!])) as any,actionGate:Object.fromEntries(ACTIONS.map((a,k)=>[a,gate[k]!])) as any,eRate01:this.state.eRate01,iRate01:this.state.iRate01,sparsity01:this.state.sparsity01,precision01:precision,replayGain01:clamp(this.state.replay.length/MAX_REPLAY),prototypeGain01:clamp(memCos-.5),bottleneckGain01:clamp(.18+.48*precision),selectedAction:chosen};
  }
  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;salience01?:number}){
    if(!this.state.enabled)return;
    const r=clamp(i.reward01),v=clamp(i.verified01), ai=ACTIONS.indexOf(i.action); let updates=0;
    for(const s of this.state.synapses){
      if(!s.active||this.state.lesion)continue;
      const pre=this.state.spikes[s.pre]??0,post=this.state.spikes[s.post]??0;
      const pair=pre*post*1.4-(1-pre)*post*.18;
      s.eligibility01=clamp(s.eligibility01*.86+Math.abs(pair)*.14);
      s.stp01=clamp(s.stp01*.92+pre*.08);
      const delta=.0048*(r-(this.state.actionUtility[ai]??.5))*(.35+.65*v)*(s.eligibility01*.72+pair*.28);
      if(Math.abs(delta)>1e-7){s.weight=signed(s.weight+delta);updates++;} s.age++;
    }
    const vec=this.state.lastContext.slice();
    const existing=this.state.prototypes.filter(p=>p.action===i.action).map(p=>({p,q:cosine(vec,p.vector)})).sort((a,b)=>b.q-a.q)[0];
    const canCreate = !existing || (existing.q<.74 && this.state.prototypes.length<MAX_PROTO && Math.abs(r-.5)>.28);
    if(canCreate){
      this.state.prototypes.push({vector:vec,action:i.action,utility:clamp((this.state.actionUtility[ai]??.5)*.75+r*.25),reward01:r,precision01:this.state.precision01,mass01:.4+.6*v,tick:i.tick});
      this.state.prototypeCreates++;
    } else {
      const p=existing?.p;
      if(p){
        p.utility=clamp(p.utility*.90+r*.10);
        p.reward01=clamp(p.reward01*.92+r*.08);
        p.precision01=clamp(p.precision01*.92+this.state.precision01*.08);
        p.mass01=clamp(p.mass01*.94+.06*v);
        p.tick=i.tick;
        this.state.prototypeHits++;
      }
    }
    this.state.prototypes=this.state.prototypes.slice(-MAX_PROTO);
    this.state.replay.push({vector:vec,action:i.action,reward01:r,surprise01:clamp(i.predictionError01),tick:i.tick});
    if(this.state.replay.length>MAX_REPLAY)this.state.replay.shift();
    this.state.replaySteps+=this.state.replay.length>3?Math.min(4,this.state.replay.length):1;
    this.state.learningUpdates+=updates;
    this.state.plasticity01=clamp(this.state.plasticity01*.9+.1*(.3+v*(1-clamp(i.predictionError01))));
    this.state.homeostasis01=clamp(this.state.homeostasis01*.94+.06*(1-Math.abs(this.state.eRate01-.10)*3));
  }
  diagnostics(){ return {enabled:this.state.enabled,cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,replaySteps:this.state.replaySteps,prototypeHits:this.state.prototypeHits,prototypeCreates:this.state.prototypeCreates,eRate01:this.state.eRate01,iRate01:this.state.iRate01,sparsity01:this.state.sparsity01,homeostasis01:this.state.homeostasis01,plasticity01:this.state.plasticity01,precision01:this.state.precision01,causalEffect01:this.state.causalEffect01,prototypeCount:this.state.prototypes.length,replayCount:this.state.replay.length}; }
  lesionFraction(f=.5){
    const n=Math.max(1,Math.floor(this.state.synapses.length*clamp(f)));
    const before=this.state.actionUtility.slice();
    for(let k=0;k<n;k++)this.state.synapses[k]!.active=false;
    this.state.lesion=true;
    const out=this.beforeDecision({tick:this.state.tick+1,context01:this.state.lastContext,baseUtilities:Object.fromEntries(ACTIONS.map((a,k)=>[a,before[k]??.5])) as Record<ActionKind,number>,uncertainty01:.5,novelty01:.4,predictionError01:this.state.precision01<.5?.6:.2,energy01:.7,motivation01:.5});
    const after=ACTIONS.map(a=>out.neuralUtility[a]??.5);
    const effect=before.reduce((z,x,i)=>z+Math.abs(x-(after[i]??x)),0)/ACTIONS.length;
    this.state.causalEffect01=Math.max(this.state.causalEffect01,effect);
    return {effect01:effect,lesioned:n,total:this.state.synapses.length};
  }
}
