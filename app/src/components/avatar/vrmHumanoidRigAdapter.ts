import type { PlanarArmKinematicsResult } from "./planarArmIK";
export type RotationAxis="x"|"y"|"z";
export interface MutableEulerLike{x:number;y:number;z:number}
export interface HumanoidBoneLike{name?:string;rotation:MutableEulerLike}
export interface VrmArmBoneMap{shoulder:HumanoidBoneLike;elbow:HumanoidBoneLike}
export interface AxisCalibration{shoulderAxis:RotationAxis;elbowAxis:RotationAxis;shoulderSign:1|-1;elbowSign:1|-1;shoulderOffsetRad:number;elbowOffsetRad:number;shoulderMinRad:number;shoulderMaxRad:number;elbowMinRad:number;elbowMaxRad:number}
export interface VrmArmPose{shoulder:MutableEulerLike;elbow:MutableEulerLike;shoulderBoneName:string;elbowBoneName:string}
export interface VrmArmBindPose{shoulder:MutableEulerLike;elbow:MutableEulerLike;shoulderBoneName:string;elbowBoneName:string}
export type ArmSide="left"|"right";
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases:Record<ArmSide,{shoulder:string[];elbow:string[]}>={
 left:{shoulder:["leftupperarm","leftarm","upperarml","armleft"],elbow:["leftlowerarm","leftforearm","forearml","lowerarml"]},
 right:{shoulder:["rightupperarm","rightarm","upperarmr","armright"],elbow:["rightlowerarm","rightforearm","forearmr","lowerarmr"]},
};
function matches(name:string,candidates:readonly string[]){return candidates.some(candidate=>name===candidate||name.endsWith(candidate));}
export function resolveVrmArm(bones:readonly HumanoidBoneLike[],side:ArmSide):VrmArmBoneMap|null{
 const names=aliases[side];if(!names)return null;
 const candidates=bones.filter(bone=>bone&&typeof bone.name==="string"&&bone.rotation&&[bone.rotation.x,bone.rotation.y,bone.rotation.z].every(Number.isFinite));
 const shoulders=candidates.filter(bone=>matches(normalize(bone.name!),names.shoulder));
 const elbows=candidates.filter(bone=>matches(normalize(bone.name!),names.elbow));
 if(shoulders.length!==1||elbows.length!==1||shoulders[0]===elbows[0])return null;
 return{shoulder:shoulders[0],elbow:elbows[0]};
}
export const resolveLeftVrmArm=(bones:readonly HumanoidBoneLike[])=>resolveVrmArm(bones,"left");
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const finiteRotation=(rotation:MutableEulerLike)=>[rotation?.x,rotation?.y,rotation?.z].every(Number.isFinite);
const cloneRotation=(rotation:MutableEulerLike):MutableEulerLike=>({x:rotation.x,y:rotation.y,z:rotation.z});
const validCalibration=(c:AxisCalibration)=>[c.shoulderOffsetRad,c.elbowOffsetRad,c.shoulderMinRad,c.shoulderMaxRad,c.elbowMinRad,c.elbowMaxRad].every(Number.isFinite)&&c.shoulderMinRad<=c.shoulderMaxRad&&c.elbowMinRad<=c.elbowMaxRad;
/** Capture this once after the model is loaded and before any animation/IK writes. */
export function captureVrmArmBindPose(map:VrmArmBoneMap):VrmArmBindPose|null{
 if(!map?.shoulder?.rotation||!map?.elbow?.rotation||!finiteRotation(map.shoulder.rotation)||!finiteRotation(map.elbow.rotation))return null;
 return{shoulder:cloneRotation(map.shoulder.rotation),elbow:cloneRotation(map.elbow.rotation),shoulderBoneName:map.shoulder.name??"unnamed-shoulder",elbowBoneName:map.elbow.name??"unnamed-elbow"};
}
/** Compute an absolute target from the captured bind pose, never from a moving frame's current Euler values. */
export function computeVrmArmPose(map:VrmArmBoneMap,solution:PlanarArmKinematicsResult,calibration:AxisCalibration,bindPose:VrmArmBindPose):VrmArmPose|null{
 if(!map?.shoulder?.rotation||!map?.elbow?.rotation||!solution?.accepted||!validCalibration(calibration)||!bindPose)return null;
 if(map.shoulder.name!==bindPose.shoulderBoneName||map.elbow.name!==bindPose.elbowBoneName||!finiteRotation(bindPose.shoulder)||!finiteRotation(bindPose.elbow))return null;
 const shoulder=cloneRotation(bindPose.shoulder),elbow=cloneRotation(bindPose.elbow);
 shoulder[calibration.shoulderAxis]=clamp(bindPose.shoulder[calibration.shoulderAxis]+solution.shoulderAngle*calibration.shoulderSign+calibration.shoulderOffsetRad,calibration.shoulderMinRad,calibration.shoulderMaxRad);
 elbow[calibration.elbowAxis]=clamp(bindPose.elbow[calibration.elbowAxis]+solution.elbowFlexion*calibration.elbowSign+calibration.elbowOffsetRad,calibration.elbowMinRad,calibration.elbowMaxRad);
 return{shoulder,elbow,shoulderBoneName:bindPose.shoulderBoneName,elbowBoneName:bindPose.elbowBoneName};
}
/** Blend a validated target into live bones; weight 0 restores no motion, weight 1 applies the full target. */
export function applyVrmArmPose(map:VrmArmBoneMap,pose:VrmArmPose,weight=1):boolean{
 if(!map?.shoulder?.rotation||!map?.elbow?.rotation||!pose||map.shoulder.name!==pose.shoulderBoneName||map.elbow.name!==pose.elbowBoneName||!finiteRotation(pose.shoulder)||!finiteRotation(pose.elbow)||!finiteRotation(map.shoulder.rotation)||!finiteRotation(map.elbow.rotation)||!Number.isFinite(weight))return false;
 const alpha=clamp(weight,0,1);
 if(alpha===0)return true;
 for(const axis of ["x","y","z"] as const){
  map.shoulder.rotation[axis]=alpha===1?pose.shoulder[axis]:map.shoulder.rotation[axis]+(pose.shoulder[axis]-map.shoulder.rotation[axis])*alpha;
  map.elbow.rotation[axis]=alpha===1?pose.elbow[axis]:map.elbow.rotation[axis]+(pose.elbow[axis]-map.elbow.rotation[axis])*alpha;
 }
 return true;
}
/** Restore the captured bind pose, optionally blended for a graceful IK disable. */
export function restoreVrmArmBindPose(map:VrmArmBoneMap,bindPose:VrmArmBindPose,weight=1):boolean{
 return applyVrmArmPose(map,{shoulder:bindPose.shoulder,elbow:bindPose.elbow,shoulderBoneName:bindPose.shoulderBoneName,elbowBoneName:bindPose.elbowBoneName},weight);
}
