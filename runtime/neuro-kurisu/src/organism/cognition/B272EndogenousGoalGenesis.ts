import { cosineSimilarity } from '../core/NumericPrimitives.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const GOAL_DIMS = ['curiosity','truth','coherence','competence','connection','continuity','autonomy','energy'] as const;
type GoalDim = typeof GOAL_DIMS[number];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safeCounter=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const isUnit=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const isAction=(value:unknown):value is ActionKind=>typeof value==='string'&&ACTIONS.includes(value as ActionKind);
const isSafeId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const strictVector=(value:unknown,dimensions:number):number[]|null=>{
  if(!Array.isArray(value)||value.length!==dimensions||value.some(v=>typeof v!=='number'||!Number.isFinite(v)))return null;
  return value.map(v=>clamp11(v as number));
};
const restoreMatrix=(value:unknown,fallback:number[][]):number[][]=>fallback.map((row,i)=>row.map((base,j)=>{
  const candidate=Array.isArray(value)&&Array.isArray(value[i])?value[i][j]:undefined;
  return typeof candidate==='number'&&Number.isFinite(candidate)?clamp11(candidate):base;
}));
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
  /** Last tick whose outcome has already been credited; -1 means none. */
  lastOutcomeTick:number;
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
  return {version:1,tick:0,lastOutcomeTick:-1,steps:0,learningUpdates:0,generatedGoals:0,acceptedGoals:0,rejectedGoals:0,rollbackCount:0,currentGoal:g,currentGoalId:`g-${hashVector(g)}`,currentAction:'reflect',currentConfidence01:.35,goalPressure01:.2,goalNovelty01:.25,selfConflict01:.2,internalCoherence01:.7,agency01:.4,actionPrototypeWeights,goalWeights,selfProjectionWeights,worldProjectionWeights,goalHistory:[],outcomeHistory:[],goalOutcomeMemory:{}};
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
  /** Optional calibrated drive signal from IntrinsicMotivationEngine. */
  intrinsicDrive01?:number;
  intrinsicDriveConfidence01?:number;
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
    const d=defaultB272State();
    const r:Record<string,unknown>=isRecord(raw)?raw:{};
    if(r.version!==undefined&&r.version!==1)throw new RangeError('unsupported B272 state version');

    const tick=safeCounter(r.tick,d.tick);
    const steps=safeCounter(r.steps,d.steps);
    const learningUpdates=safeCounter(r.learningUpdates,d.learningUpdates);
    const generatedGoals=Math.min(steps,safeCounter(r.generatedGoals,d.generatedGoals));
    // Every learning update has exactly one terminal decision. Missing/corrupt
    // decisions are classified as rejected rather than silently disappearing.
    const acceptedGoals=Math.min(learningUpdates,safeCounter(r.acceptedGoals,d.acceptedGoals));
    const rejectedGoals=learningUpdates-acceptedGoals;
    const rollbackCount=Math.min(learningUpdates,safeCounter(r.rollbackCount,d.rollbackCount));
    const currentGoal=strictVector(r.currentGoal,GOAL_DIMS.length)??d.currentGoal.slice();
    const currentGoalId=`g-${hashVector(currentGoal)}`;

    const goalHistory:B272State['goalHistory']=[];
    const rawGoalHistory=Array.isArray(r.goalHistory)?r.goalHistory.slice(-512):[];
    for(const item of rawGoalHistory){
      if(!isRecord(item))continue;
      const vector=strictVector(item.vector,GOAL_DIMS.length);
      if(!vector||!isSafeId(item.id)||item.id!==`g-${hashVector(vector)}`)continue;
      if(!Number.isSafeInteger(item.tick)||typeof item.tick!=='number'||item.tick<0||item.tick>tick)continue;
      if(!isAction(item.action)||!isUnit(item.reward01)||!isUnit(item.predictionError01)||typeof item.accepted!=='boolean')continue;
      goalHistory.push({tick:item.tick,id:item.id,vector,action:item.action,reward01:item.reward01,predictionError01:item.predictionError01,accepted:item.accepted});
    }
    goalHistory.sort((a,b)=>a.tick-b.tick);

    const outcomeHistory:B272State['outcomeHistory']=[];
    const rawOutcomeHistory=Array.isArray(r.outcomeHistory)?r.outcomeHistory.slice(-1024):[];
    for(const item of rawOutcomeHistory){
      if(!isRecord(item))continue;
      if(!Number.isSafeInteger(item.tick)||typeof item.tick!=='number'||item.tick<0||item.tick>tick)continue;
      if(!isSafeId(item.goalId)||!/^g-[0-9a-f]{8}$/u.test(item.goalId)||!isAction(item.action))continue;
      if(!isUnit(item.reward01)||!isUnit(item.predictionError01))continue;
      outcomeHistory.push({tick:item.tick,goalId:item.goalId,action:item.action,reward01:item.reward01,predictionError01:item.predictionError01});
    }
    outcomeHistory.sort((a,b)=>a.tick-b.tick);
    // A single cognitive tick can yield at most one credited outcome. If a
    // persisted ledger contains ambiguous duplicate ticks, quarantine every row
    // at those ticks while still remembering the latest observed tick to block replay.
    const outcomeTickCounts=new Map<number,number>();
    for(const item of outcomeHistory)outcomeTickCounts.set(item.tick,(outcomeTickCounts.get(item.tick)??0)+1);
    const observedLastOutcomeTick=outcomeHistory.reduce((latest,item)=>Math.max(latest,item.tick),-1);
    const uniqueOutcomeHistory=outcomeHistory.filter(item=>outcomeTickCounts.get(item.tick)===1);
    const persistedLastOutcomeTick=safeCounter(r.lastOutcomeTick,-1);
    const lastOutcomeTick=Math.max(observedLastOutcomeTick,persistedLastOutcomeTick>=0&&persistedLastOutcomeTick<=tick?persistedLastOutcomeTick:-1);

    const goalOutcomeMemory:B272State['goalOutcomeMemory']={};
    const rawMemory=isRecord(r.goalOutcomeMemory)?Object.entries(r.goalOutcomeMemory).slice(-1024):[];
    for(const [key,value] of rawMemory){
      if(!/^g-[0-9a-f]{8}$/u.test(key)||!isRecord(value))continue;
      const vector=strictVector(value.vector,GOAL_DIMS.length);
      const updates=safeCounter(value.updates,-1);
      const lastTick=safeCounter(value.lastTick,-1);
      if(!vector||key!==`g-${hashVector(vector)}`||updates<1||updates>learningUpdates||lastTick<0||lastTick>tick)continue;
      if(!isUnit(value.meanReward01)||!isUnit(value.meanPredictionError01))continue;
      if(!uniqueOutcomeHistory.some(item=>item.goalId===key&&item.tick===lastTick))continue;
      goalOutcomeMemory[key]={vector,meanReward01:value.meanReward01,meanPredictionError01:value.meanPredictionError01,updates,lastTick};
    }

    this.state={
      version:1,
      tick,lastOutcomeTick,steps,learningUpdates,generatedGoals,acceptedGoals,rejectedGoals,rollbackCount,
      currentGoal,currentGoalId,
      currentAction:isAction(r.currentAction)?r.currentAction:d.currentAction,
      currentConfidence01:isUnit(r.currentConfidence01)?r.currentConfidence01:d.currentConfidence01,
      goalPressure01:isUnit(r.goalPressure01)?r.goalPressure01:d.goalPressure01,
      goalNovelty01:isUnit(r.goalNovelty01)?r.goalNovelty01:d.goalNovelty01,
      selfConflict01:isUnit(r.selfConflict01)?r.selfConflict01:d.selfConflict01,
      internalCoherence01:isUnit(r.internalCoherence01)?r.internalCoherence01:d.internalCoherence01,
      agency01:isUnit(r.agency01)?r.agency01:d.agency01,
      actionPrototypeWeights:restoreMatrix(r.actionPrototypeWeights,d.actionPrototypeWeights),
      goalWeights:restoreMatrix(r.goalWeights,d.goalWeights),
      selfProjectionWeights:restoreMatrix(r.selfProjectionWeights,d.selfProjectionWeights),
      worldProjectionWeights:restoreMatrix(r.worldProjectionWeights,d.worldProjectionWeights),
      goalHistory:goalHistory.slice(-128),
      outcomeHistory:uniqueOutcomeHistory.slice(-256),
      goalOutcomeMemory:Object.fromEntries(Object.entries(goalOutcomeMemory).slice(-256)),
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
    const intrinsic=Math.max(clamp01(input.intrinsicReward01),clamp01(input.intrinsicDrive01??0)*clamp01(input.intrinsicDriveConfidence01??0));
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
    if(!isRecord(input))throw new TypeError('B272 step input must be an object');
    const tick=safeCounter(input.tick,-1);
    if(tick<0)throw new RangeError('B272 tick must be a non-negative safe integer');
    if((this.state.steps>0||this.state.tick>0)&&tick<=this.state.tick)throw new RangeError('B272 ticks must strictly increase');
    if(!isRecord(input.needs))throw new TypeError('B272 needs must be an object');
    for(const key of ['energy01','uncertainty01','novelty01','goalPressure01','socialNeed01'] as const)if(!isUnit(input.needs[key]))throw new RangeError(`B272 needs.${key} must be in [0,1]`);
    if(!isRecord(input.traits)||!Object.values(input.traits).every(isUnit))throw new RangeError('B272 traits must contain only finite values in [0,1]');
    for(const [name,vector] of [['selfLatent',input.selfLatent],['worldLatent',input.worldLatent]] as const){
      if(!Array.isArray(vector)||vector.length<1||vector.length>256||vector.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1_000_000))throw new RangeError(`B272 ${name} must be a bounded finite vector`);
    }
    for(const [name,value] of [['predictionError01',input.predictionError01],['autobiographicalContinuity01',input.autobiographicalContinuity01],['identityContinuity01',input.identityContinuity01],['intrinsicReward01',input.intrinsicReward01],['lastReward01',input.lastReward01]] as const)if(!isUnit(value))throw new RangeError(`B272 ${name} must be in [0,1]`);
    if(input.intrinsicDrive01!==undefined&&!isUnit(input.intrinsicDrive01))throw new RangeError('B272 intrinsicDrive01 must be in [0,1]');
    if(input.intrinsicDriveConfidence01!==undefined&&!isUnit(input.intrinsicDriveConfidence01))throw new RangeError('B272 intrinsicDriveConfidence01 must be in [0,1]');
    if(input.lastAction!==null&&!isAction(input.lastAction))throw new RangeError('B272 lastAction is invalid');
    if(this.state.steps>=Number.MAX_SAFE_INTEGER||this.state.generatedGoals>=Number.MAX_SAFE_INTEGER)throw new RangeError('B272 step counter reached its safe integer limit');
    const c=this.generateCandidate({...input,tick}); const idx=c.actionScores.indexOf(Math.max(...c.actionScores)); const action=ACTIONS[idx]??'reflect';
    const selfConflict=clamp01(.55*(1-c.coherence01)+.25*input.predictionError01+.20*Math.abs(input.needs.goalPressure01-input.intrinsicReward01));
    const endogenous01=clamp01(.32*c.internalNeed01+.24*c.novelty01+.24*(1-selfConflict)+.20*c.confidence01);
    this.state.tick=input.tick;this.state.steps++;this.state.generatedGoals++;this.state.currentGoal=c.vector.slice();this.state.currentGoalId=c.id;this.state.currentAction=action;this.state.currentConfidence01=c.confidence01;this.state.goalPressure01=clamp01(.72*this.state.goalPressure01+.28*(input.needs.goalPressure01+endogenous01*.35));this.state.goalNovelty01=c.novelty01;this.state.selfConflict01=selfConflict;this.state.internalCoherence01=c.coherence01;this.state.agency01=clamp01(.82*this.state.agency01+.18*(endogenous01*(1-selfConflict)+.25));
    this.state.goalHistory=[...this.state.goalHistory,{tick:input.tick,id:c.id,vector:c.vector.slice(),action,reward01:input.lastReward01,predictionError01:input.predictionError01,accepted:false}].slice(-128);
    return {...c,action,goalId:c.id,goalVector:c.vector.slice(),selfConflict01:selfConflict,agency01:this.state.agency01,endogenous01};
  }
  learnFromOutcome(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;externalEvidence01:number;independentEvaluatorGain01?:number;acceptedExternalGoal?:boolean}){
    if(!isRecord(input))throw new TypeError('B272 outcome must be an object');
    if(!Number.isSafeInteger(input.tick)||typeof input.tick!=='number'||input.tick!==this.state.tick)throw new RangeError('B272 outcome tick must match the current goal tick');
    if(!isAction(input.action)||input.action!==this.state.currentAction)throw new RangeError('B272 outcome action must match the generated action');
    if(!isUnit(input.reward01)||!isUnit(input.predictionError01)||!isUnit(input.externalEvidence01))throw new RangeError('B272 outcome signals must be finite values in [0,1]');
    if(input.independentEvaluatorGain01!==undefined&&(typeof input.independentEvaluatorGain01!=='number'||!Number.isFinite(input.independentEvaluatorGain01)||input.independentEvaluatorGain01< -1||input.independentEvaluatorGain01>1))throw new RangeError('B272 independent evaluator gain must be finite and in [-1,1]');
    if(input.acceptedExternalGoal!==undefined&&typeof input.acceptedExternalGoal!=='boolean')throw new TypeError('B272 acceptedExternalGoal must be boolean');
    if(input.tick<=this.state.lastOutcomeTick)throw new Error('B272 outcome for this tick has already been credited');
    const latest=this.state.goalHistory[this.state.goalHistory.length-1];
    if(!latest||latest.tick!==input.tick||latest.id!==this.state.currentGoalId||latest.action!==input.action)throw new Error('B272 outcome has no matching generated-goal evidence');
    if(this.state.learningUpdates>=Number.MAX_SAFE_INTEGER)throw new RangeError('B272 learning counter reached its safe integer limit');
    const existingMemory=this.state.goalOutcomeMemory[this.state.currentGoalId];
    if(existingMemory&&existingMemory.updates>=Number.MAX_SAFE_INTEGER)throw new RangeError('B272 goal outcome memory counter reached its safe integer limit');
    const externalEvidenceBonus=input.externalEvidence01*.08;
    const gain=clamp11((input.reward01-.5)*.9+(0.5-input.predictionError01)*.35+(input.independentEvaluatorGain01??0)*.6+externalEvidenceBonus);
    const accepted=input.acceptedExternalGoal===true&&gain>=-.02;
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
    // Keep the online outcome memory bounded just like its restored snapshot.
    // Evict the oldest evidence record only when a new goal identity arrives.
    if(!this.state.goalOutcomeMemory[this.state.currentGoalId]&&Object.keys(this.state.goalOutcomeMemory).length>=256){
      const oldest=Object.entries(this.state.goalOutcomeMemory).sort((a,b)=>a[1].lastTick-b[1].lastTick)[0];
      if(oldest)delete this.state.goalOutcomeMemory[oldest[0]];
    }
    const memoryAlpha=Math.min(.32,.12+Math.min(.16,memory.updates*.01));
    this.state.goalOutcomeMemory[this.state.currentGoalId]={
      vector:goal.slice(0,8),
      meanReward01:clamp01(memory.meanReward01+(clamp01(input.reward01)-memory.meanReward01)*memoryAlpha),
      meanPredictionError01:clamp01(memory.meanPredictionError01+(clamp01(input.predictionError01)-memory.meanPredictionError01)*memoryAlpha),
      updates:memory.updates+1,lastTick:input.tick,
    };
    this.state.outcomeHistory=[...this.state.outcomeHistory,{tick:input.tick,goalId:this.state.currentGoalId,action:input.action,reward01:input.reward01,predictionError01:input.predictionError01}].slice(-256);
    this.state.lastOutcomeTick=input.tick;
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
