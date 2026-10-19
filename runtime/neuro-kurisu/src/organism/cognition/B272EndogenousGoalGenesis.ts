import { cosineSimilarity } from '../core/NumericPrimitives.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const GOAL_DIMS = ['curiosity','truth','coherence','competence','connection','continuity','autonomy','energy'] as const;
type GoalDim = typeof GOAL_DIMS[number];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*(b[i]??0),0);
const norm=(a:number[])=>Math.sqrt(Math.max(1e-9,a.reduce((s,x)=>s+x*x,0)));
const cosine=(a:number[],b:number[])=>cosineSimilarity(a,b,1e-9);
const softmax=(scores:number[],temperature=.18)=>{
  const t=Math.max(.03,temperature),m=Math.max(...scores); const ex=scores.map(v=>Math.exp(Math.max(-20,Math.min(20,(v-m)/t)))); const z=ex.reduce((a,b)=>a+b,0)||1; return ex.map(v=>v/z);
};
const hashVector=(v:number[])=>v.reduce((h,x,i)=>((h*131+Math.round((x+.5)*997)+i*17)>>>0),2166136261).toString(16).padStart(8,'0');
const defaultGoal=(seed=0)=>GOAL_DIMS.map((_,i)=>clamp11(Math.sin((seed+1)*(i+3)*.71)*.25));
const zeroGoal=()=>GOAL_DIMS.map(()=>0);

export interface B272GoalCandidate {
  id:string;
  vector:number[];
  novelty01:number;
  coherence01:number;
  internalNeed01:number;
  predictedFutureValue01:number;
  actionScores:number[];
  confidence01:number;
}

export interface B272State {
  version:1;
  tick:number;
  steps:number;
  learningUpdates:number;
  generatedGoals:number;
  acceptedGoals:number;
  rejectedGoals:number;
  rollbackCount:number;
  currentGoal:number[];
  currentGoalId:string;
  currentAction:ActionKind;
  currentConfidence01:number;
  goalPressure01:number;
  goalNovelty01:number;
  selfConflict01:number;
  internalCoherence01:number;
  agency01:number;
  actionPrototypeWeights:number[][];
  goalWeights:number[][];
  selfProjectionWeights:number[][];
  worldProjectionWeights:number[][];
  goalHistory:Array<{tick:number;id:string;vector:number[];action:ActionKind;reward01:number;predictionError01:number;accepted:boolean}>;
  outcomeHistory:Array<{tick:number;goalId:string;action:ActionKind;reward01:number;predictionError01:number}>;
  goalOutcomeMemory:Record<string,{vector:number[];meanReward01:number;meanPredictionError01:number;updates:number;lastTick:number}>;
}

export function defaultB272State():B272State{
  const actionPrototypeWeights=ACTIONS.map((_,a)=>GOAL_DIMS.map((_,i)=>clamp11(Math.sin((a+2)*(i+3)*.41)*.18)));
  const goalWeights=GOAL_DIMS.map((_,i)=>Array.from({length:8},(_,j)=>clamp11(Math.cos((i+1)*(j+2)*.37)*.14)));
  const selfProjectionWeights=GOAL_DIMS.map((_,i)=>Array.from({length:16},(_,j)=>clamp11(Math.sin((i+2)*(j+1)*.19)*.06)));
  const worldProjectionWeights=GOAL_DIMS.map((_,i)=>Array.from({length:16},(_,j)=>clamp11(Math.cos((i+3)*(j+2)*.17)*.06)));
  const g=defaultGoal(3);
  return {version:1,tick:0,steps:0,learningUpdates:0,generatedGoals:0,acceptedGoals:0,rejectedGoals:0,rollbackCount:0,currentGoal:g,currentGoalId:`g-${hashVector(g)}`,currentAction:'reflect',currentConfidence01:.35,goalPressure01:.2,goalNovelty01:.25,selfConflict01:.2,internalCoherence01:.7,agency01:.4,actionPrototypeWeights,goalWeights,selfProjectionWeights,worldProjectionWeights,goalHistory:[],outcomeHistory:[],goalOutcomeMemory:{}};
}

