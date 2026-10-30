export interface SelfSubsystemPort {
  snapshot:()=>unknown;
  identityCausality:()=>unknown;
  selfPrediction:()=>unknown;
  shadow:()=>unknown;
  consistency:()=>unknown;
}
export interface WorldSubsystemPort {
  snapshot:()=>unknown;
  perception:()=>unknown;
  longHorizon:()=>unknown;
  reality:()=>unknown;
  modelOlympics:()=>unknown;
}
export interface MemorySubsystemPort {
  snapshot:()=>unknown;
  userModel:()=>unknown;
  epistemic:()=>unknown;
  prediction:()=>unknown;
  predictionDebt:()=>unknown;
  evidenceTrust:()=>unknown;
  evidenceFirewall:()=>unknown;
  skillAcquisition:()=>unknown;
}
export interface AgencySubsystemPort {
  snapshot:()=>unknown;
  autonomousProject:()=>unknown;
  cognitiveBudget:()=>unknown;
  quorum:()=>unknown;
  multiProjectSchedule:()=>unknown;
}
export interface EmbodimentSubsystemPort {
  snapshot:()=>unknown;
  multimodal:()=>unknown;
  perceptionRouting:()=>unknown;
}
export interface ResearchSubsystemPort {
  snapshot:()=>unknown;
  causal:()=>unknown;
  developmental:()=>unknown;
  externalResearch:()=>unknown;
  researchSession:()=>unknown;
}
export interface GovernanceSubsystemPort {
  snapshot:()=>unknown;
  capabilities:()=>unknown;
  identityGuardian:()=>unknown;
  resilience:()=>unknown;
}

/** Stable semantic contracts used by integrations outside OrganismCore. */
export type CognitiveSubsystemName = keyof CognitiveSubsystemPorts;

export interface CognitiveSubsystemPorts {
  self:SelfSubsystemPort;
  world:WorldSubsystemPort;
  memory:MemorySubsystemPort;
  agency:AgencySubsystemPort;
  embodiment:EmbodimentSubsystemPort;
  research:ResearchSubsystemPort;
  governance:GovernanceSubsystemPort;
}

/**
 * Dependency-inverted accessor contract. OrganismCore is one implementation,
 * but tests/Android hosts/research harnesses can provide another adapter.
 */
export interface CognitiveSubsystemAccessors {
  consciousnessSnapshot:()=>unknown;
  identityCausalitySnapshot:()=>unknown;
  selfPredictionBenchmarkSnapshot:()=>unknown;
  shadowOrganismSnapshot:()=>unknown;
  p71Snapshot:()=>unknown;
  developmentalCognitionSnapshot:()=>unknown;
  perceptionSnapshot:()=>unknown;
  longHorizonPredictionSnapshot:()=>unknown;
  p57Snapshot:()=>unknown;
  modelOlympicsSnapshot:()=>unknown;
  memorySnapshot:()=>unknown;
  p65Snapshot:()=>unknown;
  predictionLedgerSnapshot:()=>unknown;
  predictionDebtSnapshot:()=>unknown;
  externalEvidenceSnapshot:()=>unknown;
  evidenceFirewallSnapshot:()=>unknown;
  skillAcquisitionBenchmarkSnapshot:()=>unknown;
  evolutionSnapshot:()=>unknown;
  autonomousProjectExecutorSnapshot:()=>unknown;
  cognitiveBudgetSnapshot:()=>unknown;
  cognitiveQuorumSnapshot:()=>unknown;
  multiProjectSchedule:()=>unknown;
  embodimentSnapshot:()=>unknown;
  multimodalSnapshot:()=>unknown;
  perceptionRoutingSnapshot:()=>unknown;
  advancedDevelopmentSnapshot:()=>unknown;
  p32Snapshot:()=>unknown;
  p53Snapshot:()=>unknown;
  externalProjectResearchConfig:()=>unknown;
  projectResearchSessionSnapshot:()=>unknown;
  systemSnapshot:()=>unknown;
  capabilitiesSnapshot:()=>unknown;
  p60Snapshot:()=>unknown;
  advancedResilienceSnapshot:()=>unknown;
}

export function createCognitiveSubsystemPorts(core:CognitiveSubsystemAccessors): CognitiveSubsystemPorts {
  return {
    self:{
      snapshot:()=>core.consciousnessSnapshot(),
      identityCausality:()=>core.identityCausalitySnapshot(),
      selfPrediction:()=>core.selfPredictionBenchmarkSnapshot(),
      shadow:()=>core.shadowOrganismSnapshot(),
      consistency:()=>core.p71Snapshot(),
    },
    world:{
      snapshot:()=>core.developmentalCognitionSnapshot(),
      perception:()=>core.perceptionSnapshot(),
      longHorizon:()=>core.longHorizonPredictionSnapshot(),
      reality:()=>core.p57Snapshot(),
      modelOlympics:()=>core.modelOlympicsSnapshot(),
    },
    memory:{
      snapshot:()=>core.memorySnapshot(),
      epistemic:()=>core.p65Snapshot(),
      prediction:()=>core.predictionLedgerSnapshot(),
      predictionDebt:()=>core.predictionDebtSnapshot(),
      evidenceTrust:()=>core.externalEvidenceSnapshot(),
      evidenceFirewall:()=>core.evidenceFirewallSnapshot(),
      skillAcquisition:()=>core.skillAcquisitionBenchmarkSnapshot(),
    },
    agency:{
      snapshot:()=>core.evolutionSnapshot(),
      autonomousProject:()=>core.autonomousProjectExecutorSnapshot(),
      cognitiveBudget:()=>core.cognitiveBudgetSnapshot(),
      quorum:()=>core.cognitiveQuorumSnapshot(),
      multiProjectSchedule:()=>core.multiProjectSchedule(),
    },
    embodiment:{
      snapshot:()=>core.embodimentSnapshot(),
      multimodal:()=>core.multimodalSnapshot(),
      perceptionRouting:()=>core.perceptionRoutingSnapshot(),
    },
    research:{
      snapshot:()=>core.advancedDevelopmentSnapshot(),
      causal:()=>core.p32Snapshot(),
      developmental:()=>core.p53Snapshot(),
      externalResearch:()=>core.externalProjectResearchConfig(),
      researchSession:()=>core.projectResearchSessionSnapshot(),
    },
    governance:{
      snapshot:()=>core.systemSnapshot(),
      capabilities:()=>core.capabilitiesSnapshot(),
      identityGuardian:()=>core.p60Snapshot(),
      resilience:()=>core.advancedResilienceSnapshot(),
    },
  };
}
