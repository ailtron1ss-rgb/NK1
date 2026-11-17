import type { ActionKind } from '../core/types.ts';

export type CognitiveBridgeMode = 'reflex'|'shallow'|'retrieve'|'deep'|'simulate'|'defer'|'sleep';
export type CognitiveBridgeAction = ActionKind|'none';
export type CognitiveAdapterHint = 'fast'|'balanced'|'retrieval'|'deep'|'simulation'|'conservative';

const ACTIONS:readonly ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const MODES:readonly CognitiveBridgeMode[]=['reflex','shallow','retrieve','deep','simulate','defer','sleep'];
const TEMPERATURE_BY_MODE:Record<CognitiveBridgeMode,number>={
  reflex:.30,shallow:.52,retrieve:.43,deep:.65,simulate:.60,defer:.25,sleep:.22,
};
const TOKENS_BY_MODE:Record<CognitiveBridgeMode,number>={
  reflex:256,shallow:384,retrieve:512,deep:768,simulate:768,defer:128,sleep:128,
};
const ADAPTER_BY_MODE:Record<CognitiveBridgeMode,CognitiveAdapterHint>={
  reflex:'fast',shallow:'balanced',retrieve:'retrieval',deep:'deep',
  simulate:'simulation',defer:'conservative',sleep:'conservative',
};
const NEURAL_SNAPSHOT_MAX_AGE_TICKS=8;
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const safe01=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const safeTick=(value:unknown):number|null=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const isNormalizedSignal=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
function hasCompleteNeuralSnapshot(value:CognitiveNeuralBridgeNeuralInput|undefined):boolean {
  if(!value || !Number.isSafeInteger(value.version) || Number(value.version)<1) return false;
  const signals=[
    value.predictionError01,value.plasticity01,value.neuromodulation01,value.sparseActivity01,
    value.recurrentCoherence01,value.neuralConfidence01,value.modelAgreement01,
    value.counterfactualDivergence01,value.goalField01,value.actionEntropy01,
    value.allostatic?.drive01,value.allostatic?.arousal01,value.allostatic?.exploration01,
    value.allostatic?.preservation01,value.allostatic?.reflection01,value.allostatic?.socialApproach01,
    value.selfModel?.agency01,value.selfModel?.continuity01,value.selfModel?.growthReadiness01,
    value.selfModel?.identityConflict01,value.goalAuthorship?.ownership01,
    value.goalAuthorship?.commitment01,value.goalAuthorship?.revisionPressure01,
  ];
  return signals.every(isNormalizedSignal);
}
const isAction=(value:unknown):value is ActionKind=>typeof value==='string'&&ACTIONS.includes(value as ActionKind);
const isMode=(value:unknown):value is CognitiveBridgeMode=>typeof value==='string'&&MODES.includes(value as CognitiveBridgeMode);

export const COGNITIVE_NEURAL_FEATURE_KEYS=[
  'action.respond','action.explore','action.verify','action.rest','action.reflect','action.wait','action.defer',
  'organism.motivation01','organism.uncertainty01','organism.urgency01','organism.budgetRemaining01','organism.attention01',
  'neural.predictionError01','neural.plasticity01','neural.neuromodulation01','neural.sparseActivity01',
  'neural.recurrentCoherence01','neural.neuralConfidence01','neural.modelAgreement01','neural.counterfactualDivergence01',
  'neural.goalField01','neural.actionEntropy01',
  'allostatic.drive01','allostatic.arousal01','allostatic.exploration01','allostatic.preservation01',
  'allostatic.reflection01','allostatic.socialApproach01',
  'self.agency01','self.continuity01','self.growthReadiness01','self.identityConflict01',
  'goal.ownership01','goal.commitment01','goal.revisionPressure01',
  'neural.snapshotFreshness01',
  'mode.reflex','mode.shallow','mode.retrieve','mode.deep','mode.simulate','mode.defer','mode.sleep',
] as const;

export interface CognitiveNeuralBridgeNeuralInput {
  /** B365 diagnostic-state schema version; only versioned snapshots are trusted. */
  version?:unknown;
  tick?:unknown;
  predictionError01?:unknown;
  plasticity01?:unknown;
  neuromodulation01?:unknown;
  sparseActivity01?:unknown;
  recurrentCoherence01?:unknown;
  neuralConfidence01?:unknown;
  modelAgreement01?:unknown;
  counterfactualDivergence01?:unknown;
  goalField01?:unknown;
  actionEntropy01?:unknown;
  allostatic?:{
    drive01?:unknown; arousal01?:unknown; exploration01?:unknown;
    preservation01?:unknown; reflection01?:unknown; socialApproach01?:unknown;
  };
  selfModel?:{
    agency01?:unknown; continuity01?:unknown;
    growthReadiness01?:unknown; identityConflict01?:unknown;
  };
  goalAuthorship?:{ownership01?:unknown;commitment01?:unknown;revisionPressure01?:unknown};
}