export interface B272StepInput {
  tick:number;
  selfLatent:number[];
  worldLatent:number[];
  needs:{energy01:number;uncertainty01:number;novelty01:number;goalPressure01:number;socialNeed01:number};
  traits:Record<string,number>;
  predictionError01:number;
  autobiographicalContinuity01:number;
  identityContinuity01:number;
  intrinsicReward01:number;
  lastAction:ActionKind|null;
  lastReward01:number;
}

export interface B272StepResult extends B272GoalCandidate {
  action:ActionKind;
  goalId:string;
  goalVector:number[];
  selfConflict01:number;
  agency01:number;
  endogenous01:number;
}

export class B272EndogenousGoalGenesis {
  private state=defaultB272State();
  restore(raw?:Partial<B272State>|null){
    const d=defaultB272State(),r:any=raw??{};
    this.state={
      ...d,
      ...r,
      version:1,
      currentGoal:Array.isArray(r.currentGoal)?r.currentGoal.slice(0,8):d.currentGoal,
      currentGoalId:String(r.currentGoalId??d.currentGoalId),
      actionPrototypeWeights:Array.isArray(r.actionPrototypeWeights)
        ? r.actionPrototypeWeights.map((row:any[],i:number)=>Array.from({length:8},(_,j)=>clamp11(Number(row?.[j]??d.actionPrototypeWeights[i]?.[j]??0))))
        : d.actionPrototypeWeights,
      goalWeights:Array.isArray(r.goalWeights)
        ? r.goalWeights.map((row:any[],i:number)=>Array.from({length:8},(_,j)=>clamp11(Number(row?.[j]??d.goalWeights[i]?.[j]??0))))
        : d.goalWeights,
      selfProjectionWeights:Array.isArray(r.selfProjectionWeights)
        ? r.selfProjectionWeights.map((row:any[],i:number)=>Array.from({length:16},(_,j)=>clamp11(Number(row?.[j]??d.selfProjectionWeights[i]?.[j]??0))))
        : d.selfProjectionWeights,
      worldProjectionWeights:Array.isArray(r.worldProjectionWeights)
        ? r.worldProjectionWeights.map((row:any[],i:number)=>Array.from({length:16},(_,j)=>clamp11(Number(row?.[j]??d.worldProjectionWeights[i]?.[j]??0))))
        : d.worldProjectionWeights,
      goalHistory:Array.isArray(r.goalHistory)?r.goalHistory.slice(-128):[],
      outcomeHistory:Array.isArray(r.outcomeHistory)?r.outcomeHistory.slice(-256):[],
      goalOutcomeMemory:Object.fromEntries(Object.entries(r.goalOutcomeMemory??{}).slice(-256).map(([k,v]:any)=>[String(k),{vector:Array.isArray(v?.vector)?v.vector.slice(0,8).map((x:any)=>clamp11(Number(x))):[],meanReward01:clamp01(Number(v?.meanReward01??.5)),meanPredictionError01:clamp01(Number(v?.meanPredictionError01??.5)),updates:Math.max(0,Math.floor(Number(v?.updates??0))),lastTick:Math.max(0,Math.floor(Number(v?.lastTick??0)))}]))
    };
  }
  snapshot(){return structuredClone(this.state);}
  diagnostics(){return {...structuredClone(this.state),goalEntropy01:this.goalEntropy(),prototypeDiversity01:this.prototypeDiversity(),goalVectorDiversity01:this.goalVectorDiversity(),actionDiversity01:this.actionDiversity(),endogenousGoalRate01:this.endogenousGoalRate(),goalOutcomeMemoryEntries:Object.keys(this.state.goalOutcomeMemory).length,learnedGoalClosure01:this.learnedGoalClosure01(),externalGoalDependency01:0};}
  private goalEntropy(){
    const hist=this.state.goalHistory.slice(-32); if(!hist.length)return 0;
    const counts=new Map<string,number>(); for(const g of hist)counts.set(g.id,(counts.get(g.id)??0)+1); const n=hist.length; let h=0; for(const c of counts.values()){const p=c/n;h-=p*Math.log(Math.max(1e-9,p));} return clamp01(h/Math.log(Math.max(2,Math.min(32,n))));
  }
  private goalVectorDiversity(){
    const hist=this.state.goalHistory.slice(-32); if(hist.length<2)return 0; let s=0,n=0; for(let i=0;i<hist.length;i++)for(let j=i+1;j<hist.length;j++){s+=(1+cosine(hist[i]!.vector,hist[j]!.vector))*.5;n++;} return clamp01(s/n);
  }
  private actionDiversity(){
    const hist=this.state.goalHistory.slice(-64); if(!hist.length)return 0; return clamp01(new Set(hist.map(x=>x.action)).size/ACTIONS.length);
  }
  private endogenousGoalRate(){
    const hist=this.state.goalHistory.slice(-64); if(!hist.length)return 0; const generated=hist.filter(g=>g.vector.some(v=>Math.abs(v)>.08)).length; return clamp01(generated/hist.length);
  }
  private learnedGoalValue(vector:number[], currentTick:number){
    const entries=Object.entries(this.state.goalOutcomeMemory);
    if(!entries.length)return {reward01:.5,predictionError01:.5,evidence01:0};
    let weightedReward=0,weightedError=0,totalWeight=0;
    for(const [key,memory] of entries){
      const reference=memory.vector?.length ? memory.vector : this.state.goalHistory.find(x=>x.id===key)?.vector;
      if(!reference) continue;
      const similarity=clamp01((cosine(vector,reference)+1)*.5);
      const recency=clamp01(1-Math.min(64,Math.max(0,currentTick-memory.lastTick))/64);
      const evidence=clamp01(Math.min(1,memory.updates/8));
      const weight=Math.pow(similarity,2.2)*(0.35+0.65*recency)*(0.30+0.70*evidence);
      if(weight<=.0001) continue;
      weightedReward+=memory.meanReward01*weight; weightedError+=memory.meanPredictionError01*weight; totalWeight+=weight;
    }
    if(totalWeight<=.0001)return {reward01:.5,predictionError01:.5,evidence01:0};
    return {reward01:clamp01(weightedReward/totalWeight),predictionError01:clamp01(weightedError/totalWeight),evidence01:clamp01(totalWeight/3)};
  }
  private learnedGoalClosure01(){
    const entries=Object.values(this.state.goalOutcomeMemory);
    if(!entries.length)return 0;
    const evidence=entries.reduce((s,e)=>s+Math.min(1,e.updates/8),0)/entries.length;
    const reward=entries.reduce((s,e)=>s+e.meanReward01,0)/entries.length;
    return clamp01(.55*evidence+.45*reward);
  }

