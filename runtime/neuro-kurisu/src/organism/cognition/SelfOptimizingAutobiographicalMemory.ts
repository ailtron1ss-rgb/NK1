import type { ActionKind } from '../core/types.ts';
import { cosineSimilarity as cosine } from '../core/NumericPrimitives.ts';
const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const STRATEGIES = ['retrieve','verify','simulate','abstain','explore','reflect','compress'] as const;
type StrategyKind = typeof STRATEGIES[number];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const vec=(v:unknown,n:number):number[]=>Array.isArray(v)?Array.from({length:n},(_,i)=>finN((v as unknown[])[i],0)):[];
const actOrNull=(v:unknown):ActionKind|null=>ACTIONS.includes(v as ActionKind)?v as ActionKind:null;
const sanRecord=(x:unknown):AutobiographicalMemoryRecord|null=>{if(!x||typeof x!=='object')return null;const m=x as Record<string,unknown>;const tick=cnt(m.tick,0);const id=typeof m.id==='string'&&m.id?m.id.slice(0,160):`memory:${tick}`;return {id,tick,context:vec(m.context,24),identityVector:vec(m.identityVector,24),goalPressure01:C01(m.goalPressure01,.5),identityGap01:C01(m.identityGap01,.5),novelty01:C01(m.novelty01,.2),uncertainty01:C01(m.uncertainty01,.3),reward01:C01(m.reward01,.5),predictionError01:C01(m.predictionError01,.5),verified01:C01(m.verified01,0),action:actOrNull(m.action),causalImportance01:C01(m.causalImportance01,.5),reliability01:C01(m.reliability01,.5),utility01:C01(m.utility01,.5),retrievals:cnt(m.retrievals,0),writes:Math.max(1,cnt(m.writes,1)),ageTicks:cnt(m.ageTicks,0),retention01:C01(m.retention01,.7),lastUsedTick:cnt(m.lastUsedTick,0),contradiction01:C01(m.contradiction01,0)};};

const cosine01=(a:number[],b:number[])=>clamp((cosine(a,b)+1)*.5);
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:.5;

export interface AutobiographicalMemoryRecord {
  id:string;
  tick:number;
  context:number[];
  identityVector:number[];
  goalPressure01:number;
  identityGap01:number;
  novelty01:number;
  uncertainty01:number;
  reward01:number;
  predictionError01:number;
  verified01:number;
  action:ActionKind|null;
  causalImportance01:number;
  reliability01:number;
  utility01:number;
  retrievals:number;
  writes:number;
  ageTicks:number;
  retention01:number;
  lastUsedTick:number;
  contradiction01:number;
}

export interface SelfOptimizingAutobiographicalMemoryState {
  version:1;
  tick:number;
  decisions:number;
  writes:number;
  recalls:number;
  consolidations:number;
  forgets:number;
  contradictions:number;
  strategyUpdates:number;
  liveRedirects:number;
  holdoutEvaluations:number;
  holdoutSuccesses:number;
  memoryUtility01:number;
  retrievalQuality01:number;
  retention01:number;
  identityWeightedRecall01:number;
  autobiographicalContinuity01:number;
  strategyLearning01:number;
  liveImprovement01:number;
  contradictionControl01:number;
  writeSelectivity01:number;
  selectedStrategy:StrategyKind;
  selectedMemoryId:string|null;
  selectedMemoryUtility01:number;
  selectedRecallConfidence01:number;
  selectedWriteGate01:number;
  selectedRedirect:ActionKind|null;
  armCounts:number[];
  armValues:number[];
  memories:AutobiographicalMemoryRecord[];
}

