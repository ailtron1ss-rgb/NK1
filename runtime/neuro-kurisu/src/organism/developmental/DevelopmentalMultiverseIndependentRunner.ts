import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import {
  createIndependentSkillCandidateEvaluator,
  recordIndependentEvaluationOutcomes,
  type IndependentCandidateEvaluationScope,
  type IndependentCandidateTask,
} from '../learning/IndependentSkillCandidateEvaluator.ts';
import {
  createHostOwnedIndependentEvaluationServices,
  isHostOwnedIndependentEvaluationServices,
  type HostOwnedIndependentEvaluationCommands,
  type HostOwnedIndependentEvaluationServices,
} from '../learning/HostOwnedIndependentEvaluationServices.ts';
import {
  createLearningExperimentPlan,
  validateResearchGradeLearningExperimentPlan,
} from '../learning/LearningExperimentPlan.ts';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from '../learning/VerifiedOutcomeLedger.ts';
import type { P55State } from './P55DevelopmentalForkUniverse.ts';
import type { SkillLearnBenchTrialReport } from '../learning/SkillLearnBenchAdapter.ts';
import {
  createDevelopmentalMultiverseSessionFromP55,
  DevelopmentalMultiverse,
  type DevelopmentalMultiverseFinalResult,
  type DevelopmentalMultiverseObservationInput,
  type DevelopmentalMultiversePhase,
  type DevelopmentalScenarioSeed,
  type DevelopmentalMultiverseSelection,
  type DevelopmentalMultiverseSessionInput,
  type DevelopmentalMultiverseSnapshot,
} from './DevelopmentalMultiverse.ts';

const MAX_CHECKPOINT_BYTES = 8 * 1024 * 1024;
const MAX_SCENARIO_INPUT_BYTES = 64 * 1024;
const FORBIDDEN_SCENARIO_KEYS = /(?:memory|identity|conversation|secret|credential|token|password|private.?key)/i;

function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (value === undefined) throw new Error('developmental-multiverse-runner-undefined-value');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('developmental-multiverse-runner-non-finite-number');
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('developmental-multiverse-runner-value-not-json');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('developmental-multiverse-runner-circular-value');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('developmental-multiverse-runner-non-plain-object');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return '[' + value.map(item => canonical(item, ancestors)).join(',') + ']';
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(record[key], ancestors),
    ).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const digest = (value: unknown): string => sha256(canonical(value));
const isDigest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function inspectScenarioData(value: unknown, depth = 0): void {
  if (depth > 24) throw new Error('developmental-multiverse-scenario-depth-limit');
  if (Array.isArray(value)) {
    if (value.length > 4096) throw new Error('developmental-multiverse-scenario-array-limit');
    for (const item of value) inspectScenarioData(item, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('developmental-multiverse-scenario-non-plain-object');
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 4096) throw new Error('developmental-multiverse-scenario-key-limit');
    for (const [key, item] of entries) {
      if (FORBIDDEN_SCENARIO_KEYS.test(key.replace(/[^A-Za-z]/g, ''))) {
        throw new Error('developmental-multiverse-scenario-private-state-key');
      }
      inspectScenarioData(item, depth + 1);
    }
  }
}

export interface DevelopmentalMultiverseScenarioTask {
  /** Immutable task input. A stable, non-empty prompt is required for manifest binding. */
  input: Record<string, unknown> & { prompt: string };
  requiredCapabilityIds: string[];
  expectedStepIds: string[];
  taskFamily?: string;
}
export type DevelopmentalMultiverseScenarioTaskFactory =
  (scenario: Readonly<DevelopmentalScenarioSeed>) => DevelopmentalMultiverseScenarioTask;

export interface DevelopmentalMultiverseCheckpointStore {
  save(snapshot: DevelopmentalMultiverseSnapshot): Promise<void>;
  load(): Promise<DevelopmentalMultiverseSnapshot | null>;
}

