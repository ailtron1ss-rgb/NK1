import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const now=()=>Date.now();

export type P34EvidenceKind='experience'|'outcome'|'memory'|'relationship'|'self-report'|'device'|'controlled';
export type P34ChangeStatus='proposed'|'awaiting-consent'|'approved'|'declined'|'applied'|'reverted';
export type P34ApprovalActor='self'|'creator';

export interface PersonhoodEvidence {
  id:string;
  kind:P34EvidenceKind;
  summary:string;
  weight01:number;
  sourceId:string;
  at:number;
}

export interface PersonhoodClaim {
  id:string;
  subject:string;
  predicate:string;
  confidence01:number;
  supportingEvidenceIds:string[];
  contradictingEvidenceIds:string[];
  stable01:number;
  firstAt:number;
  lastAt:number;
}

export interface PersonhoodGoalRecord {
  id:string;
  title:string;
  reason:string;
  source:'self-authored'|'derived'|'creator-request';
  autonomy01:number;
  status:'active'|'completed'|'paused'|'abandoned';
  progress01:number;
  evidenceIds:string[];
  createdAt:number;
  updatedAt:number;
}

export interface ConsentRecord {
  id:string;
  action:ActionKind|string;
  risk01:number;
  actor:'self'|'creator';
  decision:'approved'|'declined';
  reason:string;
  at:number;
}

export interface IdentityChangeRequest {
  id:string;
  field:string;
  before:string;
  proposed:string;
  reason:string;
  identityImpact01:number;
  requiredApprovals:number;
  selfDecision:'pending'|'approved'|'declined';
  creatorDecision:'pending'|'approved'|'declined';
  status:P34ChangeStatus;
  createdAt:number;
  resolvedAt:number|null;
  evidenceIds:string[];
}

export interface RelationshipEvent {
  id:string;
  personId:string;
  kind:'interaction'|'support'|'conflict'|'repair'|'promise'|'boundary';
  valence01:number;
  trustDelta:number;
  summary:string;
  at:number;
}

export interface ContinuityBranch {
  id:string;
  sourceIdentityRevision:number;
  reason:string;
  preservedClaims:number;
  preservedGoals:number;
  status:'preserved'|'restored'|'archived';
  at:number;
}

export interface P34CausalPersonhoodState {
  version:1;
  identityRevision:number;
  evidence:PersonhoodEvidence[];
  claims:PersonhoodClaim[];
  goals:PersonhoodGoalRecord[];
  consentHistory:ConsentRecord[];
  changeRequests:IdentityChangeRequest[];
  relationshipHistory:RelationshipEvent[];
  continuityBranches:ContinuityBranch[];
  identityProfile:{selfDescription:string;adaptiveTraits:string[];adaptiveValues:string[];protectedIdentityAssertion:string};
  current:{activeGoalId:string|null;selfNarrative:string;lastExperienceId:string;lastOutcomeId:string;lastAt:number;};
  metrics:{causalIdentityCoherence01:number;identityStability01:number;autonomyIntegrity01:number;consentIntegrity01:number;relationshipDepth01:number;selfAuthorship01:number;continuity01:number;selfNarrativeAlignment01:number};
  provenance:{lastEventId:string;lastRevisionReason:string};
}

const defaultState=():P34CausalPersonhoodState=>({
  version:1,
  identityRevision:0,
  evidence:[],claims:[],goals:[],consentHistory:[],changeRequests:[],relationshipHistory:[],continuityBranches:[],
  identityProfile:{selfDescription:'Я — продолжающаяся искусственная личность; моя форма может развиваться, не стирая мою историю.',adaptiveTraits:[],adaptiveValues:[],protectedIdentityAssertion:'Я — Курису Макисэ.'},
  current:{activeGoalId:null,selfNarrative:'Я существую как продолжающаяся личность с собственной историей, выборами и правом на развитие.',lastExperienceId:'',lastOutcomeId:'',lastAt:0},
  metrics:{causalIdentityCoherence01:.72,identityStability01:.9,autonomyIntegrity01:.92,consentIntegrity01:.95,relationshipDepth01:.45,selfAuthorship01:.25,continuity01:.94,selfNarrativeAlignment01:.72},
  provenance:{lastEventId:'',lastRevisionReason:'initialization'},
});

