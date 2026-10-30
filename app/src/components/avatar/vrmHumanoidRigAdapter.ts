import type { PlanarArmKinematicsResult } from "./planarArmIK";

export type RotationAxis = "x" | "y" | "z";
export interface MutableEulerLike { x:number; y:number; z:number; }
export interface HumanoidBoneLike { name?:string; rotation:MutableEulerLike; }
export interface VrmArmBoneMap { shoulder:HumanoidBoneLike; elbow:HumanoidBoneLike; }
export interface AxisCalibration {
  shoulderAxis:RotationAxis; elbowAxis:RotationAxis;
  shoulderSign:1|-1; elbowSign:1|-1;
  shoulderOffsetRad:number; elbowOffsetRad:number;
  shoulderMinRad:number; shoulderMaxRad:number;
  elbowMinRad:number; elbowMaxRad:number;
}
export interface VrmArmPose {
  shoulder:MutableEulerLike; elbow:MutableEulerLike;
  shoulderBoneName:string; elbowBoneName:string;
}
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
const aliases={
  shoulder:["leftupperarm","leftarm","upperarml","armleft","leftshoulder"],
  elbow:["leftlowerarm","leftforearm","forearml","lowerarml"],
} as const;
function matches(name:string, candidates:readonly string[]){return candidates.some((candidate)=>name===candidate||name.endsWith(candidate));}

/** Resolve a left arm conservatively; ambiguous/missing bones are never guessed. */
export function resolveLeftVrmArm(bones:readonly HumanoidBoneLike[]):VrmArmBoneMap|null {
  const candidates=bones.filter((bone)=>bone&&typeof bone.name==="string"&&bone.rotation&&[bone.rotation.x,bone.rotation.y,bone.rotation.z].every(Number.isFinite));
  const shoulders=candidates.filter((bone)=>matches(normalize(bone.name!),aliases.shoulder));
  const elbows=candidates.filter((bone)=>matches(normalize(bone.name!),aliases.elbow));
  if(shoulders.length!==1||elbows.length!==1||shoulders[0]===elbows[0])return null;
  return {shoulder:shoulders[0],elbow:elbows[0]};
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const validCalibration=(c:AxisCalibration)=>[c.shoulderOffsetRad,c.elbowOffsetRad,c.shoulderMinRad,c.shoulderMaxRad,c.elbowMinRad,c.elbowMaxRad].every(Number.isFinite)&&c.shoulderMinRad<=c.shoulderMaxRad&&c.elbowMinRad<=c.elbowMaxRad;
/**
 * Convert planar solver angles to bind-pose-relative Euler targets. Explicit per-rig
 * axis/sign/offset calibration is mandatory: generic VRM bone axes are not assumed.
 * This returns a pose only; the caller owns frame conversion, collision checks and execution.
 */
export function computeVrmArmPose(
  map:VrmArmBoneMap,
  solution:PlanarArmKinematicsResult,
  calibration:AxisCalibration,
):VrmArmPose|null {
  if(!map?.shoulder?.rotation||!map?.elbow?.rotation||!solution?.accepted||!validCalibration(calibration))return null;
  const shoulderBase=map.shoulder.rotation,elbowBase=map.elbow.rotation;
  if(![shoulderBase.x,shoulderBase.y,shoulderBase.z,elbowBase.x,elbowBase.y,elbowBase.z].every(Number.isFinite))return null;
  const shoulder={...shoulderBase},elbow={...elbowBase};
  shoulder[calibration.shoulderAxis]=clamp(shoulderBase[calibration.shoulderAxis]+solution.shoulderAngle*calibration.shoulderSign+calibration.shoulderOffsetRad,calibration.shoulderMinRad,calibration.shoulderMaxRad);
  elbow[calibration.elbowAxis]=clamp(elbowBase[calibration.elbowAxis]+solution.elbowFlexion*calibration.elbowSign+calibration.elbowOffsetRad,calibration.elbowMinRad,calibration.elbowMaxRad);
  return {shoulder,elbow,shoulderBoneName:map.shoulder.name??"unnamed-shoulder",elbowBoneName:map.elbow.name??"unnamed-elbow"};
}
