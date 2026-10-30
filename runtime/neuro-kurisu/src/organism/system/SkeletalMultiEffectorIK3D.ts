/**
 * Bounded multi-effector position IK for coordinated limbs.
 *
 * Solves up to six end-effector targets together in one task-space DLS step.
 * Shared ancestor joints are updated once from the combined Jacobian, avoiding
 * the order-dependent "solve left arm, then overwrite torso for right arm"
 * behavior of sequential single-effector IK.
 *
 * Position units must be consistent with the skeleton. This is kinematics,
 * not contact dynamics, balance, collision avoidance, or force control.
 */
import {
  forwardKinematics3D,
  validateSkeleton3D,
  type SkeletalJoint3D,
  type JointPose3D,
  type Vec3,
} from "./SkeletalKinematics3D.ts";

export interface MultiEffectorTarget3D {
  id: string;
  chain: readonly string[];
  target: Vec3;
  endEffectorOffset?: Vec3;
  weight?: number;
}
export interface MultiEffectorIK3DInput {
  joints: readonly SkeletalJoint3D[];
  pose: JointPose3D;
  effectors: readonly MultiEffectorTarget3D[];
  damping?: number;
  maxIterations?: number;
  tolerance?: number;
  maxStepRad?: number;
}
export interface MultiEffectorResidual3D {
  id: string;
  position: Vec3;
  error: number;
  weight: number;
}
export interface MultiEffectorIK3DResult {
  pose: JointPose3D;
  residuals: MultiEffectorResidual3D[];
  maxError: number;
  iterations: number;
  converged: boolean;
  reason: "targets-reached" | "iteration-budget-exhausted" | "joint-limits-or-singularity";
}

const EPS=1e-10;
const finiteVec=(v:Vec3)=>!!v&&[v.x,v.y,v.z].every(Number.isFinite);
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a:Vec3,s:number):Vec3=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=(a:Vec3)=>Math.hypot(a.x,a.y,a.z);
const normalize=(a:Vec3):Vec3=>{const n=norm(a);if(n<EPS)throw new Error("zero-length-multi-ik-axis");return scale(a,1/n);};
const identity={x:0,y:0,z:0,w:1};
const rotate=(q:{x:number;y:number;z:number;w:number},v:Vec3):Vec3=>{
  const u={x:q.x,y:q.y,z:q.z},uv=cross(u,v),uuv=cross(u,uv);
  return add(v,add(scale(uv,2*q.w),scale(uuv,2)));
};
function solveLinear(matrix:number[][],rhs:number[]):number[]|null {
  const n=rhs.length,m=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let c=0;c<n;c++){
    let pivot=c;for(let r=c+1;r<n;r++)if(Math.abs(m[r][c])>Math.abs(m[pivot][c]))pivot=r;
    if(Math.abs(m[pivot][c])<EPS)return null;
    [m[c],m[pivot]]=[m[pivot],m[c]];
    const d=m[c][c];for(let k=c;k<=n;k++)m[c][k]/=d;
    for(let r=0;r<n;r++)if(r!==c){const f=m[r][c];for(let k=c;k<=n;k++)m[r][k]-=f*m[c][k];}
  }
  return m.map(row=>row[n]);
}

