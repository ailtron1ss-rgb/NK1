/**
 * P25 Adaptive Synaptic Matrix.
 *
 * Keeps adapter selection separate from backend/provider ecology. The matrix
 * stores metadata and validation receipts only; model weights remain host-owned.
 * A task adapter is eligible only after a host-trusted signature verifier accepts
 * its offline holdout manifest and an adapter-capable executor is explicitly wired.
 */
export const SYNAPTIC_ADAPTER_TASKS = ['language', 'reasoning', 'planning', 'vision', 'audio'] as const;
export type SynapticAdapterTask = typeof SYNAPTIC_ADAPTER_TASKS[number];
export type SynapticAdapterFormat = 'lora' | 'qlora';
export type SynapticAdapterStatus = 'candidate' | 'active' | 'disabled' | 'quarantined';

export interface SynapticAdapterCandidate {
  id: string;
  artifactRef: string;
  artifactSha256: string;
  adapterFormat: SynapticAdapterFormat;
  rank: number;
  baseModelId: string;
  baseModelRevisionSha256: string;
  tasks: SynapticAdapterTask[];
  competenceByTask01: Partial<Record<SynapticAdapterTask, number>>;
  conflictGroup: string;
  minimumConfidence01: number;
  maximumResourceRisk01: number;
  maximumUncertainty01: number;
  maximumContextTokens: number;
  trainingDatasetRef: string;
  owner: string;
}

export interface SynapticAdapterValidationEvidence {
  reportId: string;
  reportSha256: string;
  holdoutDatasetRef: string;
  pairedSeeds: number;
  baselineScore01: number;
  adapterScore01: number;
  lower95Delta01: number;
  guardrailRegressionCount: number;
}

export interface SynapticAdapterActivationManifest extends SynapticAdapterCandidate {
  validation: SynapticAdapterValidationEvidence;
  signerKeyId: string;
  signature: string;
}

export type SynapticAdapterManifestVerifier = (
  canonicalPayload: string,
  signature: string,
  signerKeyId: string,
) => boolean;

export interface SynapticAdapterRecord {
  candidate: SynapticAdapterCandidate;
  status: SynapticAdapterStatus;
  manifest?: SynapticAdapterActivationManifest;
  cooldownUntil: number;
  consecutiveFailures: number;
  selections: number;
  failures: number;
  averageLatencyMs: number;
  lastErrorAt: number;
  /** Last accepted report digest captured when the profile entered quarantine. */
  quarantineReportSha256?: string;
  /** Ordered, single-use validation reports. Entries are never evicted. */
  acceptedReportSha256s: string[];
  /** Monotonic number of accepted reports represented by this ledger. */
  acceptedReportCount: number;
  /** SHA-256 commitment to the complete ordered report digest sequence. */
  acceptedReportHistorySha256: string;
  /** Incomplete/corrupt history disables activation until a trusted migration. */
  activationHistorySaturated?: boolean;
}

export interface SynapticMatrixDecision {
  task: SynapticAdapterTask;
  mode: 'adapter' | 'base-fallback';
  reason: string;
  adapterId?: string;
  score01: number;
  at: number;
}

export interface AdaptiveSynapticMatrixState {
  version: 1;
  adapters: SynapticAdapterRecord[];
  decisions: SynapticMatrixDecision[];
  metrics: {
    routeDecisions: number;
    adapterSelections: number;
    baseFallbacks: number;
    canonicalRegistryFallbacks: number;
    adapterFailures: number;
  };
}

export interface SynapticAdapterRoutingInput {
  task: SynapticAdapterTask;
  baseModelId?: string;
  baseModelRevisionSha256?: string;
  contextTokens: number;
  confidence01: number;
  uncertainty01: number;
  resourceRisk01: number;
  executorAvailable: boolean;
}

export type SynapticAdapterSelection =
  | {
      mode: 'adapter';
      reason: 'validated-specialist-fit';
      adapterId: string;
      adapterIds: [string];
      score01: number;
      adapter: SynapticAdapterCandidate;
    }
  | {
      mode: 'base-fallback';
      reason: string;
      adapterIds: [];
      score01: 0;
    };

const MAX_ADAPTERS = 32;
const MAX_DECISIONS = 128;
export const MAX_ACCEPTED_SYNAPTIC_REPORTS_PER_ADAPTER = 64;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const clamp01 = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort()
    .filter(key => record[key] !== undefined)
    .map(key => JSON.stringify(key) + ':' + canonicalJson(record[key]))
    .join(',') + '}';
}

