import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const l1=(a:Record<string,number>,b:Record<string,number>)=>clamp01(.5*ACTIONS.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0));
const zeroActions=()=>Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;

export type B303EvaluationPhase='training'|'holdout'|'recovery';

export interface B303HoldoutState{
  version:1;
  ticks:number;
  trainingPulses:number;
  holdoutPulses:number;
  recoveryPulses:number;
  verifiedHoldoutUpdates:number;
  autonomousHoldoutUpdates:number;
  trainingActionDistribution:Record<ActionKind,number>;
  holdoutActionDistribution:Record<ActionKind,number>;
  recoveryActionDistribution:Record<ActionKind,number>;
  trainingBias:Record<ActionKind,number>;
  holdoutBias:Record<ActionKind,number>;
  recoveryBias:Record<ActionKind,number>;
  holdoutRewards:number[];
  holdoutPredictionErrors:number[];
  holdoutResourcePressure:number[];
  holdoutNeuralPlasticity:number[];
  holdoutCausalIntegrity:number[];
  holdoutPolicyShift01:number;
  holdoutDistributionGap01:number;
  holdoutCoherence01:number;
  holdoutEvidenceRate01:number;
  holdoutAutonomyRate01:number;
  recoveryStability01:number;
  unseenTransferScore01:number;
  evaluationReadiness01:number;
  maxHoldoutResourcePressure01:number;
  contextFingerprints:string[];
  trainingContextFingerprints:string[];
  holdoutContextFingerprints:string[];
  holdoutNovelContextRate01:number;
  lastPhase:B303EvaluationPhase;
  lastReason:string;
}

export const defaultB303HoldoutState=():B303HoldoutState=>({
  version:1,ticks:0,trainingPulses:0,holdoutPulses:0,recoveryPulses:0,verifiedHoldoutUpdates:0,autonomousHoldoutUpdates:0,
  trainingActionDistribution:zeroActions(),holdoutActionDistribution:zeroActions(),recoveryActionDistribution:zeroActions(),
  trainingBias:zeroActions(),holdoutBias:zeroActions(),recoveryBias:zeroActions(),
  holdoutRewards:[],holdoutPredictionErrors:[],holdoutResourcePressure:[],holdoutNeuralPlasticity:[],holdoutCausalIntegrity:[],
  holdoutPolicyShift01:0,holdoutDistributionGap01:0,holdoutCoherence01:0,holdoutEvidenceRate01:0,holdoutAutonomyRate01:0,
  recoveryStability01:0,unseenTransferScore01:0,evaluationReadiness01:0,maxHoldoutResourcePressure01:0,contextFingerprints:[],trainingContextFingerprints:[],holdoutContextFingerprints:[],holdoutNovelContextRate01:0,lastPhase:'training',lastReason:'initial'
});

/**
 * B303 is an evaluation-only ledger. It does not learn and does not add another
 * personality policy. It measures whether already-learned behavior remains
 * coherent when evaluated on an unseen context family and after restore.
 */
export class B303HoldoutGeneralizationLedger{
  private state=defaultB303HoldoutState();
  private phase:B303EvaluationPhase='training';

