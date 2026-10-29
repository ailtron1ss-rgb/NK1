import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);

export interface WorldModelEvidenceGateState {
  version:1;
  tick:number;
  observations:number;
  continuityWeight01:number;
  embodiedWeight01:number;
  agreement01:number;
  calibration01:number;
  actionableConfidence01:number;
  selectedModel:'continuity'|'embodied'|'blend';
  promotions:number;
  demotions:number;
  counterfactualChecks:number;
  verifiedChecks:number;
  transfer01:number;
  closedLoopGain01:number;
  modelErrors01:number[];
  actionAdvantage01:number[];
}

const defaultState=():WorldModelEvidenceGateState=>({
  version:1,tick:0,observations:0,continuityWeight01:.5,embodiedWeight01:.5,agreement01:.5,calibration01:.5,actionableConfidence01:.5,selectedModel:'blend',promotions:0,demotions:0,counterfactualChecks:0,verifiedChecks:0,transfer01:.5,closedLoopGain01:.5,modelErrors01:[.5,.5],actionAdvantage01:new Array(ACTIONS.length).fill(0),
});

export class WorldModelEvidenceGate {
  private state=defaultState();
  snapshot(){return deep(this.state);}
  /**
   * Restores persisted gate state. Untrusted snapshots must not introduce
   * non-finite errors, unsupported model labels or over-long bias arrays.
   */
  restore(raw?:Partial<WorldModelEvidenceGateState>|null){
    const d=defaultState();
    const r:Partial<WorldModelEvidenceGateState>=(raw&&typeof raw==='object')?raw:{};
    const finite=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?clamp(v):fallback;
    const modelErrors=Array.isArray(r.modelErrors01)?r.modelErrors01.map(v=>finite(v,.5)):d.modelErrors01;
    const bias=Array.isArray(r.actionAdvantage01)?r.actionAdvantage01.map(v=>typeof v==='number'&&Number.isFinite(v)?clamp(v,-.2,.2):0):d.actionAdvantage01;
    this.state={
      ...d,...r,version:1,
      continuityWeight01:finite(r.continuityWeight01,d.continuityWeight01),
      embodiedWeight01:finite(r.embodiedWeight01,d.embodiedWeight01),
      agreement01:finite(r.agreement01,d.agreement01),
      calibration01:finite(r.calibration01,d.calibration01),
      actionableConfidence01:finite(r.actionableConfidence01,d.actionableConfidence01),
      transfer01:finite(r.transfer01,d.transfer01),
      closedLoopGain01:finite(r.closedLoopGain01,d.closedLoopGain01),
      selectedModel:r.selectedModel==='continuity'||r.selectedModel==='embodied'||r.selectedModel==='blend'?r.selectedModel:d.selectedModel,
      modelErrors01:[modelErrors[0]??.5,modelErrors[1]??.5],
      actionAdvantage01:Array.from({length:ACTIONS.length},(_,i)=>bias[i]??0),
    };
  }

  /**
   * Arbitration. `afterOutcome` records each model's realized prediction error;
   * those errors are folded into the reliability prior here so that a model that
   * is repeatedly wrong stops being trusted even while it remains confident.
   * Without this the recorded errors were write-only and priorities never
   * changed when the evidence did.
   */
  arbitrate(args:{tick:number;baseUtilities:Record<ActionKind,number>;continuityReward01:number;continuityConfidence01:number;continuityDisagreement01:number;embodiedReward01:number;embodiedConfidence01:number;embodiedConsistency01:number;causalSensitivity01:number;epistemicValue01:number;computeBudget01:number;continuityActionRewards01?:number[];embodiedActionRewards01?:number[];embodiedActionConfidence01?:number[];}):{actionBias:Record<ActionKind,number>;weightContinuity01:number;weightEmbodied01:number;actionableConfidence01:number;selectedModel:'continuity'|'embodied'|'blend'}{
    this.state.tick=args.tick;this.state.observations++;
    const cErr=clamp(1-args.continuityConfidence01),eErr=clamp(1-args.embodiedConfidence01);
    const instantContinuity=clamp(.55*args.continuityConfidence01+.25*(1-args.continuityDisagreement01)+.20*(1-cErr));
    const instantEmbodied=clamp(.45*args.embodiedConfidence01+.35*args.embodiedConsistency01+.20*args.causalSensitivity01);
    // Realized accuracy per model (1 - mean observed prediction error). This is
    // the only term that comes from outcomes rather than from self-reported
    // confidence, so it is what makes the gate learn.
    const continuityAccuracy=clamp(1-(this.state.modelErrors01[0]??.5));
    const embodiedAccuracy=clamp(1-(this.state.modelErrors01[1]??.5));
    const cReliability=clamp(instantContinuity*.7+continuityAccuracy*.3);
    const eReliability=clamp(instantEmbodied*.7+embodiedAccuracy*.3);
    const total=cReliability+eReliability+1e-6;
    let cw=cReliability/total,ew=eReliability/total;
    const diff=Math.abs(cReliability-eReliability);
    this.state.agreement01=clamp(this.state.agreement01*.92+(1-Math.abs(args.continuityConfidence01-args.embodiedConfidence01))*.08);
    this.state.calibration01=clamp(this.state.calibration01*.93+(1-((cErr+eErr)/2))*.07);
    if(args.computeBudget01<.38){ if(eReliability<cReliability){ew*=.75;} else {cw*=.75;} const z=cw+ew;cw/=z;ew/=z; }
    const actionable=clamp(.40+.35*this.state.agreement01+.15*this.state.calibration01+.10*args.causalSensitivity01);
    const selected:WorldModelEvidenceGateState['selectedModel']=diff<.10?'blend':cw>ew?'continuity':'embodied';
    if(selected==='continuity')this.state.promotions++;
    else if(selected==='embodied')this.state.promotions++;
    if(diff>.35)this.state.demotions++;
    this.state.continuityWeight01=clamp(this.state.continuityWeight01*.84+(cw/Math.max(1e-6,cw+ew))*.16);
    this.state.embodiedWeight01=clamp(this.state.embodiedWeight01*.84+(ew/Math.max(1e-6,cw+ew))*.16);
    this.state.actionableConfidence01=clamp(this.state.actionableConfidence01*.90+actionable*.10);
this.state.selectedModel=selected;
    const actionBias=Object.fromEntries(ACTIONS.map((a,idx)=>{
      const base=clamp(args.baseUtilities[a]??.5)-.5;
      const continuityReward=clamp(args.continuityActionRewards01?.[idx]??args.baseUtilities[a]??args.continuityReward01);
      const embodiedReward=clamp(args.embodiedActionRewards01?.[idx]??args.embodiedReward01);
      const modelSpread=(embodiedReward-continuityReward)*.35;
      const actionConfidence=clamp(args.embodiedActionConfidence01?.[idx]??args.embodiedConfidence01);
      const epistemic=Number.isFinite(args.epistemicValue01)?((a==='explore'||a==='verify')?args.epistemicValue01*.025:-args.epistemicValue01*.006):0;
      const residual=clamp(base*.04+modelSpread*ew*actionConfidence+epistemic,-.06,.06)*actionable;
      this.state.actionAdvantage01[idx]=clamp(this.state.actionAdvantage01[idx]!*0.97+residual*0.03,-.2,.2);
      return [a,this.state.actionAdvantage01[idx]];
    })) as Record<ActionKind,number>;
    return {actionBias,weightContinuity01:cw,weightEmbodied01:ew,actionableConfidence01:actionable,selectedModel:selected};
  }

