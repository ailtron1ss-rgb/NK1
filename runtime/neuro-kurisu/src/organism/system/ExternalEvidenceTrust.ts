import { sha256Stable } from '../core/StableSerialization.ts';
import { cloneInertSnapshot } from '../core/InertSnapshot.ts';

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
const baseTrust=(s:EvidenceSourceClass)=>({os:.90,device:.78,user:.68,'external-api':.84,world:.55,organism:.28,simulator:.18,unknown:.40}[s]);
// Only independently attributable external witnesses may corroborate a world claim.
// The exact same allowlist is applied during live observations, restore, and scoring.
const isIndependentWitness=(sourceClass:EvidenceSourceClass):boolean=>
  sourceClass==='os'||sourceClass==='device'||sourceClass==='user'||sourceClass==='external-api'||sourceClass==='world';
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
export const defaultExternalEvidenceTrust=():ExternalEvidenceTrustState=>({version:1,records:[],acceptedCount:0,contestedCount:0,expiredCount:0,meanTrust01:.5});
export class ExternalEvidenceTrustEngine{
 private state=defaultExternalEvidenceTrust();
 restore(raw?:Partial<ExternalEvidenceTrustState>|null){
    const d=defaultExternalEvidenceTrust();
    const now=Date.now();
    const restored = raw === undefined || raw === null
      ? {}
      : cloneInertSnapshot<unknown>(raw, { maxDepth: 12, maxProperties: 32_768 });
    if (!restored || typeof restored !== 'object' || Array.isArray(restored)) {
      throw new Error('external-evidence-trust-snapshot-invalid');
    }
    const source = restored as Partial<ExternalEvidenceTrustState>;
    const finiteCount=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,1_000_000):fallback;
    const validStatus=(value:unknown):value is EvidenceStatus=>value==='candidate'||value==='corroborated'||value==='contested'||value==='expired';
    const rows=Array.isArray(source.records)?source.records.slice(-256):[];
    // An event receipt may belong to exactly one persisted source/claim row.
    // If a checkpoint reuses an ID across rows, remove that ID from every claimant.
    const evidenceIdUseCount=new Map<string,number>();
    for(const value of rows){
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const ids=(value as Partial<ExternalEvidenceRecord>).evidenceIds;
      if(!Array.isArray(ids))continue;
      for(const id of new Set(ids.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())&&item.length<=180))){
        evidenceIdUseCount.set(id,(evidenceIdUseCount.get(id)??0)+1);
      }
    }
    const records:ExternalEvidenceRecord[]=[];
    for(const value of rows){
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const r=value as Partial<ExternalEvidenceRecord>;
      if(typeof r.id!=='string'||!r.id.trim()||r.id.length>180
        ||typeof r.claimKey!=='string'||!r.claimKey.trim()||r.claimKey.length>180
        ||typeof r.source!=='string'||!r.source.trim()||r.source.length>120
        ||typeof r.independenceKey!=='string'||!r.independenceKey.trim()||r.independenceKey.length>120
        ||typeof r.confidence01!=='number'||!Number.isFinite(r.confidence01)
        ||typeof r.trust01!=='number'||!Number.isFinite(r.trust01)
        ||!validStatus(r.status)
        ||!Number.isSafeInteger(r.firstSeenAt)||Number(r.firstSeenAt)<0
        ||!Number.isSafeInteger(r.lastSeenAt)||Number(r.lastSeenAt)<0)continue;
      const source=r.source.trim().toLowerCase();
      const sourceClass=sourceClassOf(source);
      const firstSeenAt=Math.min(Number(r.firstSeenAt),now+5*60*1000);
      const lastSeenAt=Math.max(firstSeenAt,Math.min(Number(r.lastSeenAt),now+5*60*1000));
      const evidenceIds=Array.isArray(r.evidenceIds)
        ?[...new Set(r.evidenceIds.filter((id):id is string=>typeof id==='string'&&Boolean(id.trim())&&id.length<=180))]
          .filter(id=>evidenceIdUseCount.get(id)===1).slice(-64)
        :[];
      records.push({
        id:r.id,claimKey:r.claimKey.trim(),source,sourceClass,
        independenceKey:r.independenceKey.trim().toLowerCase(),
        confidence01:clamp(r.confidence01),trust01:0,
        // Only bounded, unique event receipts survive restore. Persisted aggregate
        // counters are attacker-controlled summaries, not corroboration evidence.
        corroborations:evidenceIds.length,
        independentSources:1,contradictions:0,
        status:'candidate',firstSeenAt,lastSeenAt,evidenceIds,
      });
    }
    // Rebuild trust and corroboration from sanitized source identities. Persisted
    // aggregate counters and statuses are never authority to promote evidence.
    for(const record of records){
      const sameClaim=records.filter(other=>other.claimKey===record.claimKey);
      const eligible=sameClaim.filter(other=>isIndependentWitness(other.sourceClass)&&(other.evidenceIds?.length??0)>0);
      record.independentSources=isIndependentWitness(record.sourceClass)
        ?new Set(eligible.map(other=>other.independenceKey)).size
        :0;
      record.trust01=clamp(baseTrust(record.sourceClass)*.55
        +record.confidence01*.2
        +Math.min(1,record.corroborations/4)*.10
        +Math.min(1,record.independentSources/3)*.18
        -record.contradictions*.12);
      const eligibleSource=isIndependentWitness(record.sourceClass);
      record.status=record.contradictions>=2?'contested'
        :eligibleSource&&(record.evidenceIds?.length??0)>0&&record.independentSources>=2&&record.trust01>=.72?'corroborated'
        :'candidate';
    }
    this.state={...d,records};
    this.recompute();
  }
 snapshot(){return structuredClone(this.state);}
 observe(input:{claimKey:string;source:string;independenceKey?:string;confidence01?:number;contradiction01?:number;at?:number;evidenceId?:string}):ExternalEvidenceRecord{
   const now=Date.now();
   const at=typeof input.at==='number'&&Number.isSafeInteger(input.at)&&input.at>=0?Math.min(input.at,now+5*60*1000):now;
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
   const eligibleSource=isIndependentWitness(sourceClass);
   const hasReceipt=Boolean(evidenceId||(prior?.evidenceIds?.length??0)>0);
   const independentSources=eligibleSource&&hasReceipt
     ?new Set([
       ...distinct.filter(r=>isIndependentWitness(r.sourceClass)&&(r.evidenceIds?.length??0)>0).map(r=>r.independenceKey),
       independenceKey,
     ]).size
     :0;
   const record:ExternalEvidenceRecord={
     id:prior?.id??stableId(claimKey,source,at), claimKey, source, sourceClass, independenceKey,
     confidence01:confidence, trust01:0, corroborations:(prior?.corroborations??0)+(evidenceId?1:0), independentSources,
     contradictions:(prior?.contradictions??0)+(contradiction>.5?1:0), status:'candidate', firstSeenAt:prior?.firstSeenAt??at, lastSeenAt:Math.max(prior?.lastSeenAt??0,at),
     ...(evidenceId?{evidenceIds:[...evidenceIds.filter(id=>id!==evidenceId),evidenceId].slice(-64)}:prior?.evidenceIds?{evidenceIds:evidenceIds.slice(-64)}:{}),
   };
   const trust=clamp(baseTrust(sourceClass)*.55+confidence*.2+Math.min(1,record.corroborations/4)*.10+Math.min(1,record.independentSources/3)*.18-record.contradictions*.12);
   record.trust01=trust;
   record.status=record.contradictions>=2?'contested':eligibleSource&&(record.evidenceIds?.length??0)>0&&record.independentSources>=2 && trust>=.72?'corroborated':'candidate';
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
 independenceCount(claimKey:string){return new Set(this.state.records.filter(r=>r.claimKey===claimKey && r.status!=='expired' && isIndependentWitness(r.sourceClass) && (r.evidenceIds?.length??0)>0).map(r=>r.independenceKey)).size;}
  scoreClaim(claimKey:string){const rs=this.state.records.filter(r=>r.claimKey===claimKey && r.status!=='expired' && isIndependentWitness(r.sourceClass) && (r.evidenceIds?.length??0)>0);if(!rs.length)return 0;const independent=this.independenceCount(claimKey);const corroborated=rs.filter(r=>r.status==='corroborated').length;return clamp(Math.max(...rs.map(r=>r.trust01))*.55 + Math.min(1,independent/3)*.25 + Math.min(1,corroborated/2)*.20);}
}