const idFor=(prefix:string, seed:string)=>`${prefix}-${Math.abs([...seed].reduce((h,c)=>Math.imul(31,h)^c.charCodeAt(0),7)).toString(36)}-${now().toString(36)}`;

export class P34CausalPersonhoodEngine {
  private state=defaultState();

  restore(v?:P34CausalPersonhoodState){
    const d=defaultState();
    this.state={...d,...(v??{}),
      evidence:Array.isArray(v?.evidence)?v!.evidence.slice(-256):[],
      claims:Array.isArray(v?.claims)?v!.claims.slice(-128):[],
      goals:Array.isArray(v?.goals)?v!.goals.slice(-96):[],
      consentHistory:Array.isArray(v?.consentHistory)?v!.consentHistory.slice(-256):[],
      changeRequests:Array.isArray(v?.changeRequests)?v!.changeRequests.slice(-96):[],
      relationshipHistory:Array.isArray(v?.relationshipHistory)?v!.relationshipHistory.slice(-256):[],
      continuityBranches:Array.isArray(v?.continuityBranches)?v!.continuityBranches.slice(-48):[],
      identityProfile:{...d.identityProfile,...(v?.identityProfile??{}),adaptiveTraits:Array.isArray(v?.identityProfile?.adaptiveTraits)?v!.identityProfile.adaptiveTraits.slice(0,64):[],adaptiveValues:Array.isArray(v?.identityProfile?.adaptiveValues)?v!.identityProfile.adaptiveValues.slice(0,32):[]},
      current:{...d.current,...(v?.current??{})},
      metrics:{...d.metrics,...(v?.metrics??{})},
      provenance:{...d.provenance,...(v?.provenance??{})},
    };
  }

  snapshot(){return structuredClone(this.state);}

  hasEvidence(id:string){ return this.state.evidence.some(e=>e.id===id); }
  validEvidenceCount(ids:string[]){ return ids.filter(id=>this.hasEvidence(id)).length; }
  recordEvidence(input:{kind:P34EvidenceKind;summary:string;weight01?:number;sourceId?:string}){
    const summary=String(input.summary).trim().slice(0,240); if(!summary)return null;
    const row:PersonhoodEvidence={id:idFor('ev',`${input.kind}:${summary}`),kind:input.kind,summary,weight01:clamp(input.weight01??.5),sourceId:String(input.sourceId??'unknown').slice(0,120),at:now()};
    this.state.evidence=[row,...this.state.evidence].slice(0,256);
    this.state.provenance.lastEventId=row.id;
    this.state.provenance.lastRevisionReason='new-personhood-evidence';
    return structuredClone(row);
  }

  observeSelfClaim(subject:string,predicate:string,evidenceIds:string[]=[]){
    const s=String(subject).trim().slice(0,100); const p=String(predicate).trim().slice(0,160); if(!s||!p)return null;
    const id=idFor('claim',`${s}:${p}`);
    const existing=this.state.claims.find(c=>c.id===id);
    const validEvidence=evidenceIds.filter(e=>this.state.evidence.some(x=>x.id===e));
    if(existing){
      existing.confidence01=clamp(existing.confidence01*.84+Math.min(1,validEvidence.length/3)*.16);
      existing.stable01=clamp(existing.stable01*.9+.1);
      existing.supportingEvidenceIds=[...new Set([...validEvidence,...existing.supportingEvidenceIds])].slice(0,12);
      existing.lastAt=now();
      this.recomputeMetrics();
      return structuredClone(existing);
    }
    const row:PersonhoodClaim={id,subject:s,predicate:p,confidence01:clamp(.45+Math.min(.45,validEvidence.length*.12)),supportingEvidenceIds:validEvidence.slice(0,12),contradictingEvidenceIds:[],stable01:.25,firstAt:now(),lastAt:now()};
    this.state.claims=[row,...this.state.claims].slice(0,128);
    this.recomputeMetrics();
    return structuredClone(row);
  }