export interface CognitiveToNeuralBridgeInput {
  tick?:unknown;
  action?:unknown;
  mode?:unknown;
  motivation01?:unknown;
  uncertainty01?:unknown;
  urgency01?:unknown;
  budgetRemaining01?:unknown;
  attention01?:unknown;
  /** Read-only subset of B365 diagnostics; missing or stale signals are marked unavailable. */
  neural?:CognitiveNeuralBridgeNeuralInput|null;
}

export interface CognitiveNeuralControlProfile {
  version:2;
  featureSchema:'nk1-cognitive-neural-43-v2';
  tick:number;
  action:CognitiveBridgeAction;
  mode:CognitiveBridgeMode;
  adapterHint:CognitiveAdapterHint;
  neuralSource:'b365-unified-neuro-causal-core'|'unavailable';
  neuralSnapshotAvailable:boolean;
  neuralSnapshotVersion:number|null;
  neuralSnapshotTick:number|null;
  neuralSnapshotAgeTicks:number|null;
  featureKeys:string[];
  featureVector01:number[];
  temperature:number;
  maxTokens:number;
  steeringIntent01:{
    curiosity01:number;
    caution01:number;
    persistence01:number;
    verification01:number;
  };
  controlsConfigured:{
    samplingParameters:true;
    adapterSelection:false;
    activationSteering:false;
    residualBlock:false;
  };
}

/**
 * Projects organism goals, allostatic state, self-model and B365 neural diagnostics
 * into a deterministic 43-channel control vector. It is read-only: no neural
 * weights, activations, synapses or learning state are changed by projection.
 */
