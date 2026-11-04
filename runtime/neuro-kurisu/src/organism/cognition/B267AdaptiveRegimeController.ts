import type { ActionKind, IntentCandidate, OrganismState } from '../core/types.ts';
import type { B263RealActionCausality } from './B263RealActionCausality.ts';
import type { B264CausalPolicyLearning } from './B264CausalPolicyLearning.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const cSigned=(v:unknown,f:number):number=>Math.max(-1,Math.min(1,finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const MODES:B267Mode[]=['exploit','monitor','verify','explore','recover'];
const actOrNull=(v:unknown):ActionKind|null=>ACTIONS.includes(v as ActionKind)?v as ActionKind:null;
const sanObservation=(x:unknown):B267Observation|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(!ACTIONS.includes(r.action as ActionKind))return null;return {tick:cnt(r.tick,0),surprise01:C01(r.surprise01,0),uncertainty01:C01(r.uncertainty01,0),predictionError01:C01(r.predictionError01,0),reward01:C01(r.reward01,0),action:r.action as ActionKind,context:Array.isArray(r.context)?(r.context as unknown[]).slice(0,32).map(v=>cSigned(v,0)):[]};};
const sanShift=(x:unknown):B267ShiftEvent|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(!ACTIONS.includes(r.action as ActionKind)||!MODES.includes(r.mode as B267Mode))return null;return {tick:cnt(r.tick,0),shift01:C01(r.shift01,0),residual01:C01(r.residual01,0),mode:r.mode as B267Mode,action:r.action as ActionKind,recovery01:C01(r.recovery01,0)};};

export type B267Mode='exploit'|'monitor'|'verify'|'explore'|'recover';
export interface B267Observation { tick:number; surprise01:number; uncertainty01:number; predictionError01:number; reward01:number; action:ActionKind; context:number[]; }
export interface B267ShiftEvent { tick:number; shift01:number; residual01:number; mode:B267Mode; action:ActionKind; recovery01:number; }
export interface B267State {
  version:1; observations:B267Observation[]; shifts:B267ShiftEvent[]; verificationHistory:number[];
  baselineError01:number; baselineSurprise01:number; baselineReward01:number; fastError01:number; fastSurprise01:number;
  cusum01:number; regimeShift01:number; uncertainty01:number; recovery01:number;
  mode:B267Mode; observationsCount:number; shiftCount:number; verificationCount:number; explorationCount:number;
  lastTick:number; lastAction:ActionKind|null; activeInformationGain01:number; postShiftGain01:number; holdoutGain01:number;
}

export function defaultB267AdaptiveRegimeController():B267State{
  return {version:1,observations:[],shifts:[],verificationHistory:[],baselineError01:.15,baselineSurprise01:.15,baselineReward01:.5,fastError01:.15,fastSurprise01:.15,cusum01:0,regimeShift01:0,uncertainty01:.5,recovery01:0,mode:'exploit',observationsCount:0,shiftCount:0,verificationCount:0,explorationCount:0,lastTick:0,lastAction:null,activeInformationGain01:0,postShiftGain01:0,holdoutGain01:0};
}

