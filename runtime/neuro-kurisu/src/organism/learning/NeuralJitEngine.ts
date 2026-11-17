import { createHash, randomBytes } from 'node:crypto';
import {
  isTrustedDecisionLinkedExternalPostcondition,
  type ExpectedDecisionOutcomeBinding,
  type OutcomeVerification,
} from '../system/OutcomeVerificationService.ts';
import { sha256Stable } from '../core/StableSerialization.ts';

export interface NeuralJitActivationCapture {
  captureId: string;
  taskFamily: string;
  taskFingerprint: string;
  modelFingerprint: string;
  toolId: string;
  executionId: string;
  decisionId: string;
  inputFingerprint: string;
  seed: number;
  capturedAt: number;
  inputFeatures: number[];
  targetResidual: number[];
}

/** Injected by the host-owned local-model adapter; absent by default. */
export interface NeuralJitActivationCaptureVerifier {
  verifyCapture(
    capture: unknown,
    expected: Pick<NeuralJitActivationCapture,
      'taskFamily' | 'taskFingerprint' | 'modelFingerprint' | 'toolId' |
      'executionId' | 'decisionId' | 'inputFingerprint' | 'seed'>,
  ): boolean | Promise<boolean>;
}

export interface NeuralJitTraceInput {
  capture: unknown;
  verification: unknown;
  binding: ExpectedDecisionOutcomeBinding;
}

type TraceSplit = 'train' | 'holdout';
export type NeuralJitCandidateStatus = 'shadow' | 'eligible' | 'rejected' | 'quarantined';

interface NeuralJitTrace {
  id: string; taskFamily: string; taskFingerprint: string; modelFingerprint: string;
  toolId: string; executionId: string; decisionId: string; observationId: string;
  seed: number; split: TraceSplit; inputFeatures: number[]; targetResidual: number[];
}

export interface NeuralJitHoldoutEvaluation {
  eligible: boolean; status: 'eligible' | 'shadow' | 'rejected'; reasons: string[];
  holdoutTraceCount: number; uniqueHoldoutTasks: number; uniqueHoldoutSeeds: number;
  baselineMse: number | null; candidateMse: number | null; relativeGain01: number;
  improvedSamples01: number; holdoutTaskFingerprints: string[]; evaluatedAt: number;
}

export interface NeuralJitCandidate {
  id: string; status: NeuralJitCandidateStatus; taskFamily: string; modelFingerprint: string;
  rank: 1; inputDimension: number; outputDimension: number;
  meanInput: number[]; inputBasis: number[]; meanOutput: number[]; outputDirection: number[];
  trainTraceCount: number; trainingTaskFingerprints: string[];
  trainingEvidenceFingerprint: string; evaluation: NeuralJitHoldoutEvaluation | null; createdAt: number;
}

export interface NeuralJitPersistedSnapshot {
  version: 1; splitSalt: string; candidates: NeuralJitCandidate[];
  acceptedTraces: number; rejectedTraces: number; lastDecision: string; lastDecisionAt: number;
  /** Bounded one-way replay guards; raw provider IDs are never persisted. */
  seenObservationFingerprints?: string[];
  seenCaptureFingerprints?: string[];
}

const MAX_TRACE_COUNT = 1024;
const MAX_CANDIDATES = 16;
const MAX_REPLAY_FINGERPRINTS = 4096;
const MAX_CAPTURE_AGE_MS = 10 * 60_000;
const MIN_TRAIN_TRACES = 12;
const MIN_HOLDOUT_TRACES = 8;
const MIN_HOLDOUT_TASKS = 8;
const MIN_HOLDOUT_SEEDS = 5;
const MAX_RESIDUAL_COEFFICIENT = 64;
const HEX_256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{1,119}$/i;
const SAFE_FAMILY = /^[a-z0-9][a-z0-9._:-]{1,79}$/i;
const clamp = (value: number) => Math.max(-8, Math.min(8, value));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function restoreFingerprintSet(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const recent = raw.slice(-MAX_REPLAY_FINGERPRINTS * 2);
  const valid = recent.filter((value): value is string => typeof value === 'string' && HEX_256.test(value));
  return Array.from(new Set(valid)).slice(-MAX_REPLAY_FINGERPRINTS);
}

