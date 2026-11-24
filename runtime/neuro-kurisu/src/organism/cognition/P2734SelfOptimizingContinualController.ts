import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const ARMS=['priority','context','novelty','uniform'] as const;
type ReplayArm=typeof ARMS[number];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const distance=(a:number[],b:number[])=>{const n=Math.max(a.length,b.length,1);let s=0;for(let i=0;i<n;i++){const d=finite(a[i])-finite(b[i]);s+=d*d;}return Math.sqrt(s/n);};
const normalize=(xs:number[])=>{const s=xs.reduce((a,b)=>a+Math.max(.001,b),0)||1;return xs.map(x=>Math.max(.001,x)/s);};
const entropy01=(mix:number[])=>{const n=mix.length||1;let e=0;for(const x of mix){const p=Math.max(1e-6,x);e-=p*Math.log(p);}return clamp(e/Math.log(n));};

export interface P2734ActionCalibration{samples:number;prediction01:number;absError01:number;signedError01:number;uncertainty01:number;confidence01:number;regret01:number;}
export interface P2734SkillCapsule{visits:number;success01:number;confidence01:number;centroid:number[];fastDelta:number[];slowDelta:number[];predictionError01:number;consolidation01:number;lastTick:number;}
export interface P2734ReplayArmState{pulls:number;meanUtility01:number;uncertainty01:number;weight01:number;lastUtility01:number;}
export interface P2734MetaState{
  version:1; enabled:boolean; tick:number; outcomes:number; activeContextId:number; previousContextId:number;
  fastLearning01:number;metaLearning01:number;metaWarmup01:number;adaptationPressure01:number;stabilityPressure01:number;
  contextPrototype:number[][];contextVisits:number[];contextSwitches:number;boundaryEvidence01:number;lastContextVector:number[];
  actionCalibration:P2734ActionCalibration[];skillCapsules:P2734SkillCapsule[][];
  ensembleDisagreement01:number;transitionUncertainty01:number;informationValue01:number;modelCalibration01:number;
  counterfactualRegret01:number[];counterfactualGap01:number;repetitionPenalty01:number;
  replayArms:P2734ReplayArmState[];replayMix01:number[];replayEntropy01:number;selectedReplayArm:number;pendingReplayCredit01:number;
  consolidationQueue:number[];consolidationGain01:number;consolidations:number;replayFeedbackCount:number;
  resourceBudget01:number;hotState01:number;coldCompression01:number;computeSaved01:number;skippedWork:number;
  taskTransfer01:number;antiForgetting01:number;lastReason:string;
}

const freshCalibration=():P2734ActionCalibration=>({samples:0,prediction01:.5,absError01:.25,signedError01:0,uncertainty01:.35,confidence01:.12,regret01:.2});
const freshCapsule=():P2734SkillCapsule=>({visits:0,success01:.5,confidence01:.1,centroid:new Array(8).fill(0),fastDelta:new Array(8).fill(0),slowDelta:new Array(8).fill(0),predictionError01:.35,consolidation01:.05,lastTick:0});
const freshArm=():P2734ReplayArmState=>({pulls:0,meanUtility01:.5,uncertainty01:.35,weight01:.25,lastUtility01:.5});

export const defaultP2734SelfOptimizingContinual=(contexts=6):P2734MetaState=>({
  version:1,enabled:true,tick:0,outcomes:0,activeContextId:0,previousContextId:0,
  fastLearning01:.75,metaLearning01:.18,metaWarmup01:.55,adaptationPressure01:.22,stabilityPressure01:.42,
  contextPrototype:Array.from({length:contexts},()=>new Array(16).fill(0)),contextVisits:new Array(contexts).fill(0),contextSwitches:0,boundaryEvidence01:0,lastContextVector:new Array(16).fill(0),
  actionCalibration:ACTIONS.map(()=>freshCalibration()),skillCapsules:Array.from({length:contexts},()=>ACTIONS.map(()=>freshCapsule())),
  ensembleDisagreement01:.32,transitionUncertainty01:.40,informationValue01:.22,modelCalibration01:.60,
  counterfactualRegret01:new Array(ACTIONS.length).fill(.2),counterfactualGap01:.12,repetitionPenalty01:0,
  replayArms:ARMS.map(()=>freshArm()),replayMix01:[.45,.30,.17,.08],replayEntropy01:entropy01([.45,.30,.17,.08]),selectedReplayArm:0,pendingReplayCredit01:0,
  consolidationQueue:[],consolidationGain01:0,consolidations:0,replayFeedbackCount:0,
  resourceBudget01:.60,hotState01:.72,coldCompression01:1,computeSaved01:0,skippedWork:0,
  taskTransfer01:0,antiForgetting01:.35,lastReason:'init'
});

