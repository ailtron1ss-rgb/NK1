import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIM=24;
const MAX_H=192;
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const tanh=(x:number)=>Math.tanh(Math.max(-5,Math.min(5,x)));
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const seed=(label:string)=>(((hash(label)%2001)/1000)-1)*0.04;
const vecNorm=(v:number[])=>{const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;return v.map(x=>clamp(x/n));};
const mse=(a:number[],b:number[])=>a.length?clamp01(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/a.length):0;

export interface B261WorldModelEpisode { tick:number; action:ActionKind; before:number[]; predictedAfter:number[]; actualAfter:number[]; predictedReward01:number; actualReward01:number; transitionError01:number; rewardError01:number; confidence01:number; replayCount:number; }
export interface B261UnifiedWorldModelState {
  version:1; dimension:number; steps:number; updates:number; trainingUpdates:number;
  rewardSamples:number; transitionSamples:number; lastTick:number;
  hidden:number[]; lastInput:number[]; lastAction:ActionKind|null;
  actionEmbeddings:number[][]; transitionWeights:number[][]; transitionBias:number[];
  rewardWeights:number[]; rewardBias:number; uncertainty01:number;
  onlineTransitionError01:number; onlineRewardError01:number;
  holdoutBefore01:number; holdoutAfter01:number; holdoutDelta01:number;
  lesionTransitionDrop01:number; lesionRewardDrop01:number;
  replayGain01:number; transferGain01:number; actionSensitivity01:number;
  episodes:B261WorldModelEpisode[];
}
export interface B261WorldStep { predictedAfter:number[]; predictedReward01:number; confidence01:number; uncertainty01:number; action:ActionKind; }

export function defaultB261UnifiedWorldModel():B261UnifiedWorldModelState {
  return {version:1,dimension:DIM,steps:0,updates:0,trainingUpdates:0,rewardSamples:0,transitionSamples:0,lastTick:0,
    hidden:new Array(DIM).fill(0),lastInput:new Array(DIM).fill(0),lastAction:null,
    actionEmbeddings:ACTIONS.map(a=>Array.from({length:DIM},(_,i)=>seed(`a:${a}:${i}`))),
    transitionWeights:Array.from({length:DIM},(_,i)=>Array.from({length:DIM},(_,j)=>seed(`t:${i}:${j}`))),
    transitionBias:new Array(DIM).fill(0),rewardWeights:Array.from({length:DIM},(_,i)=>seed(`r:${i}`)),rewardBias:0,uncertainty01:.75,
    onlineTransitionError01:.5,onlineRewardError01:.5,holdoutBefore01:.5,holdoutAfter01:.5,holdoutDelta01:0,
    lesionTransitionDrop01:0,lesionRewardDrop01:0,replayGain01:0,transferGain01:0,actionSensitivity01:0,episodes:[]};
}

