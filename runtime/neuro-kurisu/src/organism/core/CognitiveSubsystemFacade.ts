import { CognitiveSubsystemRegistry } from './CognitiveSubsystemRegistry.ts';
import type { CognitiveSubsystemAccessors } from './CognitiveSubsystemPorts.ts';

export interface CognitiveFacadeContext extends CognitiveSubsystemAccessors {
  snapshot:()=>any;
  systemSnapshot:()=>any;
  p65Snapshot:()=>unknown;
  cognitiveBudgetSpend:(operation:import('../cognition/CognitiveBudgetManager.ts').CognitiveOperation,cost01?:number,informationGain01?:number,reason?:string)=>unknown;
  cognitiveBudgetCanSpend:(operation:import('../cognition/CognitiveBudgetManager.ts').CognitiveOperation,cost01?:number)=>boolean;
  multiProjectSchedule:()=>unknown;
  cognitiveKernelSnapshot:()=>any;
  autonomousProjectExecutorSnapshot:()=>import('../system/AutonomousProjectExecutor.ts').ProjectExecutionState;
}

/**
 * Stage-3 anti-monolith facade.
 * It consumes a semantic capability contract, never the concrete OrganismCore type.
 * This makes the same facade reusable by an Android host, test harness, or future extracted kernel.
 */
export class CognitiveSubsystemFacade {
  private readonly context:CognitiveFacadeContext;
  private readonly registry:CognitiveSubsystemRegistry;
  constructor(context:CognitiveFacadeContext) { this.context=context; this.registry=new CognitiveSubsystemRegistry(context); }
  subsystems(){ return this.registry.all(); }
  subsystemHealth(){ return this.registry.health(); }
  subsystemManifest(){ return this.registry.manifest(); }
  snapshot(){ const s=this.context.snapshot(); return { state:s.state, goals:s.goals, cognition:s.facets?.cognition, consciousness:s.facets?.consciousness, memory:s.facets?.memory, embodiment:s.facets?.embodiment }; }
  budget(){ return this.context.snapshot().facets?.cognition?.budget; }
  executiveSignals(){
    const s=this.context.snapshot();
    const identity01=Number(s.consciousness?.identityContinuity?.continuity ?? .5);
    const agency01=Number(s.consciousness?.metacognition?.agencyBinding01 ?? s.consciousness?.workspaceIgnition?.ignitionStrength ?? .5);
    const budget01=Number(s.cognition?.budget?.remaining01 ?? .5);
    const memoryCount=Number(s.memory?.memories?.length ?? s.memory?.eventLog?.length ?? 0);
    const memoryPressure01=Math.max(0,Math.min(1,memoryCount/256));
    const embodimentCapacity01=Number(s.embodiment?.body?.cognitiveCapacity01 ?? .75);
    return {identity01:Number.isFinite(identity01)?Math.max(0,Math.min(1,identity01)):.5,agency01:Number.isFinite(agency01)?Math.max(0,Math.min(1,agency01)):.5,budget01:Number.isFinite(budget01)?Math.max(0,Math.min(1,budget01)):.5,memoryPressure01,embodimentCapacity01:Number.isFinite(embodimentCapacity01)?Math.max(0,Math.min(1,embodimentCapacity01)):.75};
  }
  prediction(){ return this.context.systemSnapshot().predictionLedger; }
  epistemic(){ return this.context.p65Snapshot(); }
  evidenceTrust(){ return this.context.externalEvidenceSnapshot(); }
  evidenceFirewall(){ return this.context.evidenceFirewallSnapshot(); }
  projectResearchSession(){ return this.context.projectResearchSessionSnapshot(); }
  selfPrediction(){ return this.context.selfPredictionBenchmarkSnapshot(); }
  modelOlympics(){ return this.context.modelOlympicsSnapshot(); }
  predictionDebt(){ return this.context.predictionDebtSnapshot(); }
  quorum(){ return this.context.cognitiveQuorumSnapshot(); }
  shadow(){ return this.context.shadowOrganismSnapshot(); }
  identityCausality(){ return this.context.identityCausalitySnapshot(); }
  longHorizonPrediction(){ return this.context.longHorizonPredictionSnapshot(); }
  kernel(){ const k=this.context.cognitiveKernelSnapshot(); return { p61:k.p61, p64:k.p64 }; }
  autonomousProject(){ return this.context.autonomousProjectExecutorSnapshot(); }
  multiProjectSchedule(){ return this.context.multiProjectSchedule(); }
  projectBudget(){ const p=this.context.autonomousProjectExecutorSnapshot(); return { toolCalls:p.toolCalls, toolSuccesses:p.toolSuccesses, toolSuccessRate01:p.toolCalls ? p.toolSuccesses/p.toolCalls : 0, blockedCycles:p.blockedCycles }; }
  spend(operation: import('../cognition/CognitiveBudgetManager.ts').CognitiveOperation, cost01?:number, informationGain01=0, reason='facade'){ return this.context.cognitiveBudgetSpend(operation,cost01,informationGain01,reason); }
  canSpend(operation: import('../cognition/CognitiveBudgetManager.ts').CognitiveOperation,cost01?:number){ return this.context.cognitiveBudgetCanSpend(operation,cost01); }
}