/** Deterministic local commitment; external replay anchors authenticate monotonic history across restores. */
export function synapticReplayHistoryCommitment(digests: readonly string[]): string {
  return createHash('sha256')
    .update('nk1-p25-report-history:v1:')
    .update(canonicalJson(digests.map(digest => digest.toLowerCase())))
    .digest('hex');
}

export interface SynapticReplayAnchorState {
  acceptedReportCount: number;
  acceptedReportHistorySha256: string;
}

/**
 * Host-owned, rollback-resistant ledger anchor. Implementations must use an atomic
 * compare-and-swap in a separately protected store (for example a transactional DB
 * with monotonic constraints); a second JSON file on the same writable disk is not
 * a trusted anchor.
 */
export interface SynapticReplayAnchorStore {
  read(adapterId: string): Promise<SynapticReplayAnchorState | null>;
  compareAndSwap(
    adapterId: string,
    expected: SynapticReplayAnchorState | null,
    next: SynapticReplayAnchorState & { latestReportSha256: string },
  ): Promise<boolean>;
}


function normalizeCandidate(raw: SynapticAdapterCandidate): SynapticAdapterCandidate {
  if (!raw || typeof raw !== 'object') throw new Error('synaptic-adapter-candidate-invalid');
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const artifactRef = typeof raw.artifactRef === 'string' ? raw.artifactRef.trim() : '';
  const baseModelId = typeof raw.baseModelId === 'string' ? raw.baseModelId.trim() : '';
  const conflictGroup = typeof raw.conflictGroup === 'string' ? raw.conflictGroup.trim() : '';
  const trainingDatasetRef = typeof raw.trainingDatasetRef === 'string' ? raw.trainingDatasetRef.trim() : '';
  const owner = typeof raw.owner === 'string' ? raw.owner.trim() : '';
  const tasks = Array.isArray(raw.tasks)
    ? [...new Set(raw.tasks)].filter((task): task is SynapticAdapterTask =>
        (SYNAPTIC_ADAPTER_TASKS as readonly string[]).includes(task)).sort()
    : [];
  if (!Array.isArray(raw.tasks) || tasks.length !== raw.tasks.length) throw new Error('synaptic-adapter-tasks-invalid');
  if (!/^[a-z0-9][a-z0-9._:-]{1,79}$/i.test(id)) throw new Error('synaptic-adapter-id-invalid');
  if (!/^(file|https?|oci|s3):[^\s]{1,500}$/i.test(artifactRef) || /(^|[\\/])\.\.([\\/]|$)/.test(artifactRef)) throw new Error('synaptic-adapter-artifact-ref-invalid');
  if (typeof raw.artifactSha256 !== 'string' || !HASH_PATTERN.test(raw.artifactSha256)) throw new Error('synaptic-adapter-artifact-sha256-invalid');
  if (raw.adapterFormat !== 'lora' && raw.adapterFormat !== 'qlora') throw new Error('synaptic-adapter-format-invalid');
  if (!Number.isSafeInteger(raw.rank) || raw.rank < 1 || raw.rank > 256) throw new Error('synaptic-adapter-rank-invalid');
  if (!baseModelId || baseModelId.length > 160) throw new Error('synaptic-adapter-base-model-invalid');
  if (typeof raw.baseModelRevisionSha256 !== 'string' || !HASH_PATTERN.test(raw.baseModelRevisionSha256)) throw new Error('synaptic-adapter-base-model-sha256-invalid');
  if (tasks.length === 0 || tasks.length > SYNAPTIC_ADAPTER_TASKS.length) throw new Error('synaptic-adapter-tasks-invalid');
  if (!conflictGroup || conflictGroup.length > 120) throw new Error('synaptic-adapter-conflict-group-invalid');
  if (!trainingDatasetRef || trainingDatasetRef.length > 240) throw new Error('synaptic-adapter-training-dataset-ref-invalid');
  if (!owner || owner.length > 120) throw new Error('synaptic-adapter-owner-invalid');
  const maximumContextTokens = raw.maximumContextTokens;
  if (!Number.isSafeInteger(maximumContextTokens) || maximumContextTokens < 128 || maximumContextTokens > 1_000_000) {
    throw new Error('synaptic-adapter-context-limit-invalid');
  }
  const minimumConfidence01 = raw.minimumConfidence01;
  const maximumResourceRisk01 = raw.maximumResourceRisk01;
  const maximumUncertainty01 = raw.maximumUncertainty01;
  if (!Number.isFinite(minimumConfidence01) || minimumConfidence01 < 0 || minimumConfidence01 > 1) {
    throw new Error('synaptic-adapter-minimum-confidence-invalid');
  }
  if (!Number.isFinite(maximumResourceRisk01) || maximumResourceRisk01 < 0 || maximumResourceRisk01 > 1) {
    throw new Error('synaptic-adapter-resource-risk-invalid');
  }
  if (!Number.isFinite(maximumUncertainty01) || maximumUncertainty01 < 0 || maximumUncertainty01 > 1) {
    throw new Error('synaptic-adapter-uncertainty-limit-invalid');
  }
  const competenceByTask01: Partial<Record<SynapticAdapterTask, number>> = {};
  for (const task of tasks) {
    const score = raw.competenceByTask01?.[task];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) throw new Error('synaptic-adapter-competence-invalid');
    competenceByTask01[task] = score;
  }
  return {
    id, artifactRef, artifactSha256: String(raw.artifactSha256).toLowerCase(),
    adapterFormat: raw.adapterFormat, rank: raw.rank, baseModelId,
    baseModelRevisionSha256: String(raw.baseModelRevisionSha256).toLowerCase(),
    tasks, competenceByTask01, conflictGroup, minimumConfidence01,
    maximumResourceRisk01, maximumUncertainty01, maximumContextTokens, trainingDatasetRef, owner,
  };
}