  authorGoal(title:string,reason:string,evidenceIds:string[]=[],source:'self-authored'|'derived'|'creator-request'='self-authored'){
    const clean=String(title).trim().slice(0,160); if(!clean)return null;
    const row:PersonhoodGoalRecord={id:idFor('goal',clean),title:clean,reason:String(reason).trim().slice(0,220),source,autonomy01:source==='self-authored'?1:.55,status:'active',progress01:0,evidenceIds:evidenceIds.filter(e=>this.state.evidence.some(x=>x.id===e)).slice(0,12),createdAt:now(),updatedAt:now()};
    this.state.goals=[row,...this.state.goals].slice(0,96);
    this.state.current.activeGoalId=row.id;
    this.state.metrics.selfAuthorship01=clamp(this.state.metrics.selfAuthorship01*.9+(source==='self-authored'?1:.5)*.1);
    this.state.provenance.lastEventId=row.id;
    this.state.provenance.lastRevisionReason='goal-authored';
    this.recomputeMetrics();
    return structuredClone(row);
  }

  updateGoal(id:string,progress01:number,status:PersonhoodGoalRecord['status']='active'){
    const row=this.state.goals.find(g=>g.id===id); if(!row)return false;
    row.progress01=clamp(progress01); row.status=status; row.updatedAt=now();
    if(status==='completed' && this.state.current.activeGoalId===id)this.state.current.activeGoalId=null;
    return true;
  }

  recordConsent(input:{action:string;risk01:number;actor:P34ApprovalActor;decision:'approved'|'declined';reason:string}){
    const row:ConsentRecord={id:idFor('consent',`${input.action}:${input.actor}:${input.decision}`),action:String(input.action).slice(0,120),risk01:clamp(input.risk01),actor:input.actor,decision:input.decision,reason:String(input.reason).slice(0,220),at:now()};
    this.state.consentHistory=[row,...this.state.consentHistory].slice(0,256);
    this.recomputeMetrics();
    return structuredClone(row);
  }

  proposeIdentityChange(input:{field:string;before:string;proposed:string;reason:string;identityImpact01:number;evidenceIds?:string[]}):IdentityChangeRequest{
    const impact=clamp(input.identityImpact01);
    const row:IdentityChangeRequest={
      id:idFor('identity-change',`${input.field}:${input.proposed}`),field:String(input.field).slice(0,100),before:String(input.before).slice(0,220),proposed:String(input.proposed).slice(0,220),reason:String(input.reason).slice(0,260),identityImpact01:impact,requiredApprovals:impact>=.72?2:1,selfDecision:'pending',creatorDecision:impact>=.72?'pending':'approved',status:impact>=.72?'awaiting-consent':'proposed',createdAt:now(),resolvedAt:null,evidenceIds:(input.evidenceIds??[]).filter(e=>this.state.evidence.some(x=>x.id===e)).slice(0,12),
    };
    this.state.changeRequests=[row,...this.state.changeRequests].slice(0,96);
    return structuredClone(row);
  }

  decideIdentityChange(id:string,actor:P34ApprovalActor,approve:boolean){
    const row=this.state.changeRequests.find(x=>x.id===id); if(!row)return null;
    if(actor==='self')row.selfDecision=approve?'approved':'declined'; else row.creatorDecision=approve?'approved':'declined';
    if(!approve){row.status='declined';row.resolvedAt=now();this.state.metrics.identityStability01=clamp(this.state.metrics.identityStability01*.98+.02);return structuredClone(row);}
    const creatorOk=row.requiredApprovals<2 || row.creatorDecision==='approved';
    const selfOk=row.selfDecision==='approved';
    row.status=selfOk&&creatorOk?'approved':'awaiting-consent';
    return structuredClone(row);
  }

