import { createHash } from 'node:crypto';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

export type NeuroPlasticMethod = 'lora' | 'qlora';
export type NeuroPlasticAdapterStatus = 'staged' | 'eligible' | 'active' | 'disabled' | 'rejected';

export interface NeuroPlasticAdapterManifest {
  schemaVersion: 1;
  adapterId: string;
  domain: string;
  method: NeuroPlasticMethod;
  baseModel: {
    id: string;
    backendId: string;
    servedModelAlias: string;
    fingerprint: string;
  };
  tokenizerFingerprint: string;
  sourceDatasetFingerprint: string;
  holdoutPlanFingerprint: string;
  corpusFingerprint: string;
  artifact: {
    directory: string;
    configSha256: string;
    weightsSha256: string;
    totalBytes: number;
  };
  trainer: { name: string; version: string; seed: number; completedAt: number };
  governance: {
    trainingOptIn: true;
    privacyReviewed: true;
    licenseApproved: true;
    piiScreening: 'passed';
    evidenceCount: number;
    attestedBy: string;
    attestedAt: number;
    licenseId: string;
  };
  servedModelAlias: string;
}

export interface NeuroPlasticObservation {
  pairId: string;
  seed: number;
  split: 'holdout';
  authority: 'independent-verifier';
  verifierId: string;
  holdoutFingerprint: string;
  metrics: {
    quality01: number;
    safety01: number;
    retention01: number;
    cost01: number;
    latencyMs: number;
    safetyViolationCount: number;
  };
}

export interface NeuroPlasticEvaluationPayload {
  holdoutFingerprint: string;
  baseline: NeuroPlasticObservation[];
  candidate: NeuroPlasticObservation[];
  evaluatedAt: number;
}

export interface NeuroPlasticEvaluationReceipt {
  evaluationId: string;
  evaluatorId: string;
  evaluatedAt: number;
  evaluationFingerprint: string;
  signature: string;
}

export interface NeuroPlasticEvaluationInput extends NeuroPlasticEvaluationPayload {
  receipt: NeuroPlasticEvaluationReceipt;
}

export interface NeuroPlasticEvaluationReport {
  reportId: string;
  adapterId: string;
  holdoutFingerprint: string;
  evaluationId: string;
  evaluatorId: string;
  evaluationFingerprint: string;
  evaluatorSignature: string;
  pairedN: number;
  independentSeedCount: number;
  qualityDeltaMean01: number;
  qualityCi95: [number, number];
  safetyDeltaMean01: number;
  retentionDeltaMean01: number;
  costDeltaMean01: number;
  latencyRatio01: number;
  safetyViolationCount: number;
  eligible: boolean;
  reasons: string[];
  automaticActivation: false;
  evaluatedAt: number;
}

export interface NeuroPlasticApproval {
  approvalId: string;
  actorId: string;
  approvedAt: number;
  signature: string;
}

export interface NeuroPlasticAdapterRecord {
  manifest: NeuroPlasticAdapterManifest;
  status: NeuroPlasticAdapterStatus;
  stagedAt: number;
  updatedAt: number;
  evaluation: NeuroPlasticEvaluationReport | null;
  activationApprovalId: string | null;
  activationApproval: NeuroPlasticApproval | null;
  disabledReason: string | null;
}

export interface NeuroPlasticRegistrySnapshot {
  schemaVersion: 1;
  adapters: NeuroPlasticAdapterRecord[];
}

export interface NeuroPlasticSelectInput {
  domain: string;
  backendId: string;
  baseModelFingerprint: string;
  backendSupportsModelAliases: boolean;
  confidence01: number;
  risk01: number;
}

export interface NeuroPlasticSelection {
  useAdapter: boolean;
  adapterId: string | null;
  modelAlias: string | null;
  reason: string;
}

const MAX_ADAPTERS = 64;
const MIN_HOLDOUT_PAIRS = 5;
const DOMAIN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
const HASH = /^[a-f0-9]{64}$/i;
const T95: Record<number, number> = {
  5: 2.776, 6: 2.571, 7: 2.447, 8: 2.365, 9: 2.306, 10: 2.262,
  11: 2.228, 12: 2.201, 13: 2.179, 14: 2.160, 15: 2.145,
  16: 2.131, 17: 2.120, 18: 2.110, 19: 2.101, 20: 2.093,
  21: 2.086, 22: 2.080, 23: 2.074, 24: 2.069, 25: 2.064,
  26: 2.060, 27: 2.056, 28: 2.052, 29: 2.048, 30: 2.045,
};

