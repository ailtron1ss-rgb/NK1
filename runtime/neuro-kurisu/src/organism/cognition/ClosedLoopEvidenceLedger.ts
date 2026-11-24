import type { ActionKind } from '../core/types.ts';
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
export interface EvidenceEpisode {id:string;tick:number;action:ActionKind;predicted01:number;observed01:number;reward01:number;verified01:number;predictionError01:number;contradiction01:number;grounding01:number;informationGain01:number;causalCredit01:number;sourceIds:string[];}
export interface ClosedLoopEvidenceLedgerState {version:1;episodes:EvidenceEpisode[];writes:number;verified:number;contradictions:number;causalUpdates:number;meanGrounding01:number;meanInformationGain01:number;closedLoopQuality01:number;lastEpisodeId:string|null;}
const d=():ClosedLoopEvidenceLedgerState=>({version:1,episodes:[],writes:0,verified:0,contradictions:0,causalUpdates:0,meanGrounding01:.3,meanInformationGain01:.15,closedLoopQuality01:.3,lastEpisodeId:null});
export class ClosedLoopEvidenceLedger {
 private state=d();readonly maxEpisodes=512;
 snapshot(){return deep(this.state)}
 restore(raw?:Partial<ClosedLoopEvidenceLedgerState>|null){const r:any=raw??{};this.state={...d(),...deep(r),version:1,episodes:Array.isArray(r.episodes)?r.episodes.slice(-this.maxEpisodes):[]};}
 record(i:{tick:number;action:ActionKind;predicted01:number;observed01:number;reward01:number;verified01:number;predictionError01:number;contradiction01:number;grounding01:number;informationGain01:number;causalCredit01:number;sourceIds?:string[]}){const e:EvidenceEpisode={
      id:`e${i.tick}-${this.state.writes+1}`, tick:i.tick, action:i.action,
      predicted01:clamp(i.predicted01), observed01:clamp(i.observed01), reward01:clamp(i.reward01),
      verified01:clamp(i.verified01), predictionError01:clamp(i.predictionError01),
      contradiction01:clamp(i.contradiction01), grounding01:clamp(i.grounding01),
      informationGain01:clamp(i.informationGain01), causalCredit01:clamp(i.causalCredit01),
      sourceIds:(i.sourceIds??[]).slice(0,16)
    };this.state.episodes.push(e);if(this.state.episodes.length>this.maxEpisodes)this.state.episodes.shift();this.state.writes++;if(e.verified01>.65)this.state.verified++;if(e.contradiction01>.5)this.state.contradictions++;this.state.causalUpdates+=e.causalCredit01>.35?1:0;this.state.meanGrounding01=clamp(this.state.meanGrounding01*.97+e.grounding01*.03);this.state.meanInformationGain01=clamp(this.state.meanInformationGain01*.97+e.informationGain01*.03);const q=clamp(.25*e.verified01+.25*(1-e.predictionError01)+.20*e.grounding01+.15*e.informationGain01+.15*e.causalCredit01-e.contradiction01*.12);this.state.closedLoopQuality01=clamp(this.state.closedLoopQuality01*.95+q*.05);this.state.lastEpisodeId=e.id;return e;}
 metrics(){return {...deep(this.state),episodeCount:this.state.episodes.length,verificationRate:this.state.verified/Math.max(1,this.state.writes),contradictionRate:this.state.contradictions/Math.max(1,this.state.writes)}}
}
export const defaultClosedLoopEvidenceLedger=()=>d();
