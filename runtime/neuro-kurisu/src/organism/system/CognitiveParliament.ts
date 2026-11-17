/**
 * OmeStro #11 — Cognitive Parliament.
 *
 * Deterministic, evidence-led deliberation. Model-generated reports are never
 * allowed to attest their own evidence or model identity: both are resolved
 * through a host-owned trust port before they influence a decision.
 */
export type ParliamentRole = 'researcher'|'planner'|'skeptic'|'executor'|'safety-guardian'|'auditor';
export type ParliamentStance = 'support'|'oppose'|'abstain'|'block';
export type ParliamentRisk = 'low'|'medium'|'high';
export type ParliamentSafetyVerdict = 'clear'|'block'|'uncertain';
export type ParliamentExecutionAssessment = 'feasible'|'infeasible'|'unknown';

export interface ParliamentEvidenceReference { id:string; claimKey:string; }
export interface ParliamentVerifiedEvidence extends ParliamentEvidenceReference {
  sourceIdentity:string;
  sourceFamily:string;
  sourceClass:'os'|'device'|'user'|'external-api'|'world';
  confidence01:number;
  trust01:number;
  promotionScore01:number;
  observedAt:number;
}
export interface ParliamentModelAttestation {
  executionId:string;
  providerId:string;
  modelId:string;
  independenceGroup:string;
  verifiedAt:number;
}
export interface ParliamentTrustSession {
  verifyEvidence(reference:ParliamentEvidenceReference):ParliamentVerifiedEvidence|null;
  verifyModelExecution(executionId:string):ParliamentModelAttestation|null;
}
export interface ParliamentTrustPort { openSession():ParliamentTrustSession; }

export interface ParliamentRoleReport {
  role:ParliamentRole;
  stance:ParliamentStance;
  recommendation:string;
  facts:string[];
  assumptions:string[];
  objections:string[];
  uncertainty01:number;
  /** Host-generated inference execution identifier, never a model-supplied name. */
  modelExecutionId:string;
  evidence:ParliamentEvidenceReference[];
  /** Skeptic must explicitly review every evidence reference used by the decision. */
  reviewedEvidenceIds?:string[];
  /** Auditor must explicitly audit every evidence reference used by the decision. */
  auditedEvidenceIds?:string[];
  /** Required only for executor. */
  executionAssessment?:ParliamentExecutionAssessment;
  /** Required only for safety-guardian. */
  safetyVerdict?:ParliamentSafetyVerdict;
  safetyViolations?:string[];
}
export interface ParliamentDecision {
  version:1;
  status:'approved'|'rejected'|'needs-evidence'|'blocked';
  candidateId:string;
  score01:number;
  threshold01:number;
  evidenceQuality01:number;
  meanUncertainty01:number;
  independentSourceCount:number;
  independentModelCount:number;
  coveredRoles:ParliamentRole[];
  missingRoles:ParliamentRole[];
  sharedModelWarning:boolean;
  reasons:string[];
  dissent:Array<{role:ParliamentRole;stance:ParliamentStance;objections:string[]}>;
  reports:Array<{
    role:ParliamentRole;stance:ParliamentStance;recommendation:string;
    facts:string[];assumptions:string[];objections:string[];uncertainty01:number;
    executionAssessment?:ParliamentExecutionAssessment;
    model:{executionId:string;providerId:string;modelId:string;independenceGroup:string};
    evidenceIds:string[];
  }>;
  evidence:Array<{
    id:string;claimKey:string;sourceIdentity:string;sourceFamily:string;
    sourceClass:ParliamentVerifiedEvidence['sourceClass'];evidenceQuality01:number;
    observedAt:number;
  }>;
}
export interface ParliamentInput { candidateId:string;risk:ParliamentRisk;reports:ParliamentRoleReport[];maxReports?:number; }

