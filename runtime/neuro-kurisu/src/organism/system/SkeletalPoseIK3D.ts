/**
 * Combined position + orientation inverse kinematics for wrist/ankle/end-effector poses.
 * Uses task-space damped least squares (6x6) and the canonical quaternion FK model.
 * This is a bounded kinematic solver, not a physics/contact or collision solver.
 */
import {
  forwardKinematics3D,
  validateSkeleton3D,
  type Quaternion,
  type SkeletalJoint3D,
  type Vec3,
  type JointPose3D,
} from "./SkeletalKinematics3D.ts";

export interface SkeletalPoseIK3DInput {
  joints: readonly SkeletalJoint3D[];
  pose: JointPose3D;
  chain: readonly string[];
  targetPosition: Vec3;
  targetRotation: Quaternion;
  endEffectorOffset?: Vec3;
  damping?: number;
  maxIterations?: number;
  positionTolerance?: number;
  orientationToleranceRad?: number;
  orientationWeight?: number;
  maxStepRad?: number;
}
export interface SkeletalPoseIK3DResult {
  pose: JointPose3D;
  position: Vec3;
  rotation: Quaternion;
  positionError: number;
  orientationErrorRad: number;
  iterations: number;
  converged: boolean;
  reason: "pose-reached" | "iteration-budget-exhausted" | "joint-limits-or-singularity";
}

