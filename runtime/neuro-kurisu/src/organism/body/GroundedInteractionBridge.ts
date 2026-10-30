import type { GroundedWorldStateSnapshot, GroundedEntity } from '../world/GroundedWorldState.ts';
import type { InteractionTarget, SpatialPoint } from './EmbodiedInteractionController.ts';

const normalize=(value:string)=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/\\s+/g,' ').slice(0,120);
const clamp=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));

export interface CalibratedObjectDetection {
  id:string;
  label:string;
  position:SpatialPoint;
  frameId:string;
  confidence01:number;
  visible:boolean;
  observedAt:number;
  source:'camera';
  safeToTouch?:boolean;
  affordances?:InteractionTarget['affordances'];
  radiusM?:number;
}
export type GroundedTargetResult =
  | {accepted:true;target:InteractionTarget;entity:GroundedEntity}
  | {accepted:false;reason:string};

/**
 * Joins calibrated camera geometry to the canonical semantic world state.
 * GroundedWorldState intentionally has no metric coordinates: never fabricate them.
 */
export function groundInteractionTarget(input:{
  detection:CalibratedObjectDetection;
  world:GroundedWorldStateSnapshot;
  now:number;
  maxAgeMs?:number;
  minSemanticConfidence01?:number;
}):GroundedTargetResult {
  const {detection,world,now}=input;
  const maxAge=Math.max(0,Math.min(10_000,input.maxAgeMs??2_000));
  const minSemantic=clamp(input.minSemanticConfidence01??.55);
  if(!Number.isFinite(now)||!Number.isFinite(detection.observedAt))return {accepted:false,reason:'invalid-observation-time'};
  if(!detection.id||!detection.label||!detection.frameId)return {accepted:false,reason:'missing-detection-identity-or-frame'};
  if(!Number.isFinite(detection.position?.x)||!Number.isFinite(detection.position?.y)||!Number.isFinite(detection.position?.z))return {accepted:false,reason:'invalid-calibrated-position'};
  if(detection.observedAt>now+250||now-detection.observedAt>maxAge)return {accepted:false,reason:'stale-camera-detection'};
  if(!detection.visible||clamp(detection.confidence01)<.55)return {accepted:false,reason:'camera-detection-not-grounded'};
  if(!world||!Array.isArray(world.entities))return {accepted:false,reason:'grounded-world-unavailable'};
  const label=normalize(detection.label);
  const entity=world.entities.filter(row=>row.kind==='object'&&normalize(row.label)===label)
    .sort((a,b)=>b.lastSeenAt-a.lastSeenAt)[0];
  if(!entity)return {accepted:false,reason:'object-not-present-in-canonical-world'};
  if(entity.presenceStatus!=='visible'||entity.present01<.5)return {accepted:false,reason:'canonical-world-does-not-confirm-presence'};
  if(now-entity.lastSeenAt>maxAge)return {accepted:false,reason:'canonical-world-entity-stale'};
  if(clamp(entity.confidence01)<minSemantic)return {accepted:false,reason:'semantic-grounding-confidence-too-low'};
  const confidence=Math.min(clamp(detection.confidence01),clamp(entity.confidence01));
  return {accepted:true,entity,target:{
    id:detection.id,label:detection.label,position:{...detection.position},frameId:detection.frameId,
    confidence01:confidence,visible:true,observedAt:detection.observedAt,source:'camera',
    safeToTouch:detection.safeToTouch===true,affordances:detection.affordances?[...detection.affordances]:[],
    radiusM:detection.radiusM,
  }};
}
