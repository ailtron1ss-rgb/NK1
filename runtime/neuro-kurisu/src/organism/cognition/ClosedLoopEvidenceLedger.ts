import type { ActionKind } from '../core/types.ts';
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const strList=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,cap):[];
const sanEpisode=(x:unknown):EvidenceEpisode|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,160),tick:cnt(r.tick,0),action:(['respond','explore','verify','rest','reflect','wait','defer'] as ActionKind[]).includes(r.action as ActionKind)?r.action as ActionKind:'wait',predicted01:clamp(finN(r.predicted01,0)),observed01:clamp(finN(r.observed01,0)),reward01:clamp(finN(r.reward01,0)),verified01:clamp(finN(r.verified01,0)),predictionError01:clamp(finN(r.predictionError01,0)),contradiction01:clamp(finN(r.contradiction01,0)),grounding01:clamp(finN(r.grounding01,0)),informationGain01:clamp(finN(r.informationGain01,0)),causalCredit01:clamp(finN(r.causalCredit01,0)),sourceIds:strList(r.sourceIds,16)};};
export interface EvidenceEpisode {id:string;tick:number;action:ActionKind;predicted01:number;observed01:number;reward01:number;verified01:number;predictionError01:number;contradiction01:number;grounding01:number;informationGain01:number;causalCredit01:number;sourceIds:string[];}
export interface ClosedLoopEvidenceLedgerState {version:1;episodes:EvidenceEpisode[];writes:number;verified:number;contradictions:number;causalUpdates:number;meanGrounding01:number;meanInformationGain01:number;closedLoopQuality01:number;lastEpisodeId:string|null;}
const d=():ClosedLoopEvidenceLedgerState=>({version:1,episodes:[],writes:0,verified:0,contradictions:0,causalUpdates:0,meanGrounding01:.3,meanInformationGain01:.15,closedLoopQuality01:.3,lastEpisodeId:null});
export class ClosedLoopEvidenceLedger {
 private state=d();readonly maxEpisodes=512;
 snapshot(){return deep(this.state)}
 restore(raw?:Partial<ClosedLoopEvidenceLedgerState>|null){const def=d();const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let episodes:EvidenceEpisode[]=[];try{const e=read('episodes');if(Array.isArray(e))episodes=e.slice(-this.maxEpisodes).map(sanEpisode).filter((x):x is EvidenceEpisode=>x!==null);}catch{episodes=[];}const le=read('lastEpisodeId');this.state={version:1,episodes,writes:cnt(read('writes'),def.writes),verified:cnt(read('verified'),def.verified),contradictions:cnt(read('contradictions'),def.contradictions),causalUpdates:cnt(read('causalUpdates'),def.causalUpdates),meanGrounding01:clamp(finN(read('meanGrounding01'),def.meanGrounding01)),meanInformationGain01:clamp(finN(read('meanInformationGain01'),def.meanInformationGain01)),closedLoopQuality01:clamp(finN(read('closedLoopQuality01'),def.closedLoopQuality01)),lastEpisodeId:typeof le==='string'&&le?le.slice(0,160):null};}
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