export class B267AdaptiveRegimeController {
  private state=defaultB267AdaptiveRegimeController();
  restore(raw?:Partial<B267State>|null){
    const d=defaultB267AdaptiveRegimeController();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const obsRaw=read('observations'),shRaw=read('shifts'),vhRaw=read('verificationHistory');
    const mode=MODES.includes(read('mode') as B267Mode)?read('mode') as B267Mode:'exploit';
    this.state={version:1,observations:Array.isArray(obsRaw)?obsRaw.slice(-256).map(sanObservation).filter((x):x is B267Observation=>x!==null):[],shifts:Array.isArray(shRaw)?shRaw.slice(-96).map(sanShift).filter((x):x is B267ShiftEvent=>x!==null):[],verificationHistory:Array.isArray(vhRaw)?vhRaw.slice(-128).map(v=>C01(v,0)):[],
      baselineError01:C01(read('baselineError01'),d.baselineError01),baselineSurprise01:C01(read('baselineSurprise01'),d.baselineSurprise01),baselineReward01:C01(read('baselineReward01'),d.baselineReward01),fastError01:C01(read('fastError01'),d.fastError01),fastSurprise01:C01(read('fastSurprise01'),d.fastSurprise01),
      cusum01:cSigned(read('cusum01'),d.cusum01),regimeShift01:C01(read('regimeShift01'),d.regimeShift01),uncertainty01:C01(read('uncertainty01'),d.uncertainty01),recovery01:C01(read('recovery01'),d.recovery01),
      mode,observationsCount:cnt(read('observationsCount'),d.observationsCount),shiftCount:cnt(read('shiftCount'),d.shiftCount),verificationCount:cnt(read('verificationCount'),d.verificationCount),explorationCount:cnt(read('explorationCount'),d.explorationCount),
      lastTick:cnt(read('lastTick'),d.lastTick),lastAction:actOrNull(read('lastAction')),activeInformationGain01:C01(read('activeInformationGain01'),d.activeInformationGain01),postShiftGain01:C01(read('postShiftGain01'),d.postShiftGain01),holdoutGain01:C01(read('holdoutGain01'),d.holdoutGain01)};
  }

  snapshot(){return structuredClone(this.state);}
  diagnostics(){return structuredClone({mode:this.state.mode,observations:this.state.observationsCount,shifts:this.state.shiftCount,baselineError01:this.state.baselineError01,fastError01:this.state.fastError01,baselineSurprise01:this.state.baselineSurprise01,fastSurprise01:this.state.fastSurprise01,cusum01:this.state.cusum01,regimeShift01:this.state.regimeShift01,uncertainty01:this.state.uncertainty01,recovery01:this.state.recovery01,verificationCount:this.state.verificationCount,explorationCount:this.state.explorationCount,exploration01:this.state.observationsCount?this.state.explorationCount/this.state.observationsCount:0,activeInformationGain01:this.state.activeInformationGain01,postShiftGain01:this.state.postShiftGain01,holdoutGain01:this.state.holdoutGain01});}

  private classify(shift:number,uncertainty:number,recovery:number):B267Mode{
    if(recovery>.68 && shift<.30)return 'recover';
    if(shift>.72 && uncertainty>.55)return 'verify';
    if(shift>.56)return 'explore';
    if(shift>.28)return 'monitor';
    return 'exploit';
  }

