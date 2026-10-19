import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const ACTION_COUNT = ACTIONS.length;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const deep=<T>(x:T):T=>structuredClone(x);
const cosine=(a:number[],b:number[])=>{
  let d=0,aa=0,bb=0;
  for(let i=0;i<Math.min(a.length,b.length);i++){const x=finite(a[i]),y=finite(b[i]);d+=x*y;aa+=x*x;bb+=y*y;}
  return d/(Math.sqrt(aa*bb)+1e-9);
};
const dist=(a:number[],b:number[])=>{
  let s=0;for(let i=0;i<Math.min(a.length,b.length);i++){const e=finite(a[i])-finite(b[i]);s+=e*e;}
  return Math.sqrt(s/Math.max(1,Math.min(a.length,b.length)));
};
const hashKey=(x:number[])=>{
  let h=2166136261>>>0;
  for(let i=0;i<Math.min(12,x.length);i++){h^=Math.floor((finite(x[i])+.5)*1000);h=Math.imul(h,16777619);}return h>>>0;
};

export interface CausalTransitionTrace {
  tick:number;
  contextKey:number;
  context:number[];
  action:ActionKind;
  predictedReward01:number;
  realizedReward01:number;
  predictedNext:number[];
  realizedNext:number[];
  retrievedMemoryIds:string[];
  matchedAlternativeCount:number;
  causalGain01:number;
}

export interface SemanticWorldRule {
  id:string;
  contextKey:number;
  context:number[];
  action:ActionKind;
  delta:number[];
  confidence01:number;
  support:number;
  lastTick:number;
  contradiction01:number;
}

export interface AdaptiveCausalMemoryPlannerState {
  version:2;
  tick:number;
  decisionCount:number;
  learningUpdates:number;
  policyUpdates:number;
  causalComparisons:number;
  transferComparisons:number;
  selectiveForesight01:number;
  epistemicValue01:number;
  causalSensitivity01:number;
  transfer01:number;
  longHorizonConsistency01:number;
  actionValue01:number[];
  actionCount:number[];
  actionRewardMean01:number[];
  actionConfidence01:number[];
  actionDisagreement01:number[];
  rules:SemanticWorldRule[];
  traces:CausalTransitionTrace[];
  lastActionScores:number[];
  lastCounterfactualReward:number[];
  lastSelectedConfidence01:number;
  lastMemoryCredit:number[];
  lastRuleId:string|null;
  lastComputeCost01:number;
  retainedForesightCount:number;
  rejectedForesightCount:number;
  dreamRehearsalCount:number;
  dreamUpdates:number;
  modelTime01:number;
  forgettingDebt01:number;
  skillRetention01:number[];
  conflictCount:number;
  negativeTransfer01:number;
  lastDreamQuality01:number;
  protectedActionSkill01:number[];
}

export const defaultAdaptiveCausalMemoryPlanner=():AdaptiveCausalMemoryPlannerState=>({
  version:2,tick:0,decisionCount:0,learningUpdates:0,policyUpdates:0,causalComparisons:0,transferComparisons:0,
  selectiveForesight01:.65,epistemicValue01:.5,causalSensitivity01:0,transfer01:0,longHorizonConsistency01:.5,
  actionValue01:new Array(ACTION_COUNT).fill(.5),actionCount:new Array(ACTION_COUNT).fill(0),actionRewardMean01:new Array(ACTION_COUNT).fill(.5),
  actionConfidence01:new Array(ACTION_COUNT).fill(.25),actionDisagreement01:new Array(ACTION_COUNT).fill(.25),rules:[],traces:[],
  lastActionScores:new Array(ACTION_COUNT).fill(.5),lastCounterfactualReward:new Array(ACTION_COUNT).fill(.5),lastSelectedConfidence01:.5,
  lastMemoryCredit:[],lastRuleId:null,lastComputeCost01:0,retainedForesightCount:0,rejectedForesightCount:0,
  dreamRehearsalCount:0,dreamUpdates:0,modelTime01:0,forgettingDebt01:0,skillRetention01:new Array(ACTION_COUNT).fill(.5),conflictCount:0,negativeTransfer01:0,lastDreamQuality01:0,protectedActionSkill01:new Array(ACTION_COUNT).fill(0),
});