function rememberFingerprint(set: Set<string>, value: string): void {
  set.add(value);
  while (set.size > MAX_REPLAY_FINGERPRINTS) {
    const oldest = set.values().next().value;
    if (typeof oldest !== 'string') break;
    set.delete(oldest);
  }
}

/** Stable, complete request identity shared by the runtime capture adapter and the JIT gate. */
export function neuralJitInputFingerprint(binding: ExpectedDecisionOutcomeBinding): string {
  return sha256Stable({
    toolId: binding.toolId,
    input: binding.input,
    executionId: binding.executionId,
    decisionId: binding.decisionId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(row => 'value' in row && row.enumerable);
  } catch { return false; }
}
function vector(value: unknown, max: number, maxAbs = 8): number[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length = Object.getOwnPropertyDescriptor(value, 'length');
    if (!length || !('value' in length) || !Number.isSafeInteger(length.value) ||
        Number(length.value) < 1 || Number(length.value) > max) return null;
    const size = Number(length.value);
    const keys = Reflect.ownKeys(value);
    // Dense, plain numeric arrays only. Reject holes, accessors, symbols and
    // custom properties rather than invoking caller-controlled array getters.
    if (keys.length !== size + 1 || !keys.includes('length')) return null;
    const result: number[] = [];
    for (let index = 0; index < size; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) return null;
      const item = descriptor.value;
      if (typeof item !== 'number' || !Number.isFinite(item) || Math.abs(item) > maxAbs) return null;
      result.push(item);
    }
    return result;
  } catch {
    return null;
  }
}

function dataField(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && 'value' in descriptor && descriptor.enumerable === true
    ? descriptor.value
    : undefined;
}

function snapshotOutcomeBinding(raw: unknown): ExpectedDecisionOutcomeBinding | null {
  if (!isRecord(raw)) return null;
  try {
    const toolId = dataField(raw, 'toolId');
    const input = dataField(raw, 'input');
    const executionId = dataField(raw, 'executionId');
    const decisionId = dataField(raw, 'decisionId');
    if (typeof toolId !== 'string' || !toolId.trim() || toolId.length > 180 ||
        !isRecord(input) || typeof executionId !== 'string' ||
        typeof decisionId !== 'string' || !decisionId.trim() || decisionId.length > 180) return null;
    const isolatedInput = structuredClone(input);
    if (!isRecord(isolatedInput)) return null;
    return Object.freeze({ toolId, input: isolatedInput, executionId, decisionId });
  } catch {
    return null;
  }
}
function dot(a: number[], b: number[]): number {
  let sum = 0; for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i]; return sum;
}
function normalize(values: number[]): number[] | null {
  const norm = Math.sqrt(dot(values, values));
  return !Number.isFinite(norm) || norm < 1e-9 ? null : values.map(value => value / norm);
}
function mean(rows: number[][], dimension: number): number[] {
  const result = Array(dimension).fill(0) as number[];
  for (const row of rows) for (let i = 0; i < dimension; i += 1) result[i] += row[i] / rows.length;
  return result;
}
function mse(a: number[], b: number[]): number {
  let total = 0; for (let i = 0; i < b.length; i += 1) total += (a[i] - b[i]) ** 2;
  return total / b.length;
}
function restoreCandidate(raw: unknown): NeuralJitCandidate | null {
  if (!isRecord(raw)) return null;
  const meanInput = vector(raw.meanInput, 256), inputBasis = vector(raw.inputBasis, 256);
  const meanOutput = vector(raw.meanOutput, 128), outputDirection = vector(raw.outputDirection, 128, MAX_RESIDUAL_COEFFICIENT);
  const fingerprints = Array.isArray(raw.trainingTaskFingerprints)
    ? raw.trainingTaskFingerprints.filter((x): x is string => typeof x === 'string' && HEX_256.test(x)).slice(0, MAX_TRACE_COUNT)
    : [];
  if (!meanInput || !inputBasis || !meanOutput || !outputDirection ||
      meanInput.length !== inputBasis.length || meanOutput.length !== outputDirection.length ||
      !fingerprints.length || typeof raw.id !== 'string' || !HEX_256.test(raw.id) ||
      typeof raw.taskFamily !== 'string' || !SAFE_FAMILY.test(raw.taskFamily) ||
      typeof raw.modelFingerprint !== 'string' || !HEX_256.test(raw.modelFingerprint) ||
      typeof raw.trainingEvidenceFingerprint !== 'string' || !HEX_256.test(raw.trainingEvidenceFingerprint) ||
      !Number.isSafeInteger(raw.trainTraceCount) || Number(raw.trainTraceCount) < MIN_TRAIN_TRACES ||
      !Number.isSafeInteger(raw.createdAt) || Number(raw.createdAt) <= 0) return null;
  return {
    id: raw.id, status: 'quarantined', taskFamily: raw.taskFamily, modelFingerprint: raw.modelFingerprint,
    rank: 1, inputDimension: meanInput.length, outputDimension: meanOutput.length,
    meanInput, inputBasis, meanOutput, outputDirection, trainTraceCount: Number(raw.trainTraceCount),
    trainingTaskFingerprints: Array.from(new Set(fingerprints)),
    trainingEvidenceFingerprint: raw.trainingEvidenceFingerprint, evaluation: null, createdAt: Number(raw.createdAt),
  };
}

