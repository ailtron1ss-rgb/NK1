/**
 * B294 — Causal Neural Event Spine.
 *
 * A compact event-linked eligibility / credit-assignment circuit that sits
 * between real action outcomes and the existing neural/cognitive owners.
 * It does not own memory, goals, personality or the world model.
 *
 * Purpose:
 *   decision -> episode lineage -> real outcome -> causal error -> sparse
 *   channel credit -> small action bias -> later selection.
 *
 * The neural component is deliberately small: 8 recurrent credit neurons,
 * bounded eligibility traces, lateral competition and reward/error gated
 * plasticity. The event record is the evidence spine; the neural state is
 * the adaptive credit allocator.
 */
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const CHANNELS=['b269','b270','b289','b290','b291','b292','b293','world'] as const;
type Channel=typeof CHANNELS[number];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const hash=(n:number)=>{let x=n|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return x>>>0;};
const seeded=(n:number,scale=.11)=>(((hash(n)/0xffffffff)*2)-1)*scale;

export interface B294Record {
  id:string;
  tick:number;
  goalId:string|null;
  action:ActionKind|null;
  mode:string;
  autonomy01:number;
  predictionError01:number;
  uncertainty01:number;
  predictedSelf01:number;
  predictedWorld01:number;
  outcome?:{tick:number;reward01:number;predictionError01:number;actualSelf01:number;actualWorld01:number;external01:number;identityContinuity01:number;causalEffect01:number;teaching01:number};
}

export interface B294State {
  version:1;
  tick:number;
  decisionCount:number;
  outcomeCount:number;
  learningUpdates:number;
  synapticUpdates:number;
  spikeEvents:number;
  neuronCount:number;
  channelNames:string[];
  episodeCounter:number;
  weights:number[][];
  membrane:number[];
  traces:number[];
  activations:number[];
  spikes:number[];
  actionCredit:Record<string,number>;
  channelCredit:Record<string,number>;
  globalEligibility01:number;
  causalConfidence01:number;
  learningGain01:number;
  lesion01:number;
  currentEpisodeId:string|null;
  records:B294Record[];
}

export interface B294DecisionInput {
  tick:number;
  goalId:string|null;
  action:ActionKind|null;
  mode:string;
  autonomy01:number;
  predictionError01:number;
  uncertainty01:number;
  predictedSelf01:number;
  predictedWorld01:number;
  channelSignals:Record<string,number>;
}

export interface B294OutcomeInput {
  tick:number;
  reward01:number;
  predictionError01:number;
  actualSelf01:number;
  actualWorld01:number;
  external01:number;
  identityContinuity01:number;
  causalEffect01?:number;
}

export interface B294DecisionResult { episodeId:string; lineage01:number; causalReadiness01:number; }

export const defaultB294State=():B294State=>({
  version:1,tick:0,decisionCount:0,outcomeCount:0,learningUpdates:0,synapticUpdates:0,
  neuronCount:8,channelNames:[...CHANNELS],episodeCounter:0,spikeEvents:0,
  weights:Array.from({length:8},(_,post)=>Array.from({length:8},(_,pre)=>pre===post?0:seeded(600_000+post*47+pre*19))),
  membrane:new Array(8).fill(0),traces:new Array(8).fill(0),activations:new Array(8).fill(0),spikes:new Array(8).fill(0),
  actionCredit:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<string,number>,
  channelCredit:Object.fromEntries(CHANNELS.map(c=>[c,.5])) as Record<string,number>,
  globalEligibility01:.2,causalConfidence01:.25,learningGain01:.0,lesion01:0,currentEpisodeId:null,records:[]
});

export class B294CausalNeuralEventSpine {
  private state=B294CausalNeuralEventSpine.normalize(defaultB294State());

