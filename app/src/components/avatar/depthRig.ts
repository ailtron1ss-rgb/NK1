
export type DepthRigRole = "root"|"head"|"face"|"eyes"|"hair-front"|"hair-back"|"torso"|"left-upper-arm"|"left-forearm"|"left-hand"|"right-upper-arm"|"right-forearm"|"right-hand"|"coat-front"|"coat-tail"|"accessory"|"custom";
export interface DepthRigNode { id:string; parentId:string|null; role:DepthRigRole; position:readonly [number,number,number]; pivot:readonly [number,number]; rotation:readonly [number,number,number]; depth:number; parallax:number; visible?:boolean }
export interface DepthRigManifest { version:1; id:string; units:"scene"; nodes:readonly DepthRigNode[] }
export interface DepthRigIntent { gazeX?:number; gazeY?:number; headYaw?:number; headPitch?:number; headRoll?:number; torsoYaw?:number; torsoPitch?:number; torsoRoll?:number; leftArm?:number; leftForearm?:number; rightArm?:number; rightForearm?:number; breath?:number; arousal?:number }
export interface DepthRigTransform { id:string; pivot:[number,number]; position:[number,number,number]; rotation:[number,number,number]; scale:[number,number,number]; visible:boolean; renderOrder:number }
export interface DepthRigValidation { ok:boolean; errors:string[]; order:string[] }
const MAX_NODES=128, MAX_POSITION=20;
const ROLES=new Set<DepthRigRole>(["root","head","face","eyes","hair-front","hair-back","torso","left-upper-arm","left-forearm","left-hand","right-upper-arm","right-forearm","right-hand","coat-front","coat-tail","accessory","custom"]);
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Number.isFinite(v)?v:0));
const tuple=(v:unknown,n:number):v is number[]=>Array.isArray(v)&&v.length===n&&v.every((item: number) => Number.isFinite(item));

/** Validate a layered illustration hierarchy before it reaches a renderer. */
export function validateDepthRig(manifest:DepthRigManifest):DepthRigValidation {
 const errors:string[]=[];
 if(!manifest||manifest.version!==1||manifest.units!=="scene")errors.push("unsupported-version-or-units");
 if(typeof manifest?.id!=="string"||!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(manifest.id))errors.push("invalid-rig-id");
 if(!Array.isArray(manifest?.nodes)||manifest.nodes.length===0||manifest.nodes.length>MAX_NODES)return {ok:false,errors:[...errors,"node-count-out-of-range"],order:[]};
 const map=new Map<string,DepthRigNode>();
 for(const n of manifest.nodes){
  if(!n||typeof n.id!=="string"||!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(n.id)){errors.push("invalid-node-id");continue}
  if(map.has(n.id))errors.push("duplicate-node:"+n.id); map.set(n.id,n);
  if(!ROLES.has(n.role))errors.push("invalid-role:"+n.id);
  if(n.parentId!==null&&typeof n.parentId!=="string")errors.push("invalid-parent:"+n.id);
  if(!tuple(n.position,3)||n.position.some((v:number)=>Math.abs(v)>MAX_POSITION))errors.push("invalid-position:"+n.id);
  if(!tuple(n.pivot,2)||n.pivot.some((v:number)=>Math.abs(v)>1))errors.push("invalid-pivot:"+n.id);
  if(!tuple(n.rotation,3)||n.rotation.some((v:number)=>Math.abs(v)>Math.PI*4))errors.push("invalid-rotation:"+n.id);
  if(!Number.isFinite(n.depth)||n.depth < -1||n.depth>1)errors.push("invalid-depth:"+n.id);
  if(!Number.isFinite(n.parallax)||n.parallax<0||n.parallax>2)errors.push("invalid-parallax:"+n.id);
  if(n.visible!==undefined&&typeof n.visible!=="boolean")errors.push("invalid-visibility:"+n.id);
 }
 for(const n of map.values()){if(n.parentId&&!map.has(n.parentId))errors.push("missing-parent:"+n.id);if(n.parentId===n.id)errors.push("self-parent:"+n.id)}
 const order:string[]=[], visiting=new Set<string>(), visited=new Set<string>();
 const visit=(id:string)=>{if(visited.has(id))return;if(visiting.has(id)){errors.push("parent-cycle:"+id);return}visiting.add(id);const p=map.get(id)?.parentId;if(p&&map.has(p))visit(p);visiting.delete(id);visited.add(id);order.push(id)};
 for(const id of map.keys())visit(id);
 return {ok:errors.length===0,errors:[...new Set(errors)],order};
}
type Intent=Required<DepthRigIntent>;
function roleRotation(role:DepthRigRole,i:Intent):[number,number,number]{
 switch(role){
  case "head":return [i.headPitch,i.headYaw,i.headRoll];
  case "face":case "eyes":return [i.headPitch*.22,i.headYaw*.18,0];
  case "torso":return [i.torsoPitch,i.torsoYaw,i.torsoRoll];
  case "left-upper-arm":return [0,0,i.leftArm];case "left-forearm":return [0,0,i.leftForearm];
  case "right-upper-arm":return [0,0,i.rightArm];case "right-forearm":return [0,0,i.rightForearm];
  case "hair-front":return [i.headPitch*.08,i.headYaw*.12,i.headRoll*.55];
  case "hair-back":return [i.headPitch*.12,i.headYaw*.2,i.headRoll*.8];
  case "coat-tail":return [0,i.torsoYaw*.12,i.torsoRoll*.2];
  default:return [0,0,0];
 }
}
/** Convert semantic body intent into bounded layer transforms; artist-authored pivots stay authoritative. */
export function resolveDepthRigPose(manifest:DepthRigManifest,raw:DepthRigIntent={},camera:{x?:number;y?:number}={}):DepthRigTransform[]{
 const v=validateDepthRig(manifest);if(!v.ok)throw new Error("Invalid depth rig: "+v.errors.join(","));
 const i:Intent={gazeX:clamp(raw.gazeX??0,-1,1),gazeY:clamp(raw.gazeY??0,-1,1),headYaw:clamp(raw.headYaw??0,-.65,.65),headPitch:clamp(raw.headPitch??0,-.45,.45),headRoll:clamp(raw.headRoll??0,-.35,.35),torsoYaw:clamp(raw.torsoYaw??0,-.3,.3),torsoPitch:clamp(raw.torsoPitch??0,-.25,.25),torsoRoll:clamp(raw.torsoRoll??0,-.2,.2),leftArm:clamp(raw.leftArm??0,-1.8,1.8),leftForearm:clamp(raw.leftForearm??0,-2.2,2.2),rightArm:clamp(raw.rightArm??0,-1.8,1.8),rightForearm:clamp(raw.rightForearm??0,-2.2,2.2),breath:clamp(raw.breath??0,0,1),arousal:clamp(raw.arousal??0,0,1)};
 const cx=clamp(camera.x??0,-1,1),cy=clamp(camera.y??0,-1,1),map=new Map(manifest.nodes.map(n=>[n.id,n]));
 return v.order.map(id=>{const n=map.get(id)!,d=roleRotation(n.role,i),breath=n.role==="torso"?1+i.breath*.012:1,gx=n.role==="eyes"?i.gazeX*.08:0,gy=n.role==="eyes"?i.gazeY*.06:0;
  return {id,pivot:[n.pivot[0],n.pivot[1]],position:[n.position[0]+cx*n.depth*n.parallax*.06,n.position[1]+cy*n.depth*n.parallax*.04,n.position[2]] as [number,number,number],rotation:[n.rotation[0]+d[0]+gy,n.rotation[1]+d[1]+gx,n.rotation[2]+d[2]] as [number,number,number],scale:[1,breath,1] as [number,number,number],visible:n.visible!==false,renderOrder:Math.round((n.depth+1)*1000)};
 });
}
export interface SecondaryMotionState{position:number;velocity:number}
/** Stable bounded damped-spring integration for hair/cloth; caller owns state per node. */
export function stepSecondaryMotion(state:SecondaryMotionState,target:number,deltaSeconds:number,options:{stiffness?:number;damping?:number;maxOffset?:number;maxVelocity?:number}={}):SecondaryMotionState{
 const dt=clamp(deltaSeconds,0,1/20),k=clamp(options.stiffness??42,1,160),d=clamp(options.damping??11,0,40),limit=clamp(options.maxOffset??.22,.01,1),speed=clamp(options.maxVelocity??2.5,.05,12);
 const p=clamp(state.position,-limit,limit),v=clamp(state.velocity,-speed,speed),force=(clamp(target,-limit,limit)-p)*k-v*d;
 const velocity=clamp(v+force*dt,-speed,speed);return {position:clamp(p+velocity*dt,-limit,limit),velocity};
}

