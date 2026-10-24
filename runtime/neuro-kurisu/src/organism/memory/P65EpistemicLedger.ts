/**
 * P65 — Epistemic Ledger.
 *
 * Keeps a bounded distinction between observation, inference, belief, prediction
 * and counterfactual content. The ledger is deliberately read by memory and
 * decision code so unsupported inferences cannot silently become facts.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P65Kind='observation'|'inference'|'belief'|'prediction'|'counterfactual';
export type P65ProvenanceTrust = 'verified'|'corroborated'|'inferred'|'unverified';
export interface P65ClaimProvenance {
 sourceId:string; sourceKind:string; capturedAt:number; trustClass:P65ProvenanceTrust;
 contentFingerprint?:string; citation?:string;
}
export interface P65Claim {id:string;tick:number;at:number;kind:P65Kind;content:string;confidence01:number;source:string;resolved:boolean;parentIds:string[];predicted01?:number;actual01?:number;error01?:number;lastSupportedAt:number;supportCount:number;status:'active'|'stale'|'expired'|'resolved';provenance?:P65ClaimProvenance;}
export interface P65State {version:2;claims:number;observations:number;inferences:number;beliefs:number;predictions:number;counterfactuals:number;resolvedPredictions:number;meanConfidence01:number;meanPredictionError01:number;unresolved:number;claimsData:P65Claim[];recentIds:string[];beliefHalfLifeMs:number;expiredBeliefs:number;staleBeliefs:number;}
export const defaultP65=():P65State=>({version:2,claims:0,observations:0,inferences:0,beliefs:0,predictions:0,counterfactuals:0,resolvedPredictions:0,meanConfidence01:.5,meanPredictionError01:.5,unresolved:0,claimsData:[],recentIds:[],beliefHalfLifeMs:7*24*60*60*1000,expiredBeliefs:0,staleBeliefs:0});
const sourceTrust=(source:string):number=>{ const s=String(source||'unknown').toLowerCase(); if(s==='os'||s==='android'||s==='termux') return .82; if(s==='device'||s==='sensor') return .76; if(s==='user') return .68; if(s==='external-api'||s==='web') return .84; if(s==='world') return .55; if(s==='simulated-world-environment') return .20; if(s==='organism') return .28; return .45; };
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const cleanText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&![...value].some(c=>{const n=c.charCodeAt(0);return n<32||n===127;});
const isFingerprint=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function normalizeP65Provenance(value:unknown):P65ClaimProvenance|undefined{
 if(value===undefined||value===null)return undefined;
 if(!isRecord(value)||!cleanText(value.sourceId,192)||!cleanText(value.sourceKind,64)||
    !Number.isSafeInteger(value.capturedAt)||Number(value.capturedAt)<0||
    !['verified','corroborated','inferred','unverified'].includes(String(value.trustClass)))return undefined;
 if(value.contentFingerprint!==undefined&&!isFingerprint(value.contentFingerprint))return undefined;
 if(value.citation!==undefined&&!cleanText(value.citation,256))return undefined;
 return {sourceId:value.sourceId.trim(),sourceKind:value.sourceKind.trim(),capturedAt:Number(value.capturedAt),
   trustClass:value.trustClass as P65ProvenanceTrust,
   ...(value.contentFingerprint?{contentFingerprint:value.contentFingerprint as string}:{}),
   ...(value.citation?{citation:value.citation.trim() as string}:{})};
}
function stableId(tick:number,kind:P65Kind,content:string,source:string,provenance?:P65ClaimProvenance){
 const provenanceKey=provenance?`|${provenance.sourceKind}|${provenance.sourceId}|${provenance.contentFingerprint??''}|${provenance.trustClass}`:'';
 let h=2166136261>>>0;for(const c of `${tick}|${kind}|${source}|${content.slice(0,220)}${provenanceKey}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `p65:${tick}:${kind}:${h.toString(16)}`;
}
export class P65EpistemicLedger{
 private state=defaultP65();
 restore(raw?:Partial<P65State>|null){const d=defaultP65(),r=raw??{};this.state={...d,...r,version:2,claimsData:Array.isArray(r.claimsData)?r.claimsData.slice(-256).map((c:any)=>{const provenance=normalizeP65Provenance(c?.provenance);return {...c,predicted01:c.predicted01 ?? (c.kind==='prediction'?c.confidence01:undefined),lastSupportedAt:Number(c.lastSupportedAt??c.at??Date.now()),supportCount:Number(c.supportCount??1),status:c.status??(c.resolved?'resolved':'active'),...(provenance?{provenance}:{provenance:undefined})};}):[],recentIds:Array.isArray(r.recentIds)?r.recentIds.slice(-512):[]};}
 snapshot(){return structuredClone(this.state);}
 /** Durable projection retains every currently unresolved prediction plus a recent non-prediction tail. */
 persistenceSnapshot(){
  const pending=this.state.claimsData.filter(c=>c.kind==='prediction'&&!c.resolved);
  const recent=this.state.claimsData.filter(c=>!(c.kind==='prediction'&&!c.resolved)).slice(0,128);
  const seen=new Set<string>();
  const claimsData=[...pending,...recent].filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;}).slice(0,160).map(c=>({...c,parentIds:c.parentIds.slice(),...(c.provenance?{provenance:{...c.provenance}}:{})}));
  return {...this.state,claimsData,recentIds:this.state.recentIds.slice(0,256)};
 }
 record(input:{tick:number;at:number;kind:P65Kind;content:string;confidence01:number;source:string;parentIds?:string[];predicted01?:number;provenance?:P65ClaimProvenance}):string{
  const content=String(input.content??'').slice(0,320);if(!content)return '';
  const provenance=normalizeP65Provenance(input.provenance);if(input.provenance!==undefined&&!provenance)throw new Error('invalid epistemic source provenance');
  const id=stableId(input.tick,input.kind,content,input.source,provenance);if(this.state.recentIds.includes(id))return id;
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

 /** Return a bounded source/claim ancestry for explainable provenance and contradiction review. */
 sourceLineage(id:string,maxNodes=16):P65Claim[]{
  if(typeof id!=='string'||!id)return [];
  const limit=Number.isSafeInteger(maxNodes)?Math.max(1,Math.min(32,maxNodes)):16;
  const byId=new Map(this.state.claimsData.map(claim=>[claim.id,claim]));
  const queue=[id],seen=new Set<string>(),result:P65Claim[]=[];
  while(queue.length&&result.length<limit){
   const next=queue.shift()!;if(seen.has(next))continue;seen.add(next);
   const claim=byId.get(next);if(!claim)continue;
   result.push(structuredClone(claim));
   for(const parentId of claim.parentIds.slice(0,8)){if(!seen.has(parentId)&&queue.length<limit)queue.push(parentId);}
  }
  return result;
 }
  summary(){return {claims:this.state.claims,observations:this.state.observations,inferences:this.state.inferences,beliefs:this.state.beliefs,predictions:this.state.predictions,counterfactuals:this.state.counterfactuals,resolvedPredictions:this.state.resolvedPredictions,meanConfidence01:this.state.meanConfidence01,meanPredictionError01:this.state.meanPredictionError01,unresolved:this.state.unresolved,expiredBeliefs:this.state.expiredBeliefs,staleBeliefs:this.state.staleBeliefs};}
}
