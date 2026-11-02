import type { OrganismState } from '../core/types.ts';
import type { OrganismBodyState } from './EmbodiedBody.ts';

export type AvatarRenderProfile = '2d' | '2.5d' | '3d';
export type AvatarExpression = 'neutral' | 'curious' | 'focused' | 'amused' | 'concerned' | 'tired' | 'determined';
export interface AvatarAffectInput {
  valence01?: number; arousal01?: number; dominance01?: number;
  curiosity01?: number; warmth01?: number; stress01?: number; confidence01?: number;
  /** Bounded salience of currently retrieved memories; never includes text or IDs. */
  memoryRecall01?: number;
  sampledAt?: number;
}
export interface AvatarPersonalityVector {
  /** Canonical P2702 adaptive trait names and values; identifiers are not copied into the renderer output. */
  adaptiveNames: readonly string[];
  adaptiveValues: readonly number[];
}
export interface AvatarBrainProjectionInput {
  state: Pick<OrganismState, 'needs' | 'predictionError' | 'lastActionSuccess' | 'lastPredictionConfidence' | 'autonomyScore'>;
  body?: Pick<OrganismBodyState, 'awake' | 'bodyEnergy01' | 'thermalStrain01' | 'cognitiveCapacity01'>;
  /** Explicit organism sleep state when the app snapshot has no full body telemetry. */
  awake?: boolean;
  affect?: AvatarAffectInput; personality?: AvatarPersonalityVector; previous?: AvatarBrainProjection; now?: number; profile?: AvatarRenderProfile;
}
export interface AvatarBlendshapeChannels {
  eyeOpen:number; browRaise:number; browFurrow:number; mouthSmile:number; mouthOpen:number;
  cheekRaise:number; headTilt:number; headYaw:number; gazeX:number; gazeY:number;
  idleMotion:number; lipSyncGain:number;
}
export interface AvatarBrainProjection {
  schemaVersion:1; profile:AvatarRenderProfile; expression:AvatarExpression; expressionWeight:number;
  affect:{valence01:number;arousal01:number;dominance01:number;curiosity01:number;warmth01:number;stress01:number;confidence01:number;memoryRecall01:number};
  channels:AvatarBlendshapeChannels; freshness01:number; reducedMotion:boolean; source:'organism-state';
  rendererHints:{
    live2d:Record<string,number>;
    layered2d:{parallax01:number;depthBreath01:number;faceRig01:number};
    spatial3d:{headPitch:number;headYaw:number;gazeDistance01:number;shoulderRelax01:number};
  };
  projectedAt:number;
}
const clamp=(v:unknown,f=0):number=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):f;
const signed=(v:number)=>Math.max(-1,Math.min(1,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
type Affect=AvatarBrainProjection['affect'];
function derive(input:AvatarBrainProjectionInput,now:number):Affect {
  const n=input.state.needs, b=input.body, raw=input.affect??{};
  const trait=(name:string,fallback:number)=>{
    const names=input.personality?.adaptiveNames, values=input.personality?.adaptiveValues;
    if(!names||!values||names.length!==values.length)return fallback;
    const index=names.indexOf(name);
    return index<0?fallback:clamp(values[index],fallback);
  };
  const freshness=raw.sampledAt==null?1:clamp(1-Math.max(0,now-raw.sampledAt)/30000);
  const load=clamp(n.cognitiveLoad), uncertainty=clamp(n.uncertainty);
  const social=clamp(n.socialNeed), novelty=clamp(n.novelty), coherence=clamp(n.identityCoherence);
  const error=clamp(input.state.predictionError), bodyStress=b?clamp(b.thermalStrain01):0;
  const confidence=clamp(raw.confidence01,clamp(input.state.lastPredictionConfidence,.5));
  const memoryRecall=clamp(raw.memoryRecall01);
  const arousal=clamp(raw.arousal01,clamp(.18+load*.3+novelty*.25+error*.25+bodyStress*.2));
  const baseValence=clamp(.5+(clamp(input.state.lastActionSuccess,.5)-.5)*.5-uncertainty*.12-bodyStress*.12);
  const valence=clamp(raw.valence01,baseValence);
  const stress=clamp(raw.stress01,clamp(load*.42+uncertainty*.24+error*.22+bodyStress*.3));
  const warmth=clamp(raw.warmth01,clamp(.18+social*.32+trait('warmth',.5)*.34+Math.max(0,valence)*.15));
  const curiosity=clamp(raw.curiosity01,clamp(novelty*.4+trait('curiosity',.5)*.35+uncertainty*.12+(1-load)*.13));
  const dominance=clamp(raw.dominance01,clamp(.2+coherence*.35+confidence*.25+clamp(input.state.autonomyScore)*.2));
  return {
    valence01:lerp(.5,valence,freshness), arousal01:lerp(.25,arousal,freshness),
    dominance01:lerp(.5,dominance,freshness), curiosity01:lerp(.2,curiosity,freshness),
    warmth01:lerp(.35,warmth,freshness), stress01:lerp(.1,stress,freshness),
    confidence01:lerp(.5,confidence,freshness),
    memoryRecall01:lerp(0,memoryRecall,freshness),
  };
}
function expressionWeight(a:Affect,label:AvatarExpression):number {
  switch(label){
    case 'neutral': return 0;
    case 'curious': return clamp((a.curiosity01-.55)/.45);
    case 'focused': return clamp((a.stress01-.36)/.5);
    case 'amused': return clamp((a.valence01-.52)/.42)*clamp(.35+a.warmth01*.75);
    case 'concerned': return clamp((a.stress01-.58)/.42);
    case 'tired': return clamp((.34-a.arousal01)/.34);
    case 'determined': return clamp((a.confidence01-.55)/.45)*clamp(.35+a.dominance01*.7);
  }
}
function expression(a:Affect,previous?:AvatarExpression):AvatarExpression {
  const v=a.valence01, ar=a.arousal01, c=a.curiosity01, s=a.stress01, conf=a.confidence01, w=a.warmth01;
  const candidate:AvatarExpression=s>.72?'concerned':ar<.2?'tired':c>.68&&ar>.34?'curious':s>.48?'focused':v>.62&&w>.58?'amused':conf>.72&&a.dominance01>.58?'determined':'neutral';
  if(!previous||previous===candidate)return candidate;
  const m=.06;
  if(previous==='concerned'&&s>.72-m)return previous;
  if(previous==='curious'&&c>.68-m&&ar>.34-m)return previous;
  if(previous==='tired'&&ar<.2+m)return previous;
  if(previous==='focused'&&s>.48-m&&s<=.72+m)return previous;
  if(previous==='amused'&&v>.62-m&&w>.58-m)return previous;
  if(previous==='determined'&&conf>.72-m&&a.dominance01>.58-m)return previous;
  return candidate;
}
/** Pure, bounded projection. Cognition owns affect; this adapter only renders it. */
export function projectAvatarBrainState(input:AvatarBrainProjectionInput):AvatarBrainProjection {
  const now=Number.isFinite(input.now)?Number(input.now):Date.now(), profile=input.profile??'2d';
  const target=derive(input,now), prev=input.previous;
  const dt=prev?Math.max(0,Math.min(5000,now-prev.projectedAt)):1000;
  const alpha=prev?1-Math.exp(-dt/420):1;
  const affect=prev?Object.fromEntries(Object.keys(target).map(k=>[k,lerp(prev.affect[k as keyof Affect],target[k as keyof Affect],alpha)])) as Affect:target;
  const bodyEnergy=clamp(input.body?.bodyEnergy01,clamp(input.state.needs.energy)), awake=input.awake??input.body?.awake??true;
  const trait=(name:string,fallback:number)=>{
    const names=input.personality?.adaptiveNames, values=input.personality?.adaptiveValues;
    if(!names||!values||names.length!==values.length)return fallback;
    const index=names.indexOf(name);
    return index<0?fallback:clamp(values[index],fallback);
  };
  const composure=trait('composure',.5), playfulness=trait('playfulness',.5), directness=trait('directness',.5);
  const channels:AvatarBlendshapeChannels={
    eyeOpen:clamp(.68+affect.arousal01*.22-affect.stress01*.18-(1-bodyEnergy)*.12),
    browRaise:clamp(affect.curiosity01*.68+affect.arousal01*.12+affect.memoryRecall01*.06),
    browFurrow:clamp(affect.stress01*(.48+(.5-composure)*.2)+(1-affect.valence01)*.12),
    mouthSmile:clamp(affect.warmth01*.4+playfulness*.12+Math.max(0,affect.valence01-.5)*.65),
    mouthOpen:clamp(affect.arousal01*.16),
    cheekRaise:clamp(affect.warmth01*.42+Math.max(0,affect.valence01-.55)*.3),
    headTilt:signed((affect.curiosity01-.35)*.24-affect.stress01*.08),
    headYaw:signed((affect.dominance01-.5)*.16),
    gazeX:signed((affect.curiosity01-.5)*(.45+directness*.35)), gazeY:signed((.5-affect.arousal01)*.28),
    idleMotion:awake?clamp(.08+affect.arousal01*.4+affect.curiosity01*.16+playfulness*.12):0,
    lipSyncGain:awake?clamp(.65+bodyEnergy*.25-affect.stress01*.18):0,
  };
  const reducedMotion=!awake||bodyEnergy<.12||(input.body?.thermalStrain01??0)>.88;
  if(reducedMotion){channels.idleMotion=0;channels.headTilt*=.35;channels.headYaw*=.35;channels.lipSyncGain=0;}
  const live2d={
    ParamEyeLOpen:channels.eyeOpen,ParamEyeROpen:channels.eyeOpen,
    ParamEyeBallX:channels.gazeX,ParamEyeBallY:channels.gazeY,
    ParamBrowLY:channels.browRaise-channels.browFurrow,ParamBrowRY:channels.browRaise-channels.browFurrow,
    ParamMouthForm:signed(channels.mouthSmile*2-1),ParamMouthOpenY:channels.mouthOpen,
    ParamAngleX:channels.headYaw*30,ParamAngleY:channels.headTilt*24,ParamAngleZ:channels.headTilt*18,
  };
  return {
    schemaVersion:1,profile,expression:expression(affect,prev?.expression),expressionWeight:expressionWeight(affect,expression(affect,prev?.expression)),affect,channels,
    freshness01:input.affect?.sampledAt==null?1:clamp(1-Math.max(0,now-input.affect.sampledAt)/30000),
    reducedMotion,source:'organism-state',
    rendererHints:{
      live2d,
      layered2d:{parallax01:profile==='2.5d'?clamp(Math.abs(channels.headYaw)*1.8):0,depthBreath01:profile==='2.5d'?channels.idleMotion*.12:0,faceRig01:clamp((channels.eyeOpen+channels.mouthSmile+channels.browRaise)/3)},
      spatial3d:{headPitch:channels.headTilt*.22,headYaw:channels.headYaw*.3,gazeDistance01:clamp(.45+affect.dominance01*.25),shoulderRelax01:clamp(1-affect.stress01)},
    },
    projectedAt:now,
  };
}