export class NeuralJitEngine {
  private readonly activationCaptureVerifier?: NeuralJitActivationCaptureVerifier;
  private splitSalt = randomBytes(32).toString('hex');
  private traces: NeuralJitTrace[] = [];
  private candidates: NeuralJitCandidate[] = [];
  private acceptedTraces = 0;
  private rejectedTraces = 0;
  private readonly seenObservationFingerprints = new Set<string>();
  private readonly seenCaptureFingerprints = new Set<string>();
  private lastDecision = 'idle';
  private lastDecisionAt = 0;

  constructor(options: { activationCaptureVerifier?: NeuralJitActivationCaptureVerifier } = {}) {
    this.activationCaptureVerifier = options.activationCaptureVerifier;
  }

  async recordVerifiedTrace(input: NeuralJitTraceInput): Promise<
    { accepted: true; traceId: string; split: TraceSplit } | { accepted: false; reason: string }
  > {
    if (!this.activationCaptureVerifier) return this.reject('activation-capture-authority-unavailable');
    if (!isRecord(input)) return this.reject('invalid-trace-envelope');
    const binding = snapshotOutcomeBinding(dataField(input, 'binding'));
    const rawCapture = dataField(input, 'capture');
    if (!binding || !isRecord(rawCapture)) return this.reject('invalid-trace-envelope');
    const verificationValue = dataField(input, 'verification');
    if (!isTrustedDecisionLinkedExternalPostcondition(verificationValue, binding)) {
      return this.reject('untrusted-outcome-verification');
    }
    const verification = verificationValue as OutcomeVerification;
    let inputFingerprint = '';
    try { inputFingerprint = neuralJitInputFingerprint(binding); }
    catch { return this.reject('invalid-outcome-binding'); }

    // Snapshot every value before crossing the asynchronous host-verifier boundary.
    // The verifier receives the original object to preserve host WeakSet/WeakMap
    // provenance, but no mutable reference from it is read again after the await.
    const captureId = dataField(rawCapture, 'captureId');
    const taskFamily = dataField(rawCapture, 'taskFamily');
    const taskFingerprint = dataField(rawCapture, 'taskFingerprint');
    const modelFingerprint = dataField(rawCapture, 'modelFingerprint');
    const toolId = dataField(rawCapture, 'toolId');
    const executionId = dataField(rawCapture, 'executionId');
    const decisionId = dataField(rawCapture, 'decisionId');
    const captureInputFingerprint = dataField(rawCapture, 'inputFingerprint');
    const seed = dataField(rawCapture, 'seed');
    const capturedAt = dataField(rawCapture, 'capturedAt');
    if (typeof captureId !== 'string' || !SAFE_ID.test(captureId) ||
        typeof taskFamily !== 'string' || !SAFE_FAMILY.test(taskFamily) ||
        typeof taskFingerprint !== 'string' || !HEX_256.test(taskFingerprint) ||
        typeof modelFingerprint !== 'string' || !HEX_256.test(modelFingerprint) ||
        !Number.isSafeInteger(seed) || Number(seed) < 0 || Number(seed) > 1_000_000_000 ||
        !Number.isSafeInteger(capturedAt) || Number(capturedAt) <= 0 ||
        Number(capturedAt) > Date.now() + 300_000) return this.reject('invalid-activation-capture-metadata');
    if (Date.now() - Number(capturedAt) > MAX_CAPTURE_AGE_MS) return this.reject('activation-capture-expired');
    const inputFeatures = vector(dataField(rawCapture, 'inputFeatures'), 256);
    const targetResidual = vector(dataField(rawCapture, 'targetResidual'), 128);
    if (!inputFeatures || !targetResidual) return this.reject('invalid-activation-vector');
    const capture: NeuralJitActivationCapture = Object.freeze({
      captureId, taskFamily, taskFingerprint, modelFingerprint,
      toolId: typeof toolId === 'string' ? toolId : '',
      executionId: typeof executionId === 'string' ? executionId : '',
      decisionId: typeof decisionId === 'string' ? decisionId : '',
      inputFingerprint: typeof captureInputFingerprint === 'string' ? captureInputFingerprint : '',
      seed: Number(seed), capturedAt: Number(capturedAt),
      inputFeatures: Object.freeze(inputFeatures) as unknown as number[],
      targetResidual: Object.freeze(targetResidual) as unknown as number[],
    });
    const expected = {
      taskFamily, taskFingerprint, modelFingerprint,
      toolId: binding.toolId, executionId: binding.executionId, decisionId: binding.decisionId,
      inputFingerprint, seed: Number(seed),
    };
    let trusted = false;
    try { trusted = await this.activationCaptureVerifier.verifyCapture(rawCapture, expected); }
    catch { return this.reject('activation-capture-verification-failed'); }
    if (!trusted) return this.reject('untrusted-activation-capture');
    if (capture.toolId !== binding.toolId || capture.executionId !== binding.executionId ||
        capture.decisionId !== binding.decisionId || capture.inputFingerprint !== inputFingerprint) {
      return this.reject('activation-capture-binding-mismatch');
    }

    const observationId = String(verification.observationId ?? '').trim();
    if (!observationId || observationId.length > 180) return this.reject('missing-observation-id');
    const observationFingerprint = digest(observationId);
    const captureFingerprint = digest([
      capture.captureId, capture.taskFingerprint, capture.modelFingerprint,
      capture.toolId, capture.executionId, capture.decisionId, capture.inputFingerprint,
    ].join('\\u0000'));
    if (this.seenObservationFingerprints.has(observationFingerprint)) return this.reject('duplicate-outcome-observation');
    if (this.seenCaptureFingerprints.has(captureFingerprint)) return this.reject('duplicate-activation-capture');
    if (this.traces.length >= MAX_TRACE_COUNT) return this.reject('trace-buffer-full');
    const id = digest([capture.captureId, observationId, capture.taskFingerprint, capture.modelFingerprint].join('\u0000'));
    if (this.traces.some(trace => trace.id === id)) return this.reject('duplicate-neural-jit-trace');
    const bucket = Number.parseInt(digest(this.splitSalt + '\u0000' + capture.taskFingerprint).slice(0, 8), 16) % 5;
    const split: TraceSplit = bucket === 0 ? 'holdout' : 'train';
    this.traces.push({
      id, taskFamily: capture.taskFamily, taskFingerprint: capture.taskFingerprint,
      modelFingerprint: capture.modelFingerprint, toolId: binding.toolId,
      executionId: binding.executionId, decisionId: binding.decisionId, observationId,
      seed: capture.seed, split, inputFeatures, targetResidual,
    });
    rememberFingerprint(this.seenObservationFingerprints, observationFingerprint);
    rememberFingerprint(this.seenCaptureFingerprints, captureFingerprint);
    this.acceptedTraces += 1;
    this.lastDecision = 'trace-admitted:' + split;
    this.lastDecisionAt = Date.now();
    return { accepted: true, traceId: id, split };
  }

