import { createHash } from 'node:crypto';

const DIGEST = /^[a-f0-9]{64}$/;
const MAX_PENDING = 128;
const MAX_AGGREGATES = 512;
const MAX_RECENT_IDS = 512;
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
  independentVerified: boolean;
  validationAt?: number;
}

export interface MemoryTaskConditionedUtilityOutcome {
  probeId: string;
  memoryKeyHash: string;
  taskKeyHash: string;
  seed: number;
  replicate: number;
  withMemoryScore01: number;
  withoutMemoryScore01: number;
  delta01: number;
  inputTokenDelta: number;
  outputTokenDelta: number;
  retrievalLatencyDeltaMs: number;
  independentVerified: boolean;
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
  | { accepted: true; outcome: MemoryTaskConditionedUtilityOutcome; aggregate: MemoryTaskConditionedUtilityEstimate | null }
  | { accepted: false; reason: 'invalid-input' | 'probe-not-found' | 'validation-before-registration' };

const blank = (): MemoryTaskConditionedUtilityLedgerState => ({
  version: 1, registered: 0, resolved: 0, dropped: 0, unverifiedAttempts: 0,
  pending: [], aggregates: [], recentProbeIds: [],
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
  'scorerFingerprint' | 'fillerFingerprint'>): string {
  return sha256(JSON.stringify([
    probe.memoryKeyHash, probe.taskKeyHash, probe.holdoutFingerprint, probe.contextFingerprint,
    probe.readerFingerprint, probe.scorerFingerprint, probe.fillerFingerprint,
  ]));
}

function tCritical95(degreesOfFreedom: number): number {
  const smallSample = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
    2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
    2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  return smallSample[degreesOfFreedom] ?? 1.96;
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
 * Both arms must share the frozen task, immutable holdout, context, reader, scorer, filler,
 * insertion position and seed. The host must set independentVerified only after its separate
 * immutable-holdout verifier has checked the pair.
 */
export class MemoryTaskConditionedUtilityLedger {
  private state = blank();
  private readonly maxPending = MAX_PENDING;
  private readonly maxAggregates = MAX_AGGREGATES;
  private readonly maxRecentIds = MAX_RECENT_IDS;

  snapshot(): MemoryTaskConditionedUtilityLedgerState {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<MemoryTaskConditionedUtilityLedgerState> | null): void {
    const row = readDataEnvelope(raw, [
      'version', 'registered', 'resolved', 'dropped', 'unverifiedAttempts', 'pending', 'aggregates', 'recentProbeIds',
    ]);
    const rawPending = strictOwnArray(row?.pending, this.maxPending);
    const rawAggregates = strictOwnArray(row?.aggregates, this.maxAggregates);
    const rawRecentProbeIds = strictOwnArray(row?.recentProbeIds, this.maxRecentIds);
    if (!row || row.version !== 1 || !rawPending || !rawAggregates || !rawRecentProbeIds ||
        !finiteInteger(row.registered, Number.MAX_SAFE_INTEGER) ||
        !finiteInteger(row.resolved, Number.MAX_SAFE_INTEGER) ||
        !finiteInteger(row.dropped, Number.MAX_SAFE_INTEGER) ||
        !finiteInteger(row.unverifiedAttempts, Number.MAX_SAFE_INTEGER)) {
      this.state = blank();
      return;
    }

    const pending = rawPending.map(item => this.cleanProbe(item));
    const aggregates = rawAggregates.map(item => this.cleanAggregate(item));
    const recentProbeIds = rawRecentProbeIds.filter((id): id is string =>
      typeof id === 'string' && /^mtu:[a-f0-9]{64}$/.test(id));
    if (pending.some(item => item === null) || aggregates.some(item => item === null) ||
        recentProbeIds.length !== rawRecentProbeIds.length) {
      this.state = blank();
      return;
    }

    const validPending = pending as MemoryTaskConditionedUtilityProbe[];
    const validAggregates = aggregates as MemoryTaskConditionedUtilityAggregate[];
    if (new Set(validPending.map(item => item.id)).size !== validPending.length ||
        new Set(validAggregates.map(item => item.key)).size !== validAggregates.length ||
        validPending.some(item => recentProbeIds.includes(item.id))) {
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
      aggregates: validAggregates,
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
      'withoutMemoryRetrievalLatencyMs', 'independentVerified', 'validationAt',
    ]);
    if (!input || typeof input.probeId !== 'string' || !/^mtu:[a-f0-9]{64}$/.test(input.probeId) ||
        !score01(input.withMemoryScore01) || !score01(input.withoutMemoryScore01) ||
        !finiteInteger(input.withMemoryInputTokens, MAX_TOKENS) || !finiteInteger(input.withoutMemoryInputTokens, MAX_TOKENS) ||
        !finiteInteger(input.withMemoryOutputTokens, MAX_TOKENS) || !finiteInteger(input.withoutMemoryOutputTokens, MAX_TOKENS) ||
        typeof input.withMemoryRetrievalLatencyMs !== 'number' || !Number.isFinite(input.withMemoryRetrievalLatencyMs) ||
        input.withMemoryRetrievalLatencyMs < 0 || input.withMemoryRetrievalLatencyMs > MAX_LATENCY_MS ||
        typeof input.withoutMemoryRetrievalLatencyMs !== 'number' || !Number.isFinite(input.withoutMemoryRetrievalLatencyMs) ||
        input.withoutMemoryRetrievalLatencyMs < 0 || input.withoutMemoryRetrievalLatencyMs > MAX_LATENCY_MS ||
        typeof input.independentVerified !== 'boolean' ||
        (input.validationAt !== undefined && !finiteInteger(input.validationAt, Number.MAX_SAFE_INTEGER))) {
      return { accepted: false, reason: 'invalid-input' };
    }

    const validationAt = input.validationAt === undefined ? Date.now() : input.validationAt as number;
    this.pruneStale(validationAt);
    const index = this.state.pending.findIndex(item => item.id === input.probeId);
    if (index < 0) return { accepted: false, reason: 'probe-not-found' };
    const probe = this.state.pending[index]!;
    if (validationAt < probe.at) return { accepted: false, reason: 'validation-before-registration' };

    const outcome: MemoryTaskConditionedUtilityOutcome = {
      probeId: probe.id, memoryKeyHash: probe.memoryKeyHash, taskKeyHash: probe.taskKeyHash,
      seed: probe.seed, replicate: probe.replicate,
      withMemoryScore01: input.withMemoryScore01 as number,
      withoutMemoryScore01: input.withoutMemoryScore01 as number,
      delta01: (input.withMemoryScore01 as number) - (input.withoutMemoryScore01 as number),
      inputTokenDelta: (input.withMemoryInputTokens as number) - (input.withoutMemoryInputTokens as number),
      outputTokenDelta: (input.withMemoryOutputTokens as number) - (input.withoutMemoryOutputTokens as number),
      retrievalLatencyDeltaMs: (input.withMemoryRetrievalLatencyMs as number) - (input.withoutMemoryRetrievalLatencyMs as number),
      independentVerified: input.independentVerified as boolean,
      at: validationAt,
    };

    if (!outcome.independentVerified) {
      this.state.unverifiedAttempts++;
      return { accepted: true, outcome, aggregate: null };
    }

    this.state.pending.splice(index, 1);
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
      'memoryId', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint', 'scorerFingerprint', 'fillerFingerprint',
    ]);
    if (!input || !safeIdentity(input.memoryId) || !digest(input.taskKeyHash) || !digest(input.holdoutFingerprint) ||
        !digest(input.contextFingerprint) || !digest(input.readerFingerprint) || !digest(input.scorerFingerprint) ||
        !digest(input.fillerFingerprint)) return null;
    const probe = {
      memoryKeyHash: sha256('nk1-memory-task-utility-v1\0' + input.memoryId),
      taskKeyHash: (input.taskKeyHash as string).toLowerCase(),
      holdoutFingerprint: (input.holdoutFingerprint as string).toLowerCase(),
      contextFingerprint: (input.contextFingerprint as string).toLowerCase(),
      readerFingerprint: (input.readerFingerprint as string).toLowerCase(),
      scorerFingerprint: (input.scorerFingerprint as string).toLowerCase(),
      fillerFingerprint: (input.fillerFingerprint as string).toLowerCase(),
    };
    const aggregate = this.state.aggregates.find(item => item.key === aggregateKey(probe as MemoryTaskConditionedUtilityProbe));
    return aggregate ? estimate(aggregate) : null;
  }