/** Coordinate up to six effectors while respecting shared joints and limits. */
export function solveMultiEffectorIK3D(input:MultiEffectorIK3DInput):MultiEffectorIK3DResult {
  const {joints,effectors}=input;
  validateSkeleton3D(joints);
  if(!Array.isArray(effectors)||effectors.length===0||effectors.length>6)throw new Error("multi-ik-effector-count-out-of-range");
  const damping=input.damping??0.1,maxIterations=input.maxIterations??48,tolerance=input.tolerance??0.01,maxStep=input.maxStepRad??0.12;
  if(!Number.isFinite(damping)||damping<0.001||damping>2||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>128||
    !Number.isFinite(tolerance)||tolerance<=0||tolerance>1||!Number.isFinite(maxStep)||maxStep<=0||maxStep>0.5)
    throw new Error("invalid-multi-ik-options");
  const map=new Map(joints.map(j=>[j.id,j]));
  const ids=new Set<string>(),union:string[]=[];
  for(const e of effectors){
    if(!e||typeof e.id!=="string"||! /^[a-z][a-z0-9._-]{0,63}$/i.test(e.id)||ids.has(e.id))throw new Error("invalid-or-duplicate-multi-ik-effector-id");
    ids.add(e.id);
    if(!finiteVec(e.target)||(e.endEffectorOffset&&!finiteVec(e.endEffectorOffset))||!Array.isArray(e.chain)||e.chain.length===0||e.chain.length>64)
      throw new Error("invalid-multi-ik-effector:"+e.id);
    const weight=e.weight??1;if(!Number.isFinite(weight)||weight<0.05||weight>20)throw new Error("invalid-multi-ik-weight:"+e.id);
    for(let i=0;i<e.chain.length;i++){
      const j=map.get(e.chain[i]);if(!j)throw new Error("unknown-multi-ik-joint:"+e.chain[i]);
      if(i>0&&j.parentId!==e.chain[i-1])throw new Error("multi-ik-chain-not-contiguous:"+e.id);
      if(!union.includes(j.id))union.push(j.id);
    }
  }
  if(union.length===0||union.length>64)throw new Error("multi-ik-joint-count-out-of-range");
  const pose={...input.pose};
  for(const id of union){const j=map.get(id)!,angle=pose[id]??j.restAngleRad??0;if(!Number.isFinite(angle))throw new Error("invalid-multi-ik-pose:"+id);pose[id]=Math.max(j.minAngleRad,Math.min(j.maxAngleRad,angle));}
  const evaluate=()=>{
    const frames=effectors.map(e=>forwardKinematics3D(joints,pose,e.chain[e.chain.length-1],e.endEffectorOffset));
    const residuals=effectors.map((e,i)=>({id:e.id,position:frames[i].endEffector,error:norm(sub(e.target,frames[i].endEffector)),weight:e.weight??1}));
    return {frames,residuals,maxError:Math.max(...residuals.map(r=>r.error))};
  };
  let state=evaluate(),iterations=0,stalled=false;
  for(;iterations<maxIterations&&state.residuals.some(r=>r.error>tolerance);iterations++){
    const rows:number[][]=[],errors:number[]=[];
    for(let eIndex=0;eIndex<effectors.length;eIndex++){
      const e=effectors[eIndex],frame=state.frames[eIndex],weight=Math.sqrt(e.weight??1);
      const error=scale(sub(e.target,frame.endEffector),weight);
      errors.push(error.x,error.y,error.z);
      const columns=new Map<string,Vec3>();
      for(const id of e.chain){
        const joint=map.get(id)!,parent=joint.parentId?frame.joints[joint.parentId]:{position:{x:0,y:0,z:0},rotation:identity};
        const axis=normalize(rotate(parent.rotation,joint.axis));
        columns.set(id,cross(axis,sub(frame.endEffector,frame.joints[id].position)));
      }
      for(const component of ["x","y","z"] as const){
        rows.push(union.map(id=>(columns.get(id)?.[component]??0)*weight));
      }
    }
    const taskSize=rows.length,normal=Array.from({length:taskSize},(_,r)=>Array.from({length:taskSize},(_,c)=>{
      let sum=0;for(let j=0;j<union.length;j++)sum+=rows[r][j]*rows[c][j];
      return sum+(r===c?damping*damping:0);
    }));
    const dual=solveLinear(normal,errors);if(!dual){stalled=true;break;}
    let applied=0;
    for(let j=0;j<union.length;j++){
      let delta=0;for(let r=0;r<taskSize;r++)delta+=rows[r][j]*dual[r];
      const id=union[j],joint=map.get(id)!;
      const next=Math.max(joint.minAngleRad,Math.min(joint.maxAngleRad,pose[id]+Math.max(-maxStep,Math.min(maxStep,delta))));
      applied=Math.max(applied,Math.abs(next-pose[id]));pose[id]=next;
    }
    if(applied<1e-9){stalled=true;break;}
    state=evaluate();
  }
  const converged=state.residuals.every(r=>r.error<=tolerance);
  return {pose,residuals:state.residuals,maxError:state.maxError,iterations,converged,
    reason:converged?"targets-reached":iterations>=maxIterations?"iteration-budget-exhausted":"joint-limits-or-singularity"};
}
