import type { BodyChannel } from "./embodimentSwitch.ts";

export interface BodyVector3 { x: number; y: number; z: number; }
export type ArticulatedBodyParticleId =
  | "pelvis" | "chest" | "neck" | "head"
  | "leftShoulderPoint" | "leftElbowPoint" | "leftWristPoint" | "leftHandPoint"
  | "rightShoulderPoint" | "rightElbowPoint" | "rightWristPoint" | "rightHandPoint"
  | "leftHipPoint" | "leftKneePoint" | "leftAnklePoint" | "leftHeelPoint" | "leftToePoint"
  | "rightHipPoint" | "rightKneePoint" | "rightAnklePoint" | "rightHeelPoint" | "rightToePoint";
export interface ArticulatedBodyParticle {
  id: ArticulatedBodyParticleId; position: BodyVector3; velocity: BodyVector3;
  target: BodyVector3; mass: number; pinned: boolean;
}
export interface ArticulatedBodyJoint { value: number; velocity: number; }
export interface ArticulatedBodySegment {
  from: ArticulatedBodyParticleId; to: ArticulatedBodyParticleId; restLength: number;
}
export interface ArticulatedBodyParticleState {
  schemaVersion: 1; tick: number; elapsedMs: number;
  joints: Record<BodyChannel, ArticulatedBodyJoint>;
  particles: Record<ArticulatedBodyParticleId, ArticulatedBodyParticle>;
  segments: readonly ArticulatedBodySegment[];
  maxConstraintError: number; particleCount: number;
}
export interface ArticulatedBodyStepOptions {
  awake: boolean;
  energy01: number;
  reducedMotion?: boolean;
  groundEnabled?: boolean;
  /** Local body-space height of the support plane. */
  groundY?: number;
  /** Radius from the foot support point to the sole. */
  footRadius?: number;
  /** Tangential velocity removed on contact, from 0 (none) to 1 (full). */
  footFriction?: number;
  /** Extra target-height band that identifies a planted foot. */
  groundContactMargin?: number;
}
export interface ArticulatedBodyContacts {
  leftFoot: boolean;
  rightFoot: boolean;
  maxCorrection: number;
  maxSlipSpeed: number;
  /** Number of capsule-contact projections applied to distal body particles. */
  bodyCollisionCount: number;
  /** Largest single body-collision positional correction, in body-space units. */
  maxBodyCollisionCorrection: number;
}
export interface ArticulatedBodyJointLimitDiagnostics {
  maxFlexionDeg: number;
  flexionDegrees: {
    leftElbow: number; rightElbow: number; leftKnee: number; rightKnee: number;
  };
  correctionDegrees: {
    leftElbow: number; rightElbow: number; leftKnee: number; rightKnee: number;
  };
  maxCorrectionDeg: number;
}
export interface ArticulatedBodyStepResult {
  state: ArticulatedBodyParticleState; channels: Partial<Record<BodyChannel, number>>;
  substeps: number; simulatedMs: number; maxConstraintError: number;
  contacts: ArticulatedBodyContacts;
  jointLimits: ArticulatedBodyJointLimitDiagnostics;
}