export class AdaptiveCausalMemoryPlanner {
  private state=defaultAdaptiveCausalMemoryPlanner();

  snapshot(){return deep(this.state);}
  restore(raw?:Partial<AdaptiveCausalMemoryPlannerState>|null){
    const d=defaultAdaptiveCausalMemoryPlanner(),r:any=raw??{};
    const arr=(v:any,n:number,f=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(f)).slice(0,n):new Array(n).fill(f);
    this.state={...d,...deep(r),version:2,
      actionValue01:arr(r.actionValue01,ACTION_COUNT,.5),actionCount:arr(r.actionCount,ACTION_COUNT,0),actionRewardMean01:arr(r.actionRewardMean01,ACTION_COUNT,.5),
      actionConfidence01:arr(r.actionConfidence01,ACTION_COUNT,.25),actionDisagreement01:arr(r.actionDisagreement01,ACTION_COUNT,.25),
      rules:Array.isArray(r.rules)?r.rules.slice(-96):[],traces:Array.isArray(r.traces)?r.traces.slice(-256):[],
      lastActionScores:arr(r.lastActionScores,ACTION_COUNT,.5),lastCounterfactualReward:arr(r.lastCounterfactualReward,ACTION_COUNT,.5),
      lastMemoryCredit:arr(r.lastMemoryCredit,16,0),selectiveForesight01:clamp(Number(r.selectiveForesight01??.65)),
      epistemicValue01:clamp(Number(r.epistemicValue01??.5)),causalSensitivity01:clamp(Number(r.causalSensitivity01??0)),transfer01:clamp(Number(r.transfer01??0)),
      longHorizonConsistency01:clamp(Number(r.longHorizonConsistency01??.5)),lastSelectedConfidence01:clamp(Number(r.lastSelectedConfidence01??.5)),
      lastComputeCost01:clamp(Number(r.lastComputeCost01??0)),retainedForesightCount:Number(r.retainedForesightCount??0),rejectedForesightCount:Number(r.rejectedForesightCount??0),
      dreamRehearsalCount:Number(r.dreamRehearsalCount??0),dreamUpdates:Number(r.dreamUpdates??0),modelTime01:clamp(Number(r.modelTime01??0)),forgettingDebt01:clamp(Number(r.forgettingDebt01??0)),
      skillRetention01:arr(r.skillRetention01,ACTION_COUNT,.5),conflictCount:Number(r.conflictCount??0),negativeTransfer01:clamp(Number(r.negativeTransfer01??0)),lastDreamQuality01:clamp(Number(r.lastDreamQuality01??0)),protectedActionSkill01:arr(r.protectedActionSkill01,ACTION_COUNT,0),
    };
  }

  private actionIndex(a:ActionKind){return Math.max(0,ACTIONS.indexOf(a));}

  private ruleScore(rule:SemanticWorldRule,context:number[],action:ActionKind){
    const sim=0.55*cosine(rule.context,context)+0.45*cosine(rule.delta,context.slice(0,rule.delta.length));
    const actionMatch=rule.action===action?1:0;
    const contradictionPenalty=rule.contradiction01*.45;
    return clamp(.48*sim+.32*actionMatch+.12*rule.confidence01+.08*Math.min(1,rule.support/8)-contradictionPenalty);
  }

