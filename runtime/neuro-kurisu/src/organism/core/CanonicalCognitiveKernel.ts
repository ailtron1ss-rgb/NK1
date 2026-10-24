import {
  CognitiveEventFabric,
  type CognitiveEventNode,
  type CognitiveStage,
  type OperationalCycleLineageCheck,
} from '../system/CognitiveEventFabric.ts';
import {
  UnifiedCognitiveCycle,
  type UnifiedCognitiveCycleResult,
  type UnifiedCycleStage,
} from '../system/UnifiedCognitiveCycle.ts';
import { sha256Stable } from './StableSerialization.ts';

export interface CanonicalCognitiveStageInput {
  source: string;
  external?: boolean;
  confidence01: number;
  payload: Record<string, unknown>;
}

export interface CanonicalCognitiveCycleAnchors {
  tick?: number;
  at?: number;
  observation?: string;
  prediction?: string;
  appraisal?: string;
  attention?: string;
  memory?: string;
  goal?: string;
  plan?: string;
  action?: string;
}

export interface CanonicalDecisionCycleAnchors extends CanonicalCognitiveCycleAnchors {
  tick: number;
  at: number;
  observation: string;
  prediction: string;
  appraisal: string;
  attention: string;
  memory: string;
  goal: string;
  plan: string;
  action: string;
}

export interface CanonicalDecisionCycleEvents {
  anchors: CanonicalDecisionCycleAnchors;
  observationEvent: CognitiveEventNode;
  predictionEvent: CognitiveEventNode;
  appraisalEvent: CognitiveEventNode;
  attentionEvent: CognitiveEventNode;
  memoryEvent: CognitiveEventNode;
  goalEvent: CognitiveEventNode;
  planEvent: CognitiveEventNode;
  actionEvent: CognitiveEventNode;
}

export interface CanonicalCycleCompletion {
  tick: number;
  outcomeEvent: CognitiveEventNode;
  learningEvent: CognitiveEventNode;
  selfUpdateEvent: CognitiveEventNode;
  cycleLineage: OperationalCycleLineageCheck;
  cycleResult: UnifiedCognitiveCycleResult | null;
  completionRecorded: boolean;
  replayed: boolean;
}

type CanonicalEventFingerprintInput = {
  tick: number;
  at: number;
  stage: CognitiveStage;
  source: string;
  parentIds: string[];
  external: boolean;
  confidence01: number;
  payload: Record<string, unknown>;
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const eventFingerprint = (event: CanonicalEventFingerprintInput | CognitiveEventNode): string =>
  sha256Stable({
    tick: event.tick,
    at: event.at,
    stage: event.stage,
    source: event.source,
    parentIds: event.parentIds,
    external: event.external,
    confidence01: event.confidence01,
    payload: event.payload,
  });

function assertStageInput(label: string, value: unknown): asserts value is CanonicalCognitiveStageInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`canonical-cognitive-kernel-${label}-stage-required`);
  }
  const stage = value as Record<string, unknown>;
  if (typeof stage.source !== 'string' || !stage.source.trim()) {
    throw new TypeError(`canonical-cognitive-kernel-${label}-source-required`);
  }
  if (
    typeof stage.confidence01 !== 'number' ||
    !Number.isFinite(stage.confidence01) ||
    stage.confidence01 < 0 ||
    stage.confidence01 > 1
  ) {
    throw new RangeError(`canonical-cognitive-kernel-${label}-confidence-must-be-in-0-1`);
  }
  if (stage.external !== undefined && typeof stage.external !== 'boolean') {
    throw new TypeError(`canonical-cognitive-kernel-${label}-external-must-be-boolean`);
  }
  if (!stage.payload || typeof stage.payload !== 'object' || Array.isArray(stage.payload)) {
    throw new TypeError(`canonical-cognitive-kernel-${label}-payload-must-be-a-record`);
  }
}

/**
 * The single coordinator for NK1's internal cognitive cycle.
 * OrganismCore owns domain computation; this class binds those results into one
 * causal chain and closes it with outcome, learning and self-update evidence.
 * The event and cycle classes remain ledgers/verifiers, not parallel decision-makers.
 */
