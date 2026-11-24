import type { ActionKind } from '../core/types.ts';

const AREAS = ['sensorium','memory','association','selfAction'] as const;
type AreaName = typeof AREAS[number];
const EDGES = AREAS.flatMap((from, i) => AREAS.filter((_, j) => i !== j).map((to) => `${from}->${to}`));
const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const tanh = (x:number) => Math.tanh(Math.max(-6,Math.min(6,x)));
const sigmoid = (x:number) => 1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const dot = (a:number[],b:number[]) => { let s=0; for(let i=0;i<Math.min(a.length,b.length);i++) s += a[i]*b[i]; return s; };
const norm = (v:number[]) => Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01 = (a:number[],b:number[]) => clamp01(.5+.5*(dot(a,b)/(norm(a)*norm(b))));
const seeded = (seed:number) => { let x=seed|0; x=Math.imul(x^(x>>>16),0x21f0aaad); x=Math.imul(x^(x>>>15),0x735a2d97); return (x^(x>>>13))>>>0; };
const rand = (seed:number,scale=.08) => ((seeded(seed)/0xffffffff)*2-1)*scale;

export interface B281MessagePrediction { tick:number; edge:string; source:number[]; message:number[]; predicted:number[]; target?:number[]; error01:number; eligibility:number[][]; }
export interface B281State {
  version:1; tick:number; steps:number; learningUpdates:number; messageUpdates:number;
  encoderWeights:Record<string,number[][]>;
  predictorWeights:Record<string,number[][]>;
  contextWeights:Record<string,number[][]>;
  crossCredit:Record<string,number[][]>;
  messageTrace:Record<string,number[]>;
  availability:Record<string,number[]>;
  pending:Record<string,B281MessagePrediction|null>;
  areaPredictionError01:Record<AreaName,number>;
  edgePrediction01:Record<string,number>;
  delayedCredit01:number;
  predictionErrorByEdge:Record<string,number>;
  messageCoherence01:number;
  crossAreaCausalDrop01:number;
  actionReadout:number[][];
  lastAreaSpikes:Record<AreaName,number[]>;
  lastMessages:Record<string,number[]>;
  lastAction:ActionKind|null;
  history:Array<{tick:number;edge:string;error01:number;credit01:number}>;
}

const matrix=(rows:number,cols:number,seed:number,scale=.06)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>rand(seed+i*97+j*17,scale)));
const zeroMatrix=(rows:number,cols:number)=>Array.from({length:rows},()=>Array.from({length:cols},()=>0));

export function defaultB281State():B281State {
  const encoderWeights={} as Record<string,number[][]>, predictorWeights={} as Record<string,number[][]>, contextWeights={} as Record<string,number[][]>, crossCredit={} as Record<string,number[][]>, messageTrace={} as Record<string,number[]>, availability={} as Record<string,number[]>, pending={} as Record<string,B281MessagePrediction|null>, edgePrediction01={} as Record<string,number>;
  for(let e=0;e<EDGES.length;e++){ const edge=EDGES[e]!; encoderWeights[edge]=matrix(8,8,8800+e*101,.10); predictorWeights[edge]=matrix(8,8,9900+e*103,.10); contextWeights[edge]=matrix(8,8,11000+e*107,.05); crossCredit[edge]=zeroMatrix(8,8); messageTrace[edge]=new Array(8).fill(0); availability[edge]=new Array(8).fill(.9); pending[edge]=null; edgePrediction01[edge]=.5; }
  const areaPredictionError01={} as Record<AreaName,number>; for(const a of AREAS) areaPredictionError01[a]=.5;
  const lastAreaSpikes={} as Record<AreaName,number[]>; for(const a of AREAS) lastAreaSpikes[a]=new Array(8).fill(0);
  return {version:1,tick:0,steps:0,learningUpdates:0,messageUpdates:0,encoderWeights,predictorWeights,contextWeights,crossCredit,messageTrace,availability,pending,areaPredictionError01,edgePrediction01,delayedCredit01:.0,predictionErrorByEdge:Object.fromEntries(EDGES.map(e=>[e,.5])),messageCoherence01:.5,crossAreaCausalDrop01:0,actionReadout:matrix(ACTIONS.length,8,16000,.05),lastAreaSpikes,lastMessages:Object.fromEntries(EDGES.map(e=>[e,new Array(8).fill(0)])),lastAction:null,history:[]};
}

export interface B281StepInput { tick:number; areaSpikes:Record<AreaName,number[]>; selfLatent?:number[]; worldLatent?:number[]; goalVector?:number[]; reward01?:number; predictionError01?:number; learningEnabled?:boolean; action?:ActionKind|null; }

