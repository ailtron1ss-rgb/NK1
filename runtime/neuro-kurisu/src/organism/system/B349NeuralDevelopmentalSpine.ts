import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const actionIndex=(a:ActionKind|null|undefined)=>a==null?-1:ACTIONS.indexOf(a);
const seeded=(seed:number,scale=.18)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return (((x>>>0)/0xffffffff)*2-1)*scale;};

export interface B349State {
  version:1;
  cycles:number;
  outcomeUpdates:number;
  learningUpdates:number;
  actionWeights:Record<ActionKind,number>;
  actionEligibility:Record<ActionKind,number>;
  actionReliability:Record<ActionKind,number>;
  lastAction:ActionKind|null;
  lastFeature01:Record<string,number>;
  lastNeuralContribution01:number;
  lastIntegration01:number;
  lastPredictionError01:number;
  meanCausalGain01:number;
  cumulativeCausalGain01:number;
  validatedOutcomeCount:number;
  suppressedUpdateCount:number;
  lateResidencyUpdates:number;
  lateResidencyChanges:number;
  lastLateResidencyAction:ActionKind|null;
  lastLateResidencyBias01:number;
  history:Array<{tick:number;action:ActionKind|null;reward01:number;predictionError01:number;causalGain01:number}>;
}

export interface B349StepInput {
  tick:number;
  candidates:ActionKind[];
  b269Assembly:number[];
  b269Plasticity01:number;
  b289Latent:number[];
  b289Integration01:number;
  b293PredictedSelf01:number;
  b293PredictedWorld01:number;
  b293PredictionError01:number;
  b294CausalConfidence01:number;
  b296ActionBias:Partial<Record<ActionKind,number>>;
  b296Agency01:number;
  identityContinuity01:number;
  goalPressure01:number;
  novelty01:number;
  uncertainty01:number;
  energy01:number;
  learningEnabled:boolean;
  externalInput01:number;
  finalizationContext01?:number;
}

export interface B349StepResult {
  actionBias:Record<ActionKind,number>;
  neuralContribution01:number;
  integration01:number;
  predictionError01:number;
  causalReadiness01:number;
  selectedNeuralAction:ActionKind|null;
  residencyStrength01:number;
}

export const defaultB349State=():B349State=>({
  version:1,cycles:0,outcomeUpdates:0,learningUpdates:0,
  actionWeights:Object.fromEntries(ACTIONS.map((a,i)=>[a,seeded(349_000+i,.035)])) as Record<ActionKind,number>,
  actionEligibility:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  actionReliability:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>,
  lastAction:null,lastFeature01:{},lastNeuralContribution01:0,lastIntegration01:0,lastPredictionError01:.5,
  meanCausalGain01:0,cumulativeCausalGain01:0,validatedOutcomeCount:0,suppressedUpdateCount:0,
  lateResidencyUpdates:0,lateResidencyChanges:0,lastLateResidencyAction:null,lastLateResidencyBias01:0,history:[]
});

export class B349NeuralDevelopmentalSpine {
  private state=B349NeuralDevelopmentalSpine.normalize(defaultB349State());

  private static normalize(raw?:Partial<B349State>|null):B349State{
    const d=defaultB349State(),r=raw??{};
    const weights={...d.actionWeights,...(r.actionWeights??{})} as Record<ActionKind,number>;
    const elig={...d.actionEligibility,...(r.actionEligibility??{})} as Record<ActionKind,number>;
    const rel={...d.actionReliability,...(r.actionReliability??{})} as Record<ActionKind,number>;
    for(const a of ACTIONS){weights[a]=clamp11(Number(weights[a]??0));elig[a]=clamp01(Number(elig[a]??0));rel[a]=clamp01(Number(rel[a]??.5));}
    return {...d,...r,version:1,actionWeights:weights,actionEligibility:elig,actionReliability:rel,lastFeature01:{...(r.lastFeature01??{})},
      lateResidencyUpdates:Number(r.lateResidencyUpdates??d.lateResidencyUpdates),
      lateResidencyChanges:Number(r.lateResidencyChanges??d.lateResidencyChanges),
      lastLateResidencyAction:(r.lastLateResidencyAction??d.lastLateResidencyAction) as ActionKind|null,
      lastLateResidencyBias01:clamp11(Number(r.lastLateResidencyBias01??d.lastLateResidencyBias01)),
      history:Array.isArray(r.history)?r.history.slice(-256):[]};
  }

