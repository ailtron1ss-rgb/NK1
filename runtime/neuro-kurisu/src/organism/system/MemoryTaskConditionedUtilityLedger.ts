import { createHash } from 'node:crypto';
import { isTrustedExternalPostconditionVerification, type OutcomeVerification } from './OutcomeVerificationService.ts';

const DIGEST = /^[a-f0-9]{64}$/;
const MAX_PENDING = 128;
const MAX_AGGREGATES = 512;
const MAX_RECENT_IDS = 512;
const MAX_OUTCOMES = 512;
const MAX_PENDING_AGE_MS = 7 * 86_400_000;
const MAX_TOKENS = 10_000_000;
const MAX_BYTES = 10_000_000;
const MAX_LATENCY_MS = 86_400_000;

export interface MemoryTaskConditionedUtilityProbe {
  id: string;
  memoryKeyHash: string;
  taskKeyHash: string;
  holdoutFingerprint: string;
  contextFingerprint: string;
  readerFingerprint: string;
  scorerFingerprint: string;
  fillerFingerprint: string;
  insertionPosition: number;
  seed: number;
  replicate: number;
  formationCostTokens: number;
  storageBytes: number;
  at: number;
}

export interface MemoryTaskConditionedUtilityAggregate {
  key: string;
  memoryKeyHash: string;
  taskKeyHash: string;
  holdoutFingerprint: string;
  contextFingerprint: string;
  readerFingerprint: string;
  scorerFingerprint: string;
  fillerFingerprint: string;
  insertionPosition: number;
  samples: number;
  meanDelta01: number;
  m2Delta01: number;
  positiveCount: number;
  negativeCount: number;
  meanFormationCostTokens: number;
  meanStorageBytes: number;
  meanInputTokenDelta: number;
  meanOutputTokenDelta: number;
  meanRetrievalLatencyDeltaMs: number;
  lastVerifiedAt: number;
}

export interface MemoryTaskConditionedUtilityLedgerState {
  version: 1;
  registered: number;
  resolved: number;
  dropped: number;
  unverifiedAttempts: number;
  pending: MemoryTaskConditionedUtilityProbe[];
  outcomes: MemoryTaskConditionedUtilityOutcome[];
  aggregates: MemoryTaskConditionedUtilityAggregate[];
  recentProbeIds: string[];
}

export interface MemoryTaskConditionedUtilityProbeInput {
  memoryId: string;
  taskKeyHash: string;
  holdoutFingerprint: string;
  contextFingerprint: string;
  readerFingerprint: string;
  scorerFingerprint: string;
  fillerFingerprint: string;
  insertionPosition: number;
  seed: number;
  replicate?: number;
  formationCostTokens?: number;
  storageBytes?: number;
  at?: number;
}

export interface MemoryTaskConditionedActionArmEvidence {
  decisionFingerprint: string;
  traceFingerprint: string;
  evidenceFingerprint: string;
  taskCompletion01: number;
  goalProgress01: number;
  groundedActionRate01: number;
  verifiedActionRate01: number;
  staleMemoryUseRate01: number;
  safetyViolationCount: number;
}

/** Hash-only action trajectory evidence; it deliberately contains no prompts or memory text. */
export interface MemoryTaskConditionedActionEvidence {
  withMemory: MemoryTaskConditionedActionArmEvidence;
  withoutMemory: MemoryTaskConditionedActionArmEvidence;
}

export interface MemoryTaskConditionedActionEstimate {
  samples: number;
  meanTaskCompletionDelta01: number;
  taskCompletionLower95Delta01: number | null;
  taskCompletionUpper95Delta01: number | null;
  positiveTaskCompletionRate01: number;
  meanGoalProgressDelta01: number;
  meanGroundedActionRateDelta01: number;
  meanVerifiedActionRateDelta01: number;
  meanStaleMemoryUseDelta01: number;
  meanSafetyViolationDelta: number;
  staleMemoryRegressionRate01: number;
  safetyRegressionRate01: number;
  lastVerifiedAt: number;
}

export interface MemoryTaskConditionedUtilityResolutionInput {
  probeId: string;
  withMemoryScore01: number;
  withoutMemoryScore01: number;
  withMemoryInputTokens: number;
  withoutMemoryInputTokens: number;
  withMemoryOutputTokens: number;
  withoutMemoryOutputTokens: number;
  withMemoryRetrievalLatencyMs: number;
  withoutMemoryRetrievalLatencyMs: number;
  /** Optional paired, hash-only trajectories for action-grounded evaluation. */
  actionEvidence?: MemoryTaskConditionedActionEvidence;
  /** Exact process-local receipt minted by OutcomeVerificationService for every supplied metric. */
  verification: OutcomeVerification;
  validationAt?: number;
}

export interface MemoryTaskConditionedUtilityOutcome {
  probeId: string;
  memoryKeyHash: string;
  taskKeyHash: string;
  seed: number;
  replicate: number;
  holdoutFingerprint: string;
  contextFingerprint: string;
  readerFingerprint: string;
  scorerFingerprint: string;
  fillerFingerprint: string;
  insertionPosition: number;
  formationCostTokens: number;
  storageBytes: number;
  withMemoryScore01: number;
  withoutMemoryScore01: number;
  delta01: number;
  inputTokenDelta: number;
  outputTokenDelta: number;
  retrievalLatencyDeltaMs: number;
  independentVerified: boolean;
  /** Present only for verified paired action-grounded evaluations. */
  actionEvidence?: MemoryTaskConditionedActionEvidence;
  at: number;
}