export class CognitiveToNeuralBridge {
  project(input:CognitiveToNeuralBridgeInput={}):CognitiveNeuralControlProfile {
    const action:CognitiveBridgeAction=isAction(input.action)?input.action:'none';
    const mode:CognitiveBridgeMode=isMode(input.mode)?input.mode:'shallow';
    const currentTick=safeTick(input.tick);
    const tick=currentTick??0;
    const motivation01=safe01(input.motivation01,0);
    const uncertainty01=safe01(input.uncertainty01,.5);
    const urgency01=safe01(input.urgency01,0);
    const budgetRemaining01=safe01(input.budgetRemaining01,.5);
    const attention01=safe01(input.attention01,.5);

    const candidateNeural=input.neural??undefined;
    const candidateNeuralTick=safeTick(candidateNeural?.tick);
    const ageTicks=candidateNeuralTick===null?null:tick-candidateNeuralTick;
    const neuralSnapshotAvailable=currentTick!==null&&ageTicks!==null&&ageTicks>=0
      &&ageTicks<=NEURAL_SNAPSHOT_MAX_AGE_TICKS&&hasCompleteNeuralSnapshot(candidateNeural);
    const neural=neuralSnapshotAvailable?candidateNeural:undefined;
    const neuralSnapshotVersion=neuralSnapshotAvailable?Number(candidateNeural?.version):null;
    const neuralSnapshotTick=neuralSnapshotAvailable?candidateNeuralTick:null;
    const neuralSnapshotAgeTicks=neuralSnapshotAvailable?ageTicks:null;
    const neuralSnapshotFreshness01=neuralSnapshotAvailable
      ? clamp(1-(ageTicks??0)/NEURAL_SNAPSHOT_MAX_AGE_TICKS)
      : 0;

    const neuralPredictionError01=safe01(neural?.predictionError01,.5);
    const plasticity01=safe01(neural?.plasticity01,.5);
    const neuromodulation01=safe01(neural?.neuromodulation01,.5);
    const sparseActivity01=safe01(neural?.sparseActivity01,.5);
    const recurrentCoherence01=safe01(neural?.recurrentCoherence01,.5);
    const neuralConfidence01=safe01(neural?.neuralConfidence01,.5);
    const modelAgreement01=safe01(neural?.modelAgreement01,.5);
    const counterfactualDivergence01=safe01(neural?.counterfactualDivergence01,.5);
    const goalField01=safe01(neural?.goalField01,.5);
    const actionEntropy01=safe01(neural?.actionEntropy01,.5);
    const drive01=safe01(neural?.allostatic?.drive01,.5);
    const arousal01=safe01(neural?.allostatic?.arousal01,.5);
    const exploration01=safe01(neural?.allostatic?.exploration01,.5);
    const preservation01=safe01(neural?.allostatic?.preservation01,.5);
    const reflection01=safe01(neural?.allostatic?.reflection01,.5);
    const socialApproach01=safe01(neural?.allostatic?.socialApproach01,.5);
    const selfAgency01=safe01(neural?.selfModel?.agency01,.5);
    const selfContinuity01=safe01(neural?.selfModel?.continuity01,.5);
    const selfGrowthReadiness01=safe01(neural?.selfModel?.growthReadiness01,.5);
    const selfIdentityConflict01=safe01(neural?.selfModel?.identityConflict01,.5);
    const goalOwnership01=safe01(neural?.goalAuthorship?.ownership01,.5);
    const goalCommitment01=safe01(neural?.goalAuthorship?.commitment01,.5);
    const goalRevisionPressure01=safe01(neural?.goalAuthorship?.revisionPressure01,.5);

    const actionFeatures=ACTIONS.map(candidate=>candidate===action?1:0);
    const modeFeatures=MODES.map(candidate=>candidate===mode?1:0);
    const neuralFeatures=[
      neuralPredictionError01,plasticity01,neuromodulation01,sparseActivity01,
      recurrentCoherence01,neuralConfidence01,modelAgreement01,counterfactualDivergence01,
      goalField01,actionEntropy01,
      drive01,arousal01,exploration01,preservation01,reflection01,socialApproach01,
      selfAgency01,selfContinuity01,selfGrowthReadiness01,selfIdentityConflict01,
      goalOwnership01,goalCommitment01,goalRevisionPressure01,
    ];
    const featureVector01=[
      ...actionFeatures,
      motivation01,uncertainty01,urgency01,budgetRemaining01,attention01,
      ...neuralFeatures,
      neuralSnapshotFreshness01,
      ...modeFeatures,
    ];
    const neuralCaution01=Math.max(
      uncertainty01,neuralPredictionError01,counterfactualDivergence01,
      selfIdentityConflict01,1-modelAgreement01,
    );
    const temperature=Number(clamp(
      TEMPERATURE_BY_MODE[mode]+motivation01*.06+exploration01*.03
        -uncertainty01*.12-neuralPredictionError01*.06-neuralCaution01*.04,
      .2,.85,
    ).toFixed(3));
    const budgetFactor=.4+budgetRemaining01*.6;
    const preservationFactor=1-preservation01*.35;
    const maxTokens=Math.max(96,Math.min(768,
      Math.round((TOKENS_BY_MODE[mode]*budgetFactor*preservationFactor)/16)*16,
    ));
    const steeringIntent01={
      curiosity01:clamp(Math.max(motivation01,exploration01)*(1-uncertainty01)*(.6+.4*selfGrowthReadiness01)*.15,0,.15),
      caution01:clamp(neuralCaution01*.15,0,.15),
      persistence01:clamp(Math.max(motivation01,goalCommitment01)*(.55+.45*selfContinuity01)*.15,0,.15),
      verification01:clamp(Math.max(uncertainty01,neuralPredictionError01,counterfactualDivergence01,1-modelAgreement01)*.15,0,.15),
    };
    return {
      version:2,
      featureSchema:'nk1-cognitive-neural-43-v2',
      tick,action,mode,adapterHint:ADAPTER_BY_MODE[mode],
      neuralSource:neuralSnapshotAvailable?'b365-unified-neuro-causal-core':'unavailable',
      neuralSnapshotAvailable,neuralSnapshotVersion,neuralSnapshotTick,neuralSnapshotAgeTicks,
      featureKeys:[...COGNITIVE_NEURAL_FEATURE_KEYS],
      featureVector01,temperature,maxTokens,steeringIntent01,
      controlsConfigured:{
        samplingParameters:true,
        adapterSelection:false,
        activationSteering:false,
        residualBlock:false,
      },
    };
  }
}

/**
 * Validate the complete v2 hand-off contract before a provider forwards it.
 * This catches internally inconsistent profiles (not just malformed numbers):
 * action/mode one-hots, adapter hint, B365 provenance, tick age and freshness
 * must all agree. Missing/partial neural snapshots must remain explicitly neutral.
 */
