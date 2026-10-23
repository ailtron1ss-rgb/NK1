import type { OrganismCycleResult, OrganismDecisionTrace, OrganismObservation, ActionKind, WorkspaceFrame } from './types.ts';
import type { PersistedOrganism } from './OrganismCore.ts';
import type { CognitiveRuntimeCluster } from './CognitiveRuntimeCluster.ts';
import type { DevelopmentalNeuralRuntime } from './DevelopmentalNeuralRuntime.ts';
import type { OrganismSystemFabric } from './OrganismSystemFabric.ts';
import type { PersistenceRuntime } from './PersistenceRuntime.ts';
import type { WorldSubsystemRuntime } from './WorldSubsystemRuntime.ts';
import { clamp, goalVectorFallback } from './ExecutionPrimitives.ts';

export function finiteOr(value: unknown, fallback: number): number {
  // Keep the safety boundary total: neither input nor fallback may leak NaN/Infinity.
  const safeFallback = Number.isFinite(fallback) ? fallback : 0;
  // Do not let null, booleans, or empty strings silently become a valid zero.
  if (typeof value !== 'number' && typeof value !== 'string') return safeFallback;
  if (typeof value === 'string' && value.trim().length === 0) return safeFallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : safeFallback;
}

/**
 * Capability-limited host surface for reduced-resolution life ticks.
 * The micro-cycle can mutate canonical organism state and update the same
 * neural/continuity owners as the full cycle, but it cannot access Core's
 * unrelated orchestration methods or instantiate domain services.
 */
export interface OperationalMicroCycleContext {
  persisted: PersistedOrganism;
  cognitiveRuntime: CognitiveRuntimeCluster;
  organismSystems: OrganismSystemFabric;
  developmentalNeural: DevelopmentalNeuralRuntime;
  worldSubsystem: WorldSubsystemRuntime;
  persistence: PersistenceRuntime;
  effectiveCheckpointDirtyCycles: () => number;
  checkpoint: (force: boolean) => Promise<void>;
}

export class OperationalMicroCycleRuntime {
  private readonly contextProvider: () => OperationalMicroCycleContext;

  constructor(contextProvider: () => OperationalMicroCycleContext) {
    this.contextProvider = contextProvider;
  }

