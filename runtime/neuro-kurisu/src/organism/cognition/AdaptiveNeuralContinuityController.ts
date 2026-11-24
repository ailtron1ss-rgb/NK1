import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp = (x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const tanh = (x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const sigmoid = (x:number)=>1/(1+Math.exp(-Math.max(-8,Math.min(8,x))));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const deep=<T>(x:T):T=>structuredClone(x);

export type MemoryOperation='add'|'update'|'retrieve'|'delete'|'noop';

export interface AdaptiveMemoryRecord {
  id:string;
  key:number[];
  value:number[];
  strength01:number;
  utility01:number;
  novelty01:number;
  confidence01:number;
  protected01:number;
  contradiction01:number;
  retrievals:number;
  lastTick:number;
  createdTick:number;
  action:ActionKind|null;
  provenance:string;
}

export interface ContinuityHistoryFrame {
  tick:number;
  latent:number[];
  action:ActionKind|null;
  reward01:number;
}

export interface AdaptiveNeuralContinuityState {
  version:1;
  tick:number;
  operations:number;
  memoryAdds:number;
  memoryUpdates:number;
  memoryRetrieves:number;
  memoryDeletes:number;
  memoryNoops:number;
  memoryHits:number;
  memoryCapacity:number;
  memoryBank:AdaptiveMemoryRecord[];
  operationNames:MemoryOperation[];
  operationWeights:number[][];
  lastOperation:MemoryOperation;
  lastMemoryId:string|null;
  lastRetrievalUtility01:number;
  antiForgetting01:number;
  anchorDrift01:number;
  consolidationDebt01:number;
  consolidationCycles:number;
  consolidationMerges:number;
  horizonErrors:number[];
  horizonCounts:number[];
  horizonConfidence01:number[];
  horizonWeights:number[][][];
  horizonBias:number[][];
  history:ContinuityHistoryFrame[];
  computeBudget01:number;
  neuralDepth01:number;
  replayBudget:number;
  sleepBudget:number;
  memoryBudget:number;
  stabilityGate01:number;
  epistemicValue01:number;
  disagreement01:number;
  lastForecast:number[];
  lastFeatures:number[];
  lastActionIndex:number;
  anchorSignature:number[];
  anchorBaseline:number[];
  learnedPolicyUpdates:number;
  antiForgetEvents:number;
}

const OPS:MemoryOperation[]=['add','update','retrieve','delete','noop'];
const OP_COUNT=OPS.length;
const FEAT=10;
const LATENT=8;
const HORIZONS=[1,2,4];
const makeWeights=(rows:number,cols:number,scale=.08)=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>Math.sin((r+1)*17+(c+1)*31)*scale));
const zero2=(r:number,c:number)=>Array.from({length:r},()=>new Array(c).fill(0));
const zero3=(a:number,b:number,c:number)=>Array.from({length:a},()=>zero2(b,c));

export const defaultAdaptiveNeuralContinuity=():AdaptiveNeuralContinuityState=>({
  version:1,tick:0,operations:0,memoryAdds:0,memoryUpdates:0,memoryRetrieves:0,memoryDeletes:0,memoryNoops:0,memoryHits:0,
  memoryCapacity:48,memoryBank:[],operationNames:OPS.slice(),operationWeights:makeWeights(OP_COUNT,FEAT,.06),lastOperation:'noop',lastMemoryId:null,lastRetrievalUtility01:0,
  antiForgetting01:.8,anchorDrift01:0,consolidationDebt01:0,consolidationCycles:0,consolidationMerges:0,
  horizonErrors:[0,0,0],horizonCounts:[0,0,0],horizonConfidence01:[.5,.5,.5],horizonWeights:zero3(HORIZONS.length,LATENT,LATENT),horizonBias:zero2(HORIZONS.length,LATENT),history:[],
  computeBudget01:1,neuralDepth01:1,replayBudget:8,sleepBudget:0,memoryBudget:4,stabilityGate01:1,epistemicValue01:.5,disagreement01:0,lastForecast:new Array(LATENT).fill(0),lastFeatures:new Array(FEAT).fill(0),lastActionIndex:0,
  anchorSignature:new Array(LATENT).fill(0),anchorBaseline:new Array(LATENT).fill(0),learnedPolicyUpdates:0,antiForgetEvents:0,
});

