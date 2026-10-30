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

export interface SemanticMorphBinding { influences: number[]; index: number; channel: SemanticMorphChannel; baseInfluence: number; }
/**
 * Apply the shared expression snapshot without erasing stronger authored animation.
 * Blendshape clips run first; the semantic layer only raises a channel to its requested
 * floor. This keeps imported animation clips and NK1 affect/viseme intent composable.
 */
export function applySemanticMorphTargets(bindings:SemanticMorphBinding[],values:Record<SemanticMorphChannel,number>):void {
 for(const binding of bindings){
  const current=binding.influences[binding.index];
  if(!Number.isFinite(current))continue;
  const requested=Number.isFinite(values[binding.channel])?Math.max(0,Math.min(1,values[binding.channel])):0;
  binding.influences[binding.index]=Math.max(current,requested);
 }
}
