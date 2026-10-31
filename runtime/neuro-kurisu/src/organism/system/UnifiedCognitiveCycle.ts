/**
 * WorkPass 71 — Unified Cognitive Cycle contract.
 *
 * `coreComplete` preserves the established six-stage diagnostic. `complete`
 * is now a strict alias for `fullComplete` and requires all eleven stages plus
 * an independently verified full causal lineage from CognitiveEventFabric.
 * Schema-v1 snapshots are migrated conservatively: their former completion
 * counter is retained as core history, never silently re-labelled as full.
 */
import {
  CORE_CYCLE_STAGES,
  FULL_COGNITIVE_CYCLE_STAGES,
  evaluateCycleCompleteness,
  type CoreCycleStage,
  type FullCognitiveCycleStage,
} from './CycleCompletenessPolicy.ts';

export type UnifiedCycleStage = FullCognitiveCycleStage;

export interface UnifiedCognitiveCycleState {
  version: 2;
  cycles: number;
  coreCompleteCycles: number;
  fullCompleteCycles: number;
  /** Compatibility alias; now mirrors fullCompleteCycles only. */
  completeCycles: number;
  incompleteCycles: number;
  brokenLineages: number;
  meanCoreStageCoverage01: number;
  /** Strict eleven-stage coverage; older dashboards may continue reading this key. */
  meanStageCoverage01: number;
  meanCausalContinuity01: number;
  lastTick: number;
  lastCoreComplete: boolean;
  lastFullComplete: boolean;
  /** Compatibility alias for lastFullComplete. */
  lastComplete: boolean;
  lastCoreMissingStages: CoreCycleStage[];
  lastMissingStages: FullCognitiveCycleStage[];
}

export interface UnifiedCognitiveCycleResult {
  tick: number;
  coreStageCoverage01: number;
  stageCoverage01: number;
  causalContinuity01: number;
  coreComplete: boolean;
  fullComplete: boolean;
  /** Strict alias for fullComplete. */
  complete: boolean;
  coreMissingStages: CoreCycleStage[];
  missingStages: FullCognitiveCycleStage[];
  duplicatedIds: Array<{ id: string; stages: FullCognitiveCycleStage[] }>;
}

interface LegacyUnifiedCognitiveCycleStateV1 {
  version?: 1;
  cycles?: number;
  completeCycles?: number;
  incompleteCycles?: number;
  brokenLineages?: number;
  meanStageCoverage01?: number;
  meanCausalContinuity01?: number;
  lastTick?: number;
  lastComplete?: boolean;
  lastMissingStages?: unknown;
}

type RestorableUnifiedCognitiveCycleState = Partial<Omit<UnifiedCognitiveCycleState, 'version'>> & ({ version?: 2 } | LegacyUnifiedCognitiveCycleStateV1);

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const safeCounter = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const safeMetric = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : 0;
const safeTick = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= -1 ? value : -1;

function safeStageList<T extends string>(value: unknown, allowed: readonly T[], fallback: readonly T[]): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const malformed = value.some(stage => typeof stage !== 'string' || !allowed.includes(stage as T));
  if (malformed) return [...fallback];
  return [...new Set(value as T[])];
}

export const defaultUnifiedCognitiveCycle = (): UnifiedCognitiveCycleState => ({
  version: 2,
  cycles: 0,
  coreCompleteCycles: 0,
  fullCompleteCycles: 0,
  completeCycles: 0,
  incompleteCycles: 0,
  brokenLineages: 0,
  meanCoreStageCoverage01: 0,
  meanStageCoverage01: 0,
  meanCausalContinuity01: 0,
  lastTick: -1,
  lastCoreComplete: false,
  lastFullComplete: false,
  lastComplete: false,
  lastCoreMissingStages: [...CORE_CYCLE_STAGES],
  lastMissingStages: [...FULL_COGNITIVE_CYCLE_STAGES],
});

export class UnifiedCognitiveCycle {
  private state = defaultUnifiedCognitiveCycle();

  restore(raw?: RestorableUnifiedCognitiveCycleState | null): void {
    const source = (raw ?? {}) as RestorableUnifiedCognitiveCycleState;
    const version = source.version ?? 1;
    if (version !== 1 && version !== 2) throw new RangeError('unsupported cognitive-cycle state version');

    const cycles = safeCounter(source.cycles);
    const legacy = version === 1;
    // v1's completeCycles only proved the original six-stage contract.
    const legacyCoreComplete = legacy ? safeCounter(source.completeCycles) : 0;
    const fullCompleteCycles = legacy
      ? 0
      : Math.min(cycles, safeCounter(source.fullCompleteCycles ?? source.completeCycles));
    const coreCompleteCycles = Math.min(
      cycles,
      Math.max(fullCompleteCycles, legacy ? legacyCoreComplete : safeCounter(source.coreCompleteCycles)),
    );
    const incompleteCycles = cycles - fullCompleteCycles;
    const lastTick = safeTick(source.lastTick);

    const lastCoreMissingStages = legacy
      ? safeStageList(source.lastMissingStages, CORE_CYCLE_STAGES, CORE_CYCLE_STAGES)
      : safeStageList(source.lastCoreMissingStages, CORE_CYCLE_STAGES, CORE_CYCLE_STAGES);
    // A v1 snapshot cannot prove that all five previously optional stages were
    // supplied. Keep its historical six-stage result, but fail closed for full.
    const lastMissingStages = legacy
      ? [...FULL_COGNITIVE_CYCLE_STAGES]
      : safeStageList(source.lastMissingStages, FULL_COGNITIVE_CYCLE_STAGES, FULL_COGNITIVE_CYCLE_STAGES);

    const lastCoreComplete = cycles > 0 && lastTick >= 0 && (legacy
      ? source.lastComplete === true && lastCoreMissingStages.length === 0
      : source.lastCoreComplete === true && lastCoreMissingStages.length === 0);
    const lastFullComplete = !legacy
      && cycles > 0
      && lastTick >= 0
      && source.lastFullComplete === true
      && lastMissingStages.length === 0;

    this.state = {
      version: 2,
      cycles,
      coreCompleteCycles,
      fullCompleteCycles,
      completeCycles: fullCompleteCycles,
      incompleteCycles,
      brokenLineages: Math.min(incompleteCycles, safeCounter(source.brokenLineages)),
      meanCoreStageCoverage01: legacy ? safeMetric(source.meanStageCoverage01) : safeMetric(source.meanCoreStageCoverage01),
      meanStageCoverage01: legacy ? 0 : safeMetric(source.meanStageCoverage01),
      meanCausalContinuity01: safeMetric(source.meanCausalContinuity01),
      lastTick,
      lastCoreComplete,
      lastFullComplete,
      lastComplete: lastFullComplete,
      lastCoreMissingStages,
      lastMissingStages,
    };
  }

