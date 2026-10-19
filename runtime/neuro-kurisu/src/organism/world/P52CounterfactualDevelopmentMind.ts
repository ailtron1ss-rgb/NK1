/**
 * P52 Counterfactual Development Mind.
 *
 * This layer turns the existing causal/world/prediction machinery into a bounded
 * developmental loop.  It does not claim phenomenal consciousness: it measures
 * whether the organism's self/world model improves when alternative actions are
 * considered and later reconciled with observed outcomes.
 */
import type { ActionKind, OrganismGoal, OrganismNeeds, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface P52TrajectorySample {
  tick:number;
  action:ActionKind;
  predictedUtility01:number;
  actualUtility01:number;
  predictionError01:number;
  selfPredictionError01:number;
  goalId?:string;
  at:number;
}

export interface P52CounterfactualHypothesis {
  id:string;
  tick:number;
  chosen:ActionKind;
  alternative:ActionKind;
  predictedChosen01:number;
  predictedAlternative01:number;
  observedChosen01:number|null;
  confidence01:number;
  unresolved:boolean;
  at:number;
}

export interface P52DevelopmentalState {
  version:1;
  samples:number;
  resolvedCounterfactuals:number;
  openCounterfactuals:number;
  causalAttribution01:number;
  counterfactualCalibration01:number;
  selfPredictionCalibration01:number;
  developmentalReadiness01:number;
  modelRevisionPressure01:number;
  trajectoryError01:number;
  lastAction:ActionKind|'none';
  lastGoalId:string;
  lastQuestion:string;
  trajectory:P52TrajectorySample[];
  counterfactuals:P52CounterfactualHypothesis[];
}

export const defaultP52=():P52DevelopmentalState=>({
  version:1,samples:0,resolvedCounterfactuals:0,openCounterfactuals:0,
  causalAttribution01:.5,counterfactualCalibration01:.5,selfPredictionCalibration01:.5,
  developmentalReadiness01:.25,modelRevisionPressure01:.2,trajectoryError01:.5,
  lastAction:'none',lastGoalId:'',lastQuestion:'',trajectory:[],counterfactuals:[]
});

function utilityFromOutcome(success:number,reward:number,surprise:number){
  return clamp(success*.5+reward*.35+(1-surprise)*.15);
}

export class P52CounterfactualDevelopmentMind {
  private state=defaultP52();
  restore(raw?:Partial<P52DevelopmentalState>|null){
    const d=defaultP52(), r=raw??{};
    this.state={...d,...r,
      trajectory:Array.isArray(r.trajectory)?r.trajectory.slice(-160):[],
      counterfactuals:Array.isArray(r.counterfactuals)?r.counterfactuals.slice(-128):[]
    };
    this.state.openCounterfactuals=this.state.counterfactuals.filter(x=>x.unresolved).length;
  }
  snapshot(){return structuredClone(this.state);}
  /** Durable projection keeps the recent learning trajectory while preserving the bounded counterfactual set. */
  persistenceSnapshot(){
    return {
      ...this.state,
      trajectory:this.state.trajectory.slice(-64).map(row=>({...row})),
      counterfactuals:this.state.counterfactuals.map(row=>({...row})),
    };
  }

  private alternative(chosen:ActionKind, uncertainty:number, novelty:number):ActionKind {
    const ranked=[
      ['verify',uncertainty],['explore',novelty],['rest',1-uncertainty],['reflect',Math.abs(.5-uncertainty)],
      ['respond',.45],['wait',.3],['defer',.2]
    ] as Array<[ActionKind,number]>;
    return (ranked.filter(([a])=>a!==chosen).sort((a,b)=>b[1]-a[1])[0]?.[0]??'wait');
  }

  observe(input:{
    stateBefore:OrganismState;
    stateAfter:OrganismState;
    action:ActionKind;
    predictedUtility01:number;
    success01:number;
    reward01:number;
    surprise01:number;
    predictionConfidence01:number;
    selfPredictionError01:number;
    goals:OrganismGoal[];
    p50Alignment01:number;
    p51Grounding01:number;
    at:number;
  }):P52DevelopmentalState {
    const actual=utilityFromOutcome(clamp(input.success01),clamp(input.reward01),clamp(input.surprise01));
    const pred=clamp(input.predictedUtility01);
    const err=clamp(Math.abs(pred-actual));
    const attribution=clamp((1-err)*.55+clamp(input.p50Alignment01)*.25+clamp(input.p51Grounding01)*.20);
    const active=input.goals.find(g=>g.status==='active') ?? input.goals.find(g=>g.status==='candidate');
    const alternative=this.alternative(input.action,input.stateAfter.needs.uncertainty,input.stateAfter.needs.novelty);
    const altBias=clamp(.5 + (input.stateAfter.needs.uncertainty-.5)*.22 + (input.stateAfter.needs.novelty-.5)*.18);
    const question=`What would likely have happened if I had chosen ${alternative} instead of ${input.action}?`;
    this.state.samples++;
    this.state.trajectory.push({tick:input.stateAfter.tick,action:input.action,predictedUtility01:pred,actualUtility01:actual,predictionError01:err,selfPredictionError01:clamp(input.selfPredictionError01),goalId:active?.id,at:input.at});
    this.state.trajectory=this.state.trajectory.slice(-160);
    this.state.trajectoryError01=clamp(this.state.trajectoryError01*.92+err*.08);
    this.state.causalAttribution01=clamp(this.state.causalAttribution01*.9+attribution*.1);
    this.state.selfPredictionCalibration01=clamp(this.state.selfPredictionCalibration01*.9+(1-clamp(input.selfPredictionError01))*.1);
    const confidence=clamp(input.predictionConfidence01*.55+input.p51Grounding01*.2+input.p50Alignment01*.25);
    this.state.counterfactuals.unshift({
      id:`p52cf-${input.stateAfter.tick}-${this.state.samples}`,
      tick:input.stateAfter.tick,chosen:input.action,alternative,
      predictedChosen01:pred,predictedAlternative01:altBias,observedChosen01:actual,
      confidence01:confidence,unresolved:true,at:input.at
    });
    this.state.counterfactuals=this.state.counterfactuals.slice(0,128);
    this.state.openCounterfactuals=this.state.counterfactuals.filter(x=>x.unresolved).length;
    this.state.modelRevisionPressure01=clamp(this.state.modelRevisionPressure01*.9+err*.1);
    this.state.developmentalReadiness01=clamp(this.state.developmentalReadiness01*.93 + (attribution*.38 + confidence*.22 + (1-err)*.4)*.07);
    // A counterfactual is resolved only when its alternative action is actually taken.
    // The chosen action's outcome is not evidence for the unchosen branch.
    const prior=this.state.counterfactuals.find(x=>x.unresolved && x.id!==this.state.counterfactuals[0].id && x.alternative===input.action);
    if(prior) this.resolveCounterfactual(prior.id, actual);
    this.state.lastAction=input.action;this.state.lastGoalId=active?.id??'';this.state.lastQuestion=question;
    return this.snapshot();
  }

  resolveCounterfactual(id:string, actual01:number){
    const row=this.state.counterfactuals.find(x=>x.id===id && x.unresolved);
    if(!row) return;
    const expectedGap=Math.abs(row.predictedAlternative01-clamp(actual01));
    row.unresolved=false;
    this.state.resolvedCounterfactuals++;
    this.state.openCounterfactuals=Math.max(0,this.state.openCounterfactuals-1);
    this.state.counterfactualCalibration01=clamp(this.state.counterfactualCalibration01*.88+(1-expectedGap)*.12);
  }

  developmentalQuestion(){return this.state.lastQuestion;}

  summary(){
    return {
      samples:this.state.samples,
      resolvedCounterfactuals:this.state.resolvedCounterfactuals,
      openCounterfactuals:this.state.openCounterfactuals,
      causalAttribution01:this.state.causalAttribution01,
      counterfactualCalibration01:this.state.counterfactualCalibration01,
      selfPredictionCalibration01:this.state.selfPredictionCalibration01,
      developmentalReadiness01:this.state.developmentalReadiness01,
      modelRevisionPressure01:this.state.modelRevisionPressure01,
      trajectoryError01:this.state.trajectoryError01,
      lastAction:this.state.lastAction,
      lastGoalId:this.state.lastGoalId,
      lastQuestion:this.state.lastQuestion,
    };
  }

  static stateDelta(before:OrganismState,after:OrganismState):Partial<OrganismNeeds>{
    return {
      energy:clamp(after.needs.energy-before.needs.energy+.5),
      cognitiveLoad:clamp(after.needs.cognitiveLoad-before.needs.cognitiveLoad+.5),
      uncertainty:clamp(after.needs.uncertainty-before.needs.uncertainty+.5),
      novelty:clamp(after.needs.novelty-before.needs.novelty+.5),
    };
  }
}