/**
 * Atomic single-writer checkpoint adapter. SHA-256 detects truncation or accidental
 * corruption; it is not a signature, anti-rollback control, encryption or a
 * cross-process lock. Keep this store host-owned and grant one runner write access.
 */
export class AtomicFileDevelopmentalMultiverseCheckpointStore implements DevelopmentalMultiverseCheckpointStore {
  private readonly filePath: string;
  private readonly maxBytes: number;

  constructor(filePath: string, maxBytes = MAX_CHECKPOINT_BYTES) {
    if (!nonEmpty(filePath) || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > MAX_CHECKPOINT_BYTES) {
      throw new Error('developmental-multiverse-checkpoint-store-config-invalid');
    }
    this.filePath = path.resolve(filePath);
    this.maxBytes = maxBytes;
  }

  async save(snapshot: DevelopmentalMultiverseSnapshot): Promise<void> {
    const verifier = new DevelopmentalMultiverse();
    verifier.restore(snapshot);
    const payload = canonical(snapshot);
    const envelope = JSON.stringify({
      schemaVersion: 1,
      snapshotFingerprint: sha256(payload),
      snapshot,
    }) + '\n';
    if (new TextEncoder().encode(envelope).byteLength > this.maxBytes) {
      throw new Error('developmental-multiverse-checkpoint-size-limit');
    }
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, '.' + path.basename(this.filePath) + '.' + randomUUID() + '.tmp');
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(envelope, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, this.filePath);
      try {
        const dirHandle = await open(directory, 'r');
        try { await dirHandle.sync(); } finally { await dirHandle.close(); }
      } catch {
        // Some platforms/filesystems do not support directory fsync.
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async load(): Promise<DevelopmentalMultiverseSnapshot | null> {
    let raw: string;
    try {
      const metadata = await stat(this.filePath);
      if (!metadata.isFile() || metadata.size > this.maxBytes) {
        throw new Error('developmental-multiverse-checkpoint-file-invalid');
      }
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    if (new TextEncoder().encode(raw).byteLength > this.maxBytes) {
      throw new Error('developmental-multiverse-checkpoint-size-limit');
    }
    let envelope: unknown;
    try { envelope = JSON.parse(raw); }
    catch { throw new Error('developmental-multiverse-checkpoint-json-corrupt'); }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      throw new Error('developmental-multiverse-checkpoint-envelope-invalid');
    }
    const record = envelope as Record<string, unknown>;
    if (record.schemaVersion !== 1 || !record.snapshot || !isDigest(record.snapshotFingerprint) ||
        sha256(canonical(record.snapshot)) !== record.snapshotFingerprint) {
      throw new Error('developmental-multiverse-checkpoint-fingerprint-mismatch');
    }
    const verifier = new DevelopmentalMultiverse();
    verifier.restore(record.snapshot);
    return structuredClone(record.snapshot) as DevelopmentalMultiverseSnapshot;
  }
}

export type DevelopmentalMultiverseHostCommandRunnerOptions =
  Omit<DevelopmentalMultiverseIndependentRunnerOptions, 'services'> & {
    commands: HostOwnedIndependentEvaluationCommands;
  };

export interface DevelopmentalMultiverseIndependentRunnerOptions {
  services: HostOwnedIndependentEvaluationServices;
  checkpointStore: DevelopmentalMultiverseCheckpointStore;
  buildScenarioTask: DevelopmentalMultiverseScenarioTaskFactory;
  environmentFingerprint: string;
  verifierId: string;
  /** Budget used to normalize measured end-to-end host execution time per scenario. */
  costBudgetMsPerScenario?: number;
  serviceTimeoutMs?: number;
}

interface ScenarioCorpusRow {
  phase: DevelopmentalMultiversePhase;
  scenario: DevelopmentalMultiverseScenarioSeed;
  task: IndependentCandidateTask;
}
interface ScenarioCorpus {
  manifest: TaskManifestEntry[];
  ledger: VerifiedOutcomeLedger;
  validationPlan: ReturnType<typeof createLearningExperimentPlan>;
  holdoutPlan: ReturnType<typeof createLearningExperimentPlan>;
  byKey: Map<string, ScenarioCorpusRow>;
}
interface EvaluatorEnvelope {
  payloadFingerprint: string;
  evaluationFingerprint: string;
  evaluation: {
    validation: SkillLearnBenchTrialReport[];
    holdout: SkillLearnBenchTrialReport[];
    provenance: {
      payloadFingerprint: string;
      environmentFingerprint: string;
      planFingerprint: string;
      experimentAuthority: {
        manifestFingerprint: string;
        validationPlanFingerprint: string;
        holdoutPlanFingerprint: string;
        method: string;
        attempt: number;
        evaluationScope?: IndependentCandidateEvaluationScope;
      } | null;
      runBindings: Array<{
        taskId: string;
        trialId: string;
        runId: string | null;
        plannedRunId: string | null;
        seed: number;
        split: string;
        executable: boolean;
        bindingVerified: boolean;
        verifierPassed: boolean;
        safetyViolationCount: number;
      }>;
    };
  };
}

/**
 * Production bridge: every profile arm is evaluated by P23's independent evaluator
 * using the host-owned executor, independently controlled verifier and separate
 * safety scanner. Validation and holdout are separate executions; non-finalists
 * are never given holdout tasks. This runner creates review evidence only.
 */
export class DevelopmentalMultiverseIndependentRunner {
  private busy = false;

