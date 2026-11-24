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
export const defaultP57=():P57State=>({version:1,observations:0,anchorsAccepted:0,anchorsRejected:0,meanRealityGap01:.5,meanAnchorConfidence01:.5,trend01:0,capabilityEvidence01:0,complexityProxy01:0,stability01:.8,lastAnchorId:null,anchors:[],recentOutcomes:[],lastAt:0});
function stableId(tick:number,at:number,source:string,actual:number){let h=2166136261>>>0;for(const c of `${tick}|${at}|${source}|${actual.toFixed(6)}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `p57:${tick}:${h.toString(16)}`;}
export class P57RealityFirstObservatory {
  private state=defaultP57();
  restore(raw?:Partial<P57State>|null){const d=defaultP57(),r=raw??{};this.state={...d,...r,anchors:Array.isArray(r.anchors)?r.anchors.slice(-128):[],recentOutcomes:Array.isArray(r.recentOutcomes)?r.recentOutcomes.slice(-64):[]};}
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
