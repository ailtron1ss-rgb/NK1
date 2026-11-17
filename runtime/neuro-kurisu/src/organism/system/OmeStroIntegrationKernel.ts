import {
  OMESTRO_CONCEPTS,
  getOmeStroImplementationSummary,
  validateOmeStroConceptRegistry,
} from './OmeStroConceptRegistry.ts';
import {
  ChronoTruthLedger,
  NegativeSpaceLedger,
  OpenLoopRadar,
  assessSubstrateMigration,
  prepareUndoFirstPlan,
  type ChronoTruthInput,
  type OpenLoopItem,
  type UndoFirstStep,
} from './OmeStroCognitiveGovernance.ts';
import {
  validateDevelopmentalGenome,
  type DevelopmentalGenome,
  type GenomeCandidate,
} from './OmeStroDevelopmentProtocol.ts';
import {
  AdaptiveSynapticMatrix,
  EphemeralPlasticitySession,
  type NeuralAdapterCandidate,
} from './OmeStroNeuralAdaptation.ts';
import { P25ScientificDevelopmentEngine } from '../learning/P25ScientificDevelopmentEngine.ts';
import { P28PlasticitySubstrate, type PlasticityObservation } from '../learning/P28PlasticitySubstrate.ts';
import { SubstratePortabilityEngine } from './SubstratePortabilityEngine.ts';
import { NeuralMorphogenesisEngine } from './NeuralMorphogenesisEngine.ts';
import {
  CognitiveImmuneSystem,
  type CognitiveHealthInput,
  type CognitiveImmuneState,
} from '../cognition/CognitiveImmuneSystem.ts';

export interface OmeStroKernelSnapshot {
  schemaVersion: 1;
  chronoTruth: ReturnType<ChronoTruthLedger['snapshot']>;
  negativeSpace: ReturnType<NegativeSpaceLedger['snapshot']>;
  openLoops: ReturnType<OpenLoopRadar['snapshot']>;
  adapters: ReturnType<AdaptiveSynapticMatrix['snapshot']>;
  scientificDevelopment: ReturnType<P25ScientificDevelopmentEngine['snapshot']>;
  plasticity: ReturnType<P28PlasticitySubstrate['snapshot']>;
  portability: ReturnType<SubstratePortabilityEngine['snapshot']>;
  morphogenesis: ReturnType<NeuralMorphogenesisEngine['snapshot']>;
  cognitiveImmune: CognitiveImmuneState;
}
export interface OmeStroMigrationInput {
  sourceFingerprint: string;
  targetFingerprint: string;
  stateSchemaCompatible: boolean;
  stateRoundTripPassed: boolean;
  benchmarkPairedSeeds: number;
  qualityDelta01: number;
  maximumAllowedRegression01: number;
  rollbackAvailable: boolean;
  calibrationEvidenceRef: string;
  sourceStability01: number;
  targetResource01: number;
  stateComplexity01: number;
}
export interface OmeStroMorphogenesisInput {
  base: DevelopmentalGenome;
  candidate: GenomeCandidate;
  independentEvaluationPassed: boolean;
  sandboxPassed: boolean;
  safetyPassed: boolean;
  at: number;
  demand01: number;
  predictionError01: number;
  energy01: number;
  plasticity01: number;
}

export class OmeStroIntegrationKernel {
  readonly chronoTruth = new ChronoTruthLedger();
  readonly negativeSpace = new NegativeSpaceLedger();
  readonly openLoops = new OpenLoopRadar();
  readonly adapters = new AdaptiveSynapticMatrix();
  readonly scientificDevelopment = new P25ScientificDevelopmentEngine();
  readonly plasticity = new P28PlasticitySubstrate();
  readonly portability = new SubstratePortabilityEngine();
  readonly morphogenesis = new NeuralMorphogenesisEngine();
  readonly cognitiveImmune = new CognitiveImmuneSystem();

  /** The registry is deliberately descriptive: tracked does not mean proven. */
  registry() {
    return {
      concepts: OMESTRO_CONCEPTS,
      summary: getOmeStroImplementationSummary(),
      validation: validateOmeStroConceptRegistry(),
    };
  }

  inspectInput(
    source: string,
    payload: unknown,
    kind: 'input' | 'claim' | 'tool' | 'memory' | 'world' = 'input',
    options: Parameters<CognitiveImmuneSystem['inspect']>[3] = {},
  ) {
    return this.cognitiveImmune.inspect(source, payload, kind, options);
  }

  assessCognitiveHealth(input: CognitiveHealthInput) {
    return this.cognitiveImmune.inspectHealth(input);
  }

  reviewCognitiveHealthSignal(
    id: string,
    verdict: 'confirmed' | 'false-positive' | 'recovered',
    reviewer: string,
    evidenceRef?: string,
  ) {
    return this.cognitiveImmune.reviewHealthSignal(id, verdict, reviewer, evidenceRef);
  }