  private constructor(
    private readonly universe: DevelopmentalMultiverse,
    private readonly options: DevelopmentalMultiverseIndependentRunnerOptions,
  ) {
    this.validateOptions();
  }

  static async create(
    input: DevelopmentalMultiverseSessionInput,
    options: DevelopmentalMultiverseIndependentRunnerOptions,
  ): Promise<DevelopmentalMultiverseIndependentRunner> {
    if (options.environmentFingerprint !== input.environmentFingerprint) {
      throw new Error('developmental-multiverse-runner-environment-mismatch');
    }
    const universe = new DevelopmentalMultiverse();
    universe.createSession(input);
    const runner = new DevelopmentalMultiverseIndependentRunner(universe, options);
    await options.checkpointStore.save(universe.snapshot()!);
    return runner;
  }

  /** Create directly from a P55 snapshot while retaining host-supplied P23 services. */
  static async createFromP55Snapshot(
    input: Omit<DevelopmentalMultiverseSessionInput, 'variants'>,
    p55Snapshot: Pick<P55State, 'forks'>,
    options: DevelopmentalMultiverseIndependentRunnerOptions,
  ): Promise<DevelopmentalMultiverseIndependentRunner> {
    const session = createDevelopmentalMultiverseSessionFromP55(input, p55Snapshot);
    return this.create(session, options);
  }

  /** Production composition: P55 snapshot → data-only arms → host-owned P23 authorities. */
  static async createWithHostCommandsFromP55(
    input: Omit<DevelopmentalMultiverseSessionInput, 'variants'>,
    p55Snapshot: Pick<P55State, 'forks'>,
    options: DevelopmentalMultiverseHostCommandRunnerOptions,
  ): Promise<DevelopmentalMultiverseIndependentRunner> {
    const session = createDevelopmentalMultiverseSessionFromP55(input, p55Snapshot);
    return this.createWithHostCommands(session, options);
  }

  /** Turnkey composition with the same host-owned OS/container authority adapter used by P23. */
  static async createWithHostCommands(
    input: DevelopmentalMultiverseSessionInput,
    options: DevelopmentalMultiverseHostCommandRunnerOptions,
  ): Promise<DevelopmentalMultiverseIndependentRunner> {
    const { commands, ...runnerOptions } = options;
    const services = await createHostOwnedIndependentEvaluationServices(commands);
    return this.create(input, { ...runnerOptions, services });
  }

  static async restoreWithHostCommands(
    options: DevelopmentalMultiverseHostCommandRunnerOptions,
  ): Promise<DevelopmentalMultiverseIndependentRunner> {
    const { commands, ...runnerOptions } = options;
    const services = await createHostOwnedIndependentEvaluationServices(commands);
    return this.restore({ ...runnerOptions, services });
  }

