import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const norm=(v:number[])=>Math.sqrt(v.reduce((s,x)=>s+x*x,0)/Math.max(1,v.length));
const distance=(a:number[],b:number[])=>{
  const n=Math.max(a.length,b.length,1); let s=0;
  for(let i=0;i<n;i++){const d=(a[i]??0)-(b[i]??0);s+=d*d;}
  return Math.sqrt(s/n);
};

export interface P2724ReplaySample{
  id:number; tick:number; contextId:number; action:ActionKind; reward01:number; predictionError01:number;
  verified01:number; priority01:number; novelty01:number; uncertainty01:number; latent:number[]; context:number[];
}

export interface P2724ActionModel{samples:number; mean01:number; uncertainty01:number; confidence01:number; lastReward01:number;}
export interface P2724LatentActionModel{samples:number; delta:number[]; uncertainty01:number; confidence01:number;}

export interface P2724PlanningState{
  selectedAction:ActionKind; selectedValue01:number; epistemicValue01:number; modelUncertainty01:number;
  depth:number; rollouts:number; disagreement01:number; adaptiveHorizon01:number;
}

export interface P2724AutonomousContinualState{
  version:1; enabled:boolean; tick:number; outcomes:number;
  contextPrototypes:number[][]; contextCounts:number[]; activeContextId:number; previousContextId:number;
  contextNovelty01:number; boundary01:number; changePoint01:number; contextStability01:number; contextEntropy01:number;
  interferenceMatrix:number[][]; contextPerformance01:number[]; contextVisits:number[];
  actionModel:Record<ActionKind,P2724ActionModel>; contextActionModel:P2724ActionModel[][]; latentActionModel:P2724LatentActionModel[]; planning:P2724PlanningState;
  counterfactualMean01:number[]; counterfactualUncertainty01:number[]; counterfactualVisits:number[]; counterfactualConfidence01:number;
  replay: P2724ReplaySample[]; replayCapacity:number; replaySeen:number; replayUsed:number; replayBudget01:number; replayDiversity01:number; replayPolicyMix01:number[]; replayPolicyEntropy01:number; replayAdaptation01:number;
  dormantFraction01:number; structuralPlasticity01:number; wakeEvents:number; pruneEvents:number; rewireEvents:number; structuralGain01:number;
  mobileBudget01:number; mobilePressure01:number; hotResidency01:number; compressionRatio01:number; skippedReplay:number;
  taskSwitches:number; interference01:number; forgettingPressure01:number; transferGain01:number; lastReason:string;
}

const freshAction=():P2724ActionModel=>({samples:0,mean01:.5,uncertainty01:.25,confidence01:.15,lastReward01:.5});
const freshPlanning=():P2724PlanningState=>({selectedAction:'respond',selectedValue01:.5,epistemicValue01:0,modelUncertainty01:.5,depth:1,rollouts:0,disagreement01:0,adaptiveHorizon01:.5});
const freshLatent=():P2724LatentActionModel=>({samples:0,delta:new Array(8).fill(0),uncertainty01:.45,confidence01:.12});
const entropy01=(mix:number[])=>{const n=mix.length||1;let e=0;for(const x of mix){const p=Math.max(1e-6,x);e-=p*Math.log(p);}return clamp(e/Math.log(n));};