  evaluate(input: {
    tick: number;
    stageIds: Partial<Record<UnifiedCycleStage, string | undefined>>;
    parentIntegrity01: number;
    coreLineageComplete?: boolean;
    fullLineageComplete?: boolean;
    fullIntegrity01?: number;
  }): UnifiedCognitiveCycleResult {
    if (input === null || typeof input !== 'object') throw new TypeError('cognitive cycle input must be an object');
    if (input.stageIds === null || typeof input.stageIds !== 'object' || Array.isArray(input.stageIds)) {
      throw new TypeError('stageIds must be an object');
    }
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('cognitive cycle tick must be a non-negative safe integer');
    if (input.tick <= this.state.lastTick) throw new RangeError('cognitive cycle tick must strictly increase');
    if (typeof input.parentIntegrity01 !== 'number' || !Number.isFinite(input.parentIntegrity01) || input.parentIntegrity01 < 0 || input.parentIntegrity01 > 1) {
      throw new RangeError('parentIntegrity01 must be a finite value in [0, 1]');
    }
    const fullIntegrity01 = input.fullIntegrity01 ?? 0;
    if (typeof fullIntegrity01 !== 'number' || !Number.isFinite(fullIntegrity01) || fullIntegrity01 < 0 || fullIntegrity01 > 1) {
      throw new RangeError('fullIntegrity01 must be a finite value in [0, 1]');
    }
    if (this.state.cycles >= Number.MAX_SAFE_INTEGER) throw new RangeError('cognitive cycle counter reached its safe integer limit');

    const completeness = evaluateCycleCompleteness({
      stageIds: input.stageIds,
      lineage: {
        complete: input.coreLineageComplete ?? input.parentIntegrity01 >= 0.5,
        fullComplete: input.fullLineageComplete ?? false,
        integrity01: input.parentIntegrity01,
        fullIntegrity01,
      },
    });

    const coreComplete = completeness.coreComplete;
    const fullComplete = completeness.fullComplete;
    const cycles = this.state.cycles + 1;
    const mean = (previous: number, value: number): number => ((previous * (cycles - 1)) + value) / cycles;

    this.state = {
      ...this.state,
      cycles,
      coreCompleteCycles: this.state.coreCompleteCycles + (coreComplete ? 1 : 0),
      fullCompleteCycles: this.state.fullCompleteCycles + (fullComplete ? 1 : 0),
      completeCycles: this.state.fullCompleteCycles + (fullComplete ? 1 : 0),
      incompleteCycles: this.state.incompleteCycles + (fullComplete ? 0 : 1),
      brokenLineages: this.state.brokenLineages + (input.parentIntegrity01 < 0.5 ? 1 : 0),
      meanCoreStageCoverage01: mean(this.state.meanCoreStageCoverage01, completeness.coreCoverage01),
      meanStageCoverage01: mean(this.state.meanStageCoverage01, completeness.fullCoverage01),
      meanCausalContinuity01: mean(this.state.meanCausalContinuity01, input.parentIntegrity01),
      lastTick: input.tick,
      lastCoreComplete: coreComplete,
      lastFullComplete: fullComplete,
      lastComplete: fullComplete,
      lastCoreMissingStages: [...completeness.coreMissingStages],
      lastMissingStages: [...completeness.fullMissingStages],
    };

    return {
      tick: input.tick,
      coreStageCoverage01: completeness.coreCoverage01,
      stageCoverage01: completeness.fullCoverage01,
      causalContinuity01: input.parentIntegrity01,
      coreComplete,
      fullComplete,
      complete: fullComplete,
      coreMissingStages: [...completeness.coreMissingStages],
      missingStages: [...completeness.fullMissingStages],
      duplicatedIds: structuredClone(completeness.duplicatedIds),
    };
  }

  snapshot(): UnifiedCognitiveCycleState {
    return structuredClone({
      ...this.state,
      lastCoreMissingStages: [...this.state.lastCoreMissingStages],
      lastMissingStages: [...this.state.lastMissingStages],
    });
  }
}
