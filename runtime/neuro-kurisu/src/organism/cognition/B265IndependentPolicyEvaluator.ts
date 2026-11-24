import type { ActionKind, IntentCandidate, OrganismState } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;

export interface B265TrajectoryStep { step:number; action:ActionKind; context:number[]; reward01:number; state:number[]; nextState:number[]; }
export interface B265Episode { taskId:string; steps:B265TrajectoryStep[]; policyReturn01:number; baselineReturn01:number; randomReturn01:number; regret01:number; evaluatorScore01:number; }
export interface B265IndependentPolicyEvaluatorState {
  version:1; episodes:B265Episode[]; evaluations:number; steps:number; heldoutEpisodes:number;
  policyReturn01:number; baselineReturn01:number; randomReturn01:number; advantage01:number; heldoutAdvantage01:number;
  longHorizonGain01:number; evaluatorAgreement01:number; counterfactualGain01:number; calibration01:number;
  lastTaskId:string|null; lastTick:number;
}

export interface B265Environment { taskId:string; initialState:number[]; transition:(state:number[],action:ActionKind,step:number)=>{nextState:number[];reward01:number}; }

export function defaultB265IndependentPolicyEvaluator():B265IndependentPolicyEvaluatorState{
  return {version:1,episodes:[],evaluations:0,steps:0,heldoutEpisodes:0,policyReturn01:.5,baselineReturn01:.5,randomReturn01:.5,advantage01:0,heldoutAdvantage01:0,longHorizonGain01:0,evaluatorAgreement01:0,counterfactualGain01:0,calibration01:.5,lastTaskId:null,lastTick:0};
}

export class B265IndependentPolicyEvaluator {
  private state=defaultB265IndependentPolicyEvaluator();
  restore(raw?:Partial<B265IndependentPolicyEvaluatorState>|null){ const d=defaultB265IndependentPolicyEvaluator(); this.state={...d,...raw,episodes:Array.isArray(raw?.episodes)?raw!.episodes.slice(-128):[]}; }
  snapshot(){ return structuredClone(this.state); }
  diagnostics(){ return structuredClone({...this.state,episodes:this.state.episodes.length}); }

  private baselineCandidate(candidates:IntentCandidate[]){
    return candidates.slice().sort((a,b)=>((b.predictedUtility??.5)+(b.confidence??.5)*.15-(b.predictedCost??.5)*.15)-((a.predictedUtility??.5)+(a.confidence??.5)*.15-(a.predictedCost??.5)*.15))[0] ?? candidates[0] ?? null;
  }
  private randomAction(seed:number){ return ACTIONS[Math.abs(seed)%ACTIONS.length]; }
  private candidate(action:ActionKind, state:OrganismState):IntentCandidate{
    return {id:`b265-${action}`,action,score:.5,predictedUtility:.5,predictedNeedRelief:.5,predictedCost:.3,confidence:.55,generatedAt:0} as IntentCandidate;
  }

  evaluateEpisode(env:B265Environment, choose:(state:OrganismState,step:number)=>ActionKind, horizon=8, seed=1, persist=true):B265Episode{
    let state=env.initialState.slice(); let policyReturn=0, baselineReturn=0, randomReturn=0; const steps:B265TrajectoryStep[]=[];
    for(let t=0;t<horizon;t++){
      const os={} as OrganismState;
      const action=choose(os,t);
      const baseline=this.baselineCandidate(ACTIONS.map(a=>this.candidate(a,os)))?.action ?? 'wait';
      const random=this.randomAction(seed+t*17);
      const p=env.transition(state,action,t), b=env.transition(state,baseline,t), r=env.transition(state,random,t);
      policyReturn=policyReturn*.92+p.reward01; baselineReturn=baselineReturn*.92+b.reward01; randomReturn=randomReturn*.92+r.reward01;
      steps.push({step:t,action,context:state.slice(0,16).map(clamp01),reward01:p.reward01,state:state.slice(),nextState:p.nextState.slice()});
      state=p.nextState;
    }
    const norm=(x:number)=>clamp01(x/horizon); const pr=norm(policyReturn), br=norm(baselineReturn), rr=norm(randomReturn);
    const episode:B265Episode={taskId:env.taskId,steps,policyReturn01:pr,baselineReturn01:br,randomReturn01:rr,regret01:Math.max(0,br-pr),evaluatorScore01:clamp01(.5+.5*(pr-Math.max(br,rr)))};
    if(persist)this.record(episode,false); return episode;
  }

