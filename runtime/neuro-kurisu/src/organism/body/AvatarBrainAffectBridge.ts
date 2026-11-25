import type { OrganismState } from '../core/types.ts';
import type { OrganismBodyState } from './EmbodiedBody.ts';

export type AvatarRenderProfile = '2d' | '2.5d' | '3d';
export type AvatarExpression = 'neutral' | 'curious' | 'focused' | 'amused' | 'concerned' | 'tired' | 'determined';

export interface AvatarAffectInput {
  valence01?: number;
  arousal01?: number;
  dominance01?: number;
  curiosity01?: number;
  warmth01?: number;
  stress01?: number;
  confidence01?: number;
  /** Bounded salience only; memory text and identifiers never cross this boundary. */
  memoryRecall01?: number;
  sampledAt?: number;
  stateVersion?:number;episodeId?:string|null;freshness01?:number;
  moodValence01?:number;moodArousal01?:number;moodStress01?:number;moodSocialSafety01?:number;moodSampledAt?:number;moodFreshness01?:number;
}

export interface AvatarPersonalityVector {
  /** Trait names and their bounded values from the canonical adaptive personality model. */
  adaptiveNames: readonly string[];
  adaptiveValues: readonly number[];
}

export interface AvatarBrainProjectionInput {
  state: Pick<OrganismState, 'tick' | 'needs' | 'predictionError' | 'lastActionSuccess' | 'lastPredictionConfidence' | 'autonomyScore'>;
  body?: Pick<OrganismBodyState, 'awake' | 'bodyEnergy01' | 'thermalStrain01' | 'cognitiveCapacity01'>;
  awake?: boolean;
  affect?: AvatarAffectInput;
  personality?: AvatarPersonalityVector;
  previous?: AvatarBrainProjection;
  now?: number;
  profile?: AvatarRenderProfile;
}

export interface AvatarBlendshapeChannels {
  eyeOpen:number;
  browRaise:number;
  browFurrow:number;
  mouthSmile:number;
  mouthOpen:number;
  cheekRaise:number;
  headTilt:number;
  headYaw:number;
  gazeX:number;
  gazeY:number;
  idleMotion:number;
  lipSyncGain:number;
}

export interface AvatarBrainProjection {
  schemaVersion:1;
  stateVersion:number;affectEpisodeId:string|null;
  profile:AvatarRenderProfile;
  expression:AvatarExpression;
  expressionWeight:number;
  affect:{
    valence01:number;
    arousal01:number;
    dominance01:number;
    curiosity01:number;
    warmth01:number;
    stress01:number;
    confidence01:number;
    memoryRecall01:number;
  };
  channels:AvatarBlendshapeChannels;
  freshness01:number;
  reducedMotion:boolean;
  source:'organism-state';
  rendererHints:{
    live2d:Record<string,number>;
    layered2d:{parallax01:number;depthBreath01:number;faceRig01:number};
    spatial3d:{headPitch:number;headYaw:number;gazeDistance01:number;shoulderRelax01:number};
  };
  projectedAt:number;
}

const clamp=(value:unknown,fallback=0):number =>
  typeof value==='number' && Number.isFinite(value)
    ? Math.max(0,Math.min(1,value))
    : fallback;
const signed=(value:number)=>Math.max(-1,Math.min(1,value));
const lerp=(from:number,to:number,weight:number)=>from+(to-from)*weight;
type Affect=AvatarBrainProjection['affect'];
function currentAffect(input:AvatarBrainProjectionInput,now:number):boolean{
  const raw=input.affect,age=typeof raw?.sampledAt==='number'?now-raw.sampledAt:Infinity;
  const revision=Number.isSafeInteger(raw?.stateVersion)&&Number(raw.stateVersion)===input.state.tick;
  const freshness=typeof raw?.freshness01==='number'&&Number.isFinite(raw.freshness01)&&raw.freshness01>=0&&raw.freshness01<=1;
  const expected=Number.isFinite(age)?Math.max(0,1-Math.max(0,age)/30_000):0;
  return Boolean(revision&&freshness&&Math.abs(Number(raw?.freshness01)-expected)<=.1&&age>=-250&&age<=30_000);
}
function currentMood(input:AvatarBrainProjectionInput,now:number):boolean{
  const r=input.affect;if(!r||!Number.isFinite(r.moodSampledAt)||!Number.isFinite(r.moodFreshness01))return false;
  const age=now-Number(r.moodSampledAt);if(age< -250||age>7*24*60*60_000)return false;
  for(const v of [r.moodValence01,r.moodArousal01,r.moodStress01,r.moodSocialSafety01])if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)return false;
  return Math.abs(Number(r.moodFreshness01)-Math.exp(-Math.max(0,age)/(24*60*60_000)))<=.08;
}

function adaptiveTrait(input:AvatarBrainProjectionInput,name:string,fallback:number):number {
  const names=input.personality?.adaptiveNames;
  const values=input.personality?.adaptiveValues;
  if(!names || !values || names.length!==values.length) return fallback;
  const index=names.indexOf(name);
  return index<0 ? fallback : clamp(values[index],fallback);
}