  diagnostics() {
    return {
      version: 1, registered: this.state.registered, resolved: this.state.resolved,
      dropped: this.state.dropped, unverifiedAttempts: this.state.unverifiedAttempts,
      pending: this.state.pending.length, aggregates: this.state.aggregates.length,
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

  private cleanAggregate(raw: unknown): MemoryTaskConditionedUtilityAggregate | null {
    const row = readDataEnvelope(raw, [
      'key', 'memoryKeyHash', 'taskKeyHash', 'holdoutFingerprint', 'contextFingerprint', 'readerFingerprint',
      'scorerFingerprint', 'fillerFingerprint', 'samples', 'meanDelta01', 'm2Delta01',
      'positiveCount', 'negativeCount', 'meanFormationCostTokens', 'meanStorageBytes',
      'meanInputTokenDelta', 'meanOutputTokenDelta', 'meanRetrievalLatencyDeltaMs', 'lastVerifiedAt',
    ]);
    if (!row || !digest(row.key) || !digest(row.memoryKeyHash) || !digest(row.taskKeyHash) ||
        !digest(row.holdoutFingerprint) || !digest(row.contextFingerprint) || !digest(row.readerFingerprint) ||
        !digest(row.scorerFingerprint) || !digest(row.fillerFingerprint) ||
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