const CHANNELS: readonly BodyChannel[] = [
  "headYaw","headPitch","headRoll","torsoYaw","torsoPitch",
  "leftShoulder","leftElbow","leftWrist","rightShoulder","rightElbow","rightWrist",
  "leftHip","leftKnee","leftAnkle","rightHip","rightKnee","rightAnkle",
  "leftHand","rightHand","leftFingers","rightFingers",
  "leftThumbCurl","leftIndexCurl","leftMiddleCurl","leftRingCurl","leftLittleCurl",
  "rightThumbCurl","rightIndexCurl","rightMiddleCurl","rightRingCurl","rightLittleCurl",
  "gazeX","gazeY","breath","rootYaw",
];
const IDS: readonly ArticulatedBodyParticleId[] = [
  "pelvis","chest","neck","head",
  "leftShoulderPoint","leftElbowPoint","leftWristPoint","leftHandPoint",
  "rightShoulderPoint","rightElbowPoint","rightWristPoint","rightHandPoint",
  "leftHipPoint","leftKneePoint","leftAnklePoint","leftHeelPoint","leftToePoint",
  "rightHipPoint","rightKneePoint","rightAnklePoint","rightHeelPoint","rightToePoint",
];
const PAIRS: readonly (readonly [ArticulatedBodyParticleId,ArticulatedBodyParticleId])[] = [
  ["pelvis","chest"],["chest","neck"],["neck","head"],
  ["chest","leftShoulderPoint"],["leftShoulderPoint","leftElbowPoint"],["leftElbowPoint","leftWristPoint"],["leftWristPoint","leftHandPoint"],
  ["chest","rightShoulderPoint"],["rightShoulderPoint","rightElbowPoint"],["rightElbowPoint","rightWristPoint"],["rightWristPoint","rightHandPoint"],
  ["pelvis","leftHipPoint"],["leftHipPoint","leftKneePoint"],["leftKneePoint","leftAnklePoint"],
  ["leftAnklePoint","leftHeelPoint"],["leftHeelPoint","leftToePoint"],
  ["pelvis","rightHipPoint"],["rightHipPoint","rightKneePoint"],["rightKneePoint","rightAnklePoint"],
  ["rightAnklePoint","rightHeelPoint"],["rightHeelPoint","rightToePoint"],
];
const REST: Readonly<Record<ArticulatedBodyParticleId,BodyVector3>> = {
  pelvis:{x:0,y:0,z:0}, chest:{x:0,y:.5,z:0}, neck:{x:0,y:.8,z:0}, head:{x:0,y:1.04,z:0},
  leftShoulderPoint:{x:-.22,y:.73,z:0}, leftElbowPoint:{x:-.49,y:.51,z:0}, leftWristPoint:{x:-.57,y:.28,z:0}, leftHandPoint:{x:-.59,y:.17,z:0},
  rightShoulderPoint:{x:.22,y:.73,z:0}, rightElbowPoint:{x:.49,y:.51,z:0}, rightWristPoint:{x:.57,y:.28,z:0}, rightHandPoint:{x:.59,y:.17,z:0},
  leftHipPoint:{x:-.12,y:-.04,z:0}, leftKneePoint:{x:-.14,y:-.46,z:0}, leftAnklePoint:{x:-.14,y:-.86,z:0},
  leftHeelPoint:{x:-.14,y:-.885,z:-.04}, leftToePoint:{x:-.14,y:-.885,z:.18},
  rightHipPoint:{x:.12,y:-.04,z:0}, rightKneePoint:{x:.14,y:-.46,z:0}, rightAnklePoint:{x:.14,y:-.86,z:0},
  rightHeelPoint:{x:.14,y:-.885,z:-.04}, rightToePoint:{x:.14,y:-.885,z:.18},
};
const MASS: Readonly<Record<ArticulatedBodyParticleId,number>> = {
  pelvis:2.8,chest:2.1,neck:.55,head:.9,
  leftShoulderPoint:.55,leftElbowPoint:.42,leftWristPoint:.22,leftHandPoint:.18,
  rightShoulderPoint:.55,rightElbowPoint:.42,rightWristPoint:.22,rightHandPoint:.18,
  leftHipPoint:.8,leftKneePoint:.58,leftAnklePoint:.3,leftHeelPoint:.16,leftToePoint:.11,
  rightHipPoint:.8,rightKneePoint:.58,rightAnklePoint:.3,rightHeelPoint:.16,rightToePoint:.11,
};
const clamp=(v:number,min:number,max:number,fallback=0)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const vec=(x=0,y=0,z=0):BodyVector3=>({x,y,z});
const add=(a:BodyVector3,b:BodyVector3)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a:BodyVector3,b:BodyVector3)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a:BodyVector3,k:number)=>vec(a.x*k,a.y*k,a.z*k);
const len=(a:BodyVector3)=>Math.hypot(a.x,a.y,a.z);
const dist=(a:BodyVector3,b:BodyVector3)=>len(sub(a,b));
function rotate(v:BodyVector3,rx:number,ry:number,rz:number):BodyVector3{
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const x=vec(v.x,v.y*cx-v.z*sx,v.y*sx+v.z*cx);
  const y=vec(x.x*cy+x.z*sy,x.y,-x.x*sy+x.z*cy);
  return vec(y.x*cz-y.y*sz,y.x*sz+y.y*cz,y.z);
}
function zeroJoints():Record<BodyChannel,ArticulatedBodyJoint>{
  const out={} as Record<BodyChannel,ArticulatedBodyJoint>;
  for(const channel of CHANNELS)out[channel]={value:0,velocity:0};
  return out;
}
function poseTargets(ch:Readonly<Record<BodyChannel,number>>):Record<ArticulatedBodyParticleId,BodyVector3>{
  const g=(key:BodyChannel)=>clamp(ch[key],-1,1);
  const tp=g("torsoPitch")*.34,ty=g("torsoYaw")*.34,breath=g("breath");
  const p={} as Record<ArticulatedBodyParticleId,BodyVector3>;
  p.pelvis={...REST.pelvis};
  p.chest=add(p.pelvis,rotate(vec(0,.5,breath*.026),tp,ty,0));
  p.neck=add(p.chest,rotate(vec(0,.3,breath*.008),tp*.65,ty*.65,0));
  p.head=add(p.neck,rotate(vec(0,.24,0),tp*.35+g("headPitch")*.36,ty*.35+g("headYaw")*.42,g("headRoll")*.3));
  for(const side of [-1,1] as const){
    const left=side<0,prefix=left?"left":"right";
    const sh=(prefix+"Shoulder") as BodyChannel,el=(prefix+"Elbow") as BodyChannel;
    const wr=(prefix+"Wrist") as BodyChannel,ha=(prefix+"Hand") as BodyChannel;
    const hip=(prefix+"Hip") as BodyChannel,kn=(prefix+"Knee") as BodyChannel,an=(prefix+"Ankle") as BodyChannel;
    const shoulderId=(prefix+"ShoulderPoint") as ArticulatedBodyParticleId;
    const elbowId=(prefix+"ElbowPoint") as ArticulatedBodyParticleId;
    const wristId=(prefix+"WristPoint") as ArticulatedBodyParticleId;
    const handId=(prefix+"HandPoint") as ArticulatedBodyParticleId;
    const hipId=(prefix+"HipPoint") as ArticulatedBodyParticleId;
    const kneeId=(prefix+"KneePoint") as ArticulatedBodyParticleId;
    const ankleId=(prefix+"AnklePoint") as ArticulatedBodyParticleId;
    const heelId=(prefix+"HeelPoint") as ArticulatedBodyParticleId;
    const toeId=(prefix+"ToePoint") as ArticulatedBodyParticleId;
    p[shoulderId]=add(p.chest,rotate(vec(side*.22,-.02,0),tp,ty,0));
    const shoulderRotation=side*g(sh)*.72;
    p[elbowId]=add(p[shoulderId],rotate(vec(side*.27,-.22,0),tp*.45,ty*.45,shoulderRotation));
    p[wristId]=add(p[elbowId],rotate(vec(side*.08,-.23,0),tp*.3,ty*.3,shoulderRotation+side*g(el)*.78));
    p[handId]=add(p[wristId],rotate(vec(side*.02,-.11,0),0,0,shoulderRotation+side*(g(el)*.55+g(wr)*.4+g(ha)*.2)));
    p[hipId]=add(p.pelvis,vec(side*.12,-.04,0));
    const hipAngle=side*g(hip)*.58;
    p[kneeId]=add(p[hipId],rotate(vec(0,-.42,0),0,0,hipAngle));
    // The ankle channel rotates the foot itself; it must not distort the shin segment.
    p[ankleId]=add(p[kneeId],rotate(vec(0,-.4,0),0,0,hipAngle+side*g(kn)*.72));
    const footPitch=g(an)*.5;
    p[heelId]=add(p[ankleId],rotate(vec(0,-.025,-.04),footPitch,0,0));
    p[toeId]=add(p[ankleId],rotate(vec(0,-.025,.18),footPitch,0,0));
  }
  const yaw=g("rootYaw")*.34;
  if(yaw!==0)for(const id of IDS){if(id!=="pelvis")p[id]=add(p.pelvis,rotate(sub(p[id],p.pelvis),0,yaw,0));}
  return p;
}
function buildParticles():Record<ArticulatedBodyParticleId,ArticulatedBodyParticle>{
  const targets=poseTargets(Object.fromEntries(CHANNELS.map(k=>[k,0])) as Record<BodyChannel,number>);
  const out={} as Record<ArticulatedBodyParticleId,ArticulatedBodyParticle>;
  for(const id of IDS)out[id]={id,position:{...targets[id]},velocity:vec(),target:{...targets[id]},mass:MASS[id],pinned:id==="pelvis"};
  return out;
}
function buildSegments(p:Record<ArticulatedBodyParticleId,ArticulatedBodyParticle>):ArticulatedBodySegment[]{
  return PAIRS.map(([from,to])=>({from,to,restLength:dist(p[from].position,p[to].position)}));
}