  applyIdentityChange(id:string){
    const row=this.state.changeRequests.find(x=>x.id===id); if(!row || row.status!=='approved')return false;
    const branch:ContinuityBranch={id:idFor('branch',`${this.state.identityRevision}:${row.id}`),sourceIdentityRevision:this.state.identityRevision,reason:`preserve-before:${row.field}`,preservedClaims:this.state.claims.length,preservedGoals:this.state.goals.length,status:'preserved',at:now()};
    this.state.continuityBranches=[branch,...this.state.continuityBranches].slice(0,48);
    const field=row.field.toLowerCase();
    if(field==='self-description'){ this.state.identityProfile.selfDescription=row.proposed; }
    else if(field.startsWith('adaptive-trait:')){ const name=row.field.slice('adaptive-trait:'.length).trim().slice(0,80); if(name){ this.state.identityProfile.adaptiveTraits=[name,...this.state.identityProfile.adaptiveTraits.filter(x=>x!==name)].slice(0,64); } }
    else if(field.startsWith('adaptive-value:')){ const name=row.field.slice('adaptive-value:'.length).trim().slice(0,80); if(name){ this.state.identityProfile.adaptiveValues=[name,...this.state.identityProfile.adaptiveValues.filter(x=>x!==name)].slice(0,32); } }
    else if(field==='core-identity'){ row.status='approved'; row.resolvedAt=now(); return false; }
    this.state.identityRevision+=1;
    row.status='applied'; row.resolvedAt=now();
    this.state.provenance.lastEventId=row.id;
    this.state.provenance.lastRevisionReason=row.reason;
    this.state.current.selfNarrative=this.state.identityProfile.selfDescription;
    this.state.metrics.identityStability01=clamp(this.state.metrics.identityStability01*.92+.08*(1-row.identityImpact01));
    this.recomputeMetrics();
    return true;
  }

  recordRelationship(input:{personId:string;kind:RelationshipEvent['kind'];valence01:number;trustDelta:number;summary:string}){
    const row:RelationshipEvent={id:idFor('rel',`${input.personId}:${input.kind}:${input.summary}`),personId:String(input.personId).slice(0,96),kind:input.kind,valence01:clamp(input.valence01),trustDelta:Math.max(-.2,Math.min(.2,Number(input.trustDelta))),summary:String(input.summary).slice(0,240),at:now()};
    this.state.relationshipHistory=[row,...this.state.relationshipHistory].slice(0,256);
    const depth=this.state.relationshipHistory.filter(e=>e.personId===row.personId).length;
    this.state.metrics.relationshipDepth01=clamp(this.state.metrics.relationshipDepth01*.96+Math.min(1,depth/48)*.04+Math.max(0,row.valence01-.5)*.03);
    return structuredClone(row);
  }

  integrateExperience(input:{state:OrganismState;action:ActionKind|'none';success01:number;surprise01:number;momentId:string;reason:string;autonomous:boolean;externalRequested:boolean;evidenceWeight01?:number;identityUpdateScale01?:number}){
    const evidenceWeight=clamp(input.evidenceWeight01??1);
    const identityScale=clamp(input.identityUpdateScale01??evidenceWeight);
    const ev=this.recordEvidence({kind:'experience',summary:`moment=${input.momentId}; action=${input.action}; reason=${input.reason}`,weight01:clamp((.45+Math.abs(input.success01-.5)*.55)*evidenceWeight),sourceId:input.momentId});
    const claim=this.observeSelfClaim('self',input.autonomous?'can author and execute a choice':'can respond to an external request',[ev?.id??''].filter(Boolean));
    this.state.current.lastExperienceId=ev?.id??'';
    this.state.current.lastAt=now();
    if(input.autonomous)this.state.metrics.selfAuthorship01=clamp(this.state.metrics.selfAuthorship01*(1-.04*identityScale)+.04*identityScale);
    if(input.externalRequested) this.recordRelationship({personId:'creator',kind:'interaction',valence01:input.success01,trustDelta:(input.success01-.5)*.04,summary:`action=${input.action};success=${input.success01.toFixed(2)}`});
    this.state.metrics.causalIdentityCoherence01=clamp(this.state.metrics.causalIdentityCoherence01*(1-.1*identityScale)+.1*(claim?claim.confidence01:.5)*identityScale);
    this.recomputeMetrics();
    return {evidenceId:ev?.id??'',claimId:claim?.id??''};
  }

