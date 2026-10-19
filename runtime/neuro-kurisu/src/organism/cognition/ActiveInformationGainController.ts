import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);

export interface InformationHypothesis {
  id:string;
  belief01:number;
  uncertainty01:number;
  evidence:number;
  reward01:number;
  predictionError01:number;
  lastTick:number;
}
export interface ActiveInformationGainState {
  version:1; tick:number; decisions:number; experiments:number; observations:number;
  usefulExperiments:number; failedExperiments:number; modelUpdates:number;
  informationGain01:number; expectedUtility01:number; epistemicValue01:number;
  calibration01:number; explorationPressure01:number; selectedAction:ActionKind|null;
  selectedHypothesis:string|null; hypotheses:InformationHypothesis[];
  actionValue:Record<ActionKind,number>; actionUncertainty:Record<ActionKind,number>;
  actionCounts:Record<ActionKind,number>; actionWins:Record<ActionKind,number>;
}
const d=():ActiveInformationGainState=>({
  version:1,tick:0,decisions:0,experiments:0,observations:0,usefulExperiments:0,failedExperiments:0,modelUpdates:0,
  informationGain01:.15,expectedUtility01:.5,epistemicValue01:.15,calibration01:.5,explorationPressure01:.2,
  selectedAction:null,selectedHypothesis:null,hypotheses:[],
  actionValue:Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>,
  actionUncertainty:Object.fromEntries(ACTIONS.map(a=>[a,.55])) as Record<ActionKind,number>,
  actionCounts:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  actionWins:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>
});

/**
 * Lightweight active-experiment layer. It does not pretend to solve full Bayesian
 * inference; instead it keeps explicit competing hypotheses and chooses actions that
 * maximize expected information gain + useful outcome under a device/risk budget.
 * This is deliberately cheap enough for the Android/Termux target.
 */
