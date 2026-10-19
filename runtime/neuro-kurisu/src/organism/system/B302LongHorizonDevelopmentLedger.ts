import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const l1=(a:Record<string,number>,b:Record<string,number>)=>clamp01(.5*ACTIONS.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0));
const zeroActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export type B302EpochKind='baseline'|'exploration'|'verification'|'reflection'|'autonomous'|'mixed';

export interface B302EpochRecord{
  id:number; kind:B302EpochKind; startTick:number; endTick:number;
  pulses:number; microCycles:number; learningUpdates:number; synapticUpdates:number;
  verifiedUpdates:number; autonomousUpdates:number; meanReward01:number; meanPredictionError01:number;
  meanPersonalityInfluence01:number; meanNeuralPlasticity01:number; meanCausalIntegrity01:number;
  meanResourcePressure01:number; actionDistribution:Record<ActionKind,number>; consolidated:boolean;
}

export interface B302LongHorizonState{
  version:1; ticks:number; pulses:number; microCycles:number; learningUpdates:number; synapticUpdates:number;
  verifiedUpdates:number; autonomousUpdates:number; consolidationWindows:number; epochs:B302EpochRecord[];
  currentStartLearningUpdates:number; currentStartSynapticUpdates:number; currentStartVerifiedUpdates:number; currentStartAutonomousUpdates:number;
  currentEpochKind:B302EpochKind; currentEpochStartTick:number; currentEpochMicroCycles:number; currentActionCounts:Record<ActionKind,number>;
  currentRewards:number[]; currentPredictionErrors:number[]; currentPersonalityInfluence:number[];
  currentNeuralPlasticity:number[]; currentCausalIntegrity:number[]; currentResourcePressure:number[];
  baselineActionDistribution:Record<ActionKind,number>; recentActionDistribution:Record<ActionKind,number>;
  baselinePolicyBias:Record<ActionKind,number>; recentPolicyBias:Record<ActionKind,number>;
  behaviorShift01:number; personalityShift01:number; neuralPlasticityShift01:number; causalIntegrity01:number;
  autonomousBehaviorFraction01:number; consolidationHealth01:number; longHorizonReadiness01:number;
  maxResourcePressure01:number; lastConsolidationTick:number; lastReason:string;
}

export const defaultB302LongHorizonState=():B302LongHorizonState=>({
  version:1,ticks:0,pulses:0,microCycles:0,learningUpdates:0,synapticUpdates:0,verifiedUpdates:0,autonomousUpdates:0,
  consolidationWindows:0,epochs:[],currentStartLearningUpdates:0,currentStartSynapticUpdates:0,currentStartVerifiedUpdates:0,currentStartAutonomousUpdates:0,currentEpochKind:'baseline',currentEpochStartTick:0,currentEpochMicroCycles:0,currentActionCounts:zeroActions(),
  currentRewards:[],currentPredictionErrors:[],currentPersonalityInfluence:[],currentNeuralPlasticity:[],currentCausalIntegrity:[],currentResourcePressure:[],
  baselineActionDistribution:zeroActions(),recentActionDistribution:zeroActions(),baselinePolicyBias:zeroActions(),recentPolicyBias:zeroActions(),behaviorShift01:0,personalityShift01:0,neuralPlasticityShift01:0,
  causalIntegrity01:.5,autonomousBehaviorFraction01:0,consolidationHealth01:0,longHorizonReadiness01:0,maxResourcePressure01:0,lastConsolidationTick:0,lastReason:'initial',
});

/**
 * B302 is deliberately a coordinator/evidence ledger, not another learner.
 * It measures long-horizon change and requests bounded consolidation windows from
 * already-existing B285/B301 mechanisms through the host integration.
 */
