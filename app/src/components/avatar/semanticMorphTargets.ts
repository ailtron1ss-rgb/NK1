export type SemanticMorphChannel = "joy" | "sadness" | "anger" | "mouthOpen" | "mouthOh" | "blink";
export interface SemanticMorphTarget { index: number; channel: SemanticMorphChannel; key: string; }
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
/**
 * Resolve only recognizable facial blendshape names. Unknown morphs are deliberately
 * untouched; this is a best-effort bridge for GLB/VRM exports, not a guessed rig schema.
 */
export function resolveSemanticMorphTargets(dictionary:Record<string,number>):SemanticMorphTarget[] {
 const out:SemanticMorphTarget[]=[];
 for(const [key,index] of Object.entries(dictionary)){
  if(!Number.isInteger(index)||index<0)continue;
  const name=normalize(key);
  let channel:SemanticMorphChannel|null=null;
  if(/(?:blink|eyeblink|eyeclose)(?:left|right|l|r)?$/.test(name))channel="blink";
  else if(/(?:viseme|phoneme)(?:oh|ou|o)$/.test(name)||/(?:mouth|jaw)openoh$/.test(name)||/fclmtho$/.test(name))channel="mouthOh";
  else if(/(?:viseme|phoneme)(?:aa|a)$/.test(name)||/(?:mouth|jaw)open$/.test(name)||/fclmtha$/.test(name))channel="mouthOpen";
  else if(/(?:happy|joy|smile|fun)$/.test(name))channel="joy";
  else if(/(?:sad|sorrow|cry)$/.test(name))channel="sadness";
  else if(/(?:angry|anger|frown)$/.test(name))channel="anger";
  if(channel)out.push({index,channel,key});
 }
 return out;
}
export function semanticMorphValues(input:{emotion:string; speaking:boolean; mouthOpen:number; mouthForm:number; blink:number}):Record<SemanticMorphChannel,number>{
 const emotion=input.emotion;
 return {
  joy:emotion==="joy"?.75:emotion==="protective"?.22:emotion==="calm"?.08:0,
  sadness:emotion==="sadness"||emotion==="anxiety"?.62:0,
  anger:emotion==="anger"||emotion==="frustration"?.7:0,
  mouthOpen:input.speaking?Math.max(0,Math.min(1,Number.isFinite(input.mouthOpen)?input.mouthOpen:0)):0,
  mouthOh:input.speaking&&input.mouthForm<-.25?Math.max(0,Math.min(1,Number.isFinite(input.mouthOpen)?input.mouthOpen:0)):0,
  blink:Math.max(0,Math.min(1,Number.isFinite(input.blink)?input.blink:0)),
 };
}

export interface SemanticMorphBinding { influences: number[]; index: number; channel: SemanticMorphChannel; baseInfluence: number; weight?: number; }
/**
 * Apply the shared expression snapshot without erasing stronger authored animation.
 * Blendshape clips run first; the semantic layer only raises a channel to its requested
 * floor. This keeps imported animation clips and NK1 affect/viseme intent composable.
 */
export function applySemanticMorphTargets(bindings:SemanticMorphBinding[],values:Record<SemanticMorphChannel,number>):void {
 for(const binding of bindings){
  const current=binding.influences[binding.index];
  if(!Number.isFinite(current))continue;
  const channelValue=Number.isFinite(values[binding.channel])?Math.max(0,Math.min(1,values[binding.channel])):0;
  const weight=Number.isFinite(binding.weight)?Math.max(0,Math.min(1,binding.weight!)):1;
  const requested=channelValue*weight;
  binding.influences[binding.index]=Math.max(current,requested);
 }
}

export type SemanticMorphValues = Record<SemanticMorphChannel, number>;
/** Smooth affective morphs without delaying viseme/blink response. */
export function smoothSemanticMorphValues(previous:SemanticMorphValues,target:SemanticMorphValues,dtSeconds:number):SemanticMorphValues {
 const dt=Math.max(0,Math.min(.1,Number.isFinite(dtSeconds)?dtSeconds:0));
 const next={} as SemanticMorphValues;
 for(const channel of ["joy","sadness","anger","mouthOpen","mouthOh","blink"] as const){
  const from=Number.isFinite(previous[channel])?Math.max(0,Math.min(1,previous[channel])):0;
  const to=Number.isFinite(target[channel])?Math.max(0,Math.min(1,target[channel])):0;
  const fast=channel==="mouthOpen"||channel==="mouthOh"||channel==="blink";
  const tau=to>from?(fast?.045:.11):(fast?.075:.28);
  const alpha=dt===0?0:1-Math.exp(-dt/tau);
  next[channel]=from+(to-from)*alpha;
 }
 return next;
}


