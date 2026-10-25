import { CausalAccountabilityGraph, type CausalAccountabilityState } from './CausalAccountabilityGraph.ts';
import { assessExternalPostcondition, type OutcomeVerification } from './OutcomeVerificationService.ts';
import type { WorldContext } from '../core/types.ts';
import type { ActionOutcomeClass } from './ActionGateway.ts';
import { sha256Stable } from '../core/StableSerialization.ts';

export interface OutcomeCognitionProjectionInput {
  tick:number;
  tool:string;
  ok:boolean;
  verification:OutcomeVerification;
  reason?:string;
  inputKeys?:string[];
  predictedAction?:string;
  predictionConfidence01?:number;
  executionId?:string;
  /** Preserve decision/execution semantics; this must not be collapsed into a boolean success flag. */
  outcomeClass?:ActionOutcomeClass;
}

export interface OutcomeCognitionProjection {
  verificationRecord:{
    at:number; tick:number; tool:string; ok:boolean; verified:boolean;
    basis:OutcomeVerification['basis']; confidence01:number; observationId?:string; evidenceEventId?:string;
    externalObservation:boolean; expectedPostcondition?:string; observedPostcondition?:string; executionId?:string; predictionId?:string; outcomeClass?:ActionOutcomeClass;
    externalObservations?:Array<{observationId:string;verified:boolean;confidence01:number;expectedPostcondition?:string;observedPostcondition?:string;at:number;reason?:string;assessment?:'match'|'mismatch'|'unknown';sourceId?:string;sourceClass?:'os'|'device'|'user'|'external-api'|'world'|'organism'|'simulator'|'unknown';independenceKey?:string}>;
    externalEvidenceStatus?:'none'|'corroborated'|'contradicted'|'mixed';
    /** Persisted audit marker: this execution identity must not be reused as an active receipt. */
    receiptQuarantined?:boolean;
    receiptQuarantineReason?:'causal-graph'|'previously-quarantined'|'duplicate-record-conflict'|'invalid-projection-entry'|'projection-fingerprint-conflict'|'verified-external-mismatch'|'duplicate-index-conflict'|'record-index-conflict';
  };
  causal:CausalAccountabilityState;
  verifiedExternal:boolean;
  observedWorldContextAfter?:WorldContext;
}

export interface OutcomeProjectionIndexEntry {
  executionId:string;
  /** Immutable fingerprint of the original ActionGateway outcome projection. */
  fingerprint:string;
  record:OutcomeCognitionProjection['verificationRecord'];
  verifiedExternal:boolean;
}

/**
 * Append-only verification revision for an authoritative provider receipt. The
 * original ActionGateway outcome remains immutable; this record only strengthens
 * (or disputes) what is known about that same execution.
 */
export interface OutcomeProjectionEvidenceRevision {
  revisionId:string;
  executionId:string;
  tool:string;
  revisionNumber:number;
  source:'authoritative-provider-receipt';
  providerReceiptHash:string;
  baseFingerprint:string;
  revisionFingerprint:string;
  supersedesRevisionId?:string;
  at:number;
  tick:number;
  ok:boolean;
  verified:boolean;
  outcomeClass:ActionOutcomeClass;
  basis:OutcomeVerification['basis'];
  confidence01:number;
  observationId?:string;
  status:'verified'|'contradicted'|'unverified';
}

export type OutcomeEvidenceRevisionResult =
  | {resolved:true;revision:OutcomeProjectionEvidenceRevision;causal:CausalAccountabilityState;replayed:boolean}
  | {resolved:false;reason:'execution-id-required'|'provider-receipt-id-required'|'provider-receipt-invalid'|'no-matching-outcome'|'execution-tool-mismatch'|'outcome-execution-id-conflict'|'evidence-revision-conflict'|'evidence-revision-ledger-full'|'causal-revision-conflict'|'ambiguous-execution-receipt'};

const cap=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const boundedEvidenceEventId=(value:unknown):string|undefined=>
  typeof value==='string'&&/^outcome:[a-f0-9]{40}$/.test(value)?value:undefined;
const boundedText=(value:unknown,max:number):string|undefined=>{
  if(typeof value!=='string')return undefined;
  const text=value.trim();
  return text&&text.length<=max&&!/[\u0000-\u001f\u007f]/.test(text)?text:undefined;
};

/**
 * Shared outcome coordinator. It is a projection layer, not a second source of truth.
 * The Core supplies domain callbacks for memory/evidence/world; the Fabric owns the
 * cross-domain causal chain so ordinary and project actions cannot drift apart.
 */
export class OutcomeCognitionFabric {
  private readonly causal = new CausalAccountabilityGraph();
  private records:OutcomeCognitionProjection['verificationRecord'][]=[];
  private readonly maxRecords:number;
  private readonly maxProjectionIndex:number;
  private readonly projectionIndex=new Map<string,OutcomeProjectionIndexEntry>();
  private evidenceRevisions:OutcomeProjectionEvidenceRevision[]=[];
  private readonly maxEvidenceRevisions=2048;

