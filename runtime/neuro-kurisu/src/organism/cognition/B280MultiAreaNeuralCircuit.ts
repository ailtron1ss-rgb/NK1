import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const AREAS = ['sensorium','memory','association','selfAction'] as const;
type AreaName = typeof AREAS[number];
const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const sigmoid = (x:number) => 1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const dot = (a:number[],b:number[]) => { let s=0; for(let i=0;i<Math.min(a.length,b.length);i++) s += a[i]*b[i]; return s; };
const norm = (v:number[]) => Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine = (a:number[],b:number[]) => clamp11(dot(a,b)/(norm(a)*norm(b)));
const seeded = (seed:number) => { let x=seed|0; x=Math.imul(x^(x>>>16),0x21f0aaad); x=Math.imul(x^(x>>>15),0x735a2d97); return (x^(x>>>13))>>>0; };
const rand = (seed:number,scale=.12) => ((seeded(seed)/0xffffffff)*2-1)*scale;

export interface B280AreaState {
  name: AreaName;
  excitatoryCount:number;
  inhibitoryCount:number;
  membrane:number[];
  adaptation:number[];
  inhibitoryTrace:number[];
  excitatoryTrace:number[];
  dendriticGate:number[];
  spikes:number[];
  firingRate01:number;
  inhibition01:number;
  plasticity01:number;
}

export interface B280State {
  version:1;
  tick:number;
  cycles:number;
  learningUpdates:number;
  consolidationCount:number;
  areas:Record<AreaName,B280AreaState>;
  recurrentWeights:Record<AreaName,number[][]>;
  inhibitoryWeights:Record<AreaName,number[][]>;
  crossAreaWeights:Record<string,number[][]>;
  crossSynapticAvailability:Record<string,number[][]>;
  actionReadout:number[][];
  neuromodulation01:number;
  shortTermPlasticity01:number;
  crossAreaCoherence01:number;
  excitationInhibitionBalance01:number;
  sparseActivity01:number;
  dendriticContext01:number;
  assemblyStability01:number;
  causalLesionDrop01:number;
  crossAreaCausalDrop01:number;
  lastContext:number[];
  lastSpikes:number[];
  lastAction:ActionKind|null;
  history:Array<{tick:number;action:ActionKind|null;reward01:number;coherence01:number;spikes:number}>;
}

const newArea=(name:AreaName,seed:number):B280AreaState=>({
  name,excitatoryCount:8,inhibitoryCount:4,membrane:new Array(12).fill(0).map((_,i)=>rand(seed+i*17,.04)),
  adaptation:new Array(12).fill(0),inhibitoryTrace:new Array(4).fill(.08),excitatoryTrace:new Array(8).fill(.08),
  dendriticGate:new Array(8).fill(0).map((_,i)=>.55+rand(seed+100+i,.12)),spikes:new Array(12).fill(0),firingRate01:.08,inhibition01:.18,plasticity01:.5
});

export function defaultB280State():B280State{
  const recurrent={} as Record<AreaName,number[][]>;
  const inhibitory={} as Record<AreaName,number[][]>;
  const areas={} as Record<AreaName,B280AreaState>;
  for(let a=0;a<AREAS.length;a++){
    const name=AREAS[a]!; areas[name]=newArea(name,120_000+a*1000);
    recurrent[name]=Array.from({length:12},(_,i)=>Array.from({length:12},(_,j)=>i===j?0:rand(121_000+a*1000+i*31+j*7,.055)));
    inhibitory[name]=Array.from({length:12},(_,i)=>Array.from({length:4},(_,j)=>rand(130_000+a*1000+i*17+j*13,.045)));
  }
  const crossAreaWeights={} as Record<string,number[][]>;
  const crossSynapticAvailability={} as Record<string,number[][]>;
  for(let a=0;a<AREAS.length-1;a++){
    const key=`${AREAS[a]}->${AREAS[a+1]}`;
    crossAreaWeights[key]=Array.from({length:12},(_,i)=>Array.from({length:12},(_,j)=>rand(140_000+a*1000+i*11+j*19,.035)));
    crossSynapticAvailability[key]=Array.from({length:12},()=>Array.from({length:12},()=>.82));
  }
  const actionReadout=ACTIONS.map((_,a)=>Array.from({length:48},(_,i)=>rand(150_000+a*97+i*11,.028)));
  return {version:1,tick:0,cycles:0,learningUpdates:0,consolidationCount:0,areas,recurrentWeights:recurrent,inhibitoryWeights:inhibitory,crossAreaWeights,crossSynapticAvailability,actionReadout,neuromodulation01:.5,shortTermPlasticity01:.5,crossAreaCoherence01:.2,excitationInhibitionBalance01:.5,sparseActivity01:.85,dendriticContext01:.5,assemblyStability01:.4,causalLesionDrop01:0,lastContext:new Array(16).fill(0),lastSpikes:new Array(48).fill(0),lastAction:null,history:[],crossAreaCausalDrop01:0};
}