// Immutable anatomical rest lengths. Never rebuild the base skeleton in the per-frame solver.
const DEFAULT_SEGMENT_LENGTHS = (() => {
  const particles = buildParticles();
  return buildSegments(particles).map((segment) => segment.restLength);
})();

function wrapAngle(value:number):number{
  let angle=value;
  while(angle>Math.PI)angle-=Math.PI*2;
  while(angle< -Math.PI)angle+=Math.PI*2;
  return angle;
}

const MAX_HINGE_FLEXION_RAD=150*Math.PI/180;
const MIN_HINGE_INTERNAL_RAD=Math.PI-MAX_HINGE_FLEXION_RAD;
type HingeJointKey="leftElbow"|"rightElbow"|"leftKnee"|"rightKnee";
interface HingeJointSpec {
  key:HingeJointKey;
  parent:ArticulatedBodyParticleId;
  joint:ArticulatedBodyParticleId;
  child:ArticulatedBodyParticleId;
  distal:readonly ArticulatedBodyParticleId[];
  fallbackSide:-1|1;
}
const HINGE_JOINTS:readonly HingeJointSpec[]=[
  {key:"leftElbow",parent:"leftShoulderPoint",joint:"leftElbowPoint",child:"leftWristPoint",distal:["leftHandPoint"],fallbackSide:-1},
  {key:"rightElbow",parent:"rightShoulderPoint",joint:"rightElbowPoint",child:"rightWristPoint",distal:["rightHandPoint"],fallbackSide:1},
  {key:"leftKnee",parent:"leftHipPoint",joint:"leftKneePoint",child:"leftAnklePoint",distal:["leftHeelPoint","leftToePoint"],fallbackSide:-1},
  {key:"rightKnee",parent:"rightHipPoint",joint:"rightKneePoint",child:"rightAnklePoint",distal:["rightHeelPoint","rightToePoint"],fallbackSide:1},
];

