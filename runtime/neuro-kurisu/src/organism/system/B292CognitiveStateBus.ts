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
    const d=defaultB292CognitiveStateBus(), r:any=raw??{};
    this.state={...d,...r,version:1};
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
