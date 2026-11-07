import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const HYPOTHESES = 4;
const DIM = 16;
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp01(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.07)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const matrix=(rows:number,cols:number,seed:number,scale=.07)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>rand(seed+i*97+j*17,scale)));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const svec=(v:unknown,n:number,fill=0):number[]=>Array.isArray(v)?v.slice(0,n).map(x=>clamp11(finN(x,fill))).concat(new Array(Math.max(0,n-v.length)).fill(fill)):new Array(n).fill(fill);
const smat=(v:unknown,rows:number,cols:number,fb:number[][]):number[][]=>Array.isArray(v)?Array.from({length:rows},(_,i)=>{const row=Array.isArray((v as unknown[])[i])?(v as unknown[])[i] as unknown[]:null;return row?Array.from({length:cols},(_,j)=>clamp11(finN(row[j],fb[i]?.[j]??0))):(fb[i]?.slice()??new Array(cols).fill(0));}):fb.map(r=>r.slice());
const sanHyp=(x:unknown,id:number,fb:B283HypothesisRecord):B283HypothesisRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const st=r.status;const out:B283HypothesisRecord={id,latent:svec(r.latent,DIM),predictor:smat(r.predictor,DIM,DIM,fb.predictor),actionTransition:smat(r.actionTransition,ACTIONS.length,DIM,fb.actionTransition),posterior01:clamp01(finN(r.posterior01,fb.posterior01)),confidence01:clamp01(finN(r.confidence01,fb.confidence01)),evidence01:clamp01(finN(r.evidence01,fb.evidence01)),lastError01:clamp01(finN(r.lastError01,fb.lastError01)),age:cnt(r.age,0),dwell:cnt(r.dwell,0),actionWeights:smat(r.actionWeights,ACTIONS.length,DIM,fb.actionWeights),status:st==='active'||st==='committed'||st==='rejected'||st==='superseded'?st as B283HypothesisRecord['status']:'active',switches:cnt(r.switches,0)};if(r.acceptedAt!==undefined)out.acceptedAt=cnt(r.acceptedAt,0);if(r.rejectedAt!==undefined)out.rejectedAt=cnt(r.rejectedAt,0);return out;};
const sanHistory=(x:unknown):B283State['history'][number]|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {tick:cnt(r.tick,0),active:cnt(r.active,0),posterior:clamp01(finN(r.posterior,0)),error:clamp01(finN(r.error,0)),status:typeof r.status==='string'?r.status.slice(0,40):'active'};};

export interface B283HypothesisRecord{
  id:number; latent:number[]; predictor:number[][]; actionTransition:number[][]; posterior01:number; confidence01:number; evidence01:number;
  lastError01:number; age:number; dwell:number; actionWeights:number[][]; status:'active'|'committed'|'rejected'|'superseded';
  switches:number; acceptedAt?:number; rejectedAt?:number;
}

export interface B283State{
  version:1; tick:number; steps:number; learningUpdates:number; predictionUpdates:number; hypothesisSwitches:number; commits:number; rejects:number; rollbacks:number;
  hypotheses:B283HypothesisRecord[]; activeHypothesisId:number; committedHypothesisId:number|null; previousCommittedHypothesisId:number|null; globalLatent:number[]; predictedNext:number[];
  lastOutcomeReward01:number; lastPredictionError01:number; lastEvidence01:number; diversity01:number; posteriorEntropy01:number;
  selfAlignment01:number; personalityFit01:number; memoryContinuity01:number; actionInfluence01:number; lesionDrop01:number; plannedSequence:ActionKind[]; plannedReturn01:number; planningSteps:number; planningUpdates:number; history:Array<{tick:number;active:number;posterior:number;error:number;status:string}>;
}

export interface B283StepInput{
  tick:number; globalLatent:number[]; selfLatent?:number[]; worldLatent?:number[]; goalVector?:number[]; memoryLatent?:number[];
  reward01?:number; predictionError01?:number; uncertainty01?:number; autonomy01?:number; personalityVector?:number[]; learningEnabled?:boolean;
}