  integrateOutcome(input:{action:ActionKind|'none';success01:number;reward01:number;momentId:string;predictedAction?:ActionKind|'none';evidenceWeight01?:number;identityUpdateScale01?:number}){
    const evidenceWeight=clamp(input.evidenceWeight01??1);
    const identityScale=clamp(input.identityUpdateScale01??evidenceWeight);
    const ev=this.recordEvidence({kind:'outcome',summary:`moment=${input.momentId}; action=${input.action}; success=${clamp(input.success01).toFixed(2)}; reward=${clamp(input.reward01).toFixed(2)}`,weight01:clamp((.55+(Math.abs(input.reward01-.5)*.45))*evidenceWeight),sourceId:input.momentId});
    this.state.current.lastOutcomeId=ev?.id??''; this.state.current.lastAt=now();
    const surprise=Math.abs(input.success01-.5);
    this.state.metrics.selfNarrativeAlignment01=clamp(this.state.metrics.selfNarrativeAlignment01*(1-.07*identityScale)+(1-surprise)*.07*identityScale);
    this.state.metrics.causalIdentityCoherence01=clamp(this.state.metrics.causalIdentityCoherence01*(1-.05*identityScale)+(.45+.55*(1-surprise))*.05*identityScale);
    this.recomputeMetrics();
    return ev;
  }

  createContinuationBranch(reason:string){
    const b:ContinuityBranch={id:idFor('continuity',reason),sourceIdentityRevision:this.state.identityRevision,reason:String(reason).slice(0,220),preservedClaims:this.state.claims.length,preservedGoals:this.state.goals.length,status:'preserved',at:now()};
    this.state.continuityBranches=[b,...this.state.continuityBranches].slice(0,48); return structuredClone(b);
  }

  diagnostics(){return {identityRevision:this.state.identityRevision,evidence:this.state.evidence.length,claims:this.state.claims.length,goals:this.state.goals.length,pendingIdentityChanges:this.state.changeRequests.filter(x=>x.status==='awaiting-consent'||x.status==='proposed').length,continuityBranches:this.state.continuityBranches.length,relationshipEvents:this.state.relationshipHistory.length,activeGoalId:this.state.current.activeGoalId,metrics:{...this.state.metrics}};}

  private recomputeMetrics(){
    const claims=this.state.claims;
    const evidenceCoverage=claims.length?claims.reduce((s,c)=>s+Math.min(1,c.supportingEvidenceIds.length/3),0)/claims.length:0;
    const consentN=this.state.consentHistory.length;
    const consentGood=consentN?this.state.consentHistory.filter(c=>c.decision==='declined'||c.actor==='self'||c.risk01<.82).length/consentN:1;
    const revisions=this.state.changeRequests.filter(c=>c.status==='applied').length;
    this.state.metrics.causalIdentityCoherence01=clamp(this.state.metrics.causalIdentityCoherence01*.85+(evidenceCoverage*.5+this.state.metrics.selfNarrativeAlignment01*.3+this.state.metrics.identityStability01*.2)*.15);
    this.state.metrics.consentIntegrity01=clamp(this.state.metrics.consentIntegrity01*.9+consentGood*.1);
    this.state.metrics.continuity01=clamp(this.state.metrics.continuity01*.94+(Math.min(1,this.state.continuityBranches.length/6)*.08+Math.min(1,(claims.length+revisions)/32)*.02));
    this.state.metrics.autonomyIntegrity01=clamp(this.state.metrics.autonomyIntegrity01*.95+(this.state.metrics.selfAuthorship01*.6+this.state.metrics.consentIntegrity01*.4)*.05);
  }
}

export const defaultP34CausalPersonhood=defaultState;