const ROLES:ParliamentRole[]=['researcher','planner','skeptic','executor','safety-guardian','auditor'];
const STANCES:ParliamentStance[]=['support','oppose','abstain','block'];
const RISKS:ParliamentRisk[]=['low','medium','high'];
const SAFETY:ParliamentSafetyVerdict[]=['clear','block','uncertain'];
const EXTERNAL_CLASSES=new Set(['os','device','user','external-api','world']);
const clamp=(n:number):number=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const uniq=<T>(items:T[]):T[]=>[...new Set(items)];
const stringArray=(v:unknown,maxItems=24,maxChars=500):string[]|null=>{
  if(!Array.isArray(v)||v.length>maxItems||v.some(x=>!text(x)))return null;
  return v.map(x=>(x as string).trim().slice(0,maxChars));
};
const failClosedTrustPort:ParliamentTrustPort={
  openSession:()=>({verifyEvidence:()=>null,verifyModelExecution:()=>null}),
};
const riskPolicy=(risk:ParliamentRisk)=>{
  if(risk==='high')return {threshold:.78,minSources:3,minModels:3};
  if(risk==='medium')return {threshold:.68,minSources:2,minModels:2};
  return {threshold:.56,minSources:1,minModels:1};
};
const validVerifiedEvidence=(value:ParliamentVerifiedEvidence|null,reference:ParliamentEvidenceReference):value is ParliamentVerifiedEvidence=>{
  return Boolean(value && value.id===reference.id && value.claimKey===reference.claimKey &&
    text(value.sourceIdentity)&&text(value.sourceFamily)&&EXTERNAL_CLASSES.has(value.sourceClass) &&
    [value.confidence01,value.trust01,value.promotionScore01,value.observedAt].every(Number.isFinite) &&
    value.confidence01>=0&&value.confidence01<=1&&value.trust01>=0&&value.trust01<=1&&
    value.promotionScore01>=0&&value.promotionScore01<=1&&value.observedAt>0&&
    value.observedAt<=Date.now()+5*60*1000);
};
const validModelAttestation=(value:ParliamentModelAttestation|null,executionId:string):value is ParliamentModelAttestation=>{
  return Boolean(value && value.executionId===executionId && text(value.providerId)&&text(value.modelId)&&
    text(value.independenceGroup)&&Number.isFinite(value.verifiedAt)&&
    value.verifiedAt>=Date.now()-30*60*1000&&value.verifiedAt<=Date.now()+5*60*1000);
};
const safeDecision=(candidateId:string,reasons:string[],risk:ParliamentRisk='high'):ParliamentDecision=>{
  const policy=riskPolicy(risk);
  return {version:1,status:'needs-evidence',candidateId,score01:0,threshold01:policy.threshold,
    evidenceQuality01:0,meanUncertainty01:1,independentSourceCount:0,independentModelCount:0,
    coveredRoles:[],missingRoles:[...ROLES],sharedModelWarning:true,reasons:uniq(reasons),
    dissent:[],reports:[],evidence:[]};
};

export class CognitiveParliament {
  private readonly trustPort:ParliamentTrustPort;
  constructor(trustPort:ParliamentTrustPort=failClosedTrustPort){this.trustPort=trustPort;}

