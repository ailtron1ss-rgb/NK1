import type { ActionKind, IntentCandidate, OrganismState } from '../core/types.ts';
import { B263RealActionCausality, type B263Intervention, type B263State } from './B263RealActionCausality.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));

export interface B264PolicyDecisionRow {
  tick:number; context:number[]; action:ActionKind; causalScore01:number; baselineScore01:number;
  reward01:number; regret01:number; counterfactualMargin01:number; uncertainty01:number;
}
export interface B264State {
  version:1; dimension:number; rows:B264PolicyDecisionRow[]; decisions:number; policyUpdates:number; replayRuns:number;
  actionBias:number[]; actionValue:number[]; actionCounts:number[]; contextWeights:number[][]; contextBias:number[];
  meanRegret01:number; baselineMeanReward01:number; causalMeanReward01:number;
  policyGain01:number; holdoutGain01:number; unseenTaskGain01:number; causalReliance01:number;
  lastTick:number; lastChosen:ActionKind|null; interventionCount:number;
}

export function defaultB264CausalPolicyLearning():B264State{
  return {version:1,dimension:16,rows:[],decisions:0,policyUpdates:0,replayRuns:0,
    actionBias:new Array(ACTIONS.length).fill(0),actionValue:new Array(ACTIONS.length).fill(.5),actionCounts:new Array(ACTIONS.length).fill(0),
    contextWeights:ACTIONS.map((_,a)=>Array.from({length:16},(_,i)=>(((a*17+i*13)%29)/28-.5)*.012)),contextBias:new Array(ACTIONS.length).fill(0),
    meanRegret01:.5,baselineMeanReward01:.5,causalMeanReward01:.5,policyGain01:0,holdoutGain01:0,unseenTaskGain01:0,causalReliance01:0,
    lastTick:0,lastChosen:null,interventionCount:0};
}