export class B261UnifiedWorldModel {
  private state=defaultB261UnifiedWorldModel();
  restore(raw?:Partial<B261UnifiedWorldModelState>|null){
    const d=defaultB261UnifiedWorldModel(),r=raw??{}; const resize=(v:any[]|undefined,n:number,lab:string)=>Array.from({length:n},(_,i)=>clamp(Number(v?.[i]??seed(`${lab}:${i}`))));
    const mats=(m:any[][]|undefined,rows:number,cols:number,lab:string)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>clamp(Number(m?.[i]?.[j]??seed(`${lab}:${i}:${j}`)))));
    this.state={...d,...r,dimension:DIM,hidden:resize(r.hidden,DIM,'h'),lastInput:resize(r.lastInput,DIM,'in'),
      actionEmbeddings:ACTIONS.map((a,ai)=>resize(r.actionEmbeddings?.[ai],DIM,`a:${a}`)),
      transitionWeights:mats(r.transitionWeights,DIM,DIM,'t'),transitionBias:resize(r.transitionBias,DIM,'tb'),rewardWeights:resize(r.rewardWeights,DIM,'r'),
      episodes:Array.isArray(r.episodes)?r.episodes.slice(-MAX_H):d.episodes};
  }
  snapshot(){return structuredClone(this.state);}
  private actionIndex(a:ActionKind){return Math.max(0,ACTIONS.indexOf(a));}
  private input(before:number[], action:ActionKind){
    const x=vecNorm(Array.from({length:DIM},(_,i)=>clamp(Number(before[i]??0))));
    const ai=this.actionIndex(action), emb=this.state.actionEmbeddings[ai];
    return x.map((v,i)=>clamp(v*.86+(emb[i]??0)*.14));
  }
  private predictTransition(before:number[],action:ActionKind){
    const x=this.input(before,action), out=new Array(DIM).fill(0);
    for(let i=0;i<DIM;i++) out[i]=tanh(this.state.transitionBias[i]+this.state.transitionWeights[i].reduce((s,w,j)=>s+w*(x[j]??0),0)*.75+(this.state.hidden[i]??0)*.18);
    const reward=sigmoid(this.state.rewardBias+this.state.rewardWeights.reduce((s,w,i)=>s+w*(x[i]??0),0));
    return {after:out,reward01:reward,x};
  }
  predict(before:number[],action:ActionKind):B261WorldStep{
    const p=this.predictTransition(before,action); const uncertainty=clamp01(.08+.72*this.state.uncertainty01+.16*Math.min(1,Math.sqrt(this.state.updates)/32));
    this.state.steps++; this.state.lastInput=vecNorm(before); this.state.lastAction=action;
    return {predictedAfter:p.after,predictedReward01:p.reward01,confidence01:clamp01(1-uncertainty),uncertainty01:uncertainty,action};
  }
  private learnInternal(before:number[],action:ActionKind,actualAfter:number[],reward01:number,tick:number,source:'online'|'replay',recordEpisode:boolean){
    const p=this.predictTransition(before,action); const target=vecNorm(actualAfter); const terr=p.after.map((v,i)=>clamp(Number(target[i]??0)-v));
    const rErr=clamp(reward01-p.reward01); const lr=.065/Math.sqrt(1+this.state.trainingUpdates/500);
    for(let i=0;i<DIM;i++){
      const row=this.state.transitionWeights[i]; for(let j=0;j<DIM;j++) row[j]=clamp(row[j]+lr*terr[i]*(p.x[j]??0));
      this.state.transitionBias[i]=clamp(this.state.transitionBias[i]+lr*.55*terr[i]);
    }
    for(let i=0;i<DIM;i++)this.state.rewardWeights[i]=clamp(this.state.rewardWeights[i]+lr*.65*rErr*(p.x[i]??0));
    this.state.rewardBias=clamp(this.state.rewardBias+lr*.55*rErr);
    const tErr=mse(p.after,target); const absR=Math.abs(rErr);
    this.state.trainingUpdates++;this.state.updates++;this.state.rewardSamples++;this.state.transitionSamples++;this.state.lastTick=tick;
    this.state.onlineTransitionError01=this.state.onlineTransitionError01*.96+tErr*.04;
    this.state.onlineRewardError01=this.state.onlineRewardError01*.96+absR*.04;
    this.state.uncertainty01=clamp01(this.state.uncertainty01*.97+(tErr*.55+absR*.45)*.03);
    if(recordEpisode) this.state.episodes=[...this.state.episodes.slice(-(MAX_H-1)),{tick,action,before:before.slice(0,DIM),predictedAfter:p.after,actualAfter:target,predictedReward01:p.reward01,actualReward01:clamp01(reward01),transitionError01:tErr,rewardError01:absR,confidence01:1-this.state.uncertainty01,replayCount:0}];
    return {transitionError01:tErr,rewardError01:absR,predictionBeforeReward01:p.reward01,learningDelta01:clamp01((tErr+absR)*.5),source};
  }
  train(before:number[],action:ActionKind,actualAfter:number[],reward01:number,tick:number,source:'online'|'replay'='online'){
    return this.learnInternal(before,action,actualAfter,reward01,tick,source,source==='online');
  }
  replay(batch=8,tick=0){
    const rows=this.state.episodes.filter(e=>e.replayCount<2).slice(-batch); let before=0,after=0;
    for(const e of rows){ before+=e.transitionError01+e.rewardError01; this.learnInternal(e.before,e.action,e.actualAfter,e.actualReward01,tick,'replay',false); const latest=this.state.episodes.find(x=>x.tick===e.tick&&x.action===e.action); e.replayCount++; const p=this.predictTransition(e.before,e.action); const t=mse(p.after,e.actualAfter),r=Math.abs(p.reward01-e.actualReward01); e.predictedAfter=p.after;e.predictedReward01=p.reward01;e.transitionError01=t;e.rewardError01=r;after+=t+r; }
    const gain=rows.length?clamp01((before-after)/Math.max(1,rows.length)):0; this.state.replayGain01=clamp01(this.state.replayGain01*.85+gain*.15); return {episodes:rows.length,gain01:gain};
  }
  holdout(samples:Array<{before:number[];action:ActionKind;after:number[];reward01:number}>){
    if(!samples.length)return {before01:this.state.holdoutBefore01,after01:this.state.holdoutAfter01,delta01:0,samples:0};
    const errs=samples.map(s=>{const p=this.predictTransition(s.before,s.action);return (mse(p.after,s.after)+Math.abs(p.reward01-s.reward01))*.5;});
    const after=errs.reduce((a,b)=>a+b,0)/errs.length, before=this.state.holdoutBefore01;
    this.state.holdoutAfter01=after;this.state.holdoutDelta01=before-after; this.state.transferGain01=clamp01(this.state.transferGain01*.85+Math.max(0,before-after)*.15);
    return {before01:before,after01:after,delta01:before-after,samples:samples.length};
  }
  compareActions(before:number[]){
    const preds=ACTIONS.map(action=>({action, ...(()=>{ const p=this.predict(before,action); return {predictedAfter:p.predictedAfter,predictedReward01:p.predictedReward01,confidence01:p.confidence01,uncertainty01:p.uncertainty01}; })()})); const rewards=preds.map(x=>x.predictedReward01); const spread=Math.max(...rewards)-Math.min(...rewards); this.state.actionSensitivity01=clamp01(this.state.actionSensitivity01*.9+spread*.1); return preds;
  }
  lesion(enabled:boolean){
    const original=structuredClone(this.state); if(!enabled)return {transitionDrop01:this.state.lesionTransitionDrop01,rewardDrop01:this.state.lesionRewardDrop01};
    const before=this.state.episodes.slice(-16); if(!before.length)return {transitionDrop01:0,rewardDrop01:0};
    const normal=before.reduce((s,e)=>s+e.transitionError01+e.rewardError01,0)/before.length;
    const savedW=this.state.transitionWeights; const savedR=this.state.rewardWeights;
    this.state.transitionWeights=savedW.map(r=>r.map(()=>0));this.state.rewardWeights=new Array(DIM).fill(0);this.state.rewardBias=0;
    const lesioned=before.reduce((s,e)=>{const p=this.predictTransition(e.before,e.action);return s+(mse(p.after,e.actualAfter)+Math.abs(p.reward01-e.actualReward01));},0)/before.length;
    this.state=original; const diff=Math.max(0,lesioned-normal); this.state.lesionTransitionDrop01=clamp01(diff*.8);this.state.lesionRewardDrop01=clamp01(diff*.2); return {transitionDrop01:this.state.lesionTransitionDrop01,rewardDrop01:this.state.lesionRewardDrop01};
  }
  diagnostics(){return {steps:this.state.steps,updates:this.state.updates,trainingUpdates:this.state.trainingUpdates,onlineTransitionError01:this.state.onlineTransitionError01,onlineRewardError01:this.state.onlineRewardError01,holdoutDelta01:this.state.holdoutDelta01,lesionTransitionDrop01:this.state.lesionTransitionDrop01,lesionRewardDrop01:this.state.lesionRewardDrop01,replayGain01:this.state.replayGain01,transferGain01:this.state.transferGain01,actionSensitivity01:this.state.actionSensitivity01,uncertainty01:this.state.uncertainty01,episodeCount:this.state.episodes.length};}
}