export function isValidCognitiveNeuralControlProfile(value:unknown):value is CognitiveNeuralControlProfile {
  if(!value || typeof value!=='object' || Array.isArray(value)) return false;
  const profile=value as Partial<CognitiveNeuralControlProfile>;
  const vector=profile.featureVector01;
  const keys=profile.featureKeys;
  const steering=profile.steeringIntent01;
  if(profile.version!==2 || profile.featureSchema!=='nk1-cognitive-neural-43-v2'
    || !Number.isSafeInteger(profile.tick) || Number(profile.tick)<0
    || !(profile.action==='none' || isAction(profile.action))
    || !isMode(profile.mode) || profile.adapterHint!==ADAPTER_BY_MODE[profile.mode]
    || !Array.isArray(keys) || keys.length!==COGNITIVE_NEURAL_FEATURE_KEYS.length
    || keys.some((key,index)=>key!==COGNITIVE_NEURAL_FEATURE_KEYS[index])
    || !Array.isArray(vector) || vector.length!==COGNITIVE_NEURAL_FEATURE_KEYS.length
    || vector.some(entry=>!isNormalizedSignal(entry))
    || typeof profile.temperature!=='number' || !Number.isFinite(profile.temperature)
    || profile.temperature<.2 || profile.temperature>.85
    || !Number.isSafeInteger(profile.maxTokens) || Number(profile.maxTokens)<96
    || Number(profile.maxTokens)>768 || Number(profile.maxTokens)%16!==0
    || !steering
    || !isNormalizedSignal(steering.curiosity01) || steering.curiosity01>.15
    || !isNormalizedSignal(steering.caution01) || steering.caution01>.15
    || !isNormalizedSignal(steering.persistence01) || steering.persistence01>.15
    || !isNormalizedSignal(steering.verification01) || steering.verification01>.15
    || profile.controlsConfigured?.samplingParameters!==true
    || profile.controlsConfigured?.adapterSelection!==false
    || profile.controlsConfigured?.activationSteering!==false
    || profile.controlsConfigured?.residualBlock!==false) return false;

  const actionsMatch=ACTIONS.every((action,index)=>vector[index]===(profile.action===action?1:0));
  const modeOffset=36;
  const modesMatch=MODES.every((mode,index)=>vector[modeOffset+index]===(profile.mode===mode?1:0));
  if(!actionsMatch || !modesMatch) return false;

  if(profile.neuralSnapshotAvailable===true){
    const snapshotTick=safeTick(profile.neuralSnapshotTick);
    const snapshotVersion=profile.neuralSnapshotVersion;
    const age=profile.neuralSnapshotAgeTicks;
    if(profile.neuralSource!=='b365-unified-neuro-causal-core'
      || snapshotTick===null || !Number.isSafeInteger(snapshotVersion) || Number(snapshotVersion)<1
      || !Number.isSafeInteger(age) || Number(age)<0 || Number(age)>NEURAL_SNAPSHOT_MAX_AGE_TICKS
      || Number(profile.tick)-snapshotTick!==Number(age)) return false;
    const expectedFreshness=clamp(1-Number(age)/NEURAL_SNAPSHOT_MAX_AGE_TICKS);
    if(Math.abs(Number(vector[35])-expectedFreshness)>1e-9) return false;
  } else if(profile.neuralSnapshotAvailable===false){
    if(profile.neuralSource!=='unavailable' || profile.neuralSnapshotVersion!==null
      || profile.neuralSnapshotTick!==null || profile.neuralSnapshotAgeTicks!==null
      || vector[35]!==0 || vector.slice(12,35).some(entry=>entry!==.5)) return false;
  } else {
    return false;
  }
  return true;
}

/** Apply only the provider contract's supported, bounded sampling parameters. */
export function applyCognitiveNeuralControl<T extends {temperature?:number;maxTokens?:number}>(
  request:T,
  profile:CognitiveNeuralControlProfile,
):T&{temperature:number;maxTokens:number;cognitiveControl:CognitiveNeuralControlProfile}{
  const temperature=clamp(profile.temperature,.2,.85);
  const maxTokens=Math.round(clamp(profile.maxTokens,1,768));
  return {
    ...request,
    temperature,
    maxTokens,
    cognitiveControl:structuredClone(profile),
  };
}

/** Emergency bypass preserves the original request object and performs no projection. */
export function prepareCognitiveNeuralRequest<T extends {temperature?:number;maxTokens?:number}>(
  request:T,
  bridge:CognitiveToNeuralBridge,
  input:CognitiveToNeuralBridgeInput,
  enabled=true,
):{request:T;profile:null;bypassed:true}|{
  request:T&{temperature:number;maxTokens:number;cognitiveControl:CognitiveNeuralControlProfile};
  profile:CognitiveNeuralControlProfile;
  bypassed:false;
}{
  if(!enabled) return {request,profile:null,bypassed:true};
  const profile=bridge.project(input);
  return {request:applyCognitiveNeuralControl(request,profile),profile,bypassed:false};
}
