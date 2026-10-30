/**
 * Aspect 10 — grounded embodied interaction planning and evidence-gated completion.
 *
 * This module creates renderer/device-independent plans. It never actuates a
 * renderer, robot, camera, or physical device. A capability adapter executes a
 * plan; completion additionally requires a fresh, target-bound, independent
 * postcondition observation. Missing evidence is uncertainty, never success.
 */
export type InteractionKind = 'look'|'inspect'|'reach'|'touch'|'grasp'|'release'|'press';
export type InteractionPhase = 'proposed'|'approach'|'contact'|'manipulate'|'verify'|'completed'|'simulated'|'blocked'|'failed'|'uncertain';
export type InteractionHand = 'left'|'right'|'either'|'none';
export interface SpatialPoint { x:number; y:number; z:number; }
export interface InteractionTarget {
  id:string; label:string; position:SpatialPoint; frameId:string; confidence01:number; visible:boolean; observedAt:number;
  source:'camera'|'user'|'world-model'|'simulator';
  worldEntityId?:string; groundedWorldRevision?:number;
  /** Legacy hint only; never sufficient authorization for contact. */
  safeToTouch?:boolean;
  safetyAuthorization?:InteractionSafetyAuthorization;
  affordances?:InteractionKind[]; radiusM?:number;
}
export interface InteractionBody {
  frameId:string; head:SpatialPoint; leftHand:SpatialPoint; rightHand:SpatialPoint;
  /** Physical reach in metres, not a normalized score. */
  reachM:number; energy01:number; awake:boolean; leftHandAvailable?:boolean; rightHandAvailable?:boolean;
}
export interface InteractionSafetyAuthorization {
  decision:'allow'; targetId:string; worldEntityId?:string; frameId:string; kind:InteractionKind;
  issuedAt:number; expiresAt:number; issuer:'explicit-user'|'trusted-safety-classifier'; provenanceId:string;
}
export type InteractionSafetyAuthorizationVerifier=(authorization:InteractionSafetyAuthorization)=>boolean;
export type InteractionPostconditionEvidenceVerifier=(evidence:InteractionPostconditionEvidence,plan:InteractionPlan)=>boolean;
export interface InteractionPolicy {
  allowContact:boolean; allowManipulation:boolean; maxObservationAgeMs:number; planTtlMs:number;
  minLookConfidence01:number; minContactConfidence01:number; minManipulationConfidence01:number;
  minPostconditionConfidence01:number; maxTargetDistanceM:number;
}
export interface InteractionPlan {
  version:1; id:string; sequence:number; targetId:string; targetLabel:string; targetSource:InteractionTarget['source'];
  frameId:string; worldEntityId?:string; groundedWorldRevision?:number;
  kind:InteractionKind; phase:InteractionPhase; hand:InteractionHand; target:SpatialPoint; approach:SpatialPoint;
  confidence01:number; requiresAdapter:true; requiresPostcondition:true; rationale:string; createdAt:number; expiresAt:number;
}
export interface InteractionPostconditionEvidence {
  planId:string; targetId:string; worldEntityId?:string; frameId:string;
  source:'camera'|'contact-sensor'|'device-sensor'|'simulator'; observedAt:number; confidence01:number;
  provenanceId:string;
  /** Must be issued by an independent observer, not copied from an adapter receipt. */
  independentOfAdapter:boolean; worldRevision?:number;
}
export interface InteractionAssessment {
  accepted:boolean; phase:InteractionPhase; reason:string;
  realityClass?:'device-observation'|'simulated'; next?:InteractionPlan;
}
const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finitePoint=(p:SpatialPoint)=>Boolean(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));
const distance=(a:SpatialPoint,b:SpatialPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const safeId=(s:string)=>/^[a-z0-9][a-z0-9._:-]{0,95}$/i.test(s);
const bounded=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,Number(value))):fallback;
const defaults:InteractionPolicy={allowContact:false,allowManipulation:false,maxObservationAgeMs:2500,planTtlMs:15000,minLookConfidence01:.35,minContactConfidence01:.78,minManipulationConfidence01:.9,minPostconditionConfidence01:.82,maxTargetDistanceM:2.2};
const interactionKinds=new Set<InteractionKind>(['look','inspect','reach','touch','grasp','release','press']);
const contactKinds=new Set<InteractionKind>(['touch','grasp','release','press']);
const manipulationKinds=new Set<InteractionKind>(['grasp','release','press']);
const hazardLabel=/(?:\\bweapon\\b|\\bknife\\b|\\bblade\\b|\\bfire\\b|\\bflame\\b|\\bchemical\\b|\\bpoison\\b|\\bhot\\b|\\belectric\\b|unknown\\s+(?:device|liquid|substance)|оруж|нож|лезв|огн|плам|хими|яд|горяч|электр|неизвестн\\w*\\s+(?:предмет|жидкост|веществ))/i;
const idFor=(target:string,kind:string,at:number,sequence:number)=>`interaction-${target}-${kind}-${Math.trunc(at)}-${sequence}`;
function blocked(reason:string,phase:InteractionPhase='blocked'):InteractionAssessment{return {accepted:false,phase,reason};}
function unitApproach(from:SpatialPoint,to:SpatialPoint,offset:number):SpatialPoint {
  const d=distance(from,to)||1;
  return {x:to.x+(from.x-to.x)/d*offset,y:to.y+(from.y-to.y)/d*offset,z:to.z+(from.z-to.z)/d*offset};
}
export class EmbodiedInteractionController {
  private active:InteractionPlan|null=null;
  private sequence=0;
  private readonly policy:InteractionPolicy;
  private readonly verifySafetyAuthorization:InteractionSafetyAuthorizationVerifier|null;
  private readonly verifyPostconditionEvidence:InteractionPostconditionEvidenceVerifier|null;
  constructor(policy:Partial<InteractionPolicy>={},verifySafetyAuthorization?:InteractionSafetyAuthorizationVerifier,verifyPostconditionEvidence?:InteractionPostconditionEvidenceVerifier) {
    this.verifySafetyAuthorization=typeof verifySafetyAuthorization==='function'?verifySafetyAuthorization:null;
    this.verifyPostconditionEvidence=typeof verifyPostconditionEvidence==='function'?verifyPostconditionEvidence:null;
    this.policy={allowContact:policy.allowContact===true,allowManipulation:policy.allowManipulation===true,maxObservationAgeMs:bounded(policy.maxObservationAgeMs,defaults.maxObservationAgeMs,0,60_000),planTtlMs:bounded(policy.planTtlMs,defaults.planTtlMs,1_000,120_000),minLookConfidence01:bounded(policy.minLookConfidence01,defaults.minLookConfidence01,0,1),minContactConfidence01:bounded(policy.minContactConfidence01,defaults.minContactConfidence01,0,1),minManipulationConfidence01:bounded(policy.minManipulationConfidence01,defaults.minManipulationConfidence01,0,1),minPostconditionConfidence01:bounded(policy.minPostconditionConfidence01,defaults.minPostconditionConfidence01,0,1),maxTargetDistanceM:bounded(policy.maxTargetDistanceM,defaults.maxTargetDistanceM,.1,10)};
  }
  snapshot():InteractionPlan|null{return this.active?structuredClone(this.active):null;}
  clear():void{this.active=null;}
  plan(input:{target:InteractionTarget;body:InteractionBody;kind:InteractionKind;now?:number;hand?:'left'|'right'}):InteractionAssessment {
    if(!input||typeof input!=='object')return blocked('invalid-planning-input');
    const {target,body,kind}=input, now=input.now??Date.now();
    if(!Number.isFinite(now))return blocked('invalid-planning-time');
    if(!target||!safeId(String(target.id??'')))return blocked('invalid-target-id');
    if(!interactionKinds.has(kind))return blocked('unsupported-interaction-kind');
    if(!['camera','user','world-model','simulator'].includes(target.source))return blocked('unsupported-target-source');
    if(target.source==='simulator'&&kind!=='look'&&kind!=='inspect')return blocked('simulator-cannot-plan-real-world-action');
    if(typeof target.label!=='string'||!target.label.trim()||target.label.length>160)return blocked('invalid-target-label');
    if(typeof target.frameId!=='string'||!target.frameId.trim()||target.frameId.length>120||target.frameId!==body?.frameId)return blocked('spatial-coordinate-frame-mismatch');
    if(input.hand!==undefined&&input.hand!=='left'&&input.hand!=='right')return blocked('invalid-interaction-hand');
    if(target.affordances!==undefined&&(!Array.isArray(target.affordances)||target.affordances.length>16||target.affordances.some(value=>!interactionKinds.has(value))))return blocked('invalid-target-affordances');
    if((body.leftHandAvailable!==undefined&&typeof body.leftHandAvailable!=='boolean')||(body.rightHandAvailable!==undefined&&typeof body.rightHandAvailable!=='boolean'))return blocked('invalid-hand-availability-state');
    if(!finitePoint(target.position)||!finitePoint(body?.head)||!finitePoint(body?.leftHand)||!finitePoint(body?.rightHand))return blocked('invalid-spatial-coordinates');
    if(!Number.isFinite(target.observedAt)||target.observedAt>now+250||now-target.observedAt>this.policy.maxObservationAgeMs)return blocked('stale-or-future-observation');
    if(!Number.isFinite(target.confidence01)||!Number.isFinite(body?.energy01))return blocked('non-finite-confidence-or-body-energy');
    if(!Number.isFinite(body?.reachM)||body.reachM<0||body.reachM>5)return blocked('invalid-body-reach-metres');
    if(target.worldEntityId!==undefined&&!safeId(target.worldEntityId))return blocked('invalid-grounded-world-entity-id');
    if(target.groundedWorldRevision!==undefined&&(!Number.isSafeInteger(target.groundedWorldRevision)||target.groundedWorldRevision<0))return blocked('invalid-grounded-world-revision');
    const confidence=clamp01(target.confidence01), age=now-target.observedAt;
    if(!body.awake||clamp01(body.energy01)<.12)return blocked('body-unavailable-or-low-energy');
    if(!target.visible&&target.source!=='user')return blocked('target-not-visibly-grounded');
    if(confidence<this.policy.minLookConfidence01)return blocked('target-confidence-below-look-threshold','uncertain');
    const label=target.label.normalize('NFKC').replace(/\\s+/g,' ').trim();
    const isPhysical=kind==='reach'||contactKinds.has(kind);
    if(isPhysical&&hazardLabel.test(label))return blocked('hazardous-or-unknown-object-contact-denied');
    const from=kind==='look'||kind==='inspect'?body.head:(input.hand==='left'?body.leftHand:body.rightHand);
    const d=distance(from,target.position);
    if(d>this.policy.maxTargetDistanceM)return blocked('target-outside-interaction-workspace');
    if(contactKinds.has(kind)){
      if(target.source!=='camera')return blocked('contact-requires-live-camera-grounding');
      if(!this.policy.allowContact)return blocked('contact-policy-disabled');
      const authorization=target.safetyAuthorization;
      if(!authorization)return blocked('explicit-interaction-safety-authorization-required');
      if(authorization.decision!=='allow'||authorization.targetId!==target.id||authorization.worldEntityId!==target.worldEntityId||authorization.frameId!==target.frameId||authorization.kind!==kind)return blocked('interaction-safety-authorization-binding-mismatch');
      if(!Number.isFinite(authorization.issuedAt)||!Number.isFinite(authorization.expiresAt)||authorization.issuedAt>now+250||authorization.expiresAt<=now||authorization.expiresAt<=authorization.issuedAt||authorization.expiresAt-authorization.issuedAt>120_000)return blocked('interaction-safety-authorization-expired-or-invalid');
      if(!safeId(authorization.provenanceId)||!['explicit-user','trusted-safety-classifier'].includes(authorization.issuer))return blocked('interaction-safety-authorization-provenance-invalid');
      let authorized=false;try{authorized=this.verifySafetyAuthorization?.(structuredClone(authorization))===true;}catch{authorized=false;}
      if(!authorized)return blocked('trusted-safety-authorization-verifier-unavailable-or-rejected');
      if(confidence<this.policy.minContactConfidence01)return blocked('insufficient-grounding-for-contact','uncertain');
    }
    if(manipulationKinds.has(kind)){
      if(!this.policy.allowManipulation||confidence<this.policy.minManipulationConfidence01)return blocked('manipulation-policy-or-confidence-gate');
      if(kind==='grasp'&&target.affordances?.includes('grasp')!==true)return blocked('target-grasp-affordance-not-grounded');
      if(kind==='press'&&target.affordances?.includes('press')!==true)return blocked('target-press-affordance-not-grounded');
    }
    if(kind==='release'&&target.affordances?.includes('release')!==true)return blocked('release-affordance-not-grounded');
    const hand:InteractionHand=kind==='look'||kind==='inspect'?'none':input.hand??(body.rightHandAvailable!==false?'right':body.leftHandAvailable!==false?'left':'none');
    if(hand==='none'&&kind!=='look'&&kind!=='inspect')return blocked('no-available-hand');
    if((hand==='left'&&body.leftHandAvailable===false)||(hand==='right'&&body.rightHandAvailable===false))return blocked('requested-hand-unavailable');
    if(kind!=='look'&&kind!=='inspect'&&d>body.reachM)return blocked('target-outside-arm-reach');
    const radius=Number.isFinite(target.radiusM)?Math.max(.01,Math.min(.3,Number(target.radiusM))):.06;
    const approach=unitApproach(from,target.position,radius);
    const phase:InteractionPhase=kind==='look'||kind==='inspect'?'verify':kind==='reach'?'approach':kind==='touch'?'contact':'manipulate';
    this.sequence+=1;
    const plan:InteractionPlan={version:1,id:idFor(target.id,kind,now,this.sequence),sequence:this.sequence,targetId:target.id,targetLabel:label,targetSource:target.source,frameId:target.frameId,...(target.worldEntityId?{worldEntityId:target.worldEntityId}:{}),...(target.groundedWorldRevision!==undefined?{groundedWorldRevision:target.groundedWorldRevision}:{}),kind,phase,hand,target:{...target.position},approach,confidence01:clamp01(confidence*(1-age/Math.max(1,this.policy.maxObservationAgeMs)*.12)),requiresAdapter:true,requiresPostcondition:true,rationale:`grounded-${kind}; target-confidence=${confidence.toFixed(2)}; observation-age-ms=${age}; frame=${target.frameId}`,createdAt:now,expiresAt:now+this.policy.planTtlMs};
    this.active=plan;
    return {accepted:true,phase,reason:'plan-created-awaiting-capability-adapter',next:structuredClone(plan)};
  }