  beforeDecision(args:{tick:number;context:number[];latent:number[];actionUtilities:Record<ActionKind,number>;forecast:number[][];forecastConfidence01:number;disagreement01:number;epistemicValue01:number;computeBudget01:number;retrieved:Array<{id:string;utility01:number;confidence01:number;protected01:number}>;novelty01:number;uncertainty01:number;predictionError01:number;goalPressure01:number;}):{
    actionBias:Record<ActionKind,number>;counterfactualReward:number[];selectedForesight01:number;epistemicValue01:number;causalSensitivity01:number;transfer01:number;retrievedMemoryValue01:number;ruleCount:number;selectedActionHint:ActionKind|null;
  }{
    const f=args.context.slice(0,16), budget=clamp(args.computeBudget01), rawDisagreement=clamp(args.disagreement01), baseEpistemic=clamp(args.epistemicValue01);
    const conf=clamp(args.forecastConfidence01);
    // Selective foresight: unreliable forecasts are not allowed to dominate action scores.
    const foresightGate=clamp(.25+.75*conf-.35*rawDisagreement+args.novelty01*.08);
    if(foresightGate>.52)this.state.retainedForesightCount++;else this.state.rejectedForesightCount++;
    this.state.selectiveForesight01=clamp(this.state.selectiveForesight01*.94+foresightGate*.06);

    const rulesByAction=new Array(ACTION_COUNT).fill(0);
    for(const a of ACTIONS){const ai=this.actionIndex(a);let s=0,c=0;for(const r of this.state.rules){if(r.contextKey!==hashKey(f))continue;const rs=this.ruleScore(r,f,a);if(rs>.30){s+=rs*(.6+.4*r.confidence01);c++;}}rulesByAction[ai]=c?clamp(s/c):0;}

    const memoryValue=args.retrieved.reduce((s,m)=>s+m.utility01*(.6+.4*m.confidence01),0)/Math.max(1,args.retrieved.length);
    const actionScores:number[]=[];
    const counterfactual:number[]=[];
    for(let ai=0;ai<ACTION_COUNT;ai++){
      const a=ACTIONS[ai]!;
      const base=clamp(args.actionUtilities[a]??.5);
      const learned=this.state.actionRewardMean01[ai]??.5;
      const actionCount=(this.state.actionCount[ai]??0);
      const confA=this.state.actionConfidence01[ai]??.25;
      const disagreeA=this.state.actionDisagreement01[ai]??.25;
      const forecastForAction=args.forecast[(ai*7)%Math.max(1,args.forecast.length)] ?? args.forecast[0] ?? [];
      const predictedState=forecastForAction.length?dist(forecastForAction,args.latent.slice(0,forecastForAction.length)):0;
      const noveltyValue=(args.novelty01*.35+args.uncertainty01*.35+rawDisagreement*.30)*(.55+.45*(1-confA));
      const epistemic=(ai===this.actionIndex('explore')||ai===this.actionIndex('verify'))?baseEpistemic*rawDisagreement:.12*baseEpistemic*rawDisagreement;
      const outcomePrior=actionCount?learned:0.5;
      const explorationBonus=Math.sqrt(Math.log(2+this.state.decisionCount)/(1+actionCount))*.045*budget;
      const ruleBonus=rulesByAction[ai]!*.09*(1-this.state.negativeTransfer01*.55);
      const skillProtection=(this.state.protectedActionSkill01[ai]??0)*.025;
      const memoryBonus=(a==='reflect'||a==='verify'?memoryValue*.045:memoryValue*.018);
      const score=clamp(base*.58+outcomePrior*.18+foresightGate*.10+(1-predictedState)*.04+noveltyValue*.03+epistemic*.03+ruleBonus+skillProtection+memoryBonus+explorationBonus);
      actionScores[ai]=score;
      counterfactual[ai]=clamp(.45+score*.35+epistemic*.12-rawDisagreement*.05);
      if(disagreeA>.7)counterfactual[ai]=clamp(counterfactual[ai]-.03);
    }
    const maxScore=Math.max(...actionScores),minScore=Math.min(...actionScores);
    const selectedIndex=actionScores.indexOf(maxScore);
    const selectedConfidence=clamp(.42+foresightGate*.3+(maxScore-minScore)*.55-(args.uncertainty01*.22));
    this.state.lastActionScores=actionScores.slice();this.state.lastCounterfactualReward=counterfactual.slice();this.state.lastSelectedConfidence01=selectedConfidence;
    this.state.epistemicValue01=clamp(this.state.epistemicValue01*.92+(.45+baseEpistemic*.35+rawDisagreement*.2)*.08);
    this.state.decisionCount++;this.state.tick=args.tick;
    const scale=.055*(.55+.45*budget);
    const actionBias=Object.fromEntries(ACTIONS.map((a,ai)=>[a,clamp((actionScores[ai]!-0.5)*scale,-.045,.045)])) as Record<ActionKind,number>;
    return {actionBias,counterfactualReward:counterfactual,selectedForesight01:foresightGate,epistemicValue01:this.state.epistemicValue01,causalSensitivity01:this.state.causalSensitivity01,transfer01:this.state.transfer01,retrievedMemoryValue01:memoryValue,ruleCount:this.state.rules.length,selectedActionHint:ACTIONS[selectedIndex]??null};
  }