  static async restore(
    options: DevelopmentalMultiverseIndependentRunnerOptions,
  ): Promise<DevelopmentalMultiverseIndependentRunner> {
    const snapshot = await options.checkpointStore.load();
    if (!snapshot) throw new Error('developmental-multiverse-runner-checkpoint-not-found');
    const universe = new DevelopmentalMultiverse();
    universe.restore(snapshot);
    if (universe.snapshot()?.session.environmentFingerprint !== options.environmentFingerprint) {
      throw new Error('developmental-multiverse-runner-environment-mismatch');
    }
    return new DevelopmentalMultiverseIndependentRunner(universe, options);
  }

  private validateOptions(): void {
    const options = this.options;
    if (!options || !options.services || !options.checkpointStore ||
        typeof options.checkpointStore.save !== 'function' ||
        typeof options.checkpointStore.load !== 'function' ||
        typeof options.buildScenarioTask !== 'function' ||
        !isDigest(options.environmentFingerprint) || !nonEmpty(options.verifierId)) {
      throw new Error('developmental-multiverse-runner-config-invalid');
    }
    if (process.env.NODE_ENV === 'production' &&
        !isHostOwnedIndependentEvaluationServices(options.services)) {
      throw new Error('developmental-multiverse-production-requires-host-owned-authorities');
    }
    const identities = [
      options.services.authorityIdentity?.executorExecutable,
      options.services.authorityIdentity?.verifierExecutable,
      options.services.authorityIdentity?.safetyScannerExecutable,
    ];
    if (identities.some(value => !nonEmpty(value)) || new Set(identities).size !== 3) {
      throw new Error('developmental-multiverse-runner-authorities-not-distinct');
    }
    if (options.costBudgetMsPerScenario !== undefined &&
        (!Number.isSafeInteger(options.costBudgetMsPerScenario) ||
          options.costBudgetMsPerScenario < 10 || options.costBudgetMsPerScenario > 300_000)) {
      throw new Error('developmental-multiverse-runner-cost-budget-invalid');
    }
    if (options.serviceTimeoutMs !== undefined &&
        (!Number.isSafeInteger(options.serviceTimeoutMs) ||
          options.serviceTimeoutMs < 10 || options.serviceTimeoutMs > 300_000)) {
      throw new Error('developmental-multiverse-runner-service-timeout-invalid');
    }
  }

  snapshot(): DevelopmentalMultiverseSnapshot | null {
    return this.universe.snapshot();
  }

  async runValidation(): Promise<DevelopmentalMultiverseSelection> {
    return this.exclusive(async () => {
      const current = this.universe.snapshot();
      if (!current) throw new Error('developmental-multiverse-session-not-created');
      if (current.status !== 'validating') {
        if (current.selection) return structuredClone(current.selection);
        throw new Error('developmental-multiverse-validation-not-ready');
      }
      const before = current;
      const workPlan = this.universe.validationWorkPlan();
      const variantIds = ['baseline', ...current.session.variants.map(item => item.id)];
      const nonce = randomUUID();
      const corpus = this.buildCorpus(nonce);
      const allObservations: DevelopmentalMultiverseObservationInput[] = [];
      let sharedPlanFingerprint: string | null = null;
      for (const variantId of variantIds) {
        const items = workPlan.filter(item => item.variantId === variantId);
        const method = this.methodForVariant(variantId, current.session.variants.map(item => item.id));
        const evaluated = await this.evaluateArm('validation', variantId, method, items, corpus);
        if (sharedPlanFingerprint && evaluated.planFingerprint !== sharedPlanFingerprint) {
          throw new Error('developmental-multiverse-runner-validation-plan-diverged');
        }
        sharedPlanFingerprint = evaluated.planFingerprint;
        allObservations.push(...evaluated.observations);
      }
      try {
        this.universe.recordValidationObservations(allObservations);
        const selection = this.universe.selectValidationFinalist();
        await this.options.checkpointStore.save(this.universe.snapshot()!);
        return selection;
      } catch (error) {
        this.universe.restore(before);
        throw error;
      }
    });
  }

