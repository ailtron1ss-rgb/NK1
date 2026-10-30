import type { GroundedWorldStateSnapshot, GroundedEntity } from '../world/GroundedWorldState.ts';
import type { InteractionSafetyAuthorization, InteractionTarget, SpatialPoint } from './EmbodiedInteractionController.ts';
const normalize=(value:string)=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ').slice(0,120);
const clamp=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export interface CalibratedObjectDetection {id:string;label:string;position:SpatialPoint;frameId:string;confidence01:number;visible:boolean;observedAt:number;source:'camera';safeToTouch?:boolean;safetyAuthorization?:InteractionSafetyAuthorization;affordances?:InteractionTarget['affordances'];radiusM?:number;}
export type GroundedTargetResult={accepted:true;target:InteractionTarget;entity:GroundedEntity}|{accepted:false;reason:string};
/** Joins calibrated camera geometry to canonical semantic world state; duplicate labels are rejected, never guessed. */
export function groundInteractionTarget(input:{detection:CalibratedObjectDetection;world:GroundedWorldStateSnapshot;now:number;maxAgeMs?:number;minSemanticConfidence01?:number}):GroundedTargetResult {
 const {detection,world,now}=input;
 const maxAge=Number.isFinite(input.maxAgeMs)?Math.max(0,Math.min(10_000,Number(input.maxAgeMs))):2_000;
 const minSemantic=Number.isFinite(input.minSemanticConfidence01)?clamp(Number(input.minSemanticConfidence01)):.55;
 if(!Number.isFinite(now)||!Number.isFinite(detection?.observedAt))return {accepted:false,reason:'invalid-observation-time'};
 if(!detection||typeof detection.id!=='string'||!detection.id.trim()||detection.id.length>96||typeof detection.label!=='string'||!detection.label.trim()||detection.label.length>160||typeof detection.frameId!=='string'||!detection.frameId.trim()||detection.frameId.length>120)return {accepted:false,reason:'missing-detection-identity-or-frame'};
 if(detection.source!=='camera')return {accepted:false,reason:'unsupported-detection-source'};
 if(!Number.isFinite(detection.position?.x)||!Number.isFinite(detection.position?.y)||!Number.isFinite(detection.position?.z))return {accepted:false,reason:'invalid-calibrated-position'};
 if(!Number.isFinite(detection.confidence01)||detection.observedAt>now+250||now-detection.observedAt>maxAge)return {accepted:false,reason:'stale-camera-detection'};
 if(!detection.visible||clamp(detection.confidence01)<.55)return {accepted:false,reason:'camera-detection-not-grounded'};
 if(!world||!Array.isArray(world.entities)||!Number.isSafeInteger(world.revision)||world.revision<0||world.entities.length>128)return {accepted:false,reason:'grounded-world-unavailable'};
 if(!Number.isFinite(world.lastAt)||world.lastAt>now+250||now-world.lastAt>maxAge)return {accepted:false,reason:'canonical-world-snapshot-stale-or-future'};
 if(!Number.isFinite(world.confidence01)||clamp(world.confidence01)<.35||!Number.isFinite(world.uncertainty01)||clamp(world.uncertainty01)>.8)return {accepted:false,reason:'canonical-world-confidence-insufficient'};
 const label=normalize(detection.label);
 const matches=world.entities.filter(row=>row&&typeof row==='object'&&row.kind==='object'&&typeof row.label==='string'&&normalize(row.label)===label);
 if(matches.length===0)return {accepted:false,reason:'object-not-present-in-canonical-world'};
 if(matches.length!==1)return {accepted:false,reason:'ambiguous-semantic-object-identity'};
 const entity=matches[0];
 if(typeof entity.id!=='string'||!entity.id.trim()||entity.id.length>96)return {accepted:false,reason:'canonical-world-entity-identity-invalid'};
 if(entity.presenceStatus!=='visible'||!Number.isFinite(entity.present01)||entity.present01<.5)return {accepted:false,reason:'canonical-world-does-not-confirm-presence'};
 if(!Number.isFinite(entity.lastSeenAt)||entity.lastSeenAt>now+250||now-entity.lastSeenAt>maxAge)return {accepted:false,reason:'canonical-world-entity-stale'};
 if(!Number.isFinite(entity.confidence01)||clamp(entity.confidence01)<minSemantic)return {accepted:false,reason:'semantic-grounding-confidence-too-low'};
 const confidence=Math.min(clamp(detection.confidence01),clamp(entity.confidence01),clamp(world.confidence01));
 const allowedAffordances=new Set(['look','inspect','reach','touch','grasp','release','press']);
 const affordances=Array.isArray(detection.affordances)?[...new Set(detection.affordances.filter(x=>allowedAffordances.has(x)))]:[];
 return {accepted:true,entity,target:{id:detection.id,label:detection.label,position:{...detection.position},frameId:detection.frameId,confidence01:confidence,visible:true,observedAt:detection.observedAt,source:'camera',worldEntityId:entity.id,groundedWorldRevision:world.revision,safeToTouch:detection.safeToTouch===true,...(detection.safetyAuthorization?{safetyAuthorization:structuredClone(detection.safetyAuthorization)}:{}),affordances,radiusM:Number.isFinite(detection.radiusM)?Math.max(.01,Math.min(.3,Number(detection.radiusM))):undefined}};
}