function normalizeValidation(raw: SynapticAdapterValidationEvidence, trainingDatasetRef: string): SynapticAdapterValidationEvidence {
  if (!raw || typeof raw !== 'object') throw new Error('synaptic-adapter-validation-evidence-required');
  const reportId = typeof raw.reportId === 'string' ? raw.reportId.trim() : '';
  const reportSha256 = typeof raw.reportSha256 === 'string' ? raw.reportSha256.toLowerCase() : '';
  const holdoutDatasetRef = typeof raw.holdoutDatasetRef === 'string' ? raw.holdoutDatasetRef.trim() : '';
  const pairedSeeds = raw.pairedSeeds;
  const baselineScore01 = raw.baselineScore01;
  const adapterScore01 = raw.adapterScore01;
  const lower95Delta01 = raw.lower95Delta01;
  const guardrailRegressionCount = raw.guardrailRegressionCount;
  if (!reportId || reportId.length > 160 || !HASH_PATTERN.test(reportSha256)) {
    throw new Error('synaptic-adapter-validation-report-invalid');
  }
  if (!holdoutDatasetRef || holdoutDatasetRef.length > 240 || holdoutDatasetRef === trainingDatasetRef) {
    throw new Error('synaptic-adapter-training-and-holdout-must-be-disjoint');
  }
  if (typeof pairedSeeds !== 'number' || !Number.isSafeInteger(pairedSeeds) || pairedSeeds < 5) throw new Error('synaptic-adapter-paired-seed-evidence-insufficient');
  if (typeof baselineScore01 !== 'number' || !Number.isFinite(baselineScore01) || baselineScore01 < 0 || baselineScore01 > 1
    || typeof adapterScore01 !== 'number' || !Number.isFinite(adapterScore01) || adapterScore01 < 0 || adapterScore01 > 1
    || typeof lower95Delta01 !== 'number' || !Number.isFinite(lower95Delta01) || lower95Delta01 < -1 || lower95Delta01 > 1) {
    throw new Error('synaptic-adapter-validation-score-invalid');
  }
  if (adapterScore01 <= baselineScore01 || lower95Delta01 <= 0) {
    throw new Error('synaptic-adapter-holdout-improvement-not-established');
  }
  if (typeof guardrailRegressionCount !== 'number' || !Number.isSafeInteger(guardrailRegressionCount) || guardrailRegressionCount !== 0) {
    throw new Error('synaptic-adapter-guardrail-regression-detected');
  }
  return { reportId, reportSha256, holdoutDatasetRef, pairedSeeds, baselineScore01, adapterScore01, lower95Delta01, guardrailRegressionCount };
}

