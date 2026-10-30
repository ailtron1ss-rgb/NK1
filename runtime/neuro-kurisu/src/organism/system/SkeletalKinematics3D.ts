/**
 * NK1 renderer-neutral 3D skeletal kinematics.
 *
 * Uses unit quaternions for hierarchical forward kinematics and a damped
 * least-squares position solver for arbitrary 3D ancestor chains. Angles are
 * radians; positions are metres (or one consistent application unit).
 * No renderer, browser, physics engine, or wall-clock dependency.
 */
export interface Vec3 { x: number; y: number; z: number }
export interface Quaternion { x: number; y: number; z: number; w: number }
export interface Transform3 { position: Vec3; rotation: Quaternion }
export interface SkeletalJoint3D {
  id: string;
  parentId?: string | null;
  offset: Vec3;
  axis: Vec3;
  minAngleRad: number;
  maxAngleRad: number;
  restAngleRad?: number;
}
export type JointPose3D = Record<string, number>;
export interface ForwardKinematics3D {
  joints: Record<string, Transform3>;
  endEffector: Vec3;
}
export interface DampedLeastSquaresIKInput {
  joints: readonly SkeletalJoint3D[];
  pose: JointPose3D;
  chain: readonly string[];
  target: Vec3;
  endEffectorOffset?: Vec3;
  damping?: number;
  maxIterations?: number;
  tolerance?: number;
  maxStepRad?: number;
}
export interface DampedLeastSquaresIKResult {
  pose: JointPose3D;
  position: Vec3;
  error: number;
  iterations: number;
  converged: boolean;
  reason: string;
}

const EPS = 1e-10;
const finiteVec = (v: Vec3): boolean => !!v && [v.x, v.y, v.z].every(Number.isFinite);
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x:a.x*s, y:a.y*s, z:a.z*s });
const dot = (a: Vec3,b: Vec3): number => a.x*b.x+a.y*b.y+a.z*b.z;
const cross = (a: Vec3,b: Vec3): Vec3 => ({ x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x });
const norm = (a: Vec3): number => Math.hypot(a.x,a.y,a.z);
const normalizeVec = (a: Vec3): Vec3 => { const n=norm(a); if(n<EPS) throw new Error("zero-length-vector"); return scale(a,1/n); };
const identity = (): Quaternion => ({x:0,y:0,z:0,w:1});
const normalizeQ = (q: Quaternion): Quaternion => { const n=Math.hypot(q.x,q.y,q.z,q.w); if(!Number.isFinite(n)||n<EPS) throw new Error("invalid-quaternion"); return {x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n}; };
const multiplyQ = (a: Quaternion,b: Quaternion): Quaternion => normalizeQ({
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,
});
const axisAngle = (axis: Vec3, angle: number): Quaternion => {
  const a=normalizeVec(axis), s=Math.sin(angle/2);
  return normalizeQ({x:a.x*s,y:a.y*s,z:a.z*s,w:Math.cos(angle/2)});
};
const rotate = (q: Quaternion,v: Vec3): Vec3 => {
  const u={x:q.x,y:q.y,z:q.z}, uv=cross(u,v), uuv=cross(u,uv);
  return add(v,add(scale(uv,2*q.w),scale(uuv,2)));
};
const distance = (a: Vec3,b: Vec3): number => norm(sub(a,b));

export function validateSkeleton3D(joints: readonly SkeletalJoint3D[]): void {
  if (!Array.isArray(joints)||joints.length===0||joints.length>256) throw new Error("skeleton3d-joint-count-out-of-range");
  const map=new Map<string,SkeletalJoint3D>();
  for(const j of joints) {
    if(!j||typeof j.id!=="string"||! /^[a-z][a-z0-9._-]{0,63}$/i.test(j.id)||map.has(j.id)) throw new Error("invalid-or-duplicate-3d-joint-id");
    if(!finiteVec(j.offset)||!finiteVec(j.axis)||norm(j.axis)<EPS) throw new Error("invalid-3d-joint-transform:"+j.id);
    if(!Number.isFinite(j.minAngleRad)||!Number.isFinite(j.maxAngleRad)||j.minAngleRad>j.maxAngleRad||
      (j.restAngleRad!==undefined&&!Number.isFinite(j.restAngleRad))) throw new Error("invalid-3d-joint-limits:"+j.id);
    map.set(j.id,j);
  }
  for(const j of joints) if(j.parentId&&!map.has(j.parentId)) throw new Error("missing-3d-joint-parent:"+j.id);
  for(const j of joints) {
    const seen=new Set([j.id]); let parent=j.parentId??null;
    while(parent) { if(seen.has(parent)) throw new Error("3d-joint-parent-cycle:"+j.id); seen.add(parent); parent=map.get(parent)?.parentId??null; }
  }
}