  constructor(maxRecords=96){this.maxRecords=Math.max(32,maxRecords);this.maxProjectionIndex=Math.max(256,Math.min(2048,this.maxRecords*8));}

  restore(snapshot?:{version?:number; records?:OutcomeCognitionProjection['verificationRecord'][]; projectionIndex?:OutcomeProjectionIndexEntry[]; evidenceRevisions?:OutcomeProjectionEvidenceRevision[]; causal?:CausalAccountabilityState}){
    const validRecord=(value:unknown):value is OutcomeCognitionProjection['verificationRecord']=>{
      if(!value||typeof value!=='object')return false;
      const row=value as OutcomeCognitionProjection['verificationRecord'];
      return Number.isFinite(Number(row.at))&&typeof row.tool==='string'&&row.tool.length>0&&row.tool.length<=180&&
        ['none','tool-contract','external-postcondition'].includes(row.basis)&&typeof row.ok==='boolean'&&typeof row.verified==='boolean'&&
        (row.evidenceEventId===undefined||boundedEvidenceEventId(row.evidenceEventId)===row.evidenceEventId);
    };
    this.causal.restore(snapshot?.causal);
    const quarantined=new Set<string>(this.causal.snapshot().quarantinedExecutionIds??[]);
    const quarantineReasons=new Map<string,NonNullable<OutcomeCognitionProjection['verificationRecord']['receiptQuarantineReason']>>();
    for(const id of quarantined)quarantineReasons.set(id,'causal-graph');
    const quarantine=(value:unknown,reason:NonNullable<OutcomeCognitionProjection['verificationRecord']['receiptQuarantineReason']>)=>{
      const id=boundedText(value,180);
      if(!id)return;
      quarantined.add(id);
      if(!quarantineReasons.has(id))quarantineReasons.set(id,reason);
    };
    const validRecords=Array.isArray(snapshot?.records)?snapshot.records.filter(validRecord).map(r=>structuredClone(r)):[];
    const recordFingerprints=new Map<string,string>();
    for(const record of validRecords){
      const id=boundedText(record.executionId,180);
      if(!id)continue;
      if(record.receiptQuarantined===true)quarantine(id,record.receiptQuarantineReason??'previously-quarantined');
      const fingerprint=this.fingerprintFromRecord(record);
      const prior=recordFingerprints.get(id);
      if(prior&&prior!==fingerprint)quarantine(id,'duplicate-record-conflict');
      else recordFingerprints.set(id,fingerprint);
    }

    const restoredIndex=new Map<string,OutcomeProjectionIndexEntry>();
    const rawCandidates=Array.isArray(snapshot?.projectionIndex)?snapshot.projectionIndex:[];
    // Count only semantically valid projections toward the active-index cap.
    // Syntactically valid but forged fingerprints must not crowd older trusted
    // rows out of the bounded restore window.
    const validCandidate=(candidate:unknown):candidate is OutcomeProjectionIndexEntry=>{
      if(!candidate||typeof candidate!=='object')return false;
      const row=candidate as OutcomeProjectionIndexEntry;
      const id=boundedText(row.executionId,180);
      if(!id)return false;
      if(!validRecord(row.record)||!/^[a-f0-9]{64}$/i.test(String(row.fingerprint??''))){
        quarantine(id,'invalid-projection-entry');
        return false;
      }
      const record=structuredClone(row.record);
      const suppliedFingerprint=String(row.fingerprint).toLowerCase();
      if(record.executionId!==id||suppliedFingerprint!==this.fingerprintFromRecord(record)){
        quarantine(id,'projection-fingerprint-conflict');
        return false;
      }
      if(Boolean(row.verifiedExternal)!==this.verifiedExternalFromRecord(record)){
        quarantine(id,'verified-external-mismatch');
        return false;
      }
      return true;
    };
    const candidates:OutcomeProjectionIndexEntry[]=[];
    for(let i=rawCandidates.length-1;i>=0&&candidates.length<this.maxProjectionIndex;i--){
      const candidate=rawCandidates[i];
      if(!validCandidate(candidate))continue;
      if(quarantined.has(candidate.executionId))continue;
      candidates.push(candidate);
    }
    candidates.reverse();
    for(const candidate of candidates){
      const id=boundedText(candidate.executionId,180);
      if(!id)continue;
      if(quarantined.has(id))continue;
      const record=structuredClone(candidate.record);
      const canonicalFingerprint=this.fingerprintFromRecord(record);
      const suppliedFingerprint=String(candidate.fingerprint).toLowerCase();
      if(record.executionId!==id||suppliedFingerprint!==canonicalFingerprint){
        quarantine(id,'projection-fingerprint-conflict');
        restoredIndex.delete(id);
        continue;
      }
      const verifiedExternal=this.verifiedExternalFromRecord(record);
      if(Boolean(candidate.verifiedExternal)!==verifiedExternal){
        quarantine(id,'verified-external-mismatch');
        restoredIndex.delete(id);
        continue;
      }
      const entry:OutcomeProjectionIndexEntry={executionId:id,fingerprint:suppliedFingerprint,record,verifiedExternal};
      const prior=restoredIndex.get(id);
      if(prior&&(prior.fingerprint!==entry.fingerprint||sha256Stable(prior.record)!==sha256Stable(entry.record)||prior.verifiedExternal!==entry.verifiedExternal)){
        quarantine(id,'duplicate-index-conflict');
        restoredIndex.delete(id);
        continue;
      }
      if(!prior)restoredIndex.set(id,entry);
    }

    // A record row and its active index must describe the same immutable outcome.
    for(const [id,fingerprint] of recordFingerprints){
      const indexed=restoredIndex.get(id);
      if(indexed&&indexed.fingerprint!==fingerprint)quarantine(id,'record-index-conflict');
    }

    // Conflicts found in the projection layer become causal-graph tombstones too.
    // This keeps later evidence attachment blocked after persistence and compaction.
    this.causal.restore({...snapshot?.causal,quarantinedExecutionIds:[...quarantined]});
    this.records=[];
    const seenRecords=new Set<string>();
    for(const record of validRecords){
      const id=boundedText(record.executionId,180);
      if(id&&seenRecords.has(id))continue;
      if(id)seenRecords.add(id);
      this.records.push(id&&quarantined.has(id)?{...record,receiptQuarantined:true,receiptQuarantineReason:quarantineReasons.get(id)??'causal-graph'}:record);
      if(this.records.length>=this.maxRecords)break;
    }

    this.projectionIndex.clear();
    for(const [id,entry] of restoredIndex){
      if(quarantined.has(id))continue;
      this.projectionIndex.set(id,entry);
    }
    // Backward-compatible seeding for snapshots created before the projection index.
    for(const record of this.records){
      const id=boundedText(record.executionId,180);
      if(!id||quarantined.has(id)||this.projectionIndex.has(id))continue;
      const fingerprint=this.fingerprintFromRecord(record);
      this.projectionIndex.set(id,{executionId:id,fingerprint,record:structuredClone(record),verifiedExternal:this.verifiedExternalFromRecord(record)});
    }
    this.trimProjectionIndex();

    const validRevision=(row:any):boolean=>Boolean(row&&typeof row.revisionId==='string'&&row.revisionId.length>0&&row.revisionId.length<=180&&typeof row.executionId==='string'&&row.executionId.length>0&&row.executionId.length<=180&&!quarantined.has(String(row.executionId).trim())&&typeof row.tool==='string'&&row.tool.length>0&&row.tool.length<=180&&Number.isInteger(row.revisionNumber)&&row.revisionNumber>0&&row.source==='authoritative-provider-receipt'&&/^[a-f0-9]{64}$/i.test(String(row.providerReceiptHash??''))&&/^[a-f0-9]{64}$/i.test(String(row.baseFingerprint??''))&&/^[a-f0-9]{64}$/i.test(String(row.revisionFingerprint??''))&&Number.isFinite(Number(row.at))&&Number.isFinite(Number(row.tick))&&typeof row.ok==='boolean'&&typeof row.verified==='boolean'&&['none','tool-contract','external-postcondition'].includes(row.basis)&&Number.isFinite(Number(row.confidence01))&&['verified','contradicted','unverified'].includes(row.status)&&typeof row.outcomeClass==='string'&&row.outcomeClass.length<=64&&(row.observationId===undefined||(typeof row.observationId==='string'&&row.observationId.length<=180)));
    const rawRevisions=Array.isArray(snapshot?.evidenceRevisions)?snapshot!.evidenceRevisions!:[];
    const acceptedRevisions:OutcomeProjectionEvidenceRevision[]=[];
    // Validate before applying the retention cap. Invalid trailing rows must not
    // evict an older authenticated receipt revision from the bounded ledger.
    for(let i=rawRevisions.length-1;i>=0&&acceptedRevisions.length<this.maxEvidenceRevisions;i--){
      const row=rawRevisions[i];
      if(!validRevision(row))continue;
      acceptedRevisions.push({...row,providerReceiptHash:String(row.providerReceiptHash).toLowerCase(),baseFingerprint:String(row.baseFingerprint).toLowerCase(),revisionFingerprint:String(row.revisionFingerprint).toLowerCase(),confidence01:cap(Number(row.confidence01)),tick:Math.max(0,Math.floor(Number(row.tick))),at:Math.max(0,Number(row.at))});
    }
    this.evidenceRevisions=acceptedRevisions.reverse();
    // A repeated revision ID must identify the exact same immutable row, not
    // merely reuse its claimed fingerprint. Conflicting copies quarantine every
    // implicated execution so future receipt reconciliation cannot trust ambiguity.
    const uniqueRevisions=new Map<string,OutcomeProjectionEvidenceRevision>();
    for(const revision of this.evidenceRevisions){
      const prior=uniqueRevisions.get(revision.revisionId);
      if(!prior){uniqueRevisions.set(revision.revisionId,revision);continue;}
      if(sha256Stable(prior)!==sha256Stable(revision)){
        quarantine(prior.executionId,'duplicate-record-conflict');
        quarantine(revision.executionId,'duplicate-record-conflict');
      }
    }
    if(quarantined.size){
      this.causal.restore({...this.causal.snapshot(),quarantinedExecutionIds:[...quarantined]});
      this.records=this.records.map(record=>{
        const id=boundedText(record.executionId,180);
        return id&&quarantined.has(id)?{...record,receiptQuarantined:true,receiptQuarantineReason:quarantineReasons.get(id)??'causal-graph'}:record;
      });
      for(const id of quarantined)this.projectionIndex.delete(id);
    }
    this.evidenceRevisions=[...uniqueRevisions.values()].filter(row=>!quarantined.has(row.executionId)).slice(-this.maxEvidenceRevisions);
  }
  private fingerprintFromRecord(record:OutcomeCognitionProjection['verificationRecord']):string{
    return sha256Stable({executionId:record.executionId??'',tool:record.tool,ok:Boolean(record.ok),outcomeClass:record.outcomeClass??null,verification:{verified:Boolean(record.verified),basis:record.basis,confidence01:cap(record.confidence01),externalObservation:Boolean(record.externalObservation),observationId:record.observationId??null,...(record.evidenceEventId?{evidenceEventId:record.evidenceEventId}:{}),expectedPostcondition:record.expectedPostcondition??null,observedPostcondition:record.observedPostcondition??null}});
  }