  private prototypeDiversity(){
    const rows=this.state.actionPrototypeWeights; let s=0,n=0; for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){s+=(1-cosine(rows[i]!,rows[j]!))*.5;n++;} return clamp01(n?s/n:0);
  }
  private buildInternalVector(input:B272StepInput){
    const t=input.traits;
    const scalar=[
      clamp11(input.needs.novelty01-.5),clamp11(input.needs.uncertainty01-.5),clamp11(input.needs.goalPressure01-.5),clamp11(input.needs.energy01-.5),
      clamp11(input.needs.socialNeed01-.5),clamp11(input.predictionError01-.5),clamp11(input.autobiographicalContinuity01-.5),clamp11(input.identityContinuity01-.5)
    ];
    const traits=[t.curiosity,t['truth-seeking'],t['self-reflection'],t['self-preservation'],t.care,t['social-attunement'],t.persistence,t['self-reflection']];
    return scalar.map((v,i)=>{
      const selfRaw=dot(this.state.selfProjectionWeights[i]!, input.selfLatent.slice(0,16));
      const worldRaw=dot(this.state.worldProjectionWeights[i]!, input.worldLatent.slice(0,16));
      const traitTerm=clamp11(Number(traits[i]??.5)-.5);
      return clamp11(v*.76+traitTerm*.20+Math.tanh(selfRaw*.9)*.02+Math.tanh(worldRaw*.9)*.02);
    });
  }
  private generateCandidate(input:B272StepInput):B272GoalCandidate{
    const base=this.buildInternalVector(input);
    const conflict=clamp01(.28*input.predictionError01+.24*input.needs.uncertainty01+.18*(1-input.autobiographicalContinuity01)+.16*(1-input.identityContinuity01)+.14*(1-input.needs.energy01));
    const intrinsic=clamp01(input.intrinsicReward01);
    const candidates:number[][]=[];
    for(let k=0;k<4;k++){
      const prev=this.state.currentGoal.length?this.state.currentGoal:zeroGoal();
      const v=GOAL_DIMS.map((_,i)=>{
        const drive=base[i]??0; const memory=clamp11((prev[i]??0)*.22); const novelty=(k===0?0:.06*k*Math.sin((input.tick+1)*(i+2)*.73));
        return clamp11(.64*drive+.18*memory+.10*clamp11((input.needs.novelty01-input.needs.uncertainty01)*.8)+novelty);
      });
      candidates.push(v);
    }
    const scored:B272GoalCandidate[]=candidates.map((v,k)=>{
      const actionScores=this.state.actionPrototypeWeights.map(row=>clamp11(dot(row,v)/Math.max(1,norm(row)*norm(v))));
const learned=this.learnedGoalValue(v,input.tick);
      const learnedClosure=(learned.reward01-.5)*.20 + (learned.evidence01*(.52-learned.predictionError01))*.10;
      const predictedFutureValue=clamp01(.5+.32*dot(v,base)+.18*intrinsic+.16*(1-conflict)+.08*k+learnedClosure);
      const coherence=clamp01(.5+.25*cosine(v,base)+.25*(1-conflict));
      const novelty01=clamp01(.25+.45*(1-Math.abs(cosine(v,this.state.currentGoal)))+.30*(k/3));
      const internalNeed=clamp01(.5+.35*Math.abs(dot(v,base))+.15*conflict);
      return {id:`g-${hashVector(v)}`,vector:v,novelty01,coherence01:coherence,internalNeed01:internalNeed,predictedFutureValue01:predictedFutureValue,actionScores,confidence01:clamp01(.35+.3*(1-conflict)+.2*coherence+.15*(k===0?1:novelty01))};
    });
    scored.sort((a,b)=>(b.predictedFutureValue01+b.internalNeed01*.35+b.novelty01*.18)-(a.predictedFutureValue01+a.internalNeed01*.35+a.novelty01*.18));
    return scored[0]!;
  }
  step(input:B272StepInput):B272StepResult{
    const c=this.generateCandidate(input); const idx=c.actionScores.indexOf(Math.max(...c.actionScores)); const action=ACTIONS[idx]??'reflect';
    const selfConflict=clamp01(.55*(1-c.coherence01)+.25*input.predictionError01+.20*Math.abs(input.needs.goalPressure01-input.intrinsicReward01));
    const endogenous01=clamp01(.32*c.internalNeed01+.24*c.novelty01+.24*(1-selfConflict)+.20*c.confidence01);
    this.state.tick=input.tick;this.state.steps++;this.state.generatedGoals++;this.state.currentGoal=c.vector.slice();this.state.currentGoalId=c.id;this.state.currentAction=action;this.state.currentConfidence01=c.confidence01;this.state.goalPressure01=clamp01(.72*this.state.goalPressure01+.28*(input.needs.goalPressure01+endogenous01*.35));this.state.goalNovelty01=c.novelty01;this.state.selfConflict01=selfConflict;this.state.internalCoherence01=c.coherence01;this.state.agency01=clamp01(.82*this.state.agency01+.18*(endogenous01*(1-selfConflict)+.25));
    this.state.goalHistory=[...this.state.goalHistory,{tick:input.tick,id:c.id,vector:c.vector.slice(),action,reward01:input.lastReward01,predictionError01:input.predictionError01,accepted:false}].slice(-128);
    return {...c,action,goalId:c.id,goalVector:c.vector.slice(),selfConflict01:selfConflict,agency01:this.state.agency01,endogenous01};
  }
  learnFromOutcome(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;externalEvidence01:number;independentEvaluatorGain01?:number;acceptedExternalGoal?:boolean}){
    const gain=clamp11((input.reward01-.5)*.9+(0.5-input.predictionError01)*.35+(input.independentEvaluatorGain01??0)*.6);
    const accepted=Boolean(input.acceptedExternalGoal)&&gain>=-.02;
    const goal=this.state.currentGoal.length?this.state.currentGoal:zeroGoal();
    const ai=ACTIONS.indexOf(input.action); const lr=.012+.018*this.state.agency01+.012*this.state.goalNovelty01;
    if(ai>=0){for(let j=0;j<8;j++){const target=goal[j]??0; const delta=lr*gain*target; this.state.actionPrototypeWeights[ai]![j]=clamp11(this.state.actionPrototypeWeights[ai]![j]+delta);}}
    for(let i=0;i<8;i++){
      for(let j=0;j<8;j++){
        const signal=(goal[i]??0)*(goal[j]??0); this.state.goalWeights[i]![j]=clamp11(this.state.goalWeights[i]![j]+lr*gain*signal*.18);
      }
      const projectionScale=lr*gain*.05;
      const latest=this.state.goalHistory[this.state.goalHistory.length-1];
      if(latest){
        for(let j=0;j<Math.min(16,latest.vector.length);j++){
          const g=latest.vector[i]??0;
          this.state.selfProjectionWeights[i]![j]=clamp11(this.state.selfProjectionWeights[i]![j]+projectionScale*g);
          this.state.worldProjectionWeights[i]![j]=clamp11(this.state.worldProjectionWeights[i]![j]+projectionScale*g*.9);
        }
      }
    }
    const last=this.state.goalHistory[this.state.goalHistory.length-1]; if(last){last.reward01=input.reward01;last.predictionError01=input.predictionError01;last.accepted=accepted;}
    const memory=this.state.goalOutcomeMemory[this.state.currentGoalId]??{vector:goal.slice(0,8),meanReward01:.5,meanPredictionError01:.5,updates:0,lastTick:0};
    const memoryAlpha=Math.min(.32,.12+Math.min(.16,memory.updates*.01));
    this.state.goalOutcomeMemory[this.state.currentGoalId]={
      vector:goal.slice(0,8),
      meanReward01:clamp01(memory.meanReward01+(clamp01(input.reward01)-memory.meanReward01)*memoryAlpha),
      meanPredictionError01:clamp01(memory.meanPredictionError01+(clamp01(input.predictionError01)-memory.meanPredictionError01)*memoryAlpha),
      updates:memory.updates+1,lastTick:input.tick,
    };
    this.state.outcomeHistory=[...this.state.outcomeHistory,{tick:input.tick,goalId:this.state.currentGoalId,action:input.action,reward01:input.reward01,predictionError01:input.predictionError01}].slice(-256);
    if(accepted)this.state.acceptedGoals++; else this.state.rejectedGoals++; if(input.independentEvaluatorGain01!=null&&input.independentEvaluatorGain01<-.04)this.state.rollbackCount++;
    this.state.learningUpdates++;
    return {learningRate:lr,gain11:gain,accepted,goalId:this.state.currentGoalId,agency01:this.state.agency01,goalNovelty01:this.state.goalNovelty01,goalPressure01:this.state.goalPressure01};
  }
  learnedGoalBias(vector:number[], currentTick=this.state.tick){
    const learned=this.learnedGoalValue(vector.slice(0,8),currentTick);
    return clamp11((learned.reward01-.5)*.20 + learned.evidence01*(.52-learned.predictionError01)*.10);
  }
  actionBias(action:ActionKind){const i=ACTIONS.indexOf(action);if(i<0)return 0;const score=this.state.actionPrototypeWeights[i]?.reduce((s,w,j)=>s+w*(this.state.currentGoal[j]??0),0)??0;return clamp11(score/8)*.055+(this.state.currentAction===action?this.state.agency01*.035:0);}
  currentGoal(){return {id:this.state.currentGoalId,vector:this.state.currentGoal.slice(),action:this.state.currentAction,confidence01:this.state.currentConfidence01,endogenous01:clamp01(.4*this.state.goalNovelty01+.35*this.state.agency01+.25*(1-this.state.selfConflict01))};}
}

export const B272_GOAL_DIMENSIONS=GOAL_DIMS.slice();
