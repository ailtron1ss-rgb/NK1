import type { ActionKind, IntentCandidate, OrganismState } from '../core/types.ts';
import { B264CausalPolicyLearning, type B264State } from './B264CausalPolicyLearning.ts';
import type { B263RealActionCausality } from './B263RealActionCausality.ts';
import { environmentForFamily, type B266TaskFamily } from './B266HiddenTaskGeneralization.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;

export type B268Decision='commit'|'revert'|'hold';
export interface B268ExperimentSpec {
  id:string;
  hypothesis:string;
  targetAction:ActionKind;
  biasDelta:number;
  contextDelta:number;
  minPairedGain01:number;
  minWinRate01:number;
  maxRobustnessDrop01:number;
}
export interface B268ExperimentResult {
  id:string;
  hypothesis:string;
  targetAction:ActionKind;
  baselineMeanReturn01:number;
  trialMeanReturn01:number;
  pairedGain01:number;
  winRate01:number;
  baselineRobustness01:number;
  trialRobustness01:number;
  robustnessDrop01:number;
  baselineDelayedReward01:number;
  trialDelayedReward01:number;
  decision:B268Decision;
  confidence01:number;
}
export interface B268State {
  version:1;
  experiments:B268ExperimentResult[];
  committed:number;
  reverted:number;
  held:number;
  totalTrials:number;
  successfulCommitRate01:number;
  meanPairedGain01:number;
  meanWinRate01:number;
  rollbackPressure01:number;
  baselineShadowActive:boolean;
  activeHypothesisId:string|null;
  lastDecision:B268Decision|null;
  lastTick:number;
}

export function defaultB268CausalSelfExperimentLab():B268State{
  return {version:1,experiments:[],committed:0,reverted:0,held:0,totalTrials:0,successfulCommitRate01:0,meanPairedGain01:0,meanWinRate01:0,rollbackPressure01:0.2,baselineShadowActive:true,activeHypothesisId:null,lastDecision:null,lastTick:0};
}

export function mutateB264PolicySnapshot(base:B264State,spec:B268ExperimentSpec):B264State{
  const actionIndex=Math.max(0,ACTIONS.indexOf(spec.targetAction));
  const next=structuredClone(base);
  next.actionBias[actionIndex]=Math.max(-1,Math.min(1,next.actionBias[actionIndex]+spec.biasDelta));
  for(let j=0;j<next.contextWeights[actionIndex].length;j++){
    const taper=1-(j/Math.max(1,next.contextWeights[actionIndex].length))*0.35;
    next.contextWeights[actionIndex][j]=Math.max(-1,Math.min(1,next.contextWeights[actionIndex][j]+spec.contextDelta*taper));
  }
  return next;
}

export function evaluateB264SnapshotOnFamilies(snapshot:B264State, causal:B263RealActionCausality, families:B266TaskFamily[], organismState:OrganismState, tickBase=1000){
  const policy=new B264CausalPolicyLearning(); policy.restore(snapshot);
  const makeCandidates=(step:number)=>ACTIONS.map((action,i)=>({
    id:`b268-${action}-${step}`,action,score:.5,predictedUtility:.5,predictedNeedRelief:.5,
    predictedCost:action==='rest'?.15:.3,confidence:.55,generatedAt:0,
  } as IntentCandidate));
  const os=organismState;
  return families.map((family,index)=>{
    const env=environmentForFamily(family); let state=env.initialState.slice(); let ret=0,delayed=0,intervention=0;
    for(let step=0;step<family.horizon;step++){
      const decision=policy.decide(makeCandidates(step),causal,os,tickBase+index*100+step);
      const action=decision.chosen?.action??ACTIONS[(step+index)%ACTIONS.length];
      const transition=env.transition(state,action,step);
      const alt=action==='verify'?'explore':action==='explore'?'verify':'wait';
      const altTransition=env.transition(state,alt,step);
      ret=.94*ret+transition.reward01;
      if(step>=family.rewardDelay) delayed=.90*delayed+transition.reward01;
      intervention+=Math.abs(transition.reward01-altTransition.reward01);
      state=transition.nextState;
    }
    return {familyId:family.id,return01:clamp01(ret/family.horizon),delayedReward01:clamp01(delayed/Math.max(1,family.horizon-family.rewardDelay)),robustness01:clamp01(1-intervention/family.horizon)};
  });
}

export class B268CausalSelfExperimentLab {
  private state=defaultB268CausalSelfExperimentLab();
  restore(raw?:Partial<B268State>|null){const d=defaultB268CausalSelfExperimentLab(),r=raw??{};this.state={...d,...r,experiments:Array.isArray(r.experiments)?r.experiments.slice(-96):[]};}
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return structuredClone(this.state);}

  evaluate(spec:B268ExperimentSpec,baseline:any[],trial:any[],tick=0):B268ExperimentResult{
    const n=Math.min(baseline.length,trial.length);
    const paired=Array.from({length:n},(_,i)=>Number(trial[i]?.return01??0)-Number(baseline[i]?.return01??0));
    const winRate=paired.length?paired.filter(v=>v>0.005).length/paired.length:0;
    const baselineMean=mean(baseline.map(e=>clamp01(e.return01)));
    const trialMean=mean(trial.map(e=>clamp01(e.return01)));
    const pairedGain=mean(paired.map(v=>Math.max(-1,Math.min(1,v))));
    const br=mean(baseline.map(e=>clamp01(e.robustness01)));
    const tr=mean(trial.map(e=>clamp01(e.robustness01)));
    const bd=mean(baseline.map(e=>clamp01(e.delayedReward01)));
    const td=mean(trial.map(e=>clamp01(e.delayedReward01)));
    const confidence=clamp01(.45*winRate+.35*clamp01(.5+pairedGain*5)+.20*clamp01(1-Math.abs(tr-br)));
    const robustnessDrop=Math.max(0,br-tr);
    const decision:B268Decision=pairedGain>=spec.minPairedGain01&&winRate>=spec.minWinRate01&&robustnessDrop<=spec.maxRobustnessDrop01?'commit':pairedGain<-spec.minPairedGain01||winRate<Math.max(.35,spec.minWinRate01-.2)||robustnessDrop>spec.maxRobustnessDrop01?'revert':'hold';
    const result={id:spec.id,hypothesis:spec.hypothesis,targetAction:spec.targetAction,baselineMeanReturn01:baselineMean,trialMeanReturn01:trialMean,pairedGain01:pairedGain,winRate01:winRate,baselineRobustness01:br,trialRobustness01:tr,robustnessDrop01:robustnessDrop,baselineDelayedReward01:bd,trialDelayedReward01:td,decision,confidence01:confidence};
    this.state.experiments=[...this.state.experiments.slice(-95),result];
    this.state.totalTrials++; this.state.activeHypothesisId=spec.id; this.state.lastDecision=decision; this.state.lastTick=tick;
    if(decision==='commit')this.state.committed++; else if(decision==='revert')this.state.reverted++; else this.state.held++;
    const recent=this.state.experiments.slice(-24); this.state.successfulCommitRate01=this.state.committed/Math.max(1,this.state.totalTrials); this.state.meanPairedGain01=mean(recent.map(e=>e.pairedGain01)); this.state.meanWinRate01=mean(recent.map(e=>e.winRate01)); this.state.rollbackPressure01=clamp01(.8*this.state.rollbackPressure01+.2*(decision==='revert'?1:decision==='commit'?0.05:.35));
    return structuredClone(result);
  }
}