export interface B280StepInput { tick:number; vector:number[]; autonomy01?:number; selfLatent?:number[]; worldLatent?:number[]; goalVector?:number[]; action?:ActionKind|null; dopamine01?:number; norepinephrine01?:number; acetylcholine01?:number; predictionError01?:number; novelty01?:number; uncertainty01?:number; learningEnabled?:boolean; }

export class B280MultiAreaNeuralCircuit{
  private state=B280MultiAreaNeuralCircuit.create();
  static create(){return defaultB280State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<B280State>|null){
    const d=defaultB280State(),r=raw??{};
    this.state={...d,...r,version:1,tick:Number(r.tick??0),cycles:Number(r.cycles??0),learningUpdates:Number(r.learningUpdates??0),consolidationCount:Number(r.consolidationCount??0),
      areas:{...d.areas,...(r.areas??{})} as Record<AreaName,B280AreaState>, recurrentWeights:{...d.recurrentWeights,...(r.recurrentWeights??{})}, inhibitoryWeights:{...d.inhibitoryWeights,...(r.inhibitoryWeights??{})}, crossAreaWeights:{...d.crossAreaWeights,...(r.crossAreaWeights??{})}, crossSynapticAvailability:{...d.crossSynapticAvailability,...(r.crossSynapticAvailability??{})}, actionReadout:Array.isArray(r.actionReadout)?r.actionReadout.slice(0,ACTIONS.length):d.actionReadout,
      lastContext:Array.isArray(r.lastContext)?r.lastContext.slice(0,16):d.lastContext,lastSpikes:Array.isArray(r.lastSpikes)?r.lastSpikes.slice(0,48):d.lastSpikes,lastAction:r.lastAction??null,history:Array.isArray(r.history)?r.history.slice(-160):[]};
    for(const area of AREAS){ const a=this.state.areas[area]??d.areas[area]!; a.excitatoryCount=8;a.inhibitoryCount=4;a.membrane=Array.isArray(a.membrane)?a.membrane.slice(0,12):d.areas[area]!.membrane; a.adaptation=Array.isArray(a.adaptation)?a.adaptation.slice(0,12):d.areas[area]!.adaptation;a.inhibitoryTrace=Array.isArray(a.inhibitoryTrace)?a.inhibitoryTrace.slice(0,4):new Array(4).fill(.08);a.excitatoryTrace=Array.isArray(a.excitatoryTrace)?a.excitatoryTrace.slice(0,8):new Array(8).fill(.08);a.dendriticGate=Array.isArray(a.dendriticGate)?a.dendriticGate.slice(0,8):new Array(8).fill(.55);a.spikes=Array.isArray(a.spikes)?a.spikes.slice(0,12):new Array(12).fill(0); }
  }
  private context(input:B280StepInput){
    const out=new Array(16).fill(0);const pools=[input.vector,input.selfLatent??[],input.worldLatent??[],input.goalVector??[]];
    for(let i=0;i<16;i++){ let s=0; for(let p=0;p<pools.length;p++) s += (Number(pools[p]![i]??0)) * [0.38,0.22,0.24,0.16][p]!; out[i]=clamp11(s); }
    return out;
  }
  private flattenSpikes(){ return AREAS.flatMap(area=>this.state.areas[area]!.spikes); }
  step(input:B280StepInput){
    const ctx=this.context(input); this.state.lastContext=ctx; this.state.tick=input.tick;
    const contextGate=clamp01(.35+.25*(input.novelty01??.5)+.25*(input.uncertainty01??.5)+.2*(input.autonomy01??.5));
    let previousAreaSpikes=new Array(12).fill(0); const allSpikes:number[]=[]; let totalE=0,totalI=0,totalSp=0;
    for(let ai=0;ai<AREAS.length;ai++){
      const name=AREAS[ai]!,area=this.state.areas[name]!; const recurrent=this.state.recurrentWeights[name]!; const inh=this.state.inhibitoryWeights[name]!;
      const nextMem=new Array(12).fill(0),spikes=new Array(12).fill(0);
      for(let i=0;i<8;i++){
        let z=.14 + ctx[i%16]*.34 + (ctx[(i+5)%16]??0)*area.dendriticGate[i]*.24;
        for(let j=0;j<12;j++) z += recurrent[i]![j]*area.membrane[j]*1.15;
        if(ai>0){ const key=`${AREAS[ai-1]}->${name}`; const cross=this.state.crossAreaWeights[key]!; const availability=this.state.crossSynapticAvailability[key]!; for(let j=0;j<12;j++) z += cross[i]![j]*availability[i]![j]*previousAreaSpikes[j]*1.4; }
        const stp=0.92+0.12*area.excitatoryTrace[i]!;
        nextMem[i]=clamp11(area.membrane[i]*.78 + z*stp - area.adaptation[i]*.13 - contextGate*.02);
        spikes[i]=nextMem[i]>.46?1:0;
      }
      for(let i=8;i<12;i++){
        let z=-.08; const src=i-8; for(let j=0;j<8;j++) z += inh[i]![src%4] * (spikes[j]||0)*.9;
        nextMem[i]=clamp11(area.membrane[i]*.68+z-area.adaptation[i]*.10); spikes[i]=nextMem[i]>.38?1:0;
      }
      const eRate=spikes.slice(0,8).reduce((s,x)=>s+x,0)/8; const iRate=spikes.slice(8).reduce((s,x)=>s+x,0)/4;
      area.membrane=nextMem; area.spikes=spikes; area.firingRate01=area.firingRate01*.9+(eRate*.9+iRate*.1)*.1; area.inhibition01=area.inhibition01*.9+iRate*.1;
      area.adaptation=area.adaptation.map((v,i)=>clamp01(v*.9+(spikes[i]??0)*.12));
      area.excitatoryTrace=area.excitatoryTrace.map((v,i)=>clamp01(v*.88+(spikes[i]??0)*.2));
      area.inhibitoryTrace=area.inhibitoryTrace.map((v,i)=>clamp01(v*.9+(spikes[i+8]??0)*.16));
      area.dendriticGate=area.dendriticGate.map((v,i)=>clamp01(v*.995+contextGate*.005));
      previousAreaSpikes=spikes; allSpikes.push(...spikes); totalE+=eRate; totalI+=iRate; totalSp+=spikes.reduce((s,x)=>s+x,0);
      if((input.learningEnabled??true) && (this.state.cycles%7===0)){
        const third=(input.dopamine01??.5)*.65+(input.acetylcholine01??.5)*.25+(input.norepinephrine01??.5)*.1;
        for(let i=0;i<8;i++) for(let j=0;j<12;j++) if(spikes[i]) recurrent[i]![j]=clamp11(recurrent[i]![j]+.0018*third*((area.membrane[j]??0)-recurrent[i]![j]*.1));
        const targetI=.16; const imbalance=eRate-targetI; for(let i=0;i<12;i++) for(let j=0;j<4;j++){ const d=.0012*imbalance*(spikes[i]||0); inh[i]![j]=clamp11(inh[i]![j]+d); }
        for(let i=0;i<8;i++) area.dendriticGate[i]=clamp01(area.dendriticGate[i]+.002*(third-.5)*((ctx[i%16]??0)+1));
        area.plasticity01=clamp01(area.plasticity01*.94+Math.abs(third-.5)*.12);
      }
    }
    // Short-term synaptic depression/facilitation proxy: recent spikes transiently suppress and then recover across areas.
    this.state.shortTermPlasticity01=clamp01(this.state.shortTermPlasticity01*.93+(1-totalSp/(AREAS.length*12))*.07);
    const e=totalE/AREAS.length,i=totalI/AREAS.length; const balance=clamp01(1-Math.abs(e*.9-i*.1)/.7);
    this.state.excitationInhibitionBalance01=this.state.excitationInhibitionBalance01*.92+balance*.08;
    this.state.sparseActivity01=clamp01(1-totalSp/(AREAS.length*12));
    const chunks=AREAS.map(area=>this.state.areas[area]!.spikes.slice(0,8)); const coherence=AREAS.slice(1).reduce((s,area,idx)=>s+.5+.5*cosine(chunks[idx]!,chunks[idx+1]!),0)/(AREAS.length-1);
    this.state.crossAreaCoherence01=this.state.crossAreaCoherence01*.9+coherence*.1;
    this.state.dendriticContext01=this.state.dendriticContext01*.92+contextGate*.08;
    this.state.assemblyStability01=this.state.assemblyStability01*.94+coherence*.06;
    this.state.neuromodulation01=this.state.neuromodulation01*.9+.1*((input.dopamine01??.5)*.5+(input.acetylcholine01??.5)*.25+(input.norepinephrine01??.5)*.25);
    this.state.cycles++; this.state.lastSpikes=allSpikes;
    const selected=this.readoutAction(allSpikes,input.action??null); this.state.lastAction=selected;
    return {selectedAction:selected,spikes:allSpikes.slice(),crossAreaCoherence01:this.state.crossAreaCoherence01,excitationInhibitionBalance01:this.state.excitationInhibitionBalance01,sparseActivity01:this.state.sparseActivity01,dendriticContext01:this.state.dendriticContext01,assemblyStability01:this.state.assemblyStability01};
  }
  private readoutAction(spikes:number[],preferred:ActionKind|null){ let best=preferred??'wait',bestScore=-Infinity; for(let a=0;a<ACTIONS.length;a++){ const score=dot(this.state.actionReadout[a]!,spikes); if(score>bestScore){bestScore=score;best=ACTIONS[a]!;} } return best; }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;action?:ActionKind|null;externalEvidence01?:number}){
    const third=clamp11((input.reward01-.5)*.8-input.predictionError01*.25)*this.state.neuromodulation01; const spikes=this.state.lastSpikes; let updates=0;
    for(let a=0;a<ACTIONS.length;a++){
      if(ACTIONS[a]!==input.action)continue;
      for(let i=0;i<spikes.length;i++){const d=.0026*third*spikes[i]*(1-.2*Math.abs(this.state.actionReadout[a]![i])); this.state.actionReadout[a]![i]=clamp11(this.state.actionReadout[a]![i]+d); if(Math.abs(d)>1e-7)updates++;}
    }
    for(const area of AREAS){ const as=this.state.areas[area]!,w=this.state.recurrentWeights[area]!; for(let i=0;i<8;i++) for(let j=0;j<12;j++){ if(as.spikes[i]===0)continue; const d=.0017*third*as.spikes[i]*(as.membrane[j]??0); w[i]![j]=clamp11(w[i]![j]+d); if(Math.abs(d)>1e-7)updates++; } }
    this.state.learningUpdates++; this.state.history=[...this.state.history.slice(-159),{tick:input.tick,action:input.action??this.state.lastAction,reward01:clamp01(input.reward01),coherence01:this.state.crossAreaCoherence01,spikes:this.state.lastSpikes.reduce((s,x)=>s+x,0)}];
    return {updates,thirdFactor01:Math.abs(third),crossAreaCoherence01:this.state.crossAreaCoherence01,excitationInhibitionBalance01:this.state.excitationInhibitionBalance01};
  }
  lesionArea(areaName:AreaName,fraction01=.5){
    const area=this.state.areas[areaName]!; const saved=structuredClone(this.state); const frac=clamp01(fraction01); const count=Math.max(1,Math.floor(8*frac));
    const ranked=area.spikes.slice(0,8).map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).slice(0,count).map(x=>x.i);
    area.membrane=area.membrane.map((v,i)=>ranked.includes(i)?0:v); area.spikes=area.spikes.map((v,i)=>ranked.includes(i)?0:v);
    const after=this.step({tick:this.state.tick+1,vector:this.state.lastContext,learningEnabled:false}); const before=saved.lastSpikes; const drop=clamp01(1-(.5+.5*cosine(before,after.spikes))); this.state=saved; this.state.causalLesionDrop01=drop; return {area:areaName,lesionedExcitatory:ranked,causalDrop01:drop};
  }
  areaDiagnostics(area:AreaName){ const a=this.state.areas[area]; return a?{...a}:null; }
  lesionCrossArea(from:AreaName,to:AreaName,fraction01=.5){
    const key=`${from}->${to}`; const weights=this.state.crossAreaWeights[key]; const availability=this.state.crossSynapticAvailability[key]; if(!weights||!availability) return {from,to,causalDrop01:0,connections:0};
    const savedW=weights.map(r=>r.slice()),savedA=availability.map(r=>r.slice()),before=this.state.lastSpikes.slice(); let connections=0; const frac=clamp01(fraction01);
    for(let i=0;i<weights.length;i++) for(let j=0;j<weights[i]!.length;j++) if(((i*17+j*31)%100)/100<frac){weights[i]![j]=0;availability[i]![j]=0;connections++;}
    const after=this.step({tick:this.state.tick+1,vector:this.state.lastContext,selfLatent:this.state.lastContext,worldLatent:this.state.lastContext,goalVector:this.state.lastContext,learningEnabled:false}); const drop=clamp01(1-(.5+.5*cosine(before,after.spikes)));
    this.state.crossAreaWeights[key]=savedW;this.state.crossSynapticAvailability[key]=savedA;this.state.causalLesionDrop01=Math.max(this.state.causalLesionDrop01,drop);this.state.crossAreaCausalDrop01=drop; return {from,to,causalDrop01:drop,connections};
  }
  actionBias(action:ActionKind){ const ai=ACTIONS.indexOf(action); if(ai<0)return 0; return clamp11(dot(this.state.actionReadout[ai]!,this.state.lastSpikes)/Math.max(1,this.state.lastSpikes.length))*.06; }
  diagnostics(){ return {...this.state,areaNames:[...AREAS],areaMetrics:Object.fromEntries(AREAS.map(a=>[a,this.areaDiagnostics(a)])),meanSpikes:this.state.lastSpikes.reduce((s,x)=>s+x,0)/Math.max(1,this.state.lastSpikes.length),causalIntegration01:clamp01(this.state.crossAreaCoherence01*.45+this.state.excitationInhibitionBalance01*.25+this.state.dendriticContext01*.15+this.state.shortTermPlasticity01*.15)}; }
  snapshotCircuit(){ return {cycles:this.state.cycles,learningUpdates:this.state.learningUpdates,consolidationCount:this.state.consolidationCount,crossAreaCoherence01:this.state.crossAreaCoherence01,excitationInhibitionBalance01:this.state.excitationInhibitionBalance01,sparseActivity01:this.state.sparseActivity01,dendriticContext01:this.state.dendriticContext01,assemblyStability01:this.state.assemblyStability01,shortTermPlasticity01:this.state.shortTermPlasticity01,causalLesionDrop01:this.state.causalLesionDrop01}; }
}