export class ActiveInformationGainController {
  private state=d(); readonly maxHypotheses=32;
  snapshot(){return deep(this.state)}
  restore(raw?:Partial<ActiveInformationGainState>|null){const r:any=raw??{};this.state={...d(),...deep(r),version:1,
    hypotheses:Array.isArray(r.hypotheses)?r.hypotheses.slice(-this.maxHypotheses).map((h:any)=>({id:String(h.id??'h'),belief01:clamp(Number(h.belief01??.5)),uncertainty01:clamp(Number(h.uncertainty01??.5)),evidence:Math.max(0,Number(h.evidence)||0),reward01:clamp(Number(h.reward01??.5)),predictionError01:clamp(Number(h.predictionError01??.5)),lastTick:Math.max(0,Number(h.lastTick)||0)})):[],
    actionValue:{...d().actionValue,...(r.actionValue??{})},actionUncertainty:{...d().actionUncertainty,...(r.actionUncertainty??{})},actionCounts:{...d().actionCounts,...(r.actionCounts??{})},actionWins:{...d().actionWins,...(r.actionWins??{})}};
  }
  private hypothesis(id:string){let h=this.state.hypotheses.find(x=>x.id===id);if(!h){h={id:id.slice(0,80),belief01:.5,uncertainty01:.65,evidence:0,reward01:.5,predictionError01:.5,lastTick:0};this.state.hypotheses.push(h);if(this.state.hypotheses.length>this.maxHypotheses)this.state.hypotheses.shift();}return h;}
  private entropy(p:number){const q=clamp(p,1e-5,1-1e-5);return -(q*Math.log2(q)+(1-q)*Math.log2(1-q));}
  beforeDecision(i:{tick:number;baseUtilities:Record<ActionKind,number>;uncertainty01:number;predictionError01:number;novelty01:number;computeBudget01:number;risk01:number;grounding01:number;consensus01:number;externalQuery?:string|null}):{actionBias:Record<ActionKind,number>;informationGain01:number;epistemicValue01:number;selectedAction:ActionKind|null;selectedHypothesis:string|null;experiment01:number;expectedUtility01:number}{
    this.state.tick=i.tick;this.state.decisions++;
    const candidates=ACTIONS.map(a=>{
      const count=this.state.actionCounts[a]??0, win=this.state.actionWins[a]??0;
      const empirical= count?win/count:.5;
      const uncertainty=this.state.actionUncertainty[a]??.55;
      const structural=(a==='verify'||a==='explore')?1:0;
      const riskPenalty=(a==='explore'||a==='verify')?i.risk01*.28:0;
      const info=clamp(uncertainty*.50+i.uncertainty01*.28+i.predictionError01*.14+i.novelty01*.08)*(.45+.55*structural);
      const utility=clamp(.45*(i.baseUtilities[a]??.5)+.35*empirical+.20*(1-i.risk01));
      const budgetPenalty=i.computeBudget01<.28&&structural?.45:0;
      return {a,info:clamp(info-budgetPenalty),utility:clamp(utility-riskPenalty)};
    });
    const best=candidates.slice().sort((a,b)=>(b.info*.62+b.utility*.38)-(a.info*.62+a.utility*.38))[0]!;
    const shouldExperiment=clamp(best.info*.72+i.novelty01*.10+i.predictionError01*.10+(1-i.grounding01)*.08)>.48 && i.computeBudget01>.24 && i.risk01<.82;
    const selected=shouldExperiment?best.a:null;
    const hId=i.externalQuery??`action:${best.a}`;const h=this.hypothesis(hId);
    const priorEntropy=this.entropy(h.belief01);
    const predictedPosteriorEntropy=this.entropy(clamp(h.belief01+(1-h.belief01)*.16));
    const structuralGain=clamp((priorEntropy-predictedPosteriorEntropy)+h.uncertainty01*.35);
    const ig=clamp(best.info*.55+structuralGain*.45);
    this.state.informationGain01=clamp(this.state.informationGain01*.92+ig*.08);
    this.state.expectedUtility01=clamp(this.state.expectedUtility01*.92+best.utility*.08);
    this.state.epistemicValue01=clamp(this.state.epistemicValue01*.90+ig*.10);
    this.state.explorationPressure01=clamp(this.state.explorationPressure01*.92+(shouldExperiment?ig:.12)*.08);
    this.state.selectedAction=selected;this.state.selectedHypothesis=shouldExperiment?hId:null;
    const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
    if(selected){bias[selected]=clamp(.018+.052*ig)*(1-i.risk01*.35);if(selected==='verify')bias.verify+=.012*clamp(1-i.consensus01);if(selected==='explore')bias.explore+=.010*clamp(1-i.grounding01);this.state.experiments++;}
    return {actionBias:bias,informationGain01:this.state.informationGain01,epistemicValue01:this.state.epistemicValue01,selectedAction:selected,selectedHypothesis:this.state.selectedHypothesis,experiment01:shouldExperiment?ig:0,expectedUtility01:this.state.expectedUtility01};
  }
  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;observedChange01?:number;contradiction01?:number;hypothesisId?:string|null}){
    const reward=clamp(i.reward01),error=clamp(i.predictionError01),verified=clamp(i.verified01),change=clamp(i.observedChange01??Math.abs(reward-.5)*2),contra=clamp(i.contradiction01??0);
    const a=i.action;this.state.observations++;this.state.actionCounts[a]=(this.state.actionCounts[a]??0)+1;
    const success=clamp(reward*.45+verified*.35+(1-error)*.20);
    this.state.actionValue[a]=clamp((this.state.actionValue[a]??.5)*.94+success*.06);
    this.state.actionUncertainty[a]=clamp((this.state.actionUncertainty[a]??.55)*.94+Math.abs(success-(this.state.actionValue[a]??.5))*.06);
    if(success>.62)this.state.actionWins[a]=(this.state.actionWins[a]??0)+1;
    const id=i.hypothesisId??this.state.selectedHypothesis;
    if(id){const h=this.hypothesis(id),old=h.belief01;const signal=clamp(.55*reward+.25*verified+.20*(1-error));const eta=.06/Math.sqrt(h.evidence+1);h.belief01=clamp(old+eta*(signal-old));h.uncertainty01=clamp(h.uncertainty01*.92+(Math.abs(signal-old)+contra)*.08);h.reward01=clamp(h.reward01*.92+reward*.08);h.predictionError01=clamp(h.predictionError01*.92+error*.08);h.evidence++;h.lastTick=i.tick;this.state.modelUpdates++;if(change>.22&&contra<.55)this.state.usefulExperiments++;else if(contra>.55)this.state.failedExperiments++;}
    const useful=clamp(change*(1-contra)*(.45+verified*.55));this.state.informationGain01=clamp(this.state.informationGain01*.94+useful*.06);this.state.calibration01=clamp(this.state.calibration01*.94+(1-Math.abs(success-(this.state.actionValue[a]??.5)))*.06);
  }
  metrics(){return {...deep(this.state),experimentUtility01:this.state.usefulExperiments/Math.max(1,this.state.experiments),actionCoverage01:ACTIONS.filter(a=>(this.state.actionCounts[a]??0)>0).length/ACTIONS.length,modelHypotheses:this.state.hypotheses.length}}
}
export const defaultActiveInformationGainController=()=>d();