  async run(observation: OrganismObservation): Promise<OrganismCycleResult> {
    const host = this.contextProvider();
    const { persisted: persistedState, cognitiveRuntime, organismSystems, developmentalNeural, worldSubsystem, persistence } = host;
    const state = persistedState.state;
    const before = { ...state, needs: { ...state.needs } };
    const at = Date.now();
    state.at = at;
    state.tick += 1;
    const body = observation.embodiment;
    const targetEnergy = clamp(finiteOr(body?.bodyEnergy01, state.needs.energy));
    const targetCapacity = clamp(finiteOr(body?.cognitiveCapacity01, 1 - state.needs.cognitiveLoad));
    const thermal = clamp(finiteOr(body?.thermalStrain01, state.needs.cognitiveLoad));
    state.needs.energy = clamp(state.needs.energy * 0.94 + targetEnergy * 0.06);
    state.needs.cognitiveLoad = clamp(state.needs.cognitiveLoad * 0.90 + (1 - targetCapacity) * 0.10 + (thermal > 0.72 ? 0.02 : 0));
    state.needs.uncertainty = clamp(state.needs.uncertainty * 0.985);
    state.needs.novelty = clamp(state.needs.novelty * 0.97);
    state.needs.socialNeed = clamp(state.needs.socialNeed * 0.997);
    state.needs.goalPressure = clamp(state.needs.goalPressure * 0.992);
    state.predictionError = clamp(state.predictionError * 0.975);
    state.attentionBudget = clamp(state.attentionBudget * 0.93 + Math.max(0.18, 1 - state.needs.cognitiveLoad) * 0.07);

    cognitiveRuntime.temporalContinuity.heartbeat(at);
    persistedState.facets.advanced.temporalContinuity = cognitiveRuntime.temporalContinuity.snapshot();

    organismSystems.self.p39Life.beginCycle({
      at,
      host: process.env.NEURO_HOST_ID || 'phone-host',
      awake: body?.awake ?? true,
      energy01: state.needs.energy,
      cognitiveLoad01: state.needs.cognitiveLoad,
      battery01: body?.battery01,
      thermal01: body?.thermalStrain01,
      storagePressure01: 0,
    });
    persistedState.facets.learning.p39 = organismSystems.self.p39Life.snapshot();

    const microIdentity01 = persistedState.facets.consciousness.identityContinuity.continuity;
    const microP51 = worldSubsystem.p51GroundedCausalWorkspace.summary();
    const microP50 = worldSubsystem.p50CausalSelfWorld.summary();
    persistedState.facets.advanced.p54LongHorizonEvidence = organismSystems.self.p54LongHorizonEvidence.observe({
      tick: state.tick,
      at,
      predictionError01: state.predictionError,
      selfPredictionError01: state.selfPredictionError,
      identity01: microIdentity01,
      grounding01: microP51.groundingQuality01,
      causalAlignment01: microP50.selfWorldAlignment01,
      stress01: 1 - clamp(finiteOr(body?.cognitiveCapacity01, 0.8)),
    });
    persistedState.system.temporalResolution = cognitiveRuntime.temporalResolutionGovernor.snapshot();
    const microResource = developmentalNeural.resourceAllocator.snapshot();
    developmentalNeural.longHorizonDevelopmentB302.recordMicro(state.tick, microResource.scarcity01);

    // This reduced-resolution heartbeat does not execute a new action. Reusing the
    // previous decision's action would falsely bind a stale action to this tick and
    // contaminate action-conditioned neural experience. Keep the last real action
    // in continuity/workspace metadata only; the micro-tick itself is explicitly wait.
    const microAction: ActionKind = 'wait';
    // A micro-tick has no canonical verifier result or action-correlated evidence.
    // Treat incoming reward/success as claims, not verified credit. Keep the
    // neutral baseline until the full-cycle verifier can pass its evidence here.
    const microReward = 0.5;
    const microError = clamp(finiteOr(observation.surprise, state.predictionError));
    const microVerified = false;
    const microSeed = [
      state.needs.energy,
      state.needs.uncertainty,
      state.needs.novelty,
      state.needs.cognitiveLoad,
      state.needs.goalPressure,
      state.needs.socialNeed,
      state.predictionError,
      state.autonomyScore,
      state.selfPredictionError,
      persistedState.facets.consciousness.identityContinuity.continuity,
      microReward,
      0.5,
      thermal,
      targetCapacity,
      finiteOr(body?.battery01, state.needs.energy),
      finiteOr(body?.sensoryFreshness01, 0.8),
      finiteOr(body?.cpuLoad01, state.needs.cognitiveLoad),
      finiteOr(body?.ramPressure01, microResource.ramPressure01),
      state.attentionBudget,
      persistedState.facets.consciousness.identityContinuity.goalContinuity,
      Math.sin(state.tick * 0.071) * 0.5 + 0.5,
      Math.cos(state.tick * 0.053) * 0.5 + 0.5,
      ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'].indexOf(microAction) / 6,
      ...Array.from({ length: 12 }, (_, k) => Math.tanh((state.tick * (k + 3) + k * 17) % 97 / 97 - 0.5)),
      ...goalVectorFallback(persistedState.goals, state).slice(0, 28),
    ];
    const microInput = Array.from({ length: 64 }, (_, k) => clamp(Number(microSeed[k] ?? Math.tanh((state.tick + k * 11) * 0.013))));
    developmentalNeural.neuralExperienceBranch.microTick({
      tick: state.tick,
      input: microInput,
      action: microAction,
      reward01: microReward,
      predictionError01: microError,
      verified01: microVerified ? 1 : 0,
      novelty01: state.needs.novelty,
      uncertainty01: state.needs.uncertainty,
      goalPressure01: state.needs.goalPressure,
      identityGap01: clamp(1 - persistedState.facets.consciousness.identityContinuity.continuity),
      identityVector: developmentalNeural.neuralAutobiographicalIdentityB284.identityLatent(),
      sensorFreshness01: clamp(finiteOr(body?.sensoryFreshness01, 0.8)),
      worldConfidence01: clamp(0.35 + (1 - state.needs.uncertainty) * 0.25),
      selfContinuity01: clamp(persistedState.facets.consciousness.identityContinuity.continuity),
    });

    const previousDecision = persistedState.traces[0];
    const decision: OrganismDecisionTrace = {
      id: `temporal-micro:${state.tick}:${at}`,
      tick: state.tick,
      createdAt: at,
      candidates: [],
      selected: null,
      stateBefore: before,
      stateAfter: { ...state, needs: { ...state.needs } },
      reasoningSignals: { temporalMicroCycle: 1, idleCyclesSincePulse: cognitiveRuntime.temporalResolutionGovernor.snapshot().idleCyclesSincePulse },
      userRequestedAction: null,
      autonomousOverride: false,
      predictedOutcomes: [],
    };
    const workspace: WorkspaceFrame = {
      tick: state.tick,
      broadcastId: `micro:${state.tick}`,
      selected: [],
      content: { temporalResolution: 'micro', lastAction: previousDecision?.selected?.action ?? state.lastAction },
      recurrentCycles: 0,
    };

    persistence.persistenceDirty = true;
    persistence.dirtyCycles += 1;
    if (persistence.dirtyCycles >= host.effectiveCheckpointDirtyCycles()) {
      await host.checkpoint(false);
    }

    return {
      state: structuredClone(state),
      goals: persistedState.goals.slice(0, 16).map(goal => ({ ...goal })),
      memories: persistedState.memories.slice(0, 16).map(memory => ({ ...memory, evidence: memory.evidence?.slice(-4) })),
      workspace,
      decision,
    };
  }
}
