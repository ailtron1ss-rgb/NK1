import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIM=24, MAX_ROWS=192;
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const mse=(a:number[],b:number[])=>a.length?clamp01(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/a.length):0;
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
const variance=(v:number[])=>{const m=mean(v);return mean(v.map(x=>(x-m)*(x-m)));};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const seed=(label:string)=>(((hash(label)%2001)/1000)-1)*.02;

export interface B263Observation {
  tick:number; action:ActionKind; before:number[]; after:number[]; reward01:number; surprise01:number;
  delta:number[]; predictedDelta:number[]; predictionError01:number; replayCount:number;
}
export interface B263Intervention {
  action:ActionKind; predictedAfter:number[]; predictedDelta:number[]; predictedReward01:number;
  causalEffect01:number; uncertainty01:number;
}
export interface B263State {
  version:1; dimension:number; rows:B263Observation[]; updates:number; interventions:number; replayRuns:number;
  actionWeights:number[][][]; actionBias:number[][]; rewardWeights:number[]; rewardBias:number;
  baselineBias:number[]; baselineVariance:number[]; featureCausalStrength:number[]; actionEffect01:number[];
  meanPredictionError01:number; shuffledBaselineError01:number; conditionedError01:number;
  causalGain01:number; interventionConfidence01:number; reproducibility01:number; behavioralGain01:number;
  lastTick:number; stableAction:ActionKind|null;
}

export function defaultB263RealActionCausality():B263State{
  return {
    version:1,dimension:DIM,rows:[],updates:0,interventions:0,replayRuns:0,
    actionWeights:ACTIONS.map(a=>Array.from({length:DIM},(_,i)=>Array.from({length:DIM},(_,j)=>seed(`${a}:w:${i}:${j}`)))),
    actionBias:ACTIONS.map(a=>Array.from({length:DIM},(_,i)=>seed(`${a}:b:${i}`))),
    rewardWeights:Array.from({length:DIM},(_,i)=>seed(`rw:${i}`)),rewardBias:0,
    baselineBias:new Array(DIM).fill(0),baselineVariance:new Array(DIM).fill(.1),
    featureCausalStrength:new Array(DIM).fill(0),actionEffect01:new Array(ACTIONS.length).fill(0),
    meanPredictionError01:.5,shuffledBaselineError01:.5,conditionedError01:.5,causalGain01:0,
    interventionConfidence01:.08,reproducibility01:0,behavioralGain01:0,lastTick:0,stableAction:null,
  };
}

