/**
 * Aspect 10 — grounded embodied interaction planning.
 *
 * This module plans body/object interactions; it does not pretend to actuate a
 * renderer, robot, camera, or physical device. Execution must be delegated to a
 * capability adapter and advanced only by a verified postcondition.
 */
export type InteractionKind = 'look'|'inspect'|'reach'|'touch'|'grasp'|'release'|'press';
export type InteractionPhase = 'proposed'|'approach'|'contact'|'manipulate'|'verify'|'completed'|'blocked'|'failed'|'uncertain';
export type InteractionHand = 'left'|'right'|'either'|'none';
export interface SpatialPoint { x:number; y:number; z:number; }
export interface InteractionTarget {
  id:string;
  label:string;
  position:SpatialPoint;
  confidence01:number;
  visible:boolean;
  observedAt:number;
  source:'camera'|'user'|'world-model'|'simulator';
  safeToTouch?:boolean;
  affordances?:InteractionKind[];
  radiusM?:number;
}
export interface InteractionBody {
  head:SpatialPoint;
  leftHand:SpatialPoint;
  rightHand:SpatialPoint;
  reachM:number;
  energy01:number;
  awake:boolean;
  leftHandAvailable?:boolean;
  rightHandAvailable?:boolean;
}
export interface InteractionPolicy {
  allowContact:boolean;
  allowManipulation:boolean;
  maxObservationAgeMs:number;
  minLookConfidence01:number;
  minContactConfidence01:number;
  minManipulationConfidence01:number;
  maxTargetDistanceM:number;
}
export interface InteractionPlan {
  version:1;
  id:string;
  targetId:string;
  targetLabel:string;
  kind:InteractionKind;
  phase:InteractionPhase;
  hand:InteractionHand;
  target:SpatialPoint;
  approach:SpatialPoint;
  confidence01:number;
  requiresAdapter:boolean;
  requiresPostcondition:boolean;
  rationale:string;
  createdAt:number;
}
export interface InteractionAssessment {
  accepted:boolean;
  phase:InteractionPhase;
  reason:string;
  next?:InteractionPlan;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const finitePoint=(p:SpatialPoint)=>Boolean(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));