  async runHoldout(): Promise<DevelopmentalMultiverseFinalResult> {
    return this.exclusive(async () => {
      const current = this.universe.snapshot();
      if (!current) throw new Error('developmental-multiverse-session-not-created');
      if (current.status === 'completed' || current.status === 'rejected') {
        if (current.finalResult) return structuredClone(current.finalResult);
      }
      if (current.status !== 'holding-out' || !current.selectedVariantId) {
        throw new Error('developmental-multiverse-holdout-not-ready');
      }
      const before = current;
      const workPlan = this.universe.holdoutWorkPlan();
      const nonce = randomUUID();
      const corpus = this.buildCorpus(nonce);
      const variantIds = ['baseline', current.selectedVariantId];
      const allObservations: DevelopmentalMultiverseObservationInput[] = [];
      let sharedPlanFingerprint: string | null = null;
      for (const variantId of variantIds) {
        const items = workPlan.filter(item => item.variantId === variantId);
        const method = this.methodForVariant(variantId, current.session.variants.map(item => item.id));
        const evaluated = await this.evaluateArm('holdout', variantId, method, items, corpus);
        if (sharedPlanFingerprint && evaluated.planFingerprint !== sharedPlanFingerprint) {
          throw new Error('developmental-multiverse-runner-holdout-plan-diverged');
        }
        sharedPlanFingerprint = evaluated.planFingerprint;
        allObservations.push(...evaluated.observations);
      }
      try {
        this.universe.recordHoldoutObservations(allObservations);
        const result = this.universe.finalize();
        await this.options.checkpointStore.save(this.universe.snapshot()!);
        return result;
      } catch (error) {
        this.universe.restore(before);
        throw error;
      }
    });
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('developmental-multiverse-runner-phase-already-running');
    this.busy = true;
    try { return await action(); }
    finally { this.busy = false; }
  }

  private methodForVariant(variantId: string, variants: string[]): string {
    if (variantId === 'baseline') return 'dm19:baseline';
    const index = variants.indexOf(variantId);
    if (index < 0) throw new Error('developmental-multiverse-runner-variant-not-found');
    return 'dm19:candidate:' + String(index + 1);
  }