export class B281PredictiveInterAreaMessaging {
  private state=B281PredictiveInterAreaMessaging.create();
  static create(){ return defaultB281State(); }
  snapshot():B281State { return structuredClone(this.state); }
  restore(raw:unknown){ const base=defaultB281State(); if(!raw||typeof raw!=='object'){this.state=base;return;} const r=raw as Partial<B281State>; this.state={...base,...r,pending:{...base.pending,...((r as any).pending??{})},lastMessages:{...base.lastMessages,...((r as any).lastMessages??{})},lastAreaSpikes:{...base.lastAreaSpikes,...((r as any).lastAreaSpikes??{})}}; }
  step(input:B281StepInput){
    this.state.tick=input.tick;
    const context=[...(input.selfLatent??[]),...(input.worldLatent??[]),...(input.goalVector??[])].slice(0,24);
    while(context.length<24) context.push(0);
    let totalErr=0,totalWeight=0,coh=[] as number[];
    const pendingNow:Record<string,B281MessagePrediction|null>={};
    for(const edge of EDGES){
      const [from,to]=edge.split('->') as [AreaName,AreaName];
      const source=input.areaSpikes[from]?.slice(0,8)??new Array(8).fill(0);
      const target=input.areaSpikes[to]?.slice(0,8)??new Array(8).fill(0);
      const encoder=this.state.encoderWeights[edge]!; const predictor=this.state.predictorWeights[edge]!; const contextW=this.state.contextWeights[edge]!;
      const message=new Array(8).fill(0); const predicted=new Array(8).fill(0);
      for(let j=0;j<8;j++){
        let s=0,p=0,c=0; for(let i=0;i<8;i++){s+=source[i]!*(encoder[i]![j]??0); p+=source[i]!*(predictor[i]![j]??0); c+=(context[i]??0)*(contextW[i]![j]??0);}
        const gate=sigmoid(c); message[j]=tanh((s*.85+c*.15)*gate)*this.state.availability[edge]![j]!*0.98; predicted[j]=tanh(p*.65+c*.35)*this.state.availability[edge]![j]!;
      }
      const previous=this.state.pending[edge];
      if(previous){
        const err=1-cosine01(previous.predicted,target);
        this.state.predictionErrorByEdge[edge]=err;
        this.state.edgePrediction01[edge]=this.state.edgePrediction01[edge]!*.88+(1-err)*.12;
        totalErr+=err; totalWeight+=1;
        this.state.crossCredit[edge]=previous.eligibility.map((row,i)=>row.map((v,j)=>.92*v + .08*((target[j]??0)-(previous.predicted[j]??0))*previous.source[i]!));
        if(input.learningEnabled!==false){
          const reward=clamp01(input.reward01??.5); const surprise=clamp01(input.predictionError01??.5); const third=clamp11((reward-.5)*.75-(surprise-.5)*.25);
          const encoder=this.state.encoderWeights[edge]!; const predictor=this.state.predictorWeights[edge]!; const contextW=this.state.contextWeights[edge]!;
          for(let i=0;i<8;i++) for(let j=0;j<8;j++){
            const residual=(target[j]??0)-(previous.predicted[j]??0);
            const d=.0022*third*previous.source[i]!*(0.5+0.5*Math.abs(residual));
            encoder[i]![j]=clamp11(encoder[i]![j]!+d); predictor[i]![j]=clamp11(predictor[i]![j]!+.0028*residual*previous.source[i]!);
            const c=(input.selfLatent?.[i%((input.selfLatent?.length||1))]??0)+(input.worldLatent?.[i%((input.worldLatent?.length||1))]??0)+(input.goalVector?.[i%((input.goalVector?.length||1))]??0);
            contextW[i]![j]=clamp11(contextW[i]![j]!+.0010*residual*c); if(Math.abs(d)>1e-7)this.state.messageUpdates++;
          }
          const availability=this.state.availability[edge]!; for(let j=0;j<8;j++) availability[j]=clamp01(availability[j]!*0.998+(1-err)*.002);
          this.state.learningUpdates++;
        }
      }
      const elig=zeroMatrix(8,8); for(let i=0;i<8;i++) for(let j=0;j<8;j++) elig[i]![j]=source[i]!*message[j]!;
      pendingNow[edge]={tick:input.tick,edge,source,message,predicted,target:undefined,error01:0,eligibility:elig};
      this.state.messageTrace[edge]=message.map((v,j)=>.86*(this.state.messageTrace[edge]![j]??0)+.14*Math.abs(v));
      this.state.lastMessages[edge]=message;
      coh.push(cosine01(source,predicted));
    }
    const newPending:Record<string,B281MessagePrediction|null>={};
    for(const edge of EDGES){ const p=pendingNow[edge]!; newPending[edge]=p; }
    this.state.pending=newPending;
    for(const a of AREAS) this.state.lastAreaSpikes[a]=input.areaSpikes[a]?.slice(0,8)??new Array(8).fill(0);
    const meanErr=totalWeight?totalErr/totalWeight:0; this.state.messageCoherence01=this.state.messageCoherence01*.88+(coh.reduce((a,b)=>a+b,0)/Math.max(1,coh.length))*.12;
    this.state.delayedCredit01=clamp01(1-meanErr);
    this.state.steps++;
    const action=this.readAction(input.areaSpikes.selfAction??new Array(8).fill(0)); this.state.lastAction=action;
    if(input.learningEnabled!==false) this.applyOnlinePlasticity(input);
    return {action,messageCoherence01:this.state.messageCoherence01,delayedCredit01:this.state.delayedCredit01,meanPredictionError01:meanErr,hiddenMessageCount:EDGES.length};
  }
  private applyOnlinePlasticity(input:B281StepInput){ const reward=clamp01(input.reward01??.5), surprise=clamp01(input.predictionError01??.5); const third=clamp11((reward-.5)*.75-(surprise-.5)*.25);
    for(const edge of EDGES){ const p=this.state.pending[edge]!; if(!p)continue; const encoder=this.state.encoderWeights[edge]!,predictor=this.state.predictorWeights[edge]!,contextW=this.state.contextWeights[edge]!; const [,to]=edge.split('->') as [AreaName,AreaName]; const target=input.areaSpikes[to]?.slice(0,8)??new Array(8).fill(0);
      for(let i=0;i<8;i++) for(let j=0;j<8;j++){
        const err=(target[j]??0)-(p.predicted[j]??0); const local=.0018*third*p.source[i]!*(0.5+0.5*Math.abs(err)); encoder[i]![j]=clamp11(encoder[i]![j]!+local); predictor[i]![j]=clamp11(predictor[i]![j]!+.0024*err*p.source[i]!); const c=(input.selfLatent?.[i%((input.selfLatent?.length||1))]??0)+(input.worldLatent?.[i%((input.worldLatent?.length||1))]??0)+(input.goalVector?.[i%((input.goalVector?.length||1))]??0); contextW[i]![j]=clamp11(contextW[i]![j]!+.0009*err*c);
        if(Math.abs(local)>1e-7)this.state.messageUpdates++;
      }
      const avgErr=1-cosine01(target,p.predicted); this.state.availability[edge]=this.state.availability[edge]!.map(v=>clamp01(v*.997 + (1-avgErr)*.003));
    }
    this.state.learningUpdates++;
  }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;action?:ActionKind|null}){ this.state.delayedCredit01=clamp01(this.state.delayedCredit01*.9 + (input.reward01*(1-clamp01(input.predictionError01)))*.1); this.state.learningUpdates++; for(const edge of EDGES){ const credit=clamp11((input.reward01-.5)*.8-input.predictionError01*.2); this.state.crossCredit[edge]=this.state.crossCredit[edge]!.map(r=>r.map(v=>clamp11(v+.0007*credit))); } this.state.history=[...this.state.history.slice(-127),{tick:input.tick,edge:'global',error01:clamp01(input.predictionError01),credit01:this.state.delayedCredit01}]; return {delayedCredit01:this.state.delayedCredit01,learningUpdates:this.state.learningUpdates}; }
  private readAction(v:number[]){ let best='wait' as ActionKind,bestScore=-Infinity; for(let a=0;a<ACTIONS.length;a++){const score=dot(this.state.actionReadout[a]!,v); if(score>bestScore){bestScore=score;best=ACTIONS[a]!;}} return best; }
  actionBias(action:ActionKind){ const idx=ACTIONS.indexOf(action); if(idx<0)return 0; return clamp11(dot(this.state.actionReadout[idx]!,this.state.lastAreaSpikes.selfAction??[])/8)*.025*this.state.delayedCredit01; }
  lesionEdge(from:AreaName,to:AreaName,fraction01=.5){
    const edge=`${from}->${to}`;
    const savedW=this.state.encoderWeights[edge]!.map(r=>r.slice());
    const savedA=this.state.availability[edge]!.slice();
    const cut=Math.max(1,Math.floor(8*clamp01(fraction01)));
    for(let j=0;j<cut;j++){
      this.state.availability[edge]![j]=0;
      for(let i=0;i<8;i++) this.state.encoderWeights[edge]![i]![j]=0;
    }
    const p=this.state.lastMessages[edge]??new Array(8).fill(0);
    const toVec=this.state.lastAreaSpikes[to]??new Array(8).fill(0);
    const drop=1-cosine01(p,toVec);
    this.state.encoderWeights[edge]=savedW;
    this.state.availability[edge]=savedA;
    this.state.crossAreaCausalDrop01=Math.max(this.state.crossAreaCausalDrop01,clamp01(drop));
    return {from,to,causalDrop01:clamp01(drop),cut};
  }
  diagnostics(){ return {...this.state,meanEdgePrediction01:Object.values(this.state.edgePrediction01).reduce((a,b)=>a+b,0)/Math.max(1,EDGES.length),causalMessageIndex:clamp01(this.state.messageCoherence01*.45+this.state.delayedCredit01*.35+(1-(this.meanError()))*.2),edges:[...EDGES]}; }
  private meanError(){ return Object.values(this.state.edgePrediction01).reduce((a,b)=>a+(1-b),0)/Math.max(1,EDGES.length); }
  snapshotCircuit(){ return {steps:this.state.steps,learningUpdates:this.state.learningUpdates,messageUpdates:this.state.messageUpdates,delayedCredit01:this.state.delayedCredit01,messageCoherence01:this.state.messageCoherence01,meanEdgePrediction01:this.diagnostics().meanEdgePrediction01,crossAreaCausalDrop01:this.state.crossAreaCausalDrop01}; }
}