  restore(raw?:Partial<B349State>|null){this.state=B349NeuralDevelopmentalSpine.normalize(raw);}
  snapshot(){return structuredClone(this.state);}

  step(input:B349StepInput):B349StepResult{
    const assembly=Math.max(0,Math.min(1,mean((input.b269Assembly??[]).map(Math.abs))));
    const latent=Math.max(0,Math.min(1,mean((input.b289Latent??[]).map(Math.abs))));
    const predictionConfidence=clamp01(1-.5*(input.b293PredictionError01));
    const causalReadiness=clamp01(.26*input.b294CausalConfidence01+.20*input.b269Plasticity01+.18*input.b289Integration01+.14*predictionConfidence+.10*input.identityContinuity01+.07*input.b296Agency01+.05*(1-input.uncertainty01));
    const integration=clamp01(.24*assembly+.18*latent+.18*input.b289Integration01+.15*predictionConfidence+.11*input.b294CausalConfidence01+.08*input.identityContinuity01+.06*input.b269Plasticity01);
    const predictionError=clamp01(.45*input.b293PredictionError01+.30*(1-predictionConfidence)+.15*input.uncertainty01+.10*(1-input.b294CausalConfidence01));
    const activityDrive=clamp11((assembly-.12)*1.8+(latent-.15)*.7+(input.novelty01-.35)*.30+(input.goalPressure01-.35)*.40);
    const neuralContribution=clamp01(.42*causalReadiness+.28*integration+.18*(1-predictionError)+.12*(input.learningEnabled?1:0));
    const feature01={assembly,integration,causalReadiness,predictionConfidence,predictionError,activityDrive,identity:clamp01(input.identityContinuity01),goal:clamp01(input.goalPressure01),novelty:clamp01(input.novelty01),energy:clamp01(input.energy01)};
    const actionBias=Object.fromEntries(ACTIONS.map((action,i)=>{
      const prior=this.state.actionWeights[action]??0;
      const priorReliability=this.state.actionReliability[action]??.5;
      const externalDamping=input.externalInput01>.5?.92:1;
      const inherited=clamp11(input.b296ActionBias?.[action]??0);
      const actionSeed=seeded(349_700+i*31,.035);
      const context=clamp11(
        .34*prior+
        .24*inherited+
        .10*(input.b293PredictedWorld01-.5)+
        .10*(input.b293PredictedSelf01-.5)+
        .08*(priorReliability-.5)+
        .05*activityDrive+
        .04*(input.goalPressure01-.5)+
        .03*(input.identityContinuity01-.5)+
        actionSeed*.35
      );
      return [action,clamp11(context*(.58+.42*neuralContribution)*externalDamping)];
    })) as Record<ActionKind,number>;
    const selectedNeuralAction=input.candidates.length
      ? input.candidates.slice().sort((a,b)=>Math.abs(actionBias[b])-Math.abs(actionBias[a]))[0]??null
      : null;
    const current= input.candidates.indexOf(this.state.lastAction as ActionKind)>=0 ? this.state.lastAction : null;
    for(const a of ACTIONS){
      const active=a===current||a===selectedNeuralAction;
      const eligibilityTarget=active ? clamp01(.25+.45*neuralContribution+.30*causalReadiness) : 0;
      this.state.actionEligibility[a]=clamp01((this.state.actionEligibility[a]??0)*.91+eligibilityTarget*.09);
    }
    this.state.cycles++;
    this.state.lastAction=current;
    this.state.lastFeature01=feature01;
    this.state.lastNeuralContribution01=neuralContribution;
    this.state.lastIntegration01=integration;
    this.state.lastPredictionError01=predictionError;
    this.state.meanCausalGain01=this.state.cycles===1?neuralContribution:this.state.meanCausalGain01*.98+neuralContribution*.02;
    const residencyStrength01=clamp01(.28*neuralContribution+.26*causalReadiness+.20*integration+.16*predictionConfidence+.10*(1-input.uncertainty01));
    return {actionBias,neuralContribution01:neuralContribution,integration01:integration,predictionError01:predictionError,causalReadiness01:causalReadiness,selectedNeuralAction,residencyStrength01};
  }