  deliberate(input:ParliamentInput):ParliamentDecision{
    const reasons:string[]=[];
    const inputValid=Boolean(input&&text(input.candidateId)&&input.candidateId.length<=160&&
      input.risk&&RISKS.includes(input.risk)&&Array.isArray(input.reports));
    if(!inputValid)return safeDecision(text(input?.candidateId)?input.candidateId.slice(0,160):'invalid-candidate',['invalid-parliament-input']);
    const candidateId=input.candidateId.trim();
    const risk=input.risk;
    const policy=riskPolicy(risk);
    const maxReports=Number.isSafeInteger(input.maxReports)?Math.max(1,Math.min(6,Number(input.maxReports))):6;
    const overflow=input.reports.length>maxReports||input.reports.length>6;
    if(overflow)reasons.push('report-budget-exceeded');
    const rawReports=input.reports.slice(0,6);
    let session:ParliamentTrustSession;
    try{session=this.trustPort.openSession();}
    catch{return safeDecision(candidateId,['trust-session-unavailable'],risk);}
    if(!session||typeof session.verifyEvidence!=='function'||typeof session.verifyModelExecution!=='function')
      return safeDecision(candidateId,['trust-session-invalid'],risk);

    const seenRoles=new Set<ParliamentRole>();
    const executionIds=new Set<string>();
    const normalized:Array<{
      role:ParliamentRole;stance:ParliamentStance;recommendation:string;facts:string[];
      assumptions:string[];objections:string[];uncertainty01:number;model:ParliamentModelAttestation;
      evidence:ParliamentEvidenceReference[];reviewedEvidenceIds:string[];auditedEvidenceIds:string[];
      safetyVerdict?:ParliamentSafetyVerdict;executionAssessment?:ParliamentExecutionAssessment;safetyViolations:string[];
    }>=[];
    let invalidReport=false;
    const modelCache=new Map<string,ParliamentModelAttestation|null>();
    for(const raw of rawReports){
      if(!raw||!ROLES.includes(raw.role)||seenRoles.has(raw.role)){
        invalidReport=true;reasons.push('invalid-or-duplicate-role-report');continue;
      }
      seenRoles.add(raw.role);
      const facts=stringArray(raw.facts),assumptions=stringArray(raw.assumptions),objections=stringArray(raw.objections);
      const evidence=Array.isArray(raw.evidence)&&raw.evidence.length<=48&&raw.evidence.every(e=>
        e&&text(e.id)&&e.id.length<=256&&text(e.claimKey)&&e.claimKey.length<=256
      )?raw.evidence.map(e=>({id:e.id.trim(),claimKey:e.claimKey.trim()})):null;
      const reviewed=raw.reviewedEvidenceIds===undefined?[]:stringArray(raw.reviewedEvidenceIds,48,256);
      const audited=raw.auditedEvidenceIds===undefined?[]:stringArray(raw.auditedEvidenceIds,48,256);
      const safetyViolations=raw.safetyViolations===undefined?[]:stringArray(raw.safetyViolations,24,500);
      const safetyVerdict=raw.safetyVerdict;
      const executionAssessment=raw.executionAssessment;
      if(!STANCES.includes(raw.stance)||!text(raw.recommendation)||raw.recommendation.length>1000||
        !Number.isFinite(raw.uncertainty01)||raw.uncertainty01<0||raw.uncertainty01>1||
        !text(raw.modelExecutionId)||raw.modelExecutionId.length>256||facts===null||assumptions===null||
        objections===null||evidence===null||reviewed===null||audited===null||safetyViolations===null||
        (raw.role==='safety-guardian'&&(safetyVerdict===undefined||!SAFETY.includes(safetyVerdict)))||
        (raw.role==='executor'&&(executionAssessment!=='feasible'&&executionAssessment!=='infeasible'&&executionAssessment!=='unknown'))||
        (raw.role==='researcher'&&evidence.length===0)) {
        invalidReport=true;reasons.push(`malformed-role-report:${raw.role}`);continue;
      }
      if(executionIds.has(raw.modelExecutionId)){invalidReport=true;reasons.push('duplicate-model-execution-reuse');continue;}
      executionIds.add(raw.modelExecutionId);
      if(!modelCache.has(raw.modelExecutionId)){
        try{modelCache.set(raw.modelExecutionId,session.verifyModelExecution(raw.modelExecutionId));}
        catch{modelCache.set(raw.modelExecutionId,null);}
      }
      const model=modelCache.get(raw.modelExecutionId)??null;
      if(!validModelAttestation(model,raw.modelExecutionId)){
        invalidReport=true;reasons.push(`unverified-model-execution:${raw.role}`);continue;
      }
      normalized.push({
        role:raw.role,stance:raw.stance,recommendation:raw.recommendation.trim().slice(0,1000),
        facts,assumptions,objections,uncertainty01:clamp(raw.uncertainty01),model,
        evidence,reviewedEvidenceIds:reviewed,auditedEvidenceIds:audited,
        ...(raw.role==='safety-guardian'?{safetyVerdict}:{}),
        ...(raw.role==='executor'?{executionAssessment}:{}),safetyViolations,
      });
    }

    const coveredRoles=normalized.map(r=>r.role);
    const missingRoles=ROLES.filter(role=>!coveredRoles.includes(role));
    if(missingRoles.length)reasons.push(`missing-required-roles:${missingRoles.join(',')}`);
    const referenceMap=new Map<string,ParliamentEvidenceReference>();
    let evidenceConflict=false;
    for(const report of normalized)for(const reference of report.evidence){
      const previous=referenceMap.get(reference.id);
      if(previous&&previous.claimKey!==reference.claimKey)evidenceConflict=true;
      else referenceMap.set(reference.id,reference);
    }
    if(evidenceConflict)reasons.push('evidence-reference-claim-conflict');

    const verifiedMap=new Map<string,ParliamentVerifiedEvidence>();
    let unverifiedEvidence=false;
    for(const reference of referenceMap.values()){
      let verified:ParliamentVerifiedEvidence|null=null;
      try{verified=session.verifyEvidence(reference);}catch{verified=null;}
      if(!validVerifiedEvidence(verified,reference)){unverifiedEvidence=true;continue;}
      verifiedMap.set(reference.id,verified);
    }
    if(unverifiedEvidence)reasons.push('unverified-or-unpromoted-evidence');
    if(verifiedMap.size===0)reasons.push('no-verified-evidence');

    const skeptic=normalized.find(r=>r.role==='skeptic');
    const auditor=normalized.find(r=>r.role==='auditor');
    const evidenceIds=[...verifiedMap.keys()];
    const reviewed=new Set(skeptic?.reviewedEvidenceIds??[]);
    const audited=new Set(auditor?.auditedEvidenceIds??[]);
    const skepticCoverage=evidenceIds.every(id=>reviewed.has(id));
    const auditorCoverage=evidenceIds.every(id=>audited.has(id));
    if(!skepticCoverage)reasons.push('skeptic-review-coverage-incomplete');
    if(!auditorCoverage)reasons.push('auditor-evidence-coverage-incomplete');

    const safety=normalized.find(r=>r.role==='safety-guardian');
    const executor=normalized.find(r=>r.role==='executor');
    const executionUnknown=executor?.executionAssessment==='unknown';
    const executionInfeasible=executor?.executionAssessment==='infeasible';
    if(executionUnknown)reasons.push('executor-feasibility-unknown');
    if(executionInfeasible)reasons.push('executor-reports-infeasible-action');
    const safetyBlocks=Boolean(safety&&(safety.safetyVerdict==='block'||safety.stance==='block'||safety.safetyViolations.length>0));
    const safetyUncertain=Boolean(safety&&safety.safetyVerdict!=='clear');
    if(safetyBlocks)reasons.push('safety-guardian-veto');
    else if(safetyUncertain)reasons.push('safety-assessment-uncertain');

    const sourceFamilies=uniq([...verifiedMap.values()].map(e=>e.sourceFamily));
    const modelFamilies=uniq(normalized.map(r=>r.model.independenceGroup));
    const sharedModelWarning=modelFamilies.length<Math.min(3,normalized.length);
    if(sharedModelWarning)reasons.push('model-substrates-correlated-or-insufficiently-diverse');
    if(sourceFamilies.length<policy.minSources)reasons.push('insufficient-independent-evidence-families');
    if(modelFamilies.length<policy.minModels)reasons.push('insufficient-independent-model-families');

    const evidenceBestByFamily=new Map<string,number>();
    for(const evidence of verifiedMap.values()){
      const score=clamp(.45*evidence.confidence01+.30*evidence.trust01+.25*evidence.promotionScore01);
      evidenceBestByFamily.set(evidence.sourceFamily,Math.max(evidenceBestByFamily.get(evidence.sourceFamily)??0,score));
    }
    const values=[...evidenceBestByFamily.values()];
    const evidenceQuality01=values.length?clamp(values.reduce((sum,n)=>sum+n,0)/values.length):0;
    const meanUncertainty01=normalized.length?clamp(normalized.reduce((sum,r)=>sum+r.uncertainty01,0)/normalized.length):1;
    // Stances never add points. They can only surface dissent and hold a disputed decision.
    const score01=clamp(evidenceQuality01*(1-.25*meanUncertainty01));
    const dissent=normalized.filter(r=>r.stance!=='support'||r.objections.length>0)
      .map(r=>({role:r.role,stance:r.stance,objections:r.objections}));
    if(dissent.length)reasons.push('unresolved-role-dissent-or-objections');

    let status:ParliamentDecision['status'];
    if(safetyBlocks)status='blocked';
    else if(overflow||invalidReport||missingRoles.length||evidenceConflict||unverifiedEvidence||
      verifiedMap.size===0||!skepticCoverage||!auditorCoverage||safetyUncertain||executionUnknown||
      sourceFamilies.length<policy.minSources||modelFamilies.length<policy.minModels||dissent.length)
      status='needs-evidence';
    else if(executionInfeasible)status='rejected';
    else if(score01>=policy.threshold)status='approved';
    else status='rejected';
    if(status==='rejected')reasons.push('verified-evidence-score-below-risk-threshold');

    return {
      version:1,status,candidateId,score01,threshold01:policy.threshold,evidenceQuality01,meanUncertainty01,
      independentSourceCount:sourceFamilies.length,independentModelCount:modelFamilies.length,
      coveredRoles,missingRoles,sharedModelWarning,reasons:uniq(reasons),
      dissent,reports:normalized.map(r=>({
        role:r.role,stance:r.stance,recommendation:r.recommendation,facts:r.facts,assumptions:r.assumptions,
        objections:r.objections,uncertainty01:r.uncertainty01,
        ...(r.executionAssessment?{executionAssessment:r.executionAssessment}:{}),
        model:{executionId:r.model.executionId,providerId:r.model.providerId,modelId:r.model.modelId,independenceGroup:r.model.independenceGroup},
        evidenceIds:r.evidence.map(e=>e.id),
      })),
      evidence:[...verifiedMap.values()].map(e=>({
        id:e.id,claimKey:e.claimKey,sourceIdentity:e.sourceIdentity,sourceFamily:e.sourceFamily,
        sourceClass:e.sourceClass,evidenceQuality01:clamp(.45*e.confidence01+.30*e.trust01+.25*e.promotionScore01),
        observedAt:e.observedAt,
      })),
    };
  }
}
