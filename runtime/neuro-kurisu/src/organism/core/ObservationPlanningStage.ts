import type { OrganismObservation, OrganismState } from './types.ts';
import { normalizeWorldContext } from './WorldContextNormalizer.ts';
import { buildCognitiveFrame, type CognitiveFrame } from './CognitiveFrame.ts';
import type { CognitiveExecutionPlan } from './CognitiveExecutionPlanner.ts';
import type { CognitivePressureFieldState } from '../cognition/CognitivePressureField.ts';
import type { CognitiveSpineDecision } from '../system/CognitiveSpineScheduler.ts';
import type { CognitiveResourceAllocation } from '../system/CognitiveResourceEconomy.ts';
import type { OrganismSystemContract } from './OrganismSystemContract.ts';
import type { PredictionDebtState } from '../system/PredictionDebt.ts';
import type { OrganismResourceAllocator } from '../system/OrganismResourceAllocator.ts';
import type { CognitiveResourceEconomy } from '../system/CognitiveResourceEconomy.ts';
import type { CognitivePressureField } from '../cognition/CognitivePressureField.ts';
import type { CognitiveSpineScheduler } from '../system/CognitiveSpineScheduler.ts';
import type { CognitiveExecutionPlanner } from './CognitiveExecutionPlanner.ts';

interface GroundedWorldSummary { uncertainty01?:number; conflict01?:number; confidence01?:number; }
interface ExternalObserverSummary { unresolvedCount?:number; observations?:number; assessments?:number; contradictedCount?:number; verificationRate01?:number; }
interface ShadowSummary { ensembleDisagreement01?:number; escalations?:number; recent?:Array<{escalation?:boolean}>; }

export interface ObservationPlanningHost {
  resourceAllocator:OrganismResourceAllocator;
  cognitiveResourceEconomy:CognitiveResourceEconomy;
  cognitivePressureField:CognitivePressureField;
  cognitiveSpineScheduler:CognitiveSpineScheduler;
  cognitiveExecutionPlanner:CognitiveExecutionPlanner;
  contracts:ReadonlyArray<Pick<OrganismSystemContract,'name'|'estimatedCost01'|'cadenceCycles'|'phase'|'executionRank'>>;
  snapshotPredictionDebt:()=>PredictionDebtState;
  snapshotGroundedWorld:()=>GroundedWorldSummary;
  snapshotExternalObserver:()=>ExternalObserverSummary;
  snapshotShadow:()=>ShadowSummary;
  snapshotCognitiveField:()=>Parameters<CognitivePressureField['compile']>[0]['field'];
  getBudget:()=>{mode:string;remaining01:number};
  writeCognitiveResourceEconomy:(value:ReturnType<CognitiveResourceEconomy['snapshot']>)=>void;
  writeExecutionPlan:(value:CognitiveExecutionPlan)=>void;
}

export interface ObservationPlanningResult {
  normalizedObservation:OrganismObservation;
  cognitiveFrame:CognitiveFrame;
  cognitiveResourceAllocation:CognitiveResourceAllocation;
  cognitivePressure:CognitivePressureFieldState;
  cognitiveSpinePlan:CognitiveSpineDecision;
  cognitiveExecutionPlan:CognitiveExecutionPlan;
  perceptionRefresh:boolean;
}

export function compileObservationPlan(input:{state:OrganismState;observation:OrganismObservation;host:ObservationPlanningHost}):ObservationPlanningResult {
  const {state,observation,host}=input;
  // All scheduler decisions in this stage must share one immutable view of the remaining budget.
  const budgetSnapshot=host.getBudget();
  const normalizedObservation:OrganismObservation = observation.worldContext
    ? { ...observation, worldContext: normalizeWorldContext(observation.worldContext,{tick:state.tick+1,at:state.at}) }
    : observation;
  const cognitiveFrame=buildCognitiveFrame(state,normalizedObservation);
  const n=state.needs;
  const predictionDebtForPressure=host.snapshotPredictionDebt();
  const groundedSummaryForPressure=host.snapshotGroundedWorld();
  const externalObserverForPressure=host.snapshotExternalObserver();
  const ramPressure01=Math.max(0,Math.min(1,(1-(observation.embodiment?.cognitiveCapacity01??(1-n.cognitiveLoad)))*.65+n.cognitiveLoad*.35));
  const resourceAllocation=host.resourceAllocator.decide({
    battery01:observation.embodiment?.battery01??n.energy,
    thermal01:observation.embodiment?.thermalStrain01??.2,
    ramPressure01,
    uncertainty01:n.uncertainty,
    predictionError01:state.predictionError,
    goalPressure01:n.goalPressure,
    novelty01:n.novelty,
    socialNeed01:n.socialNeed,
    grounding01:Math.max(0,Math.min(1,1-(groundedSummaryForPressure.uncertainty01??.5))),
    learningOpportunity01:Math.max(0,Math.min(1,n.novelty*.45+state.predictionError*.55)),
    languageDemand01:observation.text?1:0,
    externalInput:Boolean(observation.text),
  },{clone:false});
  const cognitiveResourceAllocation=host.cognitiveResourceEconomy.allocate({
    tick:state.tick,
    at:state.at,
    energy01:observation.embodiment?.battery01??n.energy,
    cognitiveLoad01:n.cognitiveLoad,
    uncertainty01:n.uncertainty,
    novelty01:n.novelty,
    predictionDebt01:Number(predictionDebtForPressure.meanPriority01??0),
    thermalStrain01:observation.embodiment?.thermalStrain01??.2,
    ramPressure01,
    awake:observation.embodiment?.awake!==false,
  });
  host.writeCognitiveResourceEconomy(host.cognitiveResourceEconomy.planningSnapshot());
  const shadow=host.snapshotShadow();
  const cognitivePressure=host.cognitivePressureField.compile({
    field:host.snapshotCognitiveField(),
    predictionDebt:predictionDebtForPressure,
    grounding:groundedSummaryForPressure,
    externalObservation:externalObserverForPressure,
    goalPressure01:n.goalPressure,
    novelty01:n.novelty,
    predictionError01:state.predictionError,
    energy01:n.energy,
    thermal01:observation.embodiment?.thermalStrain01??.2,
    ramPressure01,
    shadow:{disagreement01:shadow.ensembleDisagreement01,escalation:Boolean((shadow.escalations??0)>0&&shadow.recent?.[0]?.escalation)},
  });
  const cognitiveSpinePlan=host.cognitiveSpineScheduler.decide({
    tick:cognitiveFrame.tick,
    surprise01:cognitiveFrame.surprise01,
    predictionError01:cognitiveFrame.predictionError01,
    novelty01:cognitiveFrame.novelty01,
    goalPressure01:cognitiveFrame.goalPressure01,
    budgetMode:budgetSnapshot.mode,
    remainingBudget01:budgetSnapshot.remaining01,
    externalInput:cognitiveFrame.externalInput,
    awake:observation.embodiment?.awake??true,
  });
  const cognitiveExecutionPlan=host.cognitiveExecutionPlanner.compile(
    cognitiveFrame,
    cognitiveSpinePlan,
    Math.min(budgetSnapshot.remaining01,cognitiveResourceAllocation.totalBudget01),
    cognitivePressure,
    host.contracts,
  );
  host.writeExecutionPlan(cognitiveExecutionPlan);
  return {
    normalizedObservation,
    cognitiveFrame,
    cognitiveResourceAllocation,
    cognitivePressure,
    cognitiveSpinePlan,
    cognitiveExecutionPlan,
    perceptionRefresh:cognitiveExecutionPlan.run.perception,
  };
}