function normalizeManifest(raw: SynapticAdapterActivationManifest): SynapticAdapterActivationManifest {
  const candidate = normalizeCandidate(raw);
  const validation = normalizeValidation(raw.validation, candidate.trainingDatasetRef);
  const signerKeyId = typeof raw.signerKeyId === 'string' ? raw.signerKeyId.trim() : '';
  const signature = typeof raw.signature === 'string' ? raw.signature.trim() : '';
  if (!signerKeyId || signerKeyId.length > 160 || !signature || signature.length > 4096) {
    throw new Error('synaptic-adapter-manifest-signature-required');
  }
  return { ...candidate, validation, signerKeyId, signature };
}

export function synapticAdapterManifestPayload(manifest: SynapticAdapterActivationManifest): string {
  const normalized = normalizeManifest(manifest);
  const { signature: _signature, ...payload } = normalized;
  return canonicalJson(payload);
}

function sameCandidate(a: SynapticAdapterCandidate, b: SynapticAdapterCandidate): boolean {
  return canonicalJson(normalizeCandidate(a)) === canonicalJson(normalizeCandidate(b));
}

function emptyState(): AdaptiveSynapticMatrixState {
  return {
    version: 1,
    adapters: [],
    decisions: [],
    metrics: { routeDecisions: 0, adapterSelections: 0, baseFallbacks: 0, canonicalRegistryFallbacks: 0, adapterFailures: 0 },
  };
}

export class AdaptiveSynapticMatrixEngine {
  private state = emptyState();

  registerCandidate(raw: SynapticAdapterCandidate): SynapticAdapterRecord {
    const candidate = normalizeCandidate(raw);
    const existing = this.state.adapters.find(entry => entry.candidate.id === candidate.id);
    if (existing) {
      if (!sameCandidate(existing.candidate, candidate)) {
        throw new Error('synaptic-adapter-id-collision');
      }
      return structuredClone(existing);
    }
    if (this.state.adapters.length >= MAX_ADAPTERS) throw new Error('synaptic-adapter-registry-capacity-reached');
    const record: SynapticAdapterRecord = {
      candidate, status: 'candidate', cooldownUntil: 0, consecutiveFailures: 0,
      selections: 0, failures: 0, averageLatencyMs: 0, lastErrorAt: 0,
      acceptedReportSha256s: [],
      acceptedReportCount: 0,
      acceptedReportHistorySha256: synapticReplayHistoryCommitment([]),
    };
    this.state.adapters.push(record);
    return structuredClone(record);
  }

  activateValidated(
    raw: SynapticAdapterActivationManifest,
    verify: SynapticAdapterManifestVerifier,
  ): SynapticAdapterRecord {
    const manifest = normalizeManifest(raw);
    const record = this.state.adapters.find(entry => entry.candidate.id === manifest.id);
    if (!record || !sameCandidate(record.candidate, manifest)) throw new Error('synaptic-adapter-candidate-manifest-mismatch');
    const reportSha256 = manifest.validation.reportSha256;
    const quarantinedReportSha256 = record.quarantineReportSha256
      ?? (record.status === 'quarantined' ? record.manifest?.validation.reportSha256 : undefined);
    if (quarantinedReportSha256 === reportSha256) {
      throw new Error('synaptic-adapter-revalidation-required-after-quarantine');
    }
    if (record.activationHistorySaturated) {
      throw new Error('synaptic-adapter-activation-history-capacity-reached');
    }
    if (record.acceptedReportSha256s.includes(reportSha256)) {
      throw new Error('synaptic-adapter-validation-report-replay');
    }
    if (record.acceptedReportSha256s.length >= MAX_ACCEPTED_SYNAPTIC_REPORTS_PER_ADAPTER) {
      throw new Error('synaptic-adapter-activation-history-capacity-reached');
    }
    if (typeof verify !== 'function') throw new Error('synaptic-adapter-manifest-verifier-required');
    let verified = false;
    try {
      verified = verify(synapticAdapterManifestPayload(manifest), manifest.signature, manifest.signerKeyId) === true;
    } catch {
      verified = false;
    }
    if (!verified) throw new Error('synaptic-adapter-manifest-signature-verification-failed');
    record.status = 'active';
    record.manifest = structuredClone(manifest);
    record.acceptedReportSha256s.push(reportSha256);
    record.acceptedReportCount = record.acceptedReportSha256s.length;
    record.acceptedReportHistorySha256 = synapticReplayHistoryCommitment(record.acceptedReportSha256s);
    delete record.quarantineReportSha256;
    record.cooldownUntil = 0;
    record.consecutiveFailures = 0;
    return structuredClone(record);
  }