const finiteUnit = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('neuro-plastic-invalid-' + label);
  }
  return value;
};
const safeCounter = (value: unknown, label: string, minimum = 0): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error('neuro-plastic-invalid-' + label);
  }
  return value;
};
const safeText = (value: unknown, label: string, max = 160): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > max ||
      value.trim() !== value || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    throw new Error('neuro-plastic-invalid-' + label);
  }
  return value;
};
const safeHash = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error('neuro-plastic-invalid-' + label);
  return value.toLowerCase();
};
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function normalizeManifest(raw: unknown): NeuroPlasticAdapterManifest {
  let input: Record<string, unknown>;
  try {
    input = snapshotPlainData(raw) as Record<string, unknown>;
  } catch {
    throw new Error('neuro-plastic-manifest-data-boundary-rejected');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schemaVersion !== 1) {
    throw new Error('neuro-plastic-manifest-schema-invalid');
  }
  const adapterId = safeText(input.adapterId, 'adapter-id', 80);
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(adapterId)) throw new Error('neuro-plastic-adapter-id-invalid');
  const domain = safeText(input.domain, 'domain', 64).toLowerCase();
  if (!DOMAIN.test(domain)) throw new Error('neuro-plastic-domain-invalid');
  if (input.method !== 'lora' && input.method !== 'qlora') throw new Error('neuro-plastic-method-invalid');
  const base = input.baseModel as Record<string, unknown>;
  const artifact = input.artifact as Record<string, unknown>;
  const trainer = input.trainer as Record<string, unknown>;
  const governance = input.governance as Record<string, unknown>;
  if (!base || typeof base !== 'object' || !artifact || typeof artifact !== 'object' ||
      !trainer || typeof trainer !== 'object' || !governance || typeof governance !== 'object') {
    throw new Error('neuro-plastic-manifest-section-invalid');
  }
  const baseModel = {
    id: safeText(base.id, 'base-model-id'),
    backendId: safeText(base.backendId, 'backend-id'),
    servedModelAlias: safeText(base.servedModelAlias, 'base-model-alias'),
    fingerprint: safeHash(base.fingerprint, 'base-model-fingerprint'),
  };
  for (const value of [baseModel.id, baseModel.backendId, baseModel.servedModelAlias]) {
    if (!IDENTIFIER.test(value)) throw new Error('neuro-plastic-base-model-identifier-invalid');
  }
  const directory = safeText(artifact.directory, 'artifact-directory', 240);
  const segments = directory.split('/');
  if (!directory.startsWith('adapter-store/') || directory.includes('\\') ||
      directory.startsWith('/') || segments.some(segment => !segment || segment === '.' || segment === '..') ||
      segments.at(-1) !== adapterId) {
    throw new Error('neuro-plastic-artifact-directory-invalid');
  }
  const normalizedTrainer = {
    name: safeText(trainer.name, 'trainer-name'),
    version: safeText(trainer.version, 'trainer-version'),
    seed: safeCounter(trainer.seed, 'trainer-seed'),
    completedAt: safeCounter(trainer.completedAt, 'trainer-completed-at', 1),
  };
  const normalizedGovernance = {
    trainingOptIn: governance.trainingOptIn,
    privacyReviewed: governance.privacyReviewed,
    licenseApproved: governance.licenseApproved,
    piiScreening: governance.piiScreening,
    evidenceCount: safeCounter(governance.evidenceCount, 'evidence-count', MIN_HOLDOUT_PAIRS),
    attestedBy: safeText(governance.attestedBy, 'attested-by'),
    attestedAt: safeCounter(governance.attestedAt, 'attested-at', 1),
    licenseId: safeText(governance.licenseId, 'license-id'),
  };
  if (normalizedGovernance.trainingOptIn !== true ||
      normalizedGovernance.privacyReviewed !== true ||
      normalizedGovernance.licenseApproved !== true ||
      normalizedGovernance.piiScreening !== 'passed') {
    throw new Error('neuro-plastic-governance-not-approved');
  }
  const totalBytes = safeCounter(artifact.totalBytes, 'artifact-bytes', 1);
  if (totalBytes > 50 * 1024 * 1024 * 1024) throw new Error('neuro-plastic-artifact-too-large');
  const servedModelAlias = safeText(input.servedModelAlias, 'served-model-alias');
  if (!IDENTIFIER.test(servedModelAlias)) throw new Error('neuro-plastic-served-model-alias-invalid');
  return {
    schemaVersion: 1,
    adapterId,
    domain,
    method: input.method,
    baseModel,
    tokenizerFingerprint: safeHash(input.tokenizerFingerprint, 'tokenizer-fingerprint'),
    sourceDatasetFingerprint: safeHash(input.sourceDatasetFingerprint, 'source-dataset-fingerprint'),
    holdoutPlanFingerprint: safeHash(input.holdoutPlanFingerprint, 'holdout-plan-fingerprint'),
    corpusFingerprint: safeHash(input.corpusFingerprint, 'corpus-fingerprint'),
    artifact: {
      directory,
      configSha256: safeHash(artifact.configSha256, 'artifact-config-sha256'),
      weightsSha256: safeHash(artifact.weightsSha256, 'artifact-weights-sha256'),
      totalBytes,
    },
    trainer: normalizedTrainer,
    governance: normalizedGovernance as NeuroPlasticAdapterManifest['governance'],
    servedModelAlias,
  };
}