export type DepthRigSecondaryMotionMap = Map<string, SecondaryMotionState>;
/**
 * Add bounded inertial follow-through to hair and coat layers.
 * State is owned by the renderer and keyed by manifest node ID; body layers
 * remain untouched. The spring target follows semantic head/torso intent.
 */
export function stepDepthRigSecondaryMotion(
 manifest:DepthRigManifest,
 transforms:readonly DepthRigTransform[],
 intent:DepthRigIntent,
 states:DepthRigSecondaryMotionMap,
 deltaSeconds:number,
):DepthRigTransform[]{
 const roles=new Map(manifest.nodes.map(node=>[node.id,node.role]));
 const headYaw=clamp(intent.headYaw??0,-.65,.65),headPitch=clamp(intent.headPitch??0,-.45,.45);
 const headRoll=clamp(intent.headRoll??0,-.35,.35),torsoYaw=clamp(intent.torsoYaw??0,-.3,.3);
 const torsoRoll=clamp(intent.torsoRoll??0,-.2,.2);
 return transforms.map(transform=>{
  const role=roles.get(transform.id);
  let target:number,options:{stiffness:number;damping:number;maxOffset:number;maxVelocity:number};
  if(role==="hair-front"||role==="hair-back"){
   target=-headYaw*(role==="hair-front"?.075:.11)+headPitch*(role==="hair-front"?.045:.065)-headRoll*.035;
   options={stiffness:48,damping:10,maxOffset:.16,maxVelocity:1.8};
  }else if(role==="coat-front"||role==="coat-tail"){
   target=-torsoYaw*(role==="coat-tail"?.12:.055)+torsoRoll*.08;
   options={stiffness:34,damping:9,maxOffset:.12,maxVelocity:1.4};
  }else return transform;
  const state=stepSecondaryMotion(states.get(transform.id)??{position:0,velocity:0},target,deltaSeconds,options);
  states.set(transform.id,state);
  return {...transform,rotation:[transform.rotation[0],transform.rotation[1],transform.rotation[2]+state.position]};
 });
}