  restore(raw?:Partial<B303HoldoutState>|null){
    const d=defaultB303HoldoutState(),r:any=raw??{};
    const counts=(src:any,signed=false)=>{const out=zeroActions();for(const a of ACTIONS)out[a]=signed?clampSigned(Number(src?.[a]??0)):clamp01(Number(src?.[a]??0));return out;};
    const normalize=(v:any,max:number)=>Array.isArray(v)?v.map(Number).filter(Number.isFinite).slice(-max):[];
    this.state={...d,...r,version:1,
      trainingActionDistribution:{...d.trainingActionDistribution,...counts(r.trainingActionDistribution)},
      holdoutActionDistribution:{...d.holdoutActionDistribution,...counts(r.holdoutActionDistribution)},
      recoveryActionDistribution:{...d.recoveryActionDistribution,...counts(r.recoveryActionDistribution)},
      trainingBias:{...d.trainingBias,...counts(r.trainingBias,true)},holdoutBias:{...d.holdoutBias,...counts(r.holdoutBias,true)},recoveryBias:{...d.recoveryBias,...counts(r.recoveryBias,true)},
      holdoutRewards:normalize(r.holdoutRewards,96),holdoutPredictionErrors:normalize(r.holdoutPredictionErrors,96),holdoutResourcePressure:normalize(r.holdoutResourcePressure,96),
      holdoutNeuralPlasticity:normalize(r.holdoutNeuralPlasticity,96),holdoutCausalIntegrity:normalize(r.holdoutCausalIntegrity,96),
      contextFingerprints:Array.isArray(r.contextFingerprints)?r.contextFingerprints.map(String).slice(-32):[],
      trainingContextFingerprints:Array.isArray(r.trainingContextFingerprints)?r.trainingContextFingerprints.map(String).slice(-48):[],
      holdoutContextFingerprints:Array.isArray(r.holdoutContextFingerprints)?r.holdoutContextFingerprints.map(String).slice(-48):[],
      holdoutNovelContextRate01:clamp01(Number(r.holdoutNovelContextRate01??0)),
      lastPhase:(r.lastPhase==='holdout'||r.lastPhase==='recovery')?r.lastPhase:'training'};
    this.phase=this.state.lastPhase;
  }
  snapshot(){return structuredClone(this.state);}
  setPhase(phase:B303EvaluationPhase,reason='manual'){this.phase=phase;this.state.lastPhase=phase;this.state.lastReason=reason;}
  private distribution(counts:Record<ActionKind,number>){const total=Math.max(1,ACTIONS.reduce((s,a)=>s+(counts[a]??0),0));return Object.fromEntries(ACTIONS.map(a=>[a,(counts[a]??0)/total])) as Record<ActionKind,number>;}
  recordOutcome(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified:boolean;autonomous:boolean;policyBias?:Partial<Record<ActionKind,number>>;resourcePressure01:number;neuralPlasticity01:number;causalIntegrity01:number;contextFingerprint?:string}){
    const tick=Math.max(0,Math.floor(input.tick));
    const action=input.action; const reward=clamp01(input.reward01), error=clamp01(input.predictionError01), pressure=clamp01(input.resourcePressure01);
    this.state.ticks=Math.max(this.state.ticks,tick);
    const policy={...zeroActions(),...(input.policyBias??{})} as Record<ActionKind,number>;
    if(input.contextFingerprint)this.state.contextFingerprints=[...this.state.contextFingerprints,input.contextFingerprint].slice(-32);
    if(this.phase==='training'){
      if(input.contextFingerprint)this.state.trainingContextFingerprints=[...this.state.trainingContextFingerprints,input.contextFingerprint].slice(-48);
      this.state.trainingPulses++;
      this.state.trainingActionDistribution[action]=(this.state.trainingActionDistribution[action]??0)+1;
      for(const a of ACTIONS)this.state.trainingBias[a]=(this.state.trainingBias[a]??0)*.92+Number(policy[a]??0)*.08;
    }else if(this.phase==='holdout'){
      if(input.contextFingerprint)this.state.holdoutContextFingerprints=[...this.state.holdoutContextFingerprints,input.contextFingerprint].slice(-48);
      this.state.holdoutPulses++;
      this.state.holdoutActionDistribution[action]=(this.state.holdoutActionDistribution[action]??0)+1;
      if(input.verified)this.state.verifiedHoldoutUpdates++;
      if(input.autonomous)this.state.autonomousHoldoutUpdates++;
      this.state.holdoutRewards=[...this.state.holdoutRewards,reward].slice(-96);
      this.state.holdoutPredictionErrors=[...this.state.holdoutPredictionErrors,error].slice(-96);
      this.state.holdoutResourcePressure=[...this.state.holdoutResourcePressure,pressure].slice(-96);
      this.state.holdoutNeuralPlasticity=[...this.state.holdoutNeuralPlasticity,clamp01(input.neuralPlasticity01)].slice(-96);
      this.state.holdoutCausalIntegrity=[...this.state.holdoutCausalIntegrity,clamp01(input.causalIntegrity01)].slice(-96);
      for(const a of ACTIONS)this.state.holdoutBias[a]=(this.state.holdoutBias[a]??0)*.92+Number(policy[a]??0)*.08;
      const trainingSet=new Set(this.state.trainingContextFingerprints);
      const holdoutUnique=this.state.holdoutContextFingerprints.filter(x=>!trainingSet.has(x));
      this.state.holdoutNovelContextRate01=clamp01(holdoutUnique.length/Math.max(1,this.state.holdoutContextFingerprints.length));
      const trainDist=this.distribution(this.state.trainingActionDistribution);
      const holdoutDist=this.distribution(this.state.holdoutActionDistribution);
      this.state.holdoutDistributionGap01=l1(trainDist,holdoutDist);
      this.state.holdoutPolicyShift01=clamp01(.5*ACTIONS.reduce((s,a)=>s+Math.abs((this.state.trainingBias[a]??0)-(this.state.holdoutBias[a]??0)),0));
      const rewardHealth=mean(this.state.holdoutRewards),errorHealth=1-mean(this.state.holdoutPredictionErrors),causal=mean(this.state.holdoutCausalIntegrity),plastic=mean(this.state.holdoutNeuralPlasticity);
      this.state.holdoutEvidenceRate01=clamp01(this.state.verifiedHoldoutUpdates/Math.max(1,this.state.holdoutPulses));
      this.state.holdoutAutonomyRate01=clamp01(this.state.autonomousHoldoutUpdates/Math.max(1,this.state.holdoutPulses));
      this.state.holdoutCoherence01=clamp01(rewardHealth*.25+errorHealth*.25+causal*.25+plastic*.15+(1-this.state.holdoutDistributionGap01)*.10);
      this.state.unseenTransferScore01=clamp01(this.state.holdoutCoherence01*(.55+this.state.holdoutEvidenceRate01*.25+this.state.holdoutAutonomyRate01*.20));
      this.state.evaluationReadiness01=clamp01(this.state.holdoutPulses/48*.25+this.state.unseenTransferScore01*.40+this.state.holdoutCoherence01*.20+(1-pressure)*.15);
      this.state.maxHoldoutResourcePressure01=Math.max(this.state.maxHoldoutResourcePressure01,pressure);
    }else{
      this.state.recoveryPulses++;
      this.state.recoveryActionDistribution[action]=(this.state.recoveryActionDistribution[action]??0)+1;
      for(const a of ACTIONS)this.state.recoveryBias[a]=(this.state.recoveryBias[a]??0)*.92+Number(policy[a]??0)*.08;
      const holdoutVsRecovery=.5*ACTIONS.reduce((s,a)=>s+Math.abs((this.state.holdoutBias[a]??0)-(this.state.recoveryBias[a]??0)),0);
      this.state.recoveryStability01=clamp01(1-holdoutVsRecovery*1.4);
    }
  }
  diagnostics(){return {
    ...this.snapshot(),
    phase:this.phase,
    trainingActionDistribution:this.distribution(this.state.trainingActionDistribution),
    holdoutActionDistribution:this.distribution(this.state.holdoutActionDistribution),
    recoveryActionDistribution:this.distribution(this.state.recoveryActionDistribution),
  };}
}
