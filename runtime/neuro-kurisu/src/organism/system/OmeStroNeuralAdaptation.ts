import { createHash } from 'node:crypto';

const clamp01 = (value: unknown): number =>
  Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
const clampSigned = (value: unknown): number =>
  Math.max(-1, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
const safeText = (value: unknown, max = 240): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface NeuralAdapterEvaluation {
  evaluatorId: string;
  independent: boolean;
  trainDatasetFingerprint: string;
  validationDatasetFingerprint: string;
  holdoutDatasetFingerprint: string;
  pairedSeeds: number;
  baseScore01: number;
  adapterScore01: number;
  maxTaskRegression01: number;
  safetyPassed: boolean;
  ablationPassed: boolean;
  holdoutUntouched: boolean;
  evidenceRef: string;
}
export interface NeuralAdapterCandidate {
  adapterId: string;
  adapterFingerprint: string;
  baseModelFingerprint: string;
  trainerId: string;
  capabilityIds: string[];
  rank: number;
  trainableParameterFraction01: number;
  maxResidualNorm01: number;
  expiresAt: number | null;
  evaluation: NeuralAdapterEvaluation;
}
export interface NeuralAdapterRecord extends NeuralAdapterCandidate {
  validated: true;
  registeredAt: number;
  qualityGain01: number;
}
export interface NeuralAdapterValidation {
  eligible: boolean;
  blockers: string[];
  qualityGain01: number;
}
export function validateNeuralAdapterCandidate(candidate: NeuralAdapterCandidate): NeuralAdapterValidation {
  const blockers: string[] = [];
  if (!safeText(candidate?.adapterId, 160) || !safeText(candidate?.adapterFingerprint, 160) ||
      !safeText(candidate?.baseModelFingerprint, 160)) blockers.push('adapter-and-model-fingerprints-required');
  if (!safeText(candidate?.trainerId, 120)) blockers.push('trainer-identity-required');
  if (!Array.isArray(candidate?.capabilityIds) || !candidate.capabilityIds.some(value => safeText(value, 120))) blockers.push('capability-scope-required');
  if (!Number.isSafeInteger(candidate?.rank) || candidate.rank < 1 || candidate.rank > 16) blockers.push('adapter-rank-out-of-bounds');
  if (!Number.isFinite(candidate?.trainableParameterFraction01) ||
      candidate.trainableParameterFraction01 <= 0 || candidate.trainableParameterFraction01 > 0.05) blockers.push('sparse-trainable-fraction-exceeds-five-percent');
  if (!Number.isFinite(candidate?.maxResidualNorm01) || candidate.maxResidualNorm01 < 0 || candidate.maxResidualNorm01 > 0.1) blockers.push('residual-norm-out-of-bounds');
  if (candidate.expiresAt !== null && (!Number.isSafeInteger(candidate.expiresAt) || candidate.expiresAt <= 0)) blockers.push('invalid-adapter-expiry');
  const evaluation = candidate?.evaluation;
  if (!evaluation) {
    blockers.push('independent-evaluation-required');
    return { eligible: false, blockers, qualityGain01: 0 };
  }
  if (!safeText(evaluation.evaluatorId, 120) || evaluation.evaluatorId === candidate.trainerId || evaluation.independent !== true) blockers.push('evaluator-not-independent');
  if (!Number.isSafeInteger(evaluation.pairedSeeds) || evaluation.pairedSeeds < 5) blockers.push('minimum-five-paired-seeds-required');
  const fingerprints = [
    evaluation.trainDatasetFingerprint, evaluation.validationDatasetFingerprint, evaluation.holdoutDatasetFingerprint,
  ].map(value => safeText(value, 160));
  if (fingerprints.some(value => !value)) blockers.push('dataset-fingerprints-required');
  if (new Set(fingerprints).size !== 3) blockers.push('train-validation-holdout-datasets-must-be-distinct');
  if (evaluation.holdoutUntouched !== true) blockers.push('holdout-contamination-or-tuning');
  for (const score of [evaluation.baseScore01, evaluation.adapterScore01, evaluation.maxTaskRegression01]) {
    if (!Number.isFinite(score) || score < 0 || score > 1) blockers.push('evaluation-score-out-of-range');
  }
  if (evaluation.safetyPassed !== true) blockers.push('adapter-safety-gate-failed');
  if (evaluation.ablationPassed !== true) blockers.push('ablation-benefit-not-established');
  if (!safeText(evaluation.evidenceRef, 240)) blockers.push('evaluation-evidence-reference-required');
  const qualityGain01 = Number.isFinite(evaluation.adapterScore01) && Number.isFinite(evaluation.baseScore01)
    ? evaluation.adapterScore01 - evaluation.baseScore01 : 0;
  if (qualityGain01 <= 0) blockers.push('adapter-must-beat-base-model-on-holdout');
  if (Number.isFinite(evaluation.maxTaskRegression01) && evaluation.maxTaskRegression01 > 0.05) blockers.push('task-regression-exceeds-five-percent');
  return { eligible: blockers.length === 0, blockers: [...new Set(blockers)], qualityGain01 };
}

export class AdaptiveSynapticMatrix {
  private records = new Map<string, NeuralAdapterRecord>();
  register(candidate: NeuralAdapterCandidate, now = Date.now()): {
    accepted: boolean; blockers: string[]; record?: NeuralAdapterRecord;
  } {
    const validation = validateNeuralAdapterCandidate(candidate);
    if (!Number.isSafeInteger(now) || now < 0) return { accepted: false, blockers: ['invalid-registration-time'] };
    if (this.records.has(candidate?.adapterId)) return { accepted: false, blockers: ['duplicate-adapter-id'] };
    if (candidate?.expiresAt !== null && candidate?.expiresAt !== undefined && candidate.expiresAt <= now) {
      return { accepted: false, blockers: ['adapter-already-expired'] };
    }
    if (!validation.eligible) return { accepted: false, blockers: validation.blockers };
    const record: NeuralAdapterRecord = {
      ...structuredClone(candidate),
      capabilityIds: [...new Set(candidate.capabilityIds.map(value => safeText(value, 120)).filter(Boolean))],
      validated: true,
      registeredAt: now,
      qualityGain01: validation.qualityGain01,
    };
    this.records.set(record.adapterId, record);
    return { accepted: true, blockers: [], record: structuredClone(record) };
  }
  route(input: {
    baseModelFingerprint: string;
    capabilityId: string;
    confidence01: number;
    now: number;
  }): { mode: 'adapter' | 'base'; adapterId: string | null; reason: string } {
    const baseModelFingerprint = safeText(input?.baseModelFingerprint, 160);
    const capabilityId = safeText(input?.capabilityId, 120);
    if (!baseModelFingerprint || !capabilityId || !Number.isSafeInteger(input?.now) || input.now < 0) {
      return { mode: 'base', adapterId: null, reason: 'invalid-routing-context' };
    }
    if (clamp01(input.confidence01) < 0.65) return { mode: 'base', adapterId: null, reason: 'insufficient-routing-confidence' };
    const candidates = [...this.records.values()].filter(record =>
      record.validated && record.baseModelFingerprint === baseModelFingerprint &&
      record.capabilityIds.includes(capabilityId) && (record.expiresAt === null || record.expiresAt > input.now));
    candidates.sort((a, b) => b.qualityGain01 - a.qualityGain01 || a.adapterId.localeCompare(b.adapterId));
    const selected = candidates[0];
    return selected
      ? { mode: 'adapter', adapterId: selected.adapterId, reason: 'independently-validated-compatible-adapter' }
      : { mode: 'base', adapterId: null, reason: 'no-validated-compatible-adapter' };
  }
  snapshot(): NeuralAdapterRecord[] { return [...this.records.values()].map(record => structuredClone(record)); }
  restore(records: unknown, now = Date.now()): void {
    this.records.clear();
    if (!Array.isArray(records) || !Number.isSafeInteger(now) || now < 0) return;
    for (const record of records.slice(-256) as NeuralAdapterRecord[]) {
      const candidate = { ...record, evaluation: record?.evaluation };
      if (validateNeuralAdapterCandidate(candidate).eligible &&
          record.validated === true && (record.expiresAt === null || record.expiresAt > now)) {
        this.records.set(record.adapterId, structuredClone(record));
      }
    }
  }
}

export interface EphemeralPlasticitySnapshot {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  maxNorm01: number;
  delta: number[];
  updates: number;
  reset: boolean;
}
export class EphemeralPlasticitySession {
  private state: EphemeralPlasticitySnapshot;
  constructor(input: { sessionId: string; now: number; ttlMs: number; dimension: number; maxNorm01: number }) {
    if (!safeText(input?.sessionId, 120) || !Number.isSafeInteger(input.now) || input.now < 0 ||
        !Number.isSafeInteger(input.ttlMs) || input.ttlMs < 1 || input.ttlMs > 3_600_000 ||
        !Number.isSafeInteger(input.dimension) || input.dimension < 1 || input.dimension > 256 ||
        !Number.isFinite(input.maxNorm01) || input.maxNorm01 <= 0 || input.maxNorm01 > 0.1) {
      throw new Error('invalid-ephemeral-plasticity-config');
    }
    this.state = {
      sessionId: input.sessionId, createdAt: input.now, expiresAt: input.now + input.ttlMs,
      maxNorm01: input.maxNorm01, delta: new Array(input.dimension).fill(0), updates: 0, reset: false,
    };
  }
  adapt(input: { delta: number[]; now: number }): { accepted: boolean; reason?: string; norm01: number } {
    if (this.state.reset) return { accepted: false, reason: 'session-reset', norm01: 0 };
    if (!Number.isSafeInteger(input?.now) || input.now >= this.state.expiresAt || input.now < this.state.createdAt) {
      this.reset();
      return { accepted: false, reason: 'session-expired', norm01: 0 };
    }
    if (!Array.isArray(input.delta) || input.delta.length !== this.state.delta.length ||
        input.delta.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
      return { accepted: false, reason: 'invalid-delta', norm01: vectorNorm(this.state.delta) };
    }
    const proposed = this.state.delta.map((value, index) => value + clampSigned(input.delta[index]));
    const norm = vectorNorm(proposed);
    const scale = norm > this.state.maxNorm01 ? this.state.maxNorm01 / norm : 1;
    this.state.delta = proposed.map(value => value * scale);
    this.state.updates += 1;
    return { accepted: true, norm01: vectorNorm(this.state.delta) };
  }
  snapshot(now = Date.now()): EphemeralPlasticitySnapshot {
    if (!this.state.reset && now >= this.state.expiresAt) this.reset();
    return structuredClone(this.state);
  }
  reset(): void {
    this.state.delta.fill(0);
    this.state.reset = true;
  }
}
function vectorNorm(values: number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

export interface CognitiveNeuralState {
  arousal01?: number;
  goalUrgency01?: number;
  predictionError01?: number;
  uncertainty01?: number;
  novelty01?: number;
  socialRelevance01?: number;
  energy01?: number;
  attention01?: number;
}
export interface CognitiveNeuralControl {
  schemaVersion: 1;
  controls: Record<keyof CognitiveNeuralState, number>;
  maxAbsControl: number;
  application: 'backend-opt-in-only';
}
export function compileCognitiveNeuralControl(state: CognitiveNeuralState): CognitiveNeuralControl {
  const controls = {
    arousal01: (clamp01(state?.arousal01) - 0.5) * 0.08,
    goalUrgency01: (clamp01(state?.goalUrgency01) - 0.5) * 0.08,
    predictionError01: (clamp01(state?.predictionError01) - 0.5) * 0.06,
    uncertainty01: (clamp01(state?.uncertainty01) - 0.5) * 0.06,
    novelty01: (clamp01(state?.novelty01) - 0.5) * 0.05,
    socialRelevance01: (clamp01(state?.socialRelevance01) - 0.5) * 0.04,
    energy01: (clamp01(state?.energy01) - 0.5) * 0.04,
    attention01: (clamp01(state?.attention01) - 0.5) * 0.08,
  };
  const maxAbsControl = Math.max(...Object.values(controls).map(Math.abs));
  return { schemaVersion: 1, controls, maxAbsControl, application: 'backend-opt-in-only' };
}

export function createSparsePlasticityMask(input: {
  availableParameterIds: string[];
  allowedParameterIds: string[];
  protectedParameterIds: string[];
  maximumFraction?: number;
}): { accepted: boolean; selectedParameterIds: string[]; blockers: string[] } {
  const available = [...new Set((input?.availableParameterIds ?? []).map(value => safeText(value, 180)).filter(Boolean))];
  const allowed = new Set((input?.allowedParameterIds ?? []).map(value => safeText(value, 180)).filter(Boolean));
  const protectedIds = new Set((input?.protectedParameterIds ?? []).map(value => safeText(value, 180)).filter(Boolean));
  const blockers: string[] = [];
  const maximumFraction = Number.isFinite(input?.maximumFraction) ? Math.max(0, Math.min(0.05, input.maximumFraction!)) : 0.05;
  const requested = available.filter(id => allowed.has(id));
  if (!available.length || !allowed.size) blockers.push('explicit-parameter-allowlist-required');
  if (requested.some(id => protectedIds.has(id))) blockers.push('protected-parameter-requested');
  const limit = Math.floor(available.length * maximumFraction);
  const selectedParameterIds = requested.filter(id => !protectedIds.has(id)).slice(0, limit);
  if (!selectedParameterIds.length) blockers.push('empty-sparse-update-mask');
  return { accepted: blockers.length === 0, selectedParameterIds, blockers: [...new Set(blockers)] };
}

export interface VerifiedExecutionTrace {
  taskFingerprint: string;
  environmentFingerprint: string;
  sourceEvidenceRef: string;
  independentlyVerified: boolean;
  noPersonalData: boolean;
  steps: Array<{
    operationId: string;
    inputSchemaRef: string;
    outputSchemaRef: string;
    evidenceRef: string;
  }>;
}
export interface NeuralJitSkillCapsule {
  schemaVersion: 1;
  capsuleId: string;
  taskFingerprint: string;
  environmentFingerprint: string;
  sourceEvidenceRef: string;
  operations: Array<{ operationId: string; inputSchemaRef: string; outputSchemaRef: string; evidenceRef: string }>;
  state: 'candidate-only';
  requiresApplicabilityCheck: true;
  executableSourceIncluded: false;
}
export function compileNeuralJitSkillCapsule(trace: VerifiedExecutionTrace): {
  accepted: boolean; capsule: NeuralJitSkillCapsule | null; blockers: string[];
} {
  const blockers: string[] = [];
  if (!safeText(trace?.taskFingerprint, 160) || !safeText(trace?.environmentFingerprint, 160) ||
      !safeText(trace?.sourceEvidenceRef, 240)) blockers.push('trace-identity-and-provenance-required');
  if (trace?.independentlyVerified !== true) blockers.push('independent-outcome-verification-required');
  if (trace?.noPersonalData !== true) blockers.push('personal-data-exclusion-required');
  const steps = Array.isArray(trace?.steps) ? trace.steps.slice(0, 32) : [];
  if (!steps.length) blockers.push('bounded-operation-trace-required');
  for (const step of steps) {
    if (!safeText(step?.operationId, 120) || !safeText(step?.inputSchemaRef, 240) ||
        !safeText(step?.outputSchemaRef, 240) || !safeText(step?.evidenceRef, 240)) {
      blockers.push('trace-step-missing-contract-or-evidence');
    }
  }
  const operations = steps.map(step => ({
    operationId: safeText(step.operationId, 120),
    inputSchemaRef: safeText(step.inputSchemaRef, 240),
    outputSchemaRef: safeText(step.outputSchemaRef, 240),
    evidenceRef: safeText(step.evidenceRef, 240),
  }));
  const payload = {
    taskFingerprint: safeText(trace?.taskFingerprint, 160),
    environmentFingerprint: safeText(trace?.environmentFingerprint, 160),
    sourceEvidenceRef: safeText(trace?.sourceEvidenceRef, 240),
    operations,
  };
  const capsule = blockers.length ? null : {
    schemaVersion: 1 as const,
    capsuleId: 'njit-' + sha256(JSON.stringify(payload)),
    ...payload,
    state: 'candidate-only' as const,
    requiresApplicabilityCheck: true as const,
    executableSourceIncluded: false as const,
  };
  return { accepted: blockers.length === 0, capsule, blockers: [...new Set(blockers)] };
}

export function evaluateNeuralAdaptationPromotion(input: {
  independentHoldoutPassed: boolean;
  pairedSeeds: number;
  ablationBenefit01: number;
  latencyDelta01: number;
  memoryDelta01: number;
  safetyPassed: boolean;
  baseFallbackPassed: boolean;
  rollbackAvailable: boolean;
}): { promotable: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (input.independentHoldoutPassed !== true) blockers.push('independent-holdout-required');
  if (!Number.isSafeInteger(input.pairedSeeds) || input.pairedSeeds < 5) blockers.push('five-paired-seeds-required');
  if (!Number.isFinite(input.ablationBenefit01) || input.ablationBenefit01 <= 0) blockers.push('ablation-benefit-required');
  if (!Number.isFinite(input.latencyDelta01) || input.latencyDelta01 > 0.1) blockers.push('latency-regression-exceeds-ten-percent');
  if (!Number.isFinite(input.memoryDelta01) || input.memoryDelta01 > 0.1) blockers.push('memory-regression-exceeds-ten-percent');
  if (input.safetyPassed !== true) blockers.push('safety-gate-required');
  if (input.baseFallbackPassed !== true) blockers.push('base-model-fallback-required');
  if (input.rollbackAvailable !== true) blockers.push('rollback-required');
  return { promotable: blockers.length === 0, blockers };
}
