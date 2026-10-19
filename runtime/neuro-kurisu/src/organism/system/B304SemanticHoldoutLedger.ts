import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const zeroActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
const l1=(a:Record<ActionKind,number>,b:Record<ActionKind,number>)=>clamp01(.5*ACTIONS.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0));

export type B304SemanticPhase='training'|'holdout'|'recovery';

export interface B304SemanticFamilyRecord{
  family:string;
  phase:B304SemanticPhase;
  pulses:number;
  verified:number;
  autonomous:number;
  meanReward01:number;
  meanPredictionError01:number;
  meanNeuralPlasticity01:number;
  meanCausalIntegrity01:number;
  maxResourcePressure01:number;
  actionDistribution:Record<ActionKind,number>;
  lastTick:number;
}

export interface B304SemanticHoldoutState{
  version:1;
  ticks:number;
  trainingPulses:number;
  holdoutPulses:number;
  recoveryPulses:number;
  trainingFamilyCount:number;
  holdoutFamilyCount:number;
  novelHoldoutFamilyRate01:number;
  familyTransferScore01:number;
  holdoutCoherence01:number;
  resourceBudgetCompliance01:number;
  resourcePressureMean01:number;
  resourcePressureP95_01:number;
  neuralPlasticityMean01:number;
  causalIntegrityMean01:number;
  autonomyRate01:number;
  evidenceRate01:number;
  policyTransfer01:number;
  evaluationReadiness01:number;
  trainingActionDistribution:Record<ActionKind,number>;
  holdoutActionDistribution:Record<ActionKind,number>;
  trainingBias:Record<ActionKind,number>;
  holdoutBias:Record<ActionKind,number>;
  trainingFamilies:string[];
  holdoutFamilies:string[];
  recoveryFamilies:string[];
  familyRecords:B304SemanticFamilyRecord[];
  recentResourcePressure01:number[];
  recentRewards01:number[];
  recentPredictionErrors01:number[];
  lastPhase:B304SemanticPhase;
  lastReason:string;
}

export const defaultB304SemanticHoldoutState=():B304SemanticHoldoutState=>({
  version:1,ticks:0,trainingPulses:0,holdoutPulses:0,recoveryPulses:0,trainingFamilyCount:0,holdoutFamilyCount:0,
  novelHoldoutFamilyRate01:0,familyTransferScore01:0,holdoutCoherence01:0,resourceBudgetCompliance01:0,resourcePressureMean01:0,
  resourcePressureP95_01:0,neuralPlasticityMean01:0,causalIntegrityMean01:.5,autonomyRate01:0,evidenceRate01:0,policyTransfer01:0,
  evaluationReadiness01:0,trainingActionDistribution:zeroActions(),holdoutActionDistribution:zeroActions(),trainingBias:zeroActions(),holdoutBias:zeroActions(),
  trainingFamilies:[],holdoutFamilies:[],recoveryFamilies:[],familyRecords:[],recentResourcePressure01:[],recentRewards01:[],recentPredictionErrors01:[],lastPhase:'training',lastReason:'initial',
});

/**
 * B304 is evaluation-only. It does not learn, alter policy, or create another personality store.
 * It measures transfer across semantic task families that are hidden from the organism.
 */
export class B304SemanticHoldoutLedger{
  private state=defaultB304SemanticHoldoutState();
  private phase:B304SemanticPhase='training';