  disable(id: string): SynapticAdapterRecord | null {
    const record = this.state.adapters.find(entry => entry.candidate.id === id);
    if (!record) return null;
    if (record.status === 'quarantined') {
      // Manual disable must preserve the stronger quarantine anti-replay gate.
      record.quarantineReportSha256 ??= record.manifest?.validation.reportSha256;
    }
    record.status = 'disabled';
    record.cooldownUntil = 0;
    return structuredClone(record);
  }

  select(input: SynapticAdapterRoutingInput, now = Date.now()): SynapticAdapterSelection {
    const fallback = (reason: string): SynapticAdapterSelection => {
      this.state.metrics.routeDecisions += 1;
      this.state.metrics.baseFallbacks += 1;
      this.state.decisions.unshift({ task: input.task, mode: 'base-fallback', reason, score01: 0, at: now });
      this.trimDecisions();
      return { mode: 'base-fallback', reason, adapterIds: [], score01: 0 };
    };
    if (input.executorAvailable !== true) return fallback('adapter-executor-unavailable');
    if (!(SYNAPTIC_ADAPTER_TASKS as readonly string[]).includes(input.task)) return fallback('routing-task-invalid');
    if (![input.confidence01, input.uncertainty01, input.resourceRisk01].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
      return fallback('routing-signal-invalid');
    }
    if (!input.baseModelId || !HASH_PATTERN.test(String(input.baseModelRevisionSha256 ?? ''))) {
      return fallback('base-model-identity-unavailable');
    }
    if (!Number.isSafeInteger(input.contextTokens) || input.contextTokens < 0) return fallback('context-token-count-invalid');

    const confidence = input.confidence01;
    const uncertainty = input.uncertainty01;
    const resourceRisk = input.resourceRisk01;
    const scored = this.state.adapters
      .filter(entry => entry.status === 'active' && entry.cooldownUntil <= now)
      .filter(entry => {
        const profile = entry.candidate;
        return profile.baseModelId === input.baseModelId
          && profile.baseModelRevisionSha256 === String(input.baseModelRevisionSha256).toLowerCase()
          && profile.tasks.includes(input.task)
          && input.contextTokens <= profile.maximumContextTokens
          && confidence >= profile.minimumConfidence01
          && uncertainty <= profile.maximumUncertainty01
          && resourceRisk <= profile.maximumResourceRisk01;
      })
      .map(entry => {
        const competence = clamp01(entry.candidate.competenceByTask01[input.task]);
        const score01 = clamp01(
          competence * 0.60
          + confidence * 0.15
          + (1 - uncertainty) * 0.15
          + (1 - resourceRisk) * 0.10,
        );
        return { entry, score01 };
      })
      .sort((a, b) => b.score01 - a.score01 || a.entry.candidate.id.localeCompare(b.entry.candidate.id));

    if (scored.length === 0) return fallback('no-compatible-validated-adapter');
    const winner = scored[0];
    if (winner.score01 < 0.68) return fallback('specialist-confidence-below-route-threshold');
    // Compare against the strongest competitor in the winner's conflict group,
    // not merely the global runner-up: another group may sit between two
    // semantically conflicting specialists in the sorted score list.
    const sameGroupRunnerUp = scored.slice(1).find(
      item => item.entry.candidate.conflictGroup === winner.entry.candidate.conflictGroup,
    );
    if (sameGroupRunnerUp && winner.score01 - sameGroupRunnerUp.score01 < 0.05) {
      return fallback('ambiguous-adapter-competition');
    }

    winner.entry.selections += 1;
    this.state.metrics.routeDecisions += 1;
    this.state.metrics.adapterSelections += 1;
    this.state.decisions.unshift({
      task: input.task, mode: 'adapter', reason: 'validated-specialist-fit',
      adapterId: winner.entry.candidate.id, score01: winner.score01, at: now,
    });
    this.trimDecisions();
    return {
      mode: 'adapter',
      reason: 'validated-specialist-fit',
      adapterId: winner.entry.candidate.id,
      adapterIds: [winner.entry.candidate.id],
      score01: winner.score01,
      adapter: structuredClone(winner.entry.candidate),
    };
  }