  recordTruth(input: ChronoTruthInput) {
    return this.chronoTruth.append(input);
  }

  recordObservation(input: PlasticityObservation) {
    // P28 retains its own trust threshold and quarantine behavior.
    return this.plasticity.observe(input);
  }

  recordControlledExperiment(
    input: Parameters<P25ScientificDevelopmentEngine['recordControlledExperiment']>[0],
  ) {
    // Reuse the existing scientific engine rather than maintaining a parallel
    // experiment database with different metric/evidence semantics.
    return this.scientificDevelopment.recordControlledExperiment(input);
  }

  prepareActionPlan(input: {
    id: string;
    sourceBranch: string;
    snapshotRef?: string | null;
    steps: UndoFirstStep[];
    approveIrreversible?: boolean;
  }) {
    return prepareUndoFirstPlan(input);
  }

  trackCommitment(input: Omit<OpenLoopItem, 'status' | 'evidenceRefs'> & {
    status?: OpenLoopItem['status'];
    evidenceRefs?: string[];
  }) {
    return this.openLoops.upsert(input);
  }

  registerAdapter(candidate: NeuralAdapterCandidate, now = Date.now()) {
    return this.adapters.register(candidate, now);
  }

  createEphemeralSession(input: {
    sessionId: string; now: number; ttlMs: number; dimension: number; maxNorm01: number;
  }): EphemeralPlasticitySession {
    return new EphemeralPlasticitySession(input);
  }

  validateArchitectureCandidate(base: DevelopmentalGenome, candidate: GenomeCandidate) {
    return validateDevelopmentalGenome(base, candidate);
  }

  /**
   * This is a candidate-only simulation. It cannot change the active source
   * tree. Independent evaluation, sandbox evidence and safety approval are
   * mandatory before the internal morphogenesis substrate is updated.
   */
  simulateMorphogenesis(input: OmeStroMorphogenesisInput): {
    eligible: boolean;
    mode: 'blocked' | 'candidate-shadow-only';
    blockers: string[];
    state: ReturnType<NeuralMorphogenesisEngine['adapt']> | null;
  } {
    const genome = validateDevelopmentalGenome(input.base, input.candidate);
    const blockers = [...genome.blockers];
    if (input.independentEvaluationPassed !== true) blockers.push('independent-evaluation-required');
    if (input.sandboxPassed !== true) blockers.push('sandbox-verification-required');
    if (input.safetyPassed !== true) blockers.push('safety-approval-required');
    if (!Number.isSafeInteger(input.at) || input.at < 0) blockers.push('valid-simulation-time-required');
    if (blockers.length) {
      return { eligible: false, mode: 'blocked', blockers: [...new Set(blockers)], state: null };
    }
    const state = this.morphogenesis.adapt({
      at: input.at,
      demand01: input.demand01,
      predictionError01: input.predictionError01,
      energy01: input.energy01,
      plasticity01: input.plasticity01,
    });
    return { eligible: true, mode: 'candidate-shadow-only', blockers: [], state };
  }

  assessModelMigration(input: OmeStroMigrationInput) {
    const gate = assessSubstrateMigration(input);
    const portability = this.portability.assess({
      sourceStability01: input.sourceStability01,
      targetResource01: input.targetResource01,
      stateComplexity01: input.stateComplexity01,
      target: input.targetFingerprint,
    });
    return { ...gate, portability };
  }

  snapshot(): OmeStroKernelSnapshot {
    return {
      schemaVersion: 1,
      chronoTruth: this.chronoTruth.snapshot(),
      negativeSpace: this.negativeSpace.snapshot(),
      openLoops: this.openLoops.snapshot(),
      adapters: this.adapters.snapshot(),
      scientificDevelopment: this.scientificDevelopment.snapshot(),
      plasticity: this.plasticity.snapshot(),
      portability: this.portability.snapshot(),
      morphogenesis: this.morphogenesis.snapshot(),
      cognitiveImmune: this.cognitiveImmune.snapshot(),
    };
  }

  restore(raw?: Partial<OmeStroKernelSnapshot> | null): void {
    this.chronoTruth.restore(raw?.chronoTruth);
    this.negativeSpace.restore(raw?.negativeSpace);
    this.openLoops.restore(raw?.openLoops);
    this.adapters.restore(raw?.adapters);
    this.scientificDevelopment.restore(raw?.scientificDevelopment);
    this.plasticity.restore(raw?.plasticity);
    this.portability.restore(raw?.portability);
    this.morphogenesis.restore(raw?.morphogenesis);
    this.cognitiveImmune.restore(raw?.cognitiveImmune);
  }
}