interface BodyCollisionCapsule {
  from: ArticulatedBodyParticleId;
  to: ArticulatedBodyParticleId;
  radius: number;
}
interface BodyCollisionParticle {
  id: ArticulatedBodyParticleId;
  radius: number;
  fallbackSide: -1 | 1;
}

// Renderer-neutral body-space collision volumes. Proximal attachment points
// (shoulders and hips) are excluded from point contacts so joints may remain
// anatomically connected to the torso without fighting their parent segment.
const BODY_COLLISION_CAPSULES: readonly BodyCollisionCapsule[] = [
  { from: "pelvis", to: "chest", radius: 0.135 },
  { from: "chest", to: "neck", radius: 0.09 },
  { from: "neck", to: "head", radius: 0.075 },
];
const BODY_COLLISION_PARTICLES: readonly BodyCollisionParticle[] = [
  { id: "leftElbowPoint", radius: 0.045, fallbackSide: -1 },
  { id: "leftWristPoint", radius: 0.035, fallbackSide: -1 },
  { id: "leftHandPoint", radius: 0.03, fallbackSide: -1 },
  { id: "rightElbowPoint", radius: 0.045, fallbackSide: 1 },
  { id: "rightWristPoint", radius: 0.035, fallbackSide: 1 },
  { id: "rightHandPoint", radius: 0.03, fallbackSide: 1 },
  { id: "leftKneePoint", radius: 0.05, fallbackSide: -1 },
  { id: "rightKneePoint", radius: 0.05, fallbackSide: 1 },
  { id: "leftAnklePoint", radius: 0.035, fallbackSide: -1 },
  { id: "rightAnklePoint", radius: 0.035, fallbackSide: 1 },
  { id: "leftHeelPoint", radius: 0.03, fallbackSide: -1 },
  { id: "leftToePoint", radius: 0.03, fallbackSide: -1 },
  { id: "rightHeelPoint", radius: 0.03, fallbackSide: 1 },
  { id: "rightToePoint", radius: 0.03, fallbackSide: 1 },
];

function dot(a:BodyVector3,b:BodyVector3):number{return a.x*b.x+a.y*b.y+a.z*b.z;}
function cross(a:BodyVector3,b:BodyVector3):BodyVector3{
  return vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
}
function unit(value:BodyVector3):BodyVector3|null{
  const magnitude=len(value);
  return Number.isFinite(magnitude)&&magnitude>1e-8?mul(value,1/magnitude):null;
}

/** Project a distal body particle out of a finite capsule, including degenerate-axis fallback. */
export function projectPointOutsideCapsule(
  point: BodyVector3,
  start: BodyVector3,
  end: BodyVector3,
  minimumDistance: number,
  fallbackSide: -1 | 1,
): { position: BodyVector3; normal: BodyVector3; correction: number } | null {
  if (![point.x,point.y,point.z,start.x,start.y,start.z,end.x,end.y,end.z,minimumDistance]
    .every(Number.isFinite) || minimumDistance <= 0) return null;
  const axis = sub(end,start);
  const axisLengthSquared = dot(axis,axis);
  const along = axisLengthSquared > 1e-12
    ? clamp(dot(sub(point,start),axis)/axisLengthSquared,0,1)
    : 0;
  const closest = add(start,mul(axis,along));
  const radial = sub(point,closest);
  const distance = len(radial);
  if (!Number.isFinite(distance) || distance >= minimumDistance) return null;

  let normal = unit(radial);
  if (!normal) {
    const axisUnit = unit(axis) ?? vec(0,1,0);
    const preferred = vec(fallbackSide,0,0);
    normal = unit(sub(preferred,mul(axisUnit,dot(preferred,axisUnit))))
      ?? unit(cross(axisUnit,vec(0,0,1)))
      ?? vec(fallbackSide,0,0);
    if (normal.x*fallbackSide < 0) normal = mul(normal,-1);
  }
  const correction = minimumDistance-distance;
  if (!Number.isFinite(correction) || correction <= 0) return null;
  return { position:add(point,mul(normal,correction)),normal,correction };
}