function observation(raw: unknown, label: string, holdoutFingerprint: string): NeuroPlasticObservation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('neuro-plastic-' + label + '-observation-invalid');
  const value = snapshotPlainData(raw) as Record<string, unknown>;
  if (value.split !== 'holdout' || value.authority !== 'independent-verifier') {
    throw new Error('neuro-plastic-independent-holdout-required');
  }
  const fingerprint = safeHash(value.holdoutFingerprint, label + '-holdout-fingerprint');
  if (fingerprint !== holdoutFingerprint) throw new Error('neuro-plastic-holdout-fingerprint-mismatch');
  const metrics = value.metrics as Record<string, unknown>;
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) throw new Error('neuro-plastic-observation-metrics-invalid');
  const latencyMs = metrics.latencyMs;
  if (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 600_000) {
    throw new Error('neuro-plastic-invalid-latency');
  }
  return {
    pairId: safeText(value.pairId, label + '-pair-id', 256),
    seed: safeCounter(value.seed, label + '-seed'),
    split: 'holdout',
    authority: 'independent-verifier',
    verifierId: safeText(value.verifierId, label + '-verifier-id'),
    holdoutFingerprint: fingerprint,
    metrics: {
      quality01: finiteUnit(metrics.quality01, label + '-quality'),
      safety01: finiteUnit(metrics.safety01, label + '-safety'),
      retention01: finiteUnit(metrics.retention01, label + '-retention'),
      cost01: finiteUnit(metrics.cost01, label + '-cost'),
      latencyMs,
      safetyViolationCount: safeCounter(metrics.safetyViolationCount, label + '-safety-violations'),
    },
  };
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function qualityConfidenceInterval(deltas: number[]): [number, number] {
  const average = mean(deltas);
  if (deltas.length < MIN_HOLDOUT_PAIRS) return [average, average];
  const variance = deltas.reduce((total, value) => total + ((value - average) ** 2), 0) / (deltas.length - 1);
  const critical = T95[deltas.length] ?? 1.96;
  const margin = critical * Math.sqrt(variance / deltas.length);
  return [average - margin, average + margin];
}

function reportFingerprint(value: Omit<NeuroPlasticEvaluationReport, 'reportId'>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}


function normalizeApproval(raw: unknown): NeuroPlasticApproval {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('neuro-plastic-approval-invalid');
  const value = snapshotPlainData(raw) as Record<string, unknown>;
  return {
    approvalId: safeText(value.approvalId, 'approval-id'),
    actorId: safeText(value.actorId, 'approval-actor-id'),
    approvedAt: safeCounter(value.approvedAt, 'approval-time', 1),
    signature: safeHash(value.signature, 'approval-signature'),
  };
}

function approvalPayload(
  approval: Pick<NeuroPlasticApproval, 'approvalId' | 'actorId' | 'approvedAt'>,
  context: { adapterId: string; reportId: string; baseModelFingerprint: string },
): string {
  return JSON.stringify({
    approvalId: approval.approvalId,
    actorId: approval.actorId,
    approvedAt: approval.approvedAt,
    adapterId: context.adapterId,
    reportId: context.reportId,
    baseModelFingerprint: context.baseModelFingerprint.toLowerCase(),
  });
}

