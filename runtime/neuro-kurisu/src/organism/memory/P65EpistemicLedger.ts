import { normalizeEvidenceLineageProvenance, type EvidenceLineageProvenance } from './EvidenceLineageProvenance.ts';
/**
 * P65 — Epistemic Ledger.
 *
 * Keeps a bounded distinction between observation, inference, belief, prediction
 * and counterfactual content. The ledger is deliberately read by memory and
 * decision code so unsupported inferences cannot silently become facts.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P65Kind='observation'|'inference'|'belief'|'prediction'|'counterfactual';
export type P65ClaimProvenance = EvidenceLineageProvenance;
export interface P65Claim {id:string;tick:number;at:number;kind:P65Kind;content:string;confidence01:number;source:string;resolved:boolean;parentIds:string[];predicted01?:number;actual01?:number;error01?:number;lastSupportedAt:number;supportCount:number;status:'active'|'stale'|'expired'|'resolved';provenance?:P65ClaimProvenance;}
export interface P65State {version:2;claims:number;observations:number;inferences:number;beliefs:number;predictions:number;counterfactuals:number;resolvedPredictions:number;meanConfidence01:number;meanPredictionError01:number;unresolved:number;claimsData:P65Claim[];recentIds:string[];beliefHalfLifeMs:number;expiredBeliefs:number;staleBeliefs:number;}
export const defaultP65=():P65State=>({version:2,claims:0,observations:0,inferences:0,beliefs:0,predictions:0,counterfactuals:0,resolvedPredictions:0,meanConfidence01:.5,meanPredictionError01:.5,unresolved:0,claimsData:[],recentIds:[],beliefHalfLifeMs:7*24*60*60*1000,expiredBeliefs:0,staleBeliefs:0});
const sourceTrust=(source:string):number=>{ const s=String(source||'unknown').toLowerCase(); if(s==='os'||s==='android'||s==='termux') return .82; if(s==='device'||s==='sensor') return .76; if(s==='user') return .68; if(s==='external-api'||s==='web') return .84; if(s==='world') return .55; if(s==='simulated-world-environment') return .20; if(s==='organism') return .28; return .45; };
function stableId(tick:number,kind:P65Kind,content:string,source:string){let h=2166136261>>>0;for(const c of `${tick}|${kind}|${source}|${content.slice(0,220)}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `p65:${tick}:${kind}:${h.toString(16)}`;}
export class P65EpistemicLedger{
 private state=defaultP65();
 restore(raw?:Partial<P65State>|null){const d=defaultP65(),r=raw??{};this.state={...d,...r,version:2,claimsData:Array.isArray(r.claimsData)?r.claimsData.slice(-256).map((c:any)=>({...c,predicted01:c.predicted01 ?? (c.kind==='prediction'?c.confidence01:undefined),lastSupportedAt:Number(c.lastSupportedAt??c.at??Date.now()),supportCount:Number(c.supportCount??1),status:c.status??(c.resolved?'resolved':'active')})):[],recentIds:Array.isArray(r.recentIds)?r.recentIds.slice(-512):[]};}
 snapshot(){return structuredClone(this.state);}
 /** Durable projection retains every currently unresolved prediction plus a recent non-prediction tail. */
 persistenceSnapshot(){
  const pending=this.state.claimsData.filter(c=>c.kind==='prediction'&&!c.resolved);
  const recent=this.state.claimsData.filter(c=>!(c.kind==='prediction'&&!c.resolved)).slice(0,128);
  const seen=new Set<string>();
  const claimsData=[...pending,...recent].filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;}).slice(0,160).map(c=>({...c,parentIds:c.parentIds.slice()}));
  return {...this.state,claimsData,recentIds:this.state.recentIds.slice(0,256)};
 }
 record(input:{tick:number;at:number;kind:P65Kind;content:string;confidence01:number;source:string;parentIds?:string[];predicted01?:number;provenance?:P65ClaimProvenance}):string{
  const content=String(input.content??'').slice(0,320);if(!content)return '';
  const id=stableId(input.tick,input.kind,content,input.source);if(this.state.recentIds.includes(id))return id;
  const provenance=normalizeEvidenceLineageProvenance(input.provenance);
  const claim:P65Claim={id,tick:input.tick,at:input.at,kind:input.kind,content,confidence01:clamp(input.confidence01),source:String(input.source||'unknown'),resolved:false,parentIds:(input.parentIds??[]).slice(0,8),predicted01:input.kind==='prediction'?clamp(input.predicted01 ?? input.confidence01):undefined,lastSupportedAt:input.at,supportCount:1,status:'active',...(provenance?{provenance}:{})};
  this.state.claims++;
  if(input.kind==='observation') this.state.observations++;
  else if(input.kind==='inference') this.state.inferences++;
  else if(input.kind==='belief') this.state.beliefs++;
  else if(input.kind==='prediction') this.state.predictions++;
  else this.state.counterfactuals++;
  this.state.claimsData.unshift(claim);this.state.claimsData=this.state.claimsData.slice(0,256);this.state.recentIds=[id,...this.state.recentIds].slice(0,512);this.state.unresolved++;
  this.state.meanConfidence01=clamp(this.state.meanConfidence01*.96+claim.confidence01*.04);return id;
 }
 resolvePrediction(id:string,actual01:number){
  const claim=this.state.claimsData.find(c=>c.id===id);if(!claim||claim.kind!=='prediction'||claim.resolved)return null;
  const actual=clamp(actual01);const error=Math.abs(clamp(claim.predicted01 ?? claim.confidence01)-actual);claim.actual01=actual;claim.error01=error;claim.resolved=true;claim.status='resolved';claim.lastSupportedAt=Date.now();claim.supportCount+=1;this.state.resolvedPredictions++;this.state.unresolved=Math.max(0,this.state.unresolved-1);this.state.meanPredictionError01=clamp(this.state.meanPredictionError01*.9+error*.1);return {id,error01:error,actual01:actual};
 }
 expireBeliefs(at=Date.now(), halfLifeMs=this.state.beliefHalfLifeMs): {stale:number;expired:number}{
  const halfLife=Math.max(60_000,Number(halfLifeMs)||this.state.beliefHalfLifeMs); let stale=0,expired=0;
  for(const c of this.state.claimsData){ if(c.kind!=='belief'||c.status==='resolved') continue; const age=Math.max(0,at-(c.lastSupportedAt||c.at)); if(age>halfLife*2){ if(c.status!=='expired'){c.status='expired';expired++;this.state.expiredBeliefs++;} } else if(age>halfLife){ if(c.status!=='stale'){c.status='stale';stale++;this.state.staleBeliefs++;} } }
  return {stale,expired};
 }
 supportBelief(id:string,at=Date.now()):boolean{ const c=this.state.claimsData.find(x=>x.id===id&&x.kind==='belief'&&x.status!=='expired'); if(!c)return false; c.lastSupportedAt=at;c.supportCount+=1;c.status='active';return true; }
 confidenceFor(input:{base01:number;source:string;kind:P65Kind;contradiction01?:number;grounding01?:number}):number{
  const contradiction=clamp(input.contradiction01??0),grounding=clamp(input.grounding01??.5);
  const provenance=(sourceTrust(input.source)-.5)*.16;
  const kindPenalty=input.kind==='prediction' ? .03 : input.kind==='counterfactual' ? .16 : input.kind==='inference' ? .08 : 0;
  return clamp(input.base01+provenance+grounding*.05-contradiction*.22-kindPenalty);
 }
 summary(){return {claims:this.state.claims,observations:this.state.observations,inferences:this.state.inferences,beliefs:this.state.beliefs,predictions:this.state.predictions,counterfactuals:this.state.counterfactuals,resolvedPredictions:this.state.resolvedPredictions,meanConfidence01:this.state.meanConfidence01,meanPredictionError01:this.state.meanPredictionError01,unresolved:this.state.unresolved,expiredBeliefs:this.state.expiredBeliefs,staleBeliefs:this.state.staleBeliefs};}
}