const defaultState=():SelfOptimizingAutobiographicalMemoryState=>({
  version:1,tick:0,decisions:0,writes:0,recalls:0,consolidations:0,forgets:0,contradictions:0,strategyUpdates:0,liveRedirects:0,holdoutEvaluations:0,holdoutSuccesses:0,
  memoryUtility01:.5,retrievalQuality01:.5,retention01:.7,identityWeightedRecall01:.5,autobiographicalContinuity01:.5,strategyLearning01:.5,liveImprovement01:.5,contradictionControl01:.7,writeSelectivity01:.55,
  selectedStrategy:'retrieve',selectedMemoryId:null,selectedMemoryUtility01:.5,selectedRecallConfidence01:.5,selectedWriteGate01:0,selectedRedirect:null,
  armCounts:new Array(STRATEGIES.length).fill(0),armValues:new Array(STRATEGIES.length).fill(.5),memories:[]
});

export interface BeforeMemoryArgs {
  tick:number;
  context:number[];
  identityVector?:number[];
  goalPressure01:number;
  identityGap01:number;
  novelty01:number;
  uncertainty01:number;
  predictionError01:number;
  reward01?:number;
  computeBudget01:number;
}

export interface BeforeMemoryResult {
  actionBias:Record<ActionKind,number>;
  selectedStrategy:StrategyKind;
  selectedMemoryId:string|null;
  selectedRecallConfidence01:number;
  memoryUtility01:number;
  writeGate01:number;
  redirectAction:ActionKind|null;
  liveImprovement01:number;
}

export class SelfOptimizingAutobiographicalMemory{
  private state=defaultState();
  readonly maxMemories=96;

  snapshot(){return deep(this.state);}
  restore(raw?:Partial<SelfOptimizingAutobiographicalMemoryState>|null){
    const d=defaultState();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const acRaw=read('armCounts'),avRaw=read('armValues');
    const armCounts=Array.from({length:STRATEGIES.length},(_,i)=>cnt(Array.isArray(acRaw)?(acRaw as unknown[])[i]:d.armCounts[i],0));
    const armValues=Array.from({length:STRATEGIES.length},(_,i)=>C01(Array.isArray(avRaw)?(avRaw as unknown[])[i]:d.armValues[i],.5));
    const memRaw=read('memories');
    const memories=Array.isArray(memRaw)?memRaw.slice(-this.maxMemories).map(sanRecord).filter((x):x is AutobiographicalMemoryRecord=>x!==null):[];
    const strat=read('selectedStrategy');
    const selId=read('selectedMemoryId');
    this.state={version:1,tick:cnt(read('tick'),d.tick),decisions:cnt(read('decisions'),d.decisions),writes:cnt(read('writes'),d.writes),recalls:cnt(read('recalls'),d.recalls),consolidations:cnt(read('consolidations'),d.consolidations),forgets:cnt(read('forgets'),d.forgets),contradictions:cnt(read('contradictions'),d.contradictions),strategyUpdates:cnt(read('strategyUpdates'),d.strategyUpdates),liveRedirects:cnt(read('liveRedirects'),d.liveRedirects),holdoutEvaluations:cnt(read('holdoutEvaluations'),d.holdoutEvaluations),holdoutSuccesses:cnt(read('holdoutSuccesses'),d.holdoutSuccesses),
      memoryUtility01:C01(read('memoryUtility01'),d.memoryUtility01),retrievalQuality01:C01(read('retrievalQuality01'),d.retrievalQuality01),retention01:C01(read('retention01'),d.retention01),identityWeightedRecall01:C01(read('identityWeightedRecall01'),d.identityWeightedRecall01),autobiographicalContinuity01:C01(read('autobiographicalContinuity01'),d.autobiographicalContinuity01),strategyLearning01:C01(read('strategyLearning01'),d.strategyLearning01),liveImprovement01:C01(read('liveImprovement01'),d.liveImprovement01),contradictionControl01:C01(read('contradictionControl01'),d.contradictionControl01),writeSelectivity01:C01(read('writeSelectivity01'),d.writeSelectivity01),
      selectedStrategy:STRATEGIES.includes(strat as StrategyKind)?strat as StrategyKind:d.selectedStrategy,selectedMemoryId:typeof selId==='string'&&selId?selId.slice(0,160):null,selectedMemoryUtility01:C01(read('selectedMemoryUtility01'),d.selectedMemoryUtility01),selectedRecallConfidence01:C01(read('selectedRecallConfidence01'),d.selectedRecallConfidence01),selectedWriteGate01:C01(read('selectedWriteGate01'),d.selectedWriteGate01),selectedRedirect:actOrNull(read('selectedRedirect')),
      armCounts,armValues,memories};
  }