  afterOutcome(args:{tick:number;context:number[];latent:number[];nextLatent:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;retrievedMemoryIds:string[];counterfactualReward:number[];forecastConfidence01:number;disagreement01:number;}):{memoryCredit:Map<string,number>;causalGain01:number;transfer01:number;ruleCreated:boolean}{
    const ai=this.actionIndex(args.action),reward=clamp(args.reward01),pred=this.state.lastCounterfactualReward[ai]??.5;
    const delta=reward-pred;
    const count=(this.state.actionCount[ai]??0)+1;
    const oldMean=this.state.actionRewardMean01[ai]??.5;
    const eta=clamp(.08/Math.sqrt(count),.01,.08);
    this.state.actionCount[ai]=count;
    this.state.actionRewardMean01[ai]=clamp(oldMean+eta*delta);
    this.state.actionValue01[ai]=clamp((this.state.actionValue01[ai]??.5)*.88+reward*.12);
    this.state.actionConfidence01[ai]=clamp((this.state.actionConfidence01[ai]??.25)*.92+(1-Math.abs(delta))*.08);
    this.state.actionDisagreement01[ai]=clamp((this.state.actionDisagreement01[ai]??.25)*.9+Math.abs(delta)*.1);
    this.state.policyUpdates++;this.state.learningUpdates++;

    const ctxKey=hashKey(args.context),observedDelta=args.nextLatent.slice(0,8).map((v,i)=>finite(v)-finite(args.latent[i]));
    const matched=this.state.traces.filter(t=>t.action!==args.action && cosine(t.context,args.context)>.93).slice(-12);
    let causalGain=0;
    if(matched.length){const alt=matched.reduce((s,t)=>s+t.realizedReward01,0)/matched.length;causalGain=Math.abs(reward-alt);this.state.causalComparisons+=matched.length;}
    const cfMean=args.counterfactualReward.length?args.counterfactualReward.reduce((s,v)=>s+v,0)/args.counterfactualReward.length:.5;
    const predictionDisagreement=Math.abs(reward-(args.counterfactualReward[ai]??cfMean));
    causalGain=Math.max(causalGain,predictionDisagreement*.7);
    this.state.causalSensitivity01=clamp(this.state.causalSensitivity01*.94+causalGain*.06);

    const similar=this.state.traces.filter(t=>t.action===args.action && cosine(t.context,args.context)>.93).slice(-8);
    if(similar.length){const transferTarget=similar.reduce((s,t)=>s+Math.max(0,1-dist(t.realizedNext,args.nextLatent)),0)/similar.length;this.state.transfer01=clamp(this.state.transfer01*.93+transferTarget*.07);this.state.transferComparisons+=similar.length;}

    const updateMagnitude=clamp(Math.abs(delta)*.65+args.predictionError01*.25+predictionDisagreement*.10);
    this.state.modelTime01=clamp(this.state.modelTime01+updateMagnitude*.018);
    this.state.forgettingDebt01=clamp(this.state.forgettingDebt01*.994+updateMagnitude*.035);
    const conflictingRules=this.state.rules.filter(r=>r.action===args.action && cosine(r.context,args.context)>.90 && dist(r.delta,observedDelta)>.35).slice(-8);
    if(conflictingRules.length){
      this.state.conflictCount+=conflictingRules.length;
      this.state.negativeTransfer01=clamp(this.state.negativeTransfer01*.96+clamp(conflictingRules.length/8)*.04);
      for(const r of conflictingRules) r.contradiction01=clamp(r.contradiction01*.85+.15);
    }
    let ruleCreated=false;let bestRule:SemanticWorldRule|undefined;let bestScore=0;
    for(const r of this.state.rules){if(r.action!==args.action)continue;const s=.55*cosine(r.context,args.context)+.30*cosine(r.delta,observedDelta)+.15*r.confidence01;if(s>bestScore){bestScore=s;bestRule=r;}}
    if(bestRule && bestScore>.46){bestRule.delta=bestRule.delta.map((v,i)=>v*.82+observedDelta[i]!*.18);bestRule.confidence01=clamp(bestRule.confidence01*.9+(1-Math.min(1,predictionDisagreement))*0.1);bestRule.support+=1;bestRule.lastTick=args.tick;bestRule.contradiction01=clamp(bestRule.contradiction01*.92+predictionDisagreement*.08);}
    else if(this.state.rules.length<96 || predictionDisagreement>.2){
      const rule:SemanticWorldRule={id:`rule-${args.tick}-${this.state.learningUpdates}`,contextKey:ctxKey,context:args.context.slice(0,16),action:args.action,delta:observedDelta,confidence01:clamp(.45+(1-predictionDisagreement)*.35),support:1,lastTick:args.tick,contradiction01:predictionDisagreement};
      this.state.rules.push(rule);if(this.state.rules.length>96)this.state.rules.shift();this.state.lastRuleId=rule.id;ruleCreated=true;
    }

    const trace:CausalTransitionTrace={tick:args.tick,contextKey:ctxKey,context:args.context.slice(0,16),action:args.action,predictedReward01:args.counterfactualReward[ai]??.5,realizedReward01:reward,predictedNext:[],realizedNext:args.nextLatent.slice(0,8),retrievedMemoryIds:args.retrievedMemoryIds.slice(0,8),matchedAlternativeCount:matched.length,causalGain01:causalGain};
    this.state.traces.push(trace);if(this.state.traces.length>256)this.state.traces.shift();
    this.state.longHorizonConsistency01=clamp(this.state.longHorizonConsistency01*.94+(1-Math.min(1,args.predictionError01))*.06);
    this.state.selectiveForesight01=clamp(this.state.selectiveForesight01*.95+clamp(args.forecastConfidence01-.18*args.disagreement01)*.05);
    this.state.lastMemoryCredit=args.retrievedMemoryIds.map((id,idx)=>clamp(delta*(0.7/(idx+1))));
    const memoryCredit=new Map<string,number>();for(let i=0;i<args.retrievedMemoryIds.length;i++)memoryCredit.set(args.retrievedMemoryIds[i]!,this.state.lastMemoryCredit[i]??0);
    return {memoryCredit,causalGain01:causalGain,transfer01:this.state.transfer01,ruleCreated};
  }