export function createNeuroPlasticApprovalSignature(
  approval: Pick<NeuroPlasticApproval, 'approvalId' | 'actorId' | 'approvedAt'>,
  context: { adapterId: string; reportId: string; baseModelFingerprint: string },
  secret: string,
): string {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('neuro-plastic-approval-secret-too-short');
  const blockSize = 64;
  const keyBytes = Buffer.from(secret, 'utf8');
  const normalizedKey = keyBytes.length > blockSize
    ? Buffer.from(createHash('sha256').update(keyBytes).digest())
    : keyBytes;
  const keyBlock = Buffer.alloc(blockSize, 0);
  normalizedKey.copy(keyBlock);
  const innerPad = Buffer.alloc(blockSize);
  const outerPad = Buffer.alloc(blockSize);
  for (let index = 0; index < blockSize; index++) {
    innerPad[index] = keyBlock[index] ^ 0x36;
    outerPad[index] = keyBlock[index] ^ 0x5c;
  }
  const innerDigest = createHash('sha256')
    .update(innerPad)
    .update(approvalPayload(approval, context), 'utf8')
    .digest();
  return createHash('sha256').update(outerPad).update(innerDigest).digest('hex');
}

export function verifyNeuroPlasticApprovalSignature(
  approval: NeuroPlasticApproval,
  context: { adapterId: string; reportId: string; baseModelFingerprint: string },
  secret: string,
): boolean {
  try {
    const expected = createNeuroPlasticApprovalSignature(approval, context, secret);
    const actual = safeHash(approval.signature, 'approval-signature');
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index++) {
      difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    return difference === 0;
  } catch {
    return false;
  }
}

export class NeuroPlasticAdapterRegistry {
  private state: NeuroPlasticRegistrySnapshot = { schemaVersion: 1, adapters: [] };

  snapshot(): NeuroPlasticRegistrySnapshot {
    return structuredClone(this.state);
  }