function projectArticulatedBodySelfCollisions(
  state: ArticulatedBodyParticleState,
  contactNormals: Map<ArticulatedBodyParticleId,BodyVector3>,
  contacts: ArticulatedBodyContacts,
): void {
  for (const spec of BODY_COLLISION_PARTICLES) {
    const particle = state.particles[spec.id];
    for (const capsule of BODY_COLLISION_CAPSULES) {
      if (capsule.from === spec.id || capsule.to === spec.id) continue;
      const projection = projectPointOutsideCapsule(
        particle.position,
        state.particles[capsule.from].position,
        state.particles[capsule.to].position,
        capsule.radius+spec.radius,
        spec.fallbackSide,
      );
      if (!projection) continue;
      particle.position = projection.position;
      const previousNormal = contactNormals.get(spec.id);
      contactNormals.set(spec.id,previousNormal?add(previousNormal,projection.normal):projection.normal);
      contacts.bodyCollisionCount += 1;
      contacts.maxBodyCollisionCorrection = Math.max(
        contacts.maxBodyCollisionCorrection,
        projection.correction,
      );
    }
  }
}
function rotateAroundAxis(value:BodyVector3,axis:BodyVector3,angle:number):BodyVector3{
  const cosine=Math.cos(angle),sine=Math.sin(angle);
  return add(add(mul(value,cosine),mul(cross(axis,value),sine)),
    mul(axis,dot(axis,value)*(1-cosine)));
}
function hingeInternalAngle(
  state:ArticulatedBodyParticleState,
  parentId:ArticulatedBodyParticleId,
  jointId:ArticulatedBodyParticleId,
  childId:ArticulatedBodyParticleId,
):number{
  const parent=state.particles[parentId],joint=state.particles[jointId],child=state.particles[childId];
  const a=sub(parent.position,joint.position),b=sub(child.position,joint.position);
  const denominator=len(a)*len(b);
  if(!Number.isFinite(denominator)||denominator<1e-9)return Math.PI;
  return Math.acos(clamp(dot(a,b)/denominator,-1,1));
}
function hingeFlexionDegrees(
  state:ArticulatedBodyParticleState,
  spec:HingeJointSpec,
):number{
  const internal=hingeInternalAngle(state,spec.parent,spec.joint,spec.child);
  return clamp((Math.PI-internal)*180/Math.PI,0,180);
}

/**
 * Project a hinge that exceeds 150 degrees by rotating its complete distal
 * chain around the joint. Rodrigues rotation preserves every distal segment.
 * If the current bend plane collapses, the target pose supplies its preferred
 * plane; a left/right signed Z axis is the deterministic final fallback.
 */
function projectHingeFlexionLimit(state:ArticulatedBodyParticleState,spec:HingeJointSpec):number{
  const parent=state.particles[spec.parent],joint=state.particles[spec.joint],child=state.particles[spec.child];
  const parentVector=sub(parent.position,joint.position),childVector=sub(child.position,joint.position);
  const parentUnit=unit(parentVector),childUnit=unit(childVector);
  if(!parentUnit||!childUnit)return 0;
  const currentInternal=Math.acos(clamp(dot(parentUnit,childUnit),-1,1));
  const correction=MIN_HINGE_INTERNAL_RAD-currentInternal;
  if(!Number.isFinite(correction)||correction<=1e-8)return 0;

  let axis=cross(parentUnit,childUnit);
  if(len(axis)<1e-7){
    const targetParent=unit(sub(parent.target,joint.target));
    const targetChild=unit(sub(child.target,joint.target));
    if(targetParent&&targetChild)axis=cross(targetParent,targetChild);
  }
  let normalizedAxis=unit(axis);
  if(!normalizedAxis)normalizedAxis=vec(0,0,spec.fallbackSide);

  for(const id of [spec.child,...spec.distal]){
    const particle=state.particles[id];
    particle.position=add(joint.position,
      rotateAroundAxis(sub(particle.position,joint.position),normalizedAxis,correction));
    particle.velocity=rotateAroundAxis(particle.velocity,normalizedAxis,correction);
  }
  return correction;
}

function particleSegmentAngleLag(
  state:ArticulatedBodyParticleState,
  from:ArticulatedBodyParticleId,
  to:ArticulatedBodyParticleId,
):number{
  const a=state.particles[from],b=state.particles[to];
  const targetX=b.target.x-a.target.x,targetY=b.target.y-a.target.y;
  const actualX=b.position.x-a.position.x,actualY=b.position.y-a.position.y;
  if(Math.hypot(targetX,targetY)<1e-8||Math.hypot(actualX,actualY)<1e-8)return 0;
  return wrapAngle(Math.atan2(actualY,actualX)-Math.atan2(targetY,targetX));
}

function particleVectorYawLag(
  state:ArticulatedBodyParticleState,
  from:ArticulatedBodyParticleId,
  to:ArticulatedBodyParticleId,
):number{
  const a=state.particles[from],b=state.particles[to];
  const targetX=b.target.x-a.target.x,targetZ=b.target.z-a.target.z;
  const actualX=b.position.x-a.position.x,actualZ=b.position.z-a.position.z;
  if(Math.hypot(targetX,targetZ)<1e-8||Math.hypot(actualX,actualZ)<1e-8)return 0;
  return wrapAngle(Math.atan2(-actualZ,actualX)-Math.atan2(-targetZ,targetX));
}

function particleVectorPitchLag(
  state:ArticulatedBodyParticleState,
  from:ArticulatedBodyParticleId,
  to:ArticulatedBodyParticleId,
):number{
  const a=state.particles[from],b=state.particles[to];
  const targetY=b.target.y-a.target.y,targetZ=b.target.z-a.target.z;
  const actualY=b.position.y-a.position.y,actualZ=b.position.z-a.position.z;
  if(Math.hypot(targetY,targetZ)<1e-8||Math.hypot(actualY,actualZ)<1e-8)return 0;
  return wrapAngle(Math.atan2(actualZ,actualY)-Math.atan2(targetZ,targetY));
}

