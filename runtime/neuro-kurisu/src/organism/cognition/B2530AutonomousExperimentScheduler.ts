import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:.5));

export interface B2530State{
  version:1; enabled:boolean; tick:number; proposals:number; executed:number; useful:number;
  value01:number; novelty01:number; uncertainty01:number; computeEfficiency01:number;
  thermalGate01:number; selectedAction:ActionKind|null; lastReason:string; lesionFraction01:number;
}

export const defaultB2530State=():B2530State=>({
  version:1,enabled:true,tick:0,proposals:0,executed:0,useful:0,value01:.25,novelty01:.2,
  uncertainty01:.5,computeEfficiency01:.5,thermalGate01:1,selectedAction:null,lastReason:'none',lesionFraction01:0,
});

export class B2530AutonomousExperimentScheduler{
  private state=defaultB2530State();
  readonly systemName='cognition:b2530-autonomous-experiment-scheduler' as const;
  snapshot(){return structuredClone(this.state)}
  restore(raw?:Partial<B2530State>|null){const d=defaultB2530State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1}}
  setEnabled(v:boolean){this.state.enabled=!!v}
  setLesion(v:number){this.state.lesionFraction01=clamp(v)}
  beforeDecision(i:{tick:number;uncertainty01:number;novelty01:number;predictionError01:number;computeBudget01:number;thermalStrain01?:number;battery01?:number;baseUtilities:Record<ActionKind,number>;policyExperiment01:number;regimeShift01:number}){
    const zero=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
    if(!this.state.enabled)return {actionBias:zero,selectedAction:null,execute:false,value01:this.state.value01};
    this.state.tick=i.tick;this.state.proposals++;
    const thermal=clamp(i.thermalStrain01??0),battery=clamp(i.battery01??1);
    this.state.thermalGate01=clamp(1-thermal*.8-(1-battery)*.45);
    this.state.uncertainty01=clamp(i.uncertainty01);this.state.novelty01=clamp(i.novelty01);
    const value=clamp(.32*i.uncertainty01+.24*i.novelty01+.22*i.predictionError01+.12*i.policyExperiment01+.10*i.regimeShift01);
    this.state.value01=value;
    const execute=value>.53&&i.computeBudget01>.25&&this.state.thermalGate01>.38;
    const selected=(i.policyExperiment01>=i.regimeShift01
      ?(i.uncertainty01>i.novelty01?'verify':'explore')
      :(i.regimeShift01>.55?'explore':'verify')) as ActionKind;
    this.state.selectedAction=execute?selected:null;
    this.state.lastReason=execute?'uncertainty×novelty×prediction-error':'gated';
    if(execute)this.state.executed++;
    const bias=zero;
    if(execute){bias.explore=.022*this.state.thermalGate01*(1-this.state.lesionFraction01);bias.verify=.022*this.state.thermalGate01*(1-this.state.lesionFraction01)}
    return {actionBias:bias,selectedAction:this.state.selectedAction,execute,value01:value,thermalGate01:this.state.thermalGate01};
  }
  afterOutcome(i:{reward01:number;predictionError01:number}){
    if(!this.state.enabled)return;
    const gain=clamp((i.reward01-.5)*.5+(1-i.predictionError01)*.5);
    if(this.state.selectedAction&&gain>.5)this.state.useful++;
    this.state.computeEfficiency01=clamp(this.state.computeEfficiency01*.94+gain*.06);
  }
  metrics(){return structuredClone(this.state)}
}