  restore(raw?:Partial<B304SemanticHoldoutState>|null){
    const d=defaultB304SemanticHoldoutState(),r:any=raw??{};
    const counts=(src:any)=>{const out=zeroActions();for(const a of ACTIONS)out[a]=signed(Number(src?.[a]??0));return out;};
    const dist=(src:any)=>{const out=zeroActions();for(const a of ACTIONS)out[a]=clamp01(Number(src?.[a]??0));return out;};
    const arr=(v:any,max:number)=>Array.isArray(v)?v.map(Number).filter(Number.isFinite).slice(-max):[];
    this.state={...d,...r,version:1,
      trainingActionDistribution:{...d.trainingActionDistribution,...dist(r.trainingActionDistribution)},
      holdoutActionDistribution:{...d.holdoutActionDistribution,...dist(r.holdoutActionDistribution)},
      trainingBias:{...d.trainingBias,...counts(r.trainingBias)},holdoutBias:{...d.holdoutBias,...counts(r.holdoutBias)},
      trainingFamilies:Array.isArray(r.trainingFamilies)?r.trainingFamilies.map(String).filter(Boolean).slice(-32):[],
      holdoutFamilies:Array.isArray(r.holdoutFamilies)?r.holdoutFamilies.map(String).filter(Boolean).slice(-32):[],
      recoveryFamilies:Array.isArray(r.recoveryFamilies)?r.recoveryFamilies.map(String).filter(Boolean).slice(-32):[],
      familyRecords:Array.isArray(r.familyRecords)?r.familyRecords.slice(-24):[],
      recentResourcePressure01:arr(r.recentResourcePressure01,128),recentRewards01:arr(r.recentRewards01,128),recentPredictionErrors01:arr(r.recentPredictionErrors01,128),
      lastPhase:(r.lastPhase==='holdout'||r.lastPhase==='recovery')?r.lastPhase:'training',
    };
    this.recompute();
    this.phase=this.state.lastPhase;
  }
  snapshot(){return structuredClone(this.state);}
  setPhase(phase:B304SemanticPhase,reason='manual'){this.phase=phase;this.state.lastPhase=phase;this.state.lastReason=reason;}

  recordOutcome(input:{tick:number;family:string;action:ActionKind;reward01:number;predictionError01:number;verified:boolean;autonomous:boolean;neuralPlasticity01:number;causalIntegrity01:number;resourcePressure01:number;policyBias?:Partial<Record<ActionKind,number>>}){
    const tick=Math.max(0,Math.floor(input.tick));
    const family=String(input.family||'unknown').trim().toLowerCase()||'unknown';
    const reward=clamp01(input.reward01),error=clamp01(input.predictionError01),pressure=clamp01(input.resourcePressure01);
    this.state.ticks=Math.max(this.state.ticks,tick);
    if(this.phase==='training'){this.state.trainingPulses++;if(!this.state.trainingFamilies.includes(family))this.state.trainingFamilies=[...this.state.trainingFamilies,family].slice(-32);}
    else if(this.phase==='holdout'){this.state.holdoutPulses++;if(!this.state.holdoutFamilies.includes(family))this.state.holdoutFamilies=[...this.state.holdoutFamilies,family].slice(-32);}
    else {this.state.recoveryPulses++;if(!this.state.recoveryFamilies.includes(family))this.state.recoveryFamilies=[...this.state.recoveryFamilies,family].slice(-32);}
    this.state.recentResourcePressure01=[...this.state.recentResourcePressure01,pressure].slice(-128);
    this.state.recentRewards01=[...this.state.recentRewards01,reward].slice(-128);
    this.state.recentPredictionErrors01=[...this.state.recentPredictionErrors01,error].slice(-128);
    const policy={...zeroActions(),...(input.policyBias??{})} as Record<ActionKind,number>;
    const bucket=this.state.familyRecords.find(r=>r.family===family&&r.phase===this.phase);
    if(bucket){
      bucket.pulses++;bucket.verified+=input.verified?1:0;bucket.autonomous+=input.autonomous?1:0;
      bucket.meanReward01=(bucket.meanReward01*(bucket.pulses-1)+reward)/bucket.pulses;
      bucket.meanPredictionError01=(bucket.meanPredictionError01*(bucket.pulses-1)+error)/bucket.pulses;
      bucket.meanNeuralPlasticity01=(bucket.meanNeuralPlasticity01*(bucket.pulses-1)+clamp01(input.neuralPlasticity01))/bucket.pulses;
      bucket.meanCausalIntegrity01=(bucket.meanCausalIntegrity01*(bucket.pulses-1)+clamp01(input.causalIntegrity01))/bucket.pulses;
      bucket.maxResourcePressure01=Math.max(bucket.maxResourcePressure01,pressure);bucket.actionDistribution[input.action]=(bucket.actionDistribution[input.action]??0)+1;bucket.lastTick=tick;
    } else {
      this.state.familyRecords=[...this.state.familyRecords,{family,phase:this.phase,pulses:1,verified:input.verified?1:0,autonomous:input.autonomous?1:0,meanReward01:reward,meanPredictionError01:error,meanNeuralPlasticity01:clamp01(input.neuralPlasticity01),meanCausalIntegrity01:clamp01(input.causalIntegrity01),maxResourcePressure01:pressure,actionDistribution:{...zeroActions(),[input.action]:1},lastTick:tick}].slice(-24);
    }
    const counts=this.state.familyRecords.filter(r=>r.phase===this.phase).reduce((m,r)=>{for(const a of ACTIONS)m[a]=(m[a]??0)+(r.actionDistribution[a]??0);return m;},zeroActions());
    const total=Math.max(1,ACTIONS.reduce((s,a)=>s+counts[a],0));
    const distribution=Object.fromEntries(ACTIONS.map(a=>[a,(counts[a]??0)/total])) as Record<ActionKind,number>;
    if(this.phase==='training'){this.state.trainingActionDistribution=distribution;this.state.trainingBias=policy;}
    if(this.phase==='holdout'){this.state.holdoutActionDistribution=distribution;this.state.holdoutBias=policy;}
    this.recompute();
  }

