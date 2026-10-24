/**
 * P65 — Epistemic Ledger.
 *
 * Keeps a bounded distinction between observation, inference, belief, prediction
 * and counterfactual content. The ledger is deliberately read by memory and
 * decision code so unsupported inferences cannot silently become facts.
 */
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const isRecord=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeCounter=(x:unknown,fallback=0)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:fallback;
const safeText=(x:unknown,max:number)=>typeof x==='string'&&x.trim().length>0&&x.length<=max?x.trim():null;
const validKind=(x:unknown):x is P65Kind=>x==='observation'||x==='inference'||x==='belief'||x==='prediction'||x==='counterfactual';
const validStatus=(x:unknown):x is P65Claim['status']=>x==='active'||x==='stale'||x==='expired'||x==='resolved';
export interface P65RevisionRecord {at:number; evidenceId:string; source:string; stance:'supports'|'contradicts'; fromConfidence01:number; toConfidence01:number; independentSource:boolean; independenceKey?:string;}

export type P65Kind='observation'|'inference'|'belief'|'prediction'|'counterfactual';
export interface P65Claim {id:string;tick:number;at:number;kind:P65Kind;content:string;confidence01:number;source:string;resolved:boolean;parentIds:string[];predicted01?:number;actual01?:number;error01?:number;lastSupportedAt:number;supportCount:number;status:'active'|'stale'|'expired'|'resolved';evidenceSources?:string[];evidenceKeys?:string[];evidenceLineageKeys?:string[];revisionHistory?:P65RevisionRecord[];}
export interface P65State {version:2;claims:number;observations:number;inferences:number;beliefs:number;predictions:number;counterfactuals:number;resolvedPredictions:number;meanConfidence01:number;meanPredictionError01:number;unresolved:number;claimsData:P65Claim[];recentIds:string[];beliefHalfLifeMs:number;expiredBeliefs:number;staleBeliefs:number;}
export const defaultP65=():P65State=>({version:2,claims:0,observations:0,inferences:0,beliefs:0,predictions:0,counterfactuals:0,resolvedPredictions:0,meanConfidence01:.5,meanPredictionError01:.5,unresolved:0,claimsData:[],recentIds:[],beliefHalfLifeMs:7*24*60*60*1000,expiredBeliefs:0,staleBeliefs:0});
const sourceTrust=(source:string):number=>{ const s=String(source||'unknown').toLowerCase(); if(s==='os'||s==='android'||s==='termux') return .82; if(s==='device'||s==='sensor') return .76; if(s==='user') return .68; if(s==='external-api'||s==='web') return .84; if(s==='world') return .55; if(s==='simulated-world-environment') return .20; if(s==='organism') return .28; return .45; };
function stableId(tick:number,kind:P65Kind,content:string,source:string){let h=2166136261>>>0;for(const c of `${tick}|${kind}|${source}|${content.slice(0,220)}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `p65:${tick}:${kind}:${h.toString(16)}`;}
export class P65EpistemicLedger{
 private state=defaultP65();
 restore(raw?:Partial<P65State>|null){
  const d=defaultP65();
  let detached:unknown;
  try{
   detached=snapshotPlainData(raw??{},{allowNonFiniteNumbers:true,maxDepth:20,maxNodes:20_000,maxStringUnits:2*1024*1024});
  }catch{this.state=d;return;}
  const r=isRecord(detached)?detached:{};
  const normalized:P65Claim[]=[];
  const sourceRows=Array.isArray(r.claimsData)?r.claimsData.slice(0,20_000):[];
  for(const value of sourceRows){
   if(!isRecord(value))continue;
   const id=safeText(value.id,256),source=safeText(value.source,160),content=typeof value.content==='string'&&value.content.length<=320?value.content:null;
   if(!id||!source||content===null||!validKind(value.kind)||!Number.isSafeInteger(value.tick)||(value.tick as number)<0||
      typeof value.at!=='number'||!Number.isFinite(value.at)||value.at<0||typeof value.confidence01!=='number'||!Number.isFinite(value.confidence01)||
      typeof value.resolved!=='boolean')continue;
   // Do not turn a corrupted causal claim into a root claim by silently
   // dropping malformed parent references during restore.
   const rawParentIds=value.parentIds;
   if(rawParentIds!==undefined&&(!Array.isArray(rawParentIds)||rawParentIds.length>8||
      rawParentIds.some((v)=>typeof v!=='string'||v.length===0||v.length>256||v.trim()!==v||
        /[\\u0000-\\u001f\\u007f-\\u009f]/.test(v))||new Set(rawParentIds).size!==rawParentIds.length))continue;
   const parentIds=(rawParentIds??[]) as string[];
   const evidenceSources=Array.isArray(value.evidenceSources)?[...new Set(value.evidenceSources.filter((v):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=160).map(v=>v.trim().toLowerCase()))].slice(0,32):[source.toLowerCase()];
   const evidenceKeys=Array.isArray(value.evidenceKeys)?[...new Set(value.evidenceKeys.filter((v):v is string=>typeof v==='string'&&v.length>0&&v.length<=320))].slice(-64):[];
    const evidenceLineageKeys=Array.isArray(value.evidenceLineageKeys)?[...new Set(value.evidenceLineageKeys.filter((v):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=130).map(v=>v.trim().normalize('NFKC').toLowerCase()))].slice(-32):[...evidenceSources];
   const revisionHistory:P65RevisionRecord[]=[];
   if(Array.isArray(value.revisionHistory)){
    for(const rev of value.revisionHistory.slice(-32)){
     if(!isRecord(rev)||typeof rev.at!=='number'||!Number.isFinite(rev.at)||rev.at<0||
        typeof rev.evidenceId!=='string'||rev.evidenceId.length===0||rev.evidenceId.length>180||
        typeof rev.source!=='string'||rev.source.length===0||rev.source.length>160||
        (rev.stance!=='supports'&&rev.stance!=='contradicts')||
        typeof rev.fromConfidence01!=='number'||!Number.isFinite(rev.fromConfidence01)||rev.fromConfidence01<0||rev.fromConfidence01>1||
        typeof rev.toConfidence01!=='number'||!Number.isFinite(rev.toConfidence01)||rev.toConfidence01<0||rev.toConfidence01>1||
        typeof rev.independentSource!=='boolean')continue;
     const independenceKey=typeof rev.independenceKey==='string'&&rev.independenceKey.trim().length>0&&rev.independenceKey.length<=130?rev.independenceKey.trim().normalize('NFKC').toLowerCase():undefined;
      revisionHistory.push({at:rev.at,evidenceId:rev.evidenceId,source:rev.source,stance:rev.stance,fromConfidence01:rev.fromConfidence01,toConfidence01:rev.toConfidence01,independentSource:rev.independentSource,...(independenceKey?{independenceKey}:{})});
    }
   }
   const at=value.at as number;
   const lastSupportedAt=typeof value.lastSupportedAt==='number'&&Number.isFinite(value.lastSupportedAt)&&value.lastSupportedAt>=0?value.lastSupportedAt:at;
   const score=(x:unknown):number|undefined=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1?x:undefined;
   const predicted=score(value.predicted01),actual=score(value.actual01),error=score(value.error01);
   const status=validStatus(value.status)?value.status:(value.resolved?'resolved':'active');
   normalized.push({
    id,tick:value.tick as number,at,kind:value.kind,content,confidence01:clamp(value.confidence01),source,
    resolved:value.resolved,parentIds,lastSupportedAt,supportCount:safeCounter(value.supportCount,1),status,
    ...(predicted!==undefined?{predicted01:predicted}:value.kind==='prediction'?{predicted01:clamp(value.confidence01)}:{}),
    ...(actual!==undefined?{actual01:actual}:{}),
    ...(error!==undefined?{error01:error}:{}),
    evidenceSources,evidenceKeys,evidenceLineageKeys,revisionHistory,
   });
  }
  this.state={
   version:2,
   claims:Math.max(normalized.length,safeCounter(r.claims,d.claims)),
   observations:safeCounter(r.observations,d.observations),inferences:safeCounter(r.inferences,d.inferences),
   beliefs:safeCounter(r.beliefs,d.beliefs),predictions:safeCounter(r.predictions,d.predictions),
   counterfactuals:safeCounter(r.counterfactuals,d.counterfactuals),resolvedPredictions:safeCounter(r.resolvedPredictions,d.resolvedPredictions),
   meanConfidence01:typeof r.meanConfidence01==='number'&&Number.isFinite(r.meanConfidence01)?clamp(r.meanConfidence01):d.meanConfidence01,
   meanPredictionError01:typeof r.meanPredictionError01==='number'&&Number.isFinite(r.meanPredictionError01)?clamp(r.meanPredictionError01):d.meanPredictionError01,
   unresolved:safeCounter(r.unresolved,d.unresolved),claimsData:normalized.slice(0,256),
   recentIds:Array.isArray(r.recentIds)?[...new Set(r.recentIds.filter((v):v is string=>typeof v==='string'&&v.length>0&&v.length<=256))].slice(-512):[],
   beliefHalfLifeMs:typeof r.beliefHalfLifeMs==='number'&&Number.isFinite(r.beliefHalfLifeMs)&&r.beliefHalfLifeMs>=60_000&&r.beliefHalfLifeMs<=365*24*60*60*1000?r.beliefHalfLifeMs:d.beliefHalfLifeMs,
   expiredBeliefs:safeCounter(r.expiredBeliefs,d.expiredBeliefs),staleBeliefs:safeCounter(r.staleBeliefs,d.staleBeliefs),
  };
 }
 snapshot(){return structuredClone(this.state);}
 /** Durable projection retains every currently unresolved prediction plus a recent non-prediction tail. */
 persistenceSnapshot(){
  const pending=this.state.claimsData.filter(c=>c.kind==='prediction'&&!c.resolved);
  const recent=this.state.claimsData.filter(c=>!(c.kind==='prediction'&&!c.resolved)).slice(0,128);
  const seen=new Set<string>();
  const claimsData=[...pending,...recent].filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;}).slice(0,160).map(c=>({...c,parentIds:c.parentIds.slice()}));
  return {...this.state,claimsData,recentIds:this.state.recentIds.slice(0,256)};
 }
 record(rawInput:{tick:number;at:number;kind:P65Kind;content:string;confidence01:number;source:string;parentIds?:string[];predicted01?:number}):string{
  let input:typeof rawInput;
  try{input=snapshotPlainData(rawInput,{allowNonFiniteNumbers:true,maxDepth:8,maxNodes:64,maxStringUnits:4096});}catch{return '';}
  if(!input||!Number.isSafeInteger(input.tick)||input.tick<0||typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0||
     !validKind(input.kind)||typeof input.confidence01!=='number'||!Number.isFinite(input.confidence01)||input.confidence01<0||input.confidence01>1||
     typeof input.source!=='string'||input.source.trim().length===0||input.source.length>160||
     typeof input.content!=='string'||
     (input.predicted01!==undefined&&(typeof input.predicted01!=='number'||!Number.isFinite(input.predicted01)||input.predicted01<0||input.predicted01>1))||
     (input.parentIds!==undefined&&(!Array.isArray(input.parentIds)||input.parentIds.length>8||
       input.parentIds.some(parent=>typeof parent!=='string'||parent.length===0||parent.length>256))))return '';
  const content=input.content.trim().slice(0,320);if(!content)return '';
  const source=input.source.trim();
  const id=stableId(input.tick,input.kind,content,source);if(this.state.recentIds.includes(id))return id;
  const parentIds=Array.isArray(input.parentIds)?input.parentIds.filter((v):v is string=>typeof v==='string'&&v.length>0&&v.length<=256).slice(0,8):[];
  const claim:P65Claim={id,tick:input.tick,at:input.at,kind:input.kind,content,confidence01:clamp(input.confidence01),source,resolved:false,parentIds,predicted01:input.kind==='prediction'?clamp(input.predicted01 ?? input.confidence01):undefined,lastSupportedAt:input.at,supportCount:1,status:'active',evidenceSources:[source.normalize('NFKC').toLowerCase()],evidenceKeys:[],evidenceLineageKeys:[source.normalize('NFKC').toLowerCase()],revisionHistory:[]};
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
 reviseBeliefFromEvidence(rawInput:{claimId:string;evidenceId:string;source:string;independenceKey?:string;stance:'supports'|'contradicts';strength01:number;at:number}):{accepted:boolean;reason:string;confidence01:number|null;independentSource:boolean}{
  let input:typeof rawInput;
  try{input=snapshotPlainData(rawInput,{allowNonFiniteNumbers:true,maxDepth:8,maxNodes:32,maxStringUnits:4096});}
  catch{return {accepted:false,reason:'evidence-boundary-rejected',confidence01:null,independentSource:false};}
  const claimId=safeText(input?.claimId,256),evidenceId=safeText(input?.evidenceId,180),source=safeText(input?.source,160)?.normalize('NFKC').toLowerCase();
  const requestedLineage=input?.independenceKey===undefined?source:safeText(input.independenceKey,130)?.normalize('NFKC').toLowerCase();
  if(!claimId||!evidenceId||!source||source.length===0||!requestedLineage||requestedLineage.length===0||
     (input.stance!=='supports'&&input.stance!=='contradicts')||
     typeof input.strength01!=='number'||!Number.isFinite(input.strength01)||input.strength01<0||input.strength01>1||
     typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0){
   return {accepted:false,reason:'evidence-input-invalid',confidence01:null,independentSource:false};
  }
  const claim=this.state.claimsData.find(row=>row.id===claimId&&row.kind==='belief');
  if(!claim)return {accepted:false,reason:'belief-not-found',confidence01:null,independentSource:false};
  if(claim.status==='expired'||claim.status==='resolved'||claim.resolved)return {accepted:false,reason:'belief-not-revisable',confidence01:claim.confidence01,independentSource:false};
  const lineageKey=requestedLineage;
  // An upstream evidenceEventId identifies one event across the whole organism.
  // Do not scope deduplication to source/lineage: a replay routed through a second
  // adapter must not become fresh corroboration merely because its source label changed.
  const evidenceKey=JSON.stringify(evidenceId);
  const evidenceKeys=claim.evidenceKeys??(claim.evidenceKeys=[]);
  if(evidenceKeys.includes(evidenceKey))return {accepted:false,reason:'evidence-already-applied',confidence01:claim.confidence01,independentSource:false};
  const sources=claim.evidenceSources??(claim.evidenceSources=[claim.source.normalize('NFKC').toLowerCase()]);
  const lineageKeys=claim.evidenceLineageKeys??(claim.evidenceLineageKeys=[...new Set(sources.map(v=>v.normalize('NFKC').toLowerCase()))]);
  const independentSource=!lineageKeys.includes(lineageKey);
  const previous=claim.confidence01;
  let next=previous;
  if(independentSource){
   // Combine a calibrated evidence likelihood in log-odds space. Stronger
   // evidence has greater effect; source trust moderates the update. Clipping
   // avoids infinite odds from zero/one inputs.
   const prior=Math.min(.999999,Math.max(.000001,previous));
   const strength=Math.min(.99,Math.max(.01,input.strength01));
   const logit=(p:number)=>Math.log(p/(1-p));
   const direction=input.stance==='supports'?1:-1;
   const evidenceWeight=sourceTrust(source);
   const posteriorLogOdds=logit(prior)+direction*logit(strength)*evidenceWeight;
   next=clamp(1/(1+Math.exp(-posteriorLogOdds)));
   if(input.stance==='supports'){
    claim.supportCount=Math.min(Number.MAX_SAFE_INTEGER,claim.supportCount+1);
    claim.lastSupportedAt=input.at;claim.status='active';
   }
   claim.confidence01=next;
   sources.push(source);
   claim.evidenceSources=[...new Set(sources)].slice(-32);
   lineageKeys.push(lineageKey);
   claim.evidenceLineageKeys=[...new Set(lineageKeys)].slice(-32);
  }else if(input.stance==='supports'){
   // Same-source observations can refresh recency but never masquerade as
   // independent corroboration or increase confidence repeatedly.
   claim.lastSupportedAt=Math.max(claim.lastSupportedAt,input.at);
   claim.supportCount=Math.min(Number.MAX_SAFE_INTEGER,claim.supportCount+1);
  }
  evidenceKeys.push(evidenceKey);claim.evidenceKeys=[...new Set(evidenceKeys)].slice(-64);
  const revision:P65RevisionRecord={at:input.at,evidenceId,source,stance:input.stance,fromConfidence01:previous,toConfidence01:claim.confidence01,independentSource,independenceKey:lineageKey};
  claim.revisionHistory=[...(claim.revisionHistory??[]),revision].slice(-32);
  return {accepted:true,reason:independentSource?'independent-evidence-applied':'same-source-evidence-recorded',confidence01:claim.confidence01,independentSource};
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