export function defaultB283State():B283State{
  const hypotheses:Array<B283HypothesisRecord>=Array.from({length:HYPOTHESES},(_,h)=>({
    id:h,latent:Array.from({length:DIM},(_,i)=>rand(280000+h*1000+i,.025)),predictor:matrix(DIM,DIM,281000+h*1000,.035),actionTransition:matrix(ACTIONS.length,DIM,283000+h*1000,.035),posterior01:1/HYPOTHESES,confidence01:.42,evidence01:.5,lastError01:.5,age:0,dwell:0,
    actionWeights:matrix(ACTIONS.length,DIM,282000+h*1000,.035),status:'active',switches:0
  }));
  return {version:1,tick:0,steps:0,learningUpdates:0,predictionUpdates:0,hypothesisSwitches:0,commits:0,rejects:0,rollbacks:0,hypotheses,activeHypothesisId:0,committedHypothesisId:null,previousCommittedHypothesisId:null,globalLatent:new Array(DIM).fill(0),predictedNext:new Array(DIM).fill(0),lastOutcomeReward01:.5,lastPredictionError01:.5,lastEvidence01:.5,diversity01:.5,posteriorEntropy01:1,selfAlignment01:.5,personalityFit01:.5,memoryContinuity01:.5,actionInfluence01:.5,lesionDrop01:0,plannedSequence:[],plannedReturn01:.5,planningSteps:0,planningUpdates:0,history:[]};
}

