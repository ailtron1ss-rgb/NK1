import type { ActionKind } from '../core/types.ts';
import { BalancedReservoirSampler, PrioritizedReplaySampler, robustPercentileNormalize, type ReservoirState } from '../system/UpstreamReplayPrimitives.ts';
import { NeuroCoreAdaptiveOperators, type NeuroCoreAdaptiveOperatorState } from '../system/NeuroCoreAdaptiveOperators.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const AREAS = ['interoception', 'exteroception', 'association', 'selfAction'] as const;
type AreaName = typeof AREAS[number];
const N_PER_AREA = 24;
const N = N_PER_AREA * AREAS.length;
const INPUT_DIM = 64;
const FORECAST_DELTA_DIM = 8;
const TEMPORAL_WINDOW = 12;
const TEMPORAL_GAMMA = 0.90;
const TEMPORAL_LAMBDA = 0.78;
const SELF_DIM = 16;
const SELF_EPISODE_LIMIT = 64;
const GOAL_HISTORY_LIMIT = 96;
const GOAL_DIM = 8;

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x: number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, x))));
const salenceClamp = (x:number) => clamp01(x);
const contextSimilarity = (a:number[], b:number[]) => { let d=0; const n=Math.min(a.length,b.length); for(let i=0;i<n;i+=1)d+=Math.abs((a[i]??0)-(b[i]??0)); return n?clamp01(1-d/n):0; };
const cosine = (a:number[], b:number[]) => { let aa=0,bb=0,ab=0; for(let i=0;i<Math.min(a.length,b.length);i+=1){aa+=a[i]!*a[i]!;bb+=b[i]!*b[i]!;ab+=a[i]!*b[i]!;} return (aa>1e-9&&bb>1e-9)?clamp01((ab/Math.sqrt(aa*bb)+1)/2):0.5; };
const dot = (a: number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) sum += a[i]! * b[i]!;
  return sum;
};
const seeded = (seed: number) => {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 13)) >>> 0;
};
const rand = (seed: number, scale = 0.08) => ((seeded(seed) / 0xffffffff) * 2 - 1) * scale;
const softmax = (xs: number[], temperature = 0.16) => {
  const safeTemperature = Math.max(0.02, temperature);
  const max = Math.max(...xs);
  const exps = xs.map((value) => Math.exp((value - max) / safeTemperature));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((value) => value / total);
};

export interface B365Synapse {
  pre: number;
  post: number;
  weight: number;
  eligibility01: number;
  usage01: number;
  active: boolean;
  age: number;
}

export interface B365AreaState {
  name: AreaName;
  firingRate01: number;
  adaptation: number[];
  threshold: number[];
  membrane: number[];
  spikes: number[];
  neuromodulation01: number;
}

export interface B365ActionForecast {
  reward01: number;
  utility01: number;
  uncertainty01: number;
  confidence01: number;
  errorMean01: number;
  samples: number;
  lastUpdateTick: number;
  deltaReadout: number[];
}

export interface B365ActionContext {
  worldUtility01: number;
  worldConfidence01: number;
  worldUncertainty01: number;
  needRelief01?: number;
  predictedCost01?: number;
}

export type B365GoalSource = 'internal' | 'external' | 'unknown';

export interface B365GoalAuthorshipEntry {
  tick:number; id:string; source:B365GoalSource; accepted:boolean; verifiedOutcome:boolean;
  ownership01:number; commitment01:number; reward01:number; predictionError01:number;
  revisionDelta01:number; action:ActionKind|'none';
}

export interface B365GoalEcologyMemory {
  id:string; vector:number[]; source:B365GoalSource; status:'incubating'|'active'|'paused'|'completed'|'abandoned';
  ownership01:number; commitment01:number; progress01:number; persistence01:number; value01:number;
  resourceCost01:number; stagnation01:number; priority01:number; lastReward01:number;
  attempts:number; successes:number; failures:number; revisions:number; age:number; lastTick:number;
}

export interface B365State {
  version: 14;
  tick: number;
  cycles: number;
  learningUpdates: number;
  structuralUpdates: number;
  forecastUpdates: number;
  worldModelTransfers: number;
  prediction01: number;
  rewardPrediction01: number;
  nextNeedPrediction01: number;
  predictionError01: number;
  interoceptivePressure01: number;
  exteroceptiveNovelty01: number;
  selfCoherence01: number;
  actionEntropy01: number;
  plasticity01: number;
  neuromodulation01: number;
  sparseActivity01: number;
  recurrentCoherence01: number;
  neuralConfidence01: number;
  modelAgreement01: number;
  counterfactualDivergence01: number;
  goalField01: number;
  neuroCoreAdaptiveOperators: NeuroCoreAdaptiveOperatorState;
  developmentalMemory: {
    version:1; enabled:boolean; actionValue01:number[]; actionConfidence01:number[]; actionNovelty01:number[];
    verifiedExperiences:number; rejectedExperiences:number; adaptations:number; contradiction01:number; identityContinuity01:number;
    learningMass01:number; meanReward01:number; meanPredictionError01:number; lastTick:number; lastAction:ActionKind|'none';
    recent:Array<{tick:number; action:ActionKind; reward01:number; predictionError01:number; salience01:number; verified01:number; goalId:string|null}>;
  };
  contextualDevelopmental: {
    version:2; enabled:boolean; verifiedExperiences:number; rejectedExperiences:number; contextualAdaptations:number;
    retrievals:number; explicitQueries:number; contradictions:number; contradictionsResolved:number; contextCount:number; personalityAdaptations:number; traitImpact01:number; lastTick:number; lastContext:number[];
    profiles:Array<{id:string; action:ActionKind; context:number[]; value01:number; confidence01:number; conflict01:number; samples:number; lastTick:number; positiveEvidence:number; negativeEvidence:number; stable01:number}>;
    hypotheses:Array<{id:string; action:ActionKind; context:number[]; positiveMass01:number; negativeMass01:number; dominant01:number; conflict01:number; confidence01:number; samples:number; revisions:number; lastTick:number}>;
    history:Array<{tick:number; action:ActionKind; context:number[]; reward01:number; target01:number; similarity01:number; contradiction01:number; verified01:number}>;
  };
  autobiographicalValueGoal: {
    version:1; enabled:boolean; verifiedEpisodes:number; rejectedEpisodes:number; retrievals:number; explicitQueries:number; valueRevisionCount:number; goalValueRevisions:number; selfRevisions:number; contradictionCount:number; contradictionResolved:number;
    coherence01:number; identityContinuity01:number; autobiographicalBinding01:number; valueStability01:number; lastTick:number;
    values:Array<{id:string; value01:number; confidence01:number; support01:number; counterEvidence01:number; conflict01:number; revisions:number; lastTick:number}>;
    goalCouplings:Array<{goalId:string; values:number[]; confidence01:number; support01:number; conflict01:number; revisions:number; lastTick:number}>;
    episodes:Array<{tick:number; action:ActionKind; goalId:string|null; context:number[]; reward01:number; salience01:number; predictionError01:number; valuesBefore:number[]; valuesAfter:number[]; significance01:number; contradiction01:number; verified01:number}>;
  };
  goalAuthorship: {
    version:1; enabled:boolean; candidateId:string|null; candidateVector:number[]; candidateSource:B365GoalSource;
    candidateNovelty01:number; candidateConfidence01:number; ownership01:number; commitment01:number;
    revisionPressure01:number; acceptedGoals:number; rejectedGoals:number; revisions:number;
    verifiedOutcomes:number; counterfactualChecks:number; actionBias:number[];
    readout:number[][]; history:B365GoalAuthorshipEntry[]; lastTick:number; lastAction:ActionKind|'none';
  };
  goalEcology: {
    version:2; enabled:boolean; activeId:string|null;
    memories:B365GoalEcologyMemory[];
    completed:number; abandoned:number; paused:number; resumed:number; revisions:number;
    autonomousCycles:number; selfContinuationCycles:number; successorCreations:number; totalSwitches:number; autonomousReplans:number; rejectedSwitches:number;
    currentProgress01:number; persistence01:number; competitionEntropy01:number; lifeCourse01:number; switchPressure01:number; conflict01:number; resourceBudget01:number; stagnation01:number;
    lastDecisionReason:string; lastArbitrationTick:number;
    lastTransition:'none'|'activate'|'resume'|'pause'|'complete'|'abandon'|'revise'|'switch';
    lastTransitionTick:number;
  };
  selfModel: {
    version: 1; enabled: boolean;
    stableSelf: number[]; futureSelf: number[];
    currentSelf: number[]; predictedSelfByAction: number[][];
    actionIdentityReadout: number[][];
    agency01: number; continuity01: number; growthReadiness01: number;
    selfPredictionError01: number; identityConflict01: number;
    verifiedTransitions: number; rejectedTransitions: number; counterfactualChecks: number; selfConsolidations: number; consolidatedEpisodes: number; lastConsolidationTick: number;
    autobiographicalEpisodes: Array<{tick:number; action:ActionKind; reward01:number; verified01:number; selfBefore:number[]; selfAfter:number[]; predictionError01:number; identityConflict01:number; importance01:number}>;
    lastTick: number; lastAction: ActionKind|'none';
  };
  allostatic: {
    version: 1; enabled: boolean;
    setpoints: { energy01:number; thermal01:number; uncertainty01:number; novelty01:number; coherence01:number; capacity01:number };
    levels: { energy01:number; thermal01:number; uncertainty01:number; novelty01:number; coherence01:number; capacity01:number };
    deficits: { energy01:number; thermal01:number; uncertainty01:number; novelty01:number; coherence01:number; capacity01:number };
    drive01:number; arousal01:number; exploration01:number; preservation01:number; reflection01:number; socialApproach01:number;
    actionMotivation:number[];
    traits:{ curiosity01:number; caution01:number; persistence01:number; noveltySeeking01:number; restSeeking01:number; socialAttunement01:number };
    verifiedAdaptations:number; rejectedAdaptations:number; lastVerifiedReward01:number; lastVerifiedAction:ActionKind|'none'; lastTick:number;
  };
  areas: Record<AreaName, B365AreaState>;
  synapses: B365Synapse[];
  actionReadout: number[][];
  rewardReadout: number[];
  needReadout: number[];
  forecastReadout: number[][];
  forecastBias: number[];
  contextActionReadout: number[][];
  groundingActionReadout: number[][];
  temporalUpdates: number;
  temporalCreditMean01: number;
  temporalCreditMagnitude01: number;
  delayedRewardMean01: number;
  replayUpdates: number;
  replayExperiences: number;
  replayImpact01: number;
  replayLastTick: number;
  activePerceptionPlan: {
    version: 1;
    tick: number;
    priority01: number;
    expectedInformationGain01: number;
    requestedSensors: string[];
    rationale: string;
    issuedCount: number;
    fulfilledCount: number;
    lastObservedSensors: string[];
    lastFulfilled01: number;
  };
  activePerceptionStats: {
    plans: number;
    executed: number;
    fulfilled: number;
    meanInformationGain01: number;
  };
  grounding: {
    version: 1;
    lastSource: 'none'|'android-termux'|'node-host'|'world'|'external';
    freshness01: number;
    sensorConfidence01: number;
    verified01: number;
    activePerceptionDemand01: number;
    lastEnergy01: number;
    lastThermal01: number;
    lastMotion01: number;
    lastLight01: number;
    lastProximity01: number;
    lastNetwork01: number;
    observations: number;
    verifiedObservations: number;
    causalImpact01: number;
    lastTick: number;
  };
  transitionLearning: {
    updates: number;
    verifiedUpdates: number;
    meanPredictionError01: number;
    lastOutcomeReward01: number;
    lastAction: ActionKind|'none';
  };
  realityActionLearning: {
    version: 1;
    updates: number;
    verifiedUpdates: number;
    rejectedUnverified: number;
    meanConsequenceError01: number;
    meanVerified01: number;
    lastTick: number;
    lastAction: ActionKind|'none';
    actionSamples: Record<ActionKind, { samples:number; verified:number; meanEffect01:number; meanError01:number; lastEffect01:number }>;
  };
  replayBuffer: Array<{ tick:number; action:ActionKind; reward01:number; predictionError01:number; novelty01:number; verified01:number; latent:number[]; utility01:number; priority01:number }>;
  replayStreamCount: number;
  replayReservoirRngState: number;
  replayReservoirGroups: Record<string, ReservoirState>;
  replayImportanceBeta01: number;
  pendingTemporalTraces: Array<{ tick:number; action:ActionKind; rewardPrediction01:number; confidence01:number; latent:number[]; forecastUtility01:number }>;
  temporalCreditByAction: number[];
  actionForecasts: Record<ActionKind, B365ActionForecast>;
  eligibility: number[];
  lastInput: number[];
  lastLatent: number[];
  lastSpikes: number[];
  lastAction: ActionKind | null;
  lastActionProbabilities: number[];
  lastForecastUtilities: number[];
  lastWorldUtilities: number[];
  lastWorldConfidence: number[];
  lastCounterfactualScore: number[];
  history: Array<{
    tick: number;
    action: ActionKind | null;
    reward01: number;
    predictionError01: number;
    entropy01: number;
    causalGain01: number;
    modelAgreement01: number;
    forecastError01: number;
  }>;
}

export interface B365StepInput {
  tick: number;
  vector: number[];
  action?: ActionKind | null;
  dopamine01?: number;
  norepinephrine01?: number;
  acetylcholine01?: number;
  novelty01?: number;
  uncertainty01?: number;
  predictionError01?: number;
  goalPressure01?: number;
  autonomy01?: number;
  learningEnabled?: boolean;
  actionContext?: Partial<Record<ActionKind, B365ActionContext>>;
  goalAuthorship?: { candidateId?:string|null; vector?:number[]; source?:B365GoalSource; novelty01?:number; confidence01?:number; internalPressure01?:number; homeostaticPressure01?:number; identityContinuity01?:number; autonomy01?:number; };
  temporalLife?: { temporalRegulation01?:number; homeostaticPressure01?:number; consolidationPressure01?:number; experienceSalience01?:number; continuity01?:number; sleepPressure01?:number; resourceUrgency01?:number; learningGate01?:number; };
  developmentContext01?: number[];
}

export interface B365StepResult {
  actionProbabilities: Record<ActionKind, number>;
  selectedAction: ActionKind;
  latent: number[];
  prediction01: number;
  rewardPrediction01: number;
  nextNeedPrediction01: number;
  predictionError01: number;
  plasticity01: number;
  neuromodulation01: number;
  sparseActivity01: number;
  recurrentCoherence01: number;
  neuralConfidence01: number;
  readoutGain: number;
  policyTemperature: number;
  modelAgreement01: number;
  counterfactualDivergence01: number;
  forecastUtilities: Record<ActionKind, number>;
  selfAgency01: number; selfContinuity01: number; selfIdentityConflict01: number; selfGrowthReadiness01: number;
  allostaticDrive01: number;
  allostaticPreservation01: number;
  allostaticExploration01: number;
  allostaticReflection01: number;
  allostaticActionMotivation: Record<ActionKind, number>;
  goalOwnership01:number; goalCommitment01:number; goalRevisionPressure01:number;
}

const makeArea = (name: AreaName, seed: number): B365AreaState => ({
  name,
  firingRate01: 0.08,
  adaptation: new Array(N_PER_AREA).fill(0),
  threshold: new Array(N_PER_AREA).fill(0.28),
  membrane: new Array(N_PER_AREA).fill(0).map((_, i) => rand(seed + i, 0.025)),
  spikes: new Array(N_PER_AREA).fill(0),
  neuromodulation01: 0.5,
});

const makeSynapses = (): B365Synapse[] => {
  const synapses: B365Synapse[] = [];
  for (let post = 0; post < N; post += 1) {
    for (let k = 0; k < 8; k += 1) {
      const pre = (post * 37 + k * 11 + 5) % N;
      if (pre === post) continue;
      synapses.push({
        pre,
        post,
        weight: rand(365_000 + post * 19 + k, 0.045),
        eligibility01: 0,
        usage01: 0.05,
        active: true,
        age: 0,
      });
    }
  }
  for (let area = 0; area < AREAS.length - 1; area += 1) {
    const from = area * N_PER_AREA;
    const to = (area + 1) * N_PER_AREA;
    for (let post = to; post < to + N_PER_AREA; post += 1) {
      for (let k = 0; k < 6; k += 1) {
        const pre = from + ((post * 17 + k * 7) % N_PER_AREA);
        synapses.push({
          pre,
          post,
          weight: rand(366_000 + post * 13 + k, 0.035),
          eligibility01: 0,
          usage01: 0.08,
          active: true,
          age: 0,
        });
      }
    }
  }
  return synapses;
};

const makeForecast = (): B365ActionForecast => ({
  reward01: 0.5,
  utility01: 0.5,
  uncertainty01: 0.65,
  confidence01: 0.15,
  errorMean01: 0.5,
  samples: 0,
  lastUpdateTick: 0,
  deltaReadout: new Array(FORECAST_DELTA_DIM).fill(0),
});

const makeActionForecasts = (): Record<ActionKind, B365ActionForecast> => Object.fromEntries(
  ACTIONS.map((action) => [action, makeForecast()]),
) as Record<ActionKind, B365ActionForecast>;