export class B264CausalPolicyLearning {
  private state=defaultB264CausalPolicyLearning();
  restore(raw?:Partial<B264State>|null){
    const d=defaultB264CausalPolicyLearning(),r=raw??{};
    const vec=(v:any[]|undefined,n:number,fill=0)=>Array.from({length:n},(_,i)=>clamp(Number(v?.[i]??fill)));
    const matrix=(m:any[][]|undefined)=>ACTIONS.map((_,a)=>vec(m?.[a],16,d.contextWeights[a][0]));
    this.state={...d,...r,dimension:16,actionBias:vec(r.actionBias,ACTIONS.length),actionValue:Array.from({length:ACTIONS.length},(_,i)=>clamp01(Number(r.actionValue?.[i]??d.actionValue[i]))),actionCounts:Array.from({length:ACTIONS.length},(_,i)=>Math.max(0,Number(r.actionCounts?.[i]??0))),contextWeights:matrix(r.contextWeights),contextBias:vec(r.contextBias,ACTIONS.length),rows:Array.isArray(r.rows)?r.rows.slice(-256):[]};
  }
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return structuredClone({decisions:this.state.decisions,policyUpdates:this.state.policyUpdates,replayRuns:this.state.replayRuns,rows:this.state.rows.length,meanRegret01:this.state.meanRegret01,baselineMeanReward01:this.state.baselineMeanReward01,causalMeanReward01:this.state.causalMeanReward01,policyGain01:this.state.policyGain01,holdoutGain01:this.state.holdoutGain01,unseenTaskGain01:this.state.unseenTaskGain01,causalReliance01:this.state.causalReliance01,lastChosen:this.state.lastChosen,interventionCount:this.state.interventionCount});}
  private ai(a:ActionKind){return Math.max(0,ACTIONS.indexOf(a));}
  private features(candidate:IntentCandidate|undefined,state:OrganismState){
    const a=candidate?.action??'wait'; const i=this.ai(a); const n=state.needs;
    return [candidate?.predictedUtility??.5,candidate?.confidence??.5,candidate?.predictedCost??.5,n.energy,1-n.cognitiveLoad,n.uncertainty,n.novelty,n.goalPressure,n.socialNeed,state.predictionError,state.selfPredictionError,state.attentionBudget,state.autonomyScore??.5,i/6, a==='verify'?1:a==='explore'?0.8:a==='reflect'?0.65:0.45, a==='rest'?1:(a==='wait'||a==='defer'?.7:.25)].map(clamp01);
  }
  private scoreFeatures(features:number[],action:ActionKind){const i=this.ai(action);const w=this.state.contextWeights[i];return clamp01(sigmoid(this.state.contextBias[i]+this.state.actionBias[i]+this.state.actionValue[i]*.8+w.reduce((s,v,j)=>s+v*(features[j]??0),0)));}
  decide(candidates:IntentCandidate[], causal:B263RealActionCausality|B263State, state:OrganismState, tick:number){
    const rows=candidates.map(c=>{
      const f=this.features(c,state); const iv=causal instanceof B263RealActionCausality ? causal.intervene(this.contextToLatent(f),c.action) : null;
      const causalReward=iv ? clamp01(iv.predictedReward01*.62 + (1-iv.uncertainty01)*.12 + iv.causalEffect01*.16 + (c.predictedUtility??.5)*.10) : clamp01(c.predictedUtility??.5);
      const learned=this.scoreFeatures(f,c.action);
      const score=clamp01(causalReward*.62 + learned*.25 + (c.confidence??.5)*.08 + (1-(c.predictedCost??.5))*.05);
      const baseline=clamp01((c.predictedUtility??.5)*.78 + (c.confidence??.5)*.12 + (1-(c.predictedCost??.5))*.10);
      return {candidate:c,features:f,causalReward,learned,score,baseline,uncertainty:iv?.uncertainty01??.5,intervention:iv};
    });
    rows.sort((a,b)=>b.score-a.score);
    const winner=rows[0]; if(winner){this.state.decisions++;this.state.lastTick=tick;this.state.lastChosen=winner.candidate.action; if(winner.intervention)this.state.interventionCount++;}
    const base=rows.slice().sort((a,b)=>b.baseline-a.baseline)[0];
    return {chosen:winner?.candidate??null,baseline:base?.candidate??null,margin01:winner&&base?clamp01(winner.score-base.score):0,rankings:rows.map(r=>({action:r.candidate.action,score01:r.score,baseline01:r.baseline,causalReward01:r.causalReward,learned01:r.learned,uncertainty01:r.uncertainty}))};
  }
  private contextToLatent(features:number[]){return Array.from({length:24},(_,i)=>clamp((features[i%features.length]??.5)*2-1));}
  observeOutcome(input:{tick:number;context:number[];action:ActionKind;reward01:number;predictedPolicy01:number;baselinePredicted01:number;causalMargin01:number;uncertainty01:number}){
    const i=this.ai(input.action),r=clamp01(input.reward01),lr=.09/Math.sqrt(1+this.state.policyUpdates/180);
    const prediction=clamp01(this.scoreFeatures(input.context,input.action)); const err=r-prediction;
    this.state.actionCounts[i]++; this.state.actionValue[i]=clamp01(this.state.actionValue[i]+lr*err);
    this.state.actionBias[i]=clamp(this.state.actionBias[i]+lr*.55*err);
    const w=this.state.contextWeights[i]; for(let j=0;j<w.length;j++) w[j]=clamp(w[j]+lr*.35*err*(input.context[j]??0));
    const regret=clamp01(Math.max(0,input.baselinePredicted01-r));
    const row:B264PolicyDecisionRow={tick:input.tick,context:input.context.slice(0,16).map(clamp01),action:input.action,causalScore01:clamp01(input.predictedPolicy01),baselineScore01:clamp01(input.baselinePredicted01),reward01:r,regret01:regret,counterfactualMargin01:clamp01(input.causalMargin01),uncertainty01:clamp01(input.uncertainty01)};
    this.state.rows=[...this.state.rows.slice(-255),row]; this.state.policyUpdates++; this.refresh(); return {predictionError01:Math.abs(err),regret01:regret};
  }
  private refresh(){const rows=this.state.rows.slice(-96);if(!rows.length)return;const causalR=mean(rows.map(r=>r.reward01));const baseR=mean(rows.map(r=>Math.max(0,r.reward01-r.regret01)));this.state.causalMeanReward01=causalR;this.state.baselineMeanReward01=baseR;this.state.meanRegret01=mean(rows.map(r=>r.regret01));this.state.policyGain01=clamp01(Math.max(0,causalR-baseR));this.state.causalReliance01=clamp01(this.state.causalReliance01*.9+mean(rows.map(r=>r.counterfactualMargin01))*0.1);}
  replay(batch=24){const rows=this.state.rows.slice(-batch);if(!rows.length){this.state.replayRuns++;return {rows:0,gain01:0};}const before=this.state.policyGain01;for(const r of rows)this.observeOutcome({tick:r.tick,context:r.context,action:r.action,reward01:r.reward01,predictedPolicy01:r.causalScore01,baselinePredicted01:r.baselineScore01,causalMargin01:r.counterfactualMargin01,uncertainty01:r.uncertainty01});this.state.replayRuns++;this.refresh();return {rows:rows.length,gain01:Math.max(0,this.state.policyGain01-before),policyGain01:this.state.policyGain01};}
  evaluateHoldout(samples:Array<{context:number[];action:ActionKind;reward01:number;baselineReward01:number;causalMargin01:number}>){if(!samples.length)return {samples:0,policyReward01:.5,baselineReward01:.5,gain01:0};const policy=mean(samples.map(s=>this.scoreFeatures(s.context,s.action)));const base=mean(samples.map(s=>s.baselineReward01));const gain=clamp01(Math.max(0,policy-base));this.state.holdoutGain01=gain;return {samples:samples.length,policyReward01:policy,baselineReward01:base,gain01:gain};}
  selectFromRealCandidates(candidates:IntentCandidate[],causal:B263RealActionCausality,state:OrganismState,tick:number){return this.decide(candidates,causal,state,tick);}
  evaluateUnseenTask(samples:Array<{context:number[];action:ActionKind;reward01:number;baselineReward01:number;causalMargin01:number}>){const r=this.evaluateHoldout(samples);this.state.unseenTaskGain01=r.gain01;return {...r,unseenTaskGain01:r.gain01};}
}