export class B283CompetingPredictiveHypotheses{
  private state=B283CompetingPredictiveHypotheses.create();
  static create(){return defaultB283State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw:unknown){const base=defaultB283State();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const hs=read('hypotheses');const hyps:Array<B283HypothesisRecord>=Array.from({length:HYPOTHESES},(_,i)=>{const h=Array.isArray(hs)?(hs as unknown[])[i]:undefined;return sanHyp(h,i,base.hypotheses[i]!)??base.hypotheses[i]!;});let history:B283State['history']=[];try{const h=read('history');if(Array.isArray(h))history=h.slice(-240).map(sanHistory).filter((x):x is B283State['history'][number]=>x!==null);}catch{history=[];}const ch=read('committedHypothesisId');const pch=read('previousCommittedHypothesisId');const ps=read('plannedSequence');this.state={version:1,tick:cnt(read('tick'),base.tick),steps:cnt(read('steps'),base.steps),learningUpdates:cnt(read('learningUpdates'),base.learningUpdates),predictionUpdates:cnt(read('predictionUpdates'),base.predictionUpdates),hypothesisSwitches:cnt(read('hypothesisSwitches'),base.hypothesisSwitches),commits:cnt(read('commits'),base.commits),rejects:cnt(read('rejects'),base.rejects),rollbacks:cnt(read('rollbacks'),base.rollbacks),hypotheses:hyps,activeHypothesisId:Math.min(HYPOTHESES-1,cnt(read('activeHypothesisId'),base.activeHypothesisId)),committedHypothesisId:ch===null||ch===undefined?null:Math.min(HYPOTHESES-1,cnt(ch,0)),previousCommittedHypothesisId:pch===null||pch===undefined?null:Math.min(HYPOTHESES-1,cnt(pch,0)),globalLatent:svec(read('globalLatent'),DIM),predictedNext:svec(read('predictedNext'),DIM),lastOutcomeReward01:clamp01(finN(read('lastOutcomeReward01'),base.lastOutcomeReward01)),lastPredictionError01:clamp01(finN(read('lastPredictionError01'),base.lastPredictionError01)),lastEvidence01:clamp01(finN(read('lastEvidence01'),base.lastEvidence01)),diversity01:clamp01(finN(read('diversity01'),base.diversity01)),posteriorEntropy01:clamp01(finN(read('posteriorEntropy01'),base.posteriorEntropy01)),selfAlignment01:clamp01(finN(read('selfAlignment01'),base.selfAlignment01)),personalityFit01:clamp01(finN(read('personalityFit01'),base.personalityFit01)),memoryContinuity01:clamp01(finN(read('memoryContinuity01'),base.memoryContinuity01)),actionInfluence01:clamp01(finN(read('actionInfluence01'),base.actionInfluence01)),lesionDrop01:clamp01(finN(read('lesionDrop01'),base.lesionDrop01)),plannedSequence:Array.isArray(ps)?(ps as unknown[]).filter((x):x is ActionKind=>ACTIONS.includes(x as ActionKind)).slice(0,5):[],plannedReturn01:clamp01(finN(read('plannedReturn01'),base.plannedReturn01)),planningSteps:cnt(read('planningSteps'),base.planningSteps),planningUpdates:cnt(read('planningUpdates'),base.planningUpdates),history};}
  step(input:B283StepInput){
    this.state.tick=input.tick;
    const context=Array.from({length:DIM},(_,i)=>clamp11((input.globalLatent?.[i%DIM]??0)*.42+(input.selfLatent?.[i%(input.selfLatent?.length||1)]??0)*.20+(input.worldLatent?.[i%(input.worldLatent?.length||1)]??0)*.16+(input.goalVector?.[i%(input.goalVector?.length||1)]??0)*.12+(input.memoryLatent?.[i%(input.memoryLatent?.length||1)]??0)*.10));
    const predictions=this.state.hypotheses.map(h=>{
      const pred=new Array(DIM).fill(0);for(let i=0;i<DIM;i++){let s=0;for(let j=0;j<DIM;j++)s+=h.predictor[i]![j]!*(context[j]??0);pred[i]=tanh(s+(h.latent[i]??0)*.22);} const prior=h.posterior01;
      const fit=cosine01(pred,input.globalLatent?.slice(0,DIM)??new Array(DIM).fill(0));
      const selfFit=cosine01(pred,input.selfLatent?.slice(0,DIM)??new Array(DIM).fill(0));
      const goalFit=cosine01(pred,input.goalVector?.slice(0,DIM)??new Array(DIM).fill(0));
      const memoryFit=cosine01(pred,input.memoryLatent?.slice(0,DIM)??new Array(DIM).fill(0));
      const evidence=clamp01(.34*fit+.20*selfFit+.18*goalFit+.14*memoryFit+.08*(1-(input.uncertainty01??.5))+.06*(input.autonomy01??.5));
      const error=1-evidence;
      return {h,pred,evidence,error,prior};
    });
    const temperature=.55+((input.uncertainty01??.5)*.35);
    const exps=predictions.map(x=>Math.exp((x.evidence-.5)/temperature));const z=Math.max(1e-9,exps.reduce((a,b)=>a+b,0));
    predictions.forEach((x,i)=>x.h.posterior01=exps[i]!/z);
    predictions.sort((a,b)=>b.h.posterior01-a.h.posterior01);
    const best=predictions[0]!; const prev=this.state.activeHypothesisId; if(prev!==best.h.id){best.h.switches++;this.state.hypothesisSwitches++;best.h.dwell=0;}
    else best.h.dwell++;
    this.state.activeHypothesisId=best.h.id; this.state.globalLatent=best.pred.slice(); this.state.predictedNext=best.pred.slice();
    const posteriorEntropy=clamp01(-predictions.reduce((s,x)=>s+x.h.posterior01*Math.log2(Math.max(1e-9,x.h.posterior01)),0)/2);
    const diversity=clamp01(predictions.slice(1).reduce((s,x)=>s+Math.sqrt(Math.max(0,1-cosine01(x.pred,best.pred))),0)/3);
    this.state.posteriorEntropy01=posteriorEntropy;this.state.diversity01=diversity;
    this.state.selfAlignment01=clamp01(.55+.45*cosine01(best.pred,input.selfLatent?.slice(0,DIM)??new Array(DIM).fill(0)));
    this.state.personalityFit01=clamp01(.55+.45*cosine01(best.pred,input.personalityVector?.slice(0,DIM)??new Array(DIM).fill(0)));
    this.state.memoryContinuity01=clamp01(.55+.45*cosine01(best.pred,input.memoryLatent?.slice(0,DIM)??new Array(DIM).fill(0)));
    this.state.lastPredictionError01=best.error;this.state.lastEvidence01=best.evidence;
    const action=this.readAction(best.h,context);
    this.state.steps++;this.state.history.push({tick:input.tick,active:best.h.id,posterior:best.h.posterior01,error:best.error,status:best.h.status});if(this.state.history.length>240)this.state.history.shift();
    if(input.learningEnabled!==false)this.learnFromPrediction({input,context,prediction:best.pred,evidence:best.evidence,action});
    return {hypothesisId:best.h.id,posterior01:best.h.posterior01,evidence01:best.evidence,error01:best.error,action,globalLatent:best.pred.slice(),posteriorEntropy01:posteriorEntropy,diversity01:diversity,selfAlignment01:this.state.selfAlignment01,personalityFit01:this.state.personalityFit01,memoryContinuity01:this.state.memoryContinuity01};
  }
  private learnFromPrediction(args:{input:B283StepInput;context:number[];prediction:number[];evidence:number;action:ActionKind}){
    const h=this.state.hypotheses[this.state.activeHypothesisId]!; const target=args.input.globalLatent?.slice(0,DIM)??new Array(DIM).fill(0); const actionIndex=ACTIONS.indexOf(args.action); const reward=clamp01(args.input.reward01??.5); const third=clamp11((reward-.5)*.8-(1-args.evidence)*.3);
    for(let i=0;i<DIM;i++)for(let j=0;j<DIM;j++){const residual=(target[j]??0)-(args.prediction[j]??0);h.predictor[i]![j]=clamp11(h.predictor[i]![j]!+.0017*residual*(args.context[i]??0)+.0004*third*(args.prediction[j]??0));if(Math.abs(residual)>.02)this.state.predictionUpdates++;} if(actionIndex>=0){const row=h.actionTransition[actionIndex]!;for(let i=0;i<DIM;i++){const residual=(target[i]??0)-(args.prediction[i]??0);row[i]=clamp11(row[i]+.012*residual*(.7+.3*args.evidence));}}
    for(let i=0;i<DIM;i++)h.latent[i]=clamp11((h.latent[i]??0)*.996+(args.context[i]??0)*.004*third);
    h.lastError01=1-args.evidence;h.confidence01=clamp01(h.confidence01*.985+args.evidence*.015);h.evidence01=clamp01(h.evidence01*.96+args.evidence*.04);h.age++;
    this.state.learningUpdates++;this.state.lastOutcomeReward01=reward;
  }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;action:ActionKind|null;independentEvidence01?:number}){
    const h=this.state.hypotheses[this.state.activeHypothesisId]!;const evidence=clamp01((1-input.predictionError01)*.55+(input.independentEvidence01??.5)*.45);h.evidence01=clamp01(h.evidence01*.9+evidence*.1);h.confidence01=clamp01(h.confidence01*.92+evidence*.08);this.state.lastOutcomeReward01=clamp01(input.reward01);this.state.lastPredictionError01=clamp01(input.predictionError01);this.state.actionInfluence01=clamp01(this.state.actionInfluence01*.92+(1-input.predictionError01)*.08);}
  private readAction(h:B283HypothesisRecord,context:number[]):ActionKind{let best=0,bestScore=-Infinity;for(let i=0;i<ACTIONS.length;i++){const s=dot(h.actionWeights[i]!,context);if(s>bestScore){bestScore=s;best=i;}}return ACTIONS[best]!;}
  actionBias(action:ActionKind){const h=this.state.hypotheses[this.state.activeHypothesisId]!;const ai=ACTIONS.indexOf(action);if(ai<0)return 0;const value=dot(h.actionWeights[ai]!,this.state.globalLatent)/Math.max(1,DIM);return clamp11(value)*.045*this.state.lastEvidence01;}
  planHorizon(input:{tick?:number;goalVector?:number[];selfLatent?:number[];worldLatent?:number[];memoryLatent?:number[];uncertainty01?:number;autonomy01?:number;beamWidth?:number;horizon?:3|5}){
    const h=this.state.hypotheses[this.state.activeHypothesisId]!;
    const goal=(input.goalVector??[]); const self=(input.selfLatent??[]); const world=(input.worldLatent??[]); const memory=(input.memoryLatent??[]);
    const baseLatent=this.state.predictedNext?.length===DIM?this.state.predictedNext.slice():this.state.globalLatent.slice();
    const beamWidth=Math.max(2,Math.min(8,Math.floor(Number(input.beamWidth??5))));
    const horizon=input.horizon===5?5:3;
    let beam:Array<{actions:ActionKind[];latent:number[];return01:number}> = [{actions:[],latent:baseLatent,return01:0}];
    const predict=(latent:number[],actionIndex:number)=>{const actionRow=h.actionTransition?.[actionIndex]??[];const out=new Array(DIM).fill(0);for(let i=0;i<DIM;i++){let z=(h.latent[i]??0)*.04;for(let j=0;j<DIM;j++)z+=(h.predictor[i]?.[j]??0)*(latent[j]??0);z+=(actionRow[i%(actionRow.length||1)]??0)*.35;out[i]=tanh(z);}return out;};
    for(let step=0;step<horizon;step++){
      const expanded:Array<{actions:ActionKind[];latent:number[];return01:number}>=[];
      for(const item of beam){for(let ai=0;ai<ACTIONS.length;ai++){const next=predict(item.latent,ai);const actionFit=clamp01(.5+.5*cosine01(next,goal.slice(0,DIM)));const goalFit=cosine01(next,goal.slice(0,DIM));const selfFit=cosine01(next,self.slice(0,DIM));const worldFit=cosine01(next,world.slice(0,DIM));const memoryFit=cosine01(next,memory.slice(0,DIM));const evidence=.28*h.evidence01+.18*h.confidence01+.16*goalFit+.14*selfFit+.12*worldFit+.07*memoryFit+.05*(1-(input.uncertainty01??.5));const utility=clamp01(.26*actionFit+.28*evidence+.22*goalFit+.12*selfFit+.07*(input.autonomy01??.5)+.05*worldFit);expanded.push({actions:[...item.actions,ACTIONS[ai]],latent:next,return01:item.return01+Math.pow(.86,step)*utility});}}
      expanded.sort((a,b)=>b.return01-a.return01);beam=expanded.slice(0,beamWidth);
    }
    const best=beam[0]??{actions:[],latent:baseLatent,return01:.5};
    const normalization=horizon===5?3.65:2.6;
    this.state.plannedSequence=best.actions.slice(0,horizon);this.state.plannedReturn01=clamp01(best.return01/normalization);this.state.planningSteps+=horizon;this.state.planningUpdates++;
    return {sequence:this.state.plannedSequence.slice(),return01:this.state.plannedReturn01,hypothesisId:h.id,beamWidth,steps:horizon};
  }
  planThreeStep(input:{tick?:number;goalVector?:number[];selfLatent?:number[];worldLatent?:number[];memoryLatent?:number[];uncertainty01?:number;autonomy01?:number;beamWidth?:number}){return this.planHorizon({...input,horizon:3});}
  planningBias(action:ActionKind){const idx=this.state.plannedSequence.indexOf(action);if(idx<0)return 0;const returnGate=1+Math.max(0,this.state.plannedReturn01-.55)*2;const strength=idx===0?.20*returnGate:idx===1?.055*returnGate:.018*Math.pow(.62,Math.max(0,idx-2))*returnGate;return clamp11(strength);}
  proposeHypothesis(){return this.state.hypotheses.filter(h=>h.status==='active').map(h=>({id:h.id,posterior01:h.posterior01,evidence01:h.evidence01,confidence01:h.confidence01,selfAlignment01:this.state.selfAlignment01,personalityFit01:this.state.personalityFit01}));}
  commitActive(tick=this.state.tick){const h=this.state.hypotheses[this.state.activeHypothesisId]!;if(h.confidence01<.56||h.evidence01<.56)return {committed:false,reason:'insufficient-evidence',hypothesisId:h.id};if(this.state.committedHypothesisId!==null&&this.state.committedHypothesisId!==h.id){const old=this.state.hypotheses[this.state.committedHypothesisId]!;old.status='superseded';this.state.previousCommittedHypothesisId=old.id;}else{this.state.previousCommittedHypothesisId=this.state.committedHypothesisId;}h.status='committed';h.acceptedAt=tick;this.state.committedHypothesisId=h.id;this.state.commits++;return {committed:true,reason:'evidence-gated-commit',hypothesisId:h.id};}
  rejectActive(tick=this.state.tick){const h=this.state.hypotheses[this.state.activeHypothesisId]!;const wasCommitted=this.state.committedHypothesisId===h.id;h.status='rejected';h.rejectedAt=tick;this.state.rejects++;if(wasCommitted){this.state.committedHypothesisId=this.state.previousCommittedHypothesisId;this.state.activeHypothesisId=this.state.previousCommittedHypothesisId??0;}else if(this.state.committedHypothesisId!==null)this.state.activeHypothesisId=this.state.committedHypothesisId;return {rejected:true,hypothesisId:h.id,activeHypothesisId:this.state.activeHypothesisId,restoredCommit:this.state.committedHypothesisId};}
  rollback(tick=this.state.tick){const h=this.state.hypotheses[this.state.activeHypothesisId]!;if(this.state.committedHypothesisId===null)return {rolledBack:false,reason:'no-commit'};if(h.id===this.state.committedHypothesisId)return {rolledBack:false,reason:'active-is-commit'};this.state.activeHypothesisId=this.state.committedHypothesisId;this.state.rollbacks++;return {rolledBack:true,hypothesisId:this.state.activeHypothesisId,tick};}
  lesionHypothesis(id:number,fraction01=.5){const h=this.state.hypotheses.find(x=>x.id===id);if(!h)return {causalDrop01:0};const before=h.evidence01;h.evidence01=clamp01(h.evidence01*(1-fraction01));const after=h.evidence01;h.evidence01=before;const drop=clamp01(before-after);this.state.lesionDrop01=drop;return {hypothesisId:id,causalDrop01:drop};}
  diagnostics(){const active=this.state.hypotheses[this.state.activeHypothesisId]!;return {...structuredClone(this.state),activeHypothesis:{id:active.id,status:active.status,posterior01:active.posterior01,evidence01:active.evidence01,confidence01:active.confidence01},committedHypothesisId:this.state.committedHypothesisId};}
}