export class AdaptiveNeuralContinuityController {
  private state=defaultAdaptiveNeuralContinuity();
  snapshot(){return deep(this.state);}
  restore(raw?:Partial<AdaptiveNeuralContinuityState>|null){
    const d=defaultAdaptiveNeuralContinuity(),r:any=raw??{};
    const arr=(v:any,n:number,f=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(f)).slice(0,n):new Array(n).fill(f);
    const mat=(v:any,rows:number,cols:number,f=0)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>arr(v[i],cols,f)):zero2(rows,cols).map(row=>row.fill(f));
    const tensor=(v:any,a:number,b:number,c:number)=>Array.isArray(v)?Array.from({length:a},(_,i)=>Array.from({length:b},(_,j)=>arr(v[i]?.[j],c))):zero3(a,b,c);
    this.state={...d,...deep(r),version:1,operationWeights:mat(r.operationWeights,OP_COUNT,FEAT),horizonWeights:tensor(r.horizonWeights,HORIZONS.length,LATENT,LATENT),horizonBias:mat(r.horizonBias,HORIZONS.length,LATENT),horizonErrors:arr(r.horizonErrors,HORIZONS.length),horizonCounts:arr(r.horizonCounts,HORIZONS.length),horizonConfidence01:arr(r.horizonConfidence01,HORIZONS.length,.5),history:Array.isArray(r.history)?r.history.slice(-32):[],memoryBank:Array.isArray(r.memoryBank)?r.memoryBank.slice(-d.memoryCapacity):[],anchorSignature:arr(r.anchorSignature,LATENT),anchorBaseline:arr(r.anchorBaseline,LATENT),lastFeatures:arr(r.lastFeatures,FEAT),lastForecast:arr(r.lastForecast,LATENT),
      computeBudget01:clamp(Number(r.computeBudget01??1)),neuralDepth01:clamp(Number(r.neuralDepth01??1)),replayBudget:Math.max(1,Math.min(32,Math.floor(Number(r.replayBudget??8)))),sleepBudget:Math.max(0,Math.min(16,Math.floor(Number(r.sleepBudget??0)))),memoryBudget:Math.max(1,Math.min(8,Math.floor(Number(r.memoryBudget??4)))),stabilityGate01:clamp(Number(r.stabilityGate01??1)),epistemicValue01:clamp(Number(r.epistemicValue01??.5)),disagreement01:clamp(Number(r.disagreement01??0)),lastActionIndex:Math.max(0,Math.min(ACTIONS.length-1,Math.floor(Number(r.lastActionIndex??0))))};
    this.state.memoryCapacity=48;
  }

  private features(input:number[],signals:{novelty01:number;uncertainty01:number;predictionError01:number;goalPressure01:number;homeostasis01?:number;identityGap01:number;reward01:number;thermal01?:number;energy01?:number;load01?:number}){
    const mean=input.reduce((a,b)=>a+b,0)/Math.max(1,input.length);
    const abs=input.reduce((a,b)=>a+Math.abs(b),0)/Math.max(1,input.length);
    return [1,clamp(mean*.5+.5),clamp(abs),clamp(signals.novelty01),clamp(signals.uncertainty01),clamp(signals.predictionError01),clamp(signals.goalPressure01),clamp(signals.identityGap01),clamp(signals.reward01),clamp((signals.thermal01??.2)*.45+(signals.load01??.3)*.35+(1-(signals.energy01??.8))*.20)];
  }

  private forecast(latent:number[],action:ActionKind|null){
    const a=action?Math.max(0,ACTIONS.indexOf(action)):0;
    const next:number[][]=[];
    for(let h=0;h<HORIZONS.length;h++){
      const row=this.state.horizonWeights[h]!;const b=this.state.horizonBias[h]!;const x=latent.slice(0,LATENT);
      const y=new Array(LATENT).fill(0);
      for(let i=0;i<LATENT;i++){let s=b[i]??0;for(let j=0;j<LATENT;j++)s+=(row[i]?.[j]??0)*(x[j]??0);s+=Math.sin((a+1)*(i+1)*(h+1))*.004;y[i]=tanh(s);}
      next.push(y);
    }
    const avg=new Array(LATENT).fill(0);for(const y of next)for(let i=0;i<LATENT;i++)avg[i]+=y[i]/next.length;
    let disagreement=0;for(const y of next)for(let i=0;i<LATENT;i++)disagreement+=Math.abs(y[i]-avg[i]);
    disagreement=clamp(disagreement/(HORIZONS.length*LATENT*2));
    this.state.disagreement01=disagreement;this.state.lastForecast=avg;
    const confidence=clamp(.92-disagreement*.9-.15*Math.min(...this.state.horizonConfidence01));
    this.state.epistemicValue01=clamp(.5+disagreement*.45+(1-confidence)*.2);
    return {next,avg,disagreement,confidence};
  }

  beforeDecision(input:number[],latent:number[],signals:{novelty01:number;uncertainty01:number;predictionError01:number;goalPressure01:number;homeostasis01?:number;identityGap01:number;reward01:number;thermal01?:number;energy01?:number;load01?:number},actionHint:ActionKind|null){
    const f=this.features(input,signals);this.state.lastFeatures=f;
    const forecast=this.forecast(latent,actionHint);
    const urgency=clamp(signals.novelty01*.26+signals.uncertainty01*.24+signals.predictionError01*.22+signals.goalPressure01*.14+(1-(signals.homeostasis01??.5))*.08+this.state.disagreement01*.06);
    const resourcePenalty=clamp((signals.thermal01??.2)*.35+(signals.load01??.3)*.35+(1-(signals.energy01??.8))*.30);
    this.state.computeBudget01=clamp(.55+urgency*.65-resourcePenalty*.45);
    this.state.neuralDepth01=clamp(.58+this.state.computeBudget01*.42);
    this.state.replayBudget=Math.max(1,Math.min(24,Math.floor(3+this.state.computeBudget01*15+this.state.disagreement01*5)));
    const idleWindow=(this.state.operations%16===0 && urgency<.36 && resourcePenalty<.48)||(this.state.operations%64===0&&this.state.disagreement01<.18);
    this.state.sleepBudget=idleWindow?Math.max(1,Math.min(8,Math.floor(2+(1-resourcePenalty)*4))):0;
    this.state.memoryBudget=Math.max(1,Math.min(6,Math.floor(2+urgency*4)));

    const scores=this.state.operationWeights.map((w)=>w.reduce((s,x,i)=>s+x*f[i]!,0));
    // Learned memory operation policy; deterministic exploration on high epistemic value.
    let opIndex=scores.indexOf(Math.max(...scores));
    const exploration=((this.state.operations*1103515245+12345)>>>0)/4294967296;
    if(exploration<.08){opIndex=(this.state.operations+Math.floor(signals.novelty01*10))%OP_COUNT;}
    if(this.state.memoryBank.length<8 && signals.novelty01>.38){opIndex=0;}
    if(this.state.epistemicValue01>.78 && signals.novelty01>.55){opIndex=exploration<.45?0:2;}
    const op=OPS[Math.max(0,opIndex)]!;
    this.state.lastOperation=op;this.state.operations++;
    const retrieved=this.retrieve(latent,this.state.memoryBudget);
    this.state.lastRetrievalUtility01=retrieved.length?retrieved[0]!.utility01:0;
    if(op==='retrieve')this.state.memoryRetrieves++; else if(op==='add')this.state.memoryAdds++; else if(op==='update')this.state.memoryUpdates++; else if(op==='delete')this.state.memoryDeletes++; else this.state.memoryNoops++;
    this.state.tick++;
    return {operation:op,retrieved,forecast,computeBudget01:this.state.computeBudget01,neuralDepth01:this.state.neuralDepth01,replayBudget:this.state.replayBudget,sleepBudget:this.state.sleepBudget,memoryBudget:this.state.memoryBudget,epistemicValue01:this.state.epistemicValue01,disagreement01:this.state.disagreement01,stabilityGate01:this.state.stabilityGate01};
  }

  applyMemoryCredit(id:string, credit01:number){
    const m=this.state.memoryBank.find(x=>x.id===id);
    if(!m)return false;
    const c=clamp(Number(credit01),-1,1);
    if(c>=0){m.utility01=clamp(m.utility01*.9+c*.1);m.strength01=clamp(m.strength01*.94+c*.06);m.confidence01=clamp(m.confidence01*.96+c*.04);}
    else {const pressure=Math.abs(c);m.contradiction01=clamp(m.contradiction01*.88+pressure*.12);m.utility01=clamp(m.utility01*.96-pressure*.08);}
    return true;
  }

  commitAction(action:ActionKind){this.state.lastActionIndex=Math.max(0,ACTIONS.indexOf(action));}

  private cosine(a:number[],b:number[]){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]!*b[i]!;aa+=a[i]!**2;bb+=b[i]!**2;}return dot/(Math.sqrt(aa*bb)+1e-9);}
  private retrieve(key:number[],limit:number){
    const scored=this.state.memoryBank.map(m=>({m,score:.58*this.cosine(key,m.key)+.24*m.utility01+.12*m.strength01+.06*m.protected01})).sort((a,b)=>b.score-a.score).slice(0,limit);
    for(const row of scored){row.m.retrievals++;row.m.lastTick=this.state.tick;}
    this.state.memoryHits+=scored.length?1:0;
    return scored.filter(x=>x.score>.24).map(x=>deep(x.m));
  }

  private makeKey(latent:number[],input:number[]){const out=new Array(LATENT).fill(0);for(let i=0;i<LATENT;i++){out[i]=tanh((latent[i]??0)*.72+(input[i%Math.max(1,input.length)]??0)*.18+Math.sin((i+1)*input.length)*.02);}return out;}

  afterOutcome(args:{tick:number;input:number[];latent:number[];nextLatent:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;novelty01:number;uncertainty01:number;goalPressure01:number;identityGap01:number;homeostasis01?:number}){
    const f=this.state.lastFeatures.length===FEAT?this.state.lastFeatures:this.features(args.input,args);
    const reward=clamp(args.reward01),adv=(reward-.5)+(.5-clamp(args.predictionError01))*0.35;
    const chosen=Math.max(0,OPS.indexOf(this.state.lastOperation));
    for(let i=0;i<OP_COUNT;i++){const selected=i===chosen?1:-0.25;for(let j=0;j<FEAT;j++)this.state.operationWeights[i]![j]=clamp((this.state.operationWeights[i]?.[j]??0)+f[j]!*adv*.004*selected,-.8,.8);}
    this.state.learnedPolicyUpdates++;

    // Multi-horizon supervised online learning. Each newly observed frame trains the model
    // against the state that occurred 1/2/4 ticks later, with bounded SGD.
    const current:ContinuityHistoryFrame={tick:args.tick,latent:args.nextLatent.slice(0,LATENT).map(Number),action:args.action,reward01:reward};
    for(let h=0;h<HORIZONS.length;h++){
      const horizon=HORIZONS[h]!;const source=this.state.history[this.state.history.length-1-(horizon-1)];
      if(!source)continue;
      const x=source.latent.slice(0,LATENT);const target=current.latent;const weights=this.state.horizonWeights[h]!;const bias=this.state.horizonBias[h]!;
      let errAbs=0;
      for(let i=0;i<LATENT;i++){
        let pred=bias[i]??0;for(let j=0;j<LATENT;j++)pred+=(weights[i]?.[j]??0)*(x[j]??0);pred=tanh(pred);
        const err=clamp(target[i]??0,-1,1)-pred;errAbs+=Math.abs(err);
        const eta=.012*(.4+.6*this.state.computeBudget01)*(args.verified01>.5?1.25:.8);
        for(let j=0;j<LATENT;j++)weights[i]![j]=clamp(weights[i]![j]!+eta*err*(x[j]??0),-1,1);
        bias[i]=clamp((bias[i]??0)+eta*err*.45,-.75,.75);
      }
      const meanErr=errAbs/LATENT;this.state.horizonErrors[h]=finite(this.state.horizonErrors[h])*.92+meanErr*.08;this.state.horizonCounts[h]=(this.state.horizonCounts[h]??0)+1;this.state.horizonConfidence01[h]=clamp(.93-this.state.horizonErrors[h]*1.7);
    }
    this.state.history.push(current);if(this.state.history.length>32)this.state.history.shift();

    const key=this.makeKey(args.latent,args.input);const novelty=clamp(args.novelty01);const utility=clamp(.42+adv*.35+args.goalPressure01*.15+args.identityGap01*.08);const confidence=clamp(1-args.predictionError01*.8);
    const existing=this.state.memoryBank.map(m=>({m,sim:this.cosine(key,m.key)})).sort((a,b)=>b.sim-a.sim)[0];
    const op=this.state.lastOperation;
    if(op==='add' && (!existing || existing.sim<.92) && novelty>.20){
      const m:AdaptiveMemoryRecord={id:`m${args.tick}-${this.state.operations}`,key,value:args.nextLatent.slice(0,16),strength01:.35+utility*.3,utility01:utility,novelty01:novelty,confidence01:confidence,protected01:clamp(.25+utility*.45+args.identityGap01*.25),contradiction01:0,retrievals:0,lastTick:args.tick,createdTick:args.tick,action:args.action,provenance:`neural-continuity@${args.tick}`};
      this.state.memoryBank.push(m);if(this.state.memoryBank.length>this.state.memoryCapacity)this.evictOne();
    } else if(op==='update' && existing){
      existing.m.value=existing.m.value.map((v,i)=>clamp(v*.72+(args.nextLatent[i]??v)*.28,-1,1));existing.m.utility01=clamp(existing.m.utility01*.86+utility*.14);existing.m.confidence01=clamp(existing.m.confidence01*.9+confidence*.1);existing.m.strength01=clamp(existing.m.strength01*.9+.1);existing.m.action=args.action;existing.m.lastTick=args.tick;
    } else if(op==='delete' && existing && existing.m.protected01<.72){this.state.memoryBank=this.state.memoryBank.filter(m=>m.id!==existing.m.id);}
    else if(op==='retrieve' && existing){existing.m.strength01=clamp(existing.m.strength01*.95+.05);existing.m.utility01=clamp(existing.m.utility01*.93+utility*.07);}

    // Contradiction/retention sentinel: a stable anchor is kept from the most useful memories.
    const anchor=this.state.memoryBank.filter(m=>m.protected01>.7).sort((a,b)=>(b.utility01+b.strength01)-(a.utility01+a.strength01)).slice(0,4);
    const signature=new Array(LATENT).fill(0);for(const m of anchor)for(let i=0;i<LATENT;i++)signature[i]+=(m.key[i]??0)/Math.max(1,anchor.length);
    const baseline=this.state.anchorBaseline;let drift=0;for(let i=0;i<LATENT;i++)drift+=Math.abs(signature[i]-baseline[i]);this.state.anchorDrift01=clamp(drift/LATENT*1.8);
    if(anchor.length && baseline.every((x)=>Math.abs(x)<1e-9)){this.state.anchorBaseline=signature.slice();}
    else if(this.state.anchorDrift01>.32){this.state.antiForgetEvents++;this.state.consolidationDebt01=clamp(this.state.consolidationDebt01+.18);}
    this.state.antiForgetting01=clamp(.96-this.state.anchorDrift01*.75-this.state.consolidationDebt01*.2);
    this.state.stabilityGate01=clamp(.45+this.state.antiForgetting01*.55);
    this.state.anchorSignature=signature;
    this.state.consolidationDebt01=clamp(this.state.consolidationDebt01+.015*(novelty>0.5?1:0)-.01*(args.verified01>.5?1:0));
    this.state.tick=args.tick;
    if(this.state.sleepBudget>0)this.sleep(this.state.sleepBudget);
  }

  private evictOne(){
    if(!this.state.memoryBank.length)return;
    let worst=0;let worstScore=Infinity;
    this.state.memoryBank.forEach((m,i)=>{const score=m.protected01*.5+m.utility01*.25+m.strength01*.15+m.confidence01*.1-m.contradiction01*.3;if(score<worstScore){worstScore=score;worst=i;}});
    this.state.memoryBank.splice(worst,1);
  }

  sleep(budget=this.state.sleepBudget){
    const n=Math.max(0,Math.min(16,Math.floor(budget)));if(!n)return 0;let merges=0;
    const sorted=this.state.memoryBank.slice().sort((a,b)=>(b.utility01+b.protected01+b.strength01)-(a.utility01+a.protected01+a.strength01));
    for(let i=0;i<Math.min(n,sorted.length);i++){
      const m=sorted[i]!;m.strength01=clamp(m.strength01+.012);m.confidence01=clamp(m.confidence01+.006);if(m.protected01>.74)m.protected01=clamp(m.protected01+.004);
      if(m.contradiction01>.5)m.contradiction01*=.94;merges++;
    }
    if(sorted.length>4){for(let i=0;i<Math.min(n,sorted.length-1);i++){const a=sorted[i]!,b=sorted[i+1]!;const sim=this.cosine(a.key,b.key);if(sim>.97 && b.protected01<.65 && a.utility01>=b.utility01){a.strength01=clamp(a.strength01+b.strength01*.04);this.state.memoryBank=this.state.memoryBank.filter(m=>m.id!==b.id);this.state.consolidationMerges++;}}}
    this.state.consolidationDebt01=clamp(this.state.consolidationDebt01-.025*n);this.state.consolidationCycles++;return merges;
  }

  metrics(){
    return {
      memoryCount:this.state.memoryBank.length, memoryHits:this.state.memoryHits, lastOperation:this.state.lastOperation,
      consolidationCycles:this.state.consolidationCycles, consolidationMerges:this.state.consolidationMerges,
      antiForgetting01:this.state.antiForgetting01, anchorDrift01:this.state.anchorDrift01,
      consolidationDebt01:this.state.consolidationDebt01, horizonErrors:this.state.horizonErrors.slice(),
      horizonConfidence01:this.state.horizonConfidence01.slice(), computeBudget01:this.state.computeBudget01,
      neuralDepth01:this.state.neuralDepth01, replayBudget:this.state.replayBudget, sleepBudget:this.state.sleepBudget,
      memoryBudget:this.state.memoryBudget, stabilityGate01:this.state.stabilityGate01, epistemicValue01:this.state.epistemicValue01,
      disagreement01:this.state.disagreement01, learnedPolicyUpdates:this.state.learnedPolicyUpdates, antiForgetEvents:this.state.antiForgetEvents
    };
  }
  diagnostics(){return deep(this.state);}
}