  private strategyIndex(s:StrategyKind){return STRATEGIES.indexOf(s);}
  private chooseStrategy(args:BeforeMemoryArgs){
    const pressure=clamp(args.predictionError01*.42+args.uncertainty01*.26+args.novelty01*.14+(1-args.computeBudget01)*.10+args.identityGap01*.08);
    const scores=STRATEGIES.map((s,i)=>{
      const value=this.state.armValues[i]??.5,count=this.state.armCounts[i]??0;
      const explore=Math.sqrt(Math.log(this.state.decisions+2)/(count+1));
      let prior=0;
      if(s==='retrieve')prior=.10*(1-args.novelty01);
      if(s==='verify')prior=.13*args.uncertainty01;
      if(s==='simulate')prior=.12*args.predictionError01*args.computeBudget01;
      if(s==='abstain')prior=.15*pressure*(1-args.computeBudget01*.4);
      if(s==='explore')prior=.12*args.novelty01;
      if(s==='reflect')prior=.11*args.identityGap01;
      if(s==='compress')prior=.09*(1-this.state.writeSelectivity01);
      return value+explore*.08+prior;
    });
    let best=0;for(let i=1;i<scores.length;i++)if(scores[i]!>scores[best]!)best=i;
    return STRATEGIES[best]!;
  }

  private scoreMemory(m:AutobiographicalMemoryRecord,args:BeforeMemoryArgs){
    const contextMatch=cosine01(m.context,args.context.slice(0,24));
    const identityMatch=args.identityVector?.length&&m.identityVector.length?cosine01(m.identityVector,args.identityVector.slice(0,24)):.5;
    const goalMatch=clamp(1-Math.abs(m.goalPressure01-args.goalPressure01));
    const reliability=m.reliability01;
    const noveltyFit=clamp(1-Math.abs(m.novelty01-args.novelty01));
    const recency=Math.exp(-Math.min(8,Math.max(0,args.tick-m.lastUsedTick))/160);
    const contradictionPenalty=m.contradiction01*.75;
    const utility=clamp(contextMatch*.28+identityMatch*.18+goalMatch*.12+reliability*.16+m.causalImportance01*.10+m.reward01*.06+noveltyFit*.04+recency*.06-contradictionPenalty);
    return {utility,contextMatch,identityMatch,reliability};
  }