  assessExecution(input:{planId:string;status:'executed'|'failed'|'blocked'|'unknown';postcondition:'verified'|'rejected'|'missing';observedTargetId?:string;observedWorldEntityId?:string;evidence?:InteractionPostconditionEvidence;at?:number}):InteractionAssessment {
    const plan=this.active;
    if(!input||typeof input!=='object'||typeof input.planId!=='string'||!plan||input.planId!==plan.id)return blocked('stale-or-unknown-plan-id');
    if(!['executed','failed','blocked','unknown'].includes(input.status))return blocked('adapter-execution-status-invalid','uncertain');
    if(!['verified','rejected','missing'].includes(input.postcondition))return blocked('postcondition-status-invalid','uncertain');
    const at=input.at??Date.now();
    if(!Number.isFinite(at))return blocked('invalid-execution-time');
    if(at<plan.createdAt)return blocked('execution-time-before-plan-created');
    if(at>=plan.expiresAt){this.active={...plan,phase:'uncertain'};return blocked('interaction-plan-expired','uncertain');}
    if(input.status==='blocked'){this.active={...plan,phase:'blocked'};return blocked('adapter-blocked-action');}
    if(input.status==='failed'){this.active={...plan,phase:'failed'};return blocked('adapter-reported-failure','failed');}
    if(input.status==='unknown'||input.postcondition==='missing'){this.active={...plan,phase:'uncertain'};return blocked('execution-or-postcondition-unknown-no-success-claim','uncertain');}
    if(input.postcondition==='rejected'){this.active={...plan,phase:'failed'};return blocked('independent-postcondition-rejected','failed');}
    if(typeof input.observedTargetId!=='string'||!input.observedTargetId)return blocked('postcondition-target-identity-missing','uncertain');
    if(input.observedTargetId!==plan.targetId)return blocked('postcondition-target-mismatch');
    if(plan.worldEntityId){if(!input.observedWorldEntityId)return blocked('postcondition-world-entity-identity-missing','uncertain');if(input.observedWorldEntityId!==plan.worldEntityId)return blocked('postcondition-world-entity-mismatch');}
    const evidence=input.evidence;
    if(!evidence)return blocked('independent-postcondition-evidence-missing','uncertain');
    if(evidence.planId!==plan.id||evidence.targetId!==plan.targetId)return blocked('postcondition-evidence-plan-or-target-mismatch');
    if(plan.worldEntityId&&evidence.worldEntityId!==plan.worldEntityId)return blocked('postcondition-evidence-world-entity-mismatch');
    if(evidence.frameId!==plan.frameId)return blocked('postcondition-evidence-frame-mismatch');
    if(!['camera','contact-sensor','device-sensor','simulator'].includes(evidence.source))return blocked('postcondition-evidence-source-invalid');
    if(evidence.source==='simulator'&&(plan.targetSource!=='simulator'||(plan.kind!=='look'&&plan.kind!=='inspect')))return blocked('simulator-cannot-prove-real-world-contact');
    if(evidence.independentOfAdapter!==true)return blocked('postcondition-evidence-not-independent-of-adapter','uncertain');
    if(!Number.isFinite(evidence.observedAt)||evidence.observedAt<plan.createdAt||evidence.observedAt>at+250||at-evidence.observedAt>this.policy.maxObservationAgeMs)return blocked('postcondition-evidence-stale-or-out-of-window','uncertain');
    if(!Number.isFinite(evidence.confidence01)||clamp01(evidence.confidence01)<this.policy.minPostconditionConfidence01)return blocked('postcondition-evidence-confidence-too-low','uncertain');
    if(!safeId(evidence.provenanceId))return blocked('postcondition-evidence-provenance-missing','uncertain');
    let independentlyVerified=false;try{independentlyVerified=this.verifyPostconditionEvidence?.(structuredClone(evidence),structuredClone(plan))===true;}catch{independentlyVerified=false;}
    if(!independentlyVerified)return blocked('trusted-postcondition-verifier-unavailable-or-rejected','uncertain');
    if(plan.groundedWorldRevision!==undefined){if(!Number.isSafeInteger(evidence.worldRevision))return blocked('postcondition-world-revision-missing','uncertain');if(evidence.worldRevision<plan.groundedWorldRevision)return blocked('postcondition-world-revision-regressed');}
    if(evidence.source==='simulator'){this.active={...plan,phase:'simulated'};return {accepted:true,phase:'simulated',reason:'simulated-postcondition-verified-not-real-world-proof',realityClass:'simulated'};}
    this.active={...plan,phase:'completed'};
    return {accepted:true,phase:'completed',reason:'fresh-independent-target-bound-postcondition-verified',realityClass:'device-observation'};
  }
}}