export class B263RealActionCausality {
  private state=defaultB263RealActionCausality();
  restore(raw?:Partial<B263State>|null){
    const d=defaultB263RealActionCausality(),r=raw??{};
    const vec=(v:any[]|undefined,n:number,fill=0)=>Array.from({length:n},(_,i)=>clamp(Number(v?.[i]??fill)));
    const mats=(m:any[][][]|undefined)=>ACTIONS.map((a,ai)=>Array.from({length:DIM},(_,i)=>Array.from({length:DIM},(_,j)=>clamp(Number(m?.[ai]?.[i]?.[j]??d.actionWeights[ai][i][j])))));
    this.state={...d,...r,dimension:DIM,actionWeights:mats(r.actionWeights),actionBias:ACTIONS.map((a,ai)=>vec(r.actionBias?.[ai],DIM,d.actionBias[ai][0])),rewardWeights:vec(r.rewardWeights,DIM),baselineBias:vec(r.baselineBias,DIM),baselineVariance:Array.from({length:DIM},(_,i)=>Math.max(.0001,Number(r.baselineVariance?.[i]??d.baselineVariance[i]))),featureCausalStrength:vec(r.featureCausalStrength,DIM),actionEffect01:vec(r.actionEffect01,ACTIONS.length),rows:Array.isArray(r.rows)?r.rows.slice(-MAX_ROWS):[]};
  }
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {updates:this.state.updates,interventions:this.state.interventions,replayRuns:this.state.replayRuns,rows:this.state.rows.length,meanPredictionError01:this.state.meanPredictionError01,shuffledBaselineError01:this.state.shuffledBaselineError01,conditionedError01:this.state.conditionedError01,causalGain01:this.state.causalGain01,interventionConfidence01:this.state.interventionConfidence01,reproducibility01:this.state.reproducibility01,behavioralGain01:this.state.behavioralGain01,stableAction:this.state.stableAction};}
  private ai(action:ActionKind){return Math.max(0,ACTIONS.indexOf(action));}
  private predictDelta(before:number[],action:ActionKind){
    const ai=this.ai(action),w=this.state.actionWeights[ai],b=this.state.actionBias[ai];
    return Array.from({length:DIM},(_,i)=>clamp(b[i]+w[i].reduce((s,v,j)=>s+v*(Number(before[j]??0)),0)*.35));
  }
  private predictReward(before:number[],action:ActionKind){
    const d=this.predictDelta(before,action), ai=this.ai(action);
    const actionPrior=.05*Math.tanh((ai-2)/2);
    return clamp01(sigmoid(this.state.rewardBias+this.state.rewardWeights.reduce((s,w,i)=>s+w*((before[i]??0)+d[i]*.5),0)+actionPrior));
  }
  intervene(before:number[],action:ActionKind):B263Intervention{
    const delta=this.predictDelta(before,action); const after=before.map((v,i)=>clamp((Number(v??0)+delta[i])));
    const baseReward=this.predictReward(before,'wait'); const reward=this.predictReward(before,action);
    const uncertainty=clamp01(.72/(1+Math.sqrt(this.state.updates))+Math.max(0,.25-this.state.reproducibility01)*.45);
    const effect=clamp01(Math.abs(reward-baseReward)*.65 + mean(delta.map(Math.abs))*.35);
    this.state.interventions++;
    this.state.interventionConfidence01=clamp01(this.state.interventionConfidence01*.9+(1-uncertainty)*.1);
    return {action,predictedAfter:after,predictedDelta:delta,predictedReward01:reward,causalEffect01:effect,uncertainty01:uncertainty};
  }
  observe(before:number[],action:ActionKind,after:number[],reward01:number,tick:number,surprise01=0){
    const delta=after.map((v,i)=>clamp(Number(v??0)-Number(before[i]??0))).slice(0,DIM);
    const pred=this.predictDelta(before,action); const err=mse(pred,delta);
    const ai=this.ai(action), lr=.055/Math.sqrt(1+this.state.updates/300);
    const w=this.state.actionWeights[ai], b=this.state.actionBias[ai];
    for(let i=0;i<DIM;i++){ const e=clamp((delta[i]??0)-pred[i]); for(let j=0;j<DIM;j++) w[i][j]=clamp(w[i][j]+lr*e*(Number(before[j]??0))); b[i]=clamp(b[i]+lr*.42*e); this.state.featureCausalStrength[i]=clamp01(this.state.featureCausalStrength[i]*.98+Math.abs(e)*Math.abs(Number(before[i]??0))*.02); }
    const rp=this.predictReward(before,action), re=clamp(reward01-rp), lrr=.035/Math.sqrt(1+this.state.updates/300);
    for(let i=0;i<DIM;i++)this.state.rewardWeights[i]=clamp(this.state.rewardWeights[i]+lrr*re*((before[i]??0)+.5*(delta[i]??0)));
    this.state.rewardBias=clamp(this.state.rewardBias+lrr*.5*re);
    this.state.updates++; this.state.lastTick=tick;
    this.state.meanPredictionError01=this.state.meanPredictionError01*.95+err*.05;
    const row:B263Observation={tick,action,before:before.slice(0,DIM),after:after.slice(0,DIM),reward01:clamp01(reward01),surprise01:clamp01(surprise01),delta, predictedDelta:pred, predictionError01:err,replayCount:0};
    this.state.rows=[...this.state.rows.slice(-(MAX_ROWS-1)),row];
    this.refreshMetrics();
    return {predictionError01:err,rewardError01:Math.abs(re)};
  }
  private refreshMetrics(){
    const rows=this.state.rows.slice(-64); if(!rows.length)return;
    const conditioned=mean(rows.map(r=>mse(this.predictDelta(r.before,r.action),r.delta)));
    const shuffled=mean(rows.map((r,i)=>{const other=rows[(i*7+3)%rows.length]; return mse(this.predictDelta(r.before,other.action),r.delta);}));
    this.state.conditionedError01=conditioned; this.state.shuffledBaselineError01=shuffled;
    this.state.causalGain01=clamp01(this.state.causalGain01*.85+Math.max(0,shuffled-conditioned)*.15);
    const actionCounts=ACTIONS.map(a=>rows.filter(r=>r.action===a));
    this.state.actionEffect01=ACTIONS.map((a,ai)=>{const rr=actionCounts[ai]; if(!rr.length)return this.state.actionEffect01[ai]; const reward=mean(rr.map(r=>r.reward01)); const delta=mean(rr.map(r=>mean(r.delta.map(Math.abs)))); return clamp01(.6*reward+.4*delta);});
    const repeatable=rows.filter(r=>r.replayCount>0);
    this.state.reproducibility01=clamp01(repeatable.length?mean(repeatable.map(r=>1-r.predictionError01)):Math.max(0,1-conditioned));
    const best=Math.max(...this.state.actionEffect01), idx=this.state.actionEffect01.indexOf(best); this.state.stableAction=best>.52?ACTIONS[idx]??null:null;
    this.state.behavioralGain01=clamp01(this.state.behavioralGain01*.9+Math.max(0,this.state.causalGain01-this.state.meanPredictionError01)*.1);
  }
  replay(batch=12){
    const rows=this.state.rows.filter(r=>r.replayCount<2).slice(-batch); if(!rows.length){this.state.replayRuns++;return {rows:0,gain01:0};}
    const before=mean(rows.map(r=>r.predictionError01));
    for(const r of rows){this.observe(r.before,r.action,r.after,r.reward01,r.tick,r.surprise01);r.replayCount++;}
    this.state.replayRuns++; const after=mean(rows.map(r=>this.predictError(r))); const gain=Math.max(0,before-after); this.state.behavioralGain01=clamp01(this.state.behavioralGain01*.8+gain*.2); this.refreshMetrics();
    return {rows:rows.length,gain01:gain,causalGain01:this.state.causalGain01};
  }
  private predictError(r:B263Observation){return mse(this.predictDelta(r.before,r.action),r.delta);}
  holdout(samples:Array<{before:number[];action:ActionKind;after:number[];reward01:number}>){
    if(!samples.length)return {conditioned01:this.state.conditionedError01,shuffled01:this.state.shuffledBaselineError01,causalGain01:this.state.causalGain01,samples:0};
    const conditioned=samples.map(s=>mse(this.predictDelta(s.before,s.action),s.after.map((v,i)=>clamp(v-(s.before[i]??0)))));
    const shuffled=samples.map((s,i)=>mse(this.predictDelta(s.before,ACTIONS[(this.ai(s.action)+i+1)%ACTIONS.length]),s.after.map((v,j)=>clamp(v-(s.before[j]??0)))));
    const c=mean(conditioned), b=mean(shuffled), gain=clamp01(Math.max(0,b-c)); this.state.causalGain01=clamp01(this.state.causalGain01*.8+gain*.2);
    return {conditioned01:c,shuffled01:b,causalGain01:this.state.causalGain01,samples:samples.length};
  }
  ablateAction(action:ActionKind){
    const rows=this.state.rows.filter(r=>r.action===action).slice(-24); if(!rows.length)return {action,baseline01:0,ablated01:0,drop01:0,samples:0};
    const baseline=mean(rows.map(r=>mse(this.predictDelta(r.before,r.action),r.delta)));
    const altAction=ACTIONS.find(a=>a!==action)??'wait';
    const ablated=mean(rows.map(r=>mse(this.predictDelta(r.before,altAction),r.delta)));
    return {action,baseline01:baseline,ablated01:ablated,drop01:Math.max(0,ablated-baseline),samples:rows.length,alternativeAction:altAction};
  }
  compareActions(before:number[]){return ACTIONS.map(action=>this.intervene(before,action));}
}