const distance=(a:SpatialPoint,b:SpatialPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const safeId=(s:string)=>/^[a-z0-9][a-z0-9._:-]{0,95}$/i.test(s);
const defaults:InteractionPolicy={allowContact:false,allowManipulation:false,maxObservationAgeMs:2500,minLookConfidence01:.35,minContactConfidence01:.78,minManipulationConfidence01:.9,maxTargetDistanceM:2.2};
const contactKinds=new Set<InteractionKind>(['touch','grasp','release','press']);
const manipulationKinds=new Set<InteractionKind>(['grasp','release','press']);
const hazards=/weapon|knife|blade|fire|flame|chemical|poison|hot|electric|unknown device|unknown liquid|unknown substance/i;
const idFor=(target:string,kind:string,at:number)=>`interaction-${target}-${kind}-${Math.trunc(at)}`;
function unitApproach(from:SpatialPoint,to:SpatialPoint,offset:number):SpatialPoint {
  const d=distance(from,to)||1;
  return {x:to.x+(from.x-to.x)/d*offset,y:to.y+(from.y-to.y)/d*offset,z:to.z+(from.z-to.z)/d*offset};
}
export class EmbodiedInteractionController {
  private active:InteractionPlan|null=null;
  private readonly policy:InteractionPolicy;
  constructor(policy:Partial<InteractionPolicy>={}) {
    this.policy={...defaults,...policy};
    this.policy.maxObservationAgeMs=Math.max(0,Math.min(60_000,this.policy.maxObservationAgeMs));
    this.policy.maxTargetDistanceM=Math.max(.1,Math.min(10,this.policy.maxTargetDistanceM));
  }
  snapshot(){return this.active?structuredClone(this.active):null;}
  clear(){this.active=null;}
  plan(input:{target:InteractionTarget;body:InteractionBody;kind:InteractionKind;now?:number;hand?:'left'|'right'}):InteractionAssessment {
    const {target,body,kind}=input; const now=input.now??Date.now();
    if(!target||!safeId(String(target.id??'')))return {accepted:false,phase:'blocked',reason:'invalid-target-id'};
    if(!finitePoint(target.position)||!finitePoint(body?.head)||!finitePoint(body?.leftHand)||!finitePoint(body?.rightHand))return {accepted:false,phase:'blocked',reason:'invalid-spatial-coordinates'};
    if(!Number.isFinite(target.observedAt)||target.observedAt>now+1000||now-target.observedAt>this.policy.maxObservationAgeMs)return {accepted:false,phase:'blocked',reason:'stale-or-future-observation'};
    const confidence=clamp(target.confidence01);
    const age=now-target.observedAt;
    if(!body.awake||clamp(body.energy01)<.12)return {accepted:false,phase:'blocked',reason:'body-unavailable-or-low-energy'};
    if(!target.visible&&target.source!=='user')return {accepted:false,phase:'blocked',reason:'target-not-visibly-grounded'};
    if(confidence<this.policy.minLookConfidence01)return {accepted:false,phase:'uncertain',reason:'target-confidence-below-look-threshold'};
    if(hazards.test(target.label))return {accepted:false,phase:'blocked',reason:'hazardous-or-unknown-object-contact-denied'};
    const from=kind==='look'||kind==='inspect'?body.head:(input.hand==='left'?body.leftHand:body.rightHand);
    const d=distance(from,target.position);
    if(d>this.policy.maxTargetDistanceM)return {accepted:false,phase:'blocked',reason:'target-outside-interaction-workspace'};
    if(contactKinds.has(kind)){
      if(!this.policy.allowContact||target.safeToTouch!==true)return {accepted:false,phase:'blocked',reason:'contact-not-explicitly-authorized'};
      if(confidence<this.policy.minContactConfidence01)return {accepted:false,phase:'uncertain',reason:'insufficient-grounding-for-contact'};
    }
    if(manipulationKinds.has(kind)){
      if(!this.policy.allowManipulation||confidence<this.policy.minManipulationConfidence01)return {accepted:false,phase:'blocked',reason:'manipulation-policy-or-confidence-gate'};
      if(kind==='grasp'&&target.affordances?.includes('grasp')!==true)return {accepted:false,phase:'blocked',reason:'target-grasp-affordance-not-grounded'};
      if(kind==='press'&&target.affordances?.includes('press')!==true)return {accepted:false,phase:'blocked',reason:'target-press-affordance-not-grounded'};
    }
    if(kind==='release'&&target.affordances?.includes('release')!==true)return {accepted:false,phase:'blocked',reason:'release-affordance-not-grounded'};
    const hand:InteractionHand=kind==='look'||kind==='inspect'?'none':input.hand??(body.rightHandAvailable!==false?'right':body.leftHandAvailable!==false?'left':'none');
    if(hand==='none'&&kind!=='look'&&kind!=='inspect')return {accepted:false,phase:'blocked',reason:'no-available-hand'};
    if(hand==='left'&&body.leftHandAvailable===false||hand==='right'&&body.rightHandAvailable===false)return {accepted:false,phase:'blocked',reason:'requested-hand-unavailable'};
    const reach=clamp(body.reachM);
    if(kind!=='look'&&kind!=='inspect'&&d>reach)return {accepted:false,phase:'blocked',reason:'target-outside-arm-reach'};
    const approach=unitApproach(from,target.position,Math.max(.025,Math.min(.18,target.radiusM??.06)));
    const phase:InteractionPhase=kind==='look'||kind==='inspect'?'verify':kind==='reach'?'approach':kind==='touch'?'contact':'manipulate';
    const plan:InteractionPlan={version:1,id:idFor(target.id,kind,now),targetId:target.id,targetLabel:String(target.label??'object').slice(0,96),kind,phase,hand,target:{...target.position},approach,confidence01:clamp(confidence*(1-age/Math.max(1,this.policy.maxObservationAgeMs)*.12)),requiresAdapter:true,requiresPostcondition:true,rationale:`grounded-${kind}; target-confidence=${confidence.toFixed(2)}; observation-age-ms=${age}`,createdAt:now};
    this.active=plan;
    return {accepted:true,phase,reason:'plan-created-awaiting-capability-adapter',next:structuredClone(plan)};
  }
  assessExecution(input:{planId:string;status:'executed'|'failed'|'blocked'|'unknown';postcondition:'verified'|'rejected'|'missing';observedTargetId?:string;at?:number}):InteractionAssessment {
    const plan=this.active;
    if(!plan||input.planId!==plan.id)return {accepted:false,phase:'blocked',reason:'stale-or-unknown-plan-id'};
    if(input.observedTargetId&&input.observedTargetId!==plan.targetId)return {accepted:false,phase:'blocked',reason:'postcondition-target-mismatch'};
    if(input.status==='blocked') {this.active={...plan,phase:'blocked'};return {accepted:false,phase:'blocked',reason:'adapter-blocked-action'};}
    if(input.status==='failed') {this.active={...plan,phase:'failed'};return {accepted:false,phase:'failed',reason:'adapter-reported-failure'};}
    if(input.status==='unknown'||input.postcondition==='missing'){this.active={...plan,phase:'uncertain'};return {accepted:false,phase:'uncertain',reason:'execution-or-postcondition-unknown-no-success-claim'};}
    if(input.postcondition==='rejected'){this.active={...plan,phase:'failed'};return {accepted:false,phase:'failed',reason:'independent-postcondition-rejected'};}
    this.active={...plan,phase:'completed'};
    return {accepted:true,phase:'completed',reason:'independent-postcondition-verified'};
  }
}