  dreamRehearse(budget=4){
    const b=Math.max(0,Math.min(12,Math.floor(budget)));
    if(b===0 || this.state.rules.length===0 || this.state.traces.length===0){ this.state.lastDreamQuality01=0; return {selected:0,updates:0,quality01:0,forgettingDebt01:this.state.forgettingDebt01}; }
    const candidates=this.state.rules.map((rule,idx)=>{
      const trace=this.state.traces.slice().reverse().find(t=>t.action===rule.action && cosine(t.context,rule.context)>.88);
      const support=clamp(rule.support/10);
      const grade=clamp(.42*rule.confidence01+.24*(1-rule.contradiction01)+.18*support+.16*(trace?1-Math.abs(trace.realizedReward01-trace.predictedReward01):.2));
      return {rule,trace,grade,idx};
    }).filter(x=>x.trace && x.grade>.45).sort((a,b)=>b.grade-a.grade).slice(0,b);
    let updates=0,quality=0;
    for(const c of candidates){
      const ai=this.actionIndex(c.rule.action), trace=c.trace!;
      const target=clamp(trace.realizedReward01);
      const eta=.012*(.5+.5*c.grade);
      this.state.actionRewardMean01[ai]=clamp(this.state.actionRewardMean01[ai]!+(target-this.state.actionRewardMean01[ai]!)*eta);
      this.state.actionValue01[ai]=clamp(this.state.actionValue01[ai]!+(target-this.state.actionValue01[ai]!)*eta*.8);
      this.state.actionConfidence01[ai]=clamp(this.state.actionConfidence01[ai]!+.015*c.grade);
      this.state.protectedActionSkill01[ai]=clamp(this.state.protectedActionSkill01[ai]!*.985+c.grade*.015);
      this.state.skillRetention01[ai]=clamp(this.state.skillRetention01[ai]!*.99+c.grade*.01);
      this.state.forgettingDebt01=clamp(this.state.forgettingDebt01-.018*c.grade);
      this.state.dreamUpdates++;updates++;quality+=c.grade;
    }
    this.state.dreamRehearsalCount++;
    this.state.lastDreamQuality01=candidates.length?quality/candidates.length:0;
    return {selected:candidates.length,updates,quality01:this.state.lastDreamQuality01,forgettingDebt01:this.state.forgettingDebt01};
  }

