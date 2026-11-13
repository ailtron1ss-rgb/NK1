/**
 * P57 — Reality-First Observatory.
 *
 * Observability is deliberately separated from organism self-report.  An
 * anchor is only accepted when an external/explicit outcome is supplied.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P57Source='external-feedback'|'device-observation'|'user-observation'|'oracle'|'unknown';
export interface P57Anchor {id:string;tick:number;at:number;source:P57Source;predicted01:number|null;actual01:number;gap01:number;confidence01:number;note:string;}
export interface P57State {
  version:1;observations:number;anchorsAccepted:number;anchorsRejected:number;
  meanRealityGap01:number;meanAnchorConfidence01:number;trend01:number;
  capabilityEvidence01:number;complexityProxy01:number;stability01:number;
  lastAnchorId:string|null;anchors:P57Anchor[];recentOutcomes:number[];lastAt:number;
}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const numOrNull=(v:unknown):number|null=>{if(v===null||v===undefined||v==='')return null;const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null;};
const SOURCES:P57Source[]=['external-feedback','device-observation','user-observation','oracle','unknown'];
const sanAnchor=(x:unknown):P57Anchor|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {id:str(r.id,'p57:0'),tick:cnt(r.tick,0),at:finN(r.at,0),source:SOURCES.includes(r.source as P57Source)?r.source as P57Source:'unknown',predicted01:numOrNull(r.predicted01),actual01:clamp(finN(r.actual01,0)),gap01:clamp(finN(r.gap01,0)),confidence01:clamp(finN(r.confidence01,0)),note:str(r.note,'')};};
export const defaultP57=():P57State=>({version:1,observations:0,anchorsAccepted:0,anchorsRejected:0,meanRealityGap01:.5,meanAnchorConfidence01:.5,trend01:0,capabilityEvidence01:0,complexityProxy01:0,stability01:.8,lastAnchorId:null,anchors:[],recentOutcomes:[],lastAt:0});
function stableId(tick:number,at:number,source:string,actual:number){let h=2166136261>>>0;for(const c of `${tick}|${at}|${source}|${actual.toFixed(6)}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `p57:${tick}:${h.toString(16)}`;}
export class P57RealityFirstObservatory {
  private state=defaultP57();
  restore(raw?:Partial<P57State>|null){const d=defaultP57();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const aRaw=read('anchors'),roRaw=read('recentOutcomes');this.state={version:1,observations:cnt(read('observations'),d.observations),anchorsAccepted:cnt(read('anchorsAccepted'),d.anchorsAccepted),anchorsRejected:cnt(read('anchorsRejected'),d.anchorsRejected),meanRealityGap01:clamp(finN(read('meanRealityGap01'),d.meanRealityGap01)),meanAnchorConfidence01:clamp(finN(read('meanAnchorConfidence01'),d.meanAnchorConfidence01)),trend01:clamp(finN(read('trend01'),d.trend01)),capabilityEvidence01:clamp(finN(read('capabilityEvidence01'),d.capabilityEvidence01)),complexityProxy01:clamp(finN(read('complexityProxy01'),d.complexityProxy01)),stability01:clamp(finN(read('stability01'),d.stability01)),lastAnchorId:typeof read('lastAnchorId')==='string'&&read('lastAnchorId')?(read('lastAnchorId') as string).slice(0,160):null,anchors:Array.isArray(aRaw)?(aRaw as unknown[]).slice(-128).map(sanAnchor).filter((x):x is P57Anchor=>x!==null):[],recentOutcomes:Array.isArray(roRaw)?(roRaw as unknown[]).slice(-64).map(v=>clamp(finN(v,0))):[],lastAt:finN(read('lastAt'),d.lastAt)};}
 snapshot(){return structuredClone(this.state);}
  observe(input:{tick:number;at:number;source:P57Source;predicted01?:number|null;actual01?:number;confidence01?:number;note?:string;capabilityScore01?:number;complexityProxy01?:number}){
    this.state.observations++;
    const actual=input.actual01;
    if(actual==null||!Number.isFinite(actual)) {this.state.anchorsRejected++;this.state.lastAt=input.at;return {accepted:false,reason:'missing-external-outcome'} as const;}
    const a=clamp(actual);const p=input.predicted01==null?null:clamp(input.predicted01);const gap=p==null?.5:Math.abs(p-a);
    const id=stableId(input.tick,input.at,input.source,a);
    if(this.state.anchors.some(x=>x.id===id))return {accepted:false,reason:'duplicate-anchor',id} as const;
    const anchor:P57Anchor={id,tick:input.tick,at:input.at,source:input.source,predicted01:p,actual01:a,gap01:clamp(gap),confidence01:clamp(input.confidence01??(p==null?.4:1-gap)),note:String(input.note??'')};
    this.state.anchorsAccepted++;this.state.lastAnchorId=id;this.state.meanRealityGap01=clamp(this.state.meanRealityGap01*.92+anchor.gap01*.08);this.state.meanAnchorConfidence01=clamp(this.state.meanAnchorConfidence01*.92+anchor.confidence01*.08);
    const prev=this.state.recentOutcomes.at(-1); if(prev!=null)this.state.trend01=clamp(this.state.trend01*.88+(a-prev)*.12+.5);
    this.state.recentOutcomes=[...this.state.recentOutcomes,a].slice(-64);
    this.state.capabilityEvidence01=clamp(this.state.capabilityEvidence01*.93 + clamp(input.capabilityScore01??(1-anchor.gap01))*.07);
    this.state.complexityProxy01=clamp(this.state.complexityProxy01*.95 + clamp(input.complexityProxy01??0)*.05);
    this.state.stability01=clamp(this.state.stability01*.95 + (1-anchor.gap01)*.05);this.state.anchors=[anchor,...this.state.anchors].slice(0,128);this.state.lastAt=input.at;
    return {accepted:true,id,gap01:anchor.gap01,confidence01:anchor.confidence01};
  }
  summary(){return {anchorsAccepted:this.state.anchorsAccepted,anchorsRejected:this.state.anchorsRejected,meanRealityGap01:this.state.meanRealityGap01,capabilityEvidence01:this.state.capabilityEvidence01,complexityProxy01:this.state.complexityProxy01,stability01:this.state.stability01,trend01:this.state.trend01};}
}
