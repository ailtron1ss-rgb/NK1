import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { PredictionLedger } from '../system/PredictionLedger.ts';
import { ExternalEvidenceTrustEngine } from '../system/ExternalEvidenceTrust.ts';
import { ExternalProjectResearchTool } from '../system/ExternalProjectResearchTool.ts';
import { EvidenceFirewallEngine } from '../system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../system/ProjectResearchSession.ts';
import { createConfiguredResearchNliBackend } from '../system/ResearchSemanticEntailment.ts';
import { SkillAcquisitionBenchmark } from '../system/SkillAcquisitionBenchmark.ts';
import { SelfPredictionBenchmark } from '../system/SelfPredictionBenchmark.ts';
import { ModelOlympics } from '../system/ModelOlympics.ts';
import { PredictionDebtEngine } from '../system/PredictionDebt.ts';
import { ShadowOrganismEngine } from '../system/ShadowOrganism.ts';
import { IdentityCausalityGraphEngine } from '../system/IdentityCausalityGraph.ts';
import { LongHorizonPredictionBenchmark } from '../system/LongHorizonPredictionBenchmark.ts';
import { P38AutonomousCausalResearchEngine } from '../learning/P38AutonomousCausalResearch.ts';
import { P53DevelopmentalSelfModificationLab } from '../developmental/P53DevelopmentalSelfModificationLab.ts';
import { ExternalObserverFabric } from '../system/ExternalObserverFabric.ts';
import { P77RealityExperimentOS, defaultP77 } from '../system/P77RealityExperimentOS.ts';
import { P82RealityProgressController, defaultP82 } from '../system/P82RealityProgressController.ts';

/**
 * BIG PASS 49: physical ownership boundary for evidence, prediction and research.
 * All stateful engines here are coupled through evidence/prediction semantics rather than Core internals.
 */
export class EvidenceResearchSubsystemRuntime {
  readonly systemName='research' as const;
  readonly dependencies=['world', 'memory', 'governance'] as const;
  readonly systemCapabilities=['state', 'research', 'prediction', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly predictionLedger = new PredictionLedger(256);
  readonly externalEvidenceTrust = new ExternalEvidenceTrustEngine();
  readonly externalProjectResearchTool = new ExternalProjectResearchTool();
  readonly evidenceFirewall = new EvidenceFirewallEngine();
  readonly projectResearchSession = new ProjectResearchSession(this.evidenceFirewall);
  /** Explicitly opt-in NLI backend; absent configuration keeps the runtime offline and conservative. */
  readonly researchNliBackend = createConfiguredResearchNliBackend();
  readonly skillAcquisitionBenchmark = new SkillAcquisitionBenchmark();
  readonly selfPredictionBenchmark = new SelfPredictionBenchmark();
  readonly modelOlympics = new ModelOlympics();
  readonly predictionDebt = new PredictionDebtEngine();
  readonly shadowOrganism = new ShadowOrganismEngine();
  readonly identityCausality = new IdentityCausalityGraphEngine();
  readonly longHorizonPrediction = new LongHorizonPredictionBenchmark();
  readonly p38Research = new P38AutonomousCausalResearchEngine();
  readonly p53DevelopmentalSelfModification = new P53DevelopmentalSelfModificationLab();
  readonly externalObserver = new ExternalObserverFabric();

  snapshot() {
    return {
      predictionLedger: this.predictionLedger.snapshot(),
      externalEvidenceTrust: this.externalEvidenceTrust.snapshot(),
      externalProjectResearchTool: this.externalProjectResearchTool.snapshot(),
      evidenceFirewall: this.evidenceFirewall.snapshot(),
      projectResearchSession: this.projectResearchSession.snapshot(),
      researchNli: { enabled: Boolean(this.researchNliBackend), modelId: this.researchNliBackend?.modelId ?? null },
      skillAcquisitionBenchmark: this.skillAcquisitionBenchmark.snapshot(),
      selfPredictionBenchmark: this.selfPredictionBenchmark.snapshot(),
      modelOlympics: this.modelOlympics.snapshot(),
      predictionDebt: this.predictionDebt.snapshot(),
      shadowOrganism: this.shadowOrganism.snapshot(),
      identityCausality: this.identityCausality.snapshot(),
      longHorizonPrediction: this.longHorizonPrediction.snapshot(),
      p38Research: this.p38Research.snapshot(),
      p53DevelopmentalSelfModification: this.p53DevelopmentalSelfModification.snapshot(),
      externalObserver: this.externalObserver.snapshot(),
    };
  }


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p77RealityExperimentOS = new P77RealityExperimentOS();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly p82RealityProgress = new P82RealityProgressController();
  restoreFromPersisted(system: any, learning: any = {}, advanced: any = {}) {
    this.restore({
      predictionLedger:system?.predictionLedger, externalEvidenceTrust:system?.externalEvidenceTrust,
      evidenceFirewall:system?.evidenceFirewall, projectResearchSession:system?.projectResearchSession,
      skillAcquisitionBenchmark:system?.skillAcquisitionBenchmark, selfPredictionBenchmark:system?.selfPredictionBenchmark,
      modelOlympics:system?.modelOlympics, predictionDebt:system?.predictionDebt, shadowOrganism:system?.shadowOrganism,
      identityCausality:system?.identityCausality, longHorizonPrediction:system?.longHorizonPrediction,
      p38Research:learning?.p38, p53DevelopmentalSelfModification:advanced?.p53DevelopmentalSelfModification, externalObserver:system?.externalObserver,
    });
  }

  restore(raw: Partial<ReturnType<EvidenceResearchSubsystemRuntime['snapshot']>> | null | undefined) {
    if (!raw) return;
    this.predictionLedger.restore(raw.predictionLedger);
    this.externalEvidenceTrust.restore(raw.externalEvidenceTrust);
    this.evidenceFirewall.restore(raw.evidenceFirewall);
    this.projectResearchSession.restore(raw.projectResearchSession);
    this.skillAcquisitionBenchmark.restore(raw.skillAcquisitionBenchmark);
    this.selfPredictionBenchmark.restore(raw.selfPredictionBenchmark);
    this.modelOlympics.restore(raw.modelOlympics);
    this.predictionDebt.restore(raw.predictionDebt);
    this.shadowOrganism.restore(raw.shadowOrganism);
    this.identityCausality.restore(raw.identityCausality);
    this.longHorizonPrediction.restore(raw.longHorizonPrediction);
    this.p38Research.restore((raw as any).p38Research);
    this.p53DevelopmentalSelfModification.restore((raw as any).p53DevelopmentalSelfModification);
    this.externalObserver.restore((raw as any).externalObserver);
  }
}
