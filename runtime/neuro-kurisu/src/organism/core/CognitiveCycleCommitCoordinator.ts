import {
  CognitiveEventFabric,
  type CognitiveEventFabricSnapshot,
  type OperationalCycleLineageCheck,
  type OperationalCycleStageIds,
} from '../system/CognitiveEventFabric.ts';
import {
  UnifiedCognitiveCycle,
  type UnifiedCognitiveCycleResult,
} from '../system/UnifiedCognitiveCycle.ts';

export type OperationalCognitiveCycleInput =
  Parameters<CognitiveEventFabric['recordOperationalCycle']>[0];

export interface OperationalCognitiveCycleCommit {
  stageIds:ReturnType<CognitiveEventFabric['recordOperationalCycle']>;
  cycleStageMap:OperationalCycleStageIds;
  fabricSnapshot:CognitiveEventFabricSnapshot;
  cycleLineage:OperationalCycleLineageCheck;
  cycleVerification:UnifiedCognitiveCycleResult;
}

/**
 * Commit the causal event record and monotonic cycle aggregate as one synchronous unit.
 * CEF rolls back its rows, while this coordinator also restores UnifiedCognitiveCycle
 * if lineage verification or aggregate evaluation fails after the event writes.
 */
export function commitOperationalCognitiveCycleAtomically(input:{
  eventFabric:CognitiveEventFabric;
  unifiedCycle:UnifiedCognitiveCycle;
  cycleInput:OperationalCognitiveCycleInput;
}):OperationalCognitiveCycleCommit {
  const priorCycle=input.unifiedCycle.snapshot();
  try {
    return input.eventFabric.withAtomicLedgerTransaction(()=>{
      const stageIds=input.eventFabric.recordOperationalCycle(input.cycleInput);
      const cycleStageMap:OperationalCycleStageIds={
        observation:stageIds.observation,
        prediction:stageIds.prediction,
        appraisal:stageIds.appraisal,
        attention:stageIds.attention,
        memory:stageIds.memory,
        goal:stageIds.goal,
        plan:stageIds.plan,
        action:stageIds.action,
        outcome:stageIds.outcome,
        learning:stageIds.learning,
        'self-update':stageIds.selfUpdate,
      };
      const observationId=stageIds.observation;
      const observation=typeof observationId==='string'?input.eventFabric.getById(observationId):null;
      if(!observation)throw new Error('operational-cognitive-cycle-observation-required');
      const cycleLineage=input.eventFabric.verifyOperationalCycle(cycleStageMap);
      const cycleVerification=input.unifiedCycle.evaluate({
        tick:observation.tick,
        stageIds:cycleStageMap,
        parentIntegrity01:cycleLineage.complete?cycleLineage.integrity01:0,
      });
      return {
        stageIds,cycleStageMap,
        fabricSnapshot:input.eventFabric.snapshot(),
        cycleLineage,cycleVerification,
      };
    });
  } catch(error) {
    input.unifiedCycle.restore(priorCycle);
    throw error;
  }
}
