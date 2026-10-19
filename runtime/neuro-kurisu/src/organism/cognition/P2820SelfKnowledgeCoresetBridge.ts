import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const CONTEXTS=8;
const LATENT=8;
const CORESET_CAP=96;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const zeros=(n:number)=>new Array(n).fill(0);
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+finite(b),0)/v.length:0;
const distance=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>{const d=finite(x)-finite(b[i]);return s+d*d;},0)/Math.max(1,a.length));
const deep=<T>(x:T):T=>structuredClone(x);

export interface P2820Trace{
  tick:number;
  contextId:number;
  actionIndex:number;
  latent:number[];
  reward01:number;
  predictionError01:number;
  novelty01:number;
  verified01:number;
  teacherDisagreement01:number;
  importance01:number;
  utility01:number;
  selectedCount:number;
}

export interface P2820State{
  version:1;
  enabled:boolean;
  tick:number;
  outcomes:number;
  teacherUpdates:number;
  distillEvents:number;
  coresetWrites:number;
  coresetCompactions:number;
  replaySelections:number;
  replayRejected:number;
  contexts:number;
  teacherLogits:number[][];
  teacherConfidence01:number[];
  contextRecurrence01:number[];
  contextCalibration01:number[];
  studentTeacherAgreement01:number;
  calibration01:number;
  distillScale01:number;
  compatibility01:number;
  coresetUtility01:number;
  coresetDiversity01:number;
  staleTeacher01:number;
  resourcePressure01:number;
  /** P2836: lightweight fast/slow memory thermostat inspired by test-time memory research. */
  surpriseMemory01:number;
  fastMemoryMass01:number;
  slowTeacherDrift01:number;
  replayThermostat01:number;
  replayAllocationCount:number;
  traces:P2820Trace[];
}

export interface P2820DecisionInput{
  tick:number;
  contextId:number;
  baseUtilities:Record<ActionKind,number>;
  studentBias:Record<ActionKind,number>;
  predictionError01:number;
  uncertainty01:number;
  novelty01:number;
  forgetting01:number;
  worldConfidence01:number;
  replayPressure01:number;
  resource01:number;
}

export interface P2820DecisionOutput{
  actionBias:Record<ActionKind,number>;
  teacherConfidence01:number;
  distillScale01:number;
  replayCompatibility01:number;
  coresetBudget:number;
  calibration01:number;
  agreement01:number;
}

const defaultState=(coreset=CORESET_CAP):P2820State=>({
  version:1,enabled:true,tick:0,outcomes:0,teacherUpdates:0,distillEvents:0,coresetWrites:0,coresetCompactions:0,replaySelections:0,replayRejected:0,
  contexts:CONTEXTS,teacherLogits:Array.from({length:CONTEXTS},()=>zeros(ACTIONS.length)),teacherConfidence01:new Array(CONTEXTS).fill(.22),
  contextRecurrence01:new Array(CONTEXTS).fill(.08),contextCalibration01:new Array(CONTEXTS).fill(.5),studentTeacherAgreement01:.5,calibration01:.5,
  distillScale01:.08,compatibility01:.7,coresetUtility01:.35,coresetDiversity01:1,staleTeacher01:0,resourcePressure01:.2,surpriseMemory01:.25,fastMemoryMass01:.25,slowTeacherDrift01:0,replayThermostat01:.5,replayAllocationCount:0,traces:[]
});

const P2820StateFactory=()=>defaultState();