  beforeDecision(args:BeforeMemoryArgs):BeforeMemoryResult{
    this.state.tick=args.tick; this.state.decisions++; this.state.selectedRedirect=null;
    const selectedStrategy=this.chooseStrategy(args); const idx=this.strategyIndex(selectedStrategy); this.state.selectedStrategy=selectedStrategy;
    const ranked=this.state.memories.map(m=>({m,q:this.scoreMemory(m,args)})).sort((a,b)=>b.q.utility-a.q.utility);
    const top=ranked[0];
    const recallAllowed=selectedStrategy!=='abstain'&&!!top&&(top.q.utility>.42);
    let selectedMemoryId:string|null=recallAllowed?top!.m.id:null;
    let recallConfidence=recallAllowed?clamp(top!.q.utility*(.65+.35*(1-args.uncertainty01))):0;
    if(recallAllowed){top!.m.retrievals++;top!.m.lastUsedTick=args.tick;this.state.recalls++;}
    const pressure=clamp(args.predictionError01*.42+args.uncertainty01*.26+args.novelty01*.14+(1-args.computeBudget01)*.10+args.identityGap01*.08);
    const writeGate=clamp(.18+pressure*.38+(1-recallConfidence)*.18+args.goalPressure01*.12+args.identityGap01*.08+args.novelty01*.06-(selectedStrategy==='compress'?.10:0));
    const redirectNeeded=(args.predictionError01>.72||args.uncertainty01>.82)&&pressure>.60;
    let redirect:ActionKind|null=null;
    if(redirectNeeded){
      redirect=selectedStrategy==='verify'?'verify':selectedStrategy==='explore'?'explore':selectedStrategy==='reflect'?'reflect':selectedStrategy==='abstain'?'defer':args.uncertainty01>.72?'verify':'reflect';
      this.state.liveRedirects++; this.state.selectedRedirect=redirect;
    }
    const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
    if(recallAllowed){bias.reflect += Math.max(0,(top!.q.utility-.55))*.025;bias.respond += Math.max(0,(top!.q.identityMatch-.55))*.018;}
    if(selectedStrategy==='verify')bias.verify += .028*args.uncertainty01;
    if(selectedStrategy==='explore')bias.explore += .024*args.novelty01;
    if(selectedStrategy==='reflect')bias.reflect += .025*args.identityGap01;
    if(selectedStrategy==='abstain')bias.defer += .035*pressure;
    if(selectedStrategy==='simulate'&&args.computeBudget01>.55){bias.verify += .014;bias.explore += .010;}
    if(selectedStrategy==='compress')bias.reflect += .012;
    if(redirect)bias[redirect]=clamp(bias[redirect]+.045,-.065,.065);
    this.state.selectedMemoryId=selectedMemoryId;this.state.selectedMemoryUtility01=top?.q.utility??0;this.state.selectedRecallConfidence01=recallConfidence;this.state.selectedWriteGate01=writeGate;
    this.state.memoryUtility01=clamp(this.state.memoryUtility01*.96+(top?.q.utility??.5)*.04);
    this.state.retrievalQuality01=clamp(this.state.retrievalQuality01*.96+recallConfidence*.04);
    this.state.identityWeightedRecall01=clamp(this.state.identityWeightedRecall01*.96+(top?.q.identityMatch??.5)*.04);
    this.state.liveImprovement01=clamp(this.state.liveImprovement01*.95+(redirect?Math.min(1,pressure+.18):.35)*.05);
    this.state.writeSelectivity01=clamp(this.state.writeSelectivity01*.97+(1-writeGate)*.03);
    this.state.armCounts[idx]=(this.state.armCounts[idx]??0)+1;
    return {actionBias:bias,selectedStrategy,selectedMemoryId,selectedRecallConfidence01:recallConfidence,memoryUtility01:top?.q.utility??0,writeGate01:writeGate,redirectAction:redirect,liveImprovement01:this.state.liveImprovement01};
  }