  compileCandidate(input: { taskFamily: string; modelFingerprint: string }): NeuralJitCandidate | null {
    const taskFamily = typeof input?.taskFamily === 'string' ? input.taskFamily.trim() : '';
    const modelFingerprint = typeof input?.modelFingerprint === 'string' ? input.modelFingerprint.toLowerCase() : '';
    if (!SAFE_FAMILY.test(taskFamily) || !HEX_256.test(modelFingerprint)) return null;
    const train = this.traces.filter(trace => trace.split === 'train' &&
      trace.taskFamily === taskFamily && trace.modelFingerprint === modelFingerprint);
    if (train.length < MIN_TRAIN_TRACES ||
        new Set(train.map(trace => trace.taskFingerprint)).size < MIN_TRAIN_TRACES) return null;
    const inputDimension = train[0].inputFeatures.length, outputDimension = train[0].targetResidual.length;
    if (train.some(trace => trace.inputFeatures.length !== inputDimension ||
        trace.targetResidual.length !== outputDimension)) return null;
    const meanInput = mean(train.map(trace => trace.inputFeatures), inputDimension);
    const meanOutput = mean(train.map(trace => trace.targetResidual), outputDimension);
    const trainingEvidenceFingerprint = digest(train.map(trace => trace.id).sort().join('\n'));
    // A deterministic hash-seeded direction avoids a systematic null projection
    // when the principal component is orthogonal to an all-ones initializer.
    const initialDirection = Array.from({ length: inputDimension }, (_, index) => {
      const word = Number.parseInt(digest(`${trainingEvidenceFingerprint}|${index}`).slice(0, 8), 16);
      return (word / 0xffff_ffff) * 2 - 1;
    });
    let inputBasis = normalize(initialDirection) ?? normalize(Array(inputDimension).fill(1));
    if (!inputBasis) return null;

    // Rank-1 PCA on centered activations; no model weights are modified here.
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const next = Array(inputDimension).fill(0) as number[];
      for (const trace of train) {
        const centered = trace.inputFeatures.map((value, index) => value - meanInput[index]);
        const projection = dot(centered, inputBasis);
        for (let index = 0; index < inputDimension; index += 1) next[index] += projection * centered[index];
      }
      const normalized = normalize(next);
      if (!normalized) return null;
      inputBasis = normalized;
    }
    let energy = 0;
    const numerator = Array(outputDimension).fill(0) as number[];
    for (const trace of train) {
      const projection = dot(trace.inputFeatures.map((v, i) => v - meanInput[i]), inputBasis);
      energy += projection * projection;
      for (let i = 0; i < outputDimension; i += 1) {
        numerator[i] += projection * (trace.targetResidual[i] - meanOutput[i]);
      }
    }
    if (energy < 1e-9) return null;
    const outputDirection = numerator.map(value => value / energy);
    if(outputDirection.some(value => !Number.isFinite(value) || Math.abs(value)>MAX_RESIDUAL_COEFFICIENT)) {
      this.lastDecision = 'compile-blocked:residual-coefficient-out-of-range';
      this.lastDecisionAt = Date.now();
      return null;
    }
    const trainingTaskFingerprints = Array.from(new Set(train.map(trace => trace.taskFingerprint))).sort();
    const candidateId = digest(['neural-jit-rank1-v1', modelFingerprint, taskFamily, trainingEvidenceFingerprint].join('|'));
    const candidate: NeuralJitCandidate = {
      id: candidateId,
      status: 'shadow', taskFamily, modelFingerprint, rank: 1, inputDimension, outputDimension,
      meanInput, inputBasis, meanOutput, outputDirection, trainTraceCount: train.length,
      trainingTaskFingerprints, trainingEvidenceFingerprint, evaluation: null, createdAt: Date.now(),
    };
    this.candidates = [...this.candidates.filter(row => row.id !== candidateId && row.status !== 'rejected'), candidate].slice(-MAX_CANDIDATES);
    this.lastDecision = 'candidate-compiled:shadow';
    this.lastDecisionAt = Date.now();
    return structuredClone(candidate);
  }

  evaluateCandidate(candidateId: string): NeuralJitHoldoutEvaluation {
    const candidate = this.candidates.find(row => row.id === candidateId);
    if (!candidate) return this.emptyEvaluation(['candidate-not-found']);
    if (candidate.status === 'rejected') return candidate.evaluation ?? this.emptyEvaluation(['candidate-already-rejected']);
    const trained = new Set(candidate.trainingTaskFingerprints);
    const holdout = this.traces.filter(trace => trace.split === 'holdout' &&
      trace.taskFamily === candidate.taskFamily && trace.modelFingerprint === candidate.modelFingerprint &&
      !trained.has(trace.taskFingerprint));
    const tasks = new Set(holdout.map(trace => trace.taskFingerprint));
    const seeds = new Set(holdout.map(trace => trace.seed));
    const reasons: string[] = [];
    if (holdout.length < MIN_HOLDOUT_TRACES) reasons.push('insufficient-independent-holdout-traces');
    if (tasks.size < MIN_HOLDOUT_TASKS) reasons.push('insufficient-independent-holdout-tasks');
    if (seeds.size < MIN_HOLDOUT_SEEDS) reasons.push('insufficient-independent-holdout-seeds');
    if (holdout.some(trace => trace.inputFeatures.length !== candidate.inputDimension ||
      trace.targetResidual.length !== candidate.outputDimension)) reasons.push('holdout-vector-dimension-mismatch');
    if (reasons.length) {
      const result = this.emptyEvaluation(reasons, holdout, tasks, seeds);
      candidate.status = 'shadow'; candidate.evaluation = result;
      this.lastDecision = 'evaluation-blocked:independent-holdout-required';
      this.lastDecisionAt = Date.now();
      return structuredClone(result);
    }

    let baselineTotal = 0, candidateTotal = 0, improved = 0;
    for (const trace of holdout) {
      const baseline = mse(Array(candidate.outputDimension).fill(0), trace.targetResidual);
      const projection = dot(trace.inputFeatures.map((v, i) => v - candidate.meanInput[i]), candidate.inputBasis);
      const predicted = candidate.meanOutput.map((v, i) =>
        clamp(v + candidate.outputDirection[i] * projection));
      const candidateError = mse(predicted, trace.targetResidual);
      baselineTotal += baseline; candidateTotal += candidateError;
      if (candidateError + 1e-12 < baseline) improved += 1;
    }
    const baselineMse = baselineTotal / holdout.length;
    const candidateMse = candidateTotal / holdout.length;
    const relativeGain01 = baselineMse <= 1e-12 ? 0 : (baselineMse - candidateMse) / baselineMse;
    const improvedSamples01 = improved / holdout.length;
    if (baselineMse <= 1e-12) reasons.push('baseline-already-zero-error');
    if (relativeGain01 < 0.05) reasons.push('holdout-gain-below-threshold');
    if (improvedSamples01 < 0.8) reasons.push('holdout-improvement-not-consistent');
    const eligible = reasons.length === 0;
    const result: NeuralJitHoldoutEvaluation = {
      eligible, status: eligible ? 'eligible' : 'rejected', reasons,
      holdoutTraceCount: holdout.length, uniqueHoldoutTasks: tasks.size, uniqueHoldoutSeeds: seeds.size,
      baselineMse, candidateMse, relativeGain01, improvedSamples01,
      holdoutTaskFingerprints: Array.from(tasks).sort(), evaluatedAt: Date.now(),
    };
    candidate.status = eligible ? 'eligible' : 'rejected';
    candidate.evaluation = result;
    this.lastDecision = eligible ? 'candidate-eligible:shadow-only' : 'candidate-rejected:holdout-regression';
    this.lastDecisionAt = Date.now();
    return structuredClone(result);
  }

  /**
   * Project a trained rank-1 residual for a model-host-owned detached shadow branch.
   * The result is advisory data only: it is never applied to the primary inference path.
   */
  projectShadowResidual(candidateId: string, rawInputFeatures: unknown) {
    const candidate=this.candidates.find(row=>row.id===candidateId && row.status==='eligible');
    if(!candidate) return null;
    const inputFeatures=vector(rawInputFeatures,256);
    if(!inputFeatures || inputFeatures.length!==candidate.inputDimension) return null;
    const projection=dot(inputFeatures.map((value,index)=>value-candidate.meanInput[index]),candidate.inputBasis);
    const residual=candidate.meanOutput.map((value,index)=>clamp(value+candidate.outputDirection[index]*projection));
    return {
      candidateId:candidate.id,
      rank:1 as const,
      residual,
      inputFingerprint:sha256Stable(inputFeatures),
      mode:'shadow' as const,
      appliedToInference:false as const,
      fallback:'base-inference-path' as const,
    };
  }

  persistenceSnapshot(): NeuralJitPersistedSnapshot {
    return {
      version: 1, splitSalt: this.splitSalt,
      candidates: this.candidates.slice(-MAX_CANDIDATES).map(candidate => structuredClone(candidate)),
      acceptedTraces: this.acceptedTraces, rejectedTraces: this.rejectedTraces,
      lastDecision: this.lastDecision, lastDecisionAt: this.lastDecisionAt,
      seenObservationFingerprints: Array.from(this.seenObservationFingerprints),
      seenCaptureFingerprints: Array.from(this.seenCaptureFingerprints),
    };
  }

  restore(raw?: Partial<NeuralJitPersistedSnapshot> | null): void {
    if (!raw || raw.version !== 1 || typeof raw.splitSalt !== 'string' || !HEX_256.test(raw.splitSalt)) {
      this.traces = []; this.candidates = [];
      this.seenObservationFingerprints.clear(); this.seenCaptureFingerprints.clear();
      this.acceptedTraces = 0; this.rejectedTraces = 0;
      this.lastDecision = 'restore-empty-or-invalid-snapshot'; this.lastDecisionAt = Date.now();
      return;
    }
    this.splitSalt = raw.splitSalt;
    this.traces = [];
    this.seenObservationFingerprints.clear(); this.seenCaptureFingerprints.clear();
    for (const value of restoreFingerprintSet(raw.seenObservationFingerprints)) this.seenObservationFingerprints.add(value);
    for (const value of restoreFingerprintSet(raw.seenCaptureFingerprints)) this.seenCaptureFingerprints.add(value);
    this.acceptedTraces = Number.isSafeInteger(raw.acceptedTraces) ? Math.max(0, Number(raw.acceptedTraces)) : 0;
    this.rejectedTraces = Number.isSafeInteger(raw.rejectedTraces) ? Math.max(0, Number(raw.rejectedTraces)) : 0;
    this.candidates = Array.isArray(raw.candidates)
      ? raw.candidates.map(restoreCandidate).filter((row): row is NeuralJitCandidate => row !== null).slice(-MAX_CANDIDATES)
      : [];
    this.lastDecision = 'restore-candidates-quarantined'; this.lastDecisionAt = Date.now();
  }

  diagnostics() {
    return {
      version: 1 as const, mode: 'shadow' as const,
      activationCaptureAuthorityConfigured: Boolean(this.activationCaptureVerifier),
      liveInferenceEnabled: false as const, activeCandidates: 0,
      acceptedTraces: this.acceptedTraces, rejectedTraces: this.rejectedTraces,
      replayProtection: {
        observationFingerprints: this.seenObservationFingerprints.size,
        captureFingerprints: this.seenCaptureFingerprints.size,
        maximumPerKind: MAX_REPLAY_FINGERPRINTS,
      },
      splitCounts: {
        train: this.traces.filter(row => row.split === 'train').length,
        holdout: this.traces.filter(row => row.split === 'holdout').length,
      },
      candidates: this.candidates.map(row => ({
        id: row.id, status: row.status, taskFamily: row.taskFamily,
        modelFingerprint: row.modelFingerprint, rank: row.rank, trainTraceCount: row.trainTraceCount,
        evaluation: row.evaluation ? structuredClone(row.evaluation) : null,
      })),
      lastDecision: this.lastDecision, lastDecisionAt: this.lastDecisionAt,
      fallback: 'base-inference-path' as const,
    };
  }

  private reject(reason: string): { accepted: false; reason: string } {
    this.rejectedTraces += 1; this.lastDecision = 'trace-rejected:' + reason;
    this.lastDecisionAt = Date.now(); return { accepted: false, reason };
  }

  private emptyEvaluation(
    reasons: string[],
    rows: NeuralJitTrace[] = [],
    tasks = new Set(rows.map(row => row.taskFingerprint)),
    seeds = new Set(rows.map(row => row.seed)),
  ): NeuralJitHoldoutEvaluation {
    return {
      eligible: false, status: 'shadow', reasons, holdoutTraceCount: rows.length,
      uniqueHoldoutTasks: tasks.size, uniqueHoldoutSeeds: seeds.size,
      baselineMse: null, candidateMse: null, relativeGain01: 0, improvedSamples01: 0,
      holdoutTaskFingerprints: Array.from(tasks).sort(), evaluatedAt: Date.now(),
    };
  }
}