  private verifiedExternalFromRecord(record:OutcomeCognitionProjection['verificationRecord']):boolean{
    return Boolean(record.ok&&record.verified&&record.basis==='external-postcondition'&&record.externalObservation&&record.observationId&&
      assessExternalPostcondition({basis:record.basis,externalObservation:record.externalObservation,observationId:record.observationId,verified:record.verified,expectedPostcondition:record.expectedPostcondition,observedPostcondition:record.observedPostcondition})==='match');
  }

  private isExecutionQuarantined(executionId:string):boolean{
    return this.causal.snapshot().quarantinedExecutionIds?.includes(executionId)??false;
  }

  private trimProjectionIndex(){while(this.projectionIndex.size>this.maxProjectionIndex){const oldest=this.projectionIndex.keys().next().value as string|undefined;if(!oldest)break;this.projectionIndex.delete(oldest);}}

  project(input:OutcomeCognitionProjectionInput):OutcomeCognitionProjection{
    // Revalidate at the projection boundary: callers may restore old state or bypass
    // OutcomeVerificationService, so TypeScript types alone are not a trust boundary.
    const raw=input.verification;
    const tool=boundedText(input.tool,180)??'unknown-tool';
    const executionId=boundedText(input.executionId,180);
    if(executionId&&this.isExecutionQuarantined(executionId))throw new Error('outcome-execution-id-conflict');
    const allowedBasis=raw?.basis==='none'||raw?.basis==='tool-contract'||raw?.basis==='external-postcondition';
    const observationId=boundedText(raw?.observationId,180);
    // The event key is a join identity, not proof. Preserve it only alongside a valid external-observation shape.
    const evidenceEventId=boundedEvidenceEventId(raw?.evidenceEventId);
    const invalidExternalClaim=raw?.externalObservation===true&&raw?.basis!=='external-postcondition';
    const invalidVerifiedClaim=raw?.verified===true&&(!allowedBasis||raw.basis==='none');
    const missingExternalIdentity=raw?.basis==='external-postcondition'&&raw?.externalObservation===true&&!observationId;
    const invalidEvidence=invalidExternalClaim||invalidVerifiedClaim||missingExternalIdentity;
    const expectedPostcondition=boundedText(raw?.expectedPostcondition,1024);
    const observedPostcondition=boundedText(raw?.observedPostcondition,1024);
    const v:OutcomeVerification=invalidEvidence
      ? {verified:false,basis:'none',confidence01:0,externalObservation:false,notes:'invalid-verification-contract; evidence downgraded to unknown'}
      : {
          ...raw,
          evidenceEventId:undefined,
          verified:raw?.verified===true&&raw.basis!=='none',
          basis:allowedBasis?raw.basis:'none',
          confidence01:cap(raw?.confidence01??0),
          externalObservation:raw?.basis==='external-postcondition'&&raw?.externalObservation===true&&Boolean(observationId),
          ...(observationId?{observationId}:{}),
          ...(raw?.basis==='external-postcondition'&&raw?.externalObservation===true&&observationId&&evidenceEventId?{evidenceEventId}:{}),
          ...(expectedPostcondition?{expectedPostcondition}:{}),
          ...(observedPostcondition?{observedPostcondition}:{}),
        };
    const assessment=assessExternalPostcondition(v);
    const explicitlyContradicted=assessment==='contradiction';
    const actionVerified=assessment==='match'||(assessment==='not-external'&&v.basis==='tool-contract'&&v.verified===true&&input.ok===true);
    const outcomeOk=Boolean(input.ok)&&!explicitlyContradicted;
    const verifiedExternal=Boolean(outcomeOk&&assessment==='match'&&actionVerified);
    const fingerprint=executionId?sha256Stable({executionId,tool,ok:outcomeOk,outcomeClass:input.outcomeClass??null,verification:{verified:actionVerified,basis:v.basis,confidence01:cap(v.confidence01),externalObservation:Boolean(v.externalObservation),observationId:v.observationId??null,...(v.evidenceEventId?{evidenceEventId:v.evidenceEventId}:{}),expectedPostcondition:v.expectedPostcondition??null,observedPostcondition:v.observedPostcondition??null}}):undefined;
    if(executionId){
      const prior=this.projectionIndex.get(executionId);
      if(prior){
        if(prior.fingerprint!==fingerprint)throw new Error('outcome-execution-id-conflict');
        return {verificationRecord:structuredClone(prior.record),causal:this.causal.snapshot(),verifiedExternal:prior.verifiedExternal,observedWorldContextAfter:v.observedWorldContextAfter};
      }
    }

    const row:OutcomeCognitionProjection['verificationRecord']={
      at:Date.now(),tick:input.tick,tool,ok:outcomeOk,verified:actionVerified,
      basis:v.basis,confidence01:cap(v.confidence01),observationId:v.observationId,evidenceEventId:v.evidenceEventId,
      externalObservation:Boolean(v.externalObservation),expectedPostcondition:v.expectedPostcondition,
      observedPostcondition:v.observedPostcondition,executionId,predictionId:undefined,outcomeClass:input.outcomeClass,
      externalObservations:[],externalEvidenceStatus:'none',
    };

    const predictionId=this.causal.add('prediction',input.tick,`tool:${tool}`,{tool,inputKeys:(input.inputKeys??[]).slice(0,12),predictedAction:boundedText(input.predictedAction,180)},input.predictionConfidence01);
    const decisionId=this.causal.add('decision',input.tick,`tool-request:${tool}`,{reason:boundedText(input.reason,160)??'tool-request',executionId});
    const chain=this.causal.recordActionChain({
      tick:input.tick,tool,ok:outcomeOk,verified:actionVerified,
      observationId:v.observationId,confidence01:v.confidence01,
      expectedPostcondition:v.expectedPostcondition,observedPostcondition:v.observedPostcondition,
      externalObservation:Boolean(v.externalObservation),contradicted:explicitlyContradicted,executionId,predictionId,decisionId,
      data:{basis:v.basis,executionId,evidenceEventId:v.evidenceEventId??null,outcomeClass:input.outcomeClass},
    });
    // An action receipt is accountability evidence, not by itself a learning
    // assignment. Learning credit is created below only when an external observer
    // supplies provenance/independence and passes the relevant evidence threshold.
    // A single contradiction remains a prediction-error trace, not negative skill credit.

    this.records=[row,...this.records].slice(0,this.maxRecords);
    if(executionId&&fingerprint){
      this.projectionIndex.delete(executionId);
      this.projectionIndex.set(executionId,{executionId,fingerprint,record:structuredClone(row),verifiedExternal});
      this.trimProjectionIndex();
    }
    return {verificationRecord:row,causal:this.causal.snapshot(),verifiedExternal,observedWorldContextAfter:v.observedWorldContextAfter};
  }

