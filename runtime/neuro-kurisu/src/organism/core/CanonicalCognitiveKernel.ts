import {
  CognitiveEventFabric,
  type CognitiveEventNode,
  type OperationalCycleLineageCheck,
} from '../system/CognitiveEventFabric.ts';
import {
  UnifiedCognitiveCycle,
  type UnifiedCognitiveCycleResult,
  type UnifiedCycleStage,
} from '../system/UnifiedCognitiveCycle.ts';

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
}

/**
 * The single coordinator for NK1's internal cognitive cycle.
 * OrganismCore owns domain computation; this class binds those results into one
 * causal chain and closes it with outcome, learning and self-update evidence.
 * The event and cycle classes remain ledgers/verifiers, not parallel decision-makers.
 */
export class CanonicalCognitiveKernel {
  constructor(
    private readonly eventFabric: CognitiveEventFabric,
    private readonly unifiedCycle: UnifiedCognitiveCycle,
  ) {}

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
    if (!Number.isSafeInteger(input?.tick) || input.tick < 0) {
      throw new RangeError('canonical-cognitive-kernel-tick-must-be-a-non-negative-safe-integer');
    }
    const at = typeof input.at === 'number' && Number.isFinite(input.at) && input.at >= 0
      ? input.at
      : Date.now();
    const parents = (...ids: Array<string | undefined>): string[] =>
      ids.filter((id): id is string => typeof id === 'string' && id.length > 0);

    const observationEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'observation', source: input.observation.source,
      external: input.observation.external, confidence01: input.observation.confidence01, payload: input.observation.payload,
    });
    const predictionEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'prediction', source: input.prediction.source,
      parentIds: parents(observationEvent.id), external: input.prediction.external,
      confidence01: input.prediction.confidence01, payload: input.prediction.payload,
    });
    const appraisalEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'appraisal', source: input.appraisal.source,
      parentIds: parents(observationEvent.id, predictionEvent.id), external: input.appraisal.external,
      confidence01: input.appraisal.confidence01, payload: input.appraisal.payload,
    });
    const attentionEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'attention', source: input.attention.source,
      parentIds: parents(appraisalEvent.id, predictionEvent.id), external: input.attention.external,
      confidence01: input.attention.confidence01, payload: input.attention.payload,
    });
    const memoryEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'memory', source: input.memory.source,
      parentIds: parents(attentionEvent.id, observationEvent.id), external: input.memory.external,
      confidence01: input.memory.confidence01, payload: input.memory.payload,
    });
    const goalEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'goal', source: input.goal.source,
      parentIds: parents(appraisalEvent.id, memoryEvent.id, predictionEvent.id), external: input.goal.external,
      confidence01: input.goal.confidence01, payload: input.goal.payload,
    });
    const planEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'plan', source: input.plan.source,
      parentIds: parents(goalEvent.id, predictionEvent.id), external: input.plan.external,
      confidence01: input.plan.confidence01, payload: input.plan.payload,
    });
    const actionEvent = this.eventFabric.append({
      tick: input.tick, at, stage: 'action', source: input.action.source,
      parentIds: parents(planEvent.id, predictionEvent.id, observationEvent.id), external: input.action.external,
      confidence01: input.action.confidence01, payload: input.action.payload,
    });
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
    const anchorTick = input.anchors?.tick;
    const hasAnchorTick = typeof anchorTick === 'number' && Number.isSafeInteger(anchorTick) && anchorTick >= 0;
    const fallbackTick = Number.isSafeInteger(input.fallbackTick) && input.fallbackTick >= 0 ? input.fallbackTick : 0;
    // Late feedback closes the logical action tick; 'at' keeps the real arrival time.
    const tick = hasAnchorTick ? anchorTick : fallbackTick;
    const at = typeof input.at === 'number' && Number.isFinite(input.at) && input.at >= 0 ? input.at : Date.now();
    const parents = (...ids: Array<string | undefined>): string[] =>
      ids.filter((id): id is string => typeof id === 'string' && id.length > 0);

    const outcomeEvent = this.eventFabric.append({
      tick, at, stage: 'outcome', source: input.outcome.source,
      parentIds: parents(input.anchors?.action, input.anchors?.prediction), external: input.outcome.external,
      confidence01: input.outcome.confidence01, payload: input.outcome.payload,
    });
    const learningEvent = this.eventFabric.append({
      tick, at, stage: 'learning', source: input.learning.source,
      parentIds: parents(outcomeEvent.id), external: input.learning.external,
      confidence01: input.learning.confidence01, payload: input.learning.payload,
    });
    const selfUpdateEvent = this.eventFabric.append({
      tick, at, stage: 'self-update', source: input.selfUpdate.source,
      parentIds: parents(learningEvent.id), external: input.selfUpdate.external,
      confidence01: input.selfUpdate.confidence01, payload: input.selfUpdate.payload,
    });
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
    if (tick > prior.lastTick) {
      cycleResult = this.unifiedCycle.evaluate({
        tick,
        stageIds,
        parentIntegrity01: cycleLineage.complete ? cycleLineage.integrity01 : 0,
      });
    }
    return {
      tick, outcomeEvent, learningEvent, selfUpdateEvent, cycleLineage, cycleResult,
      completionRecorded: Boolean(cycleResult?.complete),
    };
  }
}
