import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const traitToAction:Record<string,ActionKind>={
  curiosity:'explore','truth-seeking':'verify','self-reflection':'reflect','care':'respond',
  'social-attunement':'respond','self-preservation':'rest','persistence':'wait',autonomy:'explore'
};

export interface B313OutcomeInput{
  tick:number;
  action:ActionKind;
  success01:number;
  reward01:number;
  verified:boolean;
  autonomous:boolean;
  neuralPlasticity01:number;
  neuralLearningUpdates:number;
  synapticUpdates:number;
  personalityInfluence01:number;
  personalityStability01:number;
  selfAuthoredDevelopment01:number;
  policyBias01:number;
  b285Compression01:number;
  b285FutureConsistency01:number;
  b285IdentityStability01:number;
}

export interface B313State{
  version:1;
  cycles:number;
  verifiedCycles:number;
  autonomousCycles:number;
  positiveOutcomes:number;
  negativeOutcomes:number;
  actionCounts:Record<ActionKind,number>;
  positiveActionCounts:Record<ActionKind,number>;
  negativeActionCounts:Record<ActionKind,number>;
  firstNeuralPlasticity01:number|null;
  lastNeuralPlasticity01:number;
  firstPersonalityInfluence01:number|null;
  lastPersonalityInfluence01:number;
  firstPersonalityStability01:number|null;
  lastPersonalityStability01:number;
  firstPolicyBias01:number|null;
  lastPolicyBias01:number;
  positiveTrajectory01:number;
  negativeTrajectory01:number;
  actionDistributionGap01:number;
  neuralDelta01:number;
  personalityDelta01:number;
  policyDelta01:number;
  consolidationBridgeUpdates:number;
  consolidationBridgeStrength01:number;
  history:Array<{tick:number;action:ActionKind;success01:number;reward01:number;verified:boolean;autonomous:boolean;neuralPlasticity01:number;personalityInfluence01:number;policyBias01:number;b285Compression01:number}>;
}

export const defaultB313State=():B313State=>({
  version:1,cycles:0,verifiedCycles:0,autonomousCycles:0,positiveOutcomes:0,negativeOutcomes:0,
  actionCounts:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  positiveActionCounts:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  negativeActionCounts:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  firstNeuralPlasticity01:null,lastNeuralPlasticity01:0,firstPersonalityInfluence01:null,lastPersonalityInfluence01:0,
  firstPersonalityStability01:null,lastPersonalityStability01:.5,firstPolicyBias01:null,lastPolicyBias01:0,
  positiveTrajectory01:0,negativeTrajectory01:0,actionDistributionGap01:0,neuralDelta01:0,personalityDelta01:0,policyDelta01:0,
  consolidationBridgeUpdates:0,consolidationBridgeStrength01:0,history:[]
});