type V6 = [number, number, number, number, number, number];
const EPS = 1e-10;
const finiteVec = (v: Vec3) => !!v && [v.x,v.y,v.z].every(Number.isFinite);
const norm3 = (v: Vec3) => Math.hypot(v.x,v.y,v.z);
const sub3 = (a: Vec3,b: Vec3): Vec3 => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross3 = (a: Vec3,b: Vec3): Vec3 => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const dot3 = (a: Vec3,b: Vec3) => a.x*b.x+a.y*b.y+a.z*b.z;
const scale3 = (a: Vec3,s: number): Vec3 => ({x:a.x*s,y:a.y*s,z:a.z*s});
const normalizeQ = (q: Quaternion): Quaternion => {
  const n=Math.hypot(q.x,q.y,q.z,q.w);
  if(!Number.isFinite(n)||n<EPS) throw new Error("invalid-target-quaternion");
  return {x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n};
};
const multiplyQ = (a: Quaternion,b: Quaternion): Quaternion => normalizeQ({
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,
});
const rotateQ = (q: Quaternion,v: Vec3): Vec3 => {
  const u={x:q.x,y:q.y,z:q.z}, uv=cross3(u,v), uuv=cross3(u,uv);
  return {x:v.x+2*q.w*uv.x+2*uuv.x,y:v.y+2*q.w*uv.y+2*uuv.y,z:v.z+2*q.w*uv.z+2*uuv.z};
};
function orientationError(targetRaw: Quaternion,current: Quaternion): { vector: Vec3; angle: number } {
  const target=normalizeQ(targetRaw), inverse={x:-current.x,y:-current.y,z:-current.z,w:current.w};
  const delta=multiplyQ(target,inverse);
  const q=delta.w<0?{x:-delta.x,y:-delta.y,z:-delta.z,w:-delta.w}:delta;
  const sinHalf=Math.hypot(q.x,q.y,q.z);
  if(sinHalf<EPS) return {vector:{x:0,y:0,z:0},angle:0};
  const angle=2*Math.atan2(sinHalf,Math.max(0,q.w));
  return {vector:{x:q.x/sinHalf*angle,y:q.y/sinHalf*angle,z:q.z/sinHalf*angle},angle};
}
function solve6(a:number[][],b:V6):V6|null {
  const m=a.map((row,i)=>[...row,b[i]]);
  for(let c=0;c<6;c++){
    let p=c;for(let r=c+1;r<6;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;
    if(Math.abs(m[p][c])<EPS)return null;
    [m[c],m[p]]=[m[p],m[c]];
    const d=m[c][c];for(let k=c;k<7;k++)m[c][k]/=d;
    for(let r=0;r<6;r++)if(r!==c){const f=m[r][c];for(let k=c;k<7;k++)m[r][k]-=f*m[c][k];}
  }
  return m.map(row=>row[6]) as V6;
}
const magnitude6=(v:V6)=>Math.hypot(...v);

/** Solve a bounded six-dimensional end-effector pose target. */
export function solveSkeletalPoseIK3D(input:SkeletalPoseIK3DInput):SkeletalPoseIK3DResult {
  const {joints,chain,targetPosition,targetRotation}=input;
  validateSkeleton3D(joints);
  if(!finiteVec(targetPosition)||!Array.isArray(chain)||chain.length===0||chain.length>64)throw new Error("invalid-pose-ik-input");
  const targetQ=normalizeQ(targetRotation);
  const damping=input.damping??0.09,iterationsMax=input.maxIterations??48;
  const posTol=input.positionTolerance??0.008,rotTol=input.orientationToleranceRad??0.035;
  const weight=input.orientationWeight??0.7,maxStep=input.maxStepRad??0.14;
  if(!Number.isFinite(damping)||damping<0.001||damping>2||!Number.isInteger(iterationsMax)||iterationsMax<1||iterationsMax>128||
    !Number.isFinite(posTol)||posTol<=0||posTol>1||!Number.isFinite(rotTol)||rotTol<=0||rotTol>Math.PI||
    !Number.isFinite(weight)||weight<0.05||weight>4||!Number.isFinite(maxStep)||maxStep<=0||maxStep>0.5)
    throw new Error("invalid-pose-ik-options");
  const map=new Map(joints.map(j=>[j.id,j]));
  for(let i=0;i<chain.length;i++){
    const joint=map.get(chain[i]);if(!joint)throw new Error("unknown-pose-ik-joint:"+chain[i]);
    if(i>0&&joint.parentId!==chain[i-1])throw new Error("pose-ik-chain-not-contiguous");
  }
  const endId=chain[chain.length-1],pose={...input.pose};
  for(const id of chain){const j=map.get(id)!,a=pose[id]??j.restAngleRad??0;if(!Number.isFinite(a))throw new Error("invalid-pose-ik-angle");pose[id]=Math.max(j.minAngleRad,Math.min(j.maxAngleRad,a));}
  let fk=forwardKinematics3D(joints,pose,endId,input.endEffectorOffset);
  let pe=norm3(sub3(targetPosition,fk.endEffector)),oe=orientationError(targetQ,fk.joints[endId].rotation).angle,iterations=0;
  for(;iterations<iterationsMax&&(pe>posTol||oe>rotTol);iterations++){
    const ep=sub3(targetPosition,fk.endEffector),eo=orientationError(targetQ,fk.joints[endId].rotation);
    const task:V6=[ep.x,ep.y,ep.z,eo.vector.x*weight,eo.vector.y*weight,eo.vector.z*weight];
    const columns:V6[]=[];
    for(const id of chain){
      const j=map.get(id)!,parent=j.parentId?fk.joints[j.parentId]:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1}};
      const localAxis=j.axis,axisRaw=rotateQ(parent.rotation,localAxis),axisNorm=norm3(axisRaw);
      if(axisNorm<EPS)throw new Error("invalid-pose-ik-axis");
      const axis=scale3(axisRaw,1/axisNorm),linear=cross3(axis,sub3(fk.endEffector,fk.joints[id].position));
      columns.push([linear.x,linear.y,linear.z,axis.x*weight,axis.y*weight,axis.z*weight]);
    }
    const normal=Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>{
      let sum=0;for(const col of columns)sum+=col[r]*col[c];
      return sum+(r===c?damping*damping:0);
    }));
    const y=solve6(normal,task);if(!y)break;
    let maxAppliedDelta=0;
    for(let i=0;i<chain.length;i++){
      const id=chain[i],j=map.get(id)!,delta=columns[i].reduce((sum,v,k)=>sum+v*y[k],0);
      const next=Math.max(j.minAngleRad,Math.min(j.maxAngleRad,pose[id]+Math.max(-maxStep,Math.min(maxStep,delta))));
      maxAppliedDelta=Math.max(maxAppliedDelta,Math.abs(next-pose[id]));
      pose[id]=next;
    }
    if(maxAppliedDelta<1e-9) break;
    fk=forwardKinematics3D(joints,pose,endId,input.endEffectorOffset);
    pe=norm3(sub3(targetPosition,fk.endEffector));oe=orientationError(targetQ,fk.joints[endId].rotation).angle;
  }
  const converged=pe<=posTol&&oe<=rotTol;
  return {pose,position:fk.endEffector,rotation:fk.joints[endId].rotation,positionError:pe,orientationErrorRad:oe,iterations,converged,
    reason:converged?"pose-reached":iterations>=iterationsMax?"iteration-budget-exhausted":"joint-limits-or-singularity"};
}
