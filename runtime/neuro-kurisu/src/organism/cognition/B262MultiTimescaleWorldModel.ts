import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const DIM=24;
const SHORT=1;
const MID=4;
const LONG=8;
const MAX_EPISODES=128;
const clamp=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-5,Math.min(5,x)));
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const seed=(label:string)=>(((hash(label)%2001)/1000)-1)*.03;
const mse=(a:number[],b:number[])=>a.length?clamp01(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/a.length):0;

export interface B262Episode { tick:number; action:ActionKind; before:number[]; actualAfter:number[]; reward01:number; shortPrediction:number[]; midPrediction:number[]; longPrediction:number[]; shortError01:number; midError01:number; longError01:number; replayCount:number; }
export interface B262PlanStep { action:ActionKind; predictedReward01:number; uncertainty01:number; predictedValue01:number; counterfactualCost01:number; }
export interface B262State {
  version:2; dimension:number; steps:number; updates:number; replayRuns:number; replayedEpisodes:number;
  shortUpdates:number; midUpdates:number; longUpdates:number; transitionSamples:number; rewardSamples:number;
  shortWeights:number[][]; midWeights:number[][]; longWeights:number[][];
  shortBias:number[]; midBias:number[]; longBias:number[];
  actionEmbeddings:number[][]; rewardWeights:number[]; rewardBias:number;
  uncertainty01:number; shortError01:number; midError01:number; longError01:number;
  horizonGain01:number; replayGain01:number; transferGain01:number; actionSensitivity01:number; planningGain01:number;
  sequenceUpdates:number; sequenceError01:number; hierarchicalGain01:number; sequenceWeights:number[][][]; sequenceBias:number[][];
  lastTick:number; episodes:B262Episode[];
}
export interface B262Prediction { action:ActionKind; horizon:number; predictedAfter:number[]; predictedReward01:number; uncertainty01:number; predictedValue01:number; }
export interface B262MatchedPlanningSample { before:number[]; evaluate:(actions:ActionKind[])=>number; }

export function defaultB262MultiTimescaleWorldModel():B262State {
  const matrix=(tag:string)=>Array.from({length:DIM},(_,i)=>Array.from({length:DIM},(_,j)=>seed(`${tag}:${i}:${j}`)));
  return {version:2,dimension:DIM,steps:0,updates:0,replayRuns:0,replayedEpisodes:0,shortUpdates:0,midUpdates:0,longUpdates:0,transitionSamples:0,rewardSamples:0,
    shortWeights:matrix('s'),midWeights:matrix('m'),longWeights:matrix('l'),shortBias:new Array(DIM).fill(0),midBias:new Array(DIM).fill(0),longBias:new Array(DIM).fill(0),
    sequenceUpdates:0,sequenceError01:.5,hierarchicalGain01:0,sequenceWeights:Array.from({length:4},(_,h)=>matrix(`q${h}`)),sequenceBias:Array.from({length:4},()=>new Array(DIM).fill(0)),
    actionEmbeddings:ACTIONS.map(a=>Array.from({length:DIM},(_,i)=>seed(`a:${a}:${i}`))),rewardWeights:new Array(DIM).fill(0).map((_,i)=>seed(`r:${i}`)),rewardBias:0,
    uncertainty01:.78,shortError01:.5,midError01:.5,longError01:.5,horizonGain01:0,replayGain01:0,transferGain01:0,actionSensitivity01:0,planningGain01:0,lastTick:0,episodes:[]};
}