export class P2820SelfKnowledgeCoresetBridge{
  private state=P2820StateFactory();
  constructor(){this.state=P2820StateFactory();}
  snapshot(){return deep(this.state);}
  metrics(){return deep(this.state);}
  setEnabled(v:boolean){this.state.enabled=!!v;}
  restore(raw?:Partial<P2820State>|null){
    const d=defaultState(),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-(v?.length??0))).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.from({length:rows},(_,i)=>arr(v?.[i],cols,fill));
    const traces=Array.isArray(r.traces)?r.traces.slice(-CORESET_CAP).map((t:any)=>({
      tick:Math.max(0,Number(t?.tick)||0),contextId:Math.max(0,Math.min(CONTEXTS-1,Number(t?.contextId)||0)),actionIndex:Math.max(0,Math.min(ACTIONS.length-1,Number(t?.actionIndex)||0)),
      latent:arr(t?.latent,LATENT),reward01:clamp(Number(t?.reward01??.5)),predictionError01:clamp(Number(t?.predictionError01??.5)),novelty01:clamp(Number(t?.novelty01??.2)),verified01:clamp(Number(t?.verified01??0)),
      teacherDisagreement01:clamp(Number(t?.teacherDisagreement01??.5)),importance01:clamp(Number(t?.importance01??.2)),utility01:clamp(Number(t?.utility01??.2)),selectedCount:Math.max(0,Number(t?.selectedCount)||0)
    })):[];
    this.state={...d,...deep(r),version:1,contexts:CONTEXTS,teacherLogits:matrix(r.teacherLogits,CONTEXTS,ACTIONS.length),teacherConfidence01:arr(r.teacherConfidence01,CONTEXTS,.22),contextRecurrence01:arr(r.contextRecurrence01,CONTEXTS,.08),contextCalibration01:arr(r.contextCalibration01,CONTEXTS,.5),traces};
  }

  private teacherPreference(contextId:number):{scores:number[];confidence:number}{
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(contextId)));
    const logits=this.state.teacherLogits[ctx]??zeros(ACTIONS.length);
    const centered=logits.map(v=>finite(v));
    const mx=Math.max(...centered,0);const ex=centered.map(v=>Math.exp(Math.max(-5,Math.min(5,v-mx))));const z=ex.reduce((a,b)=>a+b,0)||1;const probs=ex.map(v=>v/z);
    const entropy=-probs.reduce((s,p)=>s+(p>1e-9?p*Math.log(p):0),0)/Math.log(ACTIONS.length);
    return {scores:probs,confidence:clamp((this.state.teacherConfidence01[ctx]??.22)*(.45+.55*(1-entropy)))};
  }

  beforeDecision(i:P2820DecisionInput):P2820DecisionOutput{
    if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,teacherConfidence01:0,distillScale01:0,replayCompatibility01:1,coresetBudget:0,calibration01:.5,agreement01:.5};
    const previousTick=this.state.tick;
    this.state.tick=i.tick;
    this.state.resourcePressure01=clamp(.82*this.state.resourcePressure01+.18*(1-i.resource01));
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(i.contextId)));
    const tp=this.teacherPreference(ctx);
    const modelTrust=clamp(.34+.42*i.worldConfidence01+.18*(1-i.predictionError01)+.06*(1-i.uncertainty01));
    const freshness=clamp(1-this.state.staleTeacher01);
    const compatibility=clamp(.20+.42*modelTrust+.18*(1-i.novelty01)+.12*(1-i.replayPressure01)+.08*i.resource01);
    this.state.compatibility01=clamp(.88*this.state.compatibility01+.12*compatibility);
    const thermostat=clamp(.28+.58*(i.predictionError01*.55+i.uncertainty01*.25+i.novelty01*.20)-.22*(1-i.resource01));
    this.state.replayThermostat01=clamp(this.state.replayThermostat01*.92+thermostat*.08);
    const distill=clamp((.035+.09*tp.confidence+.04*(1-i.predictionError01)-.05*i.novelty01)*compatibility*freshness*(.82+.28*this.state.replayThermostat01),.015,.16);
    this.state.distillScale01=clamp(.92*this.state.distillScale01+.08*distill,.01,.18);
    const recurrence=clamp(this.state.contextRecurrence01[ctx]??.08);
    const budget=i.resource01>.72?6:i.resource01>.48?4:i.resource01>.26?3:1;
    const coresetBudget=Math.max(1,Math.min(6,Math.round(budget*(.55+.55*recurrence+.35*tp.confidence+.30*this.state.replayThermostat01))));
    const base=ACTIONS.map(a=>finite(i.baseUtilities[a]??.5));
    const student=ACTIONS.map(a=>finite(i.studentBias[a]??0));
    const teacher=tp.scores;
    const actionBias:Record<ActionKind,number>=Object.fromEntries(ACTIONS.map((a,ai)=>{
      const teacherCentered=teacher[ai]??(1/ACTIONS.length);
      const studentCentered=student[ai]??0;
      const valueHint=clamp(base[ai]-.5,-.5,.5)*.025;
      const raw=(teacherCentered-1/ACTIONS.length)*this.state.distillScale01 + studentCentered*.016 + valueHint;
      return [a,clamp(raw,-.045,.045)];
    })) as Record<ActionKind,number>;
    const studentTop=ACTIONS.reduce((best,a,idx)=>(student[idx]??0)>(student[best]??0)?idx:best,0);
    const teacherTop=teacher.reduce((best,v,idx)=>v>(teacher[best]??0)?idx:best,0);
    const agreement=clamp((studentTop===teacherTop?.72:.28) + Math.min(.28,Math.abs((student[studentTop]??0)-(student[teacherTop]??0))*.9));
    this.state.studentTeacherAgreement01=clamp(this.state.studentTeacherAgreement01*.94+agreement*.06);
    this.state.calibration01=clamp(this.state.calibration01*.96+((1-i.predictionError01)*.55+tp.confidence*.45)*.04);
    this.state.staleTeacher01=clamp(this.state.staleTeacher01*.97+.03*(i.tick-previousTick>4?1:0));
    const compatibilityGate=clamp(.20+.80*this.state.compatibility01*(.55+.45*freshness),.18,1);
    return {actionBias,teacherConfidence01:tp.confidence,distillScale01:this.state.distillScale01,replayCompatibility01:compatibilityGate,coresetBudget,calibration01:this.state.calibration01,agreement01:this.state.studentTeacherAgreement01};
  }

  observeOutcome(i:{tick:number;contextId:number;action:ActionKind;reward01:number;predictionError01:number;novelty01:number;verified01:number;uncertainty01:number;studentConfidence01?:number;studentBias?:Record<ActionKind,number>;latent:number[];replayPriority01?:number}){
    if(!this.state.enabled)return;
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(i.contextId))),ai=Math.max(0,ACTIONS.indexOf(i.action));
    this.state.tick=i.tick;this.state.outcomes++;
    const reward=clamp(i.reward01),error=clamp(i.predictionError01),novelty=clamp(i.novelty01),verified=clamp(i.verified01),uncertainty=clamp(i.uncertainty01);
    this.state.surpriseMemory01=clamp(this.state.surpriseMemory01*.90+(error*.60+novelty*.25+(1-verified)*.15)*.10);
    const previousTeacher=this.state.teacherLogits[ctx]?.slice() ?? zeros(ACTIONS.length);
    const logits=this.state.teacherLogits[ctx]!;
    const target=(reward-.5)*1.8+verified*.46-error*.62+novelty*.16;
    const eta=clamp(.012+.032*verified+.018*(1-error)-.010*uncertainty,.006,.06);
    for(let a=0;a<ACTIONS.length;a++){
      const selected=a===ai?1:-.12;
      logits[a]=clamp(finite(logits[a])+(target*selected*eta),-2.2,2.2);
    }
    this.state.teacherUpdates++;
    const teacherShift=distance(previousTeacher,logits)/2;
    this.state.slowTeacherDrift01=clamp(this.state.slowTeacherDrift01*.96+teacherShift*.04);
    this.state.fastMemoryMass01=clamp(this.state.fastMemoryMass01*.94+(.35*error+.30*novelty+.20*(1-verified)+.15*this.state.replayThermostat01)*.06);
    const tp=this.teacherPreference(ctx);
    const predicted=tp.scores[ai]??1/ACTIONS.length;
    const teacherDisagreement=clamp(Math.abs(predicted-(.5+target*.12)));
    const studentConfidence=clamp(i.studentConfidence01??(1-error));
    const agreement=clamp(1-Math.abs(studentConfidence-predicted));
    this.state.studentTeacherAgreement01=clamp(this.state.studentTeacherAgreement01*.93+agreement*.07);
    const calibrated=clamp((1-error)*.60+verified*.25+(1-Math.abs(predicted-.5))*.15);
    this.state.contextCalibration01[ctx]=clamp((this.state.contextCalibration01[ctx]??.5)*.93+calibrated*.07);
    this.state.teacherConfidence01[ctx]=clamp((this.state.teacherConfidence01[ctx]??.22)*.94+((1-error)*.45+verified*.30+(1-uncertainty)*.25)*.06,.05,.98);
    this.state.contextRecurrence01[ctx]=clamp((this.state.contextRecurrence01[ctx]??.08)*.965+.035);
    for(let c=0;c<CONTEXTS;c++)if(c!==ctx)this.state.contextRecurrence01[c]=clamp((this.state.contextRecurrence01[c]??.08)*.997);
    const utility=clamp(.26*i.novelty01+.22*error+.18*verified+.16*teacherDisagreement+.10*(1-studentConfidence)+.08*(1-this.state.contextRecurrence01[ctx]));
    this.state.coresetUtility01=clamp(this.state.coresetUtility01*.95+utility*.05);
    const trace:P2820Trace={tick:i.tick,contextId:ctx,actionIndex:ai,latent:i.latent.slice(0,LATENT),reward01:reward,predictionError01:error,novelty01:novelty,verified01:verified,teacherDisagreement01:teacherDisagreement,importance01:utility,utility01:utility,selectedCount:0};
    this.state.traces.push(trace);this.state.coresetWrites++;
    if(this.state.traces.length>CORESET_CAP)this.compactCoreset();
  }

  replayAllocation(input:{resource01:number;predictionError01:number;novelty01:number;grounding01:number;transferRisk01:number;contextMatch01?:number}){
    if(!this.state.enabled)return {fastBudget:1,slowBudget:1,fastBudget01:.15,slowBudget01:.15,distillScale01:0,temperature01:.7,reason:'bridge-disabled'};
    const r=clamp(input.resource01),u=clamp(input.predictionError01),n=clamp(input.novelty01),g=clamp(input.grounding01),t=clamp(input.transferRisk01),c=clamp(input.contextMatch01??.5);
    const urgency=clamp(.30*u+.24*n+.16*(1-g)+.14*t+.10*this.state.fastMemoryMass01+.06*(1-c));
    const available=clamp(.25+.75*r);
    const fast01=clamp((.34+.82*urgency)*available*(1-.18*t),.05,.95);
    const slow01=clamp((.24+.58*(1-u)+.38*this.state.slowTeacherDrift01)*available*(.78+.22*g),.05,.9);
    this.state.replayAllocationCount++;
    const fastBudget=Math.max(1,Math.min(12,Math.round(1+fast01*10)));
    const slowBudget=Math.max(1,Math.min(10,Math.round(1+slow01*8)));
    const temperature=clamp(.55+.35*urgency-.18*r+.10*this.state.surpriseMemory01,.20,1);
    return {fastBudget,slowBudget,fastBudget01:fast01,slowBudget01:slow01,distillScale01:this.state.distillScale01*(.82+.28*slow01),temperature01:temperature,reason:urgency>.68?'high-surprise-fast-replay':t>.6?'high-transfer-risk-conservative-replay':r<.35?'resource-constrained-replay':'balanced-fast-slow-replay'};
  }

  rankReplaySamples<T extends {tick:number;contextId:number;action:ActionKind;priority01:number;predictionError01:number;verified01:number;novelty01:number;latent:number[]}>(samples:T[],activeContextId:number,resource01:number,limit:number):T[]{
    if(!this.state.enabled)return samples.slice(0,limit);
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(activeContextId)));
    const anchor=this.state.traces.find(t=>t.contextId===ctx)?.latent??zeros(LATENT);
    const traceCounts=new Map<string,number>();
    for(const t of this.state.traces){
      const key=`${t.contextId}:${t.actionIndex}`;
      traceCounts.set(key,(traceCounts.get(key)??0)+1);
    }
    const scored=samples.map((s,index)=>{
      const similarity=clamp(1-distance(s.latent.slice(0,LATENT),anchor));
      const age=Math.max(0,this.state.tick-(Number(s.tick)||this.state.tick));
      const ageValue=1-Math.exp(-age/Math.max(8,24*(1+this.state.resourcePressure01)));
      const duplicatePenalty=1/((traceCounts.get(`${s.contextId}:${ACTIONS.indexOf(s.action)}`)??0)+1);
      const score=clamp((.20*s.priority01+.20*s.predictionError01+.18*s.novelty01+.12*s.verified01+.10*similarity+.08*(1-duplicatePenalty)+.05*ageValue+.07*(s.contextId===ctx?1:.2))*(.78+.34*this.state.replayThermostat01)+.06*this.state.surpriseMemory01);
      return {s,index,score};
    }).sort((a,b)=>b.score-a.score);
    const out=[] as typeof samples;
    const perContext=new Map<number,number>();
    for(const x of scored){
      if(out.length>=limit)break;
      const c=x.s.contextId,count=perContext.get(c)??0;
      if(count>=Math.max(1,Math.ceil(limit/3)) && x.s.contextId!==ctx)continue;
      perContext.set(c,count+1);out.push(x.s);this.state.replaySelections++;
    }
    this.state.coresetDiversity01=clamp(.92*this.state.coresetDiversity01+.08*(perContext.size/Math.max(1,Math.min(3,limit))));
    return out;
  }

  replayCompatibility(extra:{contextMatch01:number;worldConfidence01:number;predictionError01:number;resource01:number;teacherConfidence01?:number}):number{
    if(!this.state.enabled)return 1;
    const teacher=clamp(extra.teacherConfidence01??mean(this.state.teacherConfidence01));
    const risk=clamp(.30*(1-clamp(extra.contextMatch01))+.24*clamp(extra.predictionError01)+.18*(1-clamp(extra.worldConfidence01))+.14*(1-clamp(extra.resource01))+.14*(1-teacher));
    const gate=clamp(1-.78*risk,.16,1);
    if(gate<.44)this.state.replayRejected++;
    return gate;
  }

  distillWeight(current:number,contextId:number,actionIndex:number,scale01:number,importance01:number){
    if(!this.state.enabled)return finite(current);
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(contextId))),ai=Math.max(0,Math.min(ACTIONS.length-1,Math.floor(actionIndex)));
    const teacher=this.state.teacherLogits[ctx]?.[ai]??0;
    const normalized=Math.tanh(teacher*.42);
    const blend=clamp(scale01*(.65+.35*this.state.teacherConfidence01[ctx])*(1-.35*clamp(importance01)),.01,.18);
    this.state.distillEvents++;
    return clamp(finite(current)+(normalized-finite(current))*blend,-.25,.25);
  }

  private compactCoreset(){
    if(this.state.traces.length<=CORESET_CAP)return;
    this.state.traces.sort((a,b)=>(b.utility01+b.teacherDisagreement01*.4)-(a.utility01+a.teacherDisagreement01*.4));
    const keep=Math.max(32,Math.floor(CORESET_CAP*.78));
    const kept=this.state.traces.slice(0,keep);
    const seen=new Set<string>();
    const dedup:P2820Trace[]=[];
    for(const t of kept){
      const key=`${t.contextId}:${t.actionIndex}:${Math.round((t.latent[0]??0)*10)}`;
      if(seen.has(key)){this.state.coresetCompactions++;continue;}
      seen.add(key);dedup.push(t);
    }
    this.state.traces=dedup.slice(0,CORESET_CAP);
    this.state.coresetCompactions++;
  }
}

export const defaultP2820SelfKnowledgeCoresetBridge=()=>defaultState();