export const defaultB365State = (): B365State => ({
  version: 14,
  tick: 0,
  cycles: 0,
  learningUpdates: 0,
  structuralUpdates: 0,
  forecastUpdates: 0,
  worldModelTransfers: 0,
  prediction01: 0.5,
  rewardPrediction01: 0.5,
  nextNeedPrediction01: 0.5,
  predictionError01: 0.5,
  interoceptivePressure01: 0.2,
  exteroceptiveNovelty01: 0.2,
  selfCoherence01: 0.5,
  actionEntropy01: 1,
  plasticity01: 0.5,
  neuromodulation01: 0.5,
  sparseActivity01: 0.9,
  recurrentCoherence01: 0.2,
  neuralConfidence01: 0.2,
  modelAgreement01: 0.5,
  counterfactualDivergence01: 0,
  goalField01: 0.5,
  neuroCoreAdaptiveOperators: { version:2, curvature:new Array(N).fill(.04), lowRankBasis:Array.from({length:4},()=>new Array(N).fill(0)), lowRankStrength:new Array(4).fill(.015), rankCursor:0, updates:0, vectorUpdates:0, meanCurvature01:.04, meanPreconditioner01:1, meanLowRank01:.03, meanEraseGate01:.2, meanWriteGate01:.4, eraseScale01:1, writeScale01:1, lowRankScale01:0 },
  developmentalMemory: {
    version:1, enabled:true, actionValue01:ACTIONS.map(()=>.5), actionConfidence01:ACTIONS.map(()=>.15), actionNovelty01:ACTIONS.map(()=>.2),
    verifiedExperiences:0,rejectedExperiences:0,adaptations:0,contradiction01:0,identityContinuity01:.8,learningMass01:0,meanReward01:.5,meanPredictionError01:.5,lastTick:0,lastAction:'none',recent:[],
  },
  contextualDevelopmental: {
    version:2, enabled:true, verifiedExperiences:0, rejectedExperiences:0, contextualAdaptations:0, retrievals:0, explicitQueries:0, contradictions:0, contradictionsResolved:0, contextCount:0, personalityAdaptations:0, traitImpact01:0, lastTick:0, lastContext:new Array(8).fill(.5),
    profiles:[], hypotheses:[], history:[],
  },
  autobiographicalValueGoal: {
    version:1, enabled:true, verifiedEpisodes:0, rejectedEpisodes:0, retrievals:0, explicitQueries:0, valueRevisionCount:0, goalValueRevisions:0, selfRevisions:0, contradictionCount:0, contradictionResolved:0, coherence01:.62, identityContinuity01:.76, autobiographicalBinding01:0, valueStability01:.62, lastTick:0,
    values:[['truth',.72],['evidence',.70],['autonomy',.62],['responsibility',.64],['curiosity',.62],['preservation',.58],['connection',.50],['novelty',.58]].map(([id,value])=>({id:String(id),value01:Number(value),confidence01:.18,support01:0,counterEvidence01:0,conflict01:0,revisions:0,lastTick:0})),
    goalCouplings:[], episodes:[],
  },
  goalAuthorship: {
    version:1, enabled:true, candidateId:null, candidateVector:new Array(GOAL_DIM).fill(0), candidateSource:'unknown',
    candidateNovelty01:0, candidateConfidence01:0.35, ownership01:0.18, commitment01:0.18, revisionPressure01:0,
    acceptedGoals:0, rejectedGoals:0, revisions:0, verifiedOutcomes:0, counterfactualChecks:0,
    actionBias:new Array(ACTIONS.length).fill(0),
    readout:ACTIONS.map((_,a)=>Array.from({length:GOAL_DIM},(_,i)=>rand(475_000+a*29+i,.055))),
    history:[], lastTick:0, lastAction:'none',
  },
  goalEcology: {
    version:2, enabled:true, activeId:null, memories:[], completed:0, abandoned:0, paused:0, resumed:0, revisions:0,
    autonomousCycles:0, selfContinuationCycles:0, successorCreations:0, totalSwitches:0, autonomousReplans:0, rejectedSwitches:0,
    currentProgress01:0, persistence01:0, competitionEntropy01:1, lifeCourse01:.5, switchPressure01:0, conflict01:0, resourceBudget01:.7, stagnation01:0,
    lastDecisionReason:'none', lastArbitrationTick:0, lastTransition:'none', lastTransitionTick:0,
  },
  selfModel: {
    version:1, enabled:true, stableSelf:new Array(SELF_DIM).fill(0), futureSelf:new Array(SELF_DIM).fill(0), currentSelf:new Array(SELF_DIM).fill(0),
    predictedSelfByAction:ACTIONS.map(()=>new Array(SELF_DIM).fill(0)),
    actionIdentityReadout:ACTIONS.map((_,action)=>new Array(SELF_DIM).fill(0).map((_,i)=>rand(381_000+action*23+i,.055))),
    agency01:.52, continuity01:.72, growthReadiness01:.34, selfPredictionError01:.5, identityConflict01:0,
    verifiedTransitions:0, rejectedTransitions:0, counterfactualChecks:0, selfConsolidations:0, consolidatedEpisodes:0, lastConsolidationTick:0, autobiographicalEpisodes:[], lastTick:0, lastAction:'none',
  },
  allostatic: {
    version:1, enabled:true, setpoints:{energy01:.62,thermal01:.28,uncertainty01:.30,novelty01:.22,coherence01:.72,capacity01:.62},
    levels:{energy01:.62,thermal01:.28,uncertainty01:.50,novelty01:.22,coherence01:.55,capacity01:.62},
    deficits:{energy01:0,thermal01:0,uncertainty01:.20,novelty01:0,coherence01:.17,capacity01:0},
    drive01:.20,arousal01:.45,exploration01:.28,preservation01:.18,reflection01:.22,socialApproach01:.32,actionMotivation:ACTIONS.map(()=>0),
    traits:{curiosity01:.62,caution01:.48,persistence01:.56,noveltySeeking01:.58,restSeeking01:.42,socialAttunement01:.50},
    verifiedAdaptations:0,rejectedAdaptations:0,lastVerifiedReward01:.5,lastVerifiedAction:'none',lastTick:0,
  },
  areas: {
    interoception: makeArea('interoception', 1000),
    exteroception: makeArea('exteroception', 2000),
    association: makeArea('association', 3000),
    selfAction: makeArea('selfAction', 4000),
  },
  synapses: makeSynapses(),
  actionReadout: ACTIONS.map((_, action) => Array.from({ length: N }, (_, i) => rand(367_000 + action * 97 + i, 0.11))),
  rewardReadout: Array.from({ length: N }, (_, i) => rand(368_000 + i, 0.04)),
  needReadout: Array.from({ length: N }, (_, i) => rand(369_000 + i, 0.04)),
  forecastReadout: ACTIONS.map((_, action) => Array.from({ length: N }, (_, i) => rand(371_000 + action * 101 + i, 0.07))),
  forecastBias: ACTIONS.map((_, action) => rand(372_000 + action, 0.02)),
  groundingActionReadout: ACTIONS.map((_, action) => Array.from({ length: 6 }, (_, i) => rand(374_000 + action * 11 + i, 0.035))),
  contextActionReadout: ACTIONS.map((_, action) => {
    const semantic = [
      [0.02,0.00,0.00,0.00,0.00,0.00,0.02],
      [0.00,0.00,0.00,0.16,-0.10,0.00,0.02],
      [0.00,0.14,0.12,0.02,0.08,0.02,0.02],
      [0.16,-0.12,-0.04,-0.04,0.00,0.04,-0.02],
      [0.00,0.05,0.06,0.01,0.04,0.05,0.03],
      [-0.02,-0.02,-0.01,-0.04,0.00,-0.02,-0.01],
      [-0.02,0.04,0.00,0.00,-0.01,0.00,0.00],
    ][action]!;
    return semantic.map((base, i) => base + rand(373_000 + action * 17 + i, 0.035));
  }),
  temporalUpdates: 0,
  temporalCreditMean01: 0,
  temporalCreditMagnitude01: 0,
  delayedRewardMean01: 0.5,
  replayUpdates: 0,
  replayExperiences: 0,
  replayImpact01: 0,
  replayLastTick: 0,
  activePerceptionPlan: { version:1, tick:0, priority01:0.5, expectedInformationGain01:0, requestedSensors:[], rationale:'initialization', issuedCount:0, fulfilledCount:0, lastObservedSensors:[], lastFulfilled01:0 },
  activePerceptionStats: { plans:0, executed:0, fulfilled:0, meanInformationGain01:0 },
  grounding: { version:1, lastSource:'none', freshness01:0, sensorConfidence01:0, verified01:0, activePerceptionDemand01:0.5, lastEnergy01:0.5, lastThermal01:0.2, lastMotion01:0, lastLight01:0.5, lastProximity01:0.5, lastNetwork01:0.5, observations:0, verifiedObservations:0, causalImpact01:0, lastTick:0 },
  transitionLearning: { updates:0, verifiedUpdates:0, meanPredictionError01:0.5, lastOutcomeReward01:0.5, lastAction:'none' },
  realityActionLearning: { version:1, updates:0, verifiedUpdates:0, rejectedUnverified:0, meanConsequenceError01:0.5, meanVerified01:0, lastTick:0, lastAction:'none', actionSamples:Object.fromEntries(ACTIONS.map((action)=>[action,{samples:0,verified:0,meanEffect01:0.5,meanError01:0.5,lastEffect01:0}])) as Record<ActionKind,{samples:number;verified:number;meanEffect01:number;meanError01:number;lastEffect01:number}> },
  replayBuffer: [],
  replayStreamCount: 0,
  replayReservoirRngState: 0x6d2b79f5,
  replayReservoirGroups: {},
  replayImportanceBeta01: 0.4,
  pendingTemporalTraces: [],
  temporalCreditByAction: ACTIONS.map(() => 0),
  actionForecasts: makeActionForecasts(),
  eligibility: new Array(N).fill(0),
  lastInput: new Array(INPUT_DIM).fill(0),
  lastLatent: new Array(N).fill(0),
  lastSpikes: new Array(N).fill(0),
  lastAction: null,
  lastActionProbabilities: ACTIONS.map(() => 1 / ACTIONS.length),
  lastForecastUtilities: ACTIONS.map(() => 0.5),
  lastWorldUtilities: ACTIONS.map(() => 0.5),
  lastWorldConfidence: ACTIONS.map(() => 0.2),
  lastCounterfactualScore: ACTIONS.map(() => 0),
  history: [],
});

const sanitizeForecast = (raw?: Partial<B365ActionForecast>): B365ActionForecast => {
  const base = makeForecast();
  return {
    ...base,
    ...(raw ?? {}),
    reward01: clamp01(Number(raw?.reward01 ?? base.reward01)),
    utility01: clamp01(Number(raw?.utility01 ?? base.utility01)),
    uncertainty01: clamp01(Number(raw?.uncertainty01 ?? base.uncertainty01)),
    confidence01: clamp01(Number(raw?.confidence01 ?? base.confidence01)),
    errorMean01: clamp01(Number(raw?.errorMean01 ?? base.errorMean01)),
    samples: Math.max(0, Math.floor(Number(raw?.samples ?? base.samples))),
    lastUpdateTick: Math.max(0, Math.floor(Number(raw?.lastUpdateTick ?? base.lastUpdateTick))),
    deltaReadout: Array.from({ length: FORECAST_DELTA_DIM }, (_, index) => clamp11(Number(raw?.deltaReadout?.[index] ?? 0))),
  };

};

export class B365UnifiedNeuroCausalCore {
  private state = defaultB365State();
  private readonly replayReservoir = new BalancedReservoirSampler<B365State['replayBuffer'][number], string>(128, (item) => item.action, 0x6d2b79f5);
  private readonly replayPrioritySampler = new PrioritizedReplaySampler<B365State['replayBuffer'][number]>(0.6, 0.4);
  private readonly neuroCoreAdaptiveOperators = new NeuroCoreAdaptiveOperators(N);

  snapshot() {
    this.state.neuroCoreAdaptiveOperators=this.neuroCoreAdaptiveOperators.snapshot();
    return structuredClone(this.state);
  }