  record(episode:B265Episode,holdout=false){
    this.state.episodes=[...this.state.episodes.slice(-127),structuredClone(episode)]; this.state.evaluations++; this.state.steps+=episode.steps.length; if(holdout)this.state.heldoutEpisodes++;
    const recent=this.state.episodes.slice(-64); this.state.policyReturn01=mean(recent.map(e=>e.policyReturn01)); this.state.baselineReturn01=mean(recent.map(e=>e.baselineReturn01)); this.state.randomReturn01=mean(recent.map(e=>e.randomReturn01));
    this.state.advantage01=mean(recent.map(e=>Math.max(0,e.policyReturn01-Math.max(e.baselineReturn01,e.randomReturn01))));
    this.state.longHorizonGain01=mean(recent.map(e=>Math.max(0,e.policyReturn01-e.baselineReturn01)));
    this.state.evaluatorAgreement01=mean(recent.map(e=>e.evaluatorScore01)); this.state.lastTaskId=episode.taskId;
  }

  evaluateHoldout(envs:B265Environment[], chooseFactory:(env:B265Environment)=>((state:OrganismState,step:number)=>ActionKind), horizon=8){
    const holdout=envs.map((env,i)=>this.evaluateEpisode(env,chooseFactory(env),horizon,97+i,false));
    for(const e of holdout)this.record(e,true);
    this.state.heldoutAdvantage01=mean(holdout.map(e=>Math.max(0,e.policyReturn01-e.baselineReturn01)));
    return {episodes:holdout.length,policyReturn01:mean(holdout.map(e=>e.policyReturn01)),baselineReturn01:mean(holdout.map(e=>e.baselineReturn01)),randomReturn01:mean(holdout.map(e=>e.randomReturn01)),advantage01:this.state.heldoutAdvantage01};
  }

  evaluateCounterfactual(env:B265Environment, firstAction:ActionKind, alternative:ActionKind, horizon=6){
    const a=env.transition(env.initialState.slice(),firstAction,0); const b=env.transition(env.initialState.slice(),alternative,0);
    let ra=a.reward01, rb=b.reward01, sa=a.nextState.slice(), sb=b.nextState.slice();
    for(let t=1;t<horizon;t++){ const aa=env.transition(sa,'wait',t); const bb=env.transition(sb,'wait',t); ra=.92*ra+aa.reward01; rb=.92*rb+bb.reward01; sa=aa.nextState; sb=bb.nextState; }
    const gain=clamp01(Math.max(0,ra-rb)/horizon); this.state.counterfactualGain01=clamp01(this.state.counterfactualGain01*.8+gain*.2); return {firstAction,alternative,horizon,returnA01:clamp01(ra/horizon),returnB01:clamp01(rb/horizon),gain01:gain};
  }

  evaluateCalibration(envs:B265Environment[], chooseFactory:(env:B265Environment)=>((state:OrganismState,step:number)=>ActionKind), horizon=8){
    const vals=envs.map((env,i)=>this.evaluateEpisode(env,chooseFactory(env),horizon,211+i,false));
    const absErr=mean(vals.map(e=>Math.abs(e.evaluatorScore01-e.policyReturn01))); this.state.calibration01=clamp01(1-absErr); return {episodes:vals.length,calibration01:this.state.calibration01};
  }
}