  observe(o:B267Observation){
    const d=defaultB267AdaptiveRegimeController();
    const err=clamp01(Math.abs(o.predictionError01));
    const surprise=clamp01(o.surprise01);
    const uncertainty=clamp01(o.uncertainty01);
    const reward=clamp01(o.reward01);
    const priorErr=this.state.fastError01, priorSurprise=this.state.fastSurprise01;
    this.state.fastError01=clamp01(.78*this.state.fastError01+.22*err);
    this.state.fastSurprise01=clamp01(.78*this.state.fastSurprise01+.22*surprise);
    this.state.baselineError01=clamp01(.985*this.state.baselineError01+.015*err);
    this.state.baselineSurprise01=clamp01(.985*this.state.baselineSurprise01+.015*surprise);
    this.state.baselineReward01=clamp01(.985*this.state.baselineReward01+.015*reward);
    const residual=clamp01(.58*Math.abs(this.state.fastError01-this.state.baselineError01)+.27*Math.abs(this.state.fastSurprise01-this.state.baselineSurprise01)+.15*Math.abs(reward-this.state.baselineReward01));
    this.state.cusum01=clamp01(this.state.cusum01*.91+Math.max(0,residual-.045));
    const shift=clamp01(.58*this.state.cusum01+.24*residual+.18*uncertainty);
    const previous=this.state.mode;
    const mode=this.classify(shift,uncertainty,this.state.recovery01);
    if(mode!==previous && (mode==='verify'||mode==='explore')) this.state.shiftCount++;
    if(mode==='verify')this.state.verificationCount++;
    if(mode==='explore')this.state.explorationCount++;
    this.state.regimeShift01=shift; this.state.uncertainty01=clamp01(.78*this.state.uncertainty01+.22*uncertainty); this.state.mode=mode;
    this.state.recovery01=clamp01(previous!=='exploit' && shift<.32 ? this.state.recovery01*.86+.14 : this.state.recovery01*.92);
    const info=clamp01((Math.abs(priorErr-this.state.fastError01)+Math.abs(priorSurprise-this.state.fastSurprise01))*.5+uncertainty*.25);
    this.state.activeInformationGain01=clamp01(.85*this.state.activeInformationGain01+.15*info);
    this.state.postShiftGain01=clamp01(.9*this.state.postShiftGain01+.1*Math.max(0,reward-this.state.baselineReward01));
    this.state.observations=[...this.state.observations.slice(-255),{...o,context:o.context.slice(0,16).map(clamp01),predictionError01:err,surprise01:surprise,uncertainty01:uncertainty,reward01:reward}];
    if(mode==='verify'||mode==='explore')this.state.shifts=[...this.state.shifts.slice(-95),{tick:o.tick,shift01:shift,residual01:residual,mode,action:o.action,recovery01:this.state.recovery01}];
    this.state.observationsCount++;this.state.lastTick=o.tick;this.state.lastAction=o.action;
    this.state.verificationHistory=[...this.state.verificationHistory.slice(-127),(mode==='verify'||mode==='explore')?info:0];
    return {mode,regimeShift01:shift,uncertainty01:this.state.uncertainty01,activeInformationGain01:info,changed:mode!==previous,recovery01:this.state.recovery01};
  }

  arbitrate(candidates:IntentCandidate[],base:B264CausalPolicyLearning,causal:B263RealActionCausality,state:OrganismState,tick:number){
    const decision=base.selectFromRealCandidates(candidates,causal,state,tick);
    const mode=this.state.mode, shift=this.state.regimeShift01, uncertainty=this.state.uncertainty01;
    const scored=decision.rankings.map(r=>{
      const modeBoost=mode==='verify'?(r.action==='verify'?0.20:r.action==='explore'?0.08:-.03):mode==='explore'?(r.action==='explore'?0.16:r.action==='verify'?0.07:0):mode==='recover'?(r.action==='rest'?0.12:r.action==='reflect'?0.08:0):0;
      const diversity=(r.action==='wait'||r.action==='defer')?-shift*.05:0;
      const uncertaintyPenalty=(r.action==='explore'||r.action==='verify')?0:uncertainty*.06;
      return {...r,adaptiveScore01:clamp01(r.score01+shift*.16+modeBoost+diversity-uncertaintyPenalty)};
    }).sort((a,b)=>b.adaptiveScore01-a.adaptiveScore01);
    const chosen=scored[0];
    return {chosen:chosen?candidates.find(c=>c.action===chosen.action)??decision.chosen:decision.chosen,baseline:decision.baseline,mode,regimeShift01:shift,uncertainty01:uncertainty,rankings:scored,baseDecision:decision};
  }

  recordIndependentHoldout(policyReward01:number,baselineReward01:number){
    const gain=clamp01(Math.max(0,policyReward01-baselineReward01)); this.state.holdoutGain01=clamp01(.85*this.state.holdoutGain01+.15*gain); return {gain01:gain,holdoutGain01:this.state.holdoutGain01};
  }

  recoverFromShift(observedGain01:number){
    const gain=clamp01(observedGain01); this.state.recovery01=clamp01(.82*this.state.recovery01+.18*gain); this.state.postShiftGain01=clamp01(.85*this.state.postShiftGain01+.15*gain); if(gain>.55)this.state.cusum01*=.72; if(gain>.68)this.state.mode='recover'; return {recovery01:this.state.recovery01,postShiftGain01:this.state.postShiftGain01,mode:this.state.mode};
  }
}
