export interface Vec2 { x:number; y:number; }
export interface JointLimit { min:number; max:number; }
export interface PlanarArmKinematicsInput {
  shoulder:Vec2; target:Vec2; upperArmLength:number; forearmLength:number;
  frameId:string; targetFrameId:string; confidence01:number;
  shoulderLimit?:JointLimit; elbowLimit?:JointLimit;
  minConfidence01?:number; reachMarginM?:number;
}
export type PlanarArmKinematicsResult =
 | {accepted:true; shoulderAngle:number; elbowFlexion:number; target:Vec2; clampedDistance:number; reachRatio:number; frameId:string}
 | {accepted:false; reason:string};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const finite=(n:unknown):n is number=>typeof n==="number"&&Number.isFinite(n);
const limit=(value:number,bounds:JointLimit)=>clamp(value,bounds.min,bounds.max);
/**
 * Renderer-independent 2-link planar IK. Coordinates are metres in one calibrated
 * avatar-root plane; it produces joint angles only and never executes motion.
 */
export function solvePlanarArmIK(input:PlanarArmKinematicsInput):PlanarArmKinematicsResult {
 const {shoulder,target}=input;
 if(!input.frameId||input.frameId!==input.targetFrameId)return {accepted:false,reason:"coordinate-frame-mismatch"};
 if(![shoulder?.x,shoulder?.y,target?.x,target?.y,input.upperArmLength,input.forearmLength,input.confidence01].every(finite))return {accepted:false,reason:"non-finite-kinematics-input"};
 if(input.upperArmLength<=0||input.forearmLength<=0)return {accepted:false,reason:"invalid-segment-length"};
 const minConfidence=clamp(input.minConfidence01??.65,0,1);
 if(clamp(input.confidence01,0,1)<minConfidence)return {accepted:false,reason:"target-confidence-too-low"};
 const dx=target.x-shoulder.x,dy=target.y-shoulder.y;
 const rawDistance=Math.hypot(dx,dy);
 if(rawDistance<1e-6)return {accepted:false,reason:"target-at-shoulder-origin"};
 const l1=input.upperArmLength,l2=input.forearmLength;
 const margin=clamp(input.reachMarginM??.015,0,.15);
 const minReach=Math.abs(l1-l2)+.005;
 const maxReach=Math.max(minReach,l1+l2-margin);
 const distance=clamp(rawDistance,minReach,maxReach);
 const cosShoulder=clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);
 const cosElbow=clamp((l1*l1+l2*l2-distance*distance)/(2*l1*l2),-1,1);
 const direction=Math.atan2(dy,dx);
 const shoulderAngle=limit(direction-Math.acos(cosShoulder),input.shoulderLimit??{min:-2.2,max:2.2});
 const elbowFlexion=limit(Math.PI-Math.acos(cosElbow),input.elbowLimit??{min:0,max:2.65});
 if(!finite(shoulderAngle)||!finite(elbowFlexion))return {accepted:false,reason:"ik-solution-non-finite"};
 return {accepted:true,shoulderAngle,elbowFlexion,target:{...target},clampedDistance:distance,reachRatio:clamp(rawDistance/(l1+l2),0,1),frameId:input.frameId};
}