export class P2734SelfOptimizingContinualController{
  private state:P2734MetaState;
  private contexts:number;
  constructor(contexts=6){this.contexts=contexts;this.state=defaultP2734SelfOptimizingContinual(contexts);}
  snapshot(){return structuredClone(this.state);}
  setEnabled(v:boolean){this.state.enabled=!!v;}
  restore(raw?:Partial<P2734MetaState>|null){
    const d=defaultP2734SelfOptimizingContinual(this.contexts),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-v.length)).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.isArray(v)?Array.from({length:rows},(_,i)=>arr(v[i],cols,fill)):Array.from({length:rows},()=>new Array(cols).fill(fill));
    const calibrations=Array.from({length:ACTIONS.length},(_,a)=>({...d.actionCalibration[a]!,...(r.actionCalibration?.[a]??{})}));
    const capsules=Array.from({length:this.contexts},(_,c)=>ACTIONS.map((_,a)=>{const x:any=r.skillCapsules?.[c]?.[a]??{};return {...d.skillCapsules[c]![a]!,...x,centroid:arr(x.centroid,8),fastDelta:arr(x.fastDelta,8),slowDelta:arr(x.slowDelta,8)};}));
    const arms=ARMS.map((_,i)=>({...d.replayArms[i]!,...(r.replayArms?.[i]??{})}));
    const mix=normalize(Array.isArray(r.replayMix01)?r.replayMix01:d.replayMix01);
    this.state={...d,...structuredClone(r),version:1,
      contextPrototype:matrix(r.contextPrototype,this.contexts,16),contextVisits:arr(r.contextVisits,this.contexts),lastContextVector:arr(r.lastContextVector,16),
      actionCalibration:calibrations,skillCapsules:capsules,counterfactualRegret01:arr(r.counterfactualRegret01,ACTIONS.length,.2),
      replayArms:arms,replayMix01:mix,replayEntropy01:entropy01(mix),consolidationQueue:Array.isArray(r.consolidationQueue)?r.consolidationQueue.slice(-64):[]
    };
  }
  private context(vector:number[],novelty01:number,predictionError01:number):{id:number;shift:number;novelty:number}{
    let best=0,bestD=Infinity;
    for(let c=0;c<this.contexts;c++){const d=distance(vector,this.state.contextPrototype[c]!);if(d<bestD){bestD=d;best=c;}}
    const previous=this.state.activeContextId;
    const activeD=distance(vector,this.state.contextPrototype[previous]!);
    const temporalD=distance(vector,this.state.lastContextVector);
    const shift=clamp(.38*(activeD/1.8)+.34*(temporalD/1.35)+.18*novelty01+.10*predictionError01);
    const unused=this.state.contextVisits.findIndex(v=>v===0);
    if(unused>=0&&shift>.34){best=unused;bestD=activeD;}
    const switched=best!==previous&&shift>.44;
    if(switched){this.state.previousContextId=previous;this.state.activeContextId=best;this.state.contextSwitches++;}
    const rate=clamp(.02+.055*(1-this.state.stabilityPressure01),.015,.075),p=this.state.contextPrototype[best]!;
    for(let i=0;i<16;i++)p[i]=finite(p[i])+(finite(vector[i])-finite(p[i]))*rate;
    this.state.contextVisits[best]++;
    this.state.lastContextVector=vector.slice();
    this.state.boundaryEvidence01=clamp(this.state.boundaryEvidence01*.86+(switched?1:shift)*.14);
    this.state.adaptationPressure01=clamp(this.state.adaptationPressure01*.91+(shift*.55+novelty01*.45)*.09);
    this.state.stabilityPressure01=clamp(this.state.stabilityPressure01*.93+(1-shift)*.07);
    return {id:best,shift,novelty:clamp(.6*(bestD/1.8)+.4*novelty01)};
  }
  private bestAlternative(action:ActionKind,ctx:number):number{
    const ai=ACTIONS.indexOf(action);let best=0;
    for(let a=0;a<ACTIONS.length;a++)if(a!==ai){const c=this.state.actionCalibration[a]!;const cap=this.state.skillCapsules[ctx]![a]!;const v=.52*c.prediction01+.32*cap.success01+.16*(1-cap.predictionError01);if(v>best)best=v;}
    return clamp(best);
  }
  private prediction(actionIndex:number,ctx:number,base:number):number{
    const c=this.state.actionCalibration[actionIndex]!,cap=this.state.skillCapsules[ctx]?.[actionIndex]??freshCapsule();
    return clamp(.38*base+.28*c.prediction01+.22*cap.success01+.12*(1-cap.predictionError01));
  }
  beforeDecision(i:{tick:number;context:number[];baseUtilities:Record<ActionKind,number>;novelty01:number;uncertainty01:number;predictionError01:number;resource01:number;forgetting01:number;informationGain01?:number;replayDebt01?:number;latent?:number[]}):{actionBias:Record<ActionKind,number>;contextId:number;informationValue01:number;replayArm:ReplayArm;replayLimit:number;consolidationBudget:number;planningAgreement01:number;fastLearning01:number;metaLearning01:number}{
    if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,contextId:0,informationValue01:0,replayArm:ARMS[0],replayLimit:0,consolidationBudget:0,planningAgreement01:0,fastLearning01:0,metaLearning01:0};
    const vector=i.context.slice(0,16).concat(new Array(16).fill(0)).slice(0,16).map(x=>finite(x));
    const ctx=this.context(vector,i.novelty01,i.predictionError01);
    const info=clamp(.28*i.uncertainty01+.22*i.novelty01+.18*i.predictionError01+.17*this.state.ensembleDisagreement01+.10*(i.informationGain01??0)+.05*ctx.shift);
    this.state.informationValue01=clamp(this.state.informationValue01*.88+info*.12);
    this.state.antiForgetting01=clamp(this.state.antiForgetting01*.90+i.forgetting01*.10);
    const mix=this.state.replayArms.map(a=>a.weight01);this.state.replayMix01=normalize(mix);this.state.replayEntropy01=entropy01(this.state.replayMix01);
    let best=0,bestScore=-Infinity;
    for(let k=0;k<ARMS.length;k++){
      const a=this.state.replayArms[k]!,bonus=Math.sqrt(Math.log(this.state.replayArms.reduce((s,x)=>s+x.pulls,0)+2)/(a.pulls+1));
      const score=a.meanUtility01+.55*bonus+.18*info+(k===1?ctx.shift*.05:0);
      if(score>bestScore){bestScore=score;best=k;}
    }
    this.state.selectedReplayArm=best;
    const resource=clamp(i.resource01);
    this.state.resourceBudget01=clamp(this.state.resourceBudget01*.90+resource*.10);
    const replayLimit=Math.max(0,Math.min(10,Math.floor(1+resource*7+ctx.shift*2-this.state.antiForgetting01*.2)));
    const consolidationBudget=resource>.55?Math.max(1,Math.floor(1+resource*4)):0;
    this.state.hotState01=clamp(.60+.28*resource-.14*(1-resource));
    this.state.coldCompression01=clamp(1-.55*Math.max(0,(1-resource))-.18*this.state.antiForgetting01,.42,1);
    const actionBias=Object.fromEntries(ACTIONS.map((a,ai)=>{
      const base=clamp(i.baseUtilities[a]??.5),pred=this.prediction(ai,ctx.id,base),regret=this.state.counterfactualRegret01[ai]??.2;
      const epistemic=(a==='explore'||a==='verify')?info*(.028+.024*this.state.ensembleDisagreement01):0;
      const boundary=(a==='verify'||a==='reflect')?ctx.shift*.018:0;
      const antiForget=a==='reflect'?this.state.antiForgetting01*.014:0;
      const calibrated=tanh(pred-base)*.06;
      const risk=regret*.014;
      const gate=(this.state.ensembleDisagreement01>.62&&a!=='explore'&&a!=='verify')?-Math.min(.018,this.state.ensembleDisagreement01*.018):0;
      return [a,clamp(calibrated+epistemic+boundary+antiForget-risk+gate,-.085,.085)];
    })) as Record<ActionKind,number>;
    const planningAgreement=clamp(.46+.32*(1-this.state.ensembleDisagreement01)+.22*this.state.modelCalibration01);
    this.state.fastLearning01=clamp(.56+.26*info+.18*resource,.35,.94);
    this.state.metaLearning01=clamp(.08+.22*ctx.shift+.14*(1-this.state.modelCalibration01)+.10*(1-resource),.06,.34);
    this.state.metaWarmup01=clamp(this.state.metaWarmup01*.97+.03*(ctx.shift>.44?1:0));
    this.state.lastReason=`ctx=${ctx.id};shift=${ctx.shift.toFixed(2)};info=${info.toFixed(2)};arm=${ARMS[best]};fast=${this.state.fastLearning01.toFixed(2)};meta=${this.state.metaLearning01.toFixed(2)}`;
    return {actionBias,contextId:ctx.id,informationValue01:info,replayArm:ARMS[best]!,replayLimit,consolidationBudget,planningAgreement01:planningAgreement,fastLearning01:this.state.fastLearning01,metaLearning01:this.state.metaLearning01};
  }
  observeOutcome(i:{tick:number;context:number[];contextId:number;action:ActionKind;reward01:number;predictionError01:number;novelty01:number;uncertainty01:number;priorLatent?:number[];latent?:number[];replayUsed?:number;planningAgreement01?:number}):void{
    if(!this.state.enabled)return;
    this.state.tick=i.tick;this.state.outcomes++;
    const ctx=Math.max(0,Math.min(this.contexts-1,Math.floor(i.contextId)));
    const ai=Math.max(0,ACTIONS.indexOf(i.action));
    const cal=this.state.actionCalibration[ai]!,cap=this.state.skillCapsules[ctx]!,samples=cal.samples+1;
    const rate=Math.min(.18,1.8/samples),actual=clamp(i.reward01),old=cal.prediction01;
    cal.prediction01=clamp(old+(actual-old)*rate);cal.absError01=clamp(cal.absError01*.90+Math.abs(actual-old)*.10);cal.signedError01=clamp(cal.signedError01*.94+(actual-old)*.06,-1,1);cal.uncertainty01=clamp(cal.uncertainty01*.93+Math.abs(actual-old)*.07);cal.confidence01=clamp(.10+Math.min(.86,samples/36)*(.70+.30*(1-cal.uncertainty01)));cal.samples=samples;
    const capsule=cap[ai]!,cs=capsule.visits+1,cr=Math.min(.22,2/cs);capsule.visits=cs;capsule.success01=clamp(capsule.success01+(actual-capsule.success01)*cr);capsule.predictionError01=clamp(capsule.predictionError01*.90+Math.abs(actual-old)*.10);capsule.confidence01=clamp(.08+Math.min(.88,cs/32)*(.72+.28*(1-capsule.predictionError01)));capsule.lastTick=i.tick;
    const prior=i.priorLatent??[],next=i.latent??[];
    for(let k=0;k<8;k++){
      const d=finite(next[k])-finite(prior[k]),fd=capsule.fastDelta[k]??0,sd=capsule.slowDelta[k]??0;
      capsule.fastDelta[k]=fd+(d-fd)*Math.min(.28,.04+.20*this.state.fastLearning01);
      capsule.slowDelta[k]=sd+(d-sd)*Math.min(.06,.01+.04*this.state.metaLearning01);
      capsule.centroid[k]=finite(capsule.centroid[k])+(finite(next[k])-finite(capsule.centroid[k]))*Math.min(.10,cr*.5);
    }
    const ensemble=distance(capsule.fastDelta,capsule.slowDelta)/1.15;
    this.state.ensembleDisagreement01=clamp(this.state.ensembleDisagreement01*.90+ensemble*.10);
    this.state.transitionUncertainty01=clamp(this.state.transitionUncertainty01*.92+(i.predictionError01*.55+ensemble*.45)*.08);
    this.state.modelCalibration01=clamp(this.state.modelCalibration01*.94+(1-i.predictionError01)*.06);
    const bestAlternative=this.bestAlternative(i.action,ctx),predAction=cal.prediction01,cfgap=bestAlternative-predAction;
    const regret=clamp((bestAlternative-actual)*.70+Math.max(0,cfgap)*.30);
    cal.regret01=clamp(cal.regret01*.90+regret*.10);this.state.counterfactualRegret01[ai]=clamp(this.state.counterfactualRegret01[ai]!* .88+regret*.12);this.state.counterfactualGap01=clamp(this.state.counterfactualGap01*.90+Math.max(0,cfgap)*.10);
    this.state.repetitionPenalty01=clamp(this.state.repetitionPenalty01*.94+(regret>.55?.08:0));
    this.state.taskTransfer01=clamp(this.state.taskTransfer01*.93+.07*(i.novelty01*(1-i.predictionError01)));
    if(regret>.42||i.predictionError01>.50||i.novelty01>.58)this.state.consolidationQueue.push(ctx);while(this.state.consolidationQueue.length>64)this.state.consolidationQueue.shift();
    const arm=this.state.selectedReplayArm,utility=clamp(.34*(1-i.predictionError01)+.24*actual+.18*i.novelty01+.14*this.state.antiForgetting01+.10*(1-this.state.ensembleDisagreement01));
    this.feedbackReplay(arm,utility);
    this.state.lastReason=`outcome=${i.action};ctx=${ctx};utility=${utility.toFixed(2)};regret=${regret.toFixed(2)};ensemble=${this.state.ensembleDisagreement01.toFixed(2)}`;
  }
  feedbackReplay(arm:number,utility01:number){
    const k=Math.max(0,Math.min(ARMS.length-1,Math.floor(arm))),a=this.state.replayArms[k]!;a.pulls++;a.lastUtility01=clamp(utility01);const lr=Math.min(.18,2/a.pulls);a.meanUtility01=clamp(a.meanUtility01+(a.lastUtility01-a.meanUtility01)*lr);a.uncertainty01=clamp(a.uncertainty01*.92+Math.abs(a.lastUtility01-a.meanUtility01)*.08);a.weight01=clamp(.04+a.meanUtility01*(.68+.20*(1-a.uncertainty01)),.04,.82);this.state.replayFeedbackCount++;
    const mix=normalize(this.state.replayArms.map(x=>x.weight01));this.state.replayMix01=mix;this.state.replayEntropy01=entropy01(mix);this.state.pendingReplayCredit01=clamp(this.state.pendingReplayCredit01*.90+utility01*.10);
  }
  consolidate(samples:Array<{contextId:number;reward01:number;priority01:number;latent?:number[];actionIndex?:number}>,budget:number){
    if(!this.state.enabled||budget<=0||samples.length===0){this.state.skippedWork++;return {used:0,gain01:0};}
    const sorted=samples.slice().sort((a,b)=>(b.priority01+b.reward01*.3)-(a.priority01+a.reward01*.3)).slice(0,budget);
    let gain=0;
    for(const s of sorted){const ai=Math.max(0,Math.min(ACTIONS.length-1,Math.floor(s.actionIndex??0)));const c=this.state.skillCapsules[Math.max(0,Math.min(this.contexts-1,s.contextId))]![ai]!;c.consolidation01=clamp(c.consolidation01*.92+.08*(s.reward01*.65+s.priority01*.35));gain+=c.consolidation01;}
    const g=clamp(gain/Math.max(1,sorted.length));this.state.consolidations+=sorted.length;this.state.consolidationGain01=clamp(this.state.consolidationGain01*.90+g*.10);return {used:sorted.length,gain01:g};
  }
  mobilePlan(resource01:number,thermal01=0,ram01=0){const pressure=clamp(.48*(1-resource01)+.34*thermal01+.18*ram01);const replayLimit=Math.max(0,Math.min(10,Math.floor(7*(1-pressure))));const structuralBudget01=clamp(.04+.20*(1-pressure)+.12*this.state.boundaryEvidence01,.03,.32);if(pressure>.72)this.state.skippedWork++;return {pressure01:pressure,replayLimit,structuralBudget01,hotState01:this.state.hotState01,coldCompression01:this.state.coldCompression01};}
  metrics(){return structuredClone(this.state);}
}