export const defaultP2724AutonomousContinual=(contexts=6):P2724AutonomousContinualState=>({
  version:1,enabled:true,tick:0,outcomes:0,
  contextPrototypes:Array.from({length:contexts},()=>new Array(16).fill(0)),contextCounts:new Array(contexts).fill(0),activeContextId:0,previousContextId:0,
  contextNovelty01:0,boundary01:0,changePoint01:0,contextStability01:0.65,contextEntropy01:0,
  interferenceMatrix:Array.from({length:contexts},()=>new Array(contexts).fill(0)),contextPerformance01:new Array(contexts).fill(.5),contextVisits:new Array(contexts).fill(0),
  actionModel:Object.fromEntries(ACTIONS.map(a=>[a,freshAction()])) as Record<ActionKind,P2724ActionModel>,
  contextActionModel:Array.from({length:contexts},()=>ACTIONS.map(()=>freshAction())),
  latentActionModel:ACTIONS.map(()=>freshLatent()),
  replayPolicyMix01:[.48,.28,.16,.08],replayPolicyEntropy01:entropy01([.48,.28,.16,.08]),replayAdaptation01:.12,
  planning:freshPlanning(),
  counterfactualMean01:new Array(ACTIONS.length).fill(.5),counterfactualUncertainty01:new Array(ACTIONS.length).fill(.35),counterfactualVisits:new Array(ACTIONS.length).fill(0),counterfactualConfidence01:.1,
  replay:[],replayCapacity:96,replaySeen:0,replayUsed:0,replayBudget01:.18,replayDiversity01:0,
  dormantFraction01:.20,structuralPlasticity01:.25,wakeEvents:0,pruneEvents:0,rewireEvents:0,structuralGain01:0,
  mobileBudget01:.7,mobilePressure01:0,hotResidency01:.72,compressionRatio01:1,skippedReplay:0,
  taskSwitches:0,interference01:0,forgettingPressure01:0,transferGain01:0,lastReason:'init'
});

