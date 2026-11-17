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
import { createHash } from 'node:crypto';
import { TheInventionLoop, type InventionProtocol, type InventionRecord, type InventionVerifierKeyResolver } from '../research/TheInventionLoop.ts';
import { IntrinsicExperimentGenerator, type IntrinsicExperiment } from '../cognition/IntrinsicExperimentGenerator.ts';
import { ScientificMethodEngine } from '../learning/ScientificMethodEngine.ts';
import { AutonomousScientificBrainSubstrate } from '../learning/AutonomousScientificBrainSubstrate.ts';
import type { OrganismGoal } from './types.ts';
import type { SignedOutcomeArtifact } from '../learning/VerifiedOutcomeArtifact.ts';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';

export type InventionEvaluationPlan = Omit<InventionProtocol, 'question' | 'hypothesis' | 'provenance'>;
export interface IntrinsicInventionInput extends InventionEvaluationPlan {
  uncertainty: number;
  predictionError: number;
  novelty: number;
  goals: OrganismGoal[];
  prediction?: string;
}
export interface DreamInventionInput extends InventionEvaluationPlan {
  association: Parameters<IntrinsicExperimentGenerator['fromDreamAssociation']>[0];
  goals: OrganismGoal[];
  prediction?: string;
}

/**
 * BIG PASS 49: physical ownership boundary for evidence, prediction and research.
 * All stateful engines here are coupled through evidence/prediction semantics rather than Core internals.
 */
