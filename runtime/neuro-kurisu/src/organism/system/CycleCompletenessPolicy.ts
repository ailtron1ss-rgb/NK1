/**
 * WorkPass 71 — two-tier cognitive-cycle completeness policy.
 *
 * The six-stage core cycle is retained as a compatibility/diagnostic metric.
 * A full cognitive cycle is stricter: all eleven stages must exist as distinct
 * events and the CognitiveEventFabric must independently verify every causal
 * edge. A core-complete trace is never promoted to full-complete by this file.
 */
export const CORE_CYCLE_STAGES = [
  'observation',
  'prediction',
  'action',
  'outcome',
  'learning',
  'self-update',
] as const;

export const FULL_COGNITIVE_CYCLE_STAGES = [
  'observation',
  'prediction',
  'appraisal',
  'attention',
  'memory',
  'goal',
  'plan',
  'action',
  'outcome',
  'learning',
  'self-update',
] as const;

export type CoreCycleStage = typeof CORE_CYCLE_STAGES[number];
export type FullCognitiveCycleStage = typeof FULL_COGNITIVE_CYCLE_STAGES[number];
export type CycleStageIds = Partial<Record<FullCognitiveCycleStage, string | undefined>>;

export interface CycleLineageStatus {
  /** Legacy-compatible core lineage verdict (six-stage spine). */
  complete: boolean;
  /** Strict verdict from CognitiveEventFabric for every stage and edge. */
  fullComplete: boolean;
  /** Core lineage integrity in [0,1]. */
  integrity01: number;
  /** Full eleven-stage lineage integrity in [0,1]. */
  fullIntegrity01: number;
}

export interface CycleCompletenessResult {
  coreComplete: boolean;
  fullComplete: boolean;
  coreCoverage01: number;
  fullCoverage01: number;
  coreMissingStages: CoreCycleStage[];
  fullMissingStages: FullCognitiveCycleStage[];
  duplicatedIds: Array<{ id: string; stages: FullCognitiveCycleStage[] }>;
  lineageIntegrity01: number;
  fullLineageIntegrity01: number;
  reason:
    | 'all-eleven-stages-and-causal-lineage-verified'
    | 'core-cycle-or-causal-lineage-incomplete'
    | 'core-cycle-complete-but-full-eleven-stage-cycle-not-proven';
}

const validId = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0
  && value.length <= 256
  && value.trim().length > 0
  && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);

function missingStages<T extends string>(stageIds: Partial<Record<T, string | undefined>>, required: readonly T[]): T[] {
  return required.filter(stage => !Object.hasOwn(stageIds, stage) || !validId(stageIds[stage]));
}

function findDuplicatedIds(stageIds: CycleStageIds): Array<{ id: string; stages: FullCognitiveCycleStage[] }> {
  const byId = new Map<string, FullCognitiveCycleStage[]>();
  for (const stage of FULL_COGNITIVE_CYCLE_STAGES) {
    if (!Object.hasOwn(stageIds, stage)) continue;
    const id = stageIds[stage];
    if (!validId(id)) continue;
    const stages = byId.get(id) ?? [];
    stages.push(stage);
    byId.set(id, stages);
  }
  return [...byId.entries()]
    .filter(([, stages]) => stages.length > 1)
    .map(([id, stages]) => ({ id, stages }));
}

/**
 * Evaluate core and full cycle completeness without mutating runtime state.
 * `lineage.fullComplete` must come from the event fabric, never from this
 * policy or from a language-model assertion.
 */
export function evaluateCycleCompleteness(input: {
  stageIds: CycleStageIds;
  lineage: CycleLineageStatus;
}): CycleCompletenessResult {
  if (!input || typeof input !== 'object') throw new TypeError('cycle completeness input must be an object');
  if (!input.stageIds || typeof input.stageIds !== 'object' || Array.isArray(input.stageIds)) {
    throw new TypeError('stageIds must be an object');
  }
  if (!input.lineage || typeof input.lineage !== 'object' || Array.isArray(input.lineage)) {
    throw new TypeError('lineage must be an object');
  }
  if (typeof input.lineage.complete !== 'boolean') throw new TypeError('lineage.complete must be boolean');
  if (typeof input.lineage.fullComplete !== 'boolean') throw new TypeError('lineage.fullComplete must be boolean');

  const integrity01 = input.lineage.integrity01;
  if (typeof integrity01 !== 'number' || !Number.isFinite(integrity01) || integrity01 < 0 || integrity01 > 1) {
    throw new RangeError('lineage.integrity01 must be a finite number in [0, 1]');
  }
  const fullIntegrity01 = input.lineage.fullIntegrity01;
  if (typeof fullIntegrity01 !== 'number' || !Number.isFinite(fullIntegrity01) || fullIntegrity01 < 0 || fullIntegrity01 > 1) {
    throw new RangeError('lineage.fullIntegrity01 must be a finite number in [0, 1]');
  }

  const coreMissing = missingStages(input.stageIds, CORE_CYCLE_STAGES);
  const fullMissing = missingStages(input.stageIds, FULL_COGNITIVE_CYCLE_STAGES);
  const duplicatedIds = findDuplicatedIds(input.stageIds);
  const coreHasDuplicate = duplicatedIds.some(item => item.stages.some(stage => (CORE_CYCLE_STAGES as readonly string[]).includes(stage)));
  const coreComplete = coreMissing.length === 0
    && !coreHasDuplicate
    && input.lineage.complete
    && integrity01 >= 0.5;
  const fullComplete = fullMissing.length === 0
    && duplicatedIds.length === 0
    && input.lineage.fullComplete
    && fullIntegrity01 === 1;

  return {
    coreComplete,
    fullComplete,
    coreCoverage01: (CORE_CYCLE_STAGES.length - coreMissing.length) / CORE_CYCLE_STAGES.length,
    fullCoverage01: (FULL_COGNITIVE_CYCLE_STAGES.length - fullMissing.length) / FULL_COGNITIVE_CYCLE_STAGES.length,
    coreMissingStages: coreMissing,
    fullMissingStages: fullMissing,
    duplicatedIds,
    lineageIntegrity01: integrity01,
    fullLineageIntegrity01: fullIntegrity01,
    reason: fullComplete
      ? 'all-eleven-stages-and-causal-lineage-verified'
      : !coreComplete
        ? 'core-cycle-or-causal-lineage-incomplete'
        : 'core-cycle-complete-but-full-eleven-stage-cycle-not-proven',
  };
}
