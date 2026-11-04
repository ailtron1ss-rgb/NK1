/**
 * B292 — Bounded Cognitive State Bus.
 *
 * A tiny per-cycle coordination record built once from already-computed state.
 * It is deliberately not a cognitive owner: it only normalizes shared state
 * consumed by slow executive/developmental systems so they do not repeatedly
 * snapshot the same heavyweight subsystems.
 */
export interface B292CognitiveStateBusInput {
  tick:number;
  goalId:string|null;
  goalPressure01:number;
  identityContinuity01:number;
  selfAgency01:number;
  selfCoherence01:number;
  realityAlignment01:number;
  novelty01:number;
  uncertainty01:number;
  energy01:number;
  thermal01:number;
  predictionError01:number;
  cognitiveLoad01:number;
  externalInput01:number;
  b289Agency01:number;
  b289Integration01:number;
  b290Mode:string;
  b290Gate01:number;
  b291Mode:string;
  b291Gate01:number;
  workingIntent:string|null;
  selectedAction:string|null;
}

export interface B292CognitiveStateBusState {
  version:1;
  tick:number;
  goalId:string|null;
  goalPressure01:number;
  identityContinuity01:number;
  selfAgency01:number;
  selfCoherence01:number;
  realityAlignment01:number;
  novelty01:number;
  uncertainty01:number;
  energy01:number;
  thermal01:number;
  predictionError01:number;
  cognitiveLoad01:number;
  externalInput01:number;
  b289Agency01:number;
  b289Integration01:number;
  b290Mode:string;
  b290Gate01:number;
  b291Mode:string;
  b291Gate01:number;
  workingIntent:string|null;
  selectedAction:string|null;
  arousal01:number;
  pressure01:number;
  stability01:number;
  readiness01:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const strOrNull=(v:unknown,n=160):string|null=>typeof v==='string'&&v?v.slice(0,n):null;
const strOr=(v:unknown,f:string,n=80):string=>typeof v==='string'&&v?v.slice(0,n):f;

export const defaultB292CognitiveStateBus=():B292CognitiveStateBusState=>({
  version:1,tick:0,goalId:null,goalPressure01:.18,identityContinuity01:.88,selfAgency01:.45,
  selfCoherence01:.82,realityAlignment01:.65,novelty01:.42,uncertainty01:.35,energy01:.82,
  thermal01:.2,predictionError01:.18,cognitiveLoad01:.18,externalInput01:0,b289Agency01:.45,
  b289Integration01:.5,b290Mode:'consolidate',b290Gate01:.4,b291Mode:'maintain',b291Gate01:.5,
  workingIntent:null,selectedAction:null,arousal01:.45,pressure01:.3,stability01:.78,readiness01:.72
});

export class B292CognitiveStateBus {
  private state=defaultB292CognitiveStateBus();
  restore(raw?:Partial<B292CognitiveStateBusState>|null){
    const d=defaultB292CognitiveStateBus();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    this.state={version:1,tick:cnt(read('tick'),d.tick),goalId:strOrNull(read('goalId')),goalPressure01:C01(read('goalPressure01'),d.goalPressure01),identityContinuity01:C01(read('identityContinuity01'),d.identityContinuity01),selfAgency01:C01(read('selfAgency01'),d.selfAgency01),selfCoherence01:C01(read('selfCoherence01'),d.selfCoherence01),realityAlignment01:C01(read('realityAlignment01'),d.realityAlignment01),novelty01:C01(read('novelty01'),d.novelty01),uncertainty01:C01(read('uncertainty01'),d.uncertainty01),energy01:C01(read('energy01'),d.energy01),thermal01:C01(read('thermal01'),d.thermal01),predictionError01:C01(read('predictionError01'),d.predictionError01),cognitiveLoad01:C01(read('cognitiveLoad01'),d.cognitiveLoad01),externalInput01:C01(read('externalInput01'),d.externalInput01),b289Agency01:C01(read('b289Agency01'),d.b289Agency01),b289Integration01:C01(read('b289Integration01'),d.b289Integration01),b290Mode:strOr(read('b290Mode'),d.b290Mode),b290Gate01:C01(read('b290Gate01'),d.b290Gate01),b291Mode:strOr(read('b291Mode'),d.b291Mode),b291Gate01:C01(read('b291Gate01'),d.b291Gate01),workingIntent:strOrNull(read('workingIntent')),selectedAction:strOrNull(read('selectedAction')),arousal01:C01(read('arousal01'),d.arousal01),pressure01:C01(read('pressure01'),d.pressure01),stability01:C01(read('stability01'),d.stability01),readiness01:C01(read('readiness01'),d.readiness01)};
  }

  snapshot(){return {...this.state};}
  read(){return this.state;}
  build(input:B292CognitiveStateBusInput){
    const r=Math.max(0.2,1-input.thermal01);
    const arousal=clamp(input.novelty01*.28+input.goalPressure01*.22+input.externalInput01*.12+(1-input.energy01)*.08+input.predictionError01*.30);
    const pressure=clamp(input.goalPressure01*.30+input.uncertainty01*.18+input.novelty01*.15+input.predictionError01*.18+(1-input.energy01)*.10+input.cognitiveLoad01*.09);
    const stability=clamp(input.identityContinuity01*.28+input.selfCoherence01*.22+input.realityAlignment01*.20+input.b289Integration01*.15+input.b291Gate01*.10+r*.05);
    const readiness=clamp(stability*.34+input.selfAgency01*.24+input.b289Agency01*.12+input.b290Gate01*.12+input.b291Gate01*.10+(1-input.cognitiveLoad01)*.08);
    this.state={...this.state,...input,arousal01:arousal,pressure01:pressure,stability01:stability,readiness01:readiness,version:1};
    return this.state;
  }
  diagnostics(){return {...this.state};}
}