export class B313LongitudinalBehavioralDivergence{
  private state=B313LongitudinalBehavioralDivergence.normalize();
  private lesioned=false;
  private static normalize(raw?:Partial<B313State>|null):B313State{
    const d=defaultB313State(),r=raw??{};
    const counts=(src:any)=>Object.fromEntries(ACTIONS.map(a=>[a,Math.max(0,Math.floor(Number(src?.[a]??0)))])) as Record<ActionKind,number>;
    return {...d,...r,version:1,
      cycles:Math.max(0,Math.floor(Number(r.cycles??0))),verifiedCycles:Math.max(0,Math.floor(Number(r.verifiedCycles??0))),autonomousCycles:Math.max(0,Math.floor(Number(r.autonomousCycles??0))),
      positiveOutcomes:Math.max(0,Math.floor(Number(r.positiveOutcomes??0))),negativeOutcomes:Math.max(0,Math.floor(Number(r.negativeOutcomes??0))),
      actionCounts:counts(r.actionCounts),positiveActionCounts:counts(r.positiveActionCounts),negativeActionCounts:counts(r.negativeActionCounts),
      firstNeuralPlasticity01:r.firstNeuralPlasticity01==null?null:clamp(Number(r.firstNeuralPlasticity01)),lastNeuralPlasticity01:clamp(Number(r.lastNeuralPlasticity01??0)),
      firstPersonalityInfluence01:r.firstPersonalityInfluence01==null?null:clamp(Number(r.firstPersonalityInfluence01)),lastPersonalityInfluence01:clamp(Number(r.lastPersonalityInfluence01??0)),
      firstPersonalityStability01:r.firstPersonalityStability01==null?null:clamp(Number(r.firstPersonalityStability01)),lastPersonalityStability01:clamp(Number(r.lastPersonalityStability01??.5)),
      firstPolicyBias01:r.firstPolicyBias01==null?null:signed(Number(r.firstPolicyBias01)),lastPolicyBias01:signed(Number(r.lastPolicyBias01??0)),
      positiveTrajectory01:clamp(Number(r.positiveTrajectory01??0)),negativeTrajectory01:clamp(Number(r.negativeTrajectory01??0)),
      actionDistributionGap01:clamp(Number(r.actionDistributionGap01??0)),neuralDelta01:clamp(Number(r.neuralDelta01??0)),personalityDelta01:clamp(Number(r.personalityDelta01??0)),policyDelta01:clamp(Number(r.policyDelta01??0)),
      consolidationBridgeUpdates:Math.max(0,Math.floor(Number(r.consolidationBridgeUpdates??0))),consolidationBridgeStrength01:clamp(Number(r.consolidationBridgeStrength01??0)),
      history:Array.isArray(r.history)?r.history.slice(-192):[]
    };
  }
  restore(raw?:Partial<B313State>|null){this.state=B313LongitudinalBehavioralDivergence.normalize(raw);this.lesioned=false;}
  snapshot(){return structuredClone(this.state);}
  lesion(enabled=true){this.lesioned=enabled;return {lesioned:this.lesioned};}
  clearLesion(){this.lesioned=false;}
  record(input:B313OutcomeInput){
    const success=clamp(input.success01),reward=clamp(input.reward01),action=ACTIONS.includes(input.action)?input.action:'wait';
    this.state.cycles++;
    if(input.verified)this.state.verifiedCycles++;
    if(input.autonomous)this.state.autonomousCycles++;
    this.state.actionCounts[action]=(this.state.actionCounts[action]??0)+1;
    if(success>=.58){this.state.positiveOutcomes++;this.state.positiveActionCounts[action]=(this.state.positiveActionCounts[action]??0)+1;}
    if(success<=.42){this.state.negativeOutcomes++;this.state.negativeActionCounts[action]=(this.state.negativeActionCounts[action]??0)+1;}
    if(this.state.firstNeuralPlasticity01==null)this.state.firstNeuralPlasticity01=clamp(input.neuralPlasticity01);
    if(this.state.firstPersonalityInfluence01==null)this.state.firstPersonalityInfluence01=clamp(input.personalityInfluence01);
    if(this.state.firstPersonalityStability01==null)this.state.firstPersonalityStability01=clamp(input.personalityStability01);
    if(this.state.firstPolicyBias01==null)this.state.firstPolicyBias01=signed(input.policyBias01);
    this.state.lastNeuralPlasticity01=clamp(input.neuralPlasticity01);
    this.state.lastPersonalityInfluence01=clamp(input.personalityInfluence01);
    this.state.lastPersonalityStability01=clamp(input.personalityStability01);
    this.state.lastPolicyBias01=signed(input.policyBias01);
    const signedOutcome=(reward-.5)*2;
    if(success>=.58)this.state.positiveTrajectory01=clamp(this.state.positiveTrajectory01*.96+Math.max(0,signedOutcome)*.10);
    if(success<=.42)this.state.negativeTrajectory01=clamp(this.state.negativeTrajectory01*.96+Math.max(0,-signedOutcome)*.10);
    this.state.neuralDelta01=clamp(Math.abs(this.state.lastNeuralPlasticity01-(this.state.firstNeuralPlasticity01??this.state.lastNeuralPlasticity01))*1.8);
    this.state.personalityDelta01=clamp(Math.abs(this.state.lastPersonalityInfluence01-(this.state.firstPersonalityInfluence01??this.state.lastPersonalityInfluence01))*1.8 + Math.abs(this.state.lastPersonalityStability01-(this.state.firstPersonalityStability01??this.state.lastPersonalityStability01))*.8);
    this.state.policyDelta01=clamp(Math.abs(this.state.lastPolicyBias01-(this.state.firstPolicyBias01??this.state.lastPolicyBias01))*2.4);
    this.state.actionDistributionGap01=this.computeDistributionGap();
    const history=this.state.history;
    history.unshift({tick:Math.max(0,Math.floor(input.tick)),action,success01:success,reward01:reward,verified:Boolean(input.verified),autonomous:Boolean(input.autonomous),neuralPlasticity01:clamp(input.neuralPlasticity01),personalityInfluence01:clamp(input.personalityInfluence01),policyBias01:signed(input.policyBias01),b285Compression01:clamp(input.b285Compression01)});
    this.state.history=history.slice(0,192);
    return this.diagnostics();
  }
  recordConsolidationBridge(input:{traits:Array<{trait:string;traitValue:number;evidence01:number;futureConsistency01:number;support:boolean}>;verified:boolean;autonomous:boolean}){
    if(this.lesioned || !input.verified)return {updates:0,strength01:this.state.consolidationBridgeStrength01};
    let updates=0,sum=0;
    for(const e of input.traits){
      const a=traitToAction[e.trait];
      if(!a || Math.abs(e.traitValue-.5)<.02 || e.evidence01<.54 || e.futureConsistency01<.50)continue;
      updates++;sum+=Math.abs(e.traitValue-.5)*e.evidence01*e.futureConsistency01;
    }
    if(updates){this.state.consolidationBridgeUpdates+=updates;this.state.consolidationBridgeStrength01=clamp(this.state.consolidationBridgeStrength01*.92+(sum/updates)*.22);}
    return {updates,strength01:this.state.consolidationBridgeStrength01};
  }
  private computeDistributionGap(){
    const totalPos=Math.max(1,this.state.positiveOutcomes),totalNeg=Math.max(1,this.state.negativeOutcomes);
    return clamp(ACTIONS.reduce((sum,a)=>sum+Math.abs((this.state.positiveActionCounts[a]??0)/totalPos-(this.state.negativeActionCounts[a]??0)/totalNeg),0)*.5);
  }
  diagnostics(){return {
    ...this.snapshot(),lesioned:this.lesioned,
    positiveActionDistribution:this.distribution(this.state.positiveActionCounts,this.state.positiveOutcomes),
    negativeActionDistribution:this.distribution(this.state.negativeActionCounts,this.state.negativeOutcomes),
    positiveVsNegativeGap01:this.state.actionDistributionGap01,
    neuralDelta01:this.state.neuralDelta01,personalityDelta01:this.state.personalityDelta01,policyDelta01:this.state.policyDelta01,
    developmentalDivergence01:clamp(this.state.actionDistributionGap01*.35+this.state.neuralDelta01*.22+this.state.personalityDelta01*.23+this.state.policyDelta01*.20),
    consolidationBridgeStrength01:this.state.consolidationBridgeStrength01,
    consolidationBridgeUpdates:this.state.consolidationBridgeUpdates
  };}
  private distribution(counts:Record<ActionKind,number>,total:number){return Object.fromEntries(ACTIONS.map(a=>[a,(counts[a]??0)/Math.max(1,total)])) as Record<ActionKind,number>;}
}

export {traitToAction};
