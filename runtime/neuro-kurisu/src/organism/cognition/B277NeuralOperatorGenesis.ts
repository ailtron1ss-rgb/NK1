import { cosineSimilarity } from '../core/NumericPrimitives.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine=(a:number[],b:number[])=>Math.max(-1,Math.min(1,cosineSimilarity(a,b,1e-9)));
const hash=(parts:string[])=>{let h=2166136261;for(const p of parts){for(let i=0;i<p.length;i++){h^=p.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16);};

export interface B277NeuralOperator{
  id:string;
  weights:number[];
  dendriticGate:number[];
  recurrent:number[];
  actionDecoder:number[];
  contextDecoder:number[][];
  bias:number;
  firingRate01:number;
  homeostaticError01:number;
  predictionError01:number;
  reward01:number;
  novelty01:number;
  maturity01:number;
  usage:number;
  transferCount:number;
  createdTick:number;
  lastUsedTick:number;
  status:'germinal'|'plastic'|'verified'|'rejected'|'retired';
}

export interface B277State{
  version:1;
  ticks:number;
  cycles:number;
  operatorGenerations:number;
  verifiedOperators:number;
  rejectedOperators:number;
  transfers:number;
  actionDecisions:number;
  learningUpdates:number;
  neuralSparsity01:number;
  assemblyCoherence01:number;
  homeostasis01:number;
  selfGrounding01:number;
  autonomy01:number;
  operatorNovelty01:number;
  activeOperatorId:string|null;
  lastAction:ActionKind|null;
  lastPredictedReward01:number;
  lastOutput:number[];
  operators:B277NeuralOperator[];
}

export interface B277StepInput{
  tick:number;
  goalVector:number[];
  selfLatent:number[];
  worldLatent:number[];
  neuralAssembly:number[];
  personalityBias:Record<string,number>;
  autonomy01:number;
  novelty01:number;
  predictionError01:number;
  programLatent?:number[];
  programPrimitives?:ActionKind[];
}

export function defaultB277State():B277State{
  return {
    version:1, ticks:0, cycles:0, operatorGenerations:0, verifiedOperators:0,
    rejectedOperators:0, transfers:0, actionDecisions:0, learningUpdates:0,
    neuralSparsity01:.78, assemblyCoherence01:.5, homeostasis01:.76, selfGrounding01:.5,
    autonomy01:.45, operatorNovelty01:.2, activeOperatorId:null, lastAction:null,
    lastPredictedReward01:.5, lastOutput:Array(12).fill(0), operators:[],
  };
}

export class B277NeuralOperatorGenesis{
  private state:B277State=B277Default();
  restore(raw?:Partial<B277State>|null){
    const d=B277Default(), r=raw??{};
    this.state={...d,...r,operators:Array.isArray(r.operators)?r.operators.slice(-96).map((o:any)=>({
      ...o,
      weights:Array.isArray(o?.weights)?o.weights.slice(0,32):Array(24).fill(0),
      dendriticGate:Array.isArray(o?.dendriticGate)?o.dendriticGate.slice(0,8):Array(8).fill(.5),
      recurrent:Array.isArray(o?.recurrent)?o.recurrent.slice(0,8):Array(8).fill(0),
      actionDecoder:Array.isArray(o?.actionDecoder)?o.actionDecoder.slice(0,7):Array(7).fill(0),
      contextDecoder:Array.isArray(o?.contextDecoder)?o.contextDecoder.slice(0,7).map((r:any)=>Array.isArray(r)?r.slice(0,8):Array(8).fill(0)):Array.from({length:7},()=>Array(8).fill(0)),
    })):[]};
  }
  snapshot(){return structuredClone(this.state);}
  private feature(input:B277StepInput){const f=[...input.goalVector.slice(0,8),...input.selfLatent.slice(0,8),...input.worldLatent.slice(0,8),...input.neuralAssembly.slice(0,8),input.autonomy01,input.novelty01,input.predictionError01];while(f.length<32)f.push(0);return f.slice(0,32).map(x=>clamp11(Number(x)||0));}
  private createOperator(input:B277StepInput):B277NeuralOperator{
    const latent=[...input.goalVector,...input.selfLatent,...input.worldLatent,...input.neuralAssembly,...(input.programLatent??[])];
    const seed=latent.slice(0,24).map((v,i)=>clamp11(Math.tanh((v??0)*(.7+(i%5)*.09))));
    const actionDecoder=ACTIONS.map((a,i)=>clamp11((seed[i%Math.max(1,seed.length)]??0)*.42+(Number(input.personalityBias[a]??0)-.5)*.3));
    const id=`op277-${hash([String(input.tick),seed.slice(0,12).map(x=>x.toFixed(3)).join(','),(input.programPrimitives??[]).join('>')])}`;
    const existing=this.state.operators.find(o=>o.id===id);if(existing)return structuredClone(existing);
    const contextDecoder=Array.from({length:7},(_,ai)=>Array.from({length:8},(_,j)=>{
      const primitiveSeed=input.programPrimitives?.includes(ACTIONS[ai])?.24:0;
      return clamp11((seed[(ai+j)%seed.length]??0)*.08+primitiveSeed);
    }));
    const seededActionDecoder=ACTIONS.map((a,i)=>clamp11((actionDecoder[i]??0)+(input.programPrimitives?.includes(a)?.14:0)));
    const op:B277NeuralOperator={
      id, weights:Array.from({length:24},(_,i)=>clamp11((seed[i]??0)*.6)),
      dendriticGate:Array.from({length:8},(_,i)=>clamp01(.45+(seed[i%seed.length]??0)*.18)),
      recurrent:Array.from({length:8},(_,i)=>clamp11((seed[(i+4)%seed.length]??0)*.18)),
      actionDecoder:seededActionDecoder, contextDecoder,
      bias:clamp11(input.autonomy01*.12-input.predictionError01*.08),
      firingRate01:.08, homeostaticError01:.1, predictionError01:input.predictionError01,
      reward01:.5, novelty01:input.novelty01, maturity01:.08, usage:0, transferCount:0,
      createdTick:input.tick, lastUsedTick:input.tick, status:'germinal',
    };
    this.state.operators=[...this.state.operators.slice(-95),op];this.state.operatorGenerations++;return structuredClone(op);
  }
  private activate(op:B277NeuralOperator,f:number[],input:B277StepInput){
    const hidden=Array.from({length:12},(_,i)=>{
      const base=dot(op.weights.slice(i*2,i*2+12),f.slice(i*2,i*2+12))/8.0;
      const dend=op.dendriticGate[i%op.dendriticGate.length];
      const rec=op.recurrent[i%op.recurrent.length];
      return Math.tanh(base*dend+rec+op.bias+input.novelty01*.04-input.predictionError01*.03);
    });
    const ranked=hidden.map((x,i)=>({i,v:Math.abs(x)})).sort((a,b)=>b.v-a.v);
    const winners=new Set(ranked.slice(0,3).map(x=>x.i));
    const sparsified=hidden.map((x,i)=>winners.has(i)?Math.sign(x)*Math.min(1,Math.abs(x)*1.15):0);
    return {hidden:sparsified,rate:sparsified.filter(x=>Math.abs(x)>.12).length/sparsified.length};
  }
  private selectOperator(input:B277StepInput){const f=this.feature(input);let best:B277NeuralOperator|undefined;let bestScore=-Infinity;for(const o of this.state.operators){if(o.status==='rejected'||o.status==='retired')continue;const sim=cosine(f.slice(0,12),o.weights.slice(0,12));const novelty=1-Math.abs(o.novelty01-input.novelty01);const score=.45*sim+.2*o.maturity01+.15*o.reward01+.1*novelty+.1*(1-o.homeostaticError01);if(score>bestScore){bestScore=score;best=o;}}return best;}
  private ensureOperator(input:B277StepInput){let op=this.selectOperator(input);const createPressure=input.novelty01*.36+input.predictionError01*.28+(1-(op?.maturity01??0))*.16+input.autonomy01*.08;if(!op||createPressure>.62||this.state.operators.length<3){op=this.createOperator(input);}return op;}
  step(input:B277StepInput){
    this.state.ticks=input.tick; this.state.cycles++;
    const op=this.ensureOperator(input); const f=this.feature(input); const out=this.activate(op,f,input);
    const ctx=input.goalVector.slice(0,8);
    const scores=ACTIONS.map((a,i)=>{
      const base=op.actionDecoder[i]??0;
      const ctxGain=dot(op.contextDecoder[i]??[],ctx)/Math.max(1,ctx.length);
      const p=Number(input.personalityBias[a]??0);
      const recurrent=op.recurrent[i%op.recurrent.length]??0;
      const programPrior=input.programPrimitives?.includes(a)?.08:0;
      return {action:a,score:clamp01(.5+.16*base+.24*ctxGain+.12*p+.06*recurrent+.04*out.hidden[i%out.hidden.length]+programPrior)};
    }).sort((a,b)=>b.score-a.score);
    const selected=scores[0].action;
    op.firingRate01=clamp01(op.firingRate01*.88+out.rate*.12);
    op.homeostaticError01=clamp01(Math.abs(.22-op.firingRate01));
    op.predictionError01=input.predictionError01; op.novelty01=input.novelty01; op.usage++; op.lastUsedTick=input.tick;
    op.status=op.status==='germinal'?'plastic':op.status;
    this.state.activeOperatorId=op.id; this.state.lastAction=selected; this.state.lastOutput=out.hidden.slice();
    this.state.lastPredictedReward01=clamp01(.5+cosine(out.hidden,f.slice(0,12))*.25+op.reward01*.25);
    this.state.actionDecisions++;
    this.state.neuralSparsity01=clamp01(this.state.neuralSparsity01*.9+(1-out.rate)*.1);
    this.state.assemblyCoherence01=clamp01(this.state.assemblyCoherence01*.9+(.5+.5*cosine(out.hidden,input.neuralAssembly.slice(0,12)))*.1);
    this.state.homeostasis01=clamp01(this.state.homeostasis01*.9+(1-op.homeostaticError01)*.1);
    this.state.selfGrounding01=clamp01(this.state.selfGrounding01*.9+(.5+.5*cosine(out.hidden,input.selfLatent.slice(0,12)))*.1);
    this.state.autonomy01=clamp01(this.state.autonomy01*.9+input.autonomy01*.1);
    this.state.operatorNovelty01=clamp01(this.state.operatorNovelty01*.88+input.novelty01*.12);
    return {operatorId:op.id,selected,rankings:scores,output:out.hidden,predictedReward01:this.state.lastPredictedReward01,maturity01:op.maturity01,neuralSparsity01:this.state.neuralSparsity01,homeostasis01:this.state.homeostasis01};
  }
  learnFromOutcome(input:{tick:number;reward01:number;predictionError01:number;action:ActionKind;selfLatent:number[];neuralAssembly:number[];externalEvidence01:number;novelty01:number;contextVector?:number[]}){
    const op=this.state.operators.find(o=>o.id===this.state.activeOperatorId);
    if(!op)return {updated:false,maturity01:0};
    const f=input.selfLatent.slice(0,12); const target=clamp11((input.reward01-.5)*2);
    const local=clamp11(target-.25*clamp01(input.predictionError01));
    const lr=.035*(.55+.45*clamp01(input.externalEvidence01));
    for(let i=0;i<op.weights.length;i++)op.weights[i]=clamp11(op.weights[i]+lr*local*(f[i%f.length]??0));
    const ctx=(input.contextVector??input.selfLatent).slice(0,8);
    for(let i=0;i<op.actionDecoder.length;i++){
      const a=ACTIONS[i], sign=a===input.action?1:-.24;
      op.actionDecoder[i]=clamp11(op.actionDecoder[i]+lr*local*sign);
      for(let j=0;j<op.contextDecoder[i].length;j++)op.contextDecoder[i][j]=clamp11(op.contextDecoder[i][j]+lr*.95*local*(ctx[j]??0)*sign);
    }
    for(let i=0;i<op.dendriticGate.length;i++)op.dendriticGate[i]=clamp01(op.dendriticGate[i]+lr*.5*local);
    for(let i=0;i<op.recurrent.length;i++)op.recurrent[i]=clamp11(op.recurrent[i]+lr*.35*local*(op.recurrent[(i+1)%op.recurrent.length]??0));
    const gain=clamp01(.5+local*.5);
    op.reward01=clamp01(op.reward01*.86+input.reward01*.14); op.predictionError01=input.predictionError01;
    op.homeostaticError01=clamp01(Math.abs(.22-op.firingRate01));
    op.maturity01=clamp01(op.maturity01*.982+.024*gain+.016*(1-input.predictionError01));
    if(op.maturity01>.66&&gain>.53&&input.predictionError01<.65){if(op.status!=='verified')this.state.verifiedOperators++;op.status='verified';}
    if(gain<.36&&input.predictionError01>.72&&op.usage>12){op.status='rejected';this.state.rejectedOperators++;}
    this.state.learningUpdates++;
    return {updated:true,delta01:local,learningRate:lr,maturity01:op.maturity01,status:op.status};
  }
  transfer(input:{tick:number;operatorId:string;goalVector:number[];neuralAssembly:number[];independentGain01:number;robustness01:number}){const op=this.state.operators.find(o=>o.id===input.operatorId&&o.status==='verified');if(!op)return {success:false,gain01:0};const alignment=clamp01(.5+.5*cosine(op.weights.slice(0,8),input.goalVector.slice(0,8)));const neural=clamp01(.5+.5*cosine(op.weights.slice(0,12),input.neuralAssembly.slice(0,12)));const gain=clamp01(.46+.24*input.independentGain01+.16*alignment+.1*neural)*input.robustness01;const success=gain>.58&&input.robustness01>.54;if(success){op.transferCount++;this.state.transfers++;}return {success,gain01:gain,alignment01:alignment,neural01:neural};}
  actionBias(action:ActionKind){const op=this.state.operators.find(o=>o.id===this.state.activeOperatorId&&['plastic','verified'].includes(o.status));if(!op)return 0;const idx=ACTIONS.indexOf(action);return clamp11((op.actionDecoder[idx]??0)*.025+(op.maturity01-.5)*.012);}
  diagnostics(){
    return {
      version:1,ticks:this.state.ticks,cycles:this.state.cycles,
      operatorGenerations:this.state.operatorGenerations,verifiedOperators:this.state.verifiedOperators,
      rejectedOperators:this.state.rejectedOperators,transfers:this.state.transfers,
      actionDecisions:this.state.actionDecisions,learningUpdates:this.state.learningUpdates,
      neuralSparsity01:this.state.neuralSparsity01,assemblyCoherence01:this.state.assemblyCoherence01,
      homeostasis01:this.state.homeostasis01,selfGrounding01:this.state.selfGrounding01,
      autonomy01:this.state.autonomy01,operatorNovelty01:this.state.operatorNovelty01,
      activeOperatorId:this.state.activeOperatorId,lastAction:this.state.lastAction,
      lastPredictedReward01:this.state.lastPredictedReward01,
      operators:this.state.operators.filter(o=>o.status==='verified').map(o=>({
        id:o.id,maturity01:o.maturity01,transferCount:o.transferCount,usage:o.usage,
      })),
    };
  }
}
function B277Default():B277State{return {
  version:1,ticks:0,cycles:0,operatorGenerations:0,verifiedOperators:0,rejectedOperators:0,
  transfers:0,actionDecisions:0,learningUpdates:0,neuralSparsity01:.78,assemblyCoherence01:.5,
  homeostasis01:.76,selfGrounding01:.5,autonomy01:.45,operatorNovelty01:.2,activeOperatorId:null,lastAction:null,
  lastPredictedReward01:.5,lastOutput:Array(12).fill(0),operators:[],
};}