function channelsFromSolvedParticles(
  joints:Record<BodyChannel,ArticulatedBodyJoint>,
  state:ArticulatedBodyParticleState,
):Partial<Record<BodyChannel,number>>{
  const channels={} as Partial<Record<BodyChannel,number>>;
  for(const key of CHANNELS)channels[key]=joints[key].value;
  const adjust=(key:BodyChannel,lag:number,gain:number,limit=.14)=>{
    const motor=clamp(channels[key]??0,-1,1);
    const correction=clamp(lag*gain,-limit,limit);
    let resolved=clamp(motor+correction,-1,1);
    // Particle inertia may oppose the active motor while a limb catches up.
    // It must never silently reverse the semantic action sign sent to renderers.
    if(motor>1e-4)resolved=Math.max(0,resolved);
    else if(motor< -1e-4)resolved=Math.min(0,resolved);
    channels[key]=resolved;
  };

  // The torso/neck/head values are recovered from the solved particle skeleton,
  // not copied from the motor targets. Thus inertia/constraint response really
  // reaches every renderer instead of remaining hidden in a diagnostics-only state.
  adjust("torsoPitch",particleVectorPitchLag(state,"pelvis","chest"),1/.34);
  adjust("torsoYaw",particleVectorYawLag(state,"leftShoulderPoint","rightShoulderPoint"),1/.34);
  const headPitchLag=particleVectorPitchLag(state,"neck","head")
    - particleVectorPitchLag(state,"chest","neck")*.35;
  adjust("headPitch",headPitchLag,1/.36);
  adjust("headYaw",particleVectorYawLag(state,"neck","head"),1/.42,.10);

  for(const side of [-1,1] as const){
    const prefix=side<0?"left":"right";
    const shoulder=(prefix+"Shoulder") as BodyChannel;
    const elbow=(prefix+"Elbow") as BodyChannel;
    const wrist=(prefix+"Wrist") as BodyChannel;
    const hip=(prefix+"Hip") as BodyChannel;
    const knee=(prefix+"Knee") as BodyChannel;
    const ankle=(prefix+"Ankle") as BodyChannel;
    const shoulderPoint=(prefix+"ShoulderPoint") as ArticulatedBodyParticleId;
    const elbowPoint=(prefix+"ElbowPoint") as ArticulatedBodyParticleId;
    const wristPoint=(prefix+"WristPoint") as ArticulatedBodyParticleId;
    const handPoint=(prefix+"HandPoint") as ArticulatedBodyParticleId;
    const hipPoint=(prefix+"HipPoint") as ArticulatedBodyParticleId;
    const kneePoint=(prefix+"KneePoint") as ArticulatedBodyParticleId;
    const anklePoint=(prefix+"AnklePoint") as ArticulatedBodyParticleId;
    const heelPoint=(prefix+"HeelPoint") as ArticulatedBodyParticleId;
    const toePoint=(prefix+"ToePoint") as ArticulatedBodyParticleId;
    const shoulderLag=particleSegmentAngleLag(state,shoulderPoint,elbowPoint);
    const elbowLag=particleSegmentAngleLag(state,elbowPoint,wristPoint);
    const wristLag=particleSegmentAngleLag(state,wristPoint,handPoint);
    const hipLag=particleSegmentAngleLag(state,hipPoint,kneePoint);
    const kneeLag=particleSegmentAngleLag(state,kneePoint,anklePoint);
    const ankleLag=particleVectorPitchLag(state,heelPoint,toePoint);
    adjust(shoulder,shoulderLag/(side*.72),1,.12);
    adjust(elbow,elbowLag/(side*.78),1,.12);
    adjust(wrist,(wristLag-elbowLag*.55)/(side*.4),1,.10);
    adjust(hip,hipLag/(side*.58),1,.12);
    adjust(knee,(kneeLag-hipLag)/(side*.72),1,.12);
    adjust(ankle,ankleLag/.5,1,.10);
  }
  return channels;
}
function constraintError(s:ArticulatedBodyParticleState):number{
  let max=0;for(const e of s.segments)max=Math.max(max,Math.abs(dist(s.particles[e.from].position,s.particles[e.to].position)-e.restLength));
  return Number.isFinite(max)?max:8;
}
export function createAvatarArticulatedBodyState():ArticulatedBodyParticleState{
  const particles=buildParticles();
  return {schemaVersion:1,tick:0,elapsedMs:0,joints:zeroJoints(),particles,segments:buildSegments(particles),maxConstraintError:0,particleCount:IDS.length};
}
function safeParticle(value:ArticulatedBodyParticle|undefined,id:ArticulatedBodyParticleId,target:BodyVector3):ArticulatedBodyParticle{
  const v=(raw:BodyVector3|undefined)=>vec(clamp(raw?.x??target.x,-8,8,target.x),clamp(raw?.y??target.y,-8,8,target.y),clamp(raw?.z??target.z,-8,8,target.z));
  return {id,position:v(value?.position),velocity:v(value?.velocity),target:{...target},mass:clamp(value?.mass??MASS[id],.05,20,MASS[id]),pinned:id==="pelvis"};
}