export class P2724AutonomousContinualFabric{
  private state:P2724AutonomousContinualState;
  constructor(contexts=6){this.state=defaultP2724AutonomousContinual(contexts);}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2724AutonomousContinualState>|null,contexts=6){
    const d=defaultP2724AutonomousContinual(contexts),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>arr(v[i],cols,fill)):Array.from({length:rows},()=>new Array(cols).fill(fill));
    const actionModel={...d.actionModel}; for(const a of ACTIONS) actionModel[a]={...d.actionModel[a],...(r.actionModel?.[a]??{})};
    const contextActionModel=Array.from({length:contexts},(_,c)=>ACTIONS.map((_,ai)=>({...d.contextActionModel[c]![ai]!,...((r.contextActionModel?.[c]?.[ai])??{})})));
    const latentActionModel=Array.from({length:ACTIONS.length},(_,ai)=>{const x:any=r.latentActionModel?.[ai]??{};return {...d.latentActionModel[ai]!,...x,delta:arr(x.delta,8)};});
    const replayPolicyMix01=Array.isArray(r.replayPolicyMix01)&&r.replayPolicyMix01.length===4?r.replayPolicyMix01.map((x:any)=>Math.max(.01,finite(Number(x),.25))):d.replayPolicyMix01;
    const replayPolicySum=replayPolicyMix01.reduce((a:number,b:number)=>a+b,0)||1;
    this.state={...d,...structuredClone(r),version:1,
      contextPrototypes:matrix(r.contextPrototypes,contexts,16),contextCounts:arr(r.contextCounts,contexts),contextPerformance01:arr(r.contextPerformance01,contexts,.5),contextVisits:arr(r.contextVisits,contexts),interferenceMatrix:matrix(r.interferenceMatrix,contexts,contexts),
      actionModel,contextActionModel,latentActionModel,replayPolicyMix01:replayPolicyMix01.map((x:number)=>x/replayPolicySum),replayPolicyEntropy01:entropy01(replayPolicyMix01),replayAdaptation01:clamp(Number(r.replayAdaptation01??d.replayAdaptation01)),planning:{...d.planning,...(r.planning??{})},counterfactualMean01:arr(r.counterfactualMean01,ACTIONS.length,.5),counterfactualUncertainty01:arr(r.counterfactualUncertainty01,ACTIONS.length,.35),counterfactualVisits:arr(r.counterfactualVisits,ACTIONS.length),
      replay:Array.isArray(r.replay)?r.replay.slice(-d.replayCapacity).map((s:any)=>({...s,latent:arr(s.latent,8),context:arr(s.context,16)})):[],replayCapacity:Math.max(24,Math.min(192,Math.floor(Number(r.replayCapacity??96))))
    };
  }
  setEnabled(v:boolean){this.state.enabled=!!v;}
  private contextDistance(vector:number[],prototype:number[]){return clamp(distance(vector,prototype)/1.7);}
  private assignContext(vector:number[]):{id:number;novelty:number;previous:number}{
    let best=0,bestD=Infinity;
    for(let c=0;c<this.state.contextPrototypes.length;c++){const d=this.contextDistance(vector,this.state.contextPrototypes[c]!);if(d<bestD){bestD=d;best=c;}}
    const active=this.state.activeContextId;
    const activeD=this.contextDistance(vector,this.state.contextPrototypes[active]??new Array(16).fill(0));
    const unused=this.state.contextCounts.findIndex(v=>v===0);
    if(unused>=0 && Math.max(bestD,activeD)>.30) { best=unused; bestD=Math.min(bestD,activeD); }
    const novelty=clamp(.65*bestD+.35*activeD);
    return {id:best,novelty,previous:active};
  }
  private updateContext(vector:number[],novelty01:number,predictionError01:number,uncertainty01:number,resource01:number){
    const c=this.assignContext(vector), old=this.state.activeContextId;
    const shift=old===c.id?clamp(novelty01*.55+c.novelty*.35+Math.abs(predictionError01-this.state.contextNovelty01)*.10):clamp(.58+.25*c.novelty+.17*novelty01);
    const switched=old!==c.id && shift>.54;
    if(switched){this.state.previousContextId=old;this.state.activeContextId=c.id;this.state.taskSwitches++;}
    const rate=clamp(.018+.04*(1-resource01)+.035*(1-this.state.contextStability01),.012,.085);
    const proto=this.state.contextPrototypes[c.id]!;
    for(let i=0;i<16;i++) proto[i]=finite(proto[i])+(finite(vector[i])-finite(proto[i]))*rate;
    this.state.contextCounts[c.id]=(this.state.contextCounts[c.id]??0)+1;
    this.state.contextVisits[c.id]=(this.state.contextVisits[c.id]??0)+1;
    this.state.contextNovelty01=clamp(this.state.contextNovelty01*.82+Math.max(novelty01,c.novelty)*.18);
    this.state.changePoint01=clamp(this.state.changePoint01*.84+shift*.16);
    this.state.boundary01=clamp(this.state.boundary01*.80+(switched?1:shift)*.20);
    this.state.contextStability01=clamp(this.state.contextStability01*.92+(1-shift)*.08);
    const visitTotal=this.state.contextVisits.reduce((a,b)=>a+b,0)||1;
    let entropy=0;for(const v of this.state.contextVisits){const p=v/visitTotal;if(p>0)entropy-=p*Math.log(p);}this.state.contextEntropy01=clamp(entropy/Math.log(this.state.contextVisits.length||1));
    if(switched){const a=this.state.interferenceMatrix[old]!,b=this.state.interferenceMatrix[c.id]!;a[c.id]=clamp((a[c.id]??0)*.88+.12*(.5+predictionError01*.5));b[old]=clamp((b[old]??0)*.88+.12*(.5+uncertainty01*.5));}
    return {id:c.id,novelty:clamp(.6*this.state.contextNovelty01+.4*c.novelty),shift,switched};
  }
  private modelReward(action:ActionKind,baseUtility:number,informationGain:number,contextId=this.state.activeContextId){
    const idx=ACTIONS.indexOf(action),global=this.state.actionModel[action]!,local=this.state.contextActionModel[contextId]?.[idx]??global,cf=this.state.counterfactualMean01[idx]??.5,latent=this.state.latentActionModel[idx]!;
    const localWeight=clamp(.18+local.confidence01*.52+.30*(1-local.uncertainty01),.18,.82);
    const mean=clamp(global.mean01*(1-localWeight*.55)+local.mean01*localWeight*.55+cf*.18+clamp(baseUtility)*.27);
    const uncertainty=clamp(global.uncertainty01*.34+local.uncertainty01*.40+(this.state.counterfactualUncertainty01[idx]??.35)*.16+latent.uncertainty01*.10);
    const confidence=clamp(global.confidence01*.35+local.confidence01*.42+(1-latent.uncertainty01)*.23);
    const epistemic=(1-uncertainty)*.15+informationGain*(action==='explore'||action==='verify'?.22:.04)+Math.min(.08,latent.confidence01*.08);
    return {mean,uncertainty,confidence,value:clamp(mean+epistemic)};
  }
  private plan(baseUtilities:Record<ActionKind,number>,uncertainty01:number,novelty01:number,predictionError01:number,resource01:number,latent:number[]=[]){
    const budget=clamp(resource01),depth=budget>.74?3:budget>.45?2:1;
    const info=clamp(.45*uncertainty01+.35*novelty01+.20*predictionError01);
    let chosen:ActionKind='respond',best=-Infinity;let rollouts=0,disagreement=0;
    const values:Record<ActionKind,number>={} as Record<ActionKind,number>;
    for(const a of ACTIONS){
      const m=this.modelReward(a,baseUtilities[a]??.5,info,this.state.activeContextId);
      const ai=ACTIONS.indexOf(a),lm=this.state.latentActionModel[ai]!;
      const latentDelta=lm.delta.reduce((s,x,k)=>s+Math.abs(x-(latent[k]??0)),0)/Math.max(1,lm.delta.length);
      const latentConfidence=clamp(lm.confidence01*(1-lm.uncertainty01));
      let value=clamp(m.value + latentConfidence*.06 - latentDelta*.035);
      for(let h=1;h<depth;h++){
        const decay=Math.pow(.72,h);
        const future=clamp(m.mean*(.45+.25*m.confidence)+info*(a==='explore'||a==='verify'?.18:.05));
        value+=future*decay*.42;
      }
      const stabilityPenalty=m.uncertainty*(1-budget)*.08;
      value=clamp(value-stabilityPenalty,.0,1);
      values[a]=value;rollouts+=depth;
      disagreement+=Math.abs(value-(baseUtilities[a]??.5));
      if(value>best){best=value;chosen=a;}
    }
    disagreement=clamp(disagreement/ACTIONS.length*1.8);
    const epistemic=clamp(info*(chosen==='explore'||chosen==='verify'?1:.45));
    this.state.planning={selectedAction:chosen,selectedValue01:best,epistemicValue01:epistemic,modelUncertainty01:clamp(1-best*.72),depth,rollouts,disagreement01:disagreement,adaptiveHorizon01:clamp(.25+.25*depth+.50*(1-this.state.contextStability01))};
    return {values,chosen,epistemic,disagreement,rollouts,depth};
  }
  beforeDecision(i:{tick:number;context:number[];baseUtilities:Record<ActionKind,number>;uncertainty01:number;novelty01:number;predictionError01:number;resource01:number;forgetting01:number;replayDebt01:number;informationGain01?:number;latent?:number[];}){
    if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,boundary01:0,contextId:0,replayBudget:0,structuralBudget01:0,planning:this.state.planning};
    const vector=new Array(16).fill(0).map((_,k)=>finite(i.context[k]??0));
    const ctx=this.updateContext(vector,i.novelty01,i.predictionError01,i.uncertainty01,i.resource01);
    this.state.forgettingPressure01=clamp(this.state.forgettingPressure01*.88+.12*i.forgetting01);
    const planning=this.plan(i.baseUtilities,i.uncertainty01,i.novelty01,i.predictionError01,i.resource01,i.latent??[]);
    const budget=clamp(.10+.44*i.resource01+.20*(1-this.state.mobilePressure01)+.12*ctx.shift,.06,.78);
    this.state.replayBudget01=clamp(this.state.replayBudget01*.90+budget*.10);
    this.state.replayBudget01=clamp(this.state.replayBudget01-.16*i.replayDebt01,.04,.78);
    const structural=clamp(.06+.26*ctx.shift+.18*i.novelty01+.16*i.resource01-.10*this.state.mobilePressure01,.03,.48);
    this.state.structuralPlasticity01=structural;
    this.state.dormantFraction01=clamp(this.state.dormantFraction01*.97+(.24-structural*.18)*.03,.05,.62);
    const actionBias=Object.fromEntries(ACTIONS.map(a=>{
      const v=planning.values[a]??.5,base=clamp(i.baseUtilities[a]??.5);
      const delta=tanh((v-base)*1.65)*.058;
      const info=(a==='explore'||a==='verify')?planning.epistemic*.018:0;
      const boundary=(a==='verify'||a==='reflect')?ctx.shift*.013:0;
      const antiForget=a==='reflect'?this.state.forgettingPressure01*.012:0;
      return [a,clamp(delta+info+boundary+antiForget,-.072,.072)];
    })) as Record<ActionKind,number>;
    this.state.mobileBudget01=clamp(i.resource01);
    this.state.mobilePressure01=clamp(this.state.mobilePressure01*.90+(1-i.resource01)*.10);
    this.state.hotResidency01=clamp(.74+.18*i.resource01-.16*this.state.mobilePressure01);
    this.state.compressionRatio01=clamp(1/(1+this.state.replay.length/this.state.replayCapacity*.65),.42,1);
    this.state.lastReason=`ctx=${ctx.id};shift=${ctx.shift.toFixed(2)};boundary=${this.state.boundary01.toFixed(2)};plan=${planning.chosen};replay=${this.state.replayBudget01.toFixed(2)}`;
    return {actionBias,boundary01:this.state.boundary01,contextId:ctx.id,replayBudget:Math.floor(2+this.state.replayBudget01*10),structuralBudget01:structural,planning:this.state.planning};
  }
  adaptReplayPolicy(i:{predictionError01:number;novelty01:number;uncertainty01:number;verified01:number;contextShift01:number;forgetting01:number;resource01:number}){
    const e=clamp(i.predictionError01),n=clamp(i.novelty01),u=clamp(i.uncertainty01),v=clamp(i.verified01),shift=clamp(i.contextShift01),f=clamp(i.forgetting01),r=clamp(i.resource01);
    // Four replay arms: priority/error, context relevance, novelty/uncertainty, and
    // low-cost stochastic exploration. The mix now adapts from observed learning
    // conditions instead of being a static heuristic.
    const target=[
      .28+.28*e+.16*v+.12*f+.16*(1-u),
      .22+.34*(1-shift)+.16*v+.10*(1-e),
      .18+.34*n+.20*u+.10*e,
      .05+.22*r+.10*(1-u)+.08*(1-v)
    ].map(x=>Math.max(.02,finite(x)));
    const sum=target.reduce((a,b)=>a+b,0)||1;
    const rate=clamp(.025+.035*r+.020*u,.02,.085);
    for(let k=0;k<4;k++) this.state.replayPolicyMix01[k]=clamp(this.state.replayPolicyMix01[k]!*(1-rate)+(target[k]!/sum)*rate,.01,.96);
    const norm=this.state.replayPolicyMix01.reduce((a,b)=>a+b,0)||1;
    this.state.replayPolicyMix01=this.state.replayPolicyMix01.map(x=>x/norm);
    this.state.replayPolicyEntropy01=entropy01(this.state.replayPolicyMix01);
    this.state.replayAdaptation01=clamp(this.state.replayAdaptation01*.96+rate*.04);
  }
  shouldReplay(sample:P2724ReplaySample,nowContext:number,limit=4){
    if(!this.state.enabled || limit<=0)return false;
    const relevance=.52*(sample.contextId===nowContext?1:.35)+.25*sample.novelty01+.23*sample.priority01;
    return relevance>.34 && this.state.replayUsed<this.state.replaySeen+this.state.replay.length+limit;
  }
  replaySamples(limit:number,contextId=this.state.activeContextId,forcedStrategy?:number){
    if(!this.state.enabled||this.state.replay.length===0||limit<=0){this.state.skippedReplay++;return [] as P2724ReplaySample[];}
    const n=Math.min(limit,this.state.replay.length),mix=forcedStrategy===undefined?this.state.replayPolicyMix01:this.state.replayPolicyMix01.map((_,k)=>k===Math.max(0,Math.min(3,Math.floor(forcedStrategy)))?.82:.06);
    const pool=this.state.replay.slice();
    const priority=(x:P2724ReplaySample)=>x.priority01*.62+x.uncertainty01*.16+x.verified01*.08+x.novelty01*.14;
    const context=(x:P2724ReplaySample)=> (x.contextId===contextId?1:.24)*.68+x.novelty01*.18+x.priority01*.14;
    const novelty=(x:P2724ReplaySample)=>x.novelty01*.58+x.uncertainty01*.26+x.priority01*.16;
    const chosen:P2724ReplaySample[]=[];
    const take=(kind:number)=>{
      if(!pool.length||chosen.length>=n)return;
      const scored=pool.map((x,idx)=>{const random=((x.id*1103515245+this.state.replayUsed*12345+kind*97)>>>0)/4294967295;const score=kind===0?priority(x):kind===1?context(x):kind===2?novelty(x):random;return {x,idx,score};}).sort((a,b)=>b.score-a.score);
      const pick=scored[0]; if(pick){chosen.push(structuredClone(pick.x));pool.splice(pick.idx,1);}
    };
    const quotas=mix.map(w=>Math.round(n*w));let allocated=quotas.reduce((a,b)=>a+b,0);while(allocated<n){let best=0;for(let i=1;i<quotas.length;i++)if(mix[i]>mix[best])best=i;quotas[best]++;allocated++;}
    for(let k=0;k<quotas.length;k++)for(let i=0;i<quotas[k]&&chosen.length<n;i++)take(k);
    while(chosen.length<n)take(0);
    this.state.replayUsed+=chosen.length;
    const contexts=new Set(chosen.map(s=>s.contextId));this.state.replayDiversity01=clamp(this.state.replayDiversity01*.84+(contexts.size/Math.max(1,this.state.contextPrototypes.length))*.10+(chosen.reduce((s,x)=>s+x.novelty01,0)/Math.max(1,chosen.length))*.06);
    return chosen;
  }
  observeOutcome(i:{tick:number;context:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;novelty01:number;uncertainty01:number;nextContext?:number[];latent?:number[];priorLatent?:number[];baseUtilities:Record<ActionKind,number>;resource01:number;}){
    if(!this.state.enabled)return;
    this.state.tick=i.tick;this.state.outcomes++;
    const vector=new Array(16).fill(0).map((_,k)=>finite(i.context[k]??0));
    const ctx=this.updateContext(vector,i.novelty01,i.predictionError01,i.uncertainty01,i.resource01);
    const a=i.action,ai=ACTIONS.indexOf(a);
    // Durable states from older releases can contain an incomplete actionModel. Repair the
    // canonical entry at the owner boundary instead of letting a reduced-resolution tick crash.
    const m=this.state.actionModel[a] ?? (this.state.actionModel[a]=freshAction());
    const samples=m.samples+1,rate=Math.min(.18,2/samples);
    const oldMean=m.mean01;m.mean01=clamp(oldMean+(i.reward01-oldMean)*rate);m.uncertainty01=clamp(m.uncertainty01*.92+Math.abs(i.reward01-oldMean)*.08);m.confidence01=clamp(.12+Math.min(.78,samples/40)*(.7+.3*(1-m.uncertainty01)));m.samples=samples;m.lastReward01=i.reward01;
    const contextRow=this.state.contextActionModel[ctx.id] ?? (this.state.contextActionModel[ctx.id]=ACTIONS.map(()=>freshAction()));
    const cm=contextRow[ai] ?? (contextRow[ai]=freshAction());
    const cOld=cm.mean01;cm.samples++;const cr=Math.min(.22,2/cm.samples);cm.mean01=clamp(cOld+(i.reward01-cOld)*cr);cm.uncertainty01=clamp(cm.uncertainty01*.90+Math.abs(i.reward01-cOld)*.10);cm.confidence01=clamp(.10+Math.min(.82,cm.samples/28)*(.72+.28*(1-cm.uncertainty01)));cm.lastReward01=i.reward01;
    const lm=this.state.latentActionModel[ai] ?? (this.state.latentActionModel[ai]=freshLatent()),prior=i.priorLatent??[],next=i.latent??[];lm.samples++;const lr=Math.min(.20,2/lm.samples);for(let k=0;k<8;k++){const d=finite(next[k])-finite(prior[k]);lm.delta[k]=finite(lm.delta[k])+(d-finite(lm.delta[k]))*lr;}const deltaErr=clamp((next.slice(0,8).map((v,k)=>Math.abs(finite(v)-finite(prior[k])-finite(lm.delta[k]))).reduce((a,b)=>a+b,0)/8)/.75);lm.uncertainty01=clamp(lm.uncertainty01*.92+deltaErr*.08);lm.confidence01=clamp(.10+Math.min(.84,lm.samples/36)*(.70+.30*(1-lm.uncertainty01)));
    const cfOld=this.state.counterfactualMean01[ai]??.5;this.state.counterfactualMean01[ai]=clamp(cfOld+(i.reward01-cfOld)*Math.min(.16,2/(this.state.counterfactualVisits[ai]!+2)));this.state.counterfactualUncertainty01[ai]=clamp(this.state.counterfactualUncertainty01[ai]!* .92+Math.abs(i.reward01-cfOld)*.08);this.state.counterfactualVisits[ai]++;
    const confidence=this.state.counterfactualVisits.reduce((s,v)=>s+Math.min(1,v/12),0)/ACTIONS.length;this.state.counterfactualConfidence01=clamp(this.state.counterfactualConfidence01*.94+confidence*.06);
    const predPerf=clamp(1-i.predictionError01);this.state.contextPerformance01[ctx.id]=clamp(this.state.contextPerformance01[ctx.id]!* .94+(.62*i.reward01+.38*predPerf)*.06);
    const perfGap=Math.abs(this.state.contextPerformance01[ctx.id]!- .5);this.state.interference01=clamp(this.state.interference01*.90+.10*(ctx.shift*.55+i.predictionError01*.3+perfGap*.15));
    this.state.transferGain01=clamp(this.state.transferGain01*.93+.07*(ctx.novelty*(1-i.predictionError01)));
    this.adaptReplayPolicy({predictionError01:i.predictionError01,novelty01:i.novelty01,uncertainty01:i.uncertainty01,verified01:i.verified01,contextShift01:ctx.shift,forgetting01:this.state.forgettingPressure01,resource01:i.resource01});
    const priority=clamp(.28*i.predictionError01+.20*i.novelty01+.16*i.uncertainty01+.14*ctx.shift+.10*i.verified01+.12*this.state.forgettingPressure01);
    this.state.replaySeen++;
    const sample:P2724ReplaySample={id:this.state.replaySeen,tick:i.tick,contextId:ctx.id,action:a,reward01:i.reward01,predictionError01:i.predictionError01,verified01:i.verified01,priority01:priority,novelty01:i.novelty01,uncertainty01:i.uncertainty01,latent:(i.latent??[]).slice(0,8),context:vector};
    if(this.state.replay.length<this.state.replayCapacity)this.state.replay.push(sample);
    else{
      let low=0,lowScore=Infinity;for(let k=0;k<this.state.replay.length;k++){const s=this.state.replay[k]!,score=s.priority01*.55+s.verified01*.08+s.novelty01*.18+s.uncertainty01*.19;if(score<lowScore){lowScore=score;low=k;}}
      if(priority>lowScore)this.state.replay[low]=sample;else this.state.skippedReplay++;
    }
    if(ctx.switched){const p=this.state.previousContextId,c=this.state.activeContextId;this.state.interferenceMatrix[p]![c]=clamp((this.state.interferenceMatrix[p]![c]??0)*.92+this.state.interference01*.08);}
    this.state.replayBudget01=clamp(this.state.replayBudget01*.94+(priority*.45+this.state.boundary01*.25)*.06);
    const targetReplay=[clamp(.34+priority*.22+this.state.forgettingPressure01*.16),clamp(.27+ctx.shift*.28),clamp(.17+i.novelty01*.20),clamp(.08+(1-i.resource01)*.12)];
    const sumReplay=targetReplay.reduce((x,y)=>x+y,0)||1;for(let k=0;k<4;k++)this.state.replayPolicyMix01[k]=clamp((this.state.replayPolicyMix01[k]??.25)*.93+(targetReplay[k]!/sumReplay)*.07,.03,.80);
    const normMix=this.state.replayPolicyMix01.reduce((x,y)=>x+y,0)||1;this.state.replayPolicyMix01=this.state.replayPolicyMix01.map(x=>x/normMix);this.state.replayPolicyEntropy01=entropy01(this.state.replayPolicyMix01);
    this.state.lastReason=`outcome=${a};ctx=${ctx.id};cf=${this.state.counterfactualConfidence01.toFixed(2)};replay=${this.state.replay.length};mix=${this.state.replayPolicyMix01.map(x=>x.toFixed(2)).join('/')}`;
  }
  structuralDecision(neuron:number,importance01:number,activity01:number,contextMatch01:number,resource01:number){
    if(!this.state.enabled)return 'hold' as const;
    const x=clamp(importance01),activity=clamp(activity01),match=clamp(contextMatch01),resource=clamp(resource01);
    const pressure=this.state.boundary01*.42+(1-match)*.24+this.state.forgettingPressure01*.18+(1-resource)*-.14;
    if(activity<.035 && x<.16 && pressure>.22){this.state.wakeEvents++;return 'wake' as const;}
    if(activity<.012 && x<.05 && resource>.62 && this.state.mobilePressure01<.45){this.state.pruneEvents++;return 'prune' as const;}
    return 'hold' as const;
  }
  observeStructural(gain01:number,rewire=false){if(!this.state.enabled)return;this.state.structuralGain01=clamp(this.state.structuralGain01*.94+clamp(gain01)*.06);if(rewire)this.state.rewireEvents++;}
  mobileBudget(){return {budget01:this.state.mobileBudget01,pressure01:this.state.mobilePressure01,hotResidency01:this.state.hotResidency01,compressionRatio01:this.state.compressionRatio01,replayBudget01:this.state.replayBudget01};}
  applyDreamRehearsalSignal(input:{robustness01:number;promoted:boolean;uncertainty01:number;resource01:number}){
    if(!this.state.enabled) return;
    const robustness=clamp(input.robustness01);
    const uncertainty=clamp(input.uncertainty01);
    const resource=clamp(input.resource01);
    const rehearsalDebt=clamp((1-robustness)*.72+uncertainty*.28);
    this.state.forgettingPressure01=clamp(this.state.forgettingPressure01*.90+rehearsalDebt*.10);
    const rehearsalBoost=(input.promoted?0.11:0.035)*resource;
    this.state.replayBudget01=clamp(this.state.replayBudget01*.94+rehearsalBoost*.06);
    const targetPriority=clamp(this.state.replayPolicyMix01[0] + (input.promoted?0.045:0.012)*resource);
    this.state.replayPolicyMix01[0]=targetPriority;
    const sum=this.state.replayPolicyMix01.reduce((a,b)=>a+b,0)||1;
    this.state.replayPolicyMix01=this.state.replayPolicyMix01.map(v=>v/sum);
    this.state.replayPolicyEntropy01=entropy01(this.state.replayPolicyMix01);
    this.state.counterfactualConfidence01=clamp(this.state.counterfactualConfidence01*.93+robustness*.07);
    this.state.lastReason=`dream=${robustness.toFixed(2)};promoted=${input.promoted?'1':'0'};replay=${this.state.replayBudget01.toFixed(2)};forget=${this.state.forgettingPressure01.toFixed(2)}`;
  }
  metrics(){return structuredClone(this.state);}
}