  private static normalize(raw:Partial<B294State>):B294State{
    const d=defaultB294State(),r:any=raw??{},n=8;
    const vec=(v:unknown,len:number,fill=0)=>Array.isArray(v)?(v as unknown[]).slice(0,len).concat(new Array(Math.max(0,len-(v as unknown[]).length)).fill(fill)).slice(0,len):new Array(len).fill(fill);
    const weights=Array.from({length:n},(_,post)=>Array.from({length:n},(_,pre)=>pre===post?0:clamp11(Number(((r.weights as any)?.[post]?.[pre])??seeded(600_000+post*47+pre*19)))));
    return {...d,...r,version:1,neuronCount:n,channelNames:[...CHANNELS],weights,
      membrane:vec(r.membrane,n),traces:vec(r.traces,n),activations:vec(r.activations,n),spikes:vec(r.spikes,n),
      actionCredit:{...d.actionCredit,...(r.actionCredit??{})},channelCredit:{...d.channelCredit,...(r.channelCredit??{})},
      records:Array.isArray(r.records)?r.records.slice(-192):[]};
  }

  restore(raw?:Partial<B294State>|null){this.state=B294CausalNeuralEventSpine.normalize(raw??defaultB294State());}
  snapshot(){return structuredClone(this.state);}
  currentEpisodeId(){return this.state.currentEpisodeId;}

  private actionIndex(action:ActionKind|null|undefined){return action?Math.max(0,ACTIONS.indexOf(action)):-1;}

  private runCreditCircuit(signalVector:number[],teaching01=0){
    const n=this.state.neuronCount,lesionScale=1-this.state.lesion01;
    const nextMem=new Array(n).fill(0),spikes=new Array(n).fill(0);
    for(let post=0;post<n;post++){
      let cur=0;
      for(let k=0;k<n;k++)cur+=(this.state.weights[post]?.[k]??0)*(this.state.activations[k]??0);
      cur+=(signalVector[post]??0)*.42;
      nextMem[post]=this.state.membrane[post]*.78+cur*lesionScale;
      if(nextMem[post]>.46){spikes[post]=1;nextMem[post]=0;}
    }
    const winners=spikes.reduce((s,x)=>s+x,0);
    const top=Math.max(1,Math.ceil(n*.25));
    this.state.spikeEvents+=winners;
    if(winners>top){
      let kept=0;for(let i=0;i<n;i++){if(spikes[i]&&kept<top){kept++;}else{spikes[i]=0;}}
    }
    for(let i=0;i<n;i++){
      this.state.traces[i]=this.state.traces[i]*.91+spikes[i]*.24;
      this.state.activations[i]=this.state.activations[i]*.82+Math.max(0,nextMem[i]);
      this.state.membrane[i]=nextMem[i];
      this.state.spikes[i]=spikes[i];
    }
    if(Math.abs(teaching01)>0.01){
      let updates=0;
      for(let post=0;post<n;post++)for(let pre=0;pre<n;pre++){
        if(pre===post)continue;
        const elig=this.state.traces[pre]*this.state.traces[post];
        const delta=.0026*teaching01*elig-this.state.weights[post][pre]*.0018;
        if(Math.abs(delta)>1e-8){this.state.weights[post][pre]=clamp11(this.state.weights[post][pre]+delta);updates++;}
      }
      this.state.synapticUpdates+=updates;
    }
    return spikes.reduce((s,x)=>s+x,0);
  }

  beginDecision(input:B294DecisionInput):B294DecisionResult{
    this.state.tick=input.tick;
    const signal=CHANNELS.map((channel,i)=>clamp(input.channelSignals[channel]??.5));
    const spikes=this.runCreditCircuit(signal,0);
    this.state.episodeCounter++;
    const episodeId=`b294-${input.tick}-${this.state.episodeCounter}`;
    const rec:B294Record={id:episodeId,tick:input.tick,goalId:input.goalId,action:input.action,mode:input.mode,autonomy01:clamp(input.autonomy01),predictionError01:clamp(input.predictionError01),uncertainty01:clamp(input.uncertainty01),predictedSelf01:clamp(input.predictedSelf01),predictedWorld01:clamp(input.predictedWorld01)};
    this.state.records=[rec,...this.state.records].slice(0,192);
    this.state.currentEpisodeId=episodeId;this.state.decisionCount++;
    const readiness=clamp((1-input.predictionError01)*.38+(1-input.uncertainty01)*.22+input.autonomy01*.18+input.predictedSelf01*.11+input.predictedWorld01*.11);
    this.state.globalEligibility01=clamp(this.state.globalEligibility01*.94+readiness*.06);
    return {episodeId,lineage01:clamp(this.state.records.length/64),causalReadiness01:readiness+spikes*.01};
  }