/**
 * Stateful full-body simulation: 22 anatomical particles, 21 bone-length
 * constraints, ground contact, hinge limits and damped joint motors.
 * It follows the existing semantic motion decision; it is not a second planner.
 */
export function stepAvatarArticulatedBody(
  previous:ArticulatedBodyParticleState,
  targetChannels:Readonly<Partial<Record<BodyChannel,number>>>,
  deltaMs:number,
  options:ArticulatedBodyStepOptions,
):ArticulatedBodyStepResult{
  const duration=clamp(deltaMs,0,66.667,0);
  const substeps=duration<=0?0:Math.min(4,Math.max(1,Math.ceil(duration/(1000/60))));
  const dt=substeps?duration/substeps/1000:0;
  const energy=clamp(options?.energy01??.7,0,1,.7),awake=options?.awake===true,reduced=options?.reducedMotion===true;
  const groundEnabled=options?.groundEnabled!==false;
  const groundY=clamp(options?.groundY??-.9,-8,8,-.9);
  const footRadius=clamp(options?.footRadius??.04,.005,.2,.04);
  const footFriction=clamp(options?.footFriction??.72,0,1,.72);
  const contactMargin=clamp(options?.groundContactMargin??.025,0,.25,.025);
  const contactSurfaceY=groundY+footRadius;
  const supportPoints=[
    {id:"leftHeelPoint" as ArticulatedBodyParticleId,side:"left" as const},
    {id:"leftToePoint" as ArticulatedBodyParticleId,side:"left" as const},
    {id:"rightHeelPoint" as ArticulatedBodyParticleId,side:"right" as const},
    {id:"rightToePoint" as ArticulatedBodyParticleId,side:"right" as const},
  ] as const;
  const contacts:ArticulatedBodyContacts={
    leftFoot:false,rightFoot:false,maxCorrection:0,maxSlipSpeed:0,
    bodyCollisionCount:0,maxBodyCollisionCorrection:0,
  };
  const correctionDegrees:ArticulatedBodyJointLimitDiagnostics["correctionDegrees"]={
    leftElbow:0,rightElbow:0,leftKnee:0,rightKnee:0,
  };
  const drive = !awake ? 0 : reduced ? 0.16 : 0.22 + energy * 0.78;
  const joints=zeroJoints();
  for(const key of CHANNELS){
    const old=previous?.joints?.[key]??{value:0,velocity:0};
    const target=clamp(targetChannels?.[key]??0,-1,1)*drive;
    let value=clamp(old.value,-1,1),velocity=clamp(old.velocity,-24,24);
    for(let i=0;i<substeps;i++){
      const acceleration=(target-value)*196-velocity*27;
      velocity=clamp(velocity+acceleration*dt,-16,16);
      value=clamp(value+velocity*dt,-1,1);
    }
    joints[key]={value,velocity};
  }
  const targets=poseTargets(Object.fromEntries(CHANNELS.map(k=>[k,joints[k].value])) as Record<BodyChannel,number>);
  const particles={} as Record<ArticulatedBodyParticleId,ArticulatedBodyParticle>;
  const baseParticles=previous?.particles;
  for(const id of IDS)particles[id]=safeParticle(baseParticles?.[id],id,targets[id]);
  particles.pelvis.position={...targets.pelvis};particles.pelvis.velocity=vec();
  const baseSegments=previous?.segments;
  const segments=Array.isArray(baseSegments)&&baseSegments.length===PAIRS.length
    ?PAIRS.map(([from,to],i)=>({from,to,restLength:clamp(baseSegments[i]?.restLength??DEFAULT_SEGMENT_LENGTHS[i],.01,4,.1)}))
    :PAIRS.map(([from,to],i)=>({from,to,restLength:DEFAULT_SEGMENT_LENGTHS[i]}));
  const state:ArticulatedBodyParticleState={
    schemaVersion:1,tick:Math.max(0,Number.isSafeInteger(previous?.tick)?previous.tick:0)+(substeps?1:0),
    elapsedMs:clamp(previous?.elapsedMs??0,0,Number.MAX_SAFE_INTEGER)+duration,
    joints,particles,segments,maxConstraintError:0,particleCount:IDS.length,
  };
  for(let step=0;step<substeps;step++){
    const before={} as Record<ArticulatedBodyParticleId,BodyVector3>;
    const incomingVelocity={} as Record<ArticulatedBodyParticleId,BodyVector3>;
    const projectedSupport=new Set<ArticulatedBodyParticleId>();
    const collisionNormals=new Map<ArticulatedBodyParticleId,BodyVector3>();
    for(const id of IDS){
      const p=state.particles[id];before[id]={...p.position};incomingVelocity[id]={...p.velocity};if(p.pinned)continue;
      const stiffness=reduced?92:128,damping=reduced||!awake?22:18,gravity=awake?(1-energy)*.12:.18;
      const acceleration=add(mul(sub(p.target,p.position),stiffness/p.mass),
        add(mul(p.velocity,-damping/p.mass),vec(0,-gravity,0)));
      p.velocity=add(p.velocity,mul(acceleration,dt));
      p.position=add(p.position,mul(p.velocity,dt));
    }
    for(let iteration=0;iteration<5;iteration++){
      for(const segment of state.segments){
        const a=state.particles[segment.from],b=state.particles[segment.to],delta=sub(b.position,a.position);
        const current=len(delta);if(!Number.isFinite(current)||current<1e-8)continue;
        const error=current-segment.restLength,wa=a.pinned?0:1/a.mass,wb=b.pinned?0:1/b.mass,total=wa+wb;
        if(total<=0)continue;
        const correction=mul(delta,error/current*.88);
        a.position=add(a.position,mul(correction,wa/total));
        b.position=sub(b.position,mul(correction,wb/total));
      }
      // Joint limits are solver constraints, not motor-input clamps. Apply them
      // after every distance pass so the distal chains cannot re-fold between ticks.
      for(const hinge of HINGE_JOINTS){
        const correction=projectHingeFlexionLimit(state,hinge);
        correctionDegrees[hinge.key]=Math.max(correctionDegrees[hinge.key],correction*180/Math.PI);
      }
      // Unilateral support-plane projection runs after every distance-constraint pass.
      // Only a semantic stance target may contact the plane; a lifted swing foot stays free.
      if(groundEnabled){
        for(const support of supportPoints){
          const p=state.particles[support.id];
          // The floor constrains actual geometry even while a swing target is lifting.
          // This prevents a delayed foot from remaining underground after take-off begins.
          if(p.position.y<contactSurfaceY){
            const correction=contactSurfaceY-p.position.y;
            p.position.y=contactSurfaceY;
            projectedSupport.add(support.id);
            contacts.maxCorrection=Math.max(contacts.maxCorrection,correction);
          }
        }
      }
      // Resolve limb-to-torso contacts after bone lengths and hinges. Repeating
      // the unilateral projection each iteration prevents constraints from
      // pulling the hands/wrists back through the body volume on the next pass.
      projectArticulatedBodySelfCollisions(state,collisionNormals,contacts);
      state.particles.pelvis.position={...state.particles.pelvis.target};
    }
    for(const id of IDS){
      const p=state.particles[id];if(p.pinned)continue;
      p.velocity=mul(sub(p.position,before[id]),1/dt);
      p.velocity=mul(p.velocity,(reduced || !awake) ? 0.78 : 0.9);
      const collisionNormal=unit(collisionNormals.get(id)??vec());
      if(collisionNormal){
        // Zero restitution: positional separation must not become a bounce.
        p.velocity=sub(p.velocity,mul(collisionNormal,dot(p.velocity,collisionNormal)));
      }
      p.position=vec(clamp(p.position.x,-2,2),clamp(p.position.y,-2,3),clamp(p.position.z,-2,2));
    }
    if(groundEnabled){
      for(const support of supportPoints){
        const p=state.particles[support.id];
        const touching=p.position.y<=contactSurfaceY+1e-4;
        if(!touching)continue;
        const incoming=incomingVelocity[support.id];
        if(projectedSupport.has(support.id)||incoming.y<0){
          // Zero restitution: a positional correction must not become an upward bounce.
          p.velocity.y=0;
        } else if(p.target.y<=contactSurfaceY+contactMargin){
          // While the target remains planted, suppress positive velocity from PBD corrections.
          p.velocity.y=Math.min(0,p.velocity.y);
        }
        const slip=Math.hypot(p.velocity.x,p.velocity.z);
        contacts.maxSlipSpeed=Math.max(contacts.maxSlipSpeed,slip);
        const tangentScale=1-footFriction;
        p.velocity.x*=tangentScale;
        p.velocity.z*=tangentScale;
        if(support.side==="left")contacts.leftFoot=true;
        else contacts.rightFoot=true;
      }
    }
  }
  state.maxConstraintError=constraintError(state);
  const channels=channelsFromSolvedParticles(joints,state);
  const flexionDegrees={
    leftElbow:hingeFlexionDegrees(state,HINGE_JOINTS[0]),
    rightElbow:hingeFlexionDegrees(state,HINGE_JOINTS[1]),
    leftKnee:hingeFlexionDegrees(state,HINGE_JOINTS[2]),
    rightKnee:hingeFlexionDegrees(state,HINGE_JOINTS[3]),
  };
  const jointLimits:ArticulatedBodyJointLimitDiagnostics={
    maxFlexionDeg:150,
    flexionDegrees,
    correctionDegrees,
    maxCorrectionDeg:Math.max(...Object.values(correctionDegrees)),
  };
  return {state,channels,substeps,simulatedMs:duration,maxConstraintError:state.maxConstraintError,contacts,jointLimits};
}
export const AVATAR_ARTICULATED_BODY_PARTICLE_COUNT=IDS.length;
export const AVATAR_ARTICULATED_BODY_SEGMENT_COUNT=PAIRS.length;