export function forwardKinematics3D(
  joints: readonly SkeletalJoint3D[],
  pose: JointPose3D,
  endEffectorJointId: string,
  endEffectorOffset: Vec3 = {x:0,y:0,z:0},
): ForwardKinematics3D {
  validateSkeleton3D(joints);
  if(!finiteVec(endEffectorOffset)) throw new Error("invalid-end-effector-offset");
  const map=new Map(joints.map(j=>[j.id,j]));
  if(!map.has(endEffectorJointId)) throw new Error("unknown-end-effector-joint");
  const world: Record<string,Transform3>={};
  const visiting=new Set<string>();
  const resolve=(id:string):Transform3=>{
    if(world[id]) return world[id];
    if(visiting.has(id)) throw new Error("3d-joint-parent-cycle:"+id);
    const j=map.get(id); if(!j) throw new Error("unknown-3d-joint:"+id);
    visiting.add(id);
    const parent=j.parentId?resolve(j.parentId):{position:{x:0,y:0,z:0},rotation:identity()};
    const angle=pose[id]??j.restAngleRad??0;
    if(!Number.isFinite(angle)) throw new Error("non-finite-3d-joint-angle:"+id);
    const localQ=axisAngle(j.axis,Math.max(j.minAngleRad,Math.min(j.maxAngleRad,angle)));
    const rotation=multiplyQ(parent.rotation,localQ);
    const position=add(parent.position,rotate(parent.rotation,j.offset));
    const result={position,rotation}; world[id]=result; visiting.delete(id); return result;
  };
  for(const id of map.keys()) resolve(id);
  const end=world[endEffectorJointId];
  return {joints:world,endEffector:add(end.position,rotate(end.rotation,endEffectorOffset))};
}

function solve3x3(a:number[][],b:Vec3):Vec3|null {
  const m=[ [a[0][0],a[0][1],a[0][2],b.x], [a[1][0],a[1][1],a[1][2],b.y], [a[2][0],a[2][1],a[2][2],b.z] ];
  for(let c=0;c<3;c++) {
    let pivot=c; for(let r=c+1;r<3;r++) if(Math.abs(m[r][c])>Math.abs(m[pivot][c])) pivot=r;
    if(Math.abs(m[pivot][c])<EPS) return null;
    [m[c],m[pivot]]=[m[pivot],m[c]];
    const d=m[c][c]; for(let k=c;k<4;k++) m[c][k]/=d;
    for(let r=0;r<3;r++) if(r!==c) { const f=m[r][c]; for(let k=c;k<4;k++) m[r][k]-=f*m[c][k]; }
  }
  return {x:m[0][3],y:m[1][3],z:m[2][3]};
}

/** Position-only DLS IK. Chain must be ordered root-to-effector and contiguous. */
export function solveDampedLeastSquaresIK3D(input:DampedLeastSquaresIKInput):DampedLeastSquaresIKResult {
  const {joints,chain,target}=input;
  validateSkeleton3D(joints);
  if(!finiteVec(target)||!Array.isArray(chain)||chain.length===0||chain.length>64) throw new Error("invalid-3d-ik-input");
  const damping=input.damping??0.08, maxIterations=input.maxIterations??32, tolerance=input.tolerance??0.005, maxStep=input.maxStepRad??0.18;
  if(!Number.isFinite(damping)||damping<0.001||damping>2||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>128||
    !Number.isFinite(tolerance)||tolerance<=0||tolerance>1||!Number.isFinite(maxStep)||maxStep<=0||maxStep>0.5) throw new Error("invalid-3d-ik-options");
  const map=new Map(joints.map(j=>[j.id,j]));
  for(let i=0;i<chain.length;i++) {
    const j=map.get(chain[i]); if(!j) throw new Error("unknown-3d-ik-chain-joint:"+chain[i]);
    if(i>0&&j.parentId!==chain[i-1]) throw new Error("3d-ik-chain-not-contiguous");
  }
  const endId=chain[chain.length-1], pose={...input.pose};
  for(const id of chain) { const j=map.get(id)!; const value=pose[id]??j.restAngleRad??0; if(!Number.isFinite(value)) throw new Error("invalid-3d-ik-pose"); pose[id]=Math.max(j.minAngleRad,Math.min(j.maxAngleRad,value)); }
  let fk=forwardKinematics3D(joints,pose,endId,input.endEffectorOffset);
  let error=distance(fk.endEffector,target), iterations=0;
  for(;iterations<maxIterations&&error>tolerance;iterations++) {
    const e=sub(target,fk.endEffector), axes:Vec3[]=[], pivots:Vec3[]=[];
    for(const id of chain) {
      const j=map.get(id)!, parent=j.parentId?fk.joints[j.parentId]:{position:{x:0,y:0,z:0},rotation:identity()};
      axes.push(rotate(parent.rotation,normalizeVec(j.axis)));
      pivots.push(fk.joints[id].position);
    }
    const columns=axes.map((axis,i)=>cross(axis,sub(fk.endEffector,pivots[i])));
    const a=[[0,0,0],[0,0,0],[0,0,0]];
    for(const c of columns) { const v=[c.x,c.y,c.z]; for(let r=0;r<3;r++) for(let k=0;k<3;k++) a[r][k]+=v[r]*v[k]; }
    for(let d=0;d<3;d++) a[d][d]+=damping*damping;
    const y=solve3x3(a,e); if(!y) break;
    for(let i=0;i<chain.length;i++) {
      const j=map.get(chain[i])!, delta=dot(columns[i],y);
      pose[j.id]=Math.max(j.minAngleRad,Math.min(j.maxAngleRad,pose[j.id]+Math.max(-maxStep,Math.min(maxStep,delta))));
    }
    fk=forwardKinematics3D(joints,pose,endId,input.endEffectorOffset);
    error=distance(fk.endEffector,target);
  }
  return {pose,position:fk.endEffector,error,iterations,converged:error<=tolerance,reason:error<=tolerance?"target-reached":iterations>=maxIterations?"iteration-budget-exhausted":"joint-limits-or-singularity"};
}