  /**
   * Records realized outcome error per model and rebuilds both weights as a
   * normalized pair. The previous version pushed a single weight up by a fixed
   * step whenever a model won by more than 0.005 error, which ignored the size
   * of the difference and could drift the pair away from summing to one.
   */
  afterOutcome(args:{reward01:number;continuityPred01:number;embodiedPred01:number;verified01:number;causalGain01:number;transfer01:number}){
    const reward=clamp(args.reward01),verified=clamp(args.verified01);
    const cErr=Math.abs(reward-clamp(args.continuityPred01)),eErr=Math.abs(reward-clamp(args.embodiedPred01));
    // Realized errors are the gate's only outcome-grounded signal; they learn
    // faster than the slow self-report EMA so evidence can actually reorder the
    // models within a few dozen observations.
    this.state.modelErrors01[0]=clamp(this.state.modelErrors01[0]*.86+cErr*.14);
    this.state.modelErrors01[1]=clamp(this.state.modelErrors01[1]*.86+eErr*.14);
    this.state.verifiedChecks++;this.state.counterfactualChecks++;
    this.state.transfer01=clamp(this.state.transfer01*.95+clamp(args.transfer01)*.05);
    this.state.closedLoopGain01=clamp(this.state.closedLoopGain01*.94+clamp(.5+(reward-.5)*.7+clamp(args.causalGain01)*.3)*.06);
    // Re-normalize the pair against realized accuracy only: a model that keeps
    // mispredicting loses authority even if it stays confident.
    const cAcc=clamp(1-(this.state.modelErrors01[0]??.5));
    const eAcc=clamp(1-(this.state.modelErrors01[1]??.5));
    const accTotal=Math.max(1e-6,cAcc+eAcc);
    const cTarget=cAcc/accTotal,eTarget=eAcc/accTotal;
    const step=.12;
    const cw=clamp(this.state.continuityWeight01*(1-step)+cTarget*step);
    const ew=clamp(this.state.embodiedWeight01*(1-step)+eTarget*step);
    const total=Math.max(1e-6,cw+ew);
    this.state.continuityWeight01=clamp(cw/total);
    this.state.embodiedWeight01=clamp(ew/total);
  }

  metrics(){return {tick:this.state.tick,observations:this.state.observations,continuityWeight01:this.state.continuityWeight01,embodiedWeight01:this.state.embodiedWeight01,agreement01:this.state.agreement01,calibration01:this.state.calibration01,actionableConfidence01:this.state.actionableConfidence01,selectedModel:this.state.selectedModel,promotions:this.state.promotions,demotions:this.state.demotions,counterfactualChecks:this.state.counterfactualChecks,verifiedChecks:this.state.verifiedChecks,transfer01:this.state.transfer01,closedLoopGain01:this.state.closedLoopGain01,modelErrors01:this.state.modelErrors01.slice(),actionAdvantage01:this.state.actionAdvantage01.slice()};}
}

export const defaultWorldModelEvidenceGate=()=>defaultState();