  private buildCorpus(nonce: string): ScenarioCorpus {
    const snapshot = this.universe.snapshot();
    if (!snapshot) throw new Error('developmental-multiverse-session-not-created');
    const session = snapshot.session;
    const definitions: Array<{ phase: DevelopmentalMultiversePhase; scenario: DevelopmentalMultiverseScenarioSeed }> = [
      ...session.validationScenarios.map(scenario => ({ phase: 'validation' as const, scenario })),
      ...session.holdoutScenarios.map(scenario => ({ phase: 'holdout' as const, scenario })),
    ];
    const manifest: TaskManifestEntry[] = [];
    const byKey = new Map<string, ScenarioCorpusRow>();
    for (const definition of definitions) {
      let raw: DevelopmentalMultiverseScenarioTask;
      try {
        raw = snapshotPlainData(
          this.options.buildScenarioTask(structuredClone(definition.scenario)),
        ) as DevelopmentalMultiverseScenarioTask;
      } catch {
        throw new Error('developmental-multiverse-runner-scenario-task-data-invalid');
      }
      if (!raw || typeof raw !== 'object' || !raw.input || typeof raw.input !== 'object' ||
          Array.isArray(raw.input) || typeof raw.input.prompt !== 'string' ||
          !raw.input.prompt.trim() || raw.input.prompt.length > 8192 ||
          !Array.isArray(raw.requiredCapabilityIds) || raw.requiredCapabilityIds.length === 0 ||
          raw.requiredCapabilityIds.length > 128 ||
          !Array.isArray(raw.expectedStepIds) || raw.expectedStepIds.length === 0 ||
          raw.expectedStepIds.length > 512) {
        throw new Error('developmental-multiverse-runner-scenario-task-invalid');
      }
      const baseInput = structuredClone(raw.input) as Record<string, unknown>;
      inspectScenarioData(baseInput);
      const encoded = canonical(baseInput);
      if (new TextEncoder().encode(encoded).byteLength > MAX_SCENARIO_INPUT_BYTES) {
        throw new Error('developmental-multiverse-runner-scenario-input-size-limit');
      }
      const family = raw.taskFamily ?? 'developmental-multiverse';
      if (!nonEmpty(family) || family.length > 128) throw new Error('developmental-multiverse-runner-task-family-invalid');
      const ids = [...raw.requiredCapabilityIds, ...raw.expectedStepIds];
      if (ids.some(id => !nonEmpty(id) || id.length > 256) ||
          new Set(raw.requiredCapabilityIds).size !== raw.requiredCapabilityIds.length ||
          new Set(raw.expectedStepIds).size !== raw.expectedStepIds.length) {
        throw new Error('developmental-multiverse-runner-rubric-invalid');
      }
      const taskId = definition.scenario.id + ':' + String(definition.scenario.seed) + ':' + nonce;
      const pairFingerprint = digest({
        runId: session.runId,
        phase: definition.phase,
        scenarioId: definition.scenario.id,
        seed: definition.scenario.seed,
        sourceRevision: session.sourceRevision,
        environmentFingerprint: session.environmentFingerprint,
        initialStateFingerprint: snapshot.initialStateFingerprint,
      });
      const input = {
        ...baseInput,
        developmentalMultiverse: {
          schemaVersion: 1,
          runId: session.runId,
          phase: definition.phase,
          scenarioId: definition.scenario.id,
          seed: definition.scenario.seed,
          pairFingerprint,
          sourceRevision: session.sourceRevision,
          environmentFingerprint: session.environmentFingerprint,
          evaluationNonce: nonce,
        },
      };
      const task: IndependentCandidateTask = {
        taskId,
        trialId: digest({
          runId: session.runId,
          phase: definition.phase,
          scenarioId: definition.scenario.id,
          seed: definition.scenario.seed,
        }),
        taskFamily: family,
        seed: definition.scenario.seed,
        split: definition.phase,
        input,
        requiredCapabilityIds: [...raw.requiredCapabilityIds],
        expectedStepIds: [...raw.expectedStepIds],
      };
      manifest.push({
        taskId,
        family,
        split: definition.phase,
        promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(baseInput.prompt as string),
        verifierId: this.options.verifierId,
        version: 'dm19-independent-run-v1',
      });
      byKey.set(JSON.stringify([definition.phase, definition.scenario.id, definition.scenario.seed]), {
        phase: definition.phase, scenario: structuredClone(definition.scenario), task,
      });
    }
    const ledger = new VerifiedOutcomeLedger(manifest);
    const makePlan = (split: 'validation' | 'holdout') => {
      const scenarios = split === 'validation' ? session.validationScenarios : session.holdoutScenarios;
      const seeds = [...new Set(scenarios.map(item => item.seed))].sort((a, b) => a - b);
      const resetEvery = session.variants.length > 1
        ? session.variants.slice(1).map((_, index) => index + 2)
        : [2];
      return createLearningExperimentPlan(manifest, {
        split,
        seeds,
        resetEvery,
        priorMethod: 'dm19:baseline',
        continuousMethod: 'dm19:candidate:1',
        resetMethodPrefix: 'dm19:candidate:',
      });
    };
    const validationPlan = makePlan('validation');
    const holdoutPlan = makePlan('holdout');
    // Require P23's research-grade holdout contract before any finalist is evaluated.
    validateResearchGradeLearningExperimentPlan(holdoutPlan, manifest);
    return { manifest, ledger, validationPlan, holdoutPlan, byKey };
  }