export class CanonicalCognitiveKernel {
  private readonly eventFabric: CognitiveEventFabric;
  private readonly unifiedCycle: UnifiedCognitiveCycle;

  constructor(eventFabric: CognitiveEventFabric, unifiedCycle: UnifiedCognitiveCycle) {
    this.eventFabric = eventFabric;
    this.unifiedCycle = unifiedCycle;
  }

  private resolveAt(at?: number): number {
    if (at === undefined) return Date.now();
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) {
      throw new RangeError('canonical-cognitive-kernel-at-must-be-a-non-negative-finite-number');
    }
    return at;
  }

  private appendStage(
    tick: number,
    at: number,
    stage: CognitiveStage,
    input: CanonicalCognitiveStageInput,
    parentIds: string[] = [],
  ): CognitiveEventNode {
    const eventInput: CanonicalEventFingerprintInput = {
      tick,
      at,
      stage,
      source: String(input.source || 'unknown').slice(0, 120),
      parentIds: parentIds.map(String).slice(0, 12),
      external: Boolean(input.external),
      confidence01: clamp01(input.confidence01),
      payload: { ...input.payload },
    };
    // One operational stage has one stable identity per logical tick. Replaying
    // identical input is idempotent; reusing a tick for different evidence fails
    // closed instead of silently accepting the previous event as if it were new.
    const event = this.eventFabric.append({
      ...eventInput,
      id: `cef:kernel:${tick}:${stage}`,
    });
    if (eventFingerprint(event) !== eventFingerprint(eventInput)) {
      throw new Error('canonical-cognitive-kernel-event-conflict');
    }
    return event;
  }

  beginDecisionCycle(input: {
    tick: number;
    at?: number;
    observation: CanonicalCognitiveStageInput;
    prediction: CanonicalCognitiveStageInput;
    appraisal: CanonicalCognitiveStageInput;
    attention: CanonicalCognitiveStageInput;
    memory: CanonicalCognitiveStageInput;
    goal: CanonicalCognitiveStageInput;
    plan: CanonicalCognitiveStageInput;
    action: CanonicalCognitiveStageInput;
  }): CanonicalDecisionCycleEvents {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('canonical-cognitive-kernel-input-required');
    }
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
      throw new RangeError('canonical-cognitive-kernel-tick-must-be-a-non-negative-safe-integer');
    }
    // Validate every stage before appending anything; malformed input must not
    // leave a partially written decision cycle in the shared causal ledger.
    const stageInputs = [
      ['observation', input.observation],
      ['prediction', input.prediction],
      ['appraisal', input.appraisal],
      ['attention', input.attention],
      ['memory', input.memory],
      ['goal', input.goal],
      ['plan', input.plan],
      ['action', input.action],
    ] as const;
    for (const [label, value] of stageInputs) assertStageInput(label, value);
    const at = this.resolveAt(input.at);
    const parents = (...ids: Array<string | undefined>): string[] =>
      ids.filter((id): id is string => typeof id === 'string' && id.length > 0);

    const observationEvent = this.appendStage(input.tick, at, 'observation', input.observation);
    const predictionEvent = this.appendStage(input.tick, at, 'prediction', input.prediction, parents(observationEvent.id));
    const appraisalEvent = this.appendStage(input.tick, at, 'appraisal', input.appraisal, parents(observationEvent.id, predictionEvent.id));
    const attentionEvent = this.appendStage(input.tick, at, 'attention', input.attention, parents(appraisalEvent.id, predictionEvent.id));
    const memoryEvent = this.appendStage(input.tick, at, 'memory', input.memory, parents(attentionEvent.id, observationEvent.id));
    const goalEvent = this.appendStage(input.tick, at, 'goal', input.goal, parents(appraisalEvent.id, memoryEvent.id, predictionEvent.id));
    const planEvent = this.appendStage(input.tick, at, 'plan', input.plan, parents(goalEvent.id, predictionEvent.id));
    const actionEvent = this.appendStage(input.tick, at, 'action', input.action, parents(planEvent.id, predictionEvent.id, observationEvent.id));
    const anchors: CanonicalDecisionCycleAnchors = {
      tick: input.tick, at, observation: observationEvent.id, prediction: predictionEvent.id,
      appraisal: appraisalEvent.id, attention: attentionEvent.id, memory: memoryEvent.id,
      goal: goalEvent.id, plan: planEvent.id, action: actionEvent.id,
    };
    return {
      anchors, observationEvent, predictionEvent, appraisalEvent, attentionEvent,
      memoryEvent, goalEvent, planEvent, actionEvent,
    };
  }

  completeCycle(input: {
    anchors: CanonicalCognitiveCycleAnchors;
    fallbackTick: number;
    at?: number;
    outcome: CanonicalCognitiveStageInput;
    learning: CanonicalCognitiveStageInput;
    selfUpdate: CanonicalCognitiveStageInput;
  }): CanonicalCycleCompletion {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('canonical-cognitive-kernel-completion-input-required');
    }
    if (!Number.isSafeInteger(input.fallbackTick) || input.fallbackTick < 0) {
      throw new RangeError('canonical-cognitive-kernel-fallback-tick-must-be-a-non-negative-safe-integer');
    }
    if (!input.anchors || typeof input.anchors !== 'object' || Array.isArray(input.anchors)) {
      throw new TypeError('canonical-cognitive-kernel-anchors-required');
    }
    const anchorTick = input.anchors.tick;
    if (anchorTick !== undefined && (!Number.isSafeInteger(anchorTick) || anchorTick < 0)) {
      throw new RangeError('canonical-cognitive-kernel-anchor-tick-must-be-a-non-negative-safe-integer');
    }
    for (const key of ['at', 'observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal', 'plan', 'action'] as const) {
      const value = input.anchors[key];
      if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
        throw new TypeError(`canonical-cognitive-kernel-anchor-${key}-must-be-a-non-empty-string`);
      }
    }
    assertStageInput('outcome', input.outcome);
    assertStageInput('learning', input.learning);
    assertStageInput('self-update', input.selfUpdate);
    // Late feedback closes the logical action tick; 'at' keeps the real arrival time.
    const tick = anchorTick ?? input.fallbackTick;
    const at = this.resolveAt(input.at);
    const parents = (...ids: Array<string | undefined>): string[] =>
      ids.filter((id): id is string => typeof id === 'string' && id.length > 0);

    const outcomeEvent = this.appendStage(tick, at, 'outcome', input.outcome, parents(input.anchors.action, input.anchors.prediction));
    const learningEvent = this.appendStage(tick, at, 'learning', input.learning, parents(outcomeEvent.id));
    const selfUpdateEvent = this.appendStage(tick, at, 'self-update', input.selfUpdate, parents(learningEvent.id));
    const stageIds: Partial<Record<UnifiedCycleStage, string | undefined>> = {
      observation: input.anchors?.observation, prediction: input.anchors?.prediction,
      appraisal: input.anchors?.appraisal, attention: input.anchors?.attention,
      memory: input.anchors?.memory, goal: input.anchors?.goal, plan: input.anchors?.plan,
      action: input.anchors?.action, outcome: outcomeEvent.id, learning: learningEvent.id,
      'self-update': selfUpdateEvent.id,
    };
    const cycleLineage = this.eventFabric.verifyOperationalCycle(stageIds);
    const prior = this.unifiedCycle.snapshot();
    let cycleResult: UnifiedCognitiveCycleResult | null = null;
    let replayed = false;
    if (tick > prior.lastTick) {
      cycleResult = this.unifiedCycle.evaluate({
        tick,
        stageIds,
        parentIntegrity01: cycleLineage.complete ? cycleLineage.integrity01 : 0,
      });
    } else if (tick === prior.lastTick) {
      // A duplicate delivery of the same completion is idempotent. Reflect the
      // already-recorded result instead of returning "not completed" on replay.
      replayed = true;
      cycleResult = {
        tick,
        stageCoverage01: Math.max(0, 1 - prior.lastMissingStages.length / 6),
        causalContinuity01: cycleLineage.integrity01,
        complete: prior.lastComplete && cycleLineage.complete,
        missingStages: [...prior.lastMissingStages],
      };
    }
    return {
      tick, outcomeEvent, learningEvent, selfUpdateEvent, cycleLineage, cycleResult,
      completionRecorded: Boolean(cycleResult?.complete),
      replayed,
    };
  }
}