export class B302LongHorizonDevelopmentLedger{
  private state=defaultB302LongHorizonState();
  restore(raw?:Partial<B302LongHorizonState>|null){
    const d=defaultB302LongHorizonState(),r:any=raw??{};
    const counts=zeroActions(); for(const a of ACTIONS) counts[a]=Math.max(0,Number(r.currentActionCounts?.[a]??0));
    const normalize=(v:any,max:number)=>Array.isArray(v)?v.map(Number).filter(Number.isFinite).slice(-max):[];
    this.state={...d,...r,version:1,currentActionCounts:counts,currentRewards:normalize(r.currentRewards,64),currentPredictionErrors:normalize(r.currentPredictionErrors,64),currentPersonalityInfluence:normalize(r.currentPersonalityInfluence,64),currentNeuralPlasticity:normalize(r.currentNeuralPlasticity,64),currentCausalIntegrity:normalize(r.currentCausalIntegrity,64),currentResourcePressure:normalize(r.currentResourcePressure,64),
      epochs:Array.isArray(r.epochs)?r.epochs.slice(-16):[],
      currentStartLearningUpdates:Math.max(0,Math.floor(Number(r.currentStartLearningUpdates??0))),
      currentStartSynapticUpdates:Math.max(0,Math.floor(Number(r.currentStartSynapticUpdates??0))),
      currentStartVerifiedUpdates:Math.max(0,Math.floor(Number(r.currentStartVerifiedUpdates??0))),
      currentStartAutonomousUpdates:Math.max(0,Math.floor(Number(r.currentStartAutonomousUpdates??0))),
      currentEpochMicroCycles:Math.max(0,Math.floor(Number(r.currentEpochMicroCycles??0))),
      baselineActionDistribution:{...d.baselineActionDistribution,...(r.baselineActionDistribution??{})},
      recentActionDistribution:{...d.recentActionDistribution,...(r.recentActionDistribution??{})},
      baselinePolicyBias:{...d.baselinePolicyBias,...(r.baselinePolicyBias??{})},
      recentPolicyBias:{...d.recentPolicyBias,...(r.recentPolicyBias??{})}};
  }
  snapshot(){return structuredClone(this.state);}
  setEpoch(kind:B302EpochKind,startTick:number){
    if(this.state.currentEpochKind===kind && this.state.currentEpochStartTick>0)return;
    this.closeEpoch(Math.max(this.state.currentEpochStartTick,startTick-1),false);
    this.state.currentEpochKind=kind; this.state.currentEpochStartTick=Math.max(1,Math.floor(startTick));
    this.state.currentStartLearningUpdates=this.state.learningUpdates; this.state.currentStartSynapticUpdates=this.state.synapticUpdates; this.state.currentStartVerifiedUpdates=this.state.verifiedUpdates; this.state.currentStartAutonomousUpdates=this.state.autonomousUpdates;
    this.state.currentEpochMicroCycles=0; this.state.currentActionCounts=zeroActions(); this.state.currentRewards=[]; this.state.currentPredictionErrors=[]; this.state.currentPersonalityInfluence=[]; this.state.currentNeuralPlasticity=[]; this.state.currentCausalIntegrity=[]; this.state.currentResourcePressure=[];
  }
  recordMicro(tick:number,resourcePressure01:number){
    this.state.ticks=Math.max(this.state.ticks,Math.floor(tick)); this.state.microCycles++; this.state.currentEpochMicroCycles++; this.state.currentResourcePressure=[...this.state.currentResourcePressure,clamp01(resourcePressure01)].slice(-64); this.state.maxResourcePressure01=Math.max(this.state.maxResourcePressure01,clamp01(resourcePressure01));
  }
  recordOutcome(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;personalityInfluence01:number;neuralPlasticity01:number;causalIntegrity01:number;resourcePressure01:number;learningUpdates:number;synapticUpdates:number;verified:boolean;autonomous:boolean;policyBias?:Partial<Record<ActionKind,number>>}){
    const tick=Math.max(0,Math.floor(input.tick)); const reward=clamp01(input.reward01),error=clamp01(input.predictionError01),pressure=clamp01(input.resourcePressure01);
    if(this.state.currentEpochStartTick<=0){
      this.state.currentEpochStartTick=Math.max(1,tick);
      this.state.currentStartLearningUpdates=this.state.learningUpdates;
      this.state.currentStartSynapticUpdates=this.state.synapticUpdates;
      this.state.currentStartVerifiedUpdates=this.state.verifiedUpdates;
      this.state.currentStartAutonomousUpdates=this.state.autonomousUpdates;
    }
    this.state.ticks=Math.max(this.state.ticks,tick); this.state.pulses++; this.state.learningUpdates=Math.max(this.state.learningUpdates,Math.floor(input.learningUpdates)); this.state.synapticUpdates=Math.max(this.state.synapticUpdates,Math.floor(input.synapticUpdates));
    if(input.verified)this.state.verifiedUpdates++; if(input.autonomous)this.state.autonomousUpdates++;
    this.state.currentActionCounts[input.action]=(this.state.currentActionCounts[input.action]??0)+1;
    this.state.currentRewards=[...this.state.currentRewards,reward].slice(-64); this.state.currentPredictionErrors=[...this.state.currentPredictionErrors,error].slice(-64);
    this.state.currentPersonalityInfluence=[...this.state.currentPersonalityInfluence,clamp01(input.personalityInfluence01)].slice(-64);
    this.state.currentNeuralPlasticity=[...this.state.currentNeuralPlasticity,clamp01(input.neuralPlasticity01)].slice(-64);
    this.state.currentCausalIntegrity=[...this.state.currentCausalIntegrity,clamp01(input.causalIntegrity01)].slice(-64);
    this.state.currentResourcePressure=[...this.state.currentResourcePressure,pressure].slice(-64); this.state.maxResourcePressure01=Math.max(this.state.maxResourcePressure01,pressure);
    const distribution=this.distribution(this.state.currentActionCounts); if(this.state.pulses===1)this.state.baselineActionDistribution={...distribution}; this.state.recentActionDistribution={...distribution};
    const policy={...zeroActions(),...(input.policyBias??{})}; if(this.state.pulses===1)this.state.baselinePolicyBias={...policy}; this.state.recentPolicyBias={...policy};
    const policyShift=.5*ACTIONS.reduce((sum,a)=>sum+Math.abs((this.state.baselinePolicyBias[a]??0)-(this.state.recentPolicyBias[a]??0)),0);
    this.state.behaviorShift01=clamp01(Math.max(l1(this.state.baselineActionDistribution,this.state.recentActionDistribution),policyShift));
    this.state.personalityShift01=clamp01(mean(this.state.currentPersonalityInfluence)*1.6);
    this.state.neuralPlasticityShift01=clamp01(mean(this.state.currentNeuralPlasticity));
    this.state.causalIntegrity01=clamp01(mean(this.state.currentCausalIntegrity));
    this.state.autonomousBehaviorFraction01=clamp01(this.state.autonomousUpdates/Math.max(1,this.state.pulses));
    if(this.state.pulses%24===0){ this.closeEpoch(tick,true); this.state.currentEpochStartTick=tick+1; this.state.currentEpochMicroCycles=0; this.state.currentActionCounts=zeroActions(); this.state.currentRewards=[]; this.state.currentPredictionErrors=[]; this.state.currentPersonalityInfluence=[]; this.state.currentNeuralPlasticity=[]; this.state.currentCausalIntegrity=[]; this.state.currentResourcePressure=[]; }
  }
  private distribution(counts:Record<ActionKind,number>){const total=Math.max(1,ACTIONS.reduce((s,a)=>s+(counts[a]??0),0));return Object.fromEntries(ACTIONS.map(a=>[a,(counts[a]??0)/total])) as Record<ActionKind,number>;}
  closeEpoch(endTick:number,consolidated:boolean){
    if(this.state.currentEpochStartTick<=0 || (this.state.pulses===0 && this.state.microCycles===0))return null;
    const total=Math.max(1,ACTIONS.reduce((s,a)=>s+(this.state.currentActionCounts[a]??0),0));
    const record:B302EpochRecord={
      id:this.state.epochs.length+1,kind:this.state.currentEpochKind,startTick:this.state.currentEpochStartTick,
      endTick:Math.max(this.state.currentEpochStartTick,Math.floor(endTick)),
      pulses:Math.max(0,ACTIONS.reduce((s,a)=>s+(this.state.currentActionCounts[a]??0),0)),
      microCycles:this.state.currentEpochMicroCycles,
      learningUpdates:Math.max(0,this.state.learningUpdates-this.state.currentStartLearningUpdates),
      synapticUpdates:Math.max(0,this.state.synapticUpdates-this.state.currentStartSynapticUpdates),
      verifiedUpdates:Math.max(0,this.state.verifiedUpdates-this.state.currentStartVerifiedUpdates),
      autonomousUpdates:Math.max(0,this.state.autonomousUpdates-this.state.currentStartAutonomousUpdates),
      meanReward01:mean(this.state.currentRewards),meanPredictionError01:mean(this.state.currentPredictionErrors),
      meanPersonalityInfluence01:mean(this.state.currentPersonalityInfluence),meanNeuralPlasticity01:mean(this.state.currentNeuralPlasticity),
      meanCausalIntegrity01:mean(this.state.currentCausalIntegrity),meanResourcePressure01:mean(this.state.currentResourcePressure),
      actionDistribution:Object.fromEntries(ACTIONS.map(a=>[a,(this.state.currentActionCounts[a]??0)/total])) as Record<ActionKind,number>,
      consolidated};
    this.state.epochs=[...this.state.epochs,record].slice(-16);
    if(consolidated){this.state.consolidationWindows++;this.state.lastConsolidationTick=record.endTick;}
    this.state.consolidationHealth01=clamp01(mean([1-record.meanPredictionError01,record.meanCausalIntegrity01,record.meanNeuralPlasticity01,record.meanPersonalityInfluence01+0.05]));
    this.state.longHorizonReadiness01=clamp01(this.state.consolidationWindows/4*.28+this.state.behaviorShift01*.24+this.state.autonomousBehaviorFraction01*.22+this.state.consolidationHealth01*.26);
    this.state.lastReason=consolidated?'scheduled-consolidation-window':'epoch-boundary';
    return record;
  }
  diagnostics(){return {...this.snapshot(),currentDistribution:this.distribution(this.state.currentActionCounts),epochCount:this.state.epochs.length};}
}