  maintenanceBudget(){
    const urgency=clamp(this.state.forgettingDebt01*.72+this.state.negativeTransfer01*.20+this.state.modelTime01*.08);
    return Math.max(0,Math.min(8,Math.round(urgency*8)));
  }

  metrics(){
    return {
      tick:this.state.tick,decisionCount:this.state.decisionCount,learningUpdates:this.state.learningUpdates,
      policyUpdates:this.state.policyUpdates,causalComparisons:this.state.causalComparisons,
      transferComparisons:this.state.transferComparisons,selectiveForesight01:this.state.selectiveForesight01,
      epistemicValue01:this.state.epistemicValue01,causalSensitivity01:this.state.causalSensitivity01,
      transfer01:this.state.transfer01,longHorizonConsistency01:this.state.longHorizonConsistency01,
      ruleCount:this.state.rules.length,traceCount:this.state.traces.length,
      lastSelectedConfidence01:this.state.lastSelectedConfidence01,lastComputeCost01:this.state.lastComputeCost01,
      retainedForesightCount:this.state.retainedForesightCount,rejectedForesightCount:this.state.rejectedForesightCount,
      lastCounterfactualReward:this.state.lastCounterfactualReward.slice(),lastActionScores:this.state.lastActionScores.slice(),
      dreamRehearsalCount:this.state.dreamRehearsalCount,dreamUpdates:this.state.dreamUpdates,modelTime01:this.state.modelTime01,forgettingDebt01:this.state.forgettingDebt01,skillRetention01:this.state.skillRetention01.slice(),protectedActionSkill01:this.state.protectedActionSkill01.slice(),conflictCount:this.state.conflictCount,negativeTransfer01:this.state.negativeTransfer01,lastDreamQuality01:this.state.lastDreamQuality01,maintenanceBudget:this.maintenanceBudget()
    };
  }
  diagnostics(){return deep(this.state);}
}
