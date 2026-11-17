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
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const safe01=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const isAction=(value:unknown):value is ActionKind=>typeof value==='string'&&ACTIONS.includes(value as ActionKind);
const isMode=(value:unknown):value is CognitiveBridgeMode=>typeof value==='string'&&MODES.includes(value as CognitiveBridgeMode);

export interface CognitiveToNeuralBridgeInput {
  tick?:unknown;
  action?:unknown;
  mode?:unknown;
  motivation01?:unknown;
  uncertainty01?:unknown;
  urgency01?:unknown;
  budgetRemaining01?:unknown;
  attention01?:unknown;
}

export interface CognitiveNeuralControlProfile {
  version:1;
  tick:number;
  action:CognitiveBridgeAction;
  mode:CognitiveBridgeMode;
  adapterHint:CognitiveAdapterHint;
  featureVector01:number[];
  temperature:number;
  maxTokens:number;
  steeringIntent01:{
    curiosity01:number;
    caution01:number;
    persistence01:number;
    verification01:number;
  };
  controlsApplied:{
    samplingParameters:true;
    adapterSelection:false;
    activationSteering:false;
    residualBlock:false;
  };
}

/**
 * Projects the existing organism state into a deterministic, bounded 19-channel
 * control vector. Adapter and neural-steering channels are intent-only until a
 * provider exposes a separately calibrated activation interface.
 */
export class CognitiveToNeuralBridge {
  project(input:CognitiveToNeuralBridgeInput={}):CognitiveNeuralControlProfile {
    const action:CognitiveBridgeAction=isAction(input.action)?input.action:'none';
    const mode:CognitiveBridgeMode=isMode(input.mode)?input.mode:'shallow';
    const tick=typeof input.tick==='number'&&Number.isSafeInteger(input.tick)&&input.tick>=0?input.tick:0;
    const motivation01=safe01(input.motivation01,0);
    const uncertainty01=safe01(input.uncertainty01,.5);
    const urgency01=safe01(input.urgency01,0);
    const budgetRemaining01=safe01(input.budgetRemaining01,.5);
    const attention01=safe01(input.attention01,.5);

    const actionFeatures=ACTIONS.map(candidate=>candidate===action?1:0);
    const modeFeatures=MODES.map(candidate=>candidate===mode?1:0);
    const featureVector01=[
      ...actionFeatures,
      motivation01,uncertainty01,urgency01,budgetRemaining01,attention01,
      ...modeFeatures,
    ];
    const temperature=Number(clamp(
      TEMPERATURE_BY_MODE[mode]+motivation01*.08-uncertainty01*.16+urgency01*.02,
      .2,.85,
    ).toFixed(3));
    const steeringIntent01={
      curiosity01:clamp(motivation01*(1-uncertainty01)*.15,0,.15),
      caution01:clamp(uncertainty01*.15,0,.15),
      persistence01:clamp(motivation01*.15,0,.15),
      verification01:clamp(Math.max(uncertainty01,urgency01)*.15,0,.15),
    };
    return {
      version:1,tick,action,mode,adapterHint:ADAPTER_BY_MODE[mode],
      featureVector01,temperature,maxTokens:TOKENS_BY_MODE[mode],steeringIntent01,
      controlsApplied:{
        samplingParameters:true,
        adapterSelection:false,
        activationSteering:false,
        residualBlock:false,
      },
    };
  }
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