  closeOutcome(input:B294OutcomeInput){
    const id=this.state.currentEpisodeId; if(!id)return {updated:false,reason:'no-open-episode'} as const;
    const rec=this.state.records.find(r=>r.id===id); if(!rec)return {updated:false,reason:'episode-not-found'} as const;
    // A decision has exactly one causal closure. The runtime has multiple learning
    // branches, so make the owner itself idempotent rather than allowing duplicate
    // plasticity when two branches converge on the same outcome.
    if(rec.outcome) return {updated:false,reason:'episode-already-closed',episodeId:id} as const;
    const reward=clamp(input.reward01),pe=clamp(input.predictionError01),external=clamp(input.external01),identity=clamp(input.identityContinuity01);
    const stateError=clamp((Math.abs(rec.predictedSelf01 - clamp(input.actualSelf01)) + Math.abs(rec.predictedWorld01 - clamp(input.actualWorld01))) * .5);
    const causalEffect=clamp(input.causalEffect01??(Math.abs(reward-.5)*(1-pe)*.8+(1-stateError)*.2));
    const teaching=clamp11((reward-.5)*(1-pe)*.95+(causalEffect-.35)*.36+(identity-.5)*.20-external*.07-stateError*.18);
    const signal=CHANNELS.map((channel,i)=>clamp((this.state.traces[i]??0)*.7+(1-pe)*.18+(1-stateError)*.12*(channel==='world'?input.actualWorld01:input.actualSelf01)));
    const spikes=this.runCreditCircuit(signal,teaching);
    const action=rec.action; if(action){
      const old=this.state.actionCredit[action]??0;
      this.state.actionCredit[action]=clamp11(old*.94+teaching*.06*(1-this.state.lesion01));
    }
    for(let i=0;i<CHANNELS.length;i++){
      const c=CHANNELS[i];
      const prev=this.state.channelCredit[c]??.5;
      const delta=(signal[i]-.5)*.035+teaching*.055*(i===7?input.actualWorld01:input.actualSelf01);
      this.state.channelCredit[c]=clamp(prev*.96+delta+.02);
    }
    rec.outcome={tick:input.tick,reward01:reward,predictionError01:pe,actualSelf01:clamp(input.actualSelf01),actualWorld01:clamp(input.actualWorld01),external01:external,identityContinuity01:identity,causalEffect01:causalEffect,teaching01:teaching};
    this.state.outcomeCount++;this.state.learningUpdates++;this.state.learningGain01=clamp(this.state.learningGain01*.93+Math.abs(teaching)*.07);
    this.state.causalConfidence01=clamp(this.state.causalConfidence01*.94+(1-pe)*.04+causalEffect*.02);
    this.state.globalEligibility01=clamp(this.state.globalEligibility01*.91+(1-pe)*.06+causalEffect*.03);
    return {updated:true,episodeId:id,teaching01:teaching,observationError01:stateError,causalEffect01:causalEffect,spikes,learningGain01:this.state.learningGain01,causalConfidence01:this.state.causalConfidence01};
  }

  actionBias(action:ActionKind){const credit=clamp11(this.state.actionCredit[action]??0);const confidence=this.state.causalConfidence01;return clamp11(credit*confidence*.032*(1-this.state.lesion01));}
  channelCredit01(channel:string){return clamp(this.state.channelCredit[channel]??.5);}
  lesion(fraction01=.5){this.state.lesion01=clamp(fraction01);return this.metrics();}
  clearLesion(){this.state.lesion01=0;return this.metrics();}
  metrics(){return {tick:this.state.tick,decisionCount:this.state.decisionCount,outcomeCount:this.state.outcomeCount,learningUpdates:this.state.learningUpdates,synapticUpdates:this.state.synapticUpdates,spikeEvents:this.state.spikeEvents,spikes:this.state.spikes.reduce((a,b)=>a+b,0),causalConfidence01:this.state.causalConfidence01,learningGain01:this.state.learningGain01,globalEligibility01:this.state.globalEligibility01,lesion01:this.state.lesion01,currentEpisodeId:this.state.currentEpisodeId,recordDepth:this.state.records.length};}
  diagnostics(){return {...this.metrics(),actionCredit:{...this.state.actionCredit},channelCredit:{...this.state.channelCredit}};}
}