type VrmMorphBind = { node?: unknown; mesh?: unknown; index?: unknown; weight?: unknown };
type VrmExpression = { morphTargetBinds?: unknown };
type VrmPresetDefinition = { channel: SemanticMorphChannel; aliases: string[] };
const VRM_PRESETS: Record<string,VrmPresetDefinition> = {
 happy:{channel:"joy",aliases:["happy","joy","fun"]},
 sad:{channel:"sadness",aliases:["sad","sorrow"]},
 angry:{channel:"anger",aliases:["angry","anger"]},
 blink:{channel:"blink",aliases:["blink"]},
 aa:{channel:"mouthOpen",aliases:["aa","a"]},
 oh:{channel:"mouthOh",aliases:["oh","ou","o"]},
};
const presetChannel=(name:unknown):SemanticMorphChannel|null=>{
 const key=String(name??"").toLowerCase().replace(/[^a-z0-9]/g,"");
 for(const definition of Object.values(VRM_PRESETS))if(definition.aliases.includes(key))return definition.channel;
 return null;
};
const finiteIndex=(value:unknown):number|null=>Number.isSafeInteger(value)&&Number(value)>=0?Number(value):null;
const normalizedWeight=(value:unknown,legacy=false):number=>{
 const n=Number(value);
 if(!Number.isFinite(n))return 0;
 return Math.max(0,Math.min(1,legacy&&n>1?n/100:n));
};
/**
 * Resolve official VRM 1.0 (VRMC_vrm) and VRM 0.x (VRM) expression presets
 * through GLTFLoader's node/mesh associations. The generic name resolver remains
 * as a fallback for GLB exports without VRM metadata.
 */
export function resolveVrmExpressionMorphTargets(root:any,parser:any):SemanticMorphBinding[]{
 const associations=parser?.associations;
 const extensions=parser?.json?.extensions;
 if(!(associations instanceof Map)||!extensions||!root?.traverse)return [];
 const nodes=new Map<number,any>(),meshes=new Map<number,any>();
 root.traverse((object:any)=>{
  const association=associations.get(object);
  const nodeIndex=finiteIndex(association?.nodes),meshIndex=finiteIndex(association?.meshes);
  if(nodeIndex!==null)nodes.set(nodeIndex,object);
  if(meshIndex!==null)meshes.set(meshIndex,object);
 });
 const bindings:SemanticMorphBinding[]=[];
 const append=(object:any,indexValue:unknown,weightValue:unknown,channel:SemanticMorphChannel,legacy=false)=>{
  const index=finiteIndex(indexValue),influences=object?.morphTargetInfluences;
  if(index===null||!Array.isArray(influences)||index>=influences.length)return;
  const baseInfluence=Number.isFinite(influences[index])?Math.max(0,Math.min(1,influences[index])):0;
  bindings.push({influences,index,channel,baseInfluence,weight:normalizedWeight(weightValue,legacy)});
 };
 const vrmc=extensions.VRMC_vrm;
 const preset=vrmc?.expressions?.preset;
 if(preset&&typeof preset==="object")for(const [name,expression] of Object.entries(preset as Record<string,VrmExpression>)){
  const channel=presetChannel(name),binds=Array.isArray(expression?.morphTargetBinds)?expression.morphTargetBinds as VrmMorphBind[]:[];
  if(!channel)continue;
  for(const bind of binds){const nodeIndex=finiteIndex(bind.node);if(nodeIndex!==null)append(nodes.get(nodeIndex),bind.index,bind.weight,channel);}
 }
 const legacy=extensions.VRM?.blendShapeMaster?.blendShapeGroups;
 if(Array.isArray(legacy))for(const group of legacy as Array<{presetName?:unknown;binds?:unknown}>){
  const channel=presetChannel(group.presetName),binds=Array.isArray(group.binds)?group.binds as VrmMorphBind[]:[];
  if(!channel)continue;
  for(const bind of binds){const meshIndex=finiteIndex(bind.mesh);if(meshIndex!==null)append(meshes.get(meshIndex),bind.index,bind.weight,channel,true);}
 }
 return bindings;
}


/**
 * Resolve standardized VRM humanoid roles to actual Bone objects. VRM 1.0 stores
 * node references in a map; VRM 0.x stores a bone/node array. This lets NK1 drive
 * canonical head/spine/arm roles even when an author's bone names are arbitrary.
 */
export function resolveVrmHumanoidBoneRoles(parser:any):Map<any,string>{
 const associations=parser?.associations,extensions=parser?.json?.extensions;
 if(!(associations instanceof Map)||!extensions)return new Map();
 const objectsByNode=new Map<number,any>();
 for(const [object,association] of associations.entries()){
  const nodeIndex=finiteIndex(association?.nodes);
  if(nodeIndex!==null&&object?.isBone)objectsByNode.set(nodeIndex,object);
 }
 const roles=new Map<any,string>();
 const vrmcBones=extensions.VRMC_vrm?.humanoid?.humanBones;
 if(vrmcBones&&typeof vrmcBones==="object")for(const [role,definition] of Object.entries(vrmcBones as Record<string,{node?:unknown}>)){
  const nodeIndex=finiteIndex(definition?.node),bone=nodeIndex===null?null:objectsByNode.get(nodeIndex);
  if(bone)roles.set(bone,String(role).toLowerCase().replace(/[^a-z0-9]/g,""));
 }
 const legacyBones=extensions.VRM?.humanoid?.humanBones;
 if(Array.isArray(legacyBones))for(const definition of legacyBones as Array<{bone?:unknown;node?:unknown}>){
  const role=String(definition.bone??"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const nodeIndex=finiteIndex(definition.node),bone=nodeIndex===null?null:objectsByNode.get(nodeIndex);
  if(role&&bone&&!roles.has(bone))roles.set(bone,role);
 }
 return roles;
}
