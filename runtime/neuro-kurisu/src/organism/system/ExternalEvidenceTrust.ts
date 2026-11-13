import { sha256Stable } from '../core/StableSerialization.ts';

/**
 * Evidence quality layer for reality-grounded cognition.
 * Keeps source trust, independence and corroboration separate from raw confidence.
 */
export type EvidenceSourceClass = 'os'|'device'|'user'|'external-api'|'world'|'organism'|'simulator'|'unknown';
export type EvidenceStatus = 'candidate'|'corroborated'|'contested'|'expired';
export interface ExternalEvidenceRecord {
  id:string;
  claimKey:string;
  source:string;
  sourceClass:EvidenceSourceClass;
  independenceKey:string;
  confidence01:number;
  trust01:number;
  corroborations:number;
  independentSources:number;
  contradictions:number;
  status:EvidenceStatus;
  firstSeenAt:number;
  lastSeenAt:number;
  /** Bounded exact-event IDs prevent replay from inflating corroboration counts. */
  evidenceIds?:string[];
}
export interface ExternalEvidenceTrustState {
  version:1;
  records:ExternalEvidenceRecord[];
  acceptedCount:number;
  contestedCount:number;
  expiredCount:number;
  meanTrust01:number;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const SOURCE_CLASSES:readonly EvidenceSourceClass[]=['os','device','user','external-api','world','organism','simulator','unknown'];
const STATUSES:readonly EvidenceStatus[]=['candidate','corroborated','contested','expired'];
const strIds=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=180).map(x=>x.slice(0,180)).slice(-cap):[];
const baseTrust=(s:EvidenceSourceClass)=>({os:.90,device:.78,user:.68,'external-api':.84,world:.55,organism:.28,simulator:.18,unknown:.40}[s]);
function sourceClassOf(value:string):EvidenceSourceClass{
  const s=String(value||'unknown').toLowerCase();
  if(['os','android','termux'].includes(s)) return 'os';
  if(['device','sensor','camera','microphone'].includes(s)) return 'device';
  if(s==='user') return 'user';
  if(['web','external-api','oracle'].includes(s)) return 'external-api';
  if(s==='simulated-world-environment' || s.includes('simulator')) return 'simulator';
  if(s==='organism') return 'organism';
  if(s==='world') return 'world';
  return 'unknown';
}
function stableId(claimKey:string,source:string,at:number){return `evidence:${sha256Stable({claimKey:String(claimKey).slice(0,180),source:String(source).slice(0,120),minuteBucket:Math.floor(at/60000)})}`;}
const sanitizeEvidenceRecord=(v:unknown):ExternalEvidenceRecord|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;const source=typeof r.source==='string'?r.source.slice(0,120):'unknown';const firstSeenAt=Math.max(0,finN(r.firstSeenAt,0));return {id:r.id.slice(0,180),claimKey:typeof r.claimKey==='string'?r.claimKey.slice(0,180):'',source,sourceClass:SOURCE_CLASSES.includes(r.sourceClass as EvidenceSourceClass)?r.sourceClass as EvidenceSourceClass:'unknown',independenceKey:typeof r.independenceKey==='string'?r.independenceKey.slice(0,120):'',confidence01:clamp(finN(r.confidence01,.5)),trust01:clamp(finN(r.trust01,baseTrust(sourceClassOf(source)))),corroborations:cnt(r.corroborations,0),independentSources:cnt(r.independentSources,0),contradictions:cnt(r.contradictions,0),status:STATUSES.includes(r.status as EvidenceStatus)?r.status as EvidenceStatus:'candidate',firstSeenAt,lastSeenAt:Math.max(firstSeenAt,finN(r.lastSeenAt,firstSeenAt)),evidenceIds:strIds(r.evidenceIds,64)};};
export const defaultExternalEvidenceTrust=():ExternalEvidenceTrustState=>({version:1,records:[],acceptedCount:0,contestedCount:0,expiredCount:0,meanTrust01:.5});
export class ExternalEvidenceTrustEngine{
 private state=defaultExternalEvidenceTrust();
 restore(raw?:Partial<ExternalEvidenceTrustState>|null){const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};let records:ExternalEvidenceRecord[]=[];try{const r=read('records');if(Array.isArray(r))records=r.map(sanitizeEvidenceRecord).filter((x):x is ExternalEvidenceRecord=>x!==null).slice(-256);}catch{records=[];}this.state={version:1,records,acceptedCount:cnt(read('acceptedCount'),0),contestedCount:cnt(read('contestedCount'),0),expiredCount:cnt(read('expiredCount'),0),meanTrust01:clamp(finN(read('meanTrust01'),.5))};this.recompute();}
 snapshot(){return structuredClone(this.state);}
 observe(input:{claimKey:string;source:string;independenceKey?:string;confidence01?:number;contradiction01?:number;at?:number;evidenceId?:string}):ExternalEvidenceRecord{
   const at=Number.isFinite(input.at)?Number(input.at):Date.now();
   const claimKey=String(input.claimKey??'').trim().slice(0,180);
   const source=String(input.source||'unknown').trim().toLowerCase().slice(0,120)||'unknown';
   const sourceClass=sourceClassOf(source); const confidence=clamp(input.confidence01??.5); const contradiction=clamp(input.contradiction01??0);
   const independenceKey=String(input.independenceKey||source).trim().toLowerCase().slice(0,120)||source;
   const normalized=(value:string)=>String(value??'').trim().toLowerCase();
   const same=this.state.records.filter(r=>normalized(r.claimKey)===normalized(claimKey) && normalized(r.independenceKey)===normalized(independenceKey));
   const distinct=this.state.records.filter(r=>normalized(r.claimKey)===normalized(claimKey) && normalized(r.independenceKey)!==normalized(independenceKey));
   const prior=same[0];
   const evidenceId=String(input.evidenceId??'').trim().slice(0,180)||undefined;
   if(evidenceId){
     const previousEvidence=this.state.records.find(row=>row.evidenceIds?.includes(evidenceId));
     if(previousEvidence){
       if(normalized(previousEvidence.claimKey)!==normalized(claimKey)||normalized(previousEvidence.independenceKey)!==normalized(independenceKey)||normalized(previousEvidence.source)!==normalized(source)) throw new Error('external-evidence-id-conflict');
       return structuredClone(previousEvidence);
     }
   }
   const evidenceIds=prior?.evidenceIds??[];
   const record:ExternalEvidenceRecord={
     id:prior?.id??stableId(claimKey,source,at), claimKey, source, sourceClass, independenceKey,
     confidence01:confidence, trust01:0, corroborations:(prior?.corroborations??0)+1, independentSources:distinct.length+1,
     contradictions:(prior?.contradictions??0)+(contradiction>.5?1:0), status:'candidate', firstSeenAt:prior?.firstSeenAt??at, lastSeenAt:at,
     ...(evidenceId?{evidenceIds:[...evidenceIds.filter(id=>id!==evidenceId),evidenceId].slice(-64)}:prior?.evidenceIds?{evidenceIds:evidenceIds.slice(-64)}:{}),
   };
   const trust=clamp(baseTrust(sourceClass)*.55+confidence*.2+Math.min(1,record.corroborations/4)*.10+Math.min(1,record.independentSources/3)*.18-record.contradictions*.12);
   record.trust01=trust;
   record.status=record.contradictions>=2?'contested':record.independentSources>=2 && trust>=.72?'corroborated':'candidate';
   this.state.records=[record,...this.state.records.filter(r=>r.id!==record.id)].slice(0,256);
   this.recompute();
   return structuredClone(record);
 }
 private recompute(){
   const now=Date.now();
   for(const r of this.state.records){ if(now-r.lastSeenAt>14*24*60*60*1000 && r.status!=='contested') r.status='expired'; }
   this.state.acceptedCount=this.state.records.filter(r=>r.status==='corroborated').length;
   this.state.contestedCount=this.state.records.filter(r=>r.status==='contested').length;
   this.state.expiredCount=this.state.records.filter(r=>r.status==='expired').length;
   this.state.meanTrust01=this.state.records.length?clamp(this.state.records.reduce((s,r)=>s+r.trust01,0)/this.state.records.length):.5;
 }
 independenceCount(claimKey:string){return new Set(this.state.records.filter(r=>r.claimKey===claimKey && r.status!=='expired' && r.sourceClass!=='simulator' && r.sourceClass!=='unknown').map(r=>r.independenceKey)).size;}
  scoreClaim(claimKey:string){const rs=this.state.records.filter(r=>r.claimKey===claimKey && r.status!=='expired');if(!rs.length)return 0;const independent=this.independenceCount(claimKey);const corroborated=rs.filter(r=>r.status==='corroborated').length;return clamp(Math.max(...rs.map(r=>r.trust01))*.55 + Math.min(1,independent/3)*.25 + Math.min(1,corroborated/2)*.20);}
}
