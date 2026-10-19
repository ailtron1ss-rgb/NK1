import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const LATENT=8;
const CONTEXTS=8;
const TRACE_CAP=64;
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;
const zeros=(n:number)=>new Array(n).fill(0);
const dist=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>{const d=finite(x)-finite(b[i]);return s+d*d;},0)/Math.max(1,a.length));
const mean=(v:number[])=>v.length?v.reduce((s,x)=>s+finite(x),0)/v.length:0;

export interface P2774EpisodeTrace{
  tick:number;
  contextId:number;
  actionIndex:number;
  latent:number[];
  reward01:number;
  predictionError01:number;
  novelty01:number;
  verified01:number;
  importance01:number;
  recurrence01:number;
  modelTimeStamp:number;
  compact01:number;
}

export interface P2774State{
  version:1;
  enabled:boolean;
  tick:number;
  outcomes:number;
  modelTimeTotal:number;
  modelTimeDelta01:number;
  lastModelTimeDelta01:number;
  lastReplayModelTime:number;
  replayIntervalModelTime:number;
  replayDebt01:number;
  forgettingRisk01:number;
  replayDue01:number;
  replayBudget01:number;
  recurrence01:number;
  consolidationPressure01:number;
  episodicWrites:number;
  episodicCompactions:number;
  compactedTraces:number;
  replayEvents:number;
  replaySamples:number;
  consolidationEvents:number;
  bridgeUpdates:number;
  contextRecurrence:number[];
  actionRecurrence:number[][];
  contextSemantic:number[][];
  contextSemanticConfidence:number[];
  traces:P2774EpisodeTrace[];
}

export interface P2774DecisionInput{
  tick:number;
  contextId:number;
  baseUtilities:Record<ActionKind,number>;
  predictionError01:number;
  novelty01:number;
  uncertainty01:number;
  verification01:number;
  resource01:number;
}

export interface P2774DecisionOutput{
  actionBias:Record<ActionKind,number>;
  replayDue:boolean;
  replayBudget:number;
  replayPressure01:number;
  consolidationPressure01:number;
  modelTime01:number;
  forgettingRisk01:number;
  recurrence01:number;
  semanticConfidence01:number;
}

const defaultState=():P2774State=>({
  version:1,enabled:true,tick:0,outcomes:0,modelTimeTotal:0,modelTimeDelta01:0,lastModelTimeDelta01:0,
  lastReplayModelTime:0,replayIntervalModelTime:3.2,replayDebt01:0,forgettingRisk01:.18,replayDue01:0,
  replayBudget01:.42,recurrence01:0,consolidationPressure01:0,episodicWrites:0,episodicCompactions:0,
  compactedTraces:0,replayEvents:0,replaySamples:0,consolidationEvents:0,bridgeUpdates:0,
  contextRecurrence:new Array(CONTEXTS).fill(0),actionRecurrence:Array.from({length:CONTEXTS},()=>new Array(ACTIONS.length).fill(0)),
  contextSemantic:Array.from({length:CONTEXTS},()=>zeros(LATENT)),contextSemanticConfidence:new Array(CONTEXTS).fill(.1),traces:[]
});

