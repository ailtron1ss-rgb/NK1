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
  restore(raw?:Partial<WorldModelEvidenceGateState>|null){const d=defaultState(),r:any=raw??{};this.state={...d,...deep(r),version:1,modelErrors01:Array.isArray(r.modelErrors01)?r.modelErrors01.slice(0,2).concat([.5,.5]).slice(0,2):d.modelErrors01,actionAdvantage01:Array.isArray(r.actionAdvantage01)?r.actionAdvantage01.slice(0,ACTIONS.length).concat(new Array(ACTIONS.length).fill(0)).slice(0,ACTIONS.length):d.actionAdvantage01};}

  arbitrate(args:{tick:number;baseUtilities:Record<ActionKind,number>;continuityReward01:number;continuityConfidence01:number;continuityDisagreement01:number;embodiedReward01:number;embodiedConfidence01:number;embodiedConsistency01:number;causalSensitivity01:number;epistemicValue01:number;computeBudget01:number;continuityActionRewards01?:number[];embodiedActionRewards01?:number[];embodiedActionConfidence01?:number[];}):{actionBias:Record<ActionKind,number>;weightContinuity01:number;weightEmbodied01:number;actionableConfidence01:number;selectedModel:'continuity'|'embodied'|'blend'}{
    this.state.tick=args.tick;this.state.observations++;
    const cErr=clamp(1-args.continuityConfidence01),eErr=clamp(1-args.embodiedConfidence01);
    const cReliability=clamp(.55*args.continuityConfidence01+.25*(1-args.continuityDisagreement01)+.20*(1-cErr));
    const eReliability=clamp(.45*args.embodiedConfidence01+.35*args.embodiedConsistency01+.20*args.causalSensitivity01);
    const total=cReliability+eReliability+1e-6;
    let cw=cReliability/total,ew=eReliability/total;
    const diff=Math.abs(cReliability-eReliability);
    this.state.agreement01=clamp(this.state.agreement01*.92+(1-Math.abs(args.continuityConfidence01-args.embodiedConfidence01))*.08);
    this.state.calibration01=clamp(this.state.calibration01*.93+(1-((cErr+eErr)/2))*.07);
    if(args.computeBudget01<.38){ if(eReliability<cReliability){ew*=.75;} else {cw*=.75;} const z=cw+ew;cw/=z;ew/=z; }
    const actionable=clamp(.40+.35*this.state.agreement01+.15*this.state.calibration01+.10*args.causalSensitivity01);
    const selected:WorldModelEvidenceGateState['selectedModel']=diff<.10?'blend':cw>ew?'continuity':'embodied';
    if(selected==='continuity')this.state.promotions++;else if(selected==='embodied')this.state.promotions++;if(diff>.35)this.state.demotions++;
    this.state.continuityWeight01=clamp(this.state.continuityWeight01*.84+cw*.16);this.state.embodiedWeight01=clamp(this.state.embodiedWeight01*.84+ew*.16);this.state.actionableConfidence01=clamp(this.state.actionableConfidence01*.90+actionable*.10);this.state.selectedModel=selected;
    const actionBias=Object.fromEntries(ACTIONS.map((a,idx)=>{
      const base=clamp(args.baseUtilities[a]??.5)-.5;
      const continuityReward=clamp(args.continuityActionRewards01?.[idx]??args.baseUtilities[a]??args.continuityReward01);
      const embodiedReward=clamp(args.embodiedActionRewards01?.[idx]??args.embodiedReward01);
      const modelSpread=(embodiedReward-continuityReward)*.35;
      const actionConfidence=clamp(args.embodiedActionConfidence01?.[idx]??args.embodiedConfidence01);
      const epistemic=(a==='explore'||a==='verify')?args.epistemicValue01*.025:-args.epistemicValue01*.006;
      const residual=clamp(base*.04+modelSpread*ew*actionConfidence+epistemic,-.06,.06)*actionable;
      this.state.actionAdvantage01[idx]=clamp(this.state.actionAdvantage01[idx]!*0.97+residual*0.03,-.2,.2);
      return [a,this.state.actionAdvantage01[idx]];
    })) as Record<ActionKind,number>;
    return {actionBias,weightContinuity01:cw,weightEmbodied01:ew,actionableConfidence01:actionable,selectedModel:selected};
  }

  afterOutcome(args:{reward01:number;continuityPred01:number;embodiedPred01:number;verified01:number;causalGain01:number;transfer01:number}){
    const reward=clamp(args.reward01),verified=clamp(args.verified01);
    const cErr=Math.abs(reward-clamp(args.continuityPred01)),eErr=Math.abs(reward-clamp(args.embodiedPred01));
    this.state.modelErrors01[0]=clamp(this.state.modelErrors01[0]*.94+cErr*.06);
    this.state.modelErrors01[1]=clamp(this.state.modelErrors01[1]*.94+eErr*.06);
    this.state.verifiedChecks++;this.state.counterfactualChecks++;
    this.state.transfer01=clamp(this.state.transfer01*.95+clamp(args.transfer01)*.05);
    this.state.closedLoopGain01=clamp(this.state.closedLoopGain01*.94+clamp(.5+(reward-.5)*.7+args.causalGain01*.3)*.06);
    const step=.04;
    if(eErr+0.005<cErr)this.state.embodiedWeight01=clamp(this.state.embodiedWeight01+step);
    else if(cErr+0.005<eErr)this.state.continuityWeight01=clamp(this.state.continuityWeight01+step);
  }

  metrics(){return {tick:this.state.tick,observations:this.state.observations,continuityWeight01:this.state.continuityWeight01,embodiedWeight01:this.state.embodiedWeight01,agreement01:this.state.agreement01,calibration01:this.state.calibration01,actionableConfidence01:this.state.actionableConfidence01,selectedModel:this.state.selectedModel,promotions:this.state.promotions,demotions:this.state.demotions,counterfactualChecks:this.state.counterfactualChecks,verifiedChecks:this.state.verifiedChecks,transfer01:this.state.transfer01,closedLoopGain01:this.state.closedLoopGain01,modelErrors01:this.state.modelErrors01.slice(),actionAdvantage01:this.state.actionAdvantage01.slice()};}
}

export const defaultWorldModelEvidenceGate=()=>defaultState();
