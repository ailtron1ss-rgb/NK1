import type { OrganismObservation, OrganismState } from './types.ts';

export type CognitiveDomain = 'self'|'world'|'memory'|'agency'|'embodiment'|'research'|'governance';

export interface CognitiveFrame {
  version: 1;
  tick: number;
  at: number;
  externalInput: boolean;
  signalMask: number;
  domains: Record<CognitiveDomain, boolean>;
  dirtyDomains: Record<CognitiveDomain, boolean>;
  attentionBudget01: number;
  deepDemand01: number;
  surprise01: number;
  novelty01: number;
  predictionError01: number;
  uncertainty01: number;
  goalPressure01: number;
  energy01: number;
  cognitiveCapacity01: number;
  thermal01: number;
  ramPressure01: number;
  complexity01: number;
  expectedInformationGain01: number;
  wakeMask: number;
  pressure01?: number;
  interrupt?: {active:boolean;priority01:number;type:string;domains:CognitiveDomain[]};
  reason: string;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

/**
 * A small immutable-ish routing frame for the hot path. It deliberately contains
 * normalized signals, not module snapshots. This lets schedulers make decisions
 * without cloning or traversing the organism state tree.
 */
export function buildCognitiveFrame(state: OrganismState, observation: OrganismObservation): CognitiveFrame {
  const hasText=Boolean(observation.text);
  const hasVision=Boolean(observation.vision);
  const hasAudio=Boolean(observation.audio);
  const hasWorld=Boolean(observation.worldContext || observation.worldEvent);
  const hasOutcome=observation.reward!==undefined || observation.success!==undefined;
  const hasGoal=Boolean(observation.externalGoal);
  const hasSocial=observation.socialSignal!==undefined;
  const hasEmbodiment=Boolean(observation.embodiment);
  // Embodiment telemetry is internal state, not an external trigger. This distinction is
  // essential for measuring ambient autonomy during idle periods.
  const externalInput=Boolean(hasText||hasVision||hasAudio||hasWorld||hasOutcome||hasGoal||hasSocial);

  // Bitmask is intentionally stable so future Android/native hosts can emit the
  // same compact signal representation without importing the full observation type.
  let signalMask=0;
  if(hasText) signalMask|=1;
  if(hasVision) signalMask|=2;
  if(hasAudio) signalMask|=4;
  if(hasWorld) signalMask|=8;
  if(hasOutcome) signalMask|=16;
  if(hasGoal) signalMask|=32;
  if(hasSocial) signalMask|=64;
  if(hasEmbodiment) signalMask|=128;

  const surprise01=clamp(observation.surprise??0);
  const novelty01=clamp(observation.novelty??state.needs.novelty);
  const predictionError01=clamp(state.predictionError);
  const uncertainty01=clamp(observation.worldContext?.uncertainty??state.needs.uncertainty);
  const goalPressure01=clamp(state.needs.goalPressure + (hasGoal?.12:0));
  const energy01=clamp(observation.embodiment?.bodyEnergy01??state.needs.energy);
  const cognitiveCapacity01=clamp(observation.embodiment?.cognitiveCapacity01??(1-state.needs.cognitiveLoad));
  const thermal01=clamp(observation.embodiment?.thermalStrain01??0.2);
  const ramPressure01=clamp(observation.embodiment?.ramPressure01??0.2);

  const modalityComplexity=(hasText?.16:0)+(hasVision?.24:0)+(hasAudio?.18:0)+(hasWorld?.14:0)+(hasGoal?.10:0)+(hasOutcome?.08:0);
  const stateComplexity=state.needs.cognitiveLoad*.22+uncertainty01*.18+predictionError01*.18;
  const complexity01=clamp(.12+modalityComplexity+stateComplexity);
  const expectedInformationGain01=clamp(
    surprise01*.26 + predictionError01*.26 + uncertainty01*.18 + novelty01*.12 +
    (hasWorld||hasVision||hasAudio ? .10 : 0) + (hasText?.06:0) + goalPressure01*.08,
  );

  const domains:Record<CognitiveDomain,boolean>={
    self:Boolean(hasText||hasGoal||hasSocial||predictionError01>.22),
    world:Boolean(hasVision||hasAudio||hasWorld||predictionError01>.20||novelty01>.45),
    memory:Boolean(hasText||hasVision||hasAudio||hasWorld||predictionError01>.18||novelty01>.40),
    agency:Boolean(hasText||hasGoal||goalPressure01>.35||predictionError01>.35),
    embodiment:Boolean(hasEmbodiment||hasVision||hasAudio),
    research:Boolean(hasWorld||hasText||predictionError01>.42||uncertainty01>.62),
    governance:Boolean(hasOutcome||thermal01>.65||ramPressure01>.72||energy01<.28),
  };
  const dirtyDomains:Record<CognitiveDomain,boolean>={
    ...domains,
    governance: domains.governance || thermal01>.55 || ramPressure01>.55 || energy01<.40,
  };
  const deepDemand01=clamp(
    expectedInformationGain01*.34 + predictionError01*.24 + goalPressure01*.18 + uncertainty01*.12 + novelty01*.08 + complexity01*.04,
  );
  const interruptPriority01=clamp(Math.max(predictionError01*.92, surprise01*.88, goalPressure01*.78, uncertainty01*.74, (1-energy01)*.86, thermal01*.80, ramPressure01*.78));
  const interruptType = predictionError01>.7?'prediction-error':surprise01>.68?'surprise':goalPressure01>.78?'goal-pressure':uncertainty01>.82?'uncertainty':energy01<.18?'resource-critical':thermal01>.82?'thermal-critical':ramPressure01>.86?'memory-pressure':externalInput?'external-input':'none';
  const interruptDomains = (Object.entries(domains).filter(([domain,active])=>active && ['self','world','memory','agency','embodiment','research','governance'].includes(domain)).map(([domain])=>domain as CognitiveDomain));
  const interrupt={active:interruptPriority01>.72 && interruptType!=='none',priority01:interruptPriority01,type:interruptType,domains:interruptDomains};
  // Attention is scarce by design. It becomes the soft resource shared by all
  // downstream planners instead of each subsystem assuming an unlimited focus.
  const attentionBudget01=clamp(.18 + cognitiveCapacity01*.42 + energy01*.18 + (1-thermal01)*.12 + (1-ramPressure01)*.10);
  const reason=[
    externalInput?'external':'internal',
    `mask=${signalMask}`,
    `ig=${expectedInformationGain01.toFixed(2)}`,
    `deep=${deepDemand01.toFixed(2)}`,
    `attn=${attentionBudget01.toFixed(2)}`,
    `cap=${cognitiveCapacity01.toFixed(2)}`,
  ].join(';');

  let wakeMask=0;
  if(domains.self) wakeMask|=1; if(domains.world) wakeMask|=2; if(domains.memory) wakeMask|=4; if(domains.agency) wakeMask|=8; if(domains.embodiment) wakeMask|=16; if(domains.research) wakeMask|=32; if(domains.governance) wakeMask|=64;
  return {version:1,tick:state.tick+1,at:state.at,externalInput,signalMask,domains,dirtyDomains,attentionBudget01,deepDemand01,surprise01,novelty01,predictionError01,uncertainty01,goalPressure01,energy01,cognitiveCapacity01,thermal01,ramPressure01,complexity01,expectedInformationGain01,wakeMask,interrupt,reason};
}

export function cloneCognitiveFrame(frame:CognitiveFrame):CognitiveFrame{
  return {...frame,domains:{...frame.domains},dirtyDomains:{...frame.dirtyDomains}};
}
