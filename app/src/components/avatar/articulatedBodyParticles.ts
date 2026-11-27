import type { BodyChannel } from "./embodimentSwitch.ts";

export interface BodyVector3 { x: number; y: number; z: number; }
export type ArticulatedBodyParticleId =
  | "pelvis" | "chest" | "neck" | "head"
  | "leftShoulderPoint" | "leftElbowPoint" | "leftWristPoint" | "leftHandPoint"
  | "rightShoulderPoint" | "rightElbowPoint" | "rightWristPoint" | "rightHandPoint"
  | "leftHipPoint" | "leftKneePoint" | "leftAnklePoint"
  | "rightHipPoint" | "rightKneePoint" | "rightAnklePoint";
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
export interface ArticulatedBodyStepOptions { awake: boolean; energy01: number; reducedMotion?: boolean; }
export interface ArticulatedBodyStepResult {
  state: ArticulatedBodyParticleState; channels: Partial<Record<BodyChannel, number>>;
  substeps: number; simulatedMs: number; maxConstraintError: number;
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
  "leftHipPoint","leftKneePoint","leftAnklePoint",
  "rightHipPoint","rightKneePoint","rightAnklePoint",
];
const PAIRS: readonly (readonly [ArticulatedBodyParticleId,ArticulatedBodyParticleId])[] = [
  ["pelvis","chest"],["chest","neck"],["neck","head"],
  ["chest","leftShoulderPoint"],["leftShoulderPoint","leftElbowPoint"],["leftElbowPoint","leftWristPoint"],["leftWristPoint","leftHandPoint"],
  ["chest","rightShoulderPoint"],["rightShoulderPoint","rightElbowPoint"],["rightElbowPoint","rightWristPoint"],["rightWristPoint","rightHandPoint"],
  ["pelvis","leftHipPoint"],["leftHipPoint","leftKneePoint"],["leftKneePoint","leftAnklePoint"],
  ["pelvis","rightHipPoint"],["rightHipPoint","rightKneePoint"],["rightKneePoint","rightAnklePoint"],
];
const REST: Readonly<Record<ArticulatedBodyParticleId,BodyVector3>> = {
  pelvis:{x:0,y:0,z:0}, chest:{x:0,y:.5,z:0}, neck:{x:0,y:.8,z:0}, head:{x:0,y:1.04,z:0},
  leftShoulderPoint:{x:-.22,y:.73,z:0}, leftElbowPoint:{x:-.49,y:.51,z:0}, leftWristPoint:{x:-.57,y:.28,z:0}, leftHandPoint:{x:-.59,y:.17,z:0},
  rightShoulderPoint:{x:.22,y:.73,z:0}, rightElbowPoint:{x:.49,y:.51,z:0}, rightWristPoint:{x:.57,y:.28,z:0}, rightHandPoint:{x:.59,y:.17,z:0},
  leftHipPoint:{x:-.12,y:-.04,z:0}, leftKneePoint:{x:-.14,y:-.46,z:0}, leftAnklePoint:{x:-.14,y:-.86,z:0},
  rightHipPoint:{x:.12,y:-.04,z:0}, rightKneePoint:{x:.14,y:-.46,z:0}, rightAnklePoint:{x:.14,y:-.86,z:0},
};
const MASS: Readonly<Record<ArticulatedBodyParticleId,number>> = {
  pelvis:2.8,chest:2.1,neck:.55,head:.9,
  leftShoulderPoint:.55,leftElbowPoint:.42,leftWristPoint:.22,leftHandPoint:.18,
  rightShoulderPoint:.55,rightElbowPoint:.42,rightWristPoint:.22,rightHandPoint:.18,
  leftHipPoint:.8,leftKneePoint:.58,leftAnklePoint:.3,
  rightHipPoint:.8,rightKneePoint:.58,rightAnklePoint:.3,
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
    p[shoulderId]=add(p.chest,rotate(vec(side*.22,-.02,0),tp,ty,0));
    const shoulderRotation=side*g(sh)*.72;
    p[elbowId]=add(p[shoulderId],rotate(vec(side*.27,-.22,0),tp*.45,ty*.45,shoulderRotation));
    p[wristId]=add(p[elbowId],rotate(vec(side*.08,-.23,0),tp*.3,ty*.3,shoulderRotation+side*g(el)*.78));
    p[handId]=add(p[wristId],rotate(vec(side*.02,-.11,0),0,0,shoulderRotation+side*(g(el)*.55+g(wr)*.4+g(ha)*.2)));
    p[hipId]=add(p.pelvis,vec(side*.12,-.04,0));
    const hipAngle=side*g(hip)*.58;
    p[kneeId]=add(p[hipId],rotate(vec(0,-.42,0),0,0,hipAngle));
    p[ankleId]=add(p[kneeId],rotate(vec(0,-.4,0),0,0,hipAngle+side*g(kn)*.72+side*g(an)*.18));
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
    channels[key]=clamp((channels[key]??0)+clamp(lag*gain,-limit,limit),-1,1);
  };

  // The torso/neck/head values are recovered from the solved particle skeleton,
  // not copied from the motor targets. Thus inertia/constraint response really
  // reaches every renderer instead of remaining hidden in a diagnostics-only state.
  adjust("torsoPitch",particleVectorPitchLag(state,"pelvis","chest"),1/.34);
  adjust("torsoYaw",particleVectorYawLag(state,"leftShoulderPoint","rightShoulderPoint"),1/.34);
  adjust("headPitch",particleVectorPitchLag(state,"neck","head"),1/.36);
  const headYawLag=state.particles.head.position.x-state.particles.head.target.x;
  adjust("headYaw",headYawLag,1/.24,.10);

  for(const side of [-1,1] as const){
    const prefix=side<0?"left":"right";
    const shoulder=(prefix+"Shoulder") as BodyChannel;
    const elbow=(prefix+"Elbow") as BodyChannel;
    const wrist=(prefix+"Wrist") as BodyChannel;
    const hip=(prefix+"Hip") as BodyChannel;
    const knee=(prefix+"Knee") as BodyChannel;
    const shoulderPoint=(prefix+"ShoulderPoint") as ArticulatedBodyParticleId;
    const elbowPoint=(prefix+"ElbowPoint") as ArticulatedBodyParticleId;
    const wristPoint=(prefix+"WristPoint") as ArticulatedBodyParticleId;
    const handPoint=(prefix+"HandPoint") as ArticulatedBodyParticleId;
    const hipPoint=(prefix+"HipPoint") as ArticulatedBodyParticleId;
    const kneePoint=(prefix+"KneePoint") as ArticulatedBodyParticleId;
    const anklePoint=(prefix+"AnklePoint") as ArticulatedBodyParticleId;
    const shoulderLag=particleSegmentAngleLag(state,shoulderPoint,elbowPoint);
    const elbowLag=particleSegmentAngleLag(state,elbowPoint,wristPoint);
    const wristLag=particleSegmentAngleLag(state,wristPoint,handPoint);
    const hipLag=particleSegmentAngleLag(state,hipPoint,kneePoint);
    const kneeLag=particleSegmentAngleLag(state,kneePoint,anklePoint);
    adjust(shoulder,shoulderLag/(side*.72),1,.12);
    adjust(elbow,elbowLag/(side*.78),1,.12);
    adjust(wrist,(wristLag-elbowLag*.55)/(side*.4),1,.10);
    adjust(hip,hipLag/(side*.58),1,.12);
    adjust(knee,(kneeLag-hipLag)/(side*.72),1,.12);
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
 * Stateful full-body simulation: 18 anatomical particles, 17 bone-length
 * constraints and damped joint motors. One solver output feeds all renderers.
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
    for(const id of IDS){
      const p=state.particles[id];before[id]={...p.position};if(p.pinned)continue;
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
      state.particles.pelvis.position={...state.particles.pelvis.target};
    }
    for(const id of IDS){
      const p=state.particles[id];if(p.pinned)continue;
      p.velocity=mul(sub(p.position,before[id]),1/dt);
      p.velocity=mul(p.velocity,(reduced || !awake) ? 0.78 : 0.9);
      p.position=vec(clamp(p.position.x,-2,2),clamp(p.position.y,-2,3),clamp(p.position.z,-2,2));
    }
  }
  state.maxConstraintError=constraintError(state);
  const channels=channelsFromSolvedParticles(joints,state);
  return {state,channels,substeps,simulatedMs:duration,maxConstraintError:state.maxConstraintError};
}
export const AVATAR_ARTICULATED_BODY_PARTICLE_COUNT=IDS.length;
export const AVATAR_ARTICULATED_BODY_SEGMENT_COUNT=PAIRS.length;