export class P2774ModelTimeReplayConsolidator{
  private state:P2774State=defaultState();
  snapshot(){return structuredClone(this.state);}
  metrics(){return structuredClone(this.state);}
  setEnabled(v:boolean){this.state.enabled=!!v;}
  restore(raw?:Partial<P2774State>|null){
    const d=defaultState(),r:any=raw??{};
    const arr=(v:any,n:number,fill=0)=>Array.isArray(v)?v.slice(0,n).concat(new Array(Math.max(0,n-(v?.length??0))).fill(fill)).slice(0,n):new Array(n).fill(fill);
    const matrix=(v:any,rows:number,cols:number,fill=0)=>Array.from({length:rows},(_,i)=>arr(v?.[i],cols,fill));
    const traces:Array<P2774EpisodeTrace>=Array.isArray(r.traces)?r.traces.slice(-TRACE_CAP).map((e:any)=>({
      tick:Number(e?.tick??0),contextId:Math.max(0,Math.min(CONTEXTS-1,Math.floor(Number(e?.contextId??0)))),actionIndex:Math.max(0,Math.min(ACTIONS.length-1,Math.floor(Number(e?.actionIndex??0)))),
      latent:arr(e?.latent,LATENT),reward01:clamp(Number(e?.reward01??.5)),predictionError01:clamp(Number(e?.predictionError01??.5)),novelty01:clamp(Number(e?.novelty01??.5)),verified01:clamp(Number(e?.verified01??0)),
      importance01:clamp(Number(e?.importance01??.25)),recurrence01:clamp(Number(e?.recurrence01??0)),modelTimeStamp:Math.max(0,finite(Number(e?.modelTimeStamp??0))),compact01:clamp(Number(e?.compact01??0))
    })):[];
    this.state={...d,...structuredClone(r),version:1,contextRecurrence:arr(r.contextRecurrence,CONTEXTS),actionRecurrence:matrix(r.actionRecurrence,CONTEXTS,ACTIONS.length),contextSemantic:matrix(r.contextSemantic,CONTEXTS,LATENT),contextSemanticConfidence:arr(r.contextSemanticConfidence,CONTEXTS,.1),traces};
  }
  beforeDecision(i:P2774DecisionInput):P2774DecisionOutput{
    if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,replayDue:false,replayBudget:0,replayPressure01:0,consolidationPressure01:0,modelTime01:0,forgettingRisk01:0,recurrence01:0,semanticConfidence01:.1};
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(i.contextId)));
    this.state.tick=i.tick;
    const recurrence=clamp(this.state.contextRecurrence[ctx]??0);
    const semantic=this.state.contextSemanticConfidence[ctx]??.1;
    const error=clamp(i.predictionError01),novelty=clamp(i.novelty01),uncertainty=clamp(i.uncertainty01),resource=clamp(i.resource01);
    const pressure=clamp(.36*error+.24*novelty+.22*uncertainty+.10*(1-semantic)+.08*(1-resource));
    this.state.forgettingRisk01=clamp(this.state.forgettingRisk01*.92+pressure*.08);
    const interval=clamp(4.8-2.7*this.state.forgettingRisk01-1.25*novelty-.85*uncertainty+.55*resource,1.0,5.2);
    this.state.replayIntervalModelTime=clamp(this.state.replayIntervalModelTime*.82+interval*.18,1.0,5.2);
    this.state.replayDebt01=clamp((this.state.modelTimeTotal-this.state.lastReplayModelTime)/Math.max(.5,this.state.replayIntervalModelTime));
    this.state.replayDue01=clamp(this.state.replayDebt01);
    const due=this.state.replayDebt01>=1 || pressure>.73;
    const budgetBase=resource>.72?5:resource>.48?4:resource>.28?2:1;
    this.state.replayBudget01=clamp(this.state.replayBudget01*.88+clamp(.18*budgetBase+.62*this.state.replayDue01+.20*pressure)*.12);
    const replayBudget=due?Math.max(1,Math.min(6,Math.round(budgetBase*(.55+.85*this.state.replayDue01)))):0;
    this.state.consolidationPressure01=clamp(.28*recurrence+.26*semantic+.22*i.verification01+.16*(1-error)+.08*this.state.replayDue01);
    const actionBias:Record<ActionKind,number>=Object.fromEntries(ACTIONS.map((a,ai)=>{
      const local=this.state.actionRecurrence[ctx]?.[ai]??0;
      const semanticHint=this.state.contextSemantic[ctx]?.[ai%LATENT]??0;
      const bias=(local-.5)*.016+semanticHint*.008;
      const base=finite(i.baseUtilities[a]??.5);
      return [a,clamp(bias+(.5-base)*0.0,-.024,.024)];
    })) as Record<ActionKind,number>;
    const modelTime01=clamp(this.state.modelTimeTotal/(this.state.modelTimeTotal+24));
    return {actionBias,replayDue:due,replayBudget,replayPressure01:this.state.replayDue01,consolidationPressure01:this.state.consolidationPressure01,modelTime01,forgettingRisk01:this.state.forgettingRisk01,recurrence01:recurrence,semanticConfidence01:semantic};
  }
  observeOutcome(i:{tick:number;contextId:number;action:ActionKind;latentBefore:number[];latentAfter:number[];reward01:number;predictionError01:number;novelty01:number;verified01:number;worldModelDelta01?:number;causalDelta01?:number;}){
    if(!this.state.enabled)return;
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(i.contextId))),ai=Math.max(0,ACTIONS.indexOf(i.action));
    this.state.tick=i.tick;this.state.outcomes++;
    const transition=clamp(i.worldModelDelta01??0);const causal=clamp(i.causalDelta01??0);const rewardSurprise=clamp(Math.abs(i.reward01-.5)*2);
    const delta=clamp(.10+.34*i.predictionError01+.22*i.novelty01+.16*i.verified01+.10*transition+.08*causal+.04*rewardSurprise);
    this.state.lastModelTimeDelta01=delta;this.state.modelTimeDelta01=clamp(this.state.modelTimeDelta01*.85+delta*.15);this.state.modelTimeTotal+=.45+.55*delta;
    this.state.contextRecurrence[ctx]=clamp((this.state.contextRecurrence[ctx]??0)*.965+.035);
    for(let c=0;c<CONTEXTS;c++)if(c!==ctx)this.state.contextRecurrence[c]=clamp((this.state.contextRecurrence[c]??0)*.997);
    const prev=this.state.actionRecurrence[ctx]?.[ai]??0;this.state.actionRecurrence[ctx]![ai]=clamp(prev*.93+.07*(.35+.65*i.verified01));
    const recurrence=this.state.contextRecurrence[ctx]!,importance=clamp(.34*i.predictionError01+.24*i.novelty01+.18*i.verified01+.14*transition+.10*causal);
    const trace:P2774EpisodeTrace={tick:i.tick,contextId:ctx,actionIndex:ai,latent:i.latentBefore.slice(0,LATENT),reward01:clamp(i.reward01),predictionError01:clamp(i.predictionError01),novelty01:clamp(i.novelty01),verified01:clamp(i.verified01),importance01:importance,recurrence01:recurrence,modelTimeStamp:this.state.modelTimeTotal,compact01:0};
    this.state.traces.push(trace);this.state.episodicWrites++;
    if(this.state.traces.length>TRACE_CAP)this.compactOldest();
    const sem=this.state.contextSemantic[ctx]!;const conf=this.state.contextSemanticConfidence[ctx]??.1;const consolidate=recurrence>.28&&this.state.consolidationPressure01>.38;
    if(consolidate){const rate=.015+.035*this.state.consolidationPressure01;for(let k=0;k<LATENT;k++)sem[k]=finite(sem[k])+(finite(i.latentBefore[k])-finite(sem[k]))*rate;this.state.contextSemanticConfidence[ctx]=clamp(conf*.97+(1-i.predictionError01)*.03+.01*recurrence);this.state.consolidationEvents++;this.state.bridgeUpdates++;}
    this.state.forgettingRisk01=clamp(this.state.forgettingRisk01*.94+clamp(importance*.62+(1-i.verified01)*.38)*.06);
  }
  private compactOldest(){
    const oldest=this.state.traces.shift();if(!oldest)return;
    const peer=this.state.traces.find(t=>t.contextId===oldest.contextId&&t.actionIndex===oldest.actionIndex);
    if(peer){for(let k=0;k<LATENT;k++)peer.latent[k]=finite(peer.latent[k])*.82+finite(oldest.latent[k])*.18;peer.importance01=Math.max(peer.importance01,oldest.importance01*.92);peer.recurrence01=clamp(peer.recurrence01*.94+.06*oldest.recurrence01);peer.compact01=clamp(peer.compact01*.8+.2);}
    else{oldest.latent=oldest.latent.map(v=>Math.round(finite(v)*100)/100);oldest.compact01=1;this.state.traces.unshift(oldest);this.state.traces=this.state.traces.slice(-TRACE_CAP);}
    this.state.episodicCompactions++;this.state.compactedTraces++;
  }
  replayPlan(resource01:number){
    const r=clamp(resource01),due=this.state.replayDebt01>=1||this.state.forgettingRisk01>.72;
    const maxSamples=due?Math.max(1,Math.min(6,Math.round((r>.72?5:r>.46?3:2)*(.65+.65*this.state.replayDue01)))):0;
    return {due,maxSamples,pressure01:this.state.replayDue01,forgettingRisk01:this.state.forgettingRisk01,modelTimeAge:this.state.modelTimeTotal-this.state.lastReplayModelTime};
  }
  scoreSample(sample:{tick?:number;contextId?:number;action?:ActionKind;priority01:number;predictionError01:number;verified01?:number;novelty01?:number}){
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(Number(sample.contextId??0))));
    const latest=this.state.traces.filter(t=>t.contextId===ctx).sort((a,b)=>b.modelTimeStamp-a.modelTimeStamp)[0];
    const age=Math.max(0,this.state.modelTimeTotal-(latest?.modelTimeStamp??0));
    const forgetting=1-Math.exp(-age/Math.max(.55,1.25+1.8*(1-this.state.forgettingRisk01)));
    const recurrence=this.state.contextRecurrence[ctx]??0;
    return clamp(.28*sample.priority01+.22*sample.predictionError01+.16*(sample.novelty01??0)+.12*(sample.verified01??0)+.12*forgetting+.10*recurrence);
  }
  noteReplay(count:number){
    if(count<=0)return;
    this.state.replayEvents++;this.state.replaySamples+=count;this.state.lastReplayModelTime=this.state.modelTimeTotal;this.state.replayDebt01=0;this.state.replayDue01=0;
  }
  semanticReadout(contextId:number){
    const ctx=Math.max(0,Math.min(CONTEXTS-1,Math.floor(contextId))),v=this.state.contextSemantic[ctx]??zeros(LATENT);
    return {vector:v.slice(),confidence01:this.state.contextSemanticConfidence[ctx]??.1,consolidationPressure01:this.state.consolidationPressure01};
  }
}