  resolveExternalObservation(input:{tick:number;executionId?:string;tool:string;observationId:string;verified:boolean;confidence01:number;expectedPostcondition?:string;observedPostcondition?:string;reason?:string;predictionId?:string;assessment?:'match'|'mismatch'|'unknown';sourceId?:string;sourceClass?:'os'|'device'|'user'|'external-api'|'world'|'organism'|'simulator'|'unknown';independenceKey?:string}){
    const executionId=boundedText(input.executionId,180);
    const tool=boundedText(input.tool,180);
    const observationId=boundedText(input.observationId,180);
    if(!executionId) return {resolved:false,reason:'execution-id-required'} as const;
    if(!tool) return {resolved:false,reason:'tool-id-invalid'} as const;
    if(!observationId) return {resolved:false,reason:'observation-id-required'} as const;
    if(this.isExecutionQuarantined(executionId))return {resolved:false,reason:'ambiguous-execution-receipt'} as const;
    const indexed=this.projectionIndex.get(executionId);
    const matches=indexed&&indexed.record.tool===tool
      ? [{record:indexed.record,index:this.records.findIndex(row=>row.executionId===executionId)}]
      : this.records.map((record,index)=>({record,index})).filter(({record})=>record.executionId===executionId&&record.tool===tool);
    if(matches.length!==1) return {resolved:false,reason:matches.length?'ambiguous-execution-receipt':'no-matching-outcome'} as const;
    const {record:current}=matches[0];
    const confidence01=cap(input.confidence01);
    const expected=boundedText(input.expectedPostcondition,1024)??current.expectedPostcondition;
    const observed=boundedText(input.observedPostcondition,1024)??current.observedPostcondition;
    const assessed=assessExternalPostcondition({basis:'external-postcondition',externalObservation:true,observationId,verified:input.verified,expectedPostcondition:expected,observedPostcondition:observed});
    const verified=assessed==='match'&&input.verified===true;
    // Trust the observer's categorical comparison when present. A mere text
    // difference is not enough to call an ambiguous natural-language observation
    // a contradiction.
    const observationAssessment=input.assessment==='match'||input.assessment==='mismatch'||input.assessment==='unknown'
      ? input.assessment
      : assessed==='match'?'match':assessed==='contradiction'?'mismatch':'unknown';
    const contradicted=observationAssessment==='mismatch'&&assessed==='contradiction';
    const sourceId=boundedText(input.sourceId,180);
    const sourceClass=input.sourceClass&&['os','device','user','external-api','world','organism','simulator','unknown'].includes(input.sourceClass)?input.sourceClass:undefined;
    const independenceKey=boundedText(input.independenceKey,120);
    const sourceEligible=Boolean(sourceId&&sourceClass&&['os','device','user','external-api','world'].includes(sourceClass)&&independenceKey&&confidence01>=.72);
    const observations=current.externalObservations??[];
    const priorObservation=observations.find(row=>row.observationId===observationId);
    if(priorObservation){
      const same=priorObservation.verified===verified&&priorObservation.confidence01===confidence01&&priorObservation.expectedPostcondition===expected&&priorObservation.observedPostcondition===observed&&
        (priorObservation.sourceId??undefined)===sourceId&&(priorObservation.sourceClass??undefined)===sourceClass&&(priorObservation.independenceKey??undefined)===independenceKey&&(priorObservation.assessment??'unknown')===observationAssessment;
      if(!same) return {resolved:false,reason:'observation-replay-conflict'} as const;
      return {resolved:true,record:structuredClone(current),causal:this.causal.snapshot(),replayed:true} as const;
    }
    const newObservation={observationId,verified,confidence01,expectedPostcondition:expected,observedPostcondition:observed,at:Date.now(),assessment:observationAssessment,
      ...(sourceId?{sourceId}:{}),...(sourceClass?{sourceClass}:{}),...(independenceKey?{independenceKey}:{}),...(boundedText(input.reason,160)?{reason:boundedText(input.reason,160)}:{})};
    const proposedObservations=[...observations,newObservation].slice(-8);
    const negativeSources=new Map<string,number>();
    for(const row of proposedObservations){
      const eligibleSource=Boolean(row.sourceId&&row.independenceKey&&row.sourceClass&&['os','device','user','external-api','world'].includes(row.sourceClass)&&row.confidence01>=.72);
      const expectedNorm=String(row.expectedPostcondition??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
      const observedNorm=String(row.observedPostcondition??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
      if(eligibleSource&&row.assessment==='mismatch'&&expectedNorm&&observedNorm&&expectedNorm!==observedNorm)negativeSources.set(row.independenceKey!,Math.max(negativeSources.get(row.independenceKey!)??0,row.confidence01));
    }
    const corroboratedContradiction=negativeSources.size>=2;
    const eligibleForLearning=sourceEligible&&(verified||(contradicted&&corroboratedContradiction));
    const linked=this.causal.resolveExternalVerification({tick:input.tick,tool,observationId,verified,contradicted,eligibleForLearning,confidence01,expectedPostcondition:expected,observedPostcondition:observed,executionId,reason:boundedText(input.reason,160),sourceId,sourceClass,independenceKey,independentContradictionSources:negativeSources.size});
    if(!linked.resolved) return linked;
    const obs=proposedObservations;
    const hasConfirmed=obs.some(row=>row.verified);
    const hasContradicted=obs.some(row=>row.assessment==='mismatch'&&Boolean(row.expectedPostcondition&&row.observedPostcondition&&String(row.expectedPostcondition).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase()!==String(row.observedPostcondition).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase()));
    const externalEvidenceStatus:NonNullable<OutcomeCognitionProjection['verificationRecord']['externalEvidenceStatus']>=hasConfirmed&&hasContradicted?'mixed':hasContradicted?'contradicted':hasConfirmed?'corroborated':'none';
    // Keep the original gateway outcome immutable. External observations are a
    // separate evidence stream, not a rewrite of what the executor originally knew.
    const updated={...current,externalObservations:obs,externalEvidenceStatus,executionId,predictionId:boundedText(input.predictionId,180)??current.predictionId,at:current.at};
    this.records=[updated,...this.records.filter(row=>row.executionId!==executionId)].slice(0,this.maxRecords);
    const entry=this.projectionIndex.get(executionId);
    if(entry){this.projectionIndex.delete(executionId);this.projectionIndex.set(executionId,{...entry,record:structuredClone(updated)});}
    else {
      const fingerprint=this.fingerprintFromRecord(updated);
      this.projectionIndex.set(executionId,{executionId,fingerprint,record:structuredClone(updated),verifiedExternal:Boolean(updated.ok&&updated.verified&&updated.basis==='external-postcondition'&&updated.externalObservation&&updated.observationId)});
      this.trimProjectionIndex();
    }
    return {resolved:true,record:structuredClone(updated),causal:this.causal.snapshot(),replayed:false} as const;
  }

  hasProjectionForExecution(executionId:string):boolean{
    const id=String(executionId??'').trim();
    return Boolean(id&&!this.isExecutionQuarantined(id)&&this.projectionIndex.has(id));
  }

  /**
   * Add a stronger receipt as an append-only evidence revision. This method is
   * intentionally separate from project(): a changed result for the same
   * execution must never rewrite the original receipt or mint a second action.
   */
  reviseAuthoritativeReceipt(input:{
    authoritative:true;tick:number;executionId:string;tool:string;providerReceiptId:string;
    ok:boolean;verification:OutcomeVerification;outcomeClass:ActionOutcomeClass;reason?:string;
    inputKeys?:string[];predictedAction?:string;predictionConfidence01?:number;
  }):OutcomeEvidenceRevisionResult{
    const executionId=boundedText(input.executionId,180);
    const tool=boundedText(input.tool,180);
    const providerReceiptId=boundedText(input.providerReceiptId,180);
    if(!executionId)return {resolved:false,reason:'execution-id-required'};
    if(this.isExecutionQuarantined(executionId))return {resolved:false,reason:'ambiguous-execution-receipt'};
    if(!providerReceiptId)return {resolved:false,reason:'provider-receipt-id-required'};
    if(input.authoritative!==true||/[\u0000-\u001f\u007f]/.test(providerReceiptId))return {resolved:false,reason:'provider-receipt-invalid'};
    if(!tool)return {resolved:false,reason:'execution-tool-mismatch'};

    let indexed=this.projectionIndex.get(executionId);
    if(!indexed){
      // An ambiguous original execution may have had no final projection at all.
      // In that case, the authoritative reconciliation creates the one canonical
      // action/outcome projection before appending its first evidence revision.
      try{
        this.project({tick:input.tick,tool,ok:input.ok,verification:input.verification,reason:input.reason,inputKeys:input.inputKeys,predictedAction:input.predictedAction,predictionConfidence01:input.predictionConfidence01,executionId,outcomeClass:input.outcomeClass});
      }catch(error){return {resolved:false,reason:String((error as Error)?.message??'')==='outcome-execution-id-conflict'?'outcome-execution-id-conflict':'no-matching-outcome'};}
      indexed=this.projectionIndex.get(executionId);
    }
    if(!indexed)return {resolved:false,reason:'no-matching-outcome'};
    if(indexed.record.tool!==tool)return {resolved:false,reason:'execution-tool-mismatch'};

    const raw=input.verification;
    const allowedBasis=raw?.basis==='none'||raw?.basis==='tool-contract'||raw?.basis==='external-postcondition';
    const observationId=boundedText(raw?.observationId,180);
    const invalidExternalClaim=raw?.externalObservation===true&&raw?.basis!=='external-postcondition';
    const invalidVerifiedClaim=raw?.verified===true&&(!allowedBasis||raw.basis==='none');
    const missingExternalIdentity=raw?.basis==='external-postcondition'&&raw?.externalObservation===true&&!observationId;
    if(invalidExternalClaim||invalidVerifiedClaim||missingExternalIdentity)return {resolved:false,reason:'provider-receipt-invalid'};
    const expected=boundedText(raw?.expectedPostcondition,1024);
    const observed=boundedText(raw?.observedPostcondition,1024);
    const assessment=assessExternalPostcondition({...raw,observationId,expectedPostcondition:expected,observedPostcondition:observed});
    const verified=assessment==='match'||(assessment==='not-external'&&raw.basis==='tool-contract'&&raw.verified===true&&input.ok===true);
    const ok=Boolean(input.ok)&&assessment!=='contradiction';
    const confidence01=cap(raw?.confidence01??0);
    const providerReceiptHash=sha256Stable({providerReceiptId});
    const revisionId=`outcome-revision:${sha256Stable({executionId,providerReceiptHash}).slice(0,48)}`;
    const status:OutcomeProjectionEvidenceRevision['status']=assessment==='contradiction'?'contradicted':verified?'verified':'unverified';
    const revisionFingerprint=sha256Stable({executionId,tool,providerReceiptHash,baseFingerprint:indexed.fingerprint,ok,verified,outcomeClass:input.outcomeClass,basis:allowedBasis?raw.basis:'none',confidence01,observationId:observationId??null,expectedHash:expected?sha256Stable(expected.normalize('NFKC').trim().toLocaleLowerCase()):null,observedHash:observed?sha256Stable(observed.normalize('NFKC').trim().toLocaleLowerCase()):null,status});
    const existing=this.evidenceRevisions.find(row=>row.revisionId===revisionId);
    if(existing){
      if(existing.revisionFingerprint!==revisionFingerprint)return {resolved:false,reason:'evidence-revision-conflict'};
      return {resolved:true,revision:structuredClone(existing),causal:this.causal.snapshot(),replayed:true};
    }
    if(this.evidenceRevisions.length>=this.maxEvidenceRevisions)return {resolved:false,reason:'evidence-revision-ledger-full'};
    const priorRevision=[...this.evidenceRevisions].reverse().find(row=>row.executionId===executionId);
    const revision:OutcomeProjectionEvidenceRevision={
      revisionId,executionId,tool,revisionNumber:(priorRevision?.revisionNumber??0)+1,source:'authoritative-provider-receipt',providerReceiptHash,
      baseFingerprint:indexed.fingerprint,revisionFingerprint,...(priorRevision?{supersedesRevisionId:priorRevision.revisionId}:{}),
      at:Date.now(),tick:Math.max(0,Math.floor(input.tick)),ok,verified,outcomeClass:input.outcomeClass,basis:allowedBasis?raw.basis:'none',confidence01,
      ...(observationId?{observationId}:{}),status,
    };
    const causal=this.causal.recordEvidenceRevision({revisionId,executionId,tool,tick:revision.tick,at:revision.at,revisionNumber:revision.revisionNumber,providerReceiptHash,baseFingerprint:indexed.fingerprint,revisionFingerprint,...(revision.supersedesRevisionId?{supersedesRevisionId:revision.supersedesRevisionId}:{}),ok,verified,outcomeClass:input.outcomeClass,basis:revision.basis,confidence01,observationId,status});
    if(!causal.resolved)return {resolved:false,reason:'causal-revision-conflict'};
    this.evidenceRevisions.push(revision);
    return {resolved:true,revision:structuredClone(revision),causal:causal.causal,replayed:causal.replayed};
  }

  causalAutobiography(limit=24){
    return this.records.slice(0,Math.max(1,Math.min(64,Math.floor(limit)))).map(r=>({
      at:r.at,tick:r.tick,executionId:r.executionId??null,tool:r.tool,action:r.ok?'executed':'failed',
      expectation:r.expectedPostcondition??null,observation:r.observedPostcondition??null,
      verification:r.receiptQuarantined?'ambiguous-execution-quarantined':r.externalEvidenceStatus==='corroborated'?'externally-corroborated':r.externalEvidenceStatus==='contradicted'?'externally-contradicted':r.externalEvidenceStatus==='mixed'?'conflicting-external-evidence':assessExternalPostcondition({basis:r.basis,externalObservation:r.externalObservation,observationId:r.observationId,expectedPostcondition:r.expectedPostcondition,observedPostcondition:r.observedPostcondition,verified:r.verified})==='contradiction'?'externally-contradicted':r.verified?'verified':r.externalObservation?'external-evidence-awaiting-reconciliation':'unverified',
      evidence:{basis:r.basis,observationId:r.observationId??null,confidence01:r.confidence01,external:Boolean(r.externalObservation),externalEvidenceStatus:r.externalEvidenceStatus??'none',externalObservationCount:r.externalObservations?.length??0,predictionId:r.predictionId??null,outcomeClass:r.outcomeClass??null,receiptQuarantined:Boolean(r.receiptQuarantined),receiptQuarantineReason:r.receiptQuarantineReason??null},
    }));
  }

  snapshot(){return {version:1,records:this.records.map(r=>structuredClone(r)),projectionIndex:[...this.projectionIndex.values()].map(row=>structuredClone(row)),evidenceRevisions:this.evidenceRevisions.map(row=>structuredClone(row)),causal:this.causal.snapshot()};}
  summary(){return {version:1,records:this.records.length,causal:this.causal.summary()};}
}