  private recompute(){
    this.state.trainingFamilyCount=this.state.trainingFamilies.length;this.state.holdoutFamilyCount=this.state.holdoutFamilies.length;
    const novel=this.state.holdoutFamilies.filter(f=>!this.state.trainingFamilies.includes(f)).length;
    this.state.novelHoldoutFamilyRate01=this.state.holdoutFamilies.length?novel/this.state.holdoutFamilies.length:0;
    const hold=this.state.familyRecords.filter(r=>r.phase==='holdout');
    const train=this.state.familyRecords.filter(r=>r.phase==='training');
    const hN=Math.max(1,hold.reduce((s,r)=>s+r.pulses,0)),tN=Math.max(1,train.reduce((s,r)=>s+r.pulses,0));
    const hReward=mean(hold.map(r=>r.meanReward01)),tReward=mean(train.map(r=>r.meanReward01));
    const hErr=mean(hold.map(r=>r.meanPredictionError01));
    const hCausal=mean(hold.map(r=>r.meanCausalIntegrity01));
    const hPlastic=mean(hold.map(r=>r.meanNeuralPlasticity01));
    const hAut=hold.length?hold.reduce((s,r)=>s+r.autonomous,0)/hN:0;
    const hVer=hold.length?hold.reduce((s,r)=>s+r.verified,0)/hN:0;
    this.state.holdoutCoherence01=clamp01(hReward*.45+(1-hErr)*.20+hCausal*.25+hPlastic*.10);
    this.state.familyTransferScore01=clamp01(.55*this.state.novelHoldoutFamilyRate01+.45*clamp01(hReward-.1));
    const pressure=this.state.recentResourcePressure01;
    const sorted=[...pressure].sort((a,b)=>a-b);const p95=sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]:0;
    this.state.resourcePressureMean01=mean(pressure);this.state.resourcePressureP95_01=p95;
    this.state.resourceBudgetCompliance01=clamp01(1-.72*p95-.28*this.state.resourcePressureMean01);
    this.state.neuralPlasticityMean01=hPlastic;this.state.causalIntegrityMean01=hCausal;this.state.autonomyRate01=hAut;this.state.evidenceRate01=hVer;
    this.state.policyTransfer01=clamp01(1-l1(this.state.trainingActionDistribution,this.state.holdoutActionDistribution));
    const rewardRetention=clamp01(.5+(hReward-tReward));
    this.state.familyTransferScore01=clamp01(this.state.familyTransferScore01*.55+rewardRetention*.45);
    this.state.evaluationReadiness01=clamp01(this.state.novelHoldoutFamilyRate01*.22+this.state.holdoutCoherence01*.24+this.state.resourceBudgetCompliance01*.20+hCausal*.16+hPlastic*.10+(hVer+hAut)*.04);
  }

  diagnostics(){return this.snapshot();}
}