export class B262MultiTimescaleWorldModel {
  private state=defaultB262MultiTimescaleWorldModel();
  restore(raw?:Partial<B262State>|null){
    const d=defaultB262MultiTimescaleWorldModel(),r=raw??{};
    const resize=(v:any[]|undefined,n:number,tag:string)=>Array.from({length:n},(_,i)=>clamp(Number(v?.[i]??seed(`${tag}:${i}`))));
    const mats=(m:any[][]|undefined,tag:string)=>Array.from({length:DIM},(_,i)=>Array.from({length:DIM},(_,j)=>clamp(Number(m?.[i]?.[j]??seed(`${tag}:${i}:${j}`)))));
    const seqMats=(m:any[][][]|undefined)=>Array.from({length:4},(_,h)=>mats(m?.[h],`q${h}`));
    const seqBias=(m:any[][]|undefined)=>Array.from({length:4},(_,h)=>resize(m?.[h],DIM,`qb:${h}`));
    this.state={...d,...r,version:2,dimension:DIM,shortWeights:mats(r.shortWeights,'s'),midWeights:mats(r.midWeights,'m'),longWeights:mats(r.longWeights,'l'),shortBias:resize(r.shortBias,DIM,'sb'),midBias:resize(r.midBias,DIM,'mb'),longBias:resize(r.longBias,DIM,'lb'),sequenceUpdates:Math.max(0,Math.floor(Number(r.sequenceUpdates??d.sequenceUpdates))),sequenceError01:clamp01(Number(r.sequenceError01??d.sequenceError01)),hierarchicalGain01:clamp01(Number(r.hierarchicalGain01??d.hierarchicalGain01)),sequenceWeights:seqMats(r.sequenceWeights),sequenceBias:seqBias(r.sequenceBias),rewardWeights:resize(r.rewardWeights,DIM,'r'),actionEmbeddings:ACTIONS.map((a,i)=>resize(r.actionEmbeddings?.[i],DIM,`a:${a}`)),episodes:Array.isArray(r.episodes)?r.episodes.slice(-MAX_EPISODES):[]};
  }
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {steps:this.state.steps,updates:this.state.updates,replayRuns:this.state.replayRuns,replayedEpisodes:this.state.replayedEpisodes,shortError01:this.state.shortError01,midError01:this.state.midError01,longError01:this.state.longError01,horizonGain01:this.state.horizonGain01,replayGain01:this.state.replayGain01,transferGain01:this.state.transferGain01,actionSensitivity01:this.state.actionSensitivity01,planningGain01:this.state.planningGain01,sequenceUpdates:this.state.sequenceUpdates,sequenceError01:this.state.sequenceError01,hierarchicalGain01:this.state.hierarchicalGain01,uncertainty01:this.state.uncertainty01,episodes:this.state.episodes.length};}
  private encode(before:number[],action:ActionKind){const ai=Math.max(0,ACTIONS.indexOf(action));const emb=this.state.actionEmbeddings[ai]??[];return Array.from({length:DIM},(_,i)=>clamp((Number(before[i]??0)*.84)+(Number(emb[i]??0)*.16)));}
  private forward(weights:number[][],bias:number[],x:number[]){return bias.map((b,i)=>tanh(b+weights[i].reduce((s,w,j)=>s+w*(x[j]??0),0)*.62));}
  private reward(x:number[]){return sigmoid(this.state.rewardBias+this.state.rewardWeights.reduce((s,w,i)=>s+w*(x[i]??0),0));}
  private horizonWeights(h:number){return h===SHORT?this.state.shortWeights:h===MID?this.state.midWeights:this.state.longWeights;}
  private horizonBias(h:number){return h===SHORT?this.state.shortBias:h===MID?this.state.midBias:this.state.longBias;}
  predict(before:number[],action:ActionKind,horizon=SHORT):B262Prediction{const x=this.encode(before,action);const after=this.forward(this.horizonWeights(horizon),this.horizonBias(horizon),x);const reward=this.reward(x);const uncertainty=clamp01(.10+.62*this.state.uncertainty01+.08*Math.min(1,Math.sqrt(this.state.updates)/40)+.04*(horizon-1));this.state.steps++;return {action,horizon,predictedAfter:after,predictedReward01:reward,uncertainty01:uncertainty,predictedValue01:clamp01(reward*(1-uncertainty*.65))};}
  predictAllHorizons(before:number[],action:ActionKind){return [SHORT,MID,LONG].map(h=>this.predict(before,action,h));}
  train(before:number[],action:ActionKind,actualAfter:number[],reward01:number,tick:number,record=true){const x=this.encode(before,action);const target=actualAfter.map(v=>clamp(v));const results:[number,number,number]=[SHORT,MID,LONG].map(h=>{const p=this.predict(before,action,h);const e=p.predictedAfter.map((v,i)=>clamp((target[i]??0)-v));const lr=(h===SHORT?.08:h===MID?.045:.025)/Math.sqrt(1+this.state.updates/600);const weights=this.horizonWeights(h),bias=this.horizonBias(h);for(let i=0;i<DIM;i++){for(let j=0;j<DIM;j++)weights[i][j]=clamp(weights[i][j]+lr*e[i]*(x[j]??0));bias[i]=clamp(bias[i]+lr*.5*e[i]);}return mse(p.predictedAfter,target);}) as unknown as [number,number,number];
    const x2=this.encode(before,action); const pReward=this.reward(x2); const rErr=clamp(reward01-pReward); const lrR=.04/Math.sqrt(1+this.state.updates/600); for(let i=0;i<DIM;i++)this.state.rewardWeights[i]=clamp(this.state.rewardWeights[i]+lrR*rErr*(x2[i]??0)); this.state.rewardBias=clamp(this.state.rewardBias+lrR*.5*rErr);
    this.state.updates++;this.state.shortUpdates++;this.state.midUpdates++;this.state.longUpdates++;this.state.transitionSamples++;this.state.rewardSamples++;this.state.lastTick=tick;
    this.state.shortError01=this.state.shortError01*.96+results[0]*.04;this.state.midError01=this.state.midError01*.96+results[1]*.04;this.state.longError01=this.state.longError01*.96+results[2]*.04;this.state.uncertainty01=clamp01(this.state.uncertainty01*.97+(results[0]*.5+results[1]*.3+results[2]*.2+Math.abs(rErr)*.4)*.03);
    if(record){const ps=this.predict(before,action,SHORT),pm=this.predict(before,action,MID),pl=this.predict(before,action,LONG);this.state.episodes=[...this.state.episodes.slice(-(MAX_EPISODES-1)),{tick,action,before:before.slice(0,DIM),actualAfter:target.slice(0,DIM),reward01:clamp01(reward01),shortPrediction:ps.predictedAfter,midPrediction:pm.predictedAfter,longPrediction:pl.predictedAfter,shortError01:mse(ps.predictedAfter,target),midError01:mse(pm.predictedAfter,target),longError01:mse(pl.predictedAfter,target),replayCount:0}];}
    return {shortError01:results[0],midError01:results[1],longError01:results[2],rewardError01:Math.abs(rErr)};
  }
  private learnHorizon(before:number[],action:ActionKind,target:number[],horizon:number){
    const x=this.encode(before,action);
    const p=this.predict(before,action,horizon);
    const e=p.predictedAfter.map((v,i)=>clamp((target[i]??0)-v));
    const lr=(horizon===MID?.035:.02)/Math.sqrt(1+this.state.updates/800);
    const weights=this.horizonWeights(horizon);
    const bias=this.horizonBias(horizon);
    for(let i=0;i<DIM;i++){
      for(let j=0;j<DIM;j++) weights[i][j]=clamp(weights[i][j]+lr*e[i]*(x[j]??0));
      bias[i]=clamp(bias[i]+lr*.45*e[i]);
    }
    return mse(p.predictedAfter,target);
  }
  private encodeSequence(before:number[],actions:ActionKind[]){
    const weights=actions.map((_,i)=>1/Math.sqrt(1+i));
    const total=weights.reduce((a,b)=>a+b,0)||1;
    return Array.from({length:DIM},(_,i)=>{
      let value=Number(before[i]??0)*.64;
      for(let a=0;a<actions.length;a+=1){
        const ai=Math.max(0,ACTIONS.indexOf(actions[a]!));
        value+=(this.state.actionEmbeddings[ai]?.[i]??0)*(.36*weights[a]!/total);
      }
      return clamp(value);
    });
  }
  private sequenceHead(horizon:number){
    const index=Math.max(0,Math.min(3,Math.floor(horizon)-5));
    return {weights:this.state.sequenceWeights[index]!,bias:this.state.sequenceBias[index]!};
  }
  predictSequence(before:number[],actions:ActionKind[],horizon=Math.min(8,actions.length||8)){
    const h=Math.max(5,Math.min(8,Math.floor(horizon)));
    const used=actions.slice(0,h);
    const x=this.encodeSequence(before,used);
    const head=this.sequenceHead(h);
    const predictedAfter=this.forward(head.weights,head.bias,x);
    let reward=0,discount=1;
    for(const action of used){reward+=discount*this.reward(this.encode(before,action));discount*=.92;}
    const predictedReward01=clamp01(reward*(1-.35*discount));
    const uncertainty=clamp01(.10+.55*this.state.uncertainty01+.025*Math.max(0,used.length-4));
    return {horizon:h,actions:used.slice(),predictedAfter,predictedReward01,uncertainty01:uncertainty,predictedValue01:clamp01(predictedReward01*(1-.65*uncertainty))};
  }
  trainSequence(input:{tick:number;before:number[];actions:ActionKind[];statesAfter:number[];rewards01:number[]}):{horizons:number[];meanError01:number}{
    const horizons:number[]=[]; const errors:number[]=[];
    for(let h=5;h<=8;h+=1){
      if(input.actions.length<h || input.statesAfter.length<h*DIM)continue;
      const p=this.predictSequence(input.before,input.actions,h);
      const target=input.statesAfter.slice((h-1)*DIM,h*DIM);
      const x=this.encodeSequence(input.before,input.actions.slice(0,h));
      const error=p.predictedAfter.map((v,i)=>clamp((target[i]??0)-v));
      const lr=.045/Math.sqrt(1+this.state.sequenceUpdates/800);
      const head=this.sequenceHead(h);
      for(let i=0;i<DIM;i+=1){
        for(let j=0;j<DIM;j+=1)head.weights[i]![j]=clamp(head.weights[i]![j]!+lr*error[i]!*(x[j]??0));
        head.bias[i]=clamp(head.bias[i]!+lr*.45*error[i]!);
      }
      const e=mse(p.predictedAfter,target);
      errors.push(e); horizons.push(h);
      const rewardTarget=input.rewards01.slice(0,h).reduce((sum,v,i)=>sum+(Number(v)||0)*Math.pow(.92,i),0);
      const rewardError=rewardTarget/(1-Math.pow(.92,h)) - p.predictedReward01;
      this.state.sequenceError01=clamp01(this.state.sequenceError01*.96+Math.abs(rewardError)*.04);
      this.state.sequenceUpdates+=1; this.state.lastTick=input.tick;
    }
    const meanError=errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:this.state.sequenceError01;
    this.state.sequenceError01=clamp01(this.state.sequenceError01*.85+meanError*.15);
    return {horizons,meanError01:meanError};
  }
  private experiencePrefixes(depth:number){
    const unique=new Map<string,ActionKind[]>();
    for(let i=0;i<=this.state.episodes.length-depth;i++){
      const prefix=this.state.episodes.slice(i,i+depth).map(e=>e.action);
      if(prefix.length===depth) unique.set(prefix.join('|'),prefix);
    }
    return [...unique.values()].slice(-24);
  }

  planHierarchical(before:number[],totalDepth=8,split=4){
    const total=Math.max(2,Math.min(8,Math.floor(totalDepth)));
    const first=Math.max(1,Math.min(total-1,Math.floor(split)));
    const learnedPrefixes=this.experiencePrefixes(first);
    const coarse=this.plan(before,first);
    const fallbackPrefix=coarse.steps.map(step=>step.action);
    const candidatePrefixes=learnedPrefixes.length?learnedPrefixes:[fallbackPrefix];
    const refined=candidatePrefixes.map(prefix=>{
      let state=before.slice(0,DIM),score=0;
      for(const action of prefix){
        const p=this.predict(state,action,LONG);
        score+=p.predictedValue01-p.uncertainty01*.04;
        state=p.predictedAfter;
      }
      const remaining=total-first;
      const fine=remaining>0?this.plan(state,remaining):{score:0,steps:[] as B262PlanStep[]};
      return {score:score+fine.score,steps:[...prefix.map((action)=>({action,predictedReward01:this.predict(before,action,LONG).predictedReward01,uncertainty01:this.predict(before,action,LONG).uncertainty01,predictedValue01:this.predict(before,action,LONG).predictedValue01,counterfactualCost01:.04})),...fine.steps],coarseScore:score,fineScore:fine.score};
    }).sort((a,b)=>b.score-a.score);
    const best=refined[0];
    const greedy=this.compareActions(before).sort((a,b)=>b.predictedValue01-a.predictedValue01)[0]?.predictedValue01??0;
    const flat=this.plan(before,total);
    const advantage=(best?.score??0)-greedy;
    this.state.hierarchicalGain01=clamp01(this.state.hierarchicalGain01*.9+Math.max(0,advantage)*.1);
    return {totalDepth:total,coarseDepth:first,refinementDepth:total-first,score:best?.score??0,greedyBaseline01:greedy,flatScore01:flat.score,planningAdvantage01:advantage,steps:best?.steps??[],alternatives:refined.slice(0,4),candidatePrefixCount:candidatePrefixes.length,searchMode:learnedPrefixes.length?'experience-constrained':'model-fallback'};
  }

  matchedPlanningBenchmark(samples:B262MatchedPlanningSample[],totalDepth=8,split=4){
    if(!samples.length)return {samples:0,hierarchicalRegret01:0,flatRegret01:0,hierarchicalHitRate01:0,flatHitRate01:0,hierarchicalUplift01:0};
    let hierarchicalRegret=0,flatRegret=0,hierHits=0,flatHits=0,bestScoreSum=0,used=0;
    for(const sample of samples.slice(0,64)){
      const h=this.planHierarchical(sample.before,totalDepth,split);
      const f=this.plan(sample.before,totalDepth);
      const hr=Number(sample.evaluate(h.steps.map(s=>s.action))); const fr=Number(sample.evaluate(f.steps.map(s=>s.action)));
      if(!Number.isFinite(hr)||!Number.isFinite(fr))continue;
      // Generate a bounded matched candidate set so regret is measured against the
      // same oracle and action vocabulary rather than planner self-reported value.
      const alternatives=[...(h.alternatives??[]).map((x:any)=>x.steps.map((s:any)=>s.action)),f.steps.map(s=>s.action)];
      const actuals=alternatives.map(seq=>Number(sample.evaluate(seq))).filter(Number.isFinite);
      const best=Math.max(hr,fr,...actuals);
      hierarchicalRegret+=Math.max(0,best-hr); flatRegret+=Math.max(0,best-fr);
      if(hr>=best-.05)hierHits++; if(fr>=best-.05)flatHits++; bestScoreSum+=best; used++;
    }
    const n=Math.max(1,used);
    const hierarchicalRegret01=clamp01(hierarchicalRegret/n),flatRegret01=clamp01(flatRegret/n);
    const hierarchicalUplift01=clamp01((flatRegret01-hierarchicalRegret01)/Math.max(.001,flatRegret01));
    return {samples:used,hierarchicalRegret01,flatRegret01,hierarchicalHitRate01:hierHits/n,flatHitRate01:flatHits/n,hierarchicalUplift01,meanBestActual01:clamp01(bestScoreSum/n)};
  }

  replay(batch=8,tick=0){
    const rows=this.state.episodes.filter(e=>e.replayCount<2).slice(-batch);
    let before=0,after=0,delayedCount=0;
    for(const e of rows){
      before+=(e.shortError01+e.midError01+e.longError01)/3+Math.abs(e.reward01-this.reward(this.encode(e.before,e.action)));
      this.train(e.before,e.action,e.actualAfter,e.reward01,tick,false);
      const idx=this.state.episodes.indexOf(e);
      if(idx>=0 && idx+MID-1<this.state.episodes.length){
        e.midError01=this.learnHorizon(e.before,e.action,this.state.episodes[idx+MID-1].actualAfter,MID); delayedCount++;
      }
      if(idx>=0 && idx+LONG-1<this.state.episodes.length){
        e.longError01=this.learnHorizon(e.before,e.action,this.state.episodes[idx+LONG-1].actualAfter,LONG); delayedCount++;
      }
      e.replayCount++;
      after+=(this.state.shortError01+this.state.midError01+this.state.longError01)/3;
    }
    if(this.state.episodes.length>=8){
      const seq=this.state.episodes.slice(-8);
      this.trainSequence({tick, before:seq[0]!.before.slice(), actions:seq.map(e=>e.action), statesAfter:seq.flatMap(e=>e.actualAfter.slice(0,DIM)), rewards01:seq.map(e=>e.reward01)});
    }
    this.state.replayRuns++;this.state.replayedEpisodes+=rows.length;
    const gain=rows.length?clamp01((before-after)/rows.length):0;
    this.state.replayGain01=clamp01(this.state.replayGain01*.8+gain*.2);
    this.state.horizonGain01=clamp01(this.state.horizonGain01*.85+Math.max(0,this.state.midError01-this.state.longError01)*.15);
    return {episodes:rows.length,gain01:gain,delayedHorizonUpdates:delayedCount};
  }
  compareActions(before:number[]){
    const rows=ACTIONS.map(action=>{
      const p=this.predict(before,action,LONG);
      return {action,predictedReward01:p.predictedReward01,uncertainty01:p.uncertainty01,predictedValue01:p.predictedValue01,predictedAfter:p.predictedAfter};
    });
    const values=rows.map(r=>r.predictedValue01);
    const spread=Math.max(...values)-Math.min(...values);
    this.state.actionSensitivity01=clamp01(this.state.actionSensitivity01*.9+spread*.1);
    return rows;
  }
  plan(before:number[],depth=3){
    const d=Math.max(1,Math.min(4,Math.floor(depth)));
    type Node={state:number[];score:number;steps:B262PlanStep[]};
    let beams:Node[]=[{state:before.slice(0,DIM),score:0,steps:[]}];
    for(let level=0;level<d;level++){
      const next:Node[]=[];
      for(const node of beams){
        for(const action of ACTIONS){
          const p=this.predict(node.state,action,LONG);
          const step:B262PlanStep={
            action,predictedReward01:p.predictedReward01,uncertainty01:p.uncertainty01,predictedValue01:p.predictedValue01,
            counterfactualCost01:clamp01(p.uncertainty01*.55+(level/d)*.08),
          };
          next.push({state:p.predictedAfter,score:node.score+step.predictedValue01-step.counterfactualCost01,steps:[...node.steps,step]});
        }
      }
      beams=next.sort((a,b)=>b.score-a.score).slice(0,8);
    }
    const best=beams[0];
    const greedy=this.compareActions(before).sort((a,b)=>b.predictedValue01-a.predictedValue01)[0]?.predictedValue01??0;
    const score=best?.score??0;
    const planningAdvantage01=score-greedy;
    this.state.planningGain01=clamp01(this.state.planningGain01*.9+Math.max(0,planningAdvantage01)*.1);
    return {depth:d,score,greedyBaseline01:greedy,planningAdvantage01,steps:best?.steps??[],alternatives:beams.slice(0,4).map(x=>({score:x.score,steps:x.steps}))};
  }
  counterfactual(before:number[],observedAction:ActionKind,alternative:ActionKind){
    const observed=this.predict(before,observedAction,LONG),alt=this.predict(before,alternative,LONG);
    const rewardDelta01=alt.predictedReward01-observed.predictedReward01;
    const stateDistance01=mse(observed.predictedAfter,alt.predictedAfter);
    return {observedAction,alternativeAction:alternative,observedReward01:observed.predictedReward01,alternativeReward01:alt.predictedReward01,rewardDelta01,stateDistance01,counterfactualComputed:true};
  }
  holdout(samples:Array<{before:number[];action:ActionKind;after:number[];reward01:number}>){
    if(!samples.length) return {short01:this.state.shortError01,mid01:this.state.midError01,long01:this.state.longError01,transferGain01:0,samples:0};
    const errors=samples.map(s=>{
      const rows=this.predictAllHorizons(s.before,s.action);
      return {short:mse(rows[0].predictedAfter,s.after),mid:mse(rows[1].predictedAfter,s.after),long:mse(rows[2].predictedAfter,s.after)};
    });
    const avg=(k:'short'|'mid'|'long')=>errors.reduce((sum,e)=>sum+e[k],0)/errors.length;
    const short=avg('short'),mid=avg('mid'),long=avg('long'),gain=Math.max(0,short-long);
    this.state.transferGain01=clamp01(this.state.transferGain01*.85+gain*.15);
    return {short01:short,mid01:mid,long01:long,transferGain01:this.state.transferGain01,samples:samples.length};
  }
  lesion(horizon:'short'|'mid'|'long'|'all'='long'){
    const rows=this.state.episodes.slice(-16);
    if(!rows.length) return {horizon,drop01:0,samples:0};
    const base=rows.reduce((s,e)=>s+e.longError01,0)/rows.length;
    const saved=structuredClone(this.state);
    if(horizon==='long'||horizon==='all') this.state.longWeights=Array.from({length:DIM},()=>new Array(DIM).fill(0));
    if(horizon==='mid'||horizon==='all') this.state.midWeights=Array.from({length:DIM},()=>new Array(DIM).fill(0));
    if(horizon==='short'||horizon==='all') this.state.shortWeights=Array.from({length:DIM},()=>new Array(DIM).fill(0));
    const targetH=horizon==='short'?SHORT:horizon==='mid'?MID:LONG;
    const lesioned=rows.reduce((s,e)=>s+mse(this.predict(e.before,e.action,targetH).predictedAfter,e.actualAfter),0)/rows.length;
    this.state=saved;
    return {horizon,drop01:Math.max(0,lesioned-base),samples:rows.length};
  }

}