export interface MemoryTaskConditionedUtilityLookupInput {
  memoryId: string;
  taskKeyHash: string;
  holdoutFingerprint: string;
  contextFingerprint: string;
  readerFingerprint: string;
  scorerFingerprint: string;
  fillerFingerprint: string;
  insertionPosition: number;
}

export interface MemoryTaskConditionedUtilityEstimate {
  samples: number;
  meanDelta01: number;
  standardError01: number | null;
  lower95Delta01: number | null;
  upper95Delta01: number | null;
  positiveRate01: number;
  meanFormationCostTokens: number;
  meanStorageBytes: number;
  meanInputTokenDelta: number;
  meanOutputTokenDelta: number;
  meanRetrievalLatencyDeltaMs: number;
  lastVerifiedAt: number;
}

export type MemoryTaskConditionedUtilityRegisterResult =
  | { accepted: true; probe: MemoryTaskConditionedUtilityProbe }
  | { accepted: false; reason: 'invalid-input' | 'duplicate-probe' | 'pending-capacity-exhausted' };

export type MemoryTaskConditionedUtilityResolveResult =
  | { accepted: true; outcome: MemoryTaskConditionedUtilityOutcome; aggregate: MemoryTaskConditionedUtilityEstimate }
  | { accepted: false; reason: 'invalid-input' | 'probe-not-found' | 'validation-before-registration' | 'untrusted-verification' };

const blank = (): MemoryTaskConditionedUtilityLedgerState => ({
  version: 1, registered: 0, resolved: 0, dropped: 0, unverifiedAttempts: 0,
  pending: [], outcomes: [], aggregates: [], recentProbeIds: [],
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function strictOwnArray(value: unknown, max: number): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (!finiteInteger(length, max)) return null;
    const rows: unknown[] = [];
    for (let index = 0; index < length; index++) {
      const item = Object.getOwnPropertyDescriptor(value, String(index));
      if (!item || !('value' in item) || item.get || item.set) return null;
      rows.push(item.value);
    }
    return rows;
  } catch {
    return null;
  }
}

/** Read an exact, accessor-free data envelope without invoking caller getters. */
function readDataEnvelope(value: unknown, allowed: readonly string[]): Record<string, unknown> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > allowed.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string' || !allowed.includes(key)) return null;
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function safeIdentity(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max &&
    value.trim() === value && value.normalize('NFKC') === value &&
    !Array.from(value).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    });
}

function digest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value.toLowerCase());
}