  afterOutcome(args:{tick:number;context:number[];identityVector?:number[];goalPressure01:number;identityGap01:number;novelty01:number;uncertainty01:number;reward01:number;predictionError01:number;verified01:number;action:ActionKind|null;holdout01?:number}):void{
    const idx=this.strategyIndex(this.state.selectedStrategy); const expected=clamp(this.state.armValues[idx]??.5); const actual=clamp(args.reward01*.52+args.verified01*.22+(1-args.predictionError01)*.16+(1-args.identityGap01)*.10); const err=Math.abs(expected-actual);
    const eta=1/Math.max(8,this.state.armCounts[idx]??8); this.state.armValues[idx]=clamp(expected+eta*.35*(actual-expected)); this.state.strategyUpdates++;this.state.strategyLearning01=clamp(this.state.strategyLearning01*.96+(1-err)*.04);
    const importance=clamp(args.predictionError01*.30+args.reward01*.18+args.verified01*.18+args.goalPressure01*.10+args.identityGap01*.08+args.novelty01*.08+(this.state.selectedRecallConfidence01<.4?.08:0));
    const candidate:AutobiographicalMemoryRecord={
      id:`auto:${args.tick}:${this.state.writes+1}`,tick:args.tick,context:args.context.slice(0,24),identityVector:(args.identityVector??[]).slice(0,24),
      goalPressure01:clamp(args.goalPressure01),identityGap01:clamp(args.identityGap01),novelty01:clamp(args.novelty01),uncertainty01:clamp(args.uncertainty01),
      reward01:clamp(args.reward01),predictionError01:clamp(args.predictionError01),verified01:clamp(args.verified01),action:args.action,
      causalImportance01:importance,
      reliability01:clamp(.35+.45*args.verified01+.20*(1-args.predictionError01)),
      utility01:clamp(importance*.55+args.reward01*.20+args.verified01*.15+(1-args.predictionError01)*.10),
      retrievals:0,writes:1,ageTicks:0,retention01:clamp(.58+args.verified01*.30+importance*.12),lastUsedTick:args.tick,contradiction01:0
    };
    const shouldWrite=importance>=this.state.selectedWriteGate01*.82 || args.verified01>.72 || args.predictionError01>.70;
    if(shouldWrite){
      const near=this.state.memories.map(m=>({m,q:this.scoreMemory(m,{tick:args.tick,context:args.context,identityVector:args.identityVector,goalPressure01:args.goalPressure01,identityGap01:args.identityGap01,novelty01:args.novelty01,uncertainty01:args.uncertainty01,predictionError01:args.predictionError01,computeBudget01:1})})).sort((a,b)=>b.q.utility-a.q.utility)[0];
      if(near&&near.q.contextMatch>.86&&near.m.action===args.action){
        const conflict=clamp(Math.abs(near.m.reward01-candidate.reward01)*.8+Math.abs(near.m.predictionError01-candidate.predictionError01)*.2);
        near.m.contradiction01=clamp(near.m.contradiction01*.85+conflict*.15);
        near.m.reward01=clamp(near.m.reward01*.82+candidate.reward01*.18);near.m.reliability01=clamp(near.m.reliability01*.84+candidate.reliability01*.16);near.m.utility01=clamp(near.m.utility01*.84+candidate.utility01*.16);near.m.retention01=clamp(near.m.retention01*.93+candidate.retention01*.07);near.m.writes++;
        if(conflict>.35)this.state.contradictions++;
        this.state.consolidations++;
      }else{this.state.memories.push(candidate);this.state.writes++;}
    }
    for(const m of this.state.memories){m.ageTicks=Math.max(0,args.tick-m.tick);const halfLife=80+220*m.retention01+120*m.causalImportance01;m.retention01=clamp(m.retention01*Math.exp(-Math.min(12,m.ageTicks)/Math.max(20,halfLife)*.03));m.reliability01=clamp(m.reliability01*.9995+(m.verified01*.0005));if(m.contradiction01>.82&&m.reliability01<.42)this.state.forgets++;}
    this.state.memories=this.state.memories.filter(m=>!(m.contradiction01>.88&&m.reliability01<.30)).sort((a,b)=>b.utility01-a.utility01).slice(0,this.maxMemories);
    if(args.holdout01!=null&&args.holdout01>.5){this.state.holdoutEvaluations++;const predicted=this.state.selectedMemoryUtility01>.55;const actual=args.reward01>.55;if(predicted===actual)this.state.holdoutSuccesses++;}
    this.state.retention01=clamp(mean(this.state.memories.slice(-32).map(m=>m.retention01)));
    this.state.autobiographicalContinuity01=clamp(this.state.autobiographicalContinuity01*.95+(1-args.identityGap01)*.03+(this.state.identityWeightedRecall01)*.02);
    this.state.contradictionControl01=clamp(this.state.contradictionControl01*.96+(1-(this.state.contradictions/Math.max(1,this.state.writes)))*.04);
  }

  metrics(){return {...deep(this.state),holdout01:this.state.holdoutSuccesses/Math.max(1,this.state.holdoutEvaluations),memoryCount:this.state.memories.length,selectedStrategy:this.state.selectedStrategy};}
}

export const defaultSelfOptimizingAutobiographicalMemory=():SelfOptimizingAutobiographicalMemoryState=>defaultState();