function deriveAffect(input:AvatarBrainProjectionInput,now:number):Affect {
  const needs=input.state.needs;
  const body=input.body;
  const raw=input.affect??{};
  const hasRevision=Number.isSafeInteger(raw.stateVersion);
  const canonical=hasRevision&&currentAffect(input,now);
  const freshness=hasRevision?(canonical?clamp(raw.freshness01):0):raw.sampledAt==null?1:clamp(1-Math.max(0,now-raw.sampledAt)/30_000);
  const primaryFreshness=canonical?1:freshness;
  const moodActive=canonical&&currentMood(input,now),moodWeight=moodActive?clamp(raw.moodFreshness01)*.16:0;
  const load=clamp(needs.cognitiveLoad);
  const uncertainty=clamp(needs.uncertainty);
  const social=clamp(needs.socialNeed);
  const novelty=clamp(needs.novelty);
  const coherence=clamp(needs.identityCoherence);
  const error=clamp(input.state.predictionError);
  const bodyStress=body ? clamp(body.thermalStrain01) : 0;
  const confidence=clamp(raw.confidence01,clamp(input.state.lastPredictionConfidence,.5));
  const memoryRecall=clamp(raw.memoryRecall01);
  const acuteArousal=clamp(raw.arousal01,clamp(.18+load*.3+novelty*.25+error*.25+bodyStress*.2));
  const acuteValence=clamp(raw.valence01,clamp(.5+(clamp(input.state.lastActionSuccess,.5)-.5)*.5-uncertainty*.12-bodyStress*.12));
  const acuteStress=clamp(raw.stress01,clamp(load*.42+uncertainty*.24+error*.22+bodyStress*.3));
  const arousal=lerp(acuteArousal,moodActive?clamp(raw.moodArousal01):acuteArousal,moodWeight*.65);
  const valence=lerp(acuteValence,moodActive?clamp(raw.moodValence01):acuteValence,moodWeight);
  const stress=lerp(acuteStress,moodActive?clamp(raw.moodStress01):acuteStress,moodWeight*.7);
  const acuteWarmth=clamp(raw.warmth01,clamp(.18+social*.32+adaptiveTrait(input,'warmth',.5)*.34+Math.max(0,valence)*.15));
  const warmth=lerp(acuteWarmth,moodActive?clamp(.2+Number(raw.moodSocialSafety01)*.6):acuteWarmth,moodWeight*.55);
  const curiosity=clamp(raw.curiosity01,clamp(novelty*.4+adaptiveTrait(input,'curiosity',.5)*.35+uncertainty*.12+(1-load)*.13));
  const dominance=clamp(raw.dominance01,clamp(.2+coherence*.35+confidence*.25+clamp(input.state.autonomyScore)*.2));
  return {
    valence01:lerp(.5,valence,primaryFreshness),
    arousal01:lerp(.22,arousal,primaryFreshness),
    dominance01:lerp(.5,dominance,primaryFreshness),
    curiosity01:lerp(.2,curiosity,freshness),
    warmth01:lerp(.35,warmth,freshness),
    stress01:lerp(.1,stress,primaryFreshness),
    confidence01:lerp(.5,confidence,primaryFreshness),
    memoryRecall01:lerp(0,memoryRecall,freshness),
  };
}

function expressionWeight(affect:Affect,label:AvatarExpression):number {
  switch(label) {
    case 'neutral': return 0;
    case 'curious': return clamp((affect.curiosity01-.55)/.45);
    case 'focused': return clamp((affect.stress01-.36)/.5);
    case 'amused': return clamp((affect.valence01-.52)/.42)*clamp(.35+affect.warmth01*.75);
    case 'concerned': return clamp((affect.stress01-.58)/.42);
    case 'tired': return clamp((.34-affect.arousal01)/.34);
    case 'determined': return clamp((affect.confidence01-.55)/.45)*clamp(.35+affect.dominance01*.7);
  }
}

function chooseExpression(affect:Affect,previous?:AvatarExpression):AvatarExpression {
  const valence=affect.valence01;
  const arousal=affect.arousal01;
  const curiosity=affect.curiosity01;
  const stress=affect.stress01;
  const confidence=affect.confidence01;
  const warmth=affect.warmth01;
  const candidate:AvatarExpression =
    stress>.72 ? 'concerned' :
    arousal<.2 ? 'tired' :
    curiosity>.68 && arousal>.34 ? 'curious' :
    stress>.48 ? 'focused' :
    valence>.62 && warmth>.58 ? 'amused' :
    confidence>.72 && affect.dominance01>.58 ? 'determined' :
    'neutral';
  if(!previous || previous===candidate) return candidate;
  const margin=.06;
  if(previous==='concerned' && stress>.72-margin) return previous;
  if(previous==='curious' && curiosity>.68-margin && arousal>.34-margin) return previous;
  if(previous==='tired' && arousal<.2+margin) return previous;
  if(previous==='focused' && stress>.48-margin && stress<=.72+margin) return previous;
  if(previous==='amused' && valence>.62-margin && warmth>.58-margin) return previous;
  if(previous==='determined' && confidence>.72-margin && affect.dominance01>.58-margin) return previous;
  return candidate;
}