  /**
   * Record a policy/canonical-registry disagreement without treating the
   * canonical fallback as a failed adapter execution. The canonical provider
   * has already returned the base-model response, so the caller must not retry
   * the base invoker a second time.
   */
  recordCanonicalFallback(
    task: SynapticAdapterTask,
    adapterId: string,
    reason: string,
    now = Date.now(),
  ): void {
    const safeAdapterId = String(adapterId ?? '').trim().slice(0, 80);
    const safeReason = String(reason ?? 'canonical-selection-mismatch').trim().slice(0, 120)
      || 'canonical-selection-mismatch';
    this.state.metrics.routeDecisions += 1;
    this.state.metrics.baseFallbacks += 1;
    this.state.metrics.canonicalRegistryFallbacks += 1;
    this.state.decisions.unshift({
      task,
      mode: 'base-fallback',
      reason: 'canonical-registry:' + safeReason,
      ...(safeAdapterId ? { adapterId: safeAdapterId } : {}),
      score01: 0,
      at: now,
    });
    this.trimDecisions();
  }

  observe(id: string, success: boolean, latencyMs: number, now = Date.now()): void {
    const record = this.state.adapters.find(entry => entry.candidate.id === id && entry.status === 'active');
    if (!record) return;
    const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.min(300_000, latencyMs)) : 0;
    record.averageLatencyMs = record.selections <= 1
      ? latency
      : record.averageLatencyMs * 0.8 + latency * 0.2;
    if (success) {
      record.consecutiveFailures = 0;
      record.cooldownUntil = 0;
      return;
    }
    record.failures += 1;
    record.consecutiveFailures += 1;
    record.lastErrorAt = now;
    this.state.metrics.adapterFailures += 1;
    if (record.consecutiveFailures >= 6) {
      // Repeated failure across escalating cooldowns requires an explicit, newly
      // verified activation instead of silently returning to inference.
      record.quarantineReportSha256 = record.manifest?.validation.reportSha256;
      record.status = 'quarantined';
      record.cooldownUntil = 0;
      return;
    }
    if (record.consecutiveFailures >= 2) {
      const cooldownMs = Math.min(15 * 60_000, 60_000 * (2 ** Math.min(4, record.consecutiveFailures - 2)));
      record.cooldownUntil = now + cooldownMs;
    }
  }

  restore(raw?: Partial<AdaptiveSynapticMatrixState> | null, verify?: SynapticAdapterManifestVerifier): void {
    const next = emptyState();
    const source = raw && raw.version === 1 && Array.isArray(raw.adapters) ? raw.adapters.slice(0, MAX_ADAPTERS) : [];
    for (const item of source) {
      try {
        const candidate = normalizeCandidate(item.candidate);
        if (next.adapters.some(entry => entry.candidate.id === candidate.id)) continue;
        const hasPersistedReportHistory = Array.isArray(item.acceptedReportSha256s);
        const rawReportHistory = hasPersistedReportHistory ? item.acceptedReportSha256s : [];
        // Never scan an unbounded attacker-controlled history array during restore.
        const boundedReportHistory = rawReportHistory.slice(0, MAX_ACCEPTED_REPORTS_PER_ADAPTER);
        const validReportHistory = boundedReportHistory
          .filter((digest): digest is string => typeof digest === 'string' && HASH_PATTERN.test(digest))
          .map(digest => digest.toLowerCase());
        const uniqueReportHistory = [...new Set(validReportHistory)];
        const reportHistoryCorrupt = rawReportHistory.length > MAX_ACCEPTED_REPORTS_PER_ADAPTER
          || rawReportHistory.length !== validReportHistory.length
          || uniqueReportHistory.length !== validReportHistory.length;
        const persistedReportCount = typeof item.acceptedReportCount === 'number'
          && Number.isSafeInteger(item.acceptedReportCount) && item.acceptedReportCount >= 0
          ? item.acceptedReportCount : null;
        const persistedHistoryCommitment = typeof item.acceptedReportHistorySha256 === 'string'
          && HASH_PATTERN.test(item.acceptedReportHistorySha256)
          ? item.acceptedReportHistorySha256.toLowerCase() : null;
        const currentHistoryCommitment = synapticReplayHistoryCommitment(uniqueReportHistory);
        const reportHistoryEvidencePresent = rawReportHistory.length > 0 || Boolean(item.manifest)
          || (persistedReportCount !== null && persistedReportCount > 0)
          || (persistedHistoryCommitment !== null
            && persistedHistoryCommitment !== synapticReplayHistoryCommitment([]));
        const reportHistoryIntegrityMissing = reportHistoryEvidencePresent
          && (persistedReportCount === null || persistedHistoryCommitment === null
            || persistedReportCount !== uniqueReportHistory.length
            || persistedHistoryCommitment !== currentHistoryCommitment);
        const restored: SynapticAdapterRecord = {
          candidate,
          status: item.status === 'disabled' || item.status === 'quarantined' ? item.status : 'candidate',
          cooldownUntil: Number.isFinite(Number(item.cooldownUntil)) ? Math.max(0, Number(item.cooldownUntil)) : 0,
          consecutiveFailures: Number.isSafeInteger(item.consecutiveFailures) ? Math.max(0, item.consecutiveFailures) : 0,
          selections: Number.isSafeInteger(item.selections) ? Math.max(0, item.selections) : 0,
          failures: Number.isSafeInteger(item.failures) ? Math.max(0, item.failures) : 0,
          averageLatencyMs: Number.isFinite(Number(item.averageLatencyMs)) ? Math.max(0, Number(item.averageLatencyMs)) : 0,
          lastErrorAt: Number.isFinite(Number(item.lastErrorAt)) ? Math.max(0, Number(item.lastErrorAt)) : 0,
          acceptedReportSha256s: uniqueReportHistory,
          acceptedReportCount: persistedReportCount ?? uniqueReportHistory.length,
          acceptedReportHistorySha256: persistedHistoryCommitment ?? currentHistoryCommitment,
          ...(item.activationHistorySaturated === true || reportHistoryCorrupt || reportHistoryIntegrityMissing ||
              (!hasPersistedReportHistory && Boolean(item.manifest))
            ? { activationHistorySaturated: true }
            : {}),
          ...(typeof item.quarantineReportSha256 === 'string' && HASH_PATTERN.test(item.quarantineReportSha256)
            ? { quarantineReportSha256: item.quarantineReportSha256.toLowerCase() }
            : {}),
        };

        // A modern snapshot must include its last accepted report in the ledger.
        // Older snapshots can recover only the last stored manifest digest and
        // are marked saturated because earlier activations cannot be reconstructed.
        if (item.manifest) {
          try {
            const priorManifest = normalizeManifest(item.manifest as SynapticAdapterActivationManifest);
            if (sameCandidate(candidate, priorManifest)) {
              const priorDigest = priorManifest.validation.reportSha256;
              if (!restored.acceptedReportSha256s.includes(priorDigest)) {
                if (hasPersistedReportHistory) {
                  restored.activationHistorySaturated = true;
                }
                if (restored.acceptedReportSha256s.length < MAX_ACCEPTED_REPORTS_PER_ADAPTER) {
                  restored.acceptedReportSha256s.push(priorDigest);
                } else {
                  restored.activationHistorySaturated = true;
                }
              }
              if (item.status === 'quarantined' && !restored.quarantineReportSha256) {
                restored.quarantineReportSha256 = priorDigest;
              }
            }
          } catch {
            if (item.status === 'active' || item.status === 'disabled' || item.status === 'quarantined') {
              restored.activationHistorySaturated = true;
            }
          }
        }
        // Snapshots from the first P25 ledger release lack a count/commitment.
        // Carry their observed entries forward, but do not claim their history is complete.
        if (persistedReportCount === null || persistedHistoryCommitment === null) {
          restored.acceptedReportCount = restored.acceptedReportSha256s.length;
          restored.acceptedReportHistorySha256 = synapticReplayHistoryCommitment(restored.acceptedReportSha256s);
        }
        if (item.status === 'quarantined' && !restored.quarantineReportSha256) {
          // Without the last accepted receipt the quarantine cannot be cleared safely.
          restored.activationHistorySaturated = true;
        }
        if (item.status === 'active') {
          try {
            const manifest = normalizeManifest(item.manifest as SynapticAdapterActivationManifest);
            const payloadMatches = sameCandidate(candidate, manifest);
            const signatureValid = typeof verify === 'function'
              && verify(synapticAdapterManifestPayload(manifest), manifest.signature, manifest.signerKeyId) === true;
            if (payloadMatches && signatureValid && !restored.activationHistorySaturated) {
              restored.status = 'active';
              restored.manifest = manifest;
            } else {
              restored.status = 'quarantined';
              restored.manifest = manifest;
              restored.quarantineReportSha256 ??= manifest.validation.reportSha256;
            }
          } catch {
            restored.status = 'quarantined';
            restored.activationHistorySaturated = true;
          }
        }
        next.adapters.push(restored);
      } catch {
        // Malformed persisted records are ignored rather than becoming routable.
      }
    }
    next.decisions = Array.isArray(raw?.decisions)
      ? raw!.decisions.filter(row => row && (row.mode === 'adapter' || row.mode === 'base-fallback')
        && (SYNAPTIC_ADAPTER_TASKS as readonly string[]).includes(row.task)
        && typeof row.reason === 'string').slice(0, MAX_DECISIONS).map(row => ({
          task: row.task,
          mode: row.mode,
          reason: String(row.reason).slice(0, 120),
          ...(typeof row.adapterId === 'string' && /^[a-z0-9][a-z0-9._:-]{1,79}$/i.test(row.adapterId) ? { adapterId: row.adapterId } : {}),
          score01: Number.isFinite(row.score01) ? clamp01(row.score01) : 0,
          at: Number.isFinite(row.at) && row.at >= 0 ? row.at : 0,
        }))
      : [];
    const metrics: AdaptiveSynapticMatrixState['metrics'] = raw?.metrics ?? emptyState().metrics;
    next.metrics = {
      routeDecisions: Number.isSafeInteger(metrics.routeDecisions) ? Math.max(0, metrics.routeDecisions) : 0,
      adapterSelections: Number.isSafeInteger(metrics.adapterSelections) ? Math.max(0, metrics.adapterSelections) : 0,
      baseFallbacks: Number.isSafeInteger(metrics.baseFallbacks) ? Math.max(0, metrics.baseFallbacks) : 0,
      canonicalRegistryFallbacks: Number.isSafeInteger(metrics.canonicalRegistryFallbacks) ? Math.max(0, metrics.canonicalRegistryFallbacks) : 0,
      adapterFailures: Number.isSafeInteger(metrics.adapterFailures) ? Math.max(0, metrics.adapterFailures) : 0,
    };
    this.state = next;
  }

  replayAnchorState(adapterId: string): SynapticReplayAnchorState | null {
    const record = this.state.adapters.find(entry => entry.candidate.id === adapterId);
    if (!record) return null;
    return {
      acceptedReportCount: record.acceptedReportCount,
      acceptedReportHistorySha256: record.acceptedReportHistorySha256,
    };
  }

  reconcileReplayAnchor(adapterId: string, anchor: SynapticReplayAnchorState | null): boolean {
    const record = this.state.adapters.find(entry => entry.candidate.id === adapterId);
    if (!record) return false;
    const local = this.replayAnchorState(adapterId);
    const validAnchor = anchor === null || (
      Number.isSafeInteger(anchor.acceptedReportCount) &&
      anchor.acceptedReportCount >= 0 &&
      anchor.acceptedReportCount <= MAX_ACCEPTED_SYNAPTIC_REPORTS_PER_ADAPTER &&
      typeof anchor.acceptedReportHistorySha256 === 'string' &&
      HASH_PATTERN.test(anchor.acceptedReportHistorySha256)
    );
    const emptyCommitment = synapticReplayHistoryCommitment([]);
    const anchorCount = anchor?.acceptedReportCount ?? 0;
    const anchorDigest = anchor?.acceptedReportHistorySha256 ?? emptyCommitment;
    const matches = validAnchor && local !== null &&
      local.acceptedReportCount === anchorCount &&
      local.acceptedReportHistorySha256 === anchorDigest &&
      (anchor !== null || local.acceptedReportCount === 0);
    if (matches) return true;
    this.markReplayAnchorUntrusted(adapterId);
    return false;
  }

  markReplayAnchorUntrusted(adapterId: string): SynapticAdapterRecord | null {
    const record = this.state.adapters.find(entry => entry.candidate.id === adapterId);
    if (!record) return null;
    record.activationHistorySaturated = true;
    record.status = 'quarantined';
    record.quarantineReportSha256 ??= record.manifest?.validation.reportSha256;
    record.cooldownUntil = 0;
    return structuredClone(record);
  }

  snapshot(): AdaptiveSynapticMatrixState {
    return structuredClone(this.state);
  }

  private trimDecisions(): void {
    this.state.decisions = this.state.decisions.slice(0, MAX_DECISIONS);
  }
}