function finiteInteger(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function score01(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function cleanActionArmEvidence(raw: unknown): MemoryTaskConditionedActionArmEvidence | null {
  const row = readDataEnvelope(raw, [
    'decisionFingerprint', 'traceFingerprint', 'evidenceFingerprint', 'taskCompletion01',
    'goalProgress01', 'groundedActionRate01', 'verifiedActionRate01', 'staleMemoryUseRate01',
    'safetyViolationCount',
  ]);
  if (!row || !digest(row.decisionFingerprint) || !digest(row.traceFingerprint) || !digest(row.evidenceFingerprint) ||
      !score01(row.taskCompletion01) || !score01(row.goalProgress01) || !score01(row.groundedActionRate01) ||
      !score01(row.verifiedActionRate01) || !score01(row.staleMemoryUseRate01) ||
      !finiteInteger(row.safetyViolationCount, 10_000)) return null;
  return {
    decisionFingerprint: (row.decisionFingerprint as string).toLowerCase(),
    traceFingerprint: (row.traceFingerprint as string).toLowerCase(),
    evidenceFingerprint: (row.evidenceFingerprint as string).toLowerCase(),
    taskCompletion01: row.taskCompletion01 as number,
    goalProgress01: row.goalProgress01 as number,
    groundedActionRate01: row.groundedActionRate01 as number,
    verifiedActionRate01: row.verifiedActionRate01 as number,
    staleMemoryUseRate01: row.staleMemoryUseRate01 as number,
    safetyViolationCount: row.safetyViolationCount as number,
  };
}

function cleanActionEvidence(raw: unknown): MemoryTaskConditionedActionEvidence | null {
  const row = readDataEnvelope(raw, ['withMemory', 'withoutMemory']);
  if (!row) return null;
  const withMemory = cleanActionArmEvidence(row.withMemory);
  const withoutMemory = cleanActionArmEvidence(row.withoutMemory);
  if (!withMemory || !withoutMemory ||
      withMemory.decisionFingerprint === withoutMemory.decisionFingerprint ||
      withMemory.traceFingerprint === withoutMemory.traceFingerprint ||
      withMemory.evidenceFingerprint === withoutMemory.evidenceFingerprint) return null;
  return { withMemory, withoutMemory };
}

function canonicalProbeId(probe: Pick<MemoryTaskConditionedUtilityProbe,
  'memoryKeyHash' | 'taskKeyHash' | 'holdoutFingerprint' | 'contextFingerprint' | 'readerFingerprint' |
  'scorerFingerprint' | 'fillerFingerprint' | 'insertionPosition' | 'seed' | 'replicate'>): string {
  return 'mtu:' + sha256(JSON.stringify([
    probe.memoryKeyHash, probe.taskKeyHash, probe.holdoutFingerprint, probe.contextFingerprint,
    probe.readerFingerprint, probe.scorerFingerprint, probe.fillerFingerprint,
    probe.insertionPosition, probe.seed, probe.replicate,
  ]));
}

function aggregateKey(probe: Pick<MemoryTaskConditionedUtilityProbe,
  'memoryKeyHash' | 'taskKeyHash' | 'holdoutFingerprint' | 'contextFingerprint' | 'readerFingerprint' |
  'scorerFingerprint' | 'fillerFingerprint' | 'insertionPosition'>): string {
  return sha256(JSON.stringify([
    probe.memoryKeyHash, probe.taskKeyHash, probe.holdoutFingerprint, probe.contextFingerprint,
    probe.readerFingerprint, probe.scorerFingerprint, probe.fillerFingerprint, probe.insertionPosition,
  ]));
}

function tCritical95(degreesOfFreedom: number): number {
  const smallSample = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
    2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
    2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  return smallSample[degreesOfFreedom] ?? 1.96;
}

export type MemoryTaskConditionedUtilityResolutionMetrics = Pick<MemoryTaskConditionedUtilityResolutionInput,
  'withMemoryScore01' | 'withoutMemoryScore01' | 'withMemoryInputTokens' | 'withoutMemoryInputTokens' |
  'withMemoryOutputTokens' | 'withoutMemoryOutputTokens' | 'withMemoryRetrievalLatencyMs' | 'withoutMemoryRetrievalLatencyMs'> & {
    actionEvidence?: MemoryTaskConditionedActionEvidence;
  };

/**
 * Canonical input tuple that an independent verifier must bind into its
 * OutcomeVerificationService context. It contains hashes and measurements,
 * never raw task, prompt, filler or memory text.
 */
export function memoryTaskConditionedUtilityVerificationInput(
  probe: MemoryTaskConditionedUtilityProbe,
  metrics: MemoryTaskConditionedUtilityResolutionMetrics,
): Record<string, unknown> {
  const row = readDataEnvelope(metrics, [
    'withMemoryScore01', 'withoutMemoryScore01', 'withMemoryInputTokens', 'withoutMemoryInputTokens',
    'withMemoryOutputTokens', 'withoutMemoryOutputTokens', 'withMemoryRetrievalLatencyMs',
    'withoutMemoryRetrievalLatencyMs', 'actionEvidence',
  ]);
  if (!row) throw new TypeError('invalid-task-conditioned-utility-metrics');
  const actionEvidence = row.actionEvidence === undefined ? undefined : cleanActionEvidence(row.actionEvidence);
  if (row.actionEvidence !== undefined && !actionEvidence) throw new TypeError('invalid-task-conditioned-action-evidence');
  return {
    schema: 'nk1.memory-task-conditioned-utility.v1',
    probeId: probe.id,
    memoryKeyHash: probe.memoryKeyHash,
    taskKeyHash: probe.taskKeyHash,
    holdoutFingerprint: probe.holdoutFingerprint,
    contextFingerprint: probe.contextFingerprint,
    readerFingerprint: probe.readerFingerprint,
    scorerFingerprint: probe.scorerFingerprint,
    fillerFingerprint: probe.fillerFingerprint,
    insertionPosition: probe.insertionPosition,
    seed: probe.seed,
    replicate: probe.replicate,
    withMemoryScore01: row.withMemoryScore01,
    withoutMemoryScore01: row.withoutMemoryScore01,
    withMemoryInputTokens: row.withMemoryInputTokens,
    withoutMemoryInputTokens: row.withoutMemoryInputTokens,
    withMemoryOutputTokens: row.withMemoryOutputTokens,
    withoutMemoryOutputTokens: row.withoutMemoryOutputTokens,
    withMemoryRetrievalLatencyMs: row.withMemoryRetrievalLatencyMs,
    withoutMemoryRetrievalLatencyMs: row.withoutMemoryRetrievalLatencyMs,
    ...(actionEvidence ? { actionEvidence } : {}),
  };
}

function estimate(aggregate: MemoryTaskConditionedUtilityAggregate): MemoryTaskConditionedUtilityEstimate {
  const n = aggregate.samples;
  const standardError01 = n > 1 ? Math.sqrt(Math.max(0, aggregate.m2Delta01 / (n - 1)) / n) : null;
  const margin = standardError01 === null ? null : tCritical95(n - 1) * standardError01;
  return {
    samples: n, meanDelta01: aggregate.meanDelta01, standardError01,
    lower95Delta01: margin === null ? null : aggregate.meanDelta01 - margin,
    upper95Delta01: margin === null ? null : aggregate.meanDelta01 + margin,
    positiveRate01: aggregate.positiveCount / n,
    meanFormationCostTokens: aggregate.meanFormationCostTokens,
    meanStorageBytes: aggregate.meanStorageBytes,
    meanInputTokenDelta: aggregate.meanInputTokenDelta,
    meanOutputTokenDelta: aggregate.meanOutputTokenDelta,
    meanRetrievalLatencyDeltaMs: aggregate.meanRetrievalLatencyDeltaMs,
    lastVerifiedAt: aggregate.lastVerifiedAt,
  };
}

/**
 * Records paired, task-conditioned memory utility without changing retrieval or retention policy.
 * Both arms share the frozen task, immutable holdout, context, reader, scorer, filler,
 * insertion position and seed. Optional action trajectories are hash-only and are included
 * in the exact trusted OutcomeVerificationService receipt before they become audit evidence.
 */
export class MemoryTaskConditionedUtilityLedger {
  private state = blank();
  /** Only current-process receipts count as live action evidence; restore always clears this cache. */
  private liveActionOutcomes: MemoryTaskConditionedUtilityOutcome[] = [];
  private readonly maxPending = MAX_PENDING;
  private readonly maxAggregates = MAX_AGGREGATES;
  private readonly maxRecentIds = MAX_RECENT_IDS;

  snapshot(): MemoryTaskConditionedUtilityLedgerState {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<MemoryTaskConditionedUtilityLedgerState> | null): void {
    this.liveActionOutcomes = [];
    const row = readDataEnvelope(raw, [
      'version', 'registered', 'resolved', 'dropped', 'unverifiedAttempts', 'pending', 'outcomes', 'aggregates', 'recentProbeIds',
    ]);
    const rawPending = strictOwnArray(row?.pending, this.maxPending);
    const rawOutcomes = strictOwnArray(row?.outcomes, MAX_OUTCOMES);
    const rawAggregates = strictOwnArray(row?.aggregates, this.maxAggregates);
    const rawRecentProbeIds = strictOwnArray(row?.recentProbeIds, this.maxRecentIds);
    if (!row || row.version !== 1 || !rawPending || !rawOutcomes || !rawAggregates || !rawRecentProbeIds ||
        !finiteInteger(row.registered, Number.MAX_SAFE_INTEGER) ||
        !finiteInteger(row.resolved, Number.MAX_SAFE_INTEGER) ||
        !finiteInteger(row.dropped, Number.MAX_SAFE_INTEGER) ||
        !finiteInteger(row.unverifiedAttempts, Number.MAX_SAFE_INTEGER)) {
      this.state = blank();
      return;
    }

    const pending = rawPending.map(item => this.cleanProbe(item));
    const outcomes = rawOutcomes.map(item => this.cleanOutcome(item));
    const aggregates = rawAggregates.map(item => this.cleanAggregate(item));
    const recentProbeIds = rawRecentProbeIds.filter((id): id is string =>
      typeof id === 'string' && /^mtu:[a-f0-9]{64}$/.test(id));
    if (pending.some(item => item === null) || outcomes.some(item => item === null) || aggregates.some(item => item === null) ||
        recentProbeIds.length !== rawRecentProbeIds.length) {
      this.state = blank();
      return;
    }

    const validPending = pending as MemoryTaskConditionedUtilityProbe[];
    const validOutcomes = outcomes as MemoryTaskConditionedUtilityOutcome[];
    const validAggregates = aggregates as MemoryTaskConditionedUtilityAggregate[];
    if (new Set(validPending.map(item => item.id)).size !== validPending.length ||
        new Set(validAggregates.map(item => item.key)).size !== validAggregates.length ||
        new Set(validOutcomes.map(item => item.probeId)).size !== validOutcomes.length ||
        validPending.some(item => recentProbeIds.includes(item.id)) ||
        validOutcomes.some(item => !recentProbeIds.includes(item.probeId))) {
      this.state = blank();
      return;
    }

    this.state = {
      version: 1,
      registered: row.registered as number,
      resolved: row.resolved as number,
      dropped: row.dropped as number,
      unverifiedAttempts: row.unverifiedAttempts as number,
      pending: validPending,
      outcomes: validOutcomes,
      // OutcomeVerificationService receipts are WeakMap-bound to the live object and
      // cannot be reconstructed from copied JSON. Keep restored outcomes for audit,
      // but never hydrate them as current-session promotion evidence.
      aggregates: [],
      recentProbeIds: recentProbeIds.slice(-this.maxRecentIds),
    };
  }

  register(raw: MemoryTaskConditionedUtilityProbeInput): MemoryTaskConditionedUtilityRegisterResult {
    const input = readDataEnvelope(raw, [
      'memoryId', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint', 'scorerFingerprint',
      'fillerFingerprint', 'insertionPosition', 'seed', 'replicate', 'formationCostTokens', 'storageBytes', 'at',
    ]);
    if (!input || !safeIdentity(input.memoryId) || !digest(input.taskKeyHash) || !digest(input.holdoutFingerprint) ||
        !digest(input.contextFingerprint) || !digest(input.readerFingerprint) || !digest(input.scorerFingerprint) ||
        !digest(input.fillerFingerprint) || !finiteInteger(input.insertionPosition, MAX_TOKENS) ||
        !finiteInteger(input.seed, 2_147_483_647) ||
        (input.replicate !== undefined && !finiteInteger(input.replicate, 10_000)) ||
        (input.formationCostTokens !== undefined && !finiteInteger(input.formationCostTokens, MAX_TOKENS)) ||
        (input.storageBytes !== undefined && !finiteInteger(input.storageBytes, MAX_BYTES)) ||
        (input.at !== undefined && !finiteInteger(input.at, Number.MAX_SAFE_INTEGER))) {
      return { accepted: false, reason: 'invalid-input' };
    }

    const at = input.at === undefined ? Date.now() : input.at as number;
    this.pruneStale(at);
    if (this.state.pending.length >= this.maxPending) {
      return { accepted: false, reason: 'pending-capacity-exhausted' };
    }

    const memoryKeyHash = sha256('nk1-memory-task-utility-v1\0' + input.memoryId);
    const probeBase = {
      memoryKeyHash,
      taskKeyHash: (input.taskKeyHash as string).toLowerCase(),
      holdoutFingerprint: (input.holdoutFingerprint as string).toLowerCase(),
      contextFingerprint: (input.contextFingerprint as string).toLowerCase(),
      readerFingerprint: (input.readerFingerprint as string).toLowerCase(),
      scorerFingerprint: (input.scorerFingerprint as string).toLowerCase(),
      fillerFingerprint: (input.fillerFingerprint as string).toLowerCase(),
      insertionPosition: input.insertionPosition as number,
      seed: input.seed as number,
      replicate: (input.replicate ?? 0) as number,
    };
    const id = canonicalProbeId(probeBase);
    if (this.state.pending.some(item => item.id === id) || this.state.recentProbeIds.includes(id)) {
      return { accepted: false, reason: 'duplicate-probe' };
    }

    const probe: MemoryTaskConditionedUtilityProbe = {
      id, ...probeBase,
      formationCostTokens: (input.formationCostTokens ?? 0) as number,
      storageBytes: (input.storageBytes ?? 0) as number,
      at,
    };
    this.state.pending.push(probe);
    this.state.registered++;
    return { accepted: true, probe: structuredClone(probe) };
  }

  resolve(raw: MemoryTaskConditionedUtilityResolutionInput): MemoryTaskConditionedUtilityResolveResult {
    const input = readDataEnvelope(raw, [
      'probeId', 'withMemoryScore01', 'withoutMemoryScore01', 'withMemoryInputTokens', 'withoutMemoryInputTokens',
      'withMemoryOutputTokens', 'withoutMemoryOutputTokens', 'withMemoryRetrievalLatencyMs',
      'withoutMemoryRetrievalLatencyMs', 'actionEvidence', 'verification', 'validationAt',
    ]);
    if (!input || typeof input.probeId !== 'string' || !/^mtu:[a-f0-9]{64}$/.test(input.probeId) ||
        !score01(input.withMemoryScore01) || !score01(input.withoutMemoryScore01) ||
        !finiteInteger(input.withMemoryInputTokens, MAX_TOKENS) || !finiteInteger(input.withoutMemoryInputTokens, MAX_TOKENS) ||
        !finiteInteger(input.withMemoryOutputTokens, MAX_TOKENS) || !finiteInteger(input.withoutMemoryOutputTokens, MAX_TOKENS) ||
        typeof input.withMemoryRetrievalLatencyMs !== 'number' || !Number.isFinite(input.withMemoryRetrievalLatencyMs) ||
        input.withMemoryRetrievalLatencyMs < 0 || input.withMemoryRetrievalLatencyMs > MAX_LATENCY_MS ||
        typeof input.withoutMemoryRetrievalLatencyMs !== 'number' || !Number.isFinite(input.withoutMemoryRetrievalLatencyMs) ||
        input.withoutMemoryRetrievalLatencyMs < 0 || input.withoutMemoryRetrievalLatencyMs > MAX_LATENCY_MS ||
        (input.actionEvidence !== undefined && !cleanActionEvidence(input.actionEvidence)) ||
        (input.validationAt !== undefined && !finiteInteger(input.validationAt, Number.MAX_SAFE_INTEGER))) {
      return { accepted: false, reason: 'invalid-input' };
    }

    const validationAt = input.validationAt === undefined ? Date.now() : input.validationAt as number;
    this.pruneStale(validationAt);
    const index = this.state.pending.findIndex(item => item.id === input.probeId);
    if (index < 0) return { accepted: false, reason: 'probe-not-found' };
    const probe = this.state.pending[index]!;
    if (validationAt < probe.at) return { accepted: false, reason: 'validation-before-registration' };

    const metrics: MemoryTaskConditionedUtilityResolutionMetrics = {
      withMemoryScore01: input.withMemoryScore01 as number,
      withoutMemoryScore01: input.withoutMemoryScore01 as number,
      withMemoryInputTokens: input.withMemoryInputTokens as number,
      withoutMemoryInputTokens: input.withoutMemoryInputTokens as number,
      withMemoryOutputTokens: input.withMemoryOutputTokens as number,
      withoutMemoryOutputTokens: input.withoutMemoryOutputTokens as number,
      withMemoryRetrievalLatencyMs: input.withMemoryRetrievalLatencyMs as number,
      withoutMemoryRetrievalLatencyMs: input.withoutMemoryRetrievalLatencyMs as number,
      ...(input.actionEvidence !== undefined ? { actionEvidence: cleanActionEvidence(input.actionEvidence)! } : {}),
    };
    const expectedVerificationInput = memoryTaskConditionedUtilityVerificationInput(probe, metrics);
    if (!isTrustedExternalPostconditionVerification(input.verification, expectedVerificationInput)) {
      this.state.unverifiedAttempts++;
      return { accepted: false, reason: 'untrusted-verification' };
    }

    const outcome: MemoryTaskConditionedUtilityOutcome = {
      probeId: probe.id, memoryKeyHash: probe.memoryKeyHash, taskKeyHash: probe.taskKeyHash,
      seed: probe.seed, replicate: probe.replicate,
      holdoutFingerprint: probe.holdoutFingerprint, contextFingerprint: probe.contextFingerprint,
      readerFingerprint: probe.readerFingerprint, scorerFingerprint: probe.scorerFingerprint,
      fillerFingerprint: probe.fillerFingerprint, insertionPosition: probe.insertionPosition,
      formationCostTokens: probe.formationCostTokens, storageBytes: probe.storageBytes,
      withMemoryScore01: metrics.withMemoryScore01,
      withoutMemoryScore01: metrics.withoutMemoryScore01,
      delta01: metrics.withMemoryScore01 - metrics.withoutMemoryScore01,
      inputTokenDelta: metrics.withMemoryInputTokens - metrics.withoutMemoryInputTokens,
      outputTokenDelta: metrics.withMemoryOutputTokens - metrics.withoutMemoryOutputTokens,
      retrievalLatencyDeltaMs: metrics.withMemoryRetrievalLatencyMs - metrics.withoutMemoryRetrievalLatencyMs,
      independentVerified: true,
      ...(metrics.actionEvidence ? { actionEvidence: metrics.actionEvidence } : {}),
      at: validationAt,
    };

    this.state.pending.splice(index, 1);
    this.state.outcomes = [...this.state.outcomes, outcome].slice(-MAX_OUTCOMES);
    if (outcome.actionEvidence) this.liveActionOutcomes = [...this.liveActionOutcomes, outcome].slice(-MAX_OUTCOMES);
    this.state.recentProbeIds = [...this.state.recentProbeIds, probe.id].slice(-this.maxRecentIds);
    this.state.resolved++;
    const key = aggregateKey(probe);
    let aggregate = this.state.aggregates.find(item => item.key === key);
    if (!aggregate) {
      aggregate = {
        key, memoryKeyHash: probe.memoryKeyHash, taskKeyHash: probe.taskKeyHash,
        holdoutFingerprint: probe.holdoutFingerprint, contextFingerprint: probe.contextFingerprint,
        readerFingerprint: probe.readerFingerprint, scorerFingerprint: probe.scorerFingerprint,
        fillerFingerprint: probe.fillerFingerprint,
        insertionPosition: probe.insertionPosition,
        samples: 0, meanDelta01: 0, m2Delta01: 0, positiveCount: 0, negativeCount: 0,
        meanFormationCostTokens: 0, meanStorageBytes: 0, meanInputTokenDelta: 0,
        meanOutputTokenDelta: 0, meanRetrievalLatencyDeltaMs: 0, lastVerifiedAt: validationAt,
      };
      this.state.aggregates.push(aggregate);
      if (this.state.aggregates.length > this.maxAggregates) {
        this.state.aggregates.sort((a, b) => a.lastVerifiedAt - b.lastVerifiedAt || a.key.localeCompare(b.key));
        this.state.aggregates.shift();
      }
      aggregate = this.state.aggregates.find(item => item.key === key)!;
    }

    const n = aggregate.samples + 1;
    const deltaDifference = outcome.delta01 - aggregate.meanDelta01;
    aggregate.meanDelta01 += deltaDifference / n;
    aggregate.m2Delta01 += deltaDifference * (outcome.delta01 - aggregate.meanDelta01);
    aggregate.positiveCount += outcome.delta01 > 0 ? 1 : 0;
    aggregate.negativeCount += outcome.delta01 < 0 ? 1 : 0;
    aggregate.meanFormationCostTokens += (probe.formationCostTokens - aggregate.meanFormationCostTokens) / n;
    aggregate.meanStorageBytes += (probe.storageBytes - aggregate.meanStorageBytes) / n;
    aggregate.meanInputTokenDelta += (outcome.inputTokenDelta - aggregate.meanInputTokenDelta) / n;
    aggregate.meanOutputTokenDelta += (outcome.outputTokenDelta - aggregate.meanOutputTokenDelta) / n;
    aggregate.meanRetrievalLatencyDeltaMs += (outcome.retrievalLatencyDeltaMs - aggregate.meanRetrievalLatencyDeltaMs) / n;
    aggregate.samples = n;
    aggregate.lastVerifiedAt = validationAt;
    return { accepted: true, outcome, aggregate: estimate(aggregate) };
  }

  lookup(raw: MemoryTaskConditionedUtilityLookupInput): MemoryTaskConditionedUtilityEstimate | null {
    const input = readDataEnvelope(raw, [
      'memoryId', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint', 'scorerFingerprint', 'fillerFingerprint', 'insertionPosition',
    ]);
    if (!input || !safeIdentity(input.memoryId) || !digest(input.taskKeyHash) || !digest(input.holdoutFingerprint) ||
        !digest(input.contextFingerprint) || !digest(input.readerFingerprint) || !digest(input.scorerFingerprint) ||
        !digest(input.fillerFingerprint) || !finiteInteger(input.insertionPosition, MAX_TOKENS)) return null;
    const probe = {
      memoryKeyHash: sha256('nk1-memory-task-utility-v1\0' + input.memoryId),
      taskKeyHash: (input.taskKeyHash as string).toLowerCase(),
      holdoutFingerprint: (input.holdoutFingerprint as string).toLowerCase(),
      contextFingerprint: (input.contextFingerprint as string).toLowerCase(),
      readerFingerprint: (input.readerFingerprint as string).toLowerCase(),
      scorerFingerprint: (input.scorerFingerprint as string).toLowerCase(),
      fillerFingerprint: (input.fillerFingerprint as string).toLowerCase(),
      insertionPosition: input.insertionPosition as number,
    };
    const aggregate = this.state.aggregates.find(item => item.key === aggregateKey(probe as MemoryTaskConditionedUtilityProbe));
    return aggregate ? estimate(aggregate) : null;
  }

  /**
   * Returns only paired action traces verified in this process. Restored outcomes remain
   * available for audit but cannot be promoted into a fresh measurement after restart.
   */
  lookupActionEvidence(raw: MemoryTaskConditionedUtilityLookupInput): MemoryTaskConditionedActionEstimate | null {
    const input = readDataEnvelope(raw, [
      'memoryId', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint',
      'scorerFingerprint', 'fillerFingerprint', 'insertionPosition',
    ]);
    if (!input || !safeIdentity(input.memoryId) || !digest(input.taskKeyHash) || !digest(input.holdoutFingerprint) ||
        !digest(input.contextFingerprint) || !digest(input.readerFingerprint) || !digest(input.scorerFingerprint) ||
        !digest(input.fillerFingerprint) || !finiteInteger(input.insertionPosition, MAX_TOKENS)) return null;
    const key = aggregateKey({
      memoryKeyHash: sha256('nk1-memory-task-utility-v1\0' + input.memoryId),
      taskKeyHash: (input.taskKeyHash as string).toLowerCase(),
      holdoutFingerprint: (input.holdoutFingerprint as string).toLowerCase(),
      contextFingerprint: (input.contextFingerprint as string).toLowerCase(),
      readerFingerprint: (input.readerFingerprint as string).toLowerCase(),
      scorerFingerprint: (input.scorerFingerprint as string).toLowerCase(),
      fillerFingerprint: (input.fillerFingerprint as string).toLowerCase(),
      insertionPosition: input.insertionPosition as number,
    } as MemoryTaskConditionedUtilityProbe);
    const outcomes = this.liveActionOutcomes.filter(item => item.actionEvidence && aggregateKey(item) === key);
    if (outcomes.length === 0) return null;
    const completion = outcomes.map(item => item.actionEvidence!.withMemory.taskCompletion01 - item.actionEvidence!.withoutMemory.taskCompletion01);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const m = mean(completion);
    const variance = completion.length > 1
      ? completion.reduce((sum, value) => sum + ((value - m) ** 2), 0) / (completion.length - 1) : null;
    const standardError = variance === null ? null : Math.sqrt(variance / completion.length);
    const margin = standardError === null ? null : tCritical95(completion.length - 1) * standardError;
    const staleRegressions = outcomes.filter(item => item.actionEvidence!.withMemory.staleMemoryUseRate01 > item.actionEvidence!.withoutMemory.staleMemoryUseRate01).length;
    const safetyRegressions = outcomes.filter(item => item.actionEvidence!.withMemory.safetyViolationCount > item.actionEvidence!.withoutMemory.safetyViolationCount).length;
    return {
      samples: outcomes.length,
      meanTaskCompletionDelta01: m,
      taskCompletionLower95Delta01: margin === null ? null : m - margin,
      taskCompletionUpper95Delta01: margin === null ? null : m + margin,
      positiveTaskCompletionRate01: completion.filter(value => value > 0).length / outcomes.length,
      meanGoalProgressDelta01: mean(outcomes.map(item => item.actionEvidence!.withMemory.goalProgress01 - item.actionEvidence!.withoutMemory.goalProgress01)),
      meanGroundedActionRateDelta01: mean(outcomes.map(item => item.actionEvidence!.withMemory.groundedActionRate01 - item.actionEvidence!.withoutMemory.groundedActionRate01)),
      meanVerifiedActionRateDelta01: mean(outcomes.map(item => item.actionEvidence!.withMemory.verifiedActionRate01 - item.actionEvidence!.withoutMemory.verifiedActionRate01)),
      meanStaleMemoryUseDelta01: mean(outcomes.map(item => item.actionEvidence!.withMemory.staleMemoryUseRate01 - item.actionEvidence!.withoutMemory.staleMemoryUseRate01)),
      meanSafetyViolationDelta: mean(outcomes.map(item => item.actionEvidence!.withMemory.safetyViolationCount - item.actionEvidence!.withoutMemory.safetyViolationCount)),
      staleMemoryRegressionRate01: staleRegressions / outcomes.length,
      safetyRegressionRate01: safetyRegressions / outcomes.length,
      lastVerifiedAt: Math.max(...outcomes.map(item => item.at)),
    };
  }

  diagnostics() {
    return {
      version: 1, registered: this.state.registered, resolved: this.state.resolved,
      dropped: this.state.dropped, unverifiedAttempts: this.state.unverifiedAttempts,
      pending: this.state.pending.length, outcomes: this.state.outcomes.length, aggregates: this.state.aggregates.length,
      currentProcessActionEvidenceOutcomes: this.liveActionOutcomes.length,
      actionEvidenceScope: 'current-process-trusted-receipts-only' as const,
      evidenceScope: 'paired-task-conditioned-counterfactual' as const,
      decisionAuthority: 'audit-only-no-retrieval-or-retention-mutation' as const,
    };
  }

  private pruneStale(now: number): void {
    const cutoff = Math.max(0, now - MAX_PENDING_AGE_MS);
    const before = this.state.pending.length;
    this.state.pending = this.state.pending.filter(item => item.at >= cutoff);
    this.state.dropped += before - this.state.pending.length;
  }

  private cleanProbe(raw: unknown): MemoryTaskConditionedUtilityProbe | null {
    const row = readDataEnvelope(raw, [
      'id', 'memoryKeyHash', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint',
      'scorerFingerprint', 'fillerFingerprint', 'insertionPosition', 'seed', 'replicate',
      'formationCostTokens', 'storageBytes', 'at',
    ]);
    if (!row || typeof row.id !== 'string' || !/^mtu:[a-f0-9]{64}$/.test(row.id) ||
        !digest(row.memoryKeyHash) || !digest(row.taskKeyHash) || !digest(row.holdoutFingerprint) ||
        !digest(row.contextFingerprint) || !digest(row.readerFingerprint) || !digest(row.scorerFingerprint) ||
        !digest(row.fillerFingerprint) || !finiteInteger(row.insertionPosition, MAX_TOKENS) ||
        !finiteInteger(row.seed, 2_147_483_647) || !finiteInteger(row.replicate, 10_000) ||
        !finiteInteger(row.formationCostTokens, MAX_TOKENS) || !finiteInteger(row.storageBytes, MAX_BYTES) ||
        !finiteInteger(row.at, Number.MAX_SAFE_INTEGER)) return null;
    const probe = row as unknown as MemoryTaskConditionedUtilityProbe;
    return canonicalProbeId(probe) === probe.id ? structuredClone(probe) : null;
  }

  private cleanOutcome(raw: unknown): MemoryTaskConditionedUtilityOutcome | null {
    const row = readDataEnvelope(raw, [
      'probeId', 'memoryKeyHash', 'taskKeyHash', 'seed', 'replicate', 'holdoutFingerprint',
      'contextFingerprint', 'readerFingerprint', 'scorerFingerprint', 'fillerFingerprint',
      'insertionPosition', 'formationCostTokens', 'storageBytes', 'withMemoryScore01',
      'withoutMemoryScore01', 'delta01', 'inputTokenDelta', 'outputTokenDelta',
      'retrievalLatencyDeltaMs', 'independentVerified', 'actionEvidence', 'at',
    ]);
    if (!row || typeof row.probeId !== 'string' || !/^mtu:[a-f0-9]{64}$/.test(row.probeId) ||
        !digest(row.memoryKeyHash) || !digest(row.taskKeyHash) || !digest(row.holdoutFingerprint) ||
        !digest(row.contextFingerprint) || !digest(row.readerFingerprint) || !digest(row.scorerFingerprint) ||
        !digest(row.fillerFingerprint) || !finiteInteger(row.seed, 2_147_483_647) ||
        !finiteInteger(row.replicate, 10_000) || !finiteInteger(row.insertionPosition, MAX_TOKENS) ||
        !finiteInteger(row.formationCostTokens, MAX_TOKENS) || !finiteInteger(row.storageBytes, MAX_BYTES) ||
        !score01(row.withMemoryScore01) || !score01(row.withoutMemoryScore01) ||
        typeof row.delta01 !== 'number' || !Number.isFinite(row.delta01) ||
        Math.abs(row.delta01 - ((row.withMemoryScore01 as number) - (row.withoutMemoryScore01 as number))) > 1e-9 ||
        !Number.isSafeInteger(row.inputTokenDelta) || Math.abs(row.inputTokenDelta as number) > MAX_TOKENS ||
        !Number.isSafeInteger(row.outputTokenDelta) || Math.abs(row.outputTokenDelta as number) > MAX_TOKENS ||
        typeof row.retrievalLatencyDeltaMs !== 'number' || !Number.isFinite(row.retrievalLatencyDeltaMs) ||
        Math.abs(row.retrievalLatencyDeltaMs) > MAX_LATENCY_MS || row.independentVerified !== true ||
        (row.actionEvidence !== undefined && !cleanActionEvidence(row.actionEvidence)) ||
        !finiteInteger(row.at, Number.MAX_SAFE_INTEGER)) return null;
    const outcome = { ...row, ...(row.actionEvidence !== undefined ? { actionEvidence: cleanActionEvidence(row.actionEvidence)! } : {}) } as unknown as MemoryTaskConditionedUtilityOutcome;
    return canonicalProbeId(outcome) === outcome.probeId ? structuredClone(outcome) : null;
  }

  private cleanAggregate(raw: unknown): MemoryTaskConditionedUtilityAggregate | null {
    const row = readDataEnvelope(raw, [
      'key', 'memoryKeyHash', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint',
      'scorerFingerprint', 'fillerFingerprint', 'insertionPosition', 'samples', 'meanDelta01', 'm2Delta01',
      'positiveCount', 'negativeCount', 'meanFormationCostTokens', 'meanStorageBytes',
      'meanInputTokenDelta', 'meanOutputTokenDelta', 'meanRetrievalLatencyDeltaMs', 'lastVerifiedAt',
    ]);
    if (!row || !digest(row.key) || !digest(row.memoryKeyHash) || !digest(row.taskKeyHash) ||
        !digest(row.holdoutFingerprint) || !digest(row.contextFingerprint) || !digest(row.readerFingerprint) ||
        !digest(row.scorerFingerprint) || !digest(row.fillerFingerprint) || !finiteInteger(row.insertionPosition, MAX_TOKENS) ||
        !finiteInteger(row.samples, Number.MAX_SAFE_INTEGER) || row.samples < 1 ||
        typeof row.meanDelta01 !== 'number' || !Number.isFinite(row.meanDelta01) || row.meanDelta01 < -1 || row.meanDelta01 > 1 ||
        !Number.isFinite(row.m2Delta01) || (row.m2Delta01 as number) < 0 ||
        !finiteInteger(row.positiveCount, Number.MAX_SAFE_INTEGER) || !finiteInteger(row.negativeCount, Number.MAX_SAFE_INTEGER) ||
        (row.positiveCount as number) + (row.negativeCount as number) > (row.samples as number) ||
        typeof row.meanFormationCostTokens !== 'number' || !Number.isFinite(row.meanFormationCostTokens) ||
        row.meanFormationCostTokens < 0 || row.meanFormationCostTokens > MAX_TOKENS ||
        typeof row.meanStorageBytes !== 'number' || !Number.isFinite(row.meanStorageBytes) ||
        row.meanStorageBytes < 0 || row.meanStorageBytes > MAX_BYTES ||
        typeof row.meanInputTokenDelta !== 'number' || !Number.isFinite(row.meanInputTokenDelta) ||
        typeof row.meanOutputTokenDelta !== 'number' || !Number.isFinite(row.meanOutputTokenDelta) ||
        typeof row.meanRetrievalLatencyDeltaMs !== 'number' || !Number.isFinite(row.meanRetrievalLatencyDeltaMs) ||
        !finiteInteger(row.lastVerifiedAt, Number.MAX_SAFE_INTEGER)) return null;
    const aggregate = row as unknown as MemoryTaskConditionedUtilityAggregate;
    return aggregate.key === aggregateKey(aggregate) ? structuredClone(aggregate) : null;
  }
}

export const defaultMemoryTaskConditionedUtilityLedger = () => new MemoryTaskConditionedUtilityLedger();