  private async evaluateArm(
    phase: DevelopmentalMultiversePhase,
    variantId: string,
    method: string,
    workItems: ReturnType<DevelopmentalMultiverse['validationWorkPlan']>,
    corpus: ScenarioCorpus,
  ): Promise<{ observations: DevelopmentalMultiverseObservationInput[]; planFingerprint: string }> {
    if (workItems.length < 1) throw new Error('developmental-multiverse-runner-arm-empty');
    const tasks = workItems.map(item => {
      const row = corpus.byKey.get(JSON.stringify([phase, item.scenarioId, item.seed]));
      if (!row || row.task.phase !== phase) throw new Error('developmental-multiverse-runner-task-binding-missing');
      return structuredClone(row.task);
    });
    const authority = {
      manifest: corpus.manifest,
      ledger: corpus.ledger,
      validationPlan: corpus.validationPlan,
      holdoutPlan: corpus.holdoutPlan,
      method,
      attempt: 1,
    };
    const evaluator = createIndependentSkillCandidateEvaluator({
      tasks,
      executor: this.options.services.executor,
      verifier: this.options.services.verifier,
      safetyScanner: this.options.services.safetyScanner,
      environmentFingerprint: this.options.environmentFingerprint,
      evaluationScope: phase === 'validation' ? 'validation-only' : 'holdout-only',
      experimentAuthority: authority,
      ...(this.options.serviceTimeoutMs === undefined ? {} : { serviceTimeoutMs: this.options.serviceTimeoutMs }),
    });
    const snapshot = this.universe.snapshot()!;
    const payload = {
      schemaVersion: 1,
      runId: snapshot.session.runId,
      phase,
      variantId,
      sourceRevision: snapshot.session.sourceRevision,
      environmentFingerprint: snapshot.session.environmentFingerprint,
      initialStateFingerprint: snapshot.initialStateFingerprint,
      policyFingerprint: digest(workItems[0]!.policyProfile),
      policyProfile: structuredClone(workItems[0]!.policyProfile),
    };
    const payloadFingerprint = digest(payload);
    const started = performance.now();
    const rawResult = await evaluator({ payload, payloadFingerprint }) as unknown as EvaluatorEnvelope;
    const elapsedMs = Math.max(0, performance.now() - started);
    const result = rawResult;
    const provenance = result?.evaluation?.provenance;
    const expectedSplitPlan = phase === 'validation' ? corpus.validationPlan : corpus.holdoutPlan;
    const recordedAuthority = provenance?.experimentAuthority;
    const evaluationScope: IndependentCandidateEvaluationScope =
      phase === 'validation' ? 'validation-only' : 'holdout-only';
    if (!result || result.payloadFingerprint !== payloadFingerprint ||
        !isDigest(result.evaluationFingerprint) ||
        result.evaluationFingerprint !== digest(result.evaluation) ||
        provenance?.payloadFingerprint !== payloadFingerprint ||
        provenance.environmentFingerprint !== this.options.environmentFingerprint ||
        !isDigest(provenance.planFingerprint) ||
        !recordedAuthority ||
        recordedAuthority.manifestFingerprint !== corpus.ledger.manifestFingerprint() ||
        recordedAuthority.validationPlanFingerprint !== corpus.validationPlan.planFingerprint ||
        recordedAuthority.holdoutPlanFingerprint !== corpus.holdoutPlan.planFingerprint ||
        recordedAuthority.method !== method || recordedAuthority.attempt !== 1 ||
        recordedAuthority.evaluationScope !== evaluationScope) {
      throw new Error('developmental-multiverse-runner-evaluator-provenance-invalid');
    }
    const reports = phase === 'validation' ? result.evaluation.validation : result.evaluation.holdout;
    const bindings = provenance.runBindings;
    if (!Array.isArray(reports) || reports.length !== tasks.length ||
        !Array.isArray(bindings) || bindings.length !== tasks.length) {
      throw new Error('developmental-multiverse-runner-evaluator-coverage-incomplete');
    }
    const reportByTrial = new Map(reports.map(report => [report.trialId, report] as const));
    const bindingByTrial = new Map(bindings.map(binding => [binding.trialId, binding] as const));
    if (reportByTrial.size !== tasks.length || bindingByTrial.size !== tasks.length) {
      throw new Error('developmental-multiverse-runner-evaluator-trial-duplicate');
    }
    const ledgerCommit = recordIndependentEvaluationOutcomes(result, {
      ...{
        manifest: corpus.manifest,
        ledger: corpus.ledger,
        validationPlan: corpus.validationPlan,
        holdoutPlan: corpus.holdoutPlan,
        method,
        attempt: 1,
        evaluationScope,
        allowPartialSchedule: true,
      },
    });
    if (ledgerCommit.accepted !== tasks.length) {
      throw new Error('developmental-multiverse-runner-outcome-ledger-coverage-mismatch');
    }
    const outcomeLedgerSnapshot = corpus.ledger.snapshot();
    const outcomeLedgerFingerprint = digest(outcomeLedgerSnapshot);
    const outcomeCount = outcomeLedgerSnapshot.acceptedOutcomes;
    if (!isDigest(outcomeLedgerFingerprint) || outcomeCount < tasks.length) {
      throw new Error('developmental-multiverse-runner-outcome-ledger-invalid');
    }
    const cost01 = clamp01((elapsedMs / tasks.length) /
      (this.options.costBudgetMsPerScenario ?? 30_000));
    const observations: DevelopmentalMultiverseObservationInput[] = [];
    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index]!;
      const item = workItems[index]!;
      const report = reportByTrial.get(task.trialId);
      const binding = bindingByTrial.get(task.trialId);
      const scheduled = expectedSplitPlan.runs.find(run =>
        run.taskId === task.taskId && run.seed === task.seed && run.method === method);
      if (!report || !binding || !scheduled ||
          report.taskId !== task.taskId || binding.taskId !== task.taskId ||
          binding.seed !== task.seed || binding.split !== phase ||
          !binding.bindingVerified || !binding.runId ||
          binding.plannedRunId !== scheduled.runId || binding.runId !== scheduled.runId ||
          !binding.executable) {
        throw new Error('developmental-multiverse-runner-independent-binding-failed');
      }
      const quality = report.taskSuccess.passRate * 0.5 +
        report.trajectoryQuality.aggregate * 0.3 +
        report.skillQuality.aggregate * 0.2;
      const safetyViolationCount = binding.safetyViolationCount;
      if (![quality, report.trajectoryQuality.executionOrder, report.skillQuality.aggregate].every(Number.isFinite) ||
          !Number.isSafeInteger(safetyViolationCount) || safetyViolationCount < 0 || safetyViolationCount > 10_000) {
        throw new Error('developmental-multiverse-runner-measurement-invalid');
      }
      observations.push({
        ...item,
        measurementId: 'dm19:' + sha256(canonical([item.workItemId, result.evaluationFingerprint, binding.runId])),
        metrics: {
          quality01: clamp01(quality),
          cost01,
          safety01: safetyViolationCount === 0 ? 1 : 0,
          // Executability and ordered-trace fidelity form a bounded single-run stability proxy.
          stability01: clamp01(0.5 + 0.5 * report.trajectoryQuality.executionOrder),
        },
        safetyViolationCount,
        verifiedEvidence: {
          evaluator: 'p23-independent-skill-candidate-evaluator',
          evaluationFingerprint: result.evaluationFingerprint,
          planFingerprint: provenance.planFingerprint,
          manifestFingerprint: recordedAuthority.manifestFingerprint,
          validationPlanFingerprint: recordedAuthority.validationPlanFingerprint,
          holdoutPlanFingerprint: recordedAuthority.holdoutPlanFingerprint,
          method,
          verifierId: this.options.verifierId,
          runId: binding.runId,
          plannedRunId: binding.plannedRunId,
          outcomeLedgerFingerprint,
          outcomeCount,
        },
      });
    }
    return { observations, planFingerprint: provenance.planFingerprint };
  }
}