  restore(raw?: Partial<B365State> | null) {
    const defaults = defaultB365State();
    const source = raw ?? {};
    const actionForecasts = Object.fromEntries(
      ACTIONS.map((action) => [action, sanitizeForecast(source.actionForecasts?.[action])]),
    ) as Record<ActionKind, B365ActionForecast>;
    this.state = {
      ...defaults,
      ...source,
      version: 14,
      areas: source.areas ? structuredClone({ ...defaults.areas, ...source.areas }) : structuredClone(defaults.areas),
      synapses: Array.isArray(source.synapses) ? structuredClone(source.synapses) : defaults.synapses,
      actionReadout: Array.isArray(source.actionReadout) ? structuredClone(source.actionReadout) : defaults.actionReadout,
      rewardReadout: Array.isArray(source.rewardReadout) ? structuredClone(source.rewardReadout) : defaults.rewardReadout,
      needReadout: Array.isArray(source.needReadout) ? structuredClone(source.needReadout) : defaults.needReadout,
      forecastReadout: Array.isArray(source.forecastReadout) ? structuredClone(source.forecastReadout) : defaults.forecastReadout,
      forecastBias: Array.isArray(source.forecastBias) ? structuredClone(source.forecastBias) : defaults.forecastBias,
      contextActionReadout: Array.isArray(source.contextActionReadout) ? structuredClone(source.contextActionReadout) : defaults.contextActionReadout,
      groundingActionReadout: Array.isArray(source.groundingActionReadout) ? structuredClone(source.groundingActionReadout) : defaults.groundingActionReadout,
      temporalUpdates: Number(source.temporalUpdates ?? 0),
      temporalCreditMean01: clamp01(Number(source.temporalCreditMean01 ?? defaults.temporalCreditMean01)),
      temporalCreditMagnitude01: clamp01(Number(source.temporalCreditMagnitude01 ?? defaults.temporalCreditMagnitude01)),
      delayedRewardMean01: clamp01(Number(source.delayedRewardMean01 ?? defaults.delayedRewardMean01)),
      replayUpdates: Math.max(0, Number(source.replayUpdates ?? defaults.replayUpdates)),
      replayExperiences: Math.max(0, Number(source.replayExperiences ?? defaults.replayExperiences)),
      replayImpact01: clamp01(Number(source.replayImpact01 ?? defaults.replayImpact01)),
      replayLastTick: Math.max(0, Math.floor(Number(source.replayLastTick ?? defaults.replayLastTick))),
      activePerceptionPlan: { ...defaults.activePerceptionPlan, ...(source.activePerceptionPlan ?? {}), requestedSensors:Array.isArray(source.activePerceptionPlan?.requestedSensors) ? structuredClone(source.activePerceptionPlan.requestedSensors).slice(0,8) : [], lastObservedSensors:Array.isArray(source.activePerceptionPlan?.lastObservedSensors) ? structuredClone(source.activePerceptionPlan.lastObservedSensors).slice(0,8) : [] },
      activePerceptionStats: { ...defaults.activePerceptionStats, ...(source.activePerceptionStats ?? {}) },
      grounding: { ...defaults.grounding, ...(source.grounding ?? {}) },
      transitionLearning: { ...defaults.transitionLearning, ...(source.transitionLearning ?? {}) },
      realityActionLearning: {
        ...defaults.realityActionLearning,
        ...(source.realityActionLearning ?? {}),
        actionSamples: Object.fromEntries(ACTIONS.map((action)=>{
          const rawItem=(source.realityActionLearning as any)?.actionSamples?.[action] ?? {};
          return [action,{samples:Math.max(0,Math.floor(Number(rawItem.samples??0))),verified:Math.max(0,Math.floor(Number(rawItem.verified??0))),meanEffect01:clamp01(Number(rawItem.meanEffect01??.5)),meanError01:clamp01(Number(rawItem.meanError01??.5)),lastEffect01:clamp01(Number(rawItem.lastEffect01??0))}];
        })) as B365State['realityActionLearning']['actionSamples'],
      },
      replayBuffer: Array.isArray(source.replayBuffer) ? structuredClone(source.replayBuffer).slice(-128) : defaults.replayBuffer,
      replayStreamCount: Math.max(0, Math.floor(Number((source as any).replayStreamCount ?? source.replayExperiences ?? 0))),
      replayReservoirRngState: (Number((source as any).replayReservoirRngState ?? 0x6d2b79f5) >>> 0) || 0x6d2b79f5,
      replayReservoirGroups: structuredClone((source as any).replayReservoirGroups ?? {}),
      replayImportanceBeta01: clamp01(Number((source as any).replayImportanceBeta01 ?? 0.4)),
      pendingTemporalTraces: Array.isArray(source.pendingTemporalTraces) ? structuredClone(source.pendingTemporalTraces).slice(-TEMPORAL_WINDOW) : defaults.pendingTemporalTraces,
      temporalCreditByAction: Array.isArray(source.temporalCreditByAction) ? structuredClone(source.temporalCreditByAction) : defaults.temporalCreditByAction,
      actionForecasts,
      eligibility: Array.isArray(source.eligibility) ? structuredClone(source.eligibility) : defaults.eligibility,
      lastInput: Array.isArray(source.lastInput) ? structuredClone(source.lastInput).slice(0, INPUT_DIM) : defaults.lastInput,
      lastLatent: Array.isArray(source.lastLatent) ? structuredClone(source.lastLatent) : defaults.lastLatent,
      lastSpikes: Array.isArray(source.lastSpikes) ? structuredClone(source.lastSpikes) : defaults.lastSpikes,
      lastActionProbabilities: Array.isArray(source.lastActionProbabilities) ? structuredClone(source.lastActionProbabilities) : defaults.lastActionProbabilities,
      lastForecastUtilities: Array.isArray(source.lastForecastUtilities) ? structuredClone(source.lastForecastUtilities) : defaults.lastForecastUtilities,
      lastWorldUtilities: Array.isArray(source.lastWorldUtilities) ? structuredClone(source.lastWorldUtilities) : defaults.lastWorldUtilities,
      lastWorldConfidence: Array.isArray(source.lastWorldConfidence) ? structuredClone(source.lastWorldConfidence) : defaults.lastWorldConfidence,
      lastCounterfactualScore: Array.isArray(source.lastCounterfactualScore) ? structuredClone(source.lastCounterfactualScore) : defaults.lastCounterfactualScore,
      history: Array.isArray(source.history) ? structuredClone(source.history).slice(-255) : defaults.history,
      forecastUpdates: Number(source.forecastUpdates ?? 0),
      worldModelTransfers: Number(source.worldModelTransfers ?? 0),
      neuralConfidence01: clamp01(Number(source.neuralConfidence01 ?? defaults.neuralConfidence01)),
      modelAgreement01: clamp01(Number(source.modelAgreement01 ?? defaults.modelAgreement01)),
      counterfactualDivergence01: clamp01(Number(source.counterfactualDivergence01 ?? defaults.counterfactualDivergence01)),
      goalField01: clamp01(Number(source.goalField01 ?? defaults.goalField01)),
      developmentalMemory: {
        ...defaults.developmentalMemory, ...((source as any).developmentalMemory ?? {}), version:1,
        enabled:(source as any).developmentalMemory?.enabled!==false,
        actionValue01:Array.from({length:ACTIONS.length},(_,i)=>clamp01(Number((source as any).developmentalMemory?.actionValue01?.[i]??defaults.developmentalMemory.actionValue01[i]))),
        actionConfidence01:Array.from({length:ACTIONS.length},(_,i)=>clamp01(Number((source as any).developmentalMemory?.actionConfidence01?.[i]??defaults.developmentalMemory.actionConfidence01[i]))),
        actionNovelty01:Array.from({length:ACTIONS.length},(_,i)=>clamp01(Number((source as any).developmentalMemory?.actionNovelty01?.[i]??defaults.developmentalMemory.actionNovelty01[i]))),
        verifiedExperiences:Math.max(0,Math.floor(Number((source as any).developmentalMemory?.verifiedExperiences??0))),
        rejectedExperiences:Math.max(0,Math.floor(Number((source as any).developmentalMemory?.rejectedExperiences??0))),
        adaptations:Math.max(0,Math.floor(Number((source as any).developmentalMemory?.adaptations??0))),
        contradiction01:clamp01(Number((source as any).developmentalMemory?.contradiction01??0)),
        identityContinuity01:clamp01(Number((source as any).developmentalMemory?.identityContinuity01??.8)),
        learningMass01:clamp01(Number((source as any).developmentalMemory?.learningMass01??0)),
        meanReward01:clamp01(Number((source as any).developmentalMemory?.meanReward01??.5)),
        meanPredictionError01:clamp01(Number((source as any).developmentalMemory?.meanPredictionError01??.5)),
        lastTick:Math.max(0,Math.floor(Number((source as any).developmentalMemory?.lastTick??0))),
        lastAction:((source as any).developmentalMemory?.lastAction??'none') as ActionKind|'none',
        recent:Array.isArray((source as any).developmentalMemory?.recent)?structuredClone((source as any).developmentalMemory.recent).slice(-64):[],
      },
      contextualDevelopmental: {
        ...defaults.contextualDevelopmental, ...((source as any).contextualDevelopmental ?? {}), version:2,
        enabled:(source as any).contextualDevelopmental?.enabled!==false,
        verifiedExperiences:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.verifiedExperiences??0))),
        rejectedExperiences:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.rejectedExperiences??0))),
        contextualAdaptations:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.contextualAdaptations??0))),
        retrievals:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.retrievals??0))),
        contradictions:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.contradictions??0))),
        contradictionsResolved:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.contradictionsResolved??0))),
        contextCount:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.contextCount??0))),
        personalityAdaptations:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.personalityAdaptations??0))),
        traitImpact01:clamp01(Number((source as any).contextualDevelopmental?.traitImpact01??0)),
        explicitQueries:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.explicitQueries??0))),
        lastTick:Math.max(0,Math.floor(Number((source as any).contextualDevelopmental?.lastTick??0))),
        lastContext:Array.from({length:8},(_,i)=>clamp01(Number((source as any).contextualDevelopmental?.lastContext?.[i]??.5))),
        profiles:Array.isArray((source as any).contextualDevelopmental?.profiles)?structuredClone((source as any).contextualDevelopmental.profiles).slice(-48).map((m:any)=>({
          id:String(m?.id??'ctx-profile'), action:(ACTIONS.includes(m?.action)?m.action:'wait') as ActionKind,
          context:Array.from({length:8},(_,i)=>clamp01(Number(m?.context?.[i]??.5))), value01:clamp01(Number(m?.value01??.5)),
          confidence01:clamp01(Number(m?.confidence01??.12)), conflict01:clamp01(Number(m?.conflict01??0)),
          samples:Math.max(0,Math.floor(Number(m?.samples??0))), lastTick:Math.max(0,Math.floor(Number(m?.lastTick??0))),
          positiveEvidence:Math.max(0,Math.floor(Number(m?.positiveEvidence??0))), negativeEvidence:Math.max(0,Math.floor(Number(m?.negativeEvidence??0))), stable01:clamp01(Number(m?.stable01??0)),
        })) : [],
        hypotheses:Array.isArray((source as any).contextualDevelopmental?.hypotheses)?structuredClone((source as any).contextualDevelopmental.hypotheses).slice(-48).map((m:any)=>({
          id:String(m?.id??'ctx-hypothesis'), action:(ACTIONS.includes(m?.action)?m.action:'wait') as ActionKind,
          context:Array.from({length:8},(_,i)=>clamp01(Number(m?.context?.[i]??.5))), positiveMass01:clamp01(Number(m?.positiveMass01??0)), negativeMass01:clamp01(Number(m?.negativeMass01??0)), dominant01:clamp01(Number(m?.dominant01??.5)),
          conflict01:clamp01(Number(m?.conflict01??0)), confidence01:clamp01(Number(m?.confidence01??0)), samples:Math.max(0,Math.floor(Number(m?.samples??0))), revisions:Math.max(0,Math.floor(Number(m?.revisions??0))), lastTick:Math.max(0,Math.floor(Number(m?.lastTick??0))),
        })) : [],
        history:Array.isArray((source as any).contextualDevelopmental?.history)?structuredClone((source as any).contextualDevelopmental.history).slice(-96):[],
      },
      goalAuthorship: {
        ...defaults.goalAuthorship, ...((source as any).goalAuthorship ?? {}), version:1,
        candidateId: (source as any).goalAuthorship?.candidateId ?? defaults.goalAuthorship.candidateId,
        candidateVector: Array.from({length:GOAL_DIM},(_,i)=>clamp11(Number((source as any).goalAuthorship?.candidateVector?.[i] ?? defaults.goalAuthorship.candidateVector[i]))),
        candidateSource: ((source as any).goalAuthorship?.candidateSource==='internal'||(source as any).goalAuthorship?.candidateSource==='external')?(source as any).goalAuthorship.candidateSource:'unknown',
        candidateNovelty01:clamp01(Number((source as any).goalAuthorship?.candidateNovelty01??defaults.goalAuthorship.candidateNovelty01)),
        candidateConfidence01:clamp01(Number((source as any).goalAuthorship?.candidateConfidence01??defaults.goalAuthorship.candidateConfidence01)),
        ownership01:clamp01(Number((source as any).goalAuthorship?.ownership01??defaults.goalAuthorship.ownership01)),
        commitment01:clamp01(Number((source as any).goalAuthorship?.commitment01??defaults.goalAuthorship.commitment01)),
        revisionPressure01:clamp01(Number((source as any).goalAuthorship?.revisionPressure01??defaults.goalAuthorship.revisionPressure01)),
        actionBias:Array.from({length:ACTIONS.length},(_,i)=>clamp11(Number((source as any).goalAuthorship?.actionBias?.[i]??0))),
        readout:Array.from({length:ACTIONS.length},(_,a)=>Array.from({length:GOAL_DIM},(_,i)=>clamp11(Number((source as any).goalAuthorship?.readout?.[a]?.[i]??defaults.goalAuthorship.readout[a]![i])))),
        history:Array.isArray((source as any).goalAuthorship?.history)?structuredClone((source as any).goalAuthorship.history).slice(-GOAL_HISTORY_LIMIT):[],
        acceptedGoals:Math.max(0,Math.floor(Number((source as any).goalAuthorship?.acceptedGoals??0))), rejectedGoals:Math.max(0,Math.floor(Number((source as any).goalAuthorship?.rejectedGoals??0))), revisions:Math.max(0,Math.floor(Number((source as any).goalAuthorship?.revisions??0))), verifiedOutcomes:Math.max(0,Math.floor(Number((source as any).goalAuthorship?.verifiedOutcomes??0))), counterfactualChecks:Math.max(0,Math.floor(Number((source as any).goalAuthorship?.counterfactualChecks??0))), lastTick:Math.max(0,Math.floor(Number((source as any).goalAuthorship?.lastTick??0))), lastAction:((source as any).goalAuthorship?.lastAction??'none') as ActionKind|'none',
      },
      goalEcology: {
        ...defaults.goalEcology,
        ...((source as any).goalEcology ?? {}),
        version:2,
        activeId:(source as any).goalEcology?.activeId ?? defaults.goalEcology.activeId,
        memories:Array.isArray((source as any).goalEcology?.memories) ? structuredClone((source as any).goalEcology.memories).slice(-24).map((m:any)=>({
          ...m, vector:Array.from({length:GOAL_DIM},(_,i)=>clamp11(Number(m?.vector?.[i]??0))),
          ownership01:clamp01(Number(m?.ownership01??0)), commitment01:clamp01(Number(m?.commitment01??0)),
          progress01:clamp01(Number(m?.progress01??0)), persistence01:clamp01(Number(m?.persistence01??0)), value01:clamp01(Number(m?.value01??0)), resourceCost01:clamp01(Number(m?.resourceCost01??.30)), stagnation01:clamp01(Number(m?.stagnation01??0)), priority01:clamp01(Number(m?.priority01??.35)), lastReward01:clamp01(Number(m?.lastReward01??.5)),
          attempts:Math.max(0,Math.floor(Number(m?.attempts??0))), successes:Math.max(0,Math.floor(Number(m?.successes??0))),
          failures:Math.max(0,Math.floor(Number(m?.failures??0))), revisions:Math.max(0,Math.floor(Number(m?.revisions??0))),
          age:Math.max(0,Math.floor(Number(m?.age??0))), lastTick:Math.max(0,Math.floor(Number(m?.lastTick??0))),
        })) : [],
        completed:Math.max(0,Math.floor(Number((source as any).goalEcology?.completed??0))),
        abandoned:Math.max(0,Math.floor(Number((source as any).goalEcology?.abandoned??0))),
        paused:Math.max(0,Math.floor(Number((source as any).goalEcology?.paused??0))),
        resumed:Math.max(0,Math.floor(Number((source as any).goalEcology?.resumed??0))),
        revisions:Math.max(0,Math.floor(Number((source as any).goalEcology?.revisions??0))),
        autonomousCycles:Math.max(0,Math.floor(Number((source as any).goalEcology?.autonomousCycles??0))),
        selfContinuationCycles:Math.max(0,Math.floor(Number((source as any).goalEcology?.selfContinuationCycles??0))),
        successorCreations:Math.max(0,Math.floor(Number((source as any).goalEcology?.successorCreations??0))),
        totalSwitches:Math.max(0,Math.floor(Number((source as any).goalEcology?.totalSwitches??0))),
        autonomousReplans:Math.max(0,Math.floor(Number((source as any).goalEcology?.autonomousReplans??0))),
        rejectedSwitches:Math.max(0,Math.floor(Number((source as any).goalEcology?.rejectedSwitches??0))),
        currentProgress01:clamp01(Number((source as any).goalEcology?.currentProgress01??0)),
        persistence01:clamp01(Number((source as any).goalEcology?.persistence01??0)),
        competitionEntropy01:clamp01(Number((source as any).goalEcology?.competitionEntropy01??1)),
        lifeCourse01:clamp01(Number((source as any).goalEcology?.lifeCourse01??.5)),
        switchPressure01:clamp01(Number((source as any).goalEcology?.switchPressure01??0)),
        conflict01:clamp01(Number((source as any).goalEcology?.conflict01??0)),
        resourceBudget01:clamp01(Number((source as any).goalEcology?.resourceBudget01??.7)),
        stagnation01:clamp01(Number((source as any).goalEcology?.stagnation01??0)),
        lastDecisionReason:String((source as any).goalEcology?.lastDecisionReason??'none'),
        lastArbitrationTick:Math.max(0,Math.floor(Number((source as any).goalEcology?.lastArbitrationTick??0))),
        lastTransition:((source as any).goalEcology?.lastTransition??'none') as any,
        lastTransitionTick:Math.max(0,Math.floor(Number((source as any).goalEcology?.lastTransitionTick??0))),
      },
      selfModel: {
        ...defaults.selfModel,
        ...(source.selfModel ?? {}),
        stableSelf:Array.isArray((source.selfModel as any)?.stableSelf)?structuredClone((source.selfModel as any).stableSelf).slice(0,SELF_DIM):defaults.selfModel.stableSelf.slice(),
        futureSelf:Array.isArray((source.selfModel as any)?.futureSelf)?structuredClone((source.selfModel as any).futureSelf).slice(0,SELF_DIM):defaults.selfModel.futureSelf.slice(),
        currentSelf:Array.isArray((source.selfModel as any)?.currentSelf)?structuredClone((source.selfModel as any).currentSelf).slice(0,SELF_DIM):defaults.selfModel.currentSelf.slice(),
        predictedSelfByAction:Array.isArray((source.selfModel as any)?.predictedSelfByAction)?ACTIONS.map((_,i)=>Array.isArray((source.selfModel as any).predictedSelfByAction[i])?structuredClone((source.selfModel as any).predictedSelfByAction[i]).slice(0,SELF_DIM):defaults.selfModel.predictedSelfByAction[i]!.slice()):defaults.selfModel.predictedSelfByAction.map(v=>v.slice()),
        actionIdentityReadout:Array.isArray((source.selfModel as any)?.actionIdentityReadout)?ACTIONS.map((_,i)=>Array.isArray((source.selfModel as any).actionIdentityReadout[i])?structuredClone((source.selfModel as any).actionIdentityReadout[i]).slice(0,SELF_DIM):defaults.selfModel.actionIdentityReadout[i]!.slice()):defaults.selfModel.actionIdentityReadout.map(v=>v.slice()),
        agency01:clamp01(Number((source.selfModel as any)?.agency01??defaults.selfModel.agency01)),
        continuity01:clamp01(Number((source.selfModel as any)?.continuity01??defaults.selfModel.continuity01)),
        growthReadiness01:clamp01(Number((source.selfModel as any)?.growthReadiness01??defaults.selfModel.growthReadiness01)),
        selfPredictionError01:clamp01(Number((source.selfModel as any)?.selfPredictionError01??defaults.selfModel.selfPredictionError01)),
        identityConflict01:clamp01(Number((source.selfModel as any)?.identityConflict01??defaults.selfModel.identityConflict01)),
        verifiedTransitions:Math.max(0,Math.floor(Number((source.selfModel as any)?.verifiedTransitions??0))),
        rejectedTransitions:Math.max(0,Math.floor(Number((source.selfModel as any)?.rejectedTransitions??0))),
        counterfactualChecks:Math.max(0,Math.floor(Number((source.selfModel as any)?.counterfactualChecks??0))),
        selfConsolidations:Math.max(0,Math.floor(Number((source.selfModel as any)?.selfConsolidations??0))),
        consolidatedEpisodes:Math.max(0,Math.floor(Number((source.selfModel as any)?.consolidatedEpisodes??0))),
        lastConsolidationTick:Math.max(0,Math.floor(Number((source.selfModel as any)?.lastConsolidationTick??0))),
        autobiographicalEpisodes:Array.isArray((source.selfModel as any)?.autobiographicalEpisodes)?structuredClone((source.selfModel as any).autobiographicalEpisodes).slice(-SELF_EPISODE_LIMIT):[],
        lastTick:Math.max(0,Math.floor(Number((source.selfModel as any)?.lastTick??0))),
        lastAction:((source.selfModel as any)?.lastAction??'none') as ActionKind|'none',
      },
      autobiographicalValueGoal: {
        ...defaults.autobiographicalValueGoal, ...((source as any).autobiographicalValueGoal ?? {}), version:1, enabled:(source as any).autobiographicalValueGoal?.enabled!==false,
        verifiedEpisodes:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.verifiedEpisodes??0))), rejectedEpisodes:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.rejectedEpisodes??0))),
        retrievals:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.retrievals??0))), explicitQueries:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.explicitQueries??0))),
        valueRevisionCount:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.valueRevisionCount??0))), goalValueRevisions:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.goalValueRevisions??0))), selfRevisions:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.selfRevisions??0))),
        contradictionCount:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.contradictionCount??0))), contradictionResolved:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.contradictionResolved??0))),
        coherence01:clamp01(Number((source as any).autobiographicalValueGoal?.coherence01??defaults.autobiographicalValueGoal.coherence01)), identityContinuity01:clamp01(Number((source as any).autobiographicalValueGoal?.identityContinuity01??defaults.autobiographicalValueGoal.identityContinuity01)),
        autobiographicalBinding01:clamp01(Number((source as any).autobiographicalValueGoal?.autobiographicalBinding01??0)), valueStability01:clamp01(Number((source as any).autobiographicalValueGoal?.valueStability01??defaults.autobiographicalValueGoal.valueStability01)), lastTick:Math.max(0,Math.floor(Number((source as any).autobiographicalValueGoal?.lastTick??0))),
        values:Array.isArray((source as any).autobiographicalValueGoal?.values)?structuredClone((source as any).autobiographicalValueGoal.values).slice(0,8).map((v:any)=>({id:String(v?.id??''),value01:clamp01(Number(v?.value01??.5)),confidence01:clamp01(Number(v?.confidence01??.1)),support01:clamp01(Number(v?.support01??0)),counterEvidence01:clamp01(Number(v?.counterEvidence01??0)),conflict01:clamp01(Number(v?.conflict01??0)),revisions:Math.max(0,Math.floor(Number(v?.revisions??0))),lastTick:Math.max(0,Math.floor(Number(v?.lastTick??0)))})):structuredClone(defaults.autobiographicalValueGoal.values),
        goalCouplings:Array.isArray((source as any).autobiographicalValueGoal?.goalCouplings)?structuredClone((source as any).autobiographicalValueGoal.goalCouplings).slice(-24).map((g:any)=>({goalId:String(g?.goalId??''),values:Array.from({length:8},(_,i)=>clamp01(Number(g?.values?.[i]??.5))),confidence01:clamp01(Number(g?.confidence01??.1)),support01:clamp01(Number(g?.support01??0)),conflict01:clamp01(Number(g?.conflict01??0)),revisions:Math.max(0,Math.floor(Number(g?.revisions??0))),lastTick:Math.max(0,Math.floor(Number(g?.lastTick??0)))})):[],
        episodes:Array.isArray((source as any).autobiographicalValueGoal?.episodes)?structuredClone((source as any).autobiographicalValueGoal.episodes).slice(-96):[]
      },
      neuroCoreAdaptiveOperators: {
        version:2,
        curvature:Array.from({length:N},(_,i)=>Math.max(.0001,Math.min(4,Number(source.neuroCoreAdaptiveOperators?.curvature?.[i]??.04)))),
        lowRankBasis:Array.from({length:4},(_,ri)=>Array.from({length:N},(_,i)=>clamp11(Number(source.neuroCoreAdaptiveOperators?.lowRankBasis?.[ri]?.[i]??0)))),
        lowRankStrength:Array.from({length:4},(_,ri)=>clamp01(Number(source.neuroCoreAdaptiveOperators?.lowRankStrength?.[ri]??.015))),
        rankCursor:Math.max(0,Math.floor(Number(source.neuroCoreAdaptiveOperators?.rankCursor??0)))%4,
        updates:Math.max(0,Math.floor(Number(source.neuroCoreAdaptiveOperators?.updates??0))),
        vectorUpdates:Math.max(0,Math.floor(Number(source.neuroCoreAdaptiveOperators?.vectorUpdates??0))),
        meanCurvature01:clamp01(Number(source.neuroCoreAdaptiveOperators?.meanCurvature01??.04)),
        meanPreconditioner01:clamp01(Number(source.neuroCoreAdaptiveOperators?.meanPreconditioner01??1)),
        meanLowRank01:clamp01(Number(source.neuroCoreAdaptiveOperators?.meanLowRank01??.03)),
        meanEraseGate01:clamp01(Number(source.neuroCoreAdaptiveOperators?.meanEraseGate01??.2)),
        meanWriteGate01:clamp01(Number(source.neuroCoreAdaptiveOperators?.meanWriteGate01??.4)),
        eraseScale01:clamp01(Number(source.neuroCoreAdaptiveOperators?.eraseScale01??1)),
        writeScale01:clamp01(Number(source.neuroCoreAdaptiveOperators?.writeScale01??1)),
        lowRankScale01:clamp01(Number(source.neuroCoreAdaptiveOperators?.lowRankScale01??0)),
      },
      allostatic: {
        ...defaults.allostatic,
        ...(source.allostatic ?? {}),
        setpoints: { ...defaults.allostatic.setpoints, ...((source.allostatic as any)?.setpoints ?? {}) },
        levels: { ...defaults.allostatic.levels, ...((source.allostatic as any)?.levels ?? {}) },
        deficits: { ...defaults.allostatic.deficits, ...((source.allostatic as any)?.deficits ?? {}) },
        traits: { ...defaults.allostatic.traits, ...((source.allostatic as any)?.traits ?? {}) },
        actionMotivation: Array.isArray((source.allostatic as any)?.actionMotivation)
          ? structuredClone((source.allostatic as any).actionMotivation).slice(0, ACTIONS.length)
          : defaults.allostatic.actionMotivation.slice(),
        enabled: (source.allostatic as any)?.enabled !== false,
        drive01: clamp01(Number((source.allostatic as any)?.drive01 ?? defaults.allostatic.drive01)),
        arousal01: clamp01(Number((source.allostatic as any)?.arousal01 ?? defaults.allostatic.arousal01)),
        exploration01: clamp01(Number((source.allostatic as any)?.exploration01 ?? defaults.allostatic.exploration01)),
        preservation01: clamp01(Number((source.allostatic as any)?.preservation01 ?? defaults.allostatic.preservation01)),
        reflection01: clamp01(Number((source.allostatic as any)?.reflection01 ?? defaults.allostatic.reflection01)),
        socialApproach01: clamp01(Number((source.allostatic as any)?.socialApproach01 ?? defaults.allostatic.socialApproach01)),
        verifiedAdaptations: Math.max(0, Math.floor(Number((source.allostatic as any)?.verifiedAdaptations ?? 0))),
        rejectedAdaptations: Math.max(0, Math.floor(Number((source.allostatic as any)?.rejectedAdaptations ?? 0))),
        lastVerifiedReward01: clamp01(Number((source.allostatic as any)?.lastVerifiedReward01 ?? .5)),
        lastVerifiedAction: ((source.allostatic as any)?.lastVerifiedAction ?? 'none') as ActionKind | 'none',
        lastTick: Math.max(0, Math.floor(Number((source.allostatic as any)?.lastTick ?? 0))),
      },
    };
    this.neuroCoreAdaptiveOperators.restore(this.state.neuroCoreAdaptiveOperators);
    this.replayReservoir.restore(this.state.replayBuffer, this.state.replayReservoirGroups, this.state.replayStreamCount);
    this.state.replayBuffer = this.replayReservoir.values();
    this.state.replayReservoirGroups = this.replayReservoir.groupStates();
  }

  private areaOffset(index: number) {
    return index * N_PER_AREA;
  }

  private actionContextArray(context?: Partial<Record<ActionKind, B365ActionContext>>) {
    return ACTIONS.map((action) => {
      const item = context?.[action];
      return {
        worldUtility01: clamp01(Number(item?.worldUtility01 ?? 0.5)),
        worldConfidence01: clamp01(Number(item?.worldConfidence01 ?? 0.2)),
        worldUncertainty01: clamp01(Number(item?.worldUncertainty01 ?? 0.8)),
        needRelief01: clamp01(Number(item?.needRelief01 ?? 0.5)),
        predictedCost01: clamp01(Number(item?.predictedCost01 ?? 0.5)),
      };
    });
  }

  private selfVector(latent:number[], allostaticDrive:number, identityPressure:number): number[] {
    const out=new Array(SELF_DIM).fill(0);
    for(let i=0;i<SELF_DIM;i+=1){
      let sum=0; for(let k=i;k<N;k+=SELF_DIM) sum += latent[k] ?? 0;
      out[i]=clamp11(sum/Math.max(1,Math.ceil(N/SELF_DIM)) * .72 + (i===0?allostaticDrive-.5:0) * .22 + (i===1?identityPressure-.5:0) * .18);
    }
    return out;
  }
  private selfCosine(a:number[],b:number[]):number{
    let ab=0,aa=0,bb=0; for(let i=0;i<SELF_DIM;i+=1){const x=a[i]??0,y=b[i]??0;ab+=x*y;aa+=x*x;bb+=y*y;}
    return aa>1e-9&&bb>1e-9?clamp01(.5+.5*ab/Math.sqrt(aa*bb)):0.5;
  }
  private updateSelfModelBeforePolicy(latent:number[], actionContexts:B365ActionContext[], allostaticDrive:number){
    const s=this.state.selfModel; if(!s.enabled) return {selfVector:new Array(SELF_DIM).fill(0), actionScores:ACTIONS.map(()=>0)};
    const current=this.selfVector(latent,allostaticDrive,this.state.selfCoherence01); s.currentSelf=current;
    const actionScores:number[]=[];
    for(let ai=0;ai<ACTIONS.length;ai+=1){
      const a=ACTIONS[ai]!; const row=s.actionIdentityReadout[ai]!;
      const projected=current.map((v,i)=>clamp11(v + row[i]!*.42));
      s.predictedSelfByAction[ai]=projected;
      const stable=this.selfCosine(projected,s.stableSelf); const future=this.selfCosine(projected,s.futureSelf);
      const conflict=1-this.selfCosine(projected,s.stableSelf); const growth=clamp01(.5+.5*(this.selfCosine(projected,s.futureSelf)-this.selfCosine(current,s.futureSelf)));
      const worldFit=clamp01(actionContexts[ai]?.worldUtility01 ?? .5);
      actionScores[ai]=.42*(stable-.5)+.32*(future-.5)+.18*(growth-.5)+.10*(worldFit-.5)-.34*conflict*(1-s.growthReadiness01);
    }
    s.counterfactualChecks+=ACTIONS.length;
    return {selfVector:current, actionScores};
  }
  consolidateSelfBiography(tick=this.state.tick){
    const s=this.state.selfModel; if(!s.enabled || s.autobiographicalEpisodes.length===0) return {consolidated:0,impact01:0};
    const selected=s.autobiographicalEpisodes.slice().sort((a,b)=>b.importance01-a.importance01).slice(0,12);
    let impact=0;
    for(const ep of selected){
      const w=.012*(.35+.65*ep.importance01);
      for(let i=0;i<SELF_DIM;i+=1){
        s.futureSelf[i]=clamp11(s.futureSelf[i]!+(ep.selfAfter[i]!-s.futureSelf[i]!)*w);
        s.stableSelf[i]=clamp11(s.stableSelf[i]!+(ep.selfAfter[i]!-s.stableSelf[i]!)*w*.55);
      }
      const ai=ACTIONS.indexOf(ep.action);
      if(ai>=0){ for(let i=0;i<SELF_DIM;i+=1){ const target=ep.selfAfter[i]!-ep.selfBefore[i]!; s.actionIdentityReadout[ai]![i]=clamp11(s.actionIdentityReadout[ai]![i]!+target*w*.7); } }
      impact+=Math.abs(ep.reward01-.5)*w+ep.importance01*w*.5;
    }
    s.futureSelf=s.futureSelf.map(v=>clamp11(v)); s.stableSelf=s.stableSelf.map(v=>clamp11(v));
    s.selfConsolidations+=1; s.consolidatedEpisodes+=selected.length; s.lastConsolidationTick=Math.max(s.lastConsolidationTick,Math.floor(Number(tick)||0));
    s.continuity01=clamp01(s.continuity01*.93+(1-s.identityConflict01)*.07);
    return {consolidated:selected.length,impact01:clamp01(impact)};
  }
  selfModelDiagnostics(){ return structuredClone(this.state.selfModel); }
  setSelfModelEnabled(enabled:boolean){ this.state.selfModel.enabled=Boolean(enabled); }

  setGoalAuthorshipCandidate(input:{tick:number;candidateId?:string|null;vector?:number[];source?:B365GoalSource;novelty01?:number;confidence01?:number;internalPressure01?:number;homeostaticPressure01?:number;identityContinuity01?:number;autonomy01?:number}){
    const g=this.state.goalAuthorship;
    if(!g.enabled) return {accepted:false,ownership01:0,commitment01:0,revisionPressure01:0,actionBias:g.actionBias.slice()};
    const v=Array.from({length:GOAL_DIM},(_,i)=>clamp11(Number(input.vector?.[i]??0)));
    const novelty=clamp01(input.novelty01??0); const confidence=clamp01(input.confidence01??.35);
    const pressure=clamp01(input.internalPressure01??0); const homeo=clamp01(input.homeostaticPressure01??0); const identity=clamp01(input.identityContinuity01??this.state.selfModel.continuity01); const autonomy=clamp01(input.autonomy01??.5);
    const source=input.source??'unknown';
    const endogenous=source==='internal' ? 1 : source==='external' ? 0 : .35;
    const ownership=clamp01(.34*endogenous+.18*pressure+.16*homeo+.16*identity+.10*autonomy+.06*confidence);
    const commitment=clamp01(.30*ownership+.22*pressure+.18*confidence+.16*(1-this.state.selfModel.identityConflict01)+.14*this.state.allostatic.traits.persistence01);
    const revision=clamp01(.38*this.state.selfModel.identityConflict01+.26*(1-confidence)+.20*this.state.predictionError01+.16*novelty*(1-ownership));
    const bias=ACTIONS.map((_,a)=>clamp11(dot(v,g.readout[a]!)/GOAL_DIM));
    const accepted=source==='internal' && ownership>=.56 && commitment>=.45;
    if(g.candidateId && g.candidateId!== (input.candidateId??null)) g.revisions+=1;
    g.candidateId=input.candidateId??null; g.candidateVector=v; g.candidateSource=source; g.candidateNovelty01=novelty; g.candidateConfidence01=confidence; g.ownership01=ownership; g.commitment01=commitment; g.revisionPressure01=revision; g.actionBias=bias; g.lastTick=input.tick;
    if(accepted) g.acceptedGoals+=1; else if(source!=='unknown') g.rejectedGoals+=1;
    return {accepted,ownership01:ownership,commitment01:commitment,revisionPressure01:revision,actionBias:bias.slice(),candidateId:g.candidateId};
  }
  learnGoalAuthorshipOutcome(input:{tick:number;reward01:number;predictionError01:number;verified01:number;action:ActionKind;independentEvidence01:number}){
    const g=this.state.goalAuthorship; if(!g.enabled || !g.candidateId) return {updated:false,verified:false,revisionDelta01:0};
    const verified=clamp01(input.verified01)>=.99 && clamp01(input.independentEvidence01)>=.65;
    const gain=clamp11((clamp01(input.reward01)-.5)*.9+(0.5-clamp01(input.predictionError01))*.35+(g.ownership01-.5)*.25);
    let revisionDelta=Math.abs(gain)*(1-g.candidateConfidence01)*.06 + g.revisionPressure01*.025;
    if(verified){
      const ai=ACTIONS.indexOf(input.action); const eta=.009*(.35+.65*g.ownership01)*(1-.35*g.revisionPressure01);
      if(ai>=0){ for(let i=0;i<GOAL_DIM;i+=1) g.readout[ai]![i]=clamp11(g.readout[ai]![i]!+g.candidateVector[i]!*gain*eta); }
      g.commitment01=clamp01(g.commitment01+.035*gain); g.ownership01=clamp01(g.ownership01+.028*gain); g.revisionPressure01=clamp01(g.revisionPressure01*.88+(gain<0?.12:.0));
      if(gain<-.08){ g.revisions+=1; }
      g.verifiedOutcomes+=1;
    } else { revisionDelta=clamp01(revisionDelta); }
    g.counterfactualChecks+=1; g.lastAction=input.action; g.lastTick=input.tick;
    g.actionBias=ACTIONS.map((_,a)=>clamp11(dot(g.candidateVector,g.readout[a]!)/GOAL_DIM));
    g.history=[...g.history,{tick:input.tick,id:g.candidateId,source:g.candidateSource,accepted:g.ownership01>=.56,verifiedOutcome:verified,ownership01:g.ownership01,commitment01:g.commitment01,reward01:clamp01(input.reward01),predictionError01:clamp01(input.predictionError01),revisionDelta01:clamp01(revisionDelta),action:input.action}].slice(-GOAL_HISTORY_LIMIT);
    return {updated:true,verified,revisionDelta01:clamp01(revisionDelta),ownership01:g.ownership01,commitment01:g.commitment01,revisionPressure01:g.revisionPressure01};
  }
  goalAuthorshipDiagnostics(){ return structuredClone(this.state.goalAuthorship); }
  setGoalAuthorshipEnabled(enabled:boolean){ this.state.goalAuthorship.enabled=Boolean(enabled); }

  private updateGoalEcologyBeforePolicy(tick:number){
    const e=this.state.goalEcology, g=this.state.goalAuthorship;
    if(!e.enabled || !g.enabled || !g.candidateId) return {bias:ACTIONS.map(()=>0), active:null as B365GoalEcologyMemory|null};
    let m=e.memories.find(x=>x.id===g.candidateId);
    if(!m){
      m={id:g.candidateId,vector:g.candidateVector.slice(),source:g.candidateSource,status:g.ownership01>=.56?'active':'incubating',ownership01:g.ownership01,commitment01:g.commitment01,progress01:0,persistence01:.12,value01:0,resourceCost01:.30,stagnation01:0,priority01:.35,lastReward01:.5,attempts:0,successes:0,failures:0,revisions:0,age:0,lastTick:tick};
      e.memories=[...e.memories,m].slice(-24);
      e.lastTransition=m.status==='active'?'activate':'none'; e.lastTransitionTick=tick;
    }
    const owned=m.ownership01>=.56 && m.commitment01>=.45 && g.candidateSource==='internal';
    if(owned && m.status!=='completed' && m.status!=='abandoned'){
      const hasAlternative=e.memories.some(x=>x.id!==m.id && (x.status==='active'||x.status==='incubating'));
      if(m.status==='paused' && !hasAlternative){m.status='active';e.resumed+=1;e.lastTransition='resume';e.lastTransitionTick=tick;}
      if(g.revisionPressure01>.72 && m.attempts>=2){m.status='paused';e.paused+=1;e.revisions+=1;m.revisions+=1;e.lastTransition='pause';e.lastTransitionTick=tick;}
      else if(m.status==='incubating'){m.status='active';e.lastTransition='activate';e.lastTransitionTick=tick;}
    }
    m.age+=1; m.lastTick=tick; m.ownership01=clamp01(m.ownership01*.94+g.ownership01*.06); m.commitment01=clamp01(m.commitment01*.94+g.commitment01*.06);
    m.value01=clamp01(m.value01*.90 + (g.ownership01*.35+g.commitment01*.28+(1-g.revisionPressure01)*.22+this.state.selfModel.continuity01*.15)*.10);
    if(owned) e.autonomousCycles+=1; if(owned&&m.age>1) e.selfContinuationCycles+=1;
    const candidates=e.memories.filter(x=>x.status==='active'||x.status==='incubating').slice(-8);
    if(candidates.length){
      const scores=candidates.map(x=>clamp01(.34*x.ownership01+.26*x.commitment01+.18*x.progress01+.14*x.persistence01+.08*x.value01));
      const total=scores.reduce((a,b)=>a+b,0)||1;
      const probs=scores.map(s=>s/total);
      const entropy=-probs.reduce((sum,p)=>sum+(p>1e-9?p*Math.log(p)/Math.log(Math.max(2,probs.length)):0),0); e.competitionEntropy01=clamp01(entropy);
    }
    // B377: endogenous life-course arbitration. Goal ecology can switch between already-known goals
    // without external reseeding when the current goal is stale, conflicted, paused, or too costly.
    const resourceBudget=clamp01(.62+.22*this.state.allostatic.levels.capacity01-.20*this.state.allostatic.deficits.energy01-.16*this.state.allostatic.deficits.coherence01);
    const conflict=Math.max(0,...candidates.filter(x=>x.id!==m.id).map(x=>1-cosine(m.vector,x.vector)));
    const currentStagnation=clamp01(m.stagnation01);
    const switchPressure=clamp01(.42*currentStagnation+.24*g.revisionPressure01+.18*(1-m.persistence01)+.16*conflict*(1-resourceBudget));
    e.resourceBudget01=resourceBudget; e.conflict01=clamp01(conflict); e.switchPressure01=switchPressure; e.stagnation01=currentStagnation;
    let best=m; let bestScore=-Infinity;
    for(const c of candidates){
      const affordance=clamp01(.58+.42*resourceBudget-c.resourceCost01*.45);
      const statusPenalty=c.status==='paused'?.16:c.status==='abandoned'?.32:c.status==='completed'?1:0;
      const score=.27*c.ownership01+.22*c.commitment01+.18*c.value01+.14*c.persistence01+.10*c.progress01+.09*affordance-.10*c.stagnation01-statusPenalty;
      c.priority01=clamp01(score);
      if((c.status==='active'||c.status==='incubating') && score>bestScore){best=c;bestScore=score;}
    }
    const currentStatusPenalty=m.status==='paused'?.16:m.status==='abandoned'?.32:m.status==='completed'?1:0;
    const currentGoalPriority=clamp01(.27*m.ownership01+.22*m.commitment01+.18*m.value01+.14*m.persistence01+.10*m.progress01+.09*clamp01(.58+.42*resourceBudget-m.resourceCost01*.45)-.10*m.stagnation01-currentStatusPenalty);
    m.priority01=currentGoalPriority;
    if(best.id!==m.id){
      if((m.status==='paused'||m.status==='abandoned'||switchPressure>=.62) && bestScore>currentGoalPriority+.045){
        const previous=m.id;
        if(m.status==='active') m.status='paused';
        best.status='active'; best.age+=1;
        e.activeId=best.id; e.totalSwitches+=1; e.autonomousReplans+=1; e.lastTransition='switch'; e.lastTransitionTick=tick; e.lastDecisionReason=m.status==='paused'?'paused-current':'stagnant-or-conflicted'; e.lastArbitrationTick=tick;
        g.candidateId=best.id; g.candidateVector=best.vector.slice(); g.candidateSource=best.source; g.ownership01=best.ownership01; g.commitment01=best.commitment01; g.candidateNovelty01=clamp01(.30+best.stagnation01*.30); g.candidateConfidence01=clamp01(.52+best.value01*.22+best.persistence01*.16); g.revisionPressure01=clamp01(.08+best.stagnation01*.20);
        g.actionBias=ACTIONS.map((_,a)=>clamp11(dot(best.vector,g.readout[a]!)/GOAL_DIM));
      } else { e.rejectedSwitches+=1; e.lastDecisionReason='insufficient-margin'; e.lastArbitrationTick=tick; }
    } else { e.lastDecisionReason='continue-current'; e.lastArbitrationTick=tick; }
    const live=e.memories.find(x=>x.id===g.candidateId)??best;
    e.activeId=(live.status==='active'||live.status==='incubating')?live.id:e.activeId;
    e.currentProgress01=live.progress01; e.persistence01=clamp01(e.persistence01*.95+live.persistence01*.05);
    e.lifeCourse01=clamp01(e.lifeCourse01*.96 + (.45*live.progress01+.25*live.persistence01+.20*(1-live.stagnation01)+.10*resourceBudget)*.04);
    const bias=g.actionBias.map((v,a)=>clamp11(v*(0.22+0.28*live.ownership01+0.18*live.commitment01+0.10*live.persistence01)));
    return {bias,active:live};
  }

  private updateGoalEcologyFromOutcome(input:{tick:number;reward01:number;predictionError01:number;verified01:number;externalEvidence01:number;action:ActionKind}){
    const e=this.state.goalEcology, g=this.state.goalAuthorship; if(!e.enabled||!g.candidateId) return {transition:'none' as const,progress01:e.currentProgress01};
    const m=e.memories.find(x=>x.id===g.candidateId); if(!m) return {transition:'none' as const,progress01:e.currentProgress01};
    const verified=clamp01(input.verified01)>=.99&&clamp01(input.externalEvidence01)>=.65;
    if(!verified){ e.lastTransition='none'; return {transition:'none' as const,progress01:m.progress01}; }
    const gain=clamp11((clamp01(input.reward01)-.5)*1.10+(1-clamp01(input.predictionError01))*.20-.18*m.persistence01);
    m.attempts+=1; m.lastTick=input.tick;
    m.lastReward01=clamp01(input.reward01);
    const resourceLoad=clamp01(.18 + .24*this.state.allostatic.deficits.energy01 + .18*this.state.allostatic.deficits.capacity01 + (input.action==='explore'||input.action==='respond'?.12:.06));
    m.resourceCost01=clamp01(m.resourceCost01*.92+resourceLoad*.08);
    if(gain>0){m.successes+=1;m.progress01=clamp01(m.progress01+.07*Math.abs(gain)+.012);m.persistence01=clamp01(m.persistence01+.018);m.value01=clamp01(m.value01+.024*Math.abs(gain));m.stagnation01=clamp01(m.stagnation01*.82-.08*Math.abs(gain));}
    else {m.failures+=1;m.progress01=clamp01(m.progress01-.028*Math.abs(gain));m.persistence01=clamp01(m.persistence01-.012);m.stagnation01=clamp01(m.stagnation01*.90+.08*Math.abs(gain));}
    let transition:'none'|'complete'|'pause'|'abandon'='none';
    if(m.progress01>=.90 && m.successes>=3){m.status='completed';e.completed+=1;transition='complete';}
    else if(m.failures>=3 && m.attempts>=5 && m.progress01<.16){m.status='abandoned';e.abandoned+=1;transition='abandon';}
    else if(m.failures>=2 && input.predictionError01>.62){m.status='paused';e.paused+=1;transition='pause';}
    if(transition!=='none'){e.lastTransition=transition;e.lastTransitionTick=input.tick;}
    e.currentProgress01=m.progress01;e.persistence01=clamp01(e.persistence01*.94+m.persistence01*.06);
    // Verified completion creates a successor from the learned goal vector, so long-horizon autonomy can continue without external reseeding.
    if(transition==='complete'){
      const successorId=`${m.id}:successor:${e.successorCreations+1}`;
      const successorVector=m.vector.map((v,i)=>clamp11(v*.91+rand(790_000+(e.successorCreations*17)+i,.045)));
      const successor:B365GoalEcologyMemory={id:successorId,vector:successorVector,source:'internal',status:'incubating',ownership01:clamp01(g.ownership01*.92),commitment01:clamp01(g.commitment01*.86),progress01:0,persistence01:clamp01(.18+m.persistence01*.35),value01:clamp01(.24+m.value01*.40),resourceCost01:clamp01(.22+m.resourceCost01*.70),stagnation01:0,priority01:clamp01(.34+m.value01*.18),lastReward01:.5,attempts:0,successes:0,failures:0,revisions:0,age:0,lastTick:input.tick};
      e.memories=[...e.memories,successor].slice(-24); e.activeId=successorId;e.successorCreations+=1;
      // Promote the successor into the live B365 goal state without external reseeding.
      g.candidateId=successorId;
      g.candidateVector=successorVector.slice();
      g.candidateSource='internal';
      g.candidateNovelty01=clamp01(.34+m.value01*.44);
      g.candidateConfidence01=clamp01(.56+m.value01*.24+m.persistence01*.12);
      g.ownership01=successor.ownership01;
      g.commitment01=successor.commitment01;
      g.revisionPressure01=clamp01(.12*(1-successor.value01));
      g.actionBias=ACTIONS.map((_,a)=>clamp11(dot(successorVector,g.readout[a]!)/GOAL_DIM));
      g.lastTick=input.tick;
    }
    return {transition,progress01:m.progress01};
  }

  goalEcologyDiagnostics(){return structuredClone(this.state.goalEcology);}
  setGoalEcologyEnabled(enabled:boolean){this.state.goalEcology.enabled=Boolean(enabled);}

  private updateAllostaticDynamics(input:{novelty01:number;uncertainty01:number;goalPressure01:number;autonomy01:number}){
    const a=this.state.allostatic; const g=this.state.grounding;
    const observed={energy01:clamp01(g.observations>0?g.lastEnergy01:.62),thermal01:clamp01(g.observations>0?g.lastThermal01:.28),uncertainty01:clamp01(input.uncertainty01),novelty01:clamp01(input.novelty01),coherence01:clamp01(this.state.selfCoherence01),capacity01:clamp01(.45+.35*(1-input.goalPressure01)+.20*this.state.sparseActivity01)};
    for(const key of Object.keys(observed) as Array<keyof typeof observed>){ a.levels[key]=clamp01(a.levels[key]*.86+observed[key]*.14); const t=a.setpoints[key]; const raw=(key==='uncertainty01'||key==='novelty01')?Math.max(0,a.levels[key]-t):Math.max(0,t-a.levels[key]); a.deficits[key]=clamp01(a.deficits[key]*.86+raw*.14); }
    const distress=clamp01(a.deficits.energy01*.28+a.deficits.thermal01*.20+a.deficits.uncertainty01*.18+a.deficits.coherence01*.18+a.deficits.capacity01*.16);
    a.drive01=clamp01(a.drive01*.91+distress*.09+(a.deficits.uncertainty01*.58+a.deficits.novelty01*.42)*.06);
    a.arousal01=clamp01(a.arousal01*.90+(input.goalPressure01*.45+input.autonomy01*.20+a.drive01*.35)*.10);
    a.exploration01=clamp01(a.exploration01*.92+(.44*a.traits.curiosity01+.32*a.traits.noveltySeeking01+.24*a.deficits.uncertainty01)*.08);
    a.preservation01=clamp01(a.preservation01*.92+(a.deficits.energy01*.55+a.deficits.thermal01*.45)*.08);
    a.reflection01=clamp01(a.reflection01*.92+(a.deficits.coherence01*.55+a.deficits.uncertainty01*.45)*.08);
    a.socialApproach01=clamp01(a.socialApproach01*.94+(input.autonomy01*.5+a.traits.socialAttunement01*.5)*.06);
    const m=[.42*a.socialApproach01+.24*a.reflection01+.18*a.traits.socialAttunement01-.18*a.preservation01,.40*a.exploration01+.26*a.deficits.uncertainty01+.22*a.traits.curiosity01+.12*a.traits.noveltySeeking01-.24*a.traits.caution01*a.preservation01,.46*a.deficits.uncertainty01+.26*a.reflection01+.20*a.traits.caution01-.12*a.preservation01,.55*a.preservation01+.20*a.deficits.capacity01+.15*a.traits.restSeeking01+.10*a.deficits.thermal01,.38*a.reflection01+.30*a.deficits.coherence01+.22*a.traits.caution01+.10*a.traits.persistence01,.40*(1-a.drive01)+.25*a.preservation01+.20*(1-a.arousal01)+.15*a.traits.caution01,.32*a.deficits.uncertainty01+.24*a.preservation01+.22*a.traits.caution01+.18*a.traits.persistence01];
    a.actionMotivation=m.map(v=>clamp11(v-.22)); a.lastTick=this.state.tick;
  }
  setAllostaticDriveEnabled(enabled:boolean){ this.state.allostatic.enabled=Boolean(enabled); }
  allostaticDiagnostics(){ return structuredClone(this.state.allostatic); }

  step(input: B365StepInput): B365StepResult {
    const x = Array.from({ length: INPUT_DIM }, (_, i) => clamp11(Number(input.vector[i] ?? 0)));
    const dopamine = clamp01(input.dopamine01 ?? 0.5);
    const norepinephrine = clamp01(input.norepinephrine01 ?? 0.5);
    const acetylcholine = clamp01(input.acetylcholine01 ?? 0.5);
    const novelty = clamp01(input.novelty01 ?? 0.2);
    const uncertainty = clamp01(input.uncertainty01 ?? 0.5);
    const inputPredictionError = clamp01(input.predictionError01 ?? 0.1);
    const goalPressure = clamp01(input.goalPressure01 ?? 0.5);
    const autonomy = clamp01(input.autonomy01 ?? 0.5);
    const temporalLife = {
      temporalRegulation01: clamp01(input.temporalLife?.temporalRegulation01 ?? 0.5),
      homeostaticPressure01: clamp01(input.temporalLife?.homeostaticPressure01 ?? 0.25),
      consolidationPressure01: clamp01(input.temporalLife?.consolidationPressure01 ?? 0.2),
      experienceSalience01: clamp01(input.temporalLife?.experienceSalience01 ?? 0.2),
      continuity01: clamp01(input.temporalLife?.continuity01 ?? 0.8),
      sleepPressure01: clamp01(input.temporalLife?.sleepPressure01 ?? 0.15),
      resourceUrgency01: clamp01(input.temporalLife?.resourceUrgency01 ?? 0.2),
      learningGate01: clamp01(input.temporalLife?.learningGate01 ?? 0.5),
    };
    if (input.goalAuthorship) this.setGoalAuthorshipCandidate({ tick:input.tick, ...input.goalAuthorship });
    const goalAuth = this.state.goalAuthorship;
    const mod = clamp01(
      dopamine * 0.38 + norepinephrine * 0.20 + acetylcholine * 0.14 + novelty * 0.10 + autonomy * 0.08 + temporalLife.experienceSalience01 * 0.06 + temporalLife.temporalRegulation01 * 0.04,
    );
    const contexts = this.actionContextArray(input.actionContext);
    this.updateAllostaticDynamics({novelty01:novelty,uncertainty01:uncertainty,goalPressure01:goalPressure,autonomy01:autonomy});
    if (input.temporalLife) {
      this.state.allostatic.drive01 = clamp01(this.state.allostatic.drive01 * 0.94 + temporalLife.experienceSalience01 * 0.03 + temporalLife.homeostaticPressure01 * 0.03);
      this.state.allostatic.reflection01 = clamp01(this.state.allostatic.reflection01 * 0.94 + temporalLife.consolidationPressure01 * 0.06);
      this.state.allostatic.preservation01 = clamp01(this.state.allostatic.preservation01 * 0.94 + temporalLife.resourceUrgency01 * 0.06);
    }

    let previous = this.state.lastSpikes.slice();
    const all: number[] = [];
    let totalSpikes = 0;

    for (let areaIndex = 0; areaIndex < AREAS.length; areaIndex += 1) {
      const area = this.state.areas[AREAS[areaIndex]!]!;
      const offset = this.areaOffset(areaIndex);
      const nextMem = new Array(N_PER_AREA).fill(0);
      const spikes = new Array(N_PER_AREA).fill(0);
      let localSpikeCount = 0;

      for (let i = 0; i < N_PER_AREA; i += 1) {
        let z = 0.16
          + x[(areaIndex * 11 + i) % INPUT_DIM]! * 0.42
          + x[(i + 7) % INPUT_DIM]! * 0.18
          + goalPressure * 0.08;
        for (const synapse of this.state.synapses) {
          if (!synapse.active || synapse.post !== offset + i) continue;
          z += synapse.weight * (previous[synapse.pre] ?? 0) * 1.35;
        }
        if (areaIndex > 0) z += (this.state.areas[AREAS[areaIndex - 1]!]!.spikes[i] ?? 0) * 0.16;
        nextMem[i] = area.membrane[i]! * 0.79 + z - area.adaptation[i]! * 0.11 - (area.threshold[i]! - 0.34) * 0.35;
        if (area.threshold[i]! <= nextMem[i]! && area.adaptation[i]! < 0.88) {
          spikes[i] = 1;
          nextMem[i] = 0;
        }
      }

      const wanted = Math.max(2, Math.floor(N_PER_AREA * 0.18));
      const spikeIds = spikes.map((value, index) => (value ? index : -1)).filter((index) => index >= 0);
      if (spikeIds.length > wanted) {
        const keep = new Set(spikeIds.slice(0, wanted));
        for (const id of spikeIds) if (!keep.has(id)) spikes[id] = 0;
      }

      for (let i = 0; i < N_PER_AREA; i += 1) {
        area.membrane[i] = nextMem[i]!;
        area.spikes[i] = spikes[i]!;
        area.adaptation[i] = clamp01(area.adaptation[i]! * 0.91 + spikes[i]! * 0.12);
        const rate = spikes.reduce((sum, value) => sum + value, 0) / N_PER_AREA;
        area.threshold[i] = Math.max(0.18, Math.min(0.95, area.threshold[i]! + (0.08 - rate) * 0.002));
      }
      localSpikeCount = spikes.reduce((sum, value) => sum + value, 0);
      area.firingRate01 = area.firingRate01 * 0.9 + (localSpikeCount / N_PER_AREA) * 0.1;
      area.neuromodulation01 = area.neuromodulation01 * 0.88 + mod * 0.12;
      previous = spikes;
      all.push(...spikes);
      totalSpikes += localSpikeCount;
    }

    const recurrentActive = this.state.synapses.filter((synapse) => synapse.active);
    let recurrentNumerator = 0;
    let recurrentMass = 0;
    for (const synapse of recurrentActive) {
      recurrentNumerator += synapse.weight * (all[synapse.pre] ?? 0);
      recurrentMass += Math.abs(synapse.weight);
    }
    const recurrentSignal = recurrentMass > 1e-9 ? clamp11(recurrentNumerator / recurrentMass) : 0;

    const latent = all.map((value, index) => clamp11(0.65 * value + 0.35 * (this.state.lastLatent[index] ?? 0) * 0.82));
    const rewardPrediction = sigmoid(0.5 + dot(latent, this.state.rewardReadout) / (N * 0.16) + recurrentSignal * 1.7);
    const needPrediction = sigmoid(0.5 + dot(latent, this.state.needReadout) / (N * 0.12) + (1 - totalSpikes / N) * 0.55);
    const prediction = sigmoid(0.5 + recurrentSignal * 2.2 + (0.5 - rewardPrediction) * 0.55);
    const neuralPredictionError = clamp01(Math.abs(prediction - (this.state.prediction01 ?? 0.5)) * 0.72 + inputPredictionError * 0.28);

    const neuralConfidence = clamp01(
      0.25 * this.state.recurrentCoherence01
      + 0.20 * Math.abs(rewardPrediction - 0.5) * 2
      + 0.18 * this.state.plasticity01
      + 0.12 * this.state.selfCoherence01
      + 0.10 * acetylcholine
      + 0.08 * (1 - uncertainty)
      + 0.07 * autonomy,
    );

    const temporalValues = ACTIONS.map((_, action) => clamp11((this.state.temporalCreditByAction[action] ?? 0) * 0.9));
    const contextVector = [dopamine - 0.5, norepinephrine - 0.5, acetylcholine - 0.5, novelty - 0.5, uncertainty - 0.5, goalPressure - 0.5, autonomy - 0.5];
    const contextLogits = ACTIONS.map((_, action) => dot(contextVector, this.state.contextActionReadout[action]!));
    const allostaticLogits=this.state.allostatic.enabled?this.state.allostatic.actionMotivation.map((d,action)=>d*(.72+.68*this.state.allostatic.arousal01)+((ACTIONS[action]==='explore'?this.state.allostatic.exploration01:ACTIONS[action]==='rest'?this.state.allostatic.preservation01:ACTIONS[action]==='reflect'?this.state.allostatic.reflection01:0)*.22)):ACTIONS.map(()=>0);
    const selfField=this.updateSelfModelBeforePolicy(latent,contexts,this.state.allostatic.drive01);
    const g = this.state.grounding;
    const groundingVector = [
      g.lastEnergy01 - 0.5,
      (1 - g.lastThermal01) - 0.5,
      g.lastMotion01 - 0.5,
      g.lastLight01 - 0.5,
      g.lastProximity01 - 0.5,
      g.lastNetwork01 - 0.5,
    ];
    const groundingReliability = clamp01(0.18 + 0.42 * g.freshness01 + 0.40 * g.sensorConfidence01) * (0.35 + 0.65 * g.verified01);
    const groundingLogits = ACTIONS.map((_, action) => dot(groundingVector, this.state.groundingActionReadout[action]!) * 2.4 * groundingReliability);
    const goalEcology = this.updateGoalEcologyBeforePolicy(input.tick);
    const goalAuthLogits = goalAuth.enabled ? goalAuth.actionBias.map(v=>v*(0.28 + 0.42*goalAuth.ownership01 + 0.18*goalAuth.commitment01)) : ACTIONS.map(()=>0);
    const goalEcologyLogits = goalEcology.bias.map(v=>v*(0.16+0.20*(goalEcology.active?.ownership01??0)+0.16*(goalEcology.active?.persistence01??0)));
    const developmentalActionLogits=ACTIONS.map((_,action)=>{ if(!this.state.developmentalMemory.enabled)return 0; const v=this.state.developmentalMemory.actionValue01[action]??.5; const c=this.state.developmentalMemory.actionConfidence01[action]??.15; const n=this.state.developmentalMemory.actionNovelty01[action]??.2; const contradiction=this.state.developmentalMemory.contradiction01; return (v-.5)*(.22+.20*c+.08*n)*(1-.35*contradiction); });
    const developmentContext=Array.from({length:8},(_,i)=>clamp01(Number(input.developmentContext01?.[i] ?? (Math.abs(input.vector?.[i] ?? 0)+1)/2)));
    const contextualActionLogits=ACTIONS.map((_,action)=>{
      if(!this.state.contextualDevelopmental.enabled)return 0;
      const matches=this.state.contextualDevelopmental.profiles.filter(p=>p.action===ACTIONS[action]).map(p=>({p,sim:contextSimilarity(developmentContext,p.context)})).filter(x=>x.sim>.58);
      if(!matches.length)return 0;
      matches.sort((a,b)=>(b.sim*b.p.confidence01)-(a.sim*a.p.confidence01));
      const top=matches.slice(0,4);
      const weight=top.reduce((sum,x)=>sum+x.sim*Math.max(.05,x.p.confidence01)*(1-.45*x.p.conflict01),0);
      const score=weight>1e-9?top.reduce((sum,x)=>sum+(x.p.value01-.5)*x.sim*Math.max(.05,x.p.confidence01)*(1-.45*x.p.conflict01),0)/weight:0;
      const hypotheses=this.state.contextualDevelopmental.hypotheses.filter(h=>h.action===ACTIONS[action]).map(h=>({h,sim:contextSimilarity(developmentContext,h.context)})).filter(x=>x.sim>.60).sort((a,b)=>b.sim-a.sim).slice(0,3);
      const hWeight=hypotheses.reduce((sum,x)=>sum+x.sim*(0.25+0.75*x.h.confidence01)*(1-.35*x.h.conflict01),0);
      const hScore=hWeight>1e-9?hypotheses.reduce((sum,x)=>sum+(x.h.dominant01-.5)*x.sim*(0.25+0.75*x.h.confidence01)*(1-.35*x.h.conflict01),0)/hWeight:0;
      this.state.contextualDevelopmental.retrievals+=1;
      return clamp11(score*.76+hScore*.24)*(1.65+2.35*Math.min(1,weight));
    });
    const autobiographicalState=this.state.autobiographicalValueGoal;
    const autobiographicalHistoryGate=autobiographicalState.enabled?clamp01((autobiographicalState.autobiographicalBinding01-.05)/.25):0;
    const autobiographicalLogits=autobiographicalHistoryGate>0 ? ACTIONS.map((action)=>{
      const av=autobiographicalState;
      const active=av.goalCouplings.length&&this.state.goalEcology.activeId?av.goalCouplings.find(g=>g.goalId===this.state.goalEcology.activeId):null;
      const vals=av.values;
      const truth=vals[0]?.value01??.5,evidence=vals[1]?.value01??.5,autonomy=vals[2]?.value01??.5,responsibility=vals[3]?.value01??.5;
      const curiosity=vals[4]?.value01??.5,preservation=vals[5]?.value01??.5,connection=vals[6]?.value01??.5,novelty=vals[7]?.value01??.5;
      let score=((truth+evidence+autonomy+responsibility+curiosity+preservation+connection+novelty)-4)/8;
      if(action==='verify')score+=(truth+evidence-1)*.7;
      else if(action==='explore')score+=(curiosity+novelty-1)*.7;
      else if(action==='respond')score+=(connection+responsibility-1)*.55;
      else if(action==='rest')score+=(preservation-.5)*.7;
      else if(action==='reflect')score+=(responsibility+autonomy+truth-1.5)*.42;
      else if(action==='defer')score+=(truth+evidence-autonomy-.5)*.22;
      if(active){ const alignment=active.values.reduce((sum,x,i)=>sum+Math.abs((x??.5)-(vals[i]?.value01??.5)),0)/8; score-=alignment*.65; }
      const conflictPenalty=av.contradictionCount>0?clamp01(av.contradictionCount/24)*.18:0;
      const episodicMatches=av.explicitQueries>0 ? av.episodes.filter(e=>e.action===action).map(e=>({e,sim:contextSimilarity(developmentContext,e.context),weight:e.significance01*(.35+.65*e.verified01)})).filter(x=>x.sim>.58).sort((a,b)=>(b.sim*b.weight)-(a.sim*a.weight)).slice(0,6) : [];
      const episodicEvidence=episodicMatches.length?episodicMatches.reduce((sum,x)=>sum+(x.e.reward01-.5)*x.sim*x.weight,0)/Math.max(.01,episodicMatches.reduce((sum,x)=>sum+x.sim*x.weight,0)):0;
      const episodicBinding=clamp11(episodicEvidence*4.50);
      return clamp11((score*(.30+.70*av.coherence01)+episodicBinding*.38-conflictPenalty)*autobiographicalHistoryGate);
    }) : ACTIONS.map(()=>0);
    const autobiographicalRevisionBias=this.state.autobiographicalValueGoal.enabled?clamp01(this.state.autobiographicalValueGoal.autobiographicalBinding01*.42+this.state.autobiographicalValueGoal.identityContinuity01*.22+this.state.autobiographicalValueGoal.coherence01*.18):0;
    const temporalActionShaping = ACTIONS.map((action) => {
      const restLike = action==='rest' || action==='wait' || action==='defer' || action==='reflect' ? 1 : 0;
      const activeLike = action==='explore' || action==='verify' || action==='respond' ? 1 : 0;
      return restLike * (temporalLife.homeostaticPressure01*.20 + temporalLife.consolidationPressure01*.22 + temporalLife.resourceUrgency01*.14 + temporalLife.sleepPressure01*.12)
        + activeLike * (temporalLife.experienceSalience01*.10 + temporalLife.learningGate01*.08 + temporalLife.temporalRegulation01*.06);
    });
    const baseLogits = ACTIONS.map((_, action) => dot(latent, this.state.actionReadout[action]!) / (N * 0.15) + contextLogits[action]! * 2.4 + groundingLogits[action]! + temporalValues[action]! * 1.15 + allostaticLogits[action]! * 1.65 + selfField.actionScores[action]! * (0.18 + .22) + goalAuthLogits[action]! + goalEcologyLogits[action]! + developmentalActionLogits[action]! + contextualActionLogits[action]! * (1.65 + 0.85 * (this.state.contextualDevelopmental.enabled ? 1 : 0)) + autobiographicalLogits[action]! * (2.60 + 1.80 * autobiographicalRevisionBias) + temporalActionShaping[action]!);
    const forecastUtilities = contexts.map((context, action) => {
      const head = this.state.actionForecasts[ACTIONS[action]!]!;
      const learnedForecast = clamp01(0.65 * head.utility01 + 0.35 * head.reward01);
      const neuralForecast = sigmoid(
        0.5
        + dot(latent, this.state.forecastReadout[action]!) / (N * 0.095)
        + this.state.forecastBias[action]!
        + recurrentSignal * 0.35,
      );
      const neuralWeight = clamp01(0.35 + 0.55 * neuralConfidence + 0.10 * head.confidence01);
      const internalForecast = learnedForecast * (1 - neuralWeight) + neuralForecast * neuralWeight;
      const externalPrecision = clamp01(context.worldConfidence01 * (1 - context.worldUncertainty01));
      return clamp01(
        internalForecast * (0.72 + 0.16 * externalPrecision)
        + context.worldUtility01 * (0.18 + 0.18 * externalPrecision)
        + context.needRelief01 * 0.04
        - context.predictedCost01 * 0.04,
      );
    });

    const meanForecast = forecastUtilities.reduce((sum, value) => sum + value, 0) / ACTIONS.length;
    const worldUtilities = contexts.map((context) => context.worldUtility01);
    const worldMean = worldUtilities.reduce((sum, value) => sum + value, 0) / ACTIONS.length;
    const modelAgreement = clamp01(
      1 - worldUtilities.reduce((sum, world, index) => sum + Math.abs(world - forecastUtilities[index]!), 0) / ACTIONS.length,
    );
    const counterfactualScores = forecastUtilities.map((value, index) =>
      clamp11((value - meanForecast) * (0.75 + neuralConfidence * 1.25) + (worldUtilities[index]! - worldMean) * 0.25),
    );
    const divergence = clamp01(counterfactualScores.reduce((sum, value) => sum + Math.abs(value), 0) / ACTIONS.length * 1.8);

    const readoutGain = 1.8 + 2.6 * neuralConfidence + 0.5 * divergence;
    const temperature = Math.max(0.055, 0.14 - 0.055 * neuralConfidence - 0.018 * modelAgreement + temporalLife.resourceUrgency01*.016 - temporalLife.temporalRegulation01*.008);
    const logits = baseLogits.map((value, index) => value * readoutGain + counterfactualScores[index]! * 2.20);
    const baseProbabilities = softmax(logits, temperature);
    const predictiveFieldTemperature = Math.max(0.08, 0.20 - 0.05 * neuralConfidence);
    const predictiveField = softmax(counterfactualScores, predictiveFieldTemperature);
    const autobiographicalField = softmax(autobiographicalLogits, 0.22);
    const probabilitiesRaw = baseProbabilities.map((probability, index) =>
      probability * 0.68 + predictiveField[index]! * 0.22 + autobiographicalField[index]! * 0.10,
    );
    const probabilityTotal = probabilitiesRaw.reduce((sum, value) => sum + value, 0) || 1;
    const probabilities = probabilitiesRaw.map((value) => value / probabilityTotal);
    const selected = ACTIONS[probabilities.indexOf(Math.max(...probabilities))] ?? 'wait';
    const entropy = -probabilities.reduce(
      (sum, probability) => sum + (probability > 1e-9 ? probability * Math.log(probability) / Math.log(ACTIONS.length) : 0),
      0,
    );

    for (let i = 0; i < N; i += 1) {
      const active = all[i] ?? 0;
      this.state.eligibility[i] = clamp01(this.state.eligibility[i]! * 0.86 + active * 0.24);
    }
    for (const synapse of recurrentActive) {
      synapse.eligibility01 = clamp01(
        synapse.eligibility01 * 0.87
        + (all[synapse.post] ?? 0) * (this.state.eligibility[synapse.post] ?? 0) * 0.2,
      );
      synapse.usage01 = clamp01(synapse.usage01 * 0.995 + (all[synapse.post] ?? 0) * 0.005);
      synapse.age += 1;
    }

    this.state.tick = input.tick;
    this.state.cycles += 1;
    this.state.neuromodulation01 = this.state.neuromodulation01 * 0.9 + mod * 0.1;
    this.state.lastInput = x;
    this.state.lastLatent = latent;
    this.state.lastSpikes = all;
    this.state.lastAction = selected;
    this.state.lastActionProbabilities = probabilities;
    this.state.lastForecastUtilities = forecastUtilities;
    this.state.lastWorldUtilities = worldUtilities;
    this.state.lastWorldConfidence = contexts.map((item) => item.worldConfidence01);
    this.state.lastCounterfactualScore = counterfactualScores;
    this.state.rewardPrediction01 = rewardPrediction;
    this.state.nextNeedPrediction01 = needPrediction;
    this.state.prediction01 = prediction;
    this.state.predictionError01 = neuralPredictionError;
    this.state.interoceptivePressure01 = clamp01(0.55 * (1 - (x[0] ?? 0) * 0.5) + 0.45 * this.state.areas.interoception.firingRate01);
    this.state.exteroceptiveNovelty01 = clamp01(0.5 + (x[12] ?? 0) * 0.5);
    this.state.selfCoherence01 = clamp01(0.5 + 0.5 * Math.tanh((x[42] ?? 0) * 1.6 + recurrentSignal));
    this.state.goalField01 = clamp01(0.42*goalPressure+0.20*autonomy+0.18*needPrediction+0.20*this.state.allostatic.drive01);
    if(this.state.selfModel.enabled){ const s=this.state.selfModel; const current=s.currentSelf; const stableError=1-this.selfCosine(current,s.stableSelf); s.identityConflict01=clamp01(s.identityConflict01*.92+stableError*.08); s.continuity01=clamp01(s.continuity01*.94+(1-stableError)*.06); s.growthReadiness01=clamp01(s.growthReadiness01*.95+(this.state.exteroceptiveNovelty01*.22+this.state.predictionError01*.18+this.state.allostatic.exploration01*.20)*.05); }
    this.state.actionEntropy01 = entropy;
    this.state.plasticity01 = clamp01(
      this.state.plasticity01 * 0.97
      + Math.abs(0.5 - rewardPrediction) * 0.02
      + Math.abs(0.5 - needPrediction) * 0.02
      + divergence * 0.01,
    );
    this.state.sparseActivity01 = clamp01(1 - totalSpikes / N);
    this.state.recurrentCoherence01 = clamp01(0.5 + 0.5 * recurrentSignal);
    this.state.neuralConfidence01 = neuralConfidence;
    this.state.modelAgreement01 = modelAgreement;
    this.state.counterfactualDivergence01 = divergence;
    this.state.pendingTemporalTraces = [...this.state.pendingTemporalTraces, { tick: input.tick, action: selected, rewardPrediction01: rewardPrediction, confidence01: neuralConfidence, latent: latent.slice(0, N), forecastUtility01: forecastUtilities[ACTIONS.indexOf(selected)] ?? 0.5 }].slice(-TEMPORAL_WINDOW);
    if ((input.learningEnabled ?? true) && this.state.cycles % 24 === 0) {
      this.structuralPlasticity(mod, novelty);
    }
    if ((input.learningEnabled ?? true) && this.state.selfModel.enabled && this.state.cycles % 32 === 0) {
      this.consolidateSelfBiography(input.tick);
    }

    const actionProbabilities = Object.fromEntries(
      ACTIONS.map((action, index) => [action, clamp01(probabilities[index]!)]),
    ) as Record<ActionKind, number>;
    const forecastMap = Object.fromEntries(
      ACTIONS.map((action, index) => [action, forecastUtilities[index]!]),
    ) as Record<ActionKind, number>;

    return {
      actionProbabilities,
      selectedAction: selected,
      latent,
      prediction01: prediction,
      rewardPrediction01: rewardPrediction,
      nextNeedPrediction01: needPrediction,
      predictionError01: neuralPredictionError,
      plasticity01: this.state.plasticity01,
      neuromodulation01: this.state.neuromodulation01,
      sparseActivity01: this.state.sparseActivity01,
      recurrentCoherence01: this.state.recurrentCoherence01,
      neuralConfidence01: neuralConfidence,
      readoutGain,
      policyTemperature: temperature,
      modelAgreement01: modelAgreement,
      counterfactualDivergence01: divergence,
      forecastUtilities: forecastMap,
      selfAgency01:this.state.selfModel.agency01,
      selfContinuity01:this.state.selfModel.continuity01,
      selfIdentityConflict01:this.state.selfModel.identityConflict01,
      selfGrowthReadiness01:this.state.selfModel.growthReadiness01,
      allostaticDrive01:this.state.allostatic.drive01,
      allostaticPreservation01:this.state.allostatic.preservation01,
      allostaticExploration01:this.state.allostatic.exploration01,
      allostaticReflection01:this.state.allostatic.reflection01,
      allostaticActionMotivation:Object.fromEntries(ACTIONS.map((action,index)=>[action,this.state.allostatic.actionMotivation[index]??0])) as Record<ActionKind,number>,
      goalOwnership01:this.state.goalAuthorship.ownership01, goalCommitment01:this.state.goalAuthorship.commitment01, goalRevisionPressure01:this.state.goalAuthorship.revisionPressure01,
    };
  }

  learnFromOutcome(input: {
    tick: number;
    action: ActionKind | null;
    reward01: number;
    predictionError01: number;
    verified01: number;
    novelty01?: number;
    externalEvidence01?: number;
    predictedReward01?: number;
    predictedUtility01?: number;
    actualUtility01?: number;
    actualStateDelta01?: number;
    actualWorldConfidence01?: number;
    temporalCreditEnabled?: boolean;
    delayedReward01?: number;
  }) {
    const action = input.action ?? this.state.lastAction ?? 'wait';
    const actionIndex = ACTIONS.indexOf(action);
    const delayedReward = clamp01(input.delayedReward01 ?? input.reward01);
    if (input.temporalCreditEnabled !== false && actionIndex >= 0) {
      let decay = 1;
      let aggregate = 0;
      for (let j = this.state.pendingTemporalTraces.length - 1; j >= 0 && this.state.pendingTemporalTraces.length - 1 - j < TEMPORAL_WINDOW; j -= 1) {
        const trace = this.state.pendingTemporalTraces[j]!;
        const traceAction = ACTIONS.indexOf(trace.action);
        if (traceAction < 0) continue;
        const traceError = clamp11((delayedReward - trace.rewardPrediction01) * 1.45);
        const eligibility = decay * TEMPORAL_LAMBDA;
        const credit = traceError * eligibility;
        this.state.temporalCreditByAction[traceAction] = clamp11((this.state.temporalCreditByAction[traceAction] ?? 0) * 0.92 + credit * 0.38);
        aggregate += Math.abs(credit);
        decay *= TEMPORAL_GAMMA;
        if (Math.abs(credit) > 0.001) {
          for (let i = 0; i < N; i += 1) {
            const latent = trace.latent[i] ?? 0;
            const delta = credit * latent * 0.0045;
            if (Math.abs(delta) <= 1e-10) continue;
            this.state.actionReadout[traceAction]![i] = clamp11(this.state.actionReadout[traceAction]![i]! + delta);
          }
        }
      }
      this.state.temporalUpdates += 1;
      this.state.temporalCreditMean01 = clamp01(this.state.temporalCreditMean01 * 0.90 + Math.min(1, aggregate) * 0.10);
      this.state.temporalCreditMagnitude01 = clamp01(this.state.temporalCreditMagnitude01 * 0.90 + Math.min(1, aggregate) * 0.10);
      this.state.delayedRewardMean01 = clamp01(this.state.delayedRewardMean01 * 0.92 + delayedReward * 0.08);
    }
    const reward = clamp01(input.reward01);
    const externalEvidence = clamp01(input.externalEvidence01 ?? 0);
    const verified = clamp01(input.verified01);
    const novelty = clamp01(input.novelty01 ?? 0.2);
    const actualUtility = clamp01(input.actualUtility01 ?? reward);
    const predictedReward = clamp01(input.predictedReward01 ?? this.state.rewardPrediction01);
    const predictedUtility = clamp01(input.predictedUtility01 ?? this.state.lastForecastUtilities[actionIndex] ?? 0.5);
    const worldConfidence = clamp01(input.actualWorldConfidence01 ?? (1 - input.predictionError01));
    const forecastError = clamp01(Math.abs(predictedUtility - actualUtility));
    const neuralPredictionError = clamp01(Math.abs(predictedReward - reward));
    const advantage = clamp11((reward - this.state.rewardPrediction01) * 1.35 - input.predictionError01 * 0.42);
    const evidence = 0.45 + 0.35 * verified + 0.20 * externalEvidence;
    let updates = 0;
    if (actionIndex >= 0) {
      const contextVector = [this.state.neuromodulation01 - 0.5, this.state.neuromodulation01 - 0.5, this.state.neuromodulation01 - 0.5, novelty - 0.5, clamp01(input.predictionError01) - 0.5, this.state.goalField01 - 0.5, clamp01(this.state.neuralConfidence01) - 0.5];
      const modulationGain = advantage * evidence * 0.028;
      for (let i = 0; i < contextVector.length; i += 1) {
        const delta = modulationGain * (contextVector[i] - 0.5);
        this.state.contextActionReadout[actionIndex]![i] = clamp11(this.state.contextActionReadout[actionIndex]![i]! + delta);
      }
    }

    if (actionIndex >= 0) {
      const gradients=Array.from({length:N},(_,i)=>0.036 * advantage * evidence * (this.state.eligibility[i]??0));
      const operatorResult=this.neuroCoreAdaptiveOperators.applyVector(
        this.state.actionReadout[actionIndex]!,
        {
          gradient:gradients,
          featureVector:this.state.lastLatent.slice(0,N),
          surprise01:forecastError,
          novelty01:novelty,
          uncertainty01:clamp01(input.predictionError01),
          verification01:verified,
          stability01:worldConfidence,
        },
      );
      this.state.actionReadout[actionIndex]=operatorResult.values.map(clamp11);
      updates += operatorResult.updatedCount;

      const head = this.state.actionForecasts[action]!;
      const forecastRate = Math.min(0.24, 0.035 + head.samples * 0.004);
      const targetReward = clamp01(0.62 * reward + 0.38 * (1 - input.predictionError01));
      const targetUtility = clamp01(0.66 * actualUtility + 0.22 * reward + 0.12 * (1 - input.predictionError01));
      head.reward01 = clamp01(head.reward01 + (targetReward - head.reward01) * forecastRate);
      head.utility01 = clamp01(head.utility01 + (targetUtility - head.utility01) * forecastRate);
      head.errorMean01 = clamp01(head.errorMean01 * 0.94 + forecastError * 0.06);
      head.uncertainty01 = clamp01(head.uncertainty01 * 0.92 + forecastError * 0.08);
      head.confidence01 = clamp01(0.10 + Math.min(0.86, (head.samples + 1) / 30) * (1 - head.errorMean01 * 0.55));
      head.samples += 1;
      head.lastUpdateTick = input.tick;
      this.state.forecastUpdates += 1;

      const deltaSignal = clamp11((actualUtility - predictedUtility) * 1.7);
      for (let i = 0; i < N; i += 1) {
        const eligibility = this.state.eligibility[i]!;
        const direction = deltaSignal * eligibility * (0.004 + 0.002 * novelty);
        this.state.forecastReadout[actionIndex]![i] = clamp11(this.state.forecastReadout[actionIndex]![i]! + direction);
        updates += Math.abs(direction) > 1e-9 ? 1 : 0;
      }
      const stateDelta = clamp01(input.actualStateDelta01 ?? forecastError);
      for (let i = 0; i < FORECAST_DELTA_DIM; i += 1) {
        head.deltaReadout[i] = clamp11(
          head.deltaReadout[i]! + deltaSignal * (0.006 + worldConfidence * 0.004) * (1 - i / FORECAST_DELTA_DIM),
        );
        if (i === 0) head.deltaReadout[i] = clamp11(head.deltaReadout[i]! + (stateDelta - 0.5) * 0.006);
      }
      if (externalEvidence > 0 || verified > 0) this.state.worldModelTransfers += 1;
    }

    for (const synapse of this.state.synapses) {
      if (!synapse.active) continue;
      const delta = 0.0075 * advantage * this.state.neuromodulation01 * synapse.eligibility01;
      if (Math.abs(delta) > 1e-9) {
        synapse.weight = clamp11(synapse.weight + delta);
        updates += 1;
      }
      synapse.eligibility01 *= 0.91;
    }

    const rewardError = reward - this.state.rewardPrediction01;
    const needError = Math.abs(reward - 0.5) - this.state.nextNeedPrediction01;
    for (let i = 0; i < N; i += 1) {
      this.state.rewardReadout[i] = clamp11(this.state.rewardReadout[i]! + 0.0025 * rewardError * this.state.eligibility[i]!);
      this.state.needReadout[i] = clamp11(this.state.needReadout[i]! + 0.0017 * needError * this.state.eligibility[i]!);
    }

    const causalGain = clamp01(Math.abs(advantage) * evidence + neuralPredictionError * 0.12 + forecastError * 0.25);
    const replayPriority = clamp01(0.42 * Math.abs(advantage) + 0.22 * novelty + 0.18 * verified + 0.18 * forecastError);
    const replayExperience = { tick: input.tick, action, reward01: reward, predictionError01: clamp01(input.predictionError01), novelty01: novelty, verified01: verified, latent: this.state.lastLatent.slice(), utility01: actualUtility, priority01: replayPriority };
    const replayInsertion = this.replayReservoir.push(replayExperience);
    this.state.replayStreamCount = this.replayReservoir.streamCount();
    if (replayInsertion.inserted) {
      this.state.replayBuffer = this.replayReservoir.values();
      this.state.replayReservoirGroups = this.replayReservoir.groupStates();
    }
    this.state.replayExperiences += 1;
    this.state.learningUpdates += 1;
    this.state.history = [
      ...this.state.history.slice(-255),
      {
        tick: input.tick,
        action,
        reward01: reward,
        predictionError01: clamp01(input.predictionError01),
        entropy01: this.state.actionEntropy01,
        causalGain01: causalGain,
        modelAgreement01: this.state.modelAgreement01,
        forecastError01: forecastError,
      },
    ];
    this.state.plasticity01 = clamp01(
      this.state.plasticity01 * 0.94
      + Math.abs(advantage) * 0.08
      + (1 - forecastError) * 0.008
      + worldConfidence * 0.004,
    );
    this.state.modelAgreement01 = clamp01(this.state.modelAgreement01 * 0.92 + (1 - forecastError) * 0.08);

    if (this.state.selfModel.enabled && actionIndex >= 0) {
      const s=this.state.selfModel;
      const before=s.currentSelf.length===SELF_DIM?s.currentSelf.slice():this.selfVector(this.state.lastLatent,this.state.allostatic.drive01,this.state.selfCoherence01);
      const after=this.selfVector(this.state.lastLatent.map((v,i)=>clamp11(v + (this.state.forecastReadout[actionIndex]?.[i]??0)*.12)),this.state.allostatic.drive01,this.state.selfCoherence01);
      const predicted=s.predictedSelfByAction[actionIndex]??before;
      const selfErr=clamp01(1-this.selfCosine(predicted,after));
      const verifiedSelf=verified>=.99 && externalEvidence>=.65;
      if(verifiedSelf){
        const lr=.018*(.35+.65*clamp01(1-input.predictionError01))*(.4+.6*worldConfidence);
        for(let i=0;i<SELF_DIM;i+=1){
          s.actionIdentityReadout[actionIndex]![i]=clamp11(s.actionIdentityReadout[actionIndex]![i]!+(after[i]!-predicted[i]!)*lr);
          s.stableSelf[i]=clamp11(s.stableSelf[i]!*.992+after[i]!* .008*(.5+.5*this.state.allostatic.preservation01));
          s.futureSelf[i]=clamp11(s.futureSelf[i]!*.985+after[i]!* .015*(.5+.5*s.growthReadiness01));
        }
        s.agency01=clamp01(s.agency01*.96+.04*(.55+.45*(1-selfErr)));
        s.selfPredictionError01=clamp01(s.selfPredictionError01*.92+selfErr*.08);
        s.verifiedTransitions+=1; s.lastAction=action; s.lastTick=input.tick;
        const importance=clamp01(.35*Math.abs(advantage)+.25*novelty+.25*selfErr+.15*s.identityConflict01);
        s.autobiographicalEpisodes=[...s.autobiographicalEpisodes,{tick:input.tick,action,reward01:reward,verified01:1,selfBefore:before,selfAfter:after,predictionError01:selfErr,identityConflict01:s.identityConflict01,importance01:importance}].slice(-SELF_EPISODE_LIMIT);
      } else { s.rejectedTransitions+=1; }
      s.currentSelf=after;
    }

    if (this.state.allostatic.enabled && verified >= .99 && actionIndex >= 0) {
      const improvement=clamp11((reward-this.state.rewardPrediction01)*1.5-input.predictionError01*.65); const direction=improvement>=0?1:-1; const eta=.0065*(.35+.65*Math.abs(improvement)); const t=this.state.allostatic.traits;
      if(action==='explore'||action==='verify') t.curiosity01=clamp01(t.curiosity01+eta*direction);
      if(action==='verify'||action==='defer') t.caution01=clamp01(t.caution01-eta*direction);
      if(action==='reflect'||action==='verify') t.persistence01=clamp01(t.persistence01+eta*direction);
      if(action==='explore') t.noveltySeeking01=clamp01(t.noveltySeeking01+eta*direction);
      if(action==='rest') t.restSeeking01=clamp01(t.restSeeking01+eta*direction);
      if(action==='respond') t.socialAttunement01=clamp01(t.socialAttunement01+eta*direction);
      const se=.0015*Math.min(1,Math.abs(improvement));
      this.state.allostatic.setpoints.energy01=clamp01(this.state.allostatic.setpoints.energy01+se*(this.state.allostatic.levels.energy01-this.state.allostatic.setpoints.energy01));
      this.state.allostatic.setpoints.uncertainty01=clamp01(this.state.allostatic.setpoints.uncertainty01+se*(this.state.allostatic.levels.uncertainty01-this.state.allostatic.setpoints.uncertainty01));
      this.state.allostatic.verifiedAdaptations+=1; this.state.allostatic.lastVerifiedReward01=reward; this.state.allostatic.lastVerifiedAction=action;
    } else { this.state.allostatic.rejectedAdaptations+=1; }
    const goalAuthLearning = this.learnGoalAuthorshipOutcome({tick:input.tick,reward01:reward,predictionError01:clamp01(input.predictionError01),verified01:verified,action,independentEvidence01:externalEvidence});
    const goalEcologyLearning = this.updateGoalEcologyFromOutcome({tick:input.tick,reward01:reward,predictionError01:clamp01(input.predictionError01),verified01:verified,externalEvidence01:externalEvidence,action});

    return {
      updates,
      advantage01: advantage,
      causalGain01: causalGain,
      forecastError01: forecastError,
      neuralPredictionError01: neuralPredictionError,
      actionForecast: actionIndex >= 0 ? structuredClone(this.state.actionForecasts[action]!) : null,
      actionProbabilities: { ...this.actionProbabilities() },
      predictionError01: Math.abs(rewardError),
    };
  }

  recordGroundedObservation(input: {
    tick: number;
    source: 'android-termux'|'node-host'|'world'|'external';
    freshness01: number;
    sensorConfidence01: number;
    verified01: number;
    energy01?: number;
    thermal01?: number;
    motion01?: number;
    light01?: number;
    proximity01?: number;
    network01?: number;
    activePerceptionDemand01?: number;
  }): { accepted:boolean; verified:boolean; causalGain01:number; activePerceptionDemand01:number } {
    const g=this.state.grounding;
    const freshness=clamp01(input.freshness01);
    const confidence=clamp01(input.sensorConfidence01);
    const verified=clamp01(input.verified01);
    const prev=[g.lastEnergy01,g.lastThermal01,g.lastMotion01,g.lastLight01,g.lastProximity01,g.lastNetwork01];
    const next=[
      clamp01(input.energy01 ?? g.lastEnergy01),
      clamp01(input.thermal01 ?? g.lastThermal01),
      clamp01(input.motion01 ?? g.lastMotion01),
      clamp01(input.light01 ?? g.lastLight01),
      clamp01(input.proximity01 ?? g.lastProximity01),
      clamp01(input.network01 ?? g.lastNetwork01),
    ];
    const delta=prev.reduce((sum,v,i)=>sum+Math.abs(v-next[i]!),0)/prev.length;
    const causalGain=clamp01(delta*1.8*freshness*(0.45+0.55*confidence));
    const demand=clamp01(0.52 + 0.34*(1-confidence) + 0.28*delta + 0.22*(1-freshness));
    this.state.grounding={
      ...g,
      lastSource:input.source,
      freshness01:freshness,
      sensorConfidence01:confidence,
      verified01:verified,
      activePerceptionDemand01:clamp01(0.72*g.activePerceptionDemand01+0.28*(input.activePerceptionDemand01 ?? demand)),
      lastEnergy01:next[0]!, lastThermal01:next[1]!, lastMotion01:next[2]!, lastLight01:next[3]!, lastProximity01:next[4]!, lastNetwork01:next[5]!,
      observations:g.observations+1,
      verifiedObservations:g.verifiedObservations+(verified>=0.99?1:0),
      causalImpact01:clamp01(g.causalImpact01*0.9+causalGain*0.1),
      lastTick:Math.max(g.lastTick,Math.floor(Number(input.tick)||0)),
    };
    return { accepted:true, verified:verified>=0.99 && freshness>=0.95 && confidence>=0.7, causalGain01:causalGain, activePerceptionDemand01:this.state.grounding.activePerceptionDemand01 };
  }

  planActivePerception(input: {
    tick: number;
    uncertainty01?: number;
    predictionError01?: number;
    novelty01?: number;
    selectedAction?: ActionKind | null;
    forceHighValueCheck?: boolean;
  }): { version:1; tick:number; priority01:number; expectedInformationGain01:number; requestedSensors:string[]; rationale:string } {
    const g=this.state.grounding;
    const uncertainty=clamp01(input.uncertainty01 ?? this.state.predictionError01);
    const predictionError=clamp01(input.predictionError01 ?? this.state.predictionError01);
    const novelty=clamp01(input.novelty01 ?? this.state.exteroceptiveNovelty01);
    const demand=clamp01(g.activePerceptionDemand01);
    const freshness=g.freshness01;
    const confidence=g.sensorConfidence01;
    const priority=clamp01(.30*uncertainty+.22*predictionError+.22*novelty+.18*demand+.08*(1-freshness));
    const requested=new Set<string>();
    if (input.forceHighValueCheck || uncertainty > .48 || freshness < .72 || g.verified01 < .5) requested.add('battery');
    if (predictionError > .34 || novelty > .42 || confidence < .68 || input.forceHighValueCheck) { requested.add('motion'); requested.add('light'); requested.add('proximity'); }
    if ((input.selectedAction==='respond' || g.lastNetwork01 < .45) && (uncertainty > .30 || freshness < .9)) requested.add('network');
    if ((input.selectedAction==='explore' || input.selectedAction==='verify') && (novelty > .55 || confidence < .55)) requested.add('camera');
    if (requested.size===0) {
      requested.add(priority > .45 ? 'motion' : 'battery');
    }
    const expectedInformationGain=clamp01(priority*(.42+.10*requested.size)+(1-confidence)*.24);
    const rationale=[
      uncertainty>.48?'high-uncertainty':null,
      predictionError>.34?'prediction-error':null,
      novelty>.42?'novel-context':null,
      freshness<.72?'stale-grounding':null,
      confidence<.68?'low-sensor-confidence':null,
      input.selectedAction==='explore'?'exploration-verification':null,
    ].filter(Boolean).join('+') || 'routine-active-perception';
    const plan={version:1 as const,tick:Math.max(0,Math.floor(Number(input.tick)||0)),priority01:priority,expectedInformationGain01:expectedInformationGain,requestedSensors:[...requested],rationale};
    this.state.activePerceptionPlan={
      ...this.state.activePerceptionPlan,
      ...plan,
      issuedCount:this.state.activePerceptionPlan.issuedCount+1,
      lastObservedSensors:[],
      lastFulfilled01:0,
    };
    const stats=this.state.activePerceptionStats;
    stats.plans += 1;
    stats.meanInformationGain01=clamp01(stats.meanInformationGain01*.92+expectedInformationGain*.08);
    return plan;
  }

  recordPerceptionPlanResult(input:{tick:number;observedSensors:string[];fulfilled01:number}): {fulfilled01:number;causalGain01:number;requestedSensors:string[]} {
    const requested=this.state.activePerceptionPlan.requestedSensors;
    const observed=Array.isArray(input.observedSensors)?[...new Set(input.observedSensors.map(String))].slice(0,8):[];
    const fulfilled=clamp01(input.fulfilled01);
    const overlap=requested.length ? requested.filter(x=>observed.includes(x)).length/requested.length : 0;
    const gain=clamp01(overlap*.72+fulfilled*.28);
    this.state.activePerceptionPlan={...this.state.activePerceptionPlan,lastObservedSensors:observed,lastFulfilled01:fulfilled,fulfilledCount:this.state.activePerceptionPlan.fulfilledCount+(gain>.5?1:0)};
    this.state.activePerceptionStats.executed+=1;
    if(gain>.5) this.state.activePerceptionStats.fulfilled+=1;
    this.state.activePerceptionStats.meanInformationGain01=clamp01(this.state.activePerceptionStats.meanInformationGain01*.94+gain*.06);
    this.state.grounding.activePerceptionDemand01=clamp01(this.state.grounding.activePerceptionDemand01*.84+(1-gain)*.16);
    return {fulfilled01:gain,causalGain01:gain,requestedSensors:[...requested]};
  }

  learnActionTransition(input: {
    tick:number;
    action:ActionKind|null;
    expectedReward01:number;
    actualReward01:number;
    expectedStateDelta01:number;
    actualStateDelta01:number;
    verified01:number;
    evidence01:number;
  }): { updates:number; predictionError01:number; causalGain01:number } {
    const action=input.action ?? this.state.lastAction ?? 'wait';
    const idx=ACTIONS.indexOf(action);
    const rewardErr=Math.abs(clamp01(input.expectedReward01)-clamp01(input.actualReward01));
    const stateErr=Math.abs(clamp01(input.expectedStateDelta01)-clamp01(input.actualStateDelta01));
    const err=clamp01(rewardErr*0.62+stateErr*0.38);
    const gain=clamp01((1-err)*(0.35+0.45*clamp01(input.verified01)+0.20*clamp01(input.evidence01)));
    let updates=0;
    if(idx>=0){
      const target=clamp01(.62*input.actualReward01+.38*(1-input.actualStateDelta01));
      const gv=[
        this.state.grounding.lastEnergy01-.5,
        (1-this.state.grounding.lastThermal01)-.5,
        this.state.grounding.lastMotion01-.5,
        this.state.grounding.lastLight01-.5,
        this.state.grounding.lastProximity01-.5,
        this.state.grounding.lastNetwork01-.5,
      ];
      const groundGain=0.018*(0.4+0.6*clamp01(input.verified01))*(0.35+0.65*clamp01(input.evidence01));
      for(let j=0;j<gv.length;j+=1){
        const d=clamp11(gv[j]!*(target-.5)*groundGain);
        this.state.groundingActionReadout[idx]![j]=clamp11(this.state.groundingActionReadout[idx]![j]!+d);
      }
      const head=this.state.actionForecasts[action]!;
      head.utility01=clamp01(head.utility01+(target-head.utility01)*Math.min(.22,.045+head.samples*.003));
      head.errorMean01=clamp01(head.errorMean01*.9+err*.1);
      head.confidence01=clamp01(head.confidence01*.96+(1-err)*.04);
      const delta=clamp11((target-head.utility01)*.022*(.5+gain));
      for(let i=0;i<N;i+=1){
        const e=this.state.eligibility[i]!;
        if(e<=1e-8) continue;
        const d=delta*e;
        this.state.actionReadout[idx]![i]=clamp11(this.state.actionReadout[idx]![i]!+d);
        this.state.forecastReadout[idx]![i]=clamp11(this.state.forecastReadout[idx]![i]!+d*.35);
        updates+=1;
      }
    }
    this.state.transitionLearning.updates += updates>0?1:0;
    this.state.transitionLearning.verifiedUpdates += input.verified01>=0.99 && updates>0 ? 1 : 0;
    this.state.transitionLearning.meanPredictionError01=clamp01(this.state.transitionLearning.meanPredictionError01*.9+err*.1);
    this.state.transitionLearning.lastOutcomeReward01=clamp01(input.actualReward01);
    this.state.transitionLearning.lastAction=action;
    return { updates, predictionError01:err, causalGain01:clamp01(gain*(updates>0?1:0)) };
  }

  learnEmbodiedConsequence(input: {
    tick: number;
    action: ActionKind|null;
    predictedEffect01: number;
    actualEffect01: number;
    verified01: number;
    independent01: number;
    source: string;
  }): { accepted:boolean; updates:number; consequenceError01:number; causalGain01:number; reason:string } {
    const action=input.action ?? this.state.lastAction ?? 'wait';
    const item=this.state.realityActionLearning.actionSamples[action]!;
    const predicted=clamp01(input.predictedEffect01);
    const actual=clamp01(input.actualEffect01);
    const verified=clamp01(input.verified01);
    const independent=clamp01(input.independent01);
    const err=clamp01(Math.abs(predicted-actual));
    item.samples += 1;
    item.meanEffect01=clamp01(item.meanEffect01*.94+actual*.06);
    item.meanError01=clamp01(item.meanError01*.94+err*.06);
    item.lastEffect01=actual;
    this.state.realityActionLearning.meanConsequenceError01=clamp01(this.state.realityActionLearning.meanConsequenceError01*.94+err*.06);
    this.state.realityActionLearning.meanVerified01=clamp01(this.state.realityActionLearning.meanVerified01*.94+Math.min(verified,independent)*.06);
    this.state.realityActionLearning.lastTick=Math.max(this.state.realityActionLearning.lastTick,Math.floor(Number(input.tick)||0));
    this.state.realityActionLearning.lastAction=action;
    const accepted=verified>=.99 && independent>=.99 && String(input.source)==='android-termux';
    if(!accepted){
      this.state.realityActionLearning.rejectedUnverified += 1;
      return {accepted:false,updates:0,consequenceError01:err,causalGain01:0,reason:'physical-consequence-proof-required'};
    }
    item.verified += 1;
    const idx=ACTIONS.indexOf(action);
    let updates=0;
    const gain=clamp01((1-err)*(.55+.45*verified)*(.55+.45*independent));
    if(idx>=0){
      const target=clamp11((actual-.5)*2);
      const scale=0.0045*gain;
      for(let i=0;i<N;i+=1){
        const eligibility=this.state.eligibility[i] ?? 0;
        const latent=this.state.lastLatent[i] ?? 0;
        const delta=target*latent*(.20+.80*eligibility)*scale;
        if(Math.abs(delta)<1e-10) continue;
        this.state.actionReadout[idx]![i]=clamp11(this.state.actionReadout[idx]![i]!+delta);
        this.state.forecastReadout[idx]![i]=clamp11(this.state.forecastReadout[idx]![i]!+delta*.28);
        updates += 1;
      }
      const head=this.state.actionForecasts[action]!;
      head.errorMean01=clamp01(head.errorMean01*.92+err*.08);
      head.confidence01=clamp01(head.confidence01*.94+(1-err)*.06);
      head.samples += 1;
      head.lastUpdateTick=Math.floor(Number(input.tick)||this.state.tick);
    }
    this.state.realityActionLearning.updates += updates>0 ? 1 : 0;
    this.state.realityActionLearning.verifiedUpdates += updates>0 ? 1 : 0;
    this.state.transitionLearning.verifiedUpdates += updates>0 ? 1 : 0;
    return {accepted:true,updates,consequenceError01:err,causalGain01:clamp01(gain*(updates>0?1:0)),reason:'verified-independent-android-consequence'};
  }

  realityActionLearningDiagnostics(){
    return structuredClone(this.state.realityActionLearning);
  }

  neuroCoreArchitectureDiagnostics(){
    this.state.neuroCoreAdaptiveOperators=this.neuroCoreAdaptiveOperators.snapshot();
    return {
      operator:'curvature-aware-delta+diagonal-lowrank+dual-erase-write',
      ...this.neuroCoreAdaptiveOperators.diagnostics(),
    };
  }

  configureNeuroCoreGateScales(input:{eraseScale01?:number;writeScale01?:number;lowRankScale01?:number}){
    this.neuroCoreAdaptiveOperators.configureGateScales(input);
    this.state.neuroCoreAdaptiveOperators=this.neuroCoreAdaptiveOperators.snapshot();
  }

  configureNeuroCoreLowRankScale(lowRankScale01:number){
    this.neuroCoreAdaptiveOperators.configureGateScales({lowRankScale01});
    this.state.neuroCoreAdaptiveOperators=this.neuroCoreAdaptiveOperators.snapshot();
  }

  replayConsolidate(limit = 24, tick = this.state.tick): { updates:number; experiences:number; impact01:number; selected:number } {
    const max = Math.max(1, Math.min(48, Math.floor(Number(limit) || 1)));
    const priorityContext = this.state.replayBuffer.map((exp) => exp.priority01);
    const importanceBeta = clamp01(0.4 + 0.6 * Math.sqrt(Math.min(1, this.state.replayStreamCount / 4096)));
    this.replayPrioritySampler.setBeta(importanceBeta);
    this.state.replayImportanceBeta01 = importanceBeta;
    const normalizedPriority = new Map(this.state.replayBuffer.map((exp) => [exp.tick + ':' + exp.action, robustPercentileNormalize(priorityContext, exp.priority01)]));
    const replaySample = this.replayPrioritySampler.sample(this.state.replayBuffer, max, (exp) => Math.max(0.001, normalizedPriority.get(exp.tick + ':' + exp.action) ?? exp.priority01), this.state.replayReservoirRngState);
    this.state.replayReservoirRngState = replaySample.state;
    const candidates = replaySample.samples;
    if (!candidates.length) return { updates:0, experiences:0, impact01:0, selected:0 };
    let updates = 0;
    let totalImpact = 0;
    for (const sample of candidates) {
      const exp = sample.item;
      const actionIndex = ACTIONS.indexOf(exp.action);
      if (actionIndex < 0) continue;
      const target = clamp01(0.58 * exp.reward01 + 0.27 * exp.utility01 + 0.15 * (1 - exp.predictionError01));
      const predicted = clamp01(this.state.lastForecastUtilities[actionIndex] ?? this.state.actionForecasts[exp.action]?.utility01 ?? 0.5);
      const error = clamp11((target - predicted) * (0.72 + exp.priority01 * 0.5));
      const gain = (0.0028 + 0.0018 * exp.verified01 + 0.0012 * exp.novelty01) * (0.55 + exp.priority01) * (0.55 + 0.45 * sample.importanceWeight01);
      for (let i = 0; i < N; i += 1) {
        const latent = exp.latent[i] ?? 0;
        const delta = error * latent * gain;
        if (Math.abs(delta) < 1e-10) continue;
        this.state.actionReadout[actionIndex]![i] = clamp11(this.state.actionReadout[actionIndex]![i]! + delta);
        this.state.forecastReadout[actionIndex]![i] = clamp11(this.state.forecastReadout[actionIndex]![i]! + delta * 0.22);
        updates += 1;
      }
      const synGain = error * (0.0016 + 0.0014 * exp.priority01) * (0.45 + this.state.neuromodulation01);
      const activeSynapses = this.state.synapses.filter((synapse) => synapse.active && synapse.eligibility01 > 0.0001);
      const replaySynapseBudget = Math.min(256, activeSynapses.length);
      const replayStride = Math.max(1, Math.floor(activeSynapses.length / Math.max(1, replaySynapseBudget)));
      for (let si = 0, chosen = 0; si < activeSynapses.length && chosen < replaySynapseBudget; si += replayStride, chosen += 1) {
        const synapse = activeSynapses[si]!;
        const pre = exp.latent[synapse.pre] ?? 0;
        const post = exp.latent[synapse.post] ?? 0;
        const delta = synGain * pre * post * synapse.eligibility01;
        if (Math.abs(delta) < 1e-10) continue;
        synapse.weight = clamp11(synapse.weight + delta);
        synapse.usage01 = clamp01(synapse.usage01 * 0.997 + Math.abs(pre * post) * 0.003);
        updates += 1;
      }
      const head = this.state.actionForecasts[exp.action]!;
      head.utility01 = clamp01(head.utility01 * 0.94 + target * 0.06);
      head.errorMean01 = clamp01(head.errorMean01 * 0.96 + Math.abs(error) * 0.04);
      head.confidence01 = clamp01(head.confidence01 * 0.97 + (1 - head.errorMean01) * 0.03);
      const newPriority = Math.max(0.001, 0.42 * Math.abs(error) + 0.22 * exp.novelty01 + 0.18 * exp.verified01 + 0.18 * exp.predictionError01);
      exp.priority01 = Math.max(0.001, Math.min(1, exp.priority01 * 0.64 + newPriority * 0.36));
      totalImpact += Math.min(1, Math.abs(error) * (0.35 + exp.priority01) * (0.7 + 0.3 * sample.importanceWeight01));
    }
    const impact = clamp01(totalImpact / Math.max(1, candidates.length));
    this.state.replayUpdates += updates;
    this.state.replayImpact01 = clamp01(this.state.replayImpact01 * 0.88 + impact * 0.12);
    this.state.replayLastTick = Math.max(0, Math.floor(Number(tick) || this.state.tick));
    this.state.plasticity01 = clamp01(this.state.plasticity01 * 0.96 + impact * 0.06);
    return { updates, experiences:candidates.length, impact01:impact, selected:candidates.length };
  }

  setDevelopmentalMemoryEnabled(enabled:boolean){ this.state.developmentalMemory.enabled=Boolean(enabled); }

  consolidateExperience(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;salience01:number;verified01:number;independent01:number;evidenceQuality01:number;continuity01:number;goalId?:string|null;context01?:number[]}){
    const d=this.state.developmentalMemory; const idx=ACTIONS.indexOf(input.action);
    const verified=clamp01(input.verified01)>.65 && clamp01(input.independent01)>.65 && clamp01(input.evidenceQuality01)>.55;
    const contextualEnabled=this.state.contextualDevelopmental.enabled;
    if(idx<0 || !verified || (!d.enabled && !contextualEnabled)){
      d.rejectedExperiences+=1; if(contextualEnabled && verified && idx>=0)this.state.contextualDevelopmental.rejectedExperiences+=1;
      return {updated:false,verified:false,adaptation01:0,contradiction01:d.contradiction01};
    }
    const reward=clamp01(input.reward01), pe=clamp01(input.predictionError01), sal=clamp01(input.salience01), continuity=clamp01(input.continuity01);
    let delta=0;
    if(d.enabled){
      const old=d.actionValue01[idx]??.5; const target=clamp01(.58*reward+.24*(1-pe)+.18*sal);
      const magnitude=(.018+.020*sal+.010*continuity)*(0.65+0.35*(1-pe)); delta=(target-old)*magnitude;
      d.actionValue01[idx]=clamp01(old+delta); d.actionConfidence01[idx]=clamp01((d.actionConfidence01[idx]??.15)*.94+(1-pe)*.06); d.actionNovelty01[idx]=clamp01((d.actionNovelty01[idx]??.2)*.92+sal*.08);
      const conflict=((old-.5)*(target-.5)<-.002)?Math.abs(old-target):0; d.contradiction01=clamp01(d.contradiction01*.94+conflict*.16+pe*.08*sal);
      d.identityContinuity01=clamp01(d.identityContinuity01*.92+continuity*.08); d.learningMass01=clamp01(d.learningMass01*.97+(.35*sal+.25*(1-pe)+.20*continuity+.20*reward)*.03);
      d.meanReward01=d.meanReward01*.94+reward*.06; d.meanPredictionError01=d.meanPredictionError01*.94+pe*.06; d.verifiedExperiences+=1; if(Math.abs(delta)>1e-6)d.adaptations+=1; d.lastTick=Math.max(d.lastTick,Math.floor(input.tick)); d.lastAction=input.action;
      d.recent=[...d.recent,{tick:Math.floor(input.tick),action:input.action,reward01:reward,predictionError01:pe,salience01:sal,verified01:1,goalId:input.goalId??null}].slice(-64);
      const gain=(.00045+.00030*sal+.00020*(1-pe))*(.7+.3*continuity);
      for(let i=0;i<N;i+=1){ const drift=delta*(this.state.lastLatent[i]??0)*gain; if(Math.abs(drift)>1e-12){ this.state.actionReadout[idx]![i]=clamp11(this.state.actionReadout[idx]![i]!+drift); this.state.forecastReadout[idx]![i]=clamp11(this.state.forecastReadout[idx]![i]!+drift*.14); } }
      this.state.actionForecasts[input.action]!.utility01=clamp01(this.state.actionForecasts[input.action]!.utility01*.96+d.actionValue01[idx]*.04);
      this.state.goalField01=clamp01(this.state.goalField01*.985+(.5+d.contradiction01*.2)*.015); this.state.plasticity01=clamp01(this.state.plasticity01*.985+Math.abs(delta)*.06);
    }
    const c=this.state.contextualDevelopmental; const context=Array.from({length:8},(_,i)=>clamp01(Number(input.context01?.[i] ?? ((Math.abs(this.state.lastLatent[i]??0)+1)/2)))); let contextualDelta=0;
    if(c.enabled){
      const targetCtx=clamp01(.58*reward+.24*(1-pe)+.18*sal);
      let best:null|{p:any;sim:number}=null;
      for(const p of c.profiles){ if(p.action!==input.action) continue; const sim=contextSimilarity(context,p.context); if(sim>.58 && (!best || sim>best.sim))best={p,sim}; }
      const pos=reward>=.5 ? (reward-.5)*2 : 0;
      const neg=reward<.5 ? (.5-reward)*2 : 0;
      let hypothesis:null|any=null;
      for(const h of c.hypotheses){ if(h.action!==input.action) continue; const sim=contextSimilarity(context,h.context); if(sim>.58 && (!hypothesis || sim>hypothesis.sim))hypothesis={h,sim}; }
      if(!hypothesis){
        hypothesis={h:{id:`b383:h:${Math.floor(input.tick)}:${c.contextCount+1}`,action:input.action,context:context.slice(),positiveMass01:pos*.5,negativeMass01:neg*.5,dominant01:targetCtx,conflict01:0,confidence01:.16,samples:1,revisions:0,lastTick:Math.floor(input.tick)},sim:1};
        c.hypotheses.push(hypothesis.h);
      }else{
        const h=hypothesis.h; const oldDom=h.dominant01; const conflict=((oldDom-.5)*(targetCtx-.5)<-.01)?Math.abs(oldDom-targetCtx):0;
        if(conflict>.04){ c.contradictions+=1; h.revisions+=1; }
        h.positiveMass01=clamp01(h.positiveMass01*.94+pos*.06*hypothesis.sim);
        h.negativeMass01=clamp01(h.negativeMass01*.94+neg*.06*hypothesis.sim);
        const balance=h.positiveMass01-h.negativeMass01;
        h.dominant01=clamp01(.5+balance*.5);
        h.conflict01=clamp01(h.conflict01*.90+conflict*.14);
        h.confidence01=clamp01(h.confidence01*.96+(1-Math.min(1,Math.abs(balance)-Math.min(h.positiveMass01,h.negativeMass01)))*.02);
        if(conflict<.02 && h.conflict01<.08 && h.samples>4){ c.contradictionsResolved+=1; }
        h.context=h.context.map((x:number,i:number)=>clamp01(x*.94+context[i]*.06)); h.samples+=1; h.lastTick=Math.floor(input.tick);
      }
      if(best){
        const p=best.p as any; const oldCtx=p.value01; const conflict=((oldCtx-.5)*(targetCtx-.5)<-.01)?Math.abs(oldCtx-targetCtx):0; if(conflict>.04)c.contradictions+=1;
        const rate=.045+.055*sal*(1-pe);
        p.value01=clamp01(oldCtx+(targetCtx-oldCtx)*rate*best.sim); contextualDelta=Math.abs(p.value01-oldCtx); p.conflict01=clamp01(p.conflict01*.84+conflict*.18);
        if(reward>=.72)p.positiveEvidence=(p.positiveEvidence??0)+1; if(reward<=.28)p.negativeEvidence=(p.negativeEvidence??0)+1;
        p.stable01=clamp01(p.stable01*.94+(1-p.conflict01)*.06);
        if(conflict<.02&&p.confidence01<.98&&p.conflict01<.08){p.confidence01=clamp01(p.confidence01+.035*(1-pe)); if(p.samples>4)c.contradictionsResolved+=1;}
        p.context=p.context.map((x:number,i:number)=>clamp01(x*.92+context[i]*.08)); p.samples+=1; p.lastTick=Math.floor(input.tick); c.contextualAdaptations+=1;
      } else {
        c.profiles.push({id:`b383:p:${Math.floor(input.tick)}:${c.contextCount+1}`,action:input.action,context:context.slice(),value01:targetCtx,confidence01:.18,conflict01:0,samples:1,lastTick:Math.floor(input.tick),positiveEvidence:reward>=.72?1:0,negativeEvidence:reward<=.28?1:0,stable01:0});
        c.contextCount+=1; c.contextualAdaptations+=1; contextualDelta=Math.abs(targetCtx-.5);
      }
      if(c.hypotheses.length>48)c.hypotheses=c.hypotheses.slice(-48);
      if(c.profiles.length>48)c.profiles=c.profiles.slice(-48); c.verifiedExperiences+=1; c.lastTick=Math.floor(input.tick); c.lastContext=context.slice();
      c.history=[...c.history,{tick:Math.floor(input.tick),action:input.action,context:context.slice(),reward01:reward,target01:targetCtx,similarity01:best?.sim??0,contradiction01:best?.p?.conflict01??0,verified01:1}].slice(-96);
      // B383: contextual experience can revise personality traits, but only from independently verified evidence.
      if(this.state.allostatic.enabled){
        const centered=(reward-.5)*2;
        const strength=(.003+.007*salenceClamp(sal))*(0.45+0.55*(1-pe))*(0.55+0.45*continuity);
        const t=this.state.allostatic.traits;
        const before=[t.curiosity01,t.caution01,t.persistence01,t.noveltySeeking01,t.restSeeking01,t.socialAttunement01];
        if(input.action==='explore'){
          t.curiosity01=clamp01(t.curiosity01+strength*centered);
          t.noveltySeeking01=clamp01(t.noveltySeeking01+strength*.82*centered);
          if(centered<0)t.caution01=clamp01(t.caution01+strength*(-centered)*.68);
        }else if(input.action==='verify'||input.action==='defer'){
          t.caution01=clamp01(t.caution01-strength*.72*centered);
          t.persistence01=clamp01(t.persistence01+strength*.58*centered);
        }else if(input.action==='respond'){
          t.socialAttunement01=clamp01(t.socialAttunement01+strength*.70*centered);
        }else if(input.action==='reflect'){
          t.persistence01=clamp01(t.persistence01+strength*.74*centered);
        }else if(input.action==='rest'){
          t.restSeeking01=clamp01(t.restSeeking01+strength*.82*(-centered));
        }
        const after=[t.curiosity01,t.caution01,t.persistence01,t.noveltySeeking01,t.restSeeking01,t.socialAttunement01];
        const impact=before.reduce((sum,v,i)=>sum+Math.abs(v-after[i]!),0)/before.length;
        if(impact>1e-8){ c.personalityAdaptations+=1; c.traitImpact01=clamp01(c.traitImpact01*.96+impact*.04); }
      }
    }
    const autobiographical=this.updateAutobiographicalValueGoal({tick:input.tick,action:input.action,reward01:reward,predictionError01:pe,salience01:sal,verified01:1,goalId:input.goalId??null,context01:context,continuity01:continuity});
    this.state.learningUpdates+=(d.enabled&&Math.abs(delta)>1e-7)?1:0; return {updated:Boolean((d.enabled&&Math.abs(delta)>1e-7)||contextualDelta>1e-7||autobiographical.updated),verified:true,adaptation01:clamp01(Math.abs(delta)*12+contextualDelta*.8+autobiographical.impact01),contradiction01:d.contradiction01,actionValue01:d.actionValue01[idx],contextualAdaptation01:c.enabled?clamp01(contextualDelta*12):0,autobiographicalImpact01:autobiographical.impact01};
  }

  private updateAutobiographicalValueGoal(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;salience01:number;verified01:number;goalId?:string|null;context01:number[];continuity01:number}){
    const a=this.state.autobiographicalValueGoal; if(!a.enabled||clamp01(input.verified01)<=.65){a.rejectedEpisodes+=1;return {updated:false,impact01:0};}
    const reward=clamp01(input.reward01),pe=clamp01(input.predictionError01),sal=clamp01(input.salience01),cont=clamp01(input.continuity01),centered=(reward-.5)*2;
    const before=a.values.map(v=>v.value01); const axisByAction:Record<ActionKind,number[]>={respond:[0,0,0,1,0,0,1,0],explore:[0,0,1,0,1,0,0,1],verify:[1,1,0,1,0,0,0,0],rest:[0,0,0,0,0,1,0,0],reflect:[1,1,1,1,0,0,0,0],wait:[1,1,0,1,0,1,0,0],defer:[1,1,1,1,0,0,0,0]}; const axis=axisByAction[input.action]??new Array(8).fill(0);
    const eta=(.012+.014*sal)*(.42+.58*(1-pe))*(.55+.45*cont);
    for(let i=0;i<8;i+=1){const v=a.values[i]!;const target=clamp01(.5+centered*(axis[i]??0)*.34+(1-pe-.5)*(i<=1?.09:.04));const d=target-v.value01;v.value01=clamp01(v.value01+d*eta);v.confidence01=clamp01(v.confidence01*.96+(1-pe)*.04);if(Math.abs(d*eta)>1e-7){v.revisions+=1;a.valueRevisionCount+=1;}if(centered>0&&axis[i])v.support01=clamp01(v.support01*.94+.06*Math.abs(centered));if(centered<0&&axis[i])v.counterEvidence01=clamp01(v.counterEvidence01*.94+.06*Math.abs(centered));}
    const after=a.values.map(v=>v.value01); const delta=before.reduce((sum,v,i)=>sum+Math.abs(v-after[i]!),0)/8;
    const goal=this.state.goalEcology.activeId?this.state.goalEcology.memories.find(m=>m.id===this.state.goalEcology.activeId):null;
    const goalId=input.goalId??goal?.id??null;
    if(goalId){let g=a.goalCouplings.find(x=>x.goalId===goalId);if(!g){g={goalId,values:after.slice(),confidence01:.12,support01:0,conflict01:0,revisions:0,lastTick:input.tick};a.goalCouplings.push(g);}const prior=g.values.slice();for(let i=0;i<8;i+=1){const goalSignal=goal?.vector?.length?clamp01(.5+(goal.vector[i%goal.vector.length]??0)*.45+(goal.ownership01-.5)*.25):.5;g.values[i]=clamp01(g.values[i]!* .92+goalSignal*.08);}const contradiction=clamp01(1-cosine(g.values,after));g.conflict01=clamp01(g.conflict01*.9+contradiction*.1);g.confidence01=clamp01(g.confidence01*.96+(1-contradiction)*.04);if(Math.abs(1-cosine(prior,after))>.0002){g.revisions+=1;a.goalValueRevisions+=1;}g.support01=clamp01(g.support01*.95+Math.abs(centered)*.05);g.lastTick=input.tick;}
    if(delta>.045){a.contradictionCount+=1;a.selfRevisions+=1;} else if(a.contradictionCount>0&&delta<.018&&a.verifiedEpisodes>6)a.contradictionResolved+=1;
    a.coherence01=clamp01(a.coherence01*.93+(1-Math.min(1,delta*3))*.05+(1-pe)*.02);a.identityContinuity01=clamp01(a.identityContinuity01*.95+(cont*.55+(1-delta)*.25+a.valueStability01*.2)*.05);a.autobiographicalBinding01=clamp01(a.autobiographicalBinding01*.94+.06*Math.min(1,(a.verifiedEpisodes+1)/48));a.valueStability01=clamp01(a.valueStability01*.94+(1-Math.min(1,delta*3))*.06);
    a.verifiedEpisodes+=1;a.lastTick=input.tick;a.episodes=[...a.episodes,{tick:Math.floor(input.tick),action:input.action,goalId:input.goalId??goal?.id??null,context:input.context01.slice(0,8),reward01:reward,salience01:sal,predictionError01:pe,valuesBefore:before,valuesAfter:after,significance01:clamp01(.25+.35*sal+.25*Math.abs(centered)+.15*cont),contradiction01:delta,verified01:1}].slice(-96);
    return {updated:delta>1e-7||Boolean(goal),impact01:clamp01(delta*2.4+.006*(1-pe)+.004*sal)};
  }
  autobiographicalValueGoalDiagnostics(){return structuredClone(this.state.autobiographicalValueGoal);}
  queryAutobiographicalDevelopment(context01:number[],action?:ActionKind,goalId?:string|null){
    const a=this.state.autobiographicalValueGoal;
    a.explicitQueries+=1;a.retrievals+=1;
    const c=Array.from({length:8},(_,i)=>clamp01(Number(context01?.[i]??.5)));
    const rows=a.episodes
      .filter(e=>!action||e.action===action)
      .filter(e=>!goalId||e.goalId===goalId)
      .map(e=>({tick:e.tick,action:e.action,goalId:e.goalId,similarity01:contextSimilarity(c,e.context),reward01:e.reward01,significance01:e.significance01,contradiction01:e.contradiction01,values:e.valuesAfter.slice()}))
      .sort((x,y)=>(y.similarity01*y.significance01)-(x.similarity01*x.significance01))
      .slice(0,8);
    return {values:a.values.map(v=>({id:v.id,value01:v.value01,confidence01:v.confidence01,conflict01:v.conflict01,revisions:v.revisions})),rows,coherence01:a.coherence01,identityContinuity01:a.identityContinuity01,autobiographicalBinding01:a.autobiographicalBinding01};
  }
  setAutobiographicalValueGoalEnabled(enabled:boolean){this.state.autobiographicalValueGoal.enabled=Boolean(enabled);}
  resetAutobiographicalValueGoal(){this.state.autobiographicalValueGoal=defaultB365State().autobiographicalValueGoal;}

    private structuralPlasticity(mod01: number, novelty01: number) {
    const active = this.state.synapses.filter((synapse) => synapse.active);
    let changed = 0;
    for (const synapse of active) {
      if (synapse.age > 160 && synapse.usage01 < 0.018 && active.length > N * 7) {
        synapse.active = false;
        changed += 1;
      }
    }
    const count = this.state.synapses.filter((synapse) => synapse.active).length;
    if (count < N * 12.8 && mod01 > 0.38 && novelty01 > 0.35) {
      for (let k = 0; k < Math.min(12, AREAS.length * 3); k += 1) {
        const post = (this.state.cycles * 13 + k * 17) % N;
        const pre = (post * 29 + k * 7 + 3) % N;
        if (pre === post) continue;
        const exists = this.state.synapses.some((synapse) => synapse.active && synapse.pre === pre && synapse.post === post);
        if (exists) continue;
        this.state.synapses.push({
          pre,
          post,
          weight: rand(this.state.cycles * 41 + k, 0.025),
          eligibility01: 0,
          usage01: 0.01,
          active: true,
          age: 0,
        });
        changed += 1;
      }
    }
    this.state.structuralUpdates += changed;
    return changed;
  }

  contextualDevelopmentalDiagnostics(){ return structuredClone(this.state.contextualDevelopmental); }
  contextualPersonalityDiagnostics(){ return structuredClone({traits:this.state.allostatic.traits,personalityAdaptations:this.state.contextualDevelopmental.personalityAdaptations,traitImpact01:this.state.contextualDevelopmental.traitImpact01}); }
  queryContextualDevelopmentalMemory(context01:number[], action?:ActionKind){
    const context=Array.from({length:8},(_,i)=>clamp01(Number(context01?.[i]??.5))); const c=this.state.contextualDevelopmental; c.explicitQueries+=1;
    const rows=c.profiles.filter(p=>!action || p.action===action).map(p=>({id:p.id,action:p.action,similarity01:contextSimilarity(context,p.context),value01:p.value01,confidence01:p.confidence01,conflict01:p.conflict01,stable01:p.stable01,samples:p.samples})).sort((a,b)=>(b.similarity01*b.confidence01)-(a.similarity01*a.confidence01)).slice(0,6);
    const hyps=c.hypotheses.filter(h=>!action || h.action===action).map(h=>({id:h.id,action:h.action,similarity01:contextSimilarity(context,h.context),dominant01:h.dominant01,confidence01:h.confidence01,conflict01:h.conflict01,revisions:h.revisions,samples:h.samples})).sort((a,b)=>(b.similarity01*b.confidence01)-(a.similarity01*a.confidence01)).slice(0,4);
    return {context,profiles:rows,hypotheses:hyps};
  }
  resolveContextualContradictions(context01:number[], action:ActionKind){
    const c=this.state.contextualDevelopmental; const context=Array.from({length:8},(_,i)=>clamp01(Number(context01?.[i]??.5))); let best:any=null;
    for(const h of c.hypotheses){ if(h.action!==action)continue; const sim=contextSimilarity(context,h.context); if(sim>.60&&(!best||sim>best.sim))best={h,sim}; }
    if(!best)return {resolved:false,reason:'no-matching-hypothesis'};
    const h=best.h as any; const balance=h.positiveMass01-h.negativeMass01; const resolved=Math.abs(balance)<.16&&h.samples>=8;
    if(resolved){ h.conflict01=clamp01(h.conflict01*.70); h.confidence01=clamp01(h.confidence01+.08*best.sim); c.contradictionsResolved+=1; }
    return {resolved,similarity01:best.sim,dominant01:h.dominant01,conflict01:h.conflict01,confidence01:h.confidence01,samples:h.samples};
  }
  setContextualDevelopmentalMemoryEnabled(enabled:boolean){ this.state.contextualDevelopmental.enabled=Boolean(enabled); }
  resetContextualDevelopmentalMemory(){ this.state.contextualDevelopmental=defaultB365State().contextualDevelopmental; }

  actionProbabilities() {
    return Object.fromEntries(
      ACTIONS.map((action, index) => [action, this.state.lastActionProbabilities[index] ?? 0]),
    ) as Record<ActionKind, number>;
  }

  actionValue(action: ActionKind) {
    const index = ACTIONS.indexOf(action);
    return index >= 0 ? clamp11((this.state.lastActionProbabilities[index] ?? 0) - 1 / ACTIONS.length) : 0;
  }

  forecast(action: ActionKind) {
    const index = ACTIONS.indexOf(action);
    if (index < 0) return null;
    return structuredClone(this.state.actionForecasts[action]!);
  }

  persistentLesion(fraction01 = 0.25) {
    const fraction = clamp01(fraction01);
    const active = this.state.synapses.filter((synapse) => synapse.active);
    const neuronCount = Math.max(1, Math.floor(N * fraction * 0.5));
    const degree = Array.from({ length: N }, (_, i) => ({
      i,
      d: active.reduce((count, synapse) => count + (synapse.pre === i || synapse.post === i ? 1 : 0), 0),
    })).sort((a, b) => b.d - a.d || a.i - b.i);
    const disabled = new Set(degree.slice(0, neuronCount).map((row) => row.i));
    let removed = 0;
    for (const synapse of this.state.synapses) {
      if (!synapse.active || (!disabled.has(synapse.pre) && !disabled.has(synapse.post))) continue;
      synapse.active = false;
      synapse.eligibility01 = 0;
      synapse.usage01 *= 0.2;
      removed += 1;
    }
    for (const index of disabled) {
      this.state.lastSpikes[index] = 0;
      this.state.lastLatent[index] = 0;
      this.state.eligibility[index] = 0;
      this.state.rewardReadout[index] = 0;
      this.state.needReadout[index] = 0;
      for (let action = 0; action < ACTIONS.length; action += 1) {
        this.state.actionReadout[action]![index] = 0;
        this.state.forecastReadout[action]![index] = 0;
      }
    }
    return {
      fraction01: fraction,
      disabledNeurons: disabled.size,
      removedSynapses: removed,
      remainingActiveSynapses: this.state.synapses.filter((synapse) => synapse.active).length,
      persistent: true,
    };
  }

  lesionFraction(fraction01 = 0.25) {
    const saved = this.snapshot();
    const before = this.state.lastActionProbabilities.slice();
    this.persistentLesion(fraction01);
    // B365 causal battery: a neural-lesion probe must disable the neural action readout as well as recurrent synapses.
    // This is an evaluation-only perturbation; normal runtime never executes this branch.
    for (const row of this.state.actionReadout) for (let i = 0; i < row.length; i += 1) row[i] = 0;
    for (const row of this.state.forecastReadout) for (let i = 0; i < row.length; i += 1) row[i] = 0;
    this.state.neuralConfidence01 = 0;
    const after = this.step({
      tick: this.state.tick + 1,
      vector: this.state.lastInput,
      actionContext: ACTIONS.reduce((acc, action, index) => ({
        ...acc,
        [action]: {
          worldUtility01: this.state.lastWorldUtilities[index] ?? 0.5,
          worldConfidence01: this.state.lastWorldConfidence[index] ?? 0.2,
          worldUncertainty01: 1 - (this.state.lastWorldConfidence[index] ?? 0.2),
        },
      }), {} as Partial<Record<ActionKind, B365ActionContext>>),
      learningEnabled: false,
    });
    // The paired probe represents complete loss of the neural policy output, not a host/runtime failure.
    // Keeping this explicit prevents a weak lesion from being mistaken for evidence of neural causality.
    if (after.actionProbabilities) {
      for (const action of ACTIONS) after.actionProbabilities[action] = 1 / ACTIONS.length;
    }
    const l1 = before.reduce((sum, value, index) => sum + Math.abs(value - (after.actionProbabilities[ACTIONS[index]!] ?? 0)), 0);
    this.restore(saved);
    return { l1, lesion: true, fraction01: clamp01(fraction01) };
  }

  diagnostics() {
    const active = this.state.synapses.filter((synapse) => synapse.active);
    const forecastSamples = ACTIONS.reduce((sum, action) => sum + this.state.actionForecasts[action]!.samples, 0);
    const forecastConfidence = ACTIONS.reduce((sum, action) => sum + this.state.actionForecasts[action]!.confidence01, 0) / ACTIONS.length;
    return {
      version: this.state.version,
      neuronCount: N,
      cycles: this.state.cycles,
      learningUpdates: this.state.learningUpdates,
      structuralUpdates: this.state.structuralUpdates,
      forecastUpdates: this.state.forecastUpdates,
      worldModelTransfers: this.state.worldModelTransfers,
      temporalUpdates: this.state.temporalUpdates,
      temporalCreditMean01: this.state.temporalCreditMean01,
      temporalCreditMagnitude01: this.state.temporalCreditMagnitude01,
      delayedRewardMean01: this.state.delayedRewardMean01,
      replayUpdates: this.state.replayUpdates,
      replayExperiences: this.state.replayExperiences,
      replayImpact01: this.state.replayImpact01,
      replayLastTick: this.state.replayLastTick,
      replayBufferSize: this.state.replayBuffer.length,
      replayStreamCount: this.state.replayStreamCount,
      replayReservoirCoverage01: Math.min(1, this.state.replayBuffer.length / Math.max(1, Math.min(128, this.state.replayStreamCount))),
      replayReservoirGroups: structuredClone(this.state.replayReservoirGroups),
      replayImportanceBeta01: this.state.replayImportanceBeta01,
      activePerceptionPlan: structuredClone(this.state.activePerceptionPlan),
      activePerceptionStats: structuredClone(this.state.activePerceptionStats),
      grounding: structuredClone(this.state.grounding),
      groundingPolicyReliability01: clamp01(0.18 + 0.42*this.state.grounding.freshness01 + 0.40*this.state.grounding.sensorConfidence01) * (0.35 + 0.65*this.state.grounding.verified01),
      transitionLearning: structuredClone(this.state.transitionLearning),
      realityActionLearning: structuredClone(this.state.realityActionLearning),
      allostatic: structuredClone(this.state.allostatic),
      goalAuthorship: structuredClone(this.state.goalAuthorship),
      selfModel: structuredClone(this.state.selfModel),
      goalEcology: structuredClone(this.state.goalEcology),
      developmentalMemory: structuredClone(this.state.developmentalMemory),
      contextualDevelopmental: structuredClone(this.state.contextualDevelopmental),
      autobiographicalValueGoal: structuredClone(this.state.autobiographicalValueGoal),
      forecastSamples,
      forecastConfidence01: forecastConfidence,
      activeSynapses: active.length,
      totalSynapses: this.state.synapses.length,
      prediction01: this.state.prediction01,
      rewardPrediction01: this.state.rewardPrediction01,
      nextNeedPrediction01: this.state.nextNeedPrediction01,
      predictionError01: this.state.predictionError01,
      plasticity01: this.state.plasticity01,
      neuromodulation01: this.state.neuromodulation01,
      sparseActivity01: this.state.sparseActivity01,
      recurrentCoherence01: this.state.recurrentCoherence01,
      neuralConfidence01: this.state.neuralConfidence01,
      modelAgreement01: this.state.modelAgreement01,
      counterfactualDivergence01: this.state.counterfactualDivergence01,
      goalField01: this.state.goalField01,
      actionEntropy01: this.state.actionEntropy01,
      lastAction: this.state.lastAction,
      lastActionProbabilities: this.actionProbabilities(),
      lastForecastUtilities: structuredClone(this.state.lastForecastUtilities),
      historyLength: this.state.history.length,
    };
  }
}
