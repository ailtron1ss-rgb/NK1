import type { ActionKind } from '../core/types.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
export interface GroundingChannel { id:string; reliability01:number; freshness01:number; contradiction01:number; observations:number; confirmed:number; lastTick:number; }
export interface ExternalGroundingAdaptiveControllerState { version:1; tick:number; decisions:number; observations:number; confirmations:number; contradictions:number; activeQueries:number; channelLearningUpdates:number; grounding01:number; sensorConsensus01:number; freshness01:number; contradiction01:number; activePerceptionGain01:number; externalTransfer01:number; selectedChannel:string|null; channels:GroundingChannel[]; }
const d=():ExternalGroundingAdaptiveControllerState=>({version:1,tick:0,decisions:0,observations:0,confirmations:0,contradictions:0,activeQueries:0,channelLearningUpdates:0,grounding01:.3,sensorConsensus01:.3,freshness01:.3,contradiction01:0,activePerceptionGain01:.2,externalTransfer01:.2,selectedChannel:null,channels:[]});
export class ExternalGroundingAdaptiveController {
 private state=d(); readonly maxChannels=24;
 snapshot(){return deep(this.state)}
 restore(raw?:Partial<ExternalGroundingAdaptiveControllerState>|null){const r:any=raw??{};this.state={...d(),...deep(r),version:1,channels:Array.isArray(r.channels)?r.channels.slice(-this.maxChannels).map((x:any)=>({...x,reliability01:clamp(Number(x.reliability01??.5)),freshness01:clamp(Number(x.freshness01??.5)),contradiction01:clamp(Number(x.contradiction01??0)),observations:Math.max(0,Number(x.observations)||0),confirmed:Math.max(0,Number(x.confirmed)||0),lastTick:Math.max(0,Number(x.lastTick)||0)})):[]};}
 private channel(id:string){let c=this.state.channels.find(x=>x.id===id);if(!c){c={id:id.slice(0,80),reliability01:.5,freshness01:.5,contradiction01:0,observations:0,confirmed:0,lastTick:0};this.state.channels.push(c);if(this.state.channels.length>this.maxChannels)this.state.channels.shift();}return c;}
 beforeDecision(i:{tick:number;sensors?:Record<string,{tick:number;values:number[];freshness01:number;confidence01:number;ageTicks:number;source:string}>;uncertainty01:number;novelty01:number;predictionError01:number;computeBudget01:number}):{actionBias:Record<ActionKind,number>;grounding01:number;consensus01:number;activeQuery:string|null;selectedChannel:string|null;freshness01:number;contradiction01:number;externalTransfer01:number}{
  this.state.tick=i.tick;this.state.decisions++;const sensors=i.sensors??{};const entries=Object.entries(sensors).slice(0,16);
  for(const [id,s] of entries){const c=this.channel(id);c.freshness01=clamp(c.freshness01*.9+clamp(s.freshness01)*.1);c.lastTick=i.tick;}
  const usable=entries.map(([id,s])=>({id,s,c:this.channel(id),score:clamp(.48*s.confidence01+.28*s.freshness01+.24*(1-this.channel(id).contradiction01))*this.channel(id).reliability01})).sort((a,b)=>b.score-a.score);
  const selected=usable[0];this.state.selectedChannel=selected?.id??null;const mean=usable.length?usable.reduce((a,x)=>a+x.score,0)/usable.length:.15;const spread=usable.length>1?usable.reduce((a,x)=>a+Math.abs(x.score-mean),0)/usable.length:0;
  const fresh=usable.length?usable.reduce((a,x)=>a+x.s.freshness01,0)/usable.length:0;const contra=usable.length?usable.reduce((a,x)=>a+x.c.contradiction01,0)/usable.length:0;
  const grounding=clamp(mean*.65+fresh*.2+(1-contra)*.15);this.state.grounding01=clamp(this.state.grounding01*.94+grounding*.06);this.state.sensorConsensus01=clamp(this.state.sensorConsensus01*.94+(1-spread)*.06);this.state.freshness01=clamp(this.state.freshness01*.94+fresh*.06);this.state.contradiction01=clamp(this.state.contradiction01*.94+contra*.06);this.state.externalTransfer01=clamp(this.state.externalTransfer01*.96+grounding*.04);
  const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;const ambiguity=clamp(i.uncertainty01*.45+i.predictionError01*.35+(1-this.state.sensorConsensus01)*.2);let activeQuery:string|null=null;
  if(usable.length===0||grounding<.48){bias.verify+=.035*ambiguity;bias.explore+=.018*i.novelty01;activeQuery=selected?.id??null;this.state.activeQueries++;}
  if(fresh<.42&&i.computeBudget01>.4){bias.explore+=.018;activeQuery=activeQuery??selected?.id??null;}
  if(contra>.35){bias.verify+=.03;bias.defer+=.012;}
  this.state.activePerceptionGain01=clamp(this.state.activePerceptionGain01*.93+(ambiguity*(activeQuery?1:.25))*.07);
  return {actionBias:bias,grounding01:this.state.grounding01,consensus01:this.state.sensorConsensus01,activeQuery,selectedChannel:this.state.selectedChannel,freshness01:this.state.freshness01,contradiction01:this.state.contradiction01,externalTransfer01:this.state.externalTransfer01};
 }
 afterOutcome(i:{tick:number;action:ActionKind;reward01:number;verified01:number;predictionError01:number;sensors?:Record<string,{tick:number;values:number[];freshness01:number;confidence01:number;ageTicks:number;source:string}>;observedContradiction01?:number}){
  const reward=clamp(i.reward01),verified=clamp(i.verified01),error=clamp(i.predictionError01),contradiction=clamp(i.observedContradiction01??0);
  const quality=clamp(reward*.45+verified*.35+(1-error)*.20);
  const ids=Object.keys(i.sensors??{});
  this.state.observations+=ids.length;
  this.state.confirmations+=verified>.7?1:0;
  this.state.contradictions+=contradiction>.5?1:0;
  for(const id of ids){
    const c=this.channel(id),eta=.03/Math.sqrt(c.observations+1);
    c.observations++;
    if(verified>.65)c.confirmed++;
    c.reliability01=clamp(c.reliability01+eta*(quality-c.reliability01));
    c.contradiction01=clamp(c.contradiction01*.94+contradiction*.06);
    c.freshness01=clamp(c.freshness01*.94+clamp(i.sensors?.[id]?.freshness01??0)*.06);
    this.state.channelLearningUpdates++;
  }
  this.state.externalTransfer01=clamp(this.state.externalTransfer01*.95+quality*.05);
 }
 metrics(){return {...deep(this.state),channelCount:this.state.channels.length,verifiedRate:this.state.confirmations/Math.max(1,this.state.observations),contradictionRate:this.state.contradictions/Math.max(1,this.state.decisions)}}
}
export const defaultExternalGroundingAdaptiveController=()=>d();