  /** Late-stage neural residency keeps verified neural learning causally visible near final choice.
   * This is intentionally bounded so governance/constitutional rules remain dominant.
   */
  lateResidencyBias(action:ActionKind, context01=1){
    const d=this.state;
    const weight=clamp11(d.actionWeights[action]??0);
    const reliability=clamp01(d.actionReliability[action]??.5);
    const maturity=clamp01(.45*d.lastNeuralContribution01+.30*d.meanCausalGain01+.15*reliability+.10*context01);
    const magnitude=Math.min(.065,.010+.055*maturity);
    const bias=clamp11(weight*(.55+.45*reliability))*magnitude;
    return bias;
  }

  applyLateResidency(actions:ActionKind[], context01=1){
    const out=Object.fromEntries(actions.map(a=>[a,this.lateResidencyBias(a,context01)])) as Record<ActionKind,number>;
    const strongest=actions.slice().sort((a,b)=>Math.abs(out[b])-Math.abs(out[a]))[0]??null;
    const strongestBias=strongest?out[strongest]:0;
    this.state.lateResidencyUpdates++;
    this.state.lateResidencyChanges+=actions.filter(a=>Math.abs(out[a])>.012).length;
    this.state.lastLateResidencyAction=strongest;
    this.state.lastLateResidencyBias01=strongestBias;
    return {biasByAction:out,strongestAction:strongest,strongestBias01:strongestBias,enabled:Math.abs(strongestBias)>.012};
  }

  learnFromOutcome(input:{tick:number;action:ActionKind|null;reward01:number;predictionError01:number;verified01:number;independent01:number;autonomous01:number}){
    const action=input.action;
    if(!action||actionIndex(action)<0){this.state.suppressedUpdateCount++;return {updated:false,learningRate01:0,causalGain01:this.state.lastNeuralContribution01};}
    const rewardSigned=clamp11(clamp01(input.reward01)*2-1);
    const evidence=clamp01(.40*input.verified01+.32*input.independent01+.28*input.autonomous01);
    const surprise=clamp01(input.predictionError01);
    const eligibility=this.state.actionEligibility[action]??0;
    const causalGain=clamp01(.20+.45*this.state.lastNeuralContribution01+.20*evidence+.15*(1-surprise));
    const teaching=clamp11(rewardSigned*.64+(1-surprise-.5)*.46+(evidence-.5)*.22);
    const lr=.012+.022*causalGain+.010*eligibility;
    const delta=teaching*lr*eligibility;
    this.state.actionWeights[action]=clamp11((this.state.actionWeights[action]??0)+delta);
    const targetReliability=clamp01(.5+.45*(rewardSigned>0?1:0)+.05*evidence);
    this.state.actionReliability[action]=clamp01((this.state.actionReliability[action]??.5)*.96+targetReliability*.04);
    this.state.learningUpdates++;this.state.outcomeUpdates++;this.state.validatedOutcomeCount+=evidence>.55?1:0;
    this.state.cumulativeCausalGain01+=causalGain;
    this.state.history=[...this.state.history,{tick:input.tick,action,reward01:clamp01(input.reward01),predictionError01:surprise,causalGain01:causalGain}].slice(-256);
    return {updated:true,learningRate01:lr,delta,causalGain01:causalGain,evidence01:evidence};
  }

  actionBias(action:ActionKind){return clamp11((this.state.actionWeights[action]??0)*(.55+.45*(this.state.actionReliability[action]??.5)));}
  diagnostics(){
    const meanReliability=mean(ACTIONS.map(a=>this.state.actionReliability[a]??.5));
    return {version:1,cycles:this.state.cycles,outcomeUpdates:this.state.outcomeUpdates,learningUpdates:this.state.learningUpdates,actionWeights:{...this.state.actionWeights},actionEligibility:{...this.state.actionEligibility},actionReliability:{...this.state.actionReliability},lastAction:this.state.lastAction,lastNeuralContribution01:this.state.lastNeuralContribution01,lastIntegration01:this.state.lastIntegration01,lastPredictionError01:this.state.lastPredictionError01,meanCausalGain01:this.state.meanCausalGain01,validatedOutcomeCount:this.state.validatedOutcomeCount,suppressedUpdateCount:this.state.suppressedUpdateCount,lateResidencyUpdates:this.state.lateResidencyUpdates,lateResidencyChanges:this.state.lateResidencyChanges,lastLateResidencyAction:this.state.lastLateResidencyAction,
    lastLateResidencyBias01:this.state.lastLateResidencyBias01,meanActionReliability01:meanReliability,historyDepth:this.state.history.length};
  }
}