const clampTextPrediction = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.normalize('NFKC').trim()
    ? value.normalize('NFKC').trim().slice(0, 240)
    : fallback.slice(0, 240);

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
  /** Stateful scientific proposal and prediction-learning owners. */
  readonly intrinsicExperimentGenerator = new IntrinsicExperimentGenerator();
  readonly scientificMethod = new ScientificMethodEngine();
  readonly scientificBrain = new AutonomousScientificBrainSubstrate();
  /** Evidence-gated idea-to-replication lifecycle; host-owned verifier keys are never persisted. */
  readonly inventionLoop: TheInventionLoop;

  constructor(resolveInventionVerifierKey: InventionVerifierKeyResolver = () => undefined) {
    this.inventionLoop = new TheInventionLoop(undefined, undefined, resolveInventionVerifierKey);
  }

  /**
   * Convert a generated hypothesis into a preregistered experiment and a
   * scientific-method project. No result is inferred from intrinsic drive.
   */
  proposeIntrinsicInvention(input: IntrinsicInventionInput): InventionRecord | null {
    const safe = snapshotPlainData(input) as IntrinsicInventionInput;
    if (!safe || typeof safe !== 'object' || !Array.isArray(safe.goals)) {
      throw new Error('invalid-intrinsic-invention-input');
    }
    const experiment = this.intrinsicExperimentGenerator.generate({
      uncertainty: safe.uncertainty,
      predictionError: safe.predictionError,
      novelty: safe.novelty,
      goals: safe.goals,
    });
    if (!experiment) return null;
    return this.registerGeneratedInvention(experiment, 'intrinsic', safe);
  }

  /** Convert a candidate dream association into a verification task, never a fact. */
  proposeDreamInvention(input: DreamInventionInput): InventionRecord | null {
    const safe = snapshotPlainData(input) as DreamInventionInput;
    if (!safe || typeof safe !== 'object' || !safe.association || !Array.isArray(safe.goals)) {
      throw new Error('invalid-dream-invention-input');
    }
    const experiment = this.intrinsicExperimentGenerator.fromDreamAssociation(
      safe.association,
      safe.goals,
    );
    if (!experiment) return null;
    return this.registerGeneratedInvention(experiment, 'dream-association', safe);
  }

  private registerGeneratedInvention(
    experiment: IntrinsicExperiment,
    source: 'intrinsic' | 'dream-association',
    evaluation: InventionEvaluationPlan & { prediction?: string },
  ): InventionRecord {
    if (experiment.epistemicStatus !== 'hypothesis' ||
        experiment.status !== 'candidate' || experiment.verificationRequired !== true) {
      throw new Error('generated-experiment-not-verification-gated');
    }
    const base = {
      question: experiment.question,
      hypothesis: experiment.hypothesis,
      successCriteria: evaluation.successCriteria,
      testFingerprint: evaluation.testFingerprint,
      baseline: evaluation.baseline,
      metricScale: evaluation.metricScale,
      minEffect: evaluation.minEffect,
      expectedEffect01: evaluation.expectedEffect01,
      minSuccessRate: evaluation.minSuccessRate,
      primarySeed: evaluation.primarySeed,
      replicationSeeds: evaluation.replicationSeeds,
      holdoutSeeds: evaluation.holdoutSeeds,
      lowerIsBetter: evaluation.lowerIsBetter,
      verifierPlan: evaluation.verifierPlan,
    };
    // Validate all caller-owned experiment/evaluation fields before creating a
    // ScientificMethod project so malformed inputs cannot leave orphan projects.
    this.inventionLoop.validateProtocol({
      ...base,
      provenance: {
        source,
        experimentId: experiment.id,
        scientificProjectId: 'preflight-scientific-project',
        linkedGoal: experiment.linkedGoal,
      },
    });
    const project = this.scientificMethod.create(
      experiment.question,
      experiment.hypothesis,
      clampTextPrediction(evaluation.prediction, experiment.action),
      [
        'intrinsic-experiment-generator',
        'source:' + source,
        'experiment:' + experiment.id,
        ...(experiment.linkedGoal ? ['goal:' + experiment.linkedGoal] : []),
        ...(experiment.dreamId ? ['dream:' + experiment.dreamId] : []),
        ...(experiment.sourceMemoryIds ?? []).map(id => 'memory:' + id),
      ],
    );
    const protocol = this.inventionLoop.validateProtocol({
      ...base,
      provenance: {
        source,
        experimentId: experiment.id,
        scientificProjectId: project.id,
        linkedGoal: experiment.linkedGoal,
      },
    });
    return this.inventionLoop.propose(protocol);
  }

  /** Admit an Ed25519-signed verifier measurement and propagate only verified cohorts. */
  recordInventionOutcome(id: string, artifact: SignedOutcomeArtifact): InventionRecord {
    const previous = this.inventionLoop.snapshot().records.find(record => record.id === id);
    const record = this.inventionLoop.recordOutcome(id, artifact);
    const replication = record.phaseSummaries?.replication;
    const priorReplicationCount = previous?.phaseSummaries?.replication?.sampleCount ?? 0;
    if (replication?.passed && priorReplicationCount < replication.requiredSamples) {
      this.scientificBrain.learn({
        predictedDelta01: record.protocol.expectedEffect01 ?? record.protocol.minEffect,
        observedDelta01: replication.meanEffect01,
        replicated: true,
        evidence01: replication.successRate01,
        at: record.updatedAt,
        holdout: false,
      });
      this.observeScientificProject(
        record,
        'replication',
        replication.successRate01,
        this.phaseEvidenceFingerprint(record, 'replication'),
        replication.passed ? undefined : 'replication-cohort-failed',
        'independent-replication-cohort-verified',
      );
    }
    const holdout = record.phaseSummaries?.holdout;
    const priorHoldoutCount = previous?.phaseSummaries?.holdout?.sampleCount ?? 0;
    if (holdout && holdout.sampleCount === holdout.requiredSamples &&
        priorHoldoutCount < holdout.requiredSamples) {
      // Holdout evidence calibrates the scientific predictor but never changes its weights.
      this.scientificBrain.learn({
        predictedDelta01: record.protocol.expectedEffect01 ?? record.protocol.minEffect,
        observedDelta01: holdout.meanEffect01,
        replicated: true,
        evidence01: holdout.successRate01,
        at: record.updatedAt,
        holdout: true,
      });
      this.observeScientificProject(
        record,
        'holdout',
        holdout.successRate01,
        this.phaseEvidenceFingerprint(record, 'holdout'),
        holdout.passed ? undefined : 'holdout-cohort-failed',
        holdout.passed ? 'invention-accepted-on-independent-holdout' : 'invention-rejected-on-independent-holdout',
      );
    } else if (record.stage === 'rejected' && previous?.stage !== 'rejected' &&
        !record.phaseSummaries?.holdout) {
      const last = record.outcomes[record.outcomes.length - 1];
      const evidence = last?.attestationFingerprint ?? record.critique?.attestationFingerprint;
      if (evidence) {
        this.observeScientificProject(
          record,
          last?.kind ?? 'critique',
          0,
          evidence,
          record.decisionReason ?? 'invention-rejected',
          'invention-rejected-by-verified-evidence',
        );
      }
    }
    return record;
  }

  recordInventionCritique(id: string, artifact: SignedOutcomeArtifact): InventionRecord {
    const previous = this.inventionLoop.snapshot().records.find(record => record.id === id);
    const record = this.inventionLoop.critique(id, artifact);
    if (record.stage === 'rejected' && previous?.stage !== 'rejected' &&
        record.critique?.attestationFingerprint) {
      this.observeScientificProject(
        record,
        'critique',
        0,
        record.critique.attestationFingerprint,
        'independent-critique-blockers',
        'invention-rejected-by-signed-independent-critique',
      );
    }
    return record;
  }

  private phaseEvidenceFingerprint(record: InventionRecord, phase: 'replication' | 'holdout'): string {
    const fingerprints = record.outcomes
      .filter(outcome => outcome.kind === phase)
      .map(outcome => outcome.attestationFingerprint)
      .sort();
    return createHash('sha256').update(fingerprints.join(':')).digest('hex');
  }

  private observeScientificProject(
    record: InventionRecord,
    phase: 'primary' | 'replication' | 'holdout' | 'critique',
    success: number,
    evidenceFingerprint: string,
    contradiction: string | undefined,
    conclusion: string,
  ): void {
    const projectId = record.protocol.provenance?.scientificProjectId;
    if (!projectId) return;
    this.scientificMethod.observe(projectId, {
      experiment: record.id,
      evidence: 'invention-' + phase + ':' + record.id + ':' + evidenceFingerprint,
      success,
      contradiction,
      conclusion,
      verified: true,
    });
  }

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
      scientificMethod: this.scientificMethod.snapshot(),
      scientificBrain: this.scientificBrain.snapshot(),
      inventionLoop: this.inventionLoop.snapshot(),
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
      inventionLoop:system?.inventionLoop,
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
    this.scientificMethod.restore((raw as any).scientificMethod);
    this.scientificBrain.restore((raw as any).scientificBrain);
    this.inventionLoop.restore((raw as any).inventionLoop);
  }
}