/** Pure, bounded projection. Cognition owns affect; this adapter only renders it. */
export function projectAvatarBrainState(input:AvatarBrainProjectionInput):AvatarBrainProjection {
  const now=Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const profile=input.profile??'2d';
  const target=deriveAffect(input,now);
  const canonicalRevision=Number.isSafeInteger(input.affect?.stateVersion);
  const canonical=currentAffect(input,now);
  const previous=canonicalRevision&&!canonical?undefined:input.previous;
  const deltaMs=previous ? Math.max(0,Math.min(5000,now-previous.projectedAt)) : 1000;
  const smoothing=previous ? 1-Math.exp(-deltaMs/420) : 1;
  const affect=previous
    ? Object.fromEntries(Object.keys(target).map(key=>[
        key,
        lerp(previous.affect[key as keyof Affect],target[key as keyof Affect],smoothing),
      ])) as Affect
    : target;
  const bodyEnergy=clamp(input.body?.bodyEnergy01,clamp(input.state.needs.energy));
  const awake=input.awake??input.body?.awake??true;
  const composure=adaptiveTrait(input,'composure',.5);
  const playfulness=adaptiveTrait(input,'playfulness',.5);
  const directness=adaptiveTrait(input,'directness',.5);
  const expression=chooseExpression(affect,previous?.expression);
  const channels:AvatarBlendshapeChannels={
    eyeOpen:clamp(.68+affect.arousal01*.22-affect.stress01*.18-(1-bodyEnergy)*.12),
    browRaise:clamp(affect.curiosity01*.68+affect.arousal01*.12+affect.memoryRecall01*.06),
    browFurrow:clamp(affect.stress01*(.48+(.5-composure)*.2)+(1-affect.valence01)*.12),
    mouthSmile:clamp(affect.warmth01*.4+playfulness*.12+Math.max(0,affect.valence01-.5)*.65),
    mouthOpen:clamp(affect.arousal01*.16),
    cheekRaise:clamp(affect.warmth01*.42+Math.max(0,affect.valence01-.55)*.3),
    headTilt:signed((affect.curiosity01-.35)*.24-affect.stress01*.08),
    headYaw:signed((affect.dominance01-.5)*.16),
    gazeX:signed((affect.curiosity01-.5)*(.45+directness*.35)),
    gazeY:signed((.5-affect.arousal01)*.28),
    idleMotion:awake?clamp(.08+affect.arousal01*.4+affect.curiosity01*.16+playfulness*.12):0,
    lipSyncGain:awake?clamp(.65+bodyEnergy*.25-affect.stress01*.18):0,
  };
  const reducedMotion=!awake || bodyEnergy<.12 || (input.body?.thermalStrain01??0)>.88;
  if(reducedMotion) {
    channels.idleMotion=0;
    channels.headTilt*=.35;
    channels.headYaw*=.35;
    channels.lipSyncGain=0;
  }
  const live2d={
    ParamEyeLOpen:channels.eyeOpen,
    ParamEyeROpen:channels.eyeOpen,
    ParamEyeBallX:channels.gazeX,
    ParamEyeBallY:channels.gazeY,
    ParamBrowLY:channels.browRaise-channels.browFurrow,
    ParamBrowRY:channels.browRaise-channels.browFurrow,
    ParamMouthForm:signed(channels.mouthSmile*2-1),
    ParamMouthOpenY:channels.mouthOpen,
    ParamAngleX:channels.headYaw*30,
    ParamAngleY:channels.headTilt*24,
    ParamAngleZ:channels.headTilt*18,
  };
  return {
    schemaVersion:1,
    stateVersion:Number.isSafeInteger(input.state.tick)&&input.state.tick>=0?input.state.tick:0,
    affectEpisodeId:canonical&&typeof input.affect?.episodeId==='string'&&input.affect.episodeId.length<=256?input.affect.episodeId:null,
    profile,
    expression,
    expressionWeight:expressionWeight(affect,expression),
    affect,
    channels,
    freshness01:canonical?clamp(input.affect?.freshness01):canonicalRevision?0:input.affect?.sampledAt==null?1:clamp(1-Math.max(0,now-input.affect.sampledAt)/30_000),
    reducedMotion,
    source:'organism-state',
    rendererHints:{
      live2d,
      layered2d:{
        parallax01:profile==='2.5d'?clamp(Math.abs(channels.headYaw)*1.8):0,
        depthBreath01:profile==='2.5d'?channels.idleMotion*.12:0,
        faceRig01:clamp((channels.eyeOpen+channels.mouthSmile+channels.browRaise)/3),
      },
      spatial3d:{
        headPitch:channels.headTilt*.22,
        headYaw:channels.headYaw*.3,
        gazeDistance01:clamp(.45+affect.dominance01*.25),
        shoulderRelax01:clamp(1-affect.stress01),
      },
    },
    projectedAt:now,
  };
}