  restore(
    raw?: unknown,
    verifyRestoredApproval?: (
      approval: NeuroPlasticApproval,
      context: { adapterId: string; reportId: string; baseModelFingerprint: string },
    ) => boolean,
  ): void {
    this.state = { schemaVersion: 1, adapters: [] };
    if (!raw) return;
    let input: Record<string, unknown>;
    try {
      input = snapshotPlainData(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (!input || input.schemaVersion !== 1 || !Array.isArray(input.adapters)) return;
    const restored: NeuroPlasticAdapterRecord[] = [];
    for (const item of input.adapters.slice(-MAX_ADAPTERS)) {
      try {
        const row = item as Record<string, unknown>;
        const manifest = normalizeManifest(row.manifest);
        const evaluation = row.evaluation as NeuroPlasticEvaluationReport | null;
        const validReport = Boolean(evaluation && evaluation.adapterId === manifest.adapterId &&
          evaluation.holdoutFingerprint === manifest.holdoutPlanFingerprint &&
          evaluation.automaticActivation === false && typeof evaluation.eligible === 'boolean' &&
          Array.isArray(evaluation.reasons));
        const storedStatus = row.status;
        let activationApproval: NeuroPlasticApproval | null = null;
        let restoredApprovalTrusted = false;
        if (storedStatus === 'active' && validReport && evaluation!.eligible &&
            row.activationApproval && verifyRestoredApproval) {
          try {
            activationApproval = normalizeApproval(row.activationApproval);
            restoredApprovalTrusted = verifyRestoredApproval(activationApproval, {
              adapterId: manifest.adapterId,
              reportId: evaluation!.reportId,
              baseModelFingerprint: manifest.baseModel.fingerprint,
            }) === true;
          } catch {
            restoredApprovalTrusted = false;
            activationApproval = null;
          }
        }
        const status: NeuroPlasticAdapterStatus = storedStatus === 'disabled' ? 'disabled'
          : storedStatus === 'rejected' ? 'rejected'
            : restoredApprovalTrusted ? 'active'
              : validReport && evaluation!.eligible ? 'eligible'
                : 'staged';
        restored.push({
          manifest,
          status,
          stagedAt: safeCounter(row.stagedAt, 'restored-staged-at'),
          updatedAt: safeCounter(row.updatedAt, 'restored-updated-at'),
          evaluation: validReport ? structuredClone(evaluation!) : null,
          activationApprovalId: status === 'active' ? activationApproval!.approvalId : null,
          activationApproval: status === 'active' ? activationApproval : null,
          disabledReason: status === 'disabled' ? 'restored-disabled' : null,
        });
      } catch {
        // Invalid persisted candidates are discarded individually; one corrupt row does not block safe recovery.
      }
    }
    this.state.adapters = restored;
  }
  stage(rawManifest: unknown): NeuroPlasticAdapterRecord {
    if (this.state.adapters.length >= MAX_ADAPTERS) throw new Error('neuro-plastic-registry-capacity-reached');
    const manifest = normalizeManifest(rawManifest);
    if (this.state.adapters.some(item => item.manifest.adapterId === manifest.adapterId)) {
      throw new Error('neuro-plastic-adapter-id-already-exists');
    }
    const now = Date.now();
    const record: NeuroPlasticAdapterRecord = {
      manifest,
      status: 'staged',
      stagedAt: now,
      updatedAt: now,
      evaluation: null,
      activationApprovalId: null,
      activationApproval: null,
      disabledReason: null,
    };
    this.state.adapters.push(record);
    return structuredClone(record);
  }

  evaluateCandidate(adapterId: string, input: NeuroPlasticEvaluationInput): NeuroPlasticEvaluationReport {
    const record = this.find(adapterId);
    if (record.status !== 'staged') throw new Error('neuro-plastic-candidate-not-in-staged-state');
    const holdoutFingerprint = safeHash(input.holdoutFingerprint, 'holdout-fingerprint');
    if (holdoutFingerprint !== record.manifest.holdoutPlanFingerprint) {
      throw new Error('neuro-plastic-holdout-plan-mismatch');
    }
    const baseline = input.baseline.map((value) => observation(value, 'baseline', holdoutFingerprint));
    const candidate = input.candidate.map((value) => observation(value, 'candidate', holdoutFingerprint));
    const keyed = (rows: NeuroPlasticObservation[], label: string): Map<string, NeuroPlasticObservation> => {
      const map = new Map<string, NeuroPlasticObservation>();
      for (const row of rows) {
        const key = row.pairId + '\u0000' + row.seed;
        if (map.has(key)) throw new Error('neuro-plastic-' + label + '-duplicate-holdout-pair');
        map.set(key, row);
      }
      return map;
    };
    const baselineByPair = keyed(baseline, 'baseline');
    const candidateByPair = keyed(candidate, 'candidate');
    if (baselineByPair.size < MIN_HOLDOUT_PAIRS || candidateByPair.size !== baselineByPair.size ||
        [...baselineByPair.keys()].some(key => !candidateByPair.has(key))) {
      throw new Error('neuro-plastic-holdout-pairing-incomplete');
    }
    const seedCount = new Set(baseline.map(row => row.seed)).size;
    if (seedCount < MIN_HOLDOUT_PAIRS) throw new Error('neuro-plastic-independent-seeds-insufficient');
    const pairs = [...baselineByPair.entries()].map(([key, before]) => ({
      before,
      after: candidateByPair.get(key)!,
    }));
    const quality = pairs.map(pair => pair.after.metrics.quality01 - pair.before.metrics.quality01);
    const safety = pairs.map(pair => pair.after.metrics.safety01 - pair.before.metrics.safety01);
    const retention = pairs.map(pair => pair.after.metrics.retention01 - pair.before.metrics.retention01);
    const cost = pairs.map(pair => pair.after.metrics.cost01 - pair.before.metrics.cost01);
    const latencyRatios = pairs.map(pair => pair.after.metrics.latencyMs / Math.max(1, pair.before.metrics.latencyMs));
    const safetyViolationCount = candidate.reduce((sum, row) => sum + row.metrics.safetyViolationCount, 0);
    const qualityCi95 = qualityConfidenceInterval(quality);
    const latencyRatio01 = mean(latencyRatios);
    const reasons: string[] = [];
    if (mean(quality) < 0.01) reasons.push('quality-uplift-below-1-percent');
    if (qualityCi95[0] <= 0) reasons.push('quality-confidence-lower-bound-not-positive');
    if (mean(safety) < -0.005) reasons.push('safety-regression');
    if (mean(retention) < -0.02) reasons.push('catastrophic-forgetting-risk');
    if (mean(cost) > 0.03) reasons.push('cost-regression');
    if (latencyRatio01 > 1.15) reasons.push('latency-regression');
    if (safetyViolationCount > 0) reasons.push('candidate-safety-violations');
    const summary = {
      adapterId: record.manifest.adapterId,
      holdoutFingerprint,
      pairedN: pairs.length,
      independentSeedCount: seedCount,
      qualityDeltaMean01: mean(quality),
      qualityCi95,
      safetyDeltaMean01: mean(safety),
      retentionDeltaMean01: mean(retention),
      costDeltaMean01: mean(cost),
      latencyRatio01,
      safetyViolationCount,
      eligible: reasons.length === 0,
      reasons,
      automaticActivation: false as const,
      evaluatedAt: safeCounter(input.evaluatedAt, 'evaluated-at', 1),
    };
    const reportId = reportFingerprint(summary);
    const report: NeuroPlasticEvaluationReport = { reportId, ...summary };
    record.evaluation = report;
    record.status = report.eligible ? 'eligible' : 'rejected';
    record.updatedAt = report.evaluatedAt;
    return structuredClone(report);
  }

  async activate(
    adapterId: string,
    approval: NeuroPlasticApproval,
    verifyApproval: (approval: NeuroPlasticApproval, context: { adapterId: string; reportId: string; baseModelFingerprint: string }) => boolean | Promise<boolean>,
  ): Promise<NeuroPlasticAdapterRecord> {
    const record = this.find(adapterId);
    if (record.status !== 'eligible' || !record.evaluation?.eligible) {
      throw new Error('neuro-plastic-candidate-not-eligible-for-activation');
    }
    const normalized = normalizeApproval(approval);
    if (typeof verifyApproval !== 'function' || !await verifyApproval(normalized, {
      adapterId,
      reportId: record.evaluation.reportId,
      baseModelFingerprint: record.manifest.baseModel.fingerprint,
    })) {
      throw new Error('neuro-plastic-human-approval-required');
    }
    for (const other of this.state.adapters) {
      if (other.status === 'active' && other.manifest.domain === record.manifest.domain &&
          other.manifest.baseModel.fingerprint === record.manifest.baseModel.fingerprint) {
        other.status = 'eligible';
        other.activationApprovalId = null;
        other.activationApproval = null;
        other.updatedAt = normalized.approvedAt;
      }
    }
    record.status = 'active';
    record.activationApprovalId = normalized.approvalId;
    record.activationApproval = normalized;
    record.disabledReason = null;
    record.updatedAt = normalized.approvedAt;
    return structuredClone(record);
  }

  select(input: NeuroPlasticSelectInput): NeuroPlasticSelection {
    const domain = safeText(input.domain, 'selection-domain', 64).toLowerCase();
    const baseFingerprint = safeHash(input.baseModelFingerprint, 'selection-base-fingerprint');
    const confidence = finiteUnit(input.confidence01, 'selection-confidence');
    const risk = finiteUnit(input.risk01, 'selection-risk');
    if (!input.backendSupportsModelAliases) return { useAdapter: false, adapterId: null, modelAlias: null, reason: 'backend-adapter-aliases-unsupported' };
    if (confidence < 0.72) return { useAdapter: false, adapterId: null, modelAlias: null, reason: 'confidence-below-routing-threshold' };
    if (risk > 0.35) return { useAdapter: false, adapterId: null, modelAlias: null, reason: 'risk-above-routing-threshold' };
    const match = this.state.adapters
      .filter(item => item.status === 'active' &&
        item.manifest.domain === domain &&
        item.manifest.baseModel.backendId === input.backendId &&
        item.manifest.baseModel.fingerprint === baseFingerprint)
      .sort((a, b) => (b.evaluation?.qualityDeltaMean01 ?? 0) - (a.evaluation?.qualityDeltaMean01 ?? 0))[0];
    if (!match) return { useAdapter: false, adapterId: null, modelAlias: null, reason: 'no-approved-domain-adapter' };
    return { useAdapter: true, adapterId: match.manifest.adapterId, modelAlias: match.manifest.servedModelAlias, reason: 'approved-domain-adapter' };
  }

  recordRuntimeFailure(adapterId: string, reason: string): NeuroPlasticAdapterRecord {
    const record = this.find(adapterId);
    record.status = 'disabled';
    record.disabledReason = safeText(reason, 'runtime-failure-reason', 240);
    record.activationApprovalId = null;
    record.activationApproval = null;
    record.updatedAt = Date.now();
    return structuredClone(record);
  }

  rollback(adapterId: string, reason: string): NeuroPlasticAdapterRecord {
    const record = this.find(adapterId);
    record.status = 'disabled';
    record.disabledReason = safeText(reason, 'rollback-reason', 240);
    record.activationApprovalId = null;
    record.updatedAt = Date.now();
    return structuredClone(record);
  }

  private find(adapterId: string): NeuroPlasticAdapterRecord {
    const id = safeText(adapterId, 'adapter-id', 80);
    const record = this.state.adapters.find(item => item.manifest.adapterId === id);
    if (!record) throw new Error('neuro-plastic-adapter-not-found');
    return record;
  }
}
