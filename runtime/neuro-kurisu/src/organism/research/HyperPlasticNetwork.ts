import type { B292CognitiveStateBusState } from '../system/B292CognitiveStateBus.ts';

export type HyperPlasticTaskType =
  | 'reasoning' | 'retrieval' | 'planning' | 'coding'
  | 'perception' | 'dialogue' | 'unknown';
export type HyperPlasticStrategy =
  | 'verify' | 'explore' | 'retrieve' | 'respond'
  | 'reflect' | 'defer' | 'other';

export interface HyperPlasticContext {
  taskType: HyperPlasticTaskType;
  strategy: HyperPlasticStrategy;
  confidence01: number;
  uncertainty01: number;
  novelty01: number;
  resourceBudget01: number;
  cognitiveLoad01: number;
  thermal01: number;
  readiness01: number;
  stability01: number;
}

export interface HyperPlasticContextSource {
  taskType: HyperPlasticTaskType;
  strategy: HyperPlasticStrategy;
  confidence01: number;
  resourceBudget01: number;
}

export interface HyperPlasticNetworkConfig {
  target: { layer: string; rows: number; cols: number };
  rank?: number;
  hiddenDim?: number;
  alpha?: number;
  maxFactorAbs?: number;
  maxDeltaNormL2?: number;
  minResourceBudget01?: number;
  minReadiness01?: number;
  minStability01?: number;
  maxUncertainty01?: number;
  seed?: number;
}

export interface HyperPlasticLoRAAdapter {
  schema: 'nk1-lora-v1';
  fingerprint: string;
  baseModelFingerprint: string;
  target: { layer: string; rows: number; cols: number };
  rank: number;
  alpha: number;
  A: number[][];
  B: number[][];
  maxFactorAbs: number;
  maxDeltaNormL2: number;
  deltaNormL2: number;
  generatedFrom: {
    tick: number;
    taskType: HyperPlasticTaskType;
    strategy: HyperPlasticStrategy;
  };
}

export type HyperPlasticGenerationResult =
  | { status: 'candidate'; reason: 'generated'; adapter: HyperPlasticLoRAAdapter }
  | { status: 'fallback'; reason: string; adapter: null };

export interface HyperPlasticParameterSnapshot {
  schema: 'nk1.hyper-plastic-weights.v1';
  fingerprint: string;
  featureCount: number;
  hiddenDim: number;
  outputDim: number;
  targetLayer: string;
  targetRows: number;
  targetCols: number;
  rank: number;
  alpha: number;
  maxFactorAbs: number;
  inputWeights: number[][];
  inputBias: number[];
  outputWeights: number[][];
  outputBias: number[];
}

const TASK_TYPES: HyperPlasticTaskType[] = [
  'reasoning', 'retrieval', 'planning', 'coding', 'perception', 'dialogue', 'unknown',
];
const STRATEGIES: HyperPlasticStrategy[] = [
  'verify', 'explore', 'retrieve', 'respond', 'reflect', 'defer', 'other',
];
const NUMERIC_FEATURES = 8;
const FEATURE_COUNT = TASK_TYPES.length + STRATEGIES.length + NUMERIC_FEATURES;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isFinite01 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function seededUnit(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b9)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value ^= value >>> 15;
  return ((value >>> 0) / 0xffffffff) * 2 - 1;
}

function hashFingerprint(value: unknown): string {
  const source = JSON.stringify(value);
  if (typeof source !== 'string') throw new TypeError('fingerprint-payload-not-serializable');
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ome26-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateContext(context: HyperPlasticContext): string | null {
  if (!context || !TASK_TYPES.includes(context.taskType) || !STRATEGIES.includes(context.strategy)) {
    return 'context-enum-invalid';
  }
  const fields: (keyof HyperPlasticContext)[] = [
    'confidence01', 'uncertainty01', 'novelty01', 'resourceBudget01',
    'cognitiveLoad01', 'thermal01', 'readiness01', 'stability01',
  ];
  return fields.every((field) => isFinite01(context[field])) ? null : 'context-feature-invalid';
}

function encodeContext(context: HyperPlasticContext): number[] {
  const task = TASK_TYPES.map((item) => item === context.taskType ? 1 : 0);
  const strategy = STRATEGIES.map((item) => item === context.strategy ? 1 : 0);
  return [
    ...task,
    ...strategy,
    context.confidence01,
    context.uncertainty01,
    context.novelty01,
    context.resourceBudget01,
    context.cognitiveLoad01,
    context.thermal01,
    context.readiness01,
    context.stability01,
  ];
}

function matrix(rows: number, cols: number, seed: number, scale: number): number[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => seededUnit(seed, row * cols + col) * scale));
}

function calculateDelta(adapter: HyperPlasticLoRAAdapter): number[][] {
  const { rows, cols } = adapter.target;
  const scale = adapter.alpha / adapter.rank;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      let sum = 0;
      for (let component = 0; component < adapter.rank; component += 1) {
        sum += adapter.B[row][component] * adapter.A[component][col];
      }
      return scale * sum;
    }));
}

function matrixNormL2(values: number[][]): number {
  let sum = 0;
  for (const row of values) for (const value of row) sum += value * value;
  return Math.sqrt(sum);
}

function freezeAdapter(adapter: HyperPlasticLoRAAdapter): HyperPlasticLoRAAdapter {
  Object.freeze(adapter.target);
  for (const row of adapter.A) Object.freeze(row);
  for (const row of adapter.B) Object.freeze(row);
  Object.freeze(adapter.A);
  Object.freeze(adapter.B);
  Object.freeze(adapter.generatedFrom);
  return Object.freeze(adapter) as HyperPlasticLoRAAdapter;
}

function adapterFingerprint(adapter: Omit<HyperPlasticLoRAAdapter, 'fingerprint' | 'deltaNormL2'>): string {
  return hashFingerprint({
    schema: adapter.schema,
    baseModelFingerprint: adapter.baseModelFingerprint,
    target: adapter.target,
    rank: adapter.rank,
    alpha: adapter.alpha,
    A: adapter.A,
    B: adapter.B,
    maxFactorAbs: adapter.maxFactorAbs,
    maxDeltaNormL2: adapter.maxDeltaNormL2,
    generatedFrom: adapter.generatedFrom,
  });
}

/**
 * Convert the existing per-cycle B292 state into a stable, normalized input.
 * The caller supplies task/confidence/strategy and the live remaining budget
 * from CognitiveBudgetManager; no second cognitive-state owner is introduced.
 */
export function hyperPlasticContextFromB292(
  state: B292CognitiveStateBusState,
  source: HyperPlasticContextSource,
): HyperPlasticContext {
  const context: HyperPlasticContext = {
    taskType: source.taskType,
    strategy: source.strategy,
    confidence01: source.confidence01,
    uncertainty01: state.uncertainty01,
    novelty01: state.novelty01,
    resourceBudget01: source.resourceBudget01,
    cognitiveLoad01: state.cognitiveLoad01,
    thermal01: state.thermal01,
    readiness01: state.readiness01,
    stability01: state.stability01,
  };
  const error = validateContext(context);
  if (error) throw new RangeError(error);
  return context;
}

/**
 * Research-only hypernetwork: a compact MLP maps normalized organism state to
 * bounded LoRA A/B factors. It only emits a candidate; it never mutates model
 * weights or activates an adapter.
 */
export class HyperPlasticNetwork {
  private readonly config: Required<Omit<HyperPlasticNetworkConfig, 'target'>> & {
    target: HyperPlasticNetworkConfig['target'];
  };
  private inputWeights: number[][];
  private inputBias: number[];
  private outputWeights: number[][];
  private outputBias: number[];
  private readonly outputDim: number;

  constructor(config: HyperPlasticNetworkConfig) {
    const rank = config.rank ?? 2;
    const hiddenDim = config.hiddenDim ?? 12;
    const alpha = config.alpha ?? rank;
    const maxFactorAbs = config.maxFactorAbs ?? 0.05;
    const maxDeltaNormL2 = config.maxDeltaNormL2 ?? 0.12;
    const minResourceBudget01 = config.minResourceBudget01 ?? 0.25;
    const minReadiness01 = config.minReadiness01 ?? 0.30;
    const minStability01 = config.minStability01 ?? 0.35;
    const maxUncertainty01 = config.maxUncertainty01 ?? 0.90;
    const seed = config.seed ?? 26;
    const target = { ...config.target };

    if (!target || typeof target.layer !== 'string' || !target.layer.trim() || target.layer.length > 160) {
      throw new RangeError('target-layer-invalid');
    }
    if (!Number.isInteger(target.rows) || target.rows < 1 || target.rows > 64
      || !Number.isInteger(target.cols) || target.cols < 1 || target.cols > 64) {
      throw new RangeError('target-shape-out-of-bounds');
    }
    if (!Number.isInteger(rank) || rank < 1 || rank > 4
      || !Number.isInteger(hiddenDim) || hiddenDim < 4 || hiddenDim > 32
      || rank * (target.rows + target.cols) > 512) {
      throw new RangeError('hypernetwork-size-out-of-bounds');
    }
    if (!Number.isFinite(alpha) || alpha <= 0 || alpha > rank * 4
      || !Number.isFinite(maxFactorAbs) || maxFactorAbs <= 0 || maxFactorAbs > 0.10
      || !Number.isFinite(maxDeltaNormL2) || maxDeltaNormL2 <= 0 || maxDeltaNormL2 > 1) {
      throw new RangeError('adapter-magnitude-out-of-bounds');
    }
    for (const [name, value] of Object.entries({
      minResourceBudget01, minReadiness01, minStability01, maxUncertainty01,
    })) {
      if (!isFinite01(value)) throw new RangeError(`${name}-invalid`);
    }
    if (!Number.isSafeInteger(seed)) throw new RangeError('seed-invalid');

    this.config = {
      target, rank, hiddenDim, alpha, maxFactorAbs, maxDeltaNormL2,
      minResourceBudget01, minReadiness01, minStability01, maxUncertainty01, seed,
    };
    this.outputDim = rank * target.cols + target.rows * rank;
    const inputScale = Math.sqrt(2 / FEATURE_COUNT);
    const outputScale = Math.sqrt(2 / hiddenDim) * 0.08;
    this.inputWeights = matrix(hiddenDim, FEATURE_COUNT, seed ^ 0x126, inputScale);
    this.inputBias = new Array(hiddenDim).fill(0);
    this.outputWeights = matrix(this.outputDim, hiddenDim, seed ^ 0x260, outputScale);
    this.outputBias = new Array(this.outputDim).fill(0);
  }

  snapshotParameters(): HyperPlasticParameterSnapshot {
    const payload = {
      schema: 'nk1.hyper-plastic-weights.v1' as const,
      featureCount: FEATURE_COUNT,
      hiddenDim: this.config.hiddenDim,
      outputDim: this.outputDim,
      targetLayer: this.config.target.layer,
      targetRows: this.config.target.rows,
      targetCols: this.config.target.cols,
      rank: this.config.rank,
      alpha: this.config.alpha,
      maxFactorAbs: this.config.maxFactorAbs,
      inputWeights: this.inputWeights.map((row) => [...row]),
      inputBias: [...this.inputBias],
      outputWeights: this.outputWeights.map((row) => [...row]),
      outputBias: [...this.outputBias],
    };
    return { ...payload, fingerprint: hashFingerprint(payload) };
  }

  restoreParameters(snapshot: HyperPlasticParameterSnapshot): void {
    if (!snapshot || snapshot.schema !== 'nk1.hyper-plastic-weights.v1'
      || snapshot.featureCount !== FEATURE_COUNT
      || snapshot.hiddenDim !== this.config.hiddenDim
      || snapshot.outputDim !== this.outputDim
      || snapshot.targetLayer !== this.config.target.layer
      || snapshot.targetRows !== this.config.target.rows
      || snapshot.targetCols !== this.config.target.cols
      || snapshot.rank !== this.config.rank
      || snapshot.alpha !== this.config.alpha
      || snapshot.maxFactorAbs !== this.config.maxFactorAbs) {
      throw new RangeError('hypernetwork-checkpoint-shape-mismatch');
    }
    const validMatrix = (value: unknown, rows: number, cols: number): value is number[][] =>
      Array.isArray(value) && value.length === rows
      && value.every((row) => Array.isArray(row) && row.length === cols
        && row.every((item) => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 8));
    const validVector = (value: unknown, length: number): value is number[] =>
      Array.isArray(value) && value.length === length
      && value.every((item) => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 8);
    if (!validMatrix(snapshot.inputWeights, this.config.hiddenDim, FEATURE_COUNT)
      || !validVector(snapshot.inputBias, this.config.hiddenDim)
      || !validMatrix(snapshot.outputWeights, this.outputDim, this.config.hiddenDim)
      || !validVector(snapshot.outputBias, this.outputDim)) {
      throw new RangeError('hypernetwork-checkpoint-nonfinite-or-malformed');
    }
    const { fingerprint, ...payload } = snapshot;
    if (typeof fingerprint !== 'string' || fingerprint !== hashFingerprint(payload)) {
      throw new RangeError('hypernetwork-checkpoint-fingerprint-mismatch');
    }
    this.inputWeights = snapshot.inputWeights.map((row) => [...row]);
    this.inputBias = [...snapshot.inputBias];
    this.outputWeights = snapshot.outputWeights.map((row) => [...row]);
    this.outputBias = [...snapshot.outputBias];
  }

  /**
   * Offline supervised fitting step. Targets must come from an explicitly
   * selected research objective; this method is never called by live runtime.
   */
  trainStep(
    context: HyperPlasticContext,
    targetFactors: number[],
    learningRate = 0.01,
  ): { loss: number; applied: true } {
    const contextError = validateContext(context);
    if (contextError) throw new RangeError(contextError);
    if (!Array.isArray(targetFactors) || targetFactors.length !== this.outputDim
      || targetFactors.some((value) => !Number.isFinite(value)
        || Math.abs(value) > this.config.maxFactorAbs)) {
      throw new RangeError('training-target-out-of-bounds');
    }
    if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 0.05) {
      throw new RangeError('training-rate-out-of-bounds');
    }
    const input = encodeContext(context);
    const hidden = this.inputWeights.map((row, index) => {
      let value = this.inputBias[index];
      for (let column = 0; column < FEATURE_COUNT; column += 1) {
        value += row[column] * input[column];
      }
      return Math.tanh(value);
    });
    const outputZ = this.outputWeights.map((row, index) => {
      let value = this.outputBias[index];
      for (let column = 0; column < this.config.hiddenDim; column += 1) {
        value += row[column] * hidden[column];
      }
      return value;
    });
    const outputUnit = outputZ.map((value) => Math.tanh(value));
    const targetUnit = targetFactors.map((value) => value / this.config.maxFactorAbs);
    const errors = outputUnit.map((value, index) => value - targetUnit[index]);
    const loss = errors.reduce((sum, value) => sum + value * value, 0) / this.outputDim;
    const outputGradients = errors.map((error, index) =>
      (2 * error / this.outputDim) * (1 - outputUnit[index] * outputUnit[index]));
    const hiddenGradients = hidden.map((value, hiddenIndex) => {
      let gradient = 0;
      for (let outputIndex = 0; outputIndex < this.outputDim; outputIndex += 1) {
        gradient += outputGradients[outputIndex] * this.outputWeights[outputIndex][hiddenIndex];
      }
      return gradient * (1 - value * value);
    });

    for (let outputIndex = 0; outputIndex < this.outputDim; outputIndex += 1) {
      for (let hiddenIndex = 0; hiddenIndex < this.config.hiddenDim; hiddenIndex += 1) {
        this.outputWeights[outputIndex][hiddenIndex] -=
          learningRate * outputGradients[outputIndex] * hidden[hiddenIndex];
      }
      this.outputBias[outputIndex] -= learningRate * outputGradients[outputIndex];
    }
    for (let hiddenIndex = 0; hiddenIndex < this.config.hiddenDim; hiddenIndex += 1) {
      for (let inputIndex = 0; inputIndex < FEATURE_COUNT; inputIndex += 1) {
        this.inputWeights[hiddenIndex][inputIndex] -=
          learningRate * hiddenGradients[hiddenIndex] * input[inputIndex];
      }
      this.inputBias[hiddenIndex] -= learningRate * hiddenGradients[hiddenIndex];
    }
    return { loss, applied: true };
  }

  generateCandidate(
    context: HyperPlasticContext,
    baseModelFingerprint: string,
    tick = 0,
  ): HyperPlasticGenerationResult {
    const contextError = validateContext(context);
    if (contextError) return { status: 'fallback', reason: contextError, adapter: null };
    if (typeof baseModelFingerprint !== 'string' || !baseModelFingerprint.trim()
      || baseModelFingerprint.length > 256) {
      return { status: 'fallback', reason: 'base-model-fingerprint-missing', adapter: null };
    }
    if (!Number.isSafeInteger(tick) || tick < 0) {
      return { status: 'fallback', reason: 'tick-invalid', adapter: null };
    }
    if (context.resourceBudget01 < this.config.minResourceBudget01) {
      return { status: 'fallback', reason: 'resource-budget-below-floor', adapter: null };
    }
    if (context.readiness01 < this.config.minReadiness01
      || context.stability01 < this.config.minStability01) {
      return { status: 'fallback', reason: 'cognitive-state-not-ready', adapter: null };
    }
    if (context.uncertainty01 > this.config.maxUncertainty01) {
      return { status: 'fallback', reason: 'uncertainty-above-ceiling', adapter: null };
    }

    const input = encodeContext(context);
    const hidden = this.inputWeights.map((row, index) => {
      let value = this.inputBias[index];
      for (let column = 0; column < FEATURE_COUNT; column += 1) {
        value += row[column] * input[column];
      }
      return Math.tanh(value);
    });
    const output = this.outputWeights.map((row, index) => {
      let value = this.outputBias[index];
      for (let column = 0; column < this.config.hiddenDim; column += 1) {
        value += row[column] * hidden[column];
      }
      return Math.tanh(value) * this.config.maxFactorAbs;
    });
    const { rank, target, alpha, maxFactorAbs, maxDeltaNormL2 } = this.config;
    let cursor = 0;
    const A = Array.from({ length: rank }, () =>
      Array.from({ length: target.cols }, () => clamp(output[cursor++], -maxFactorAbs, maxFactorAbs)));
    const B = Array.from({ length: target.rows }, () =>
      Array.from({ length: rank }, () => clamp(output[cursor++], -maxFactorAbs, maxFactorAbs)));
    const draft: Omit<HyperPlasticLoRAAdapter, 'fingerprint' | 'deltaNormL2'> = {
      schema: 'nk1-lora-v1',
      baseModelFingerprint,
      target: { ...target },
      rank,
      alpha,
      A,
      B,
      maxFactorAbs,
      maxDeltaNormL2,
      generatedFrom: {
        tick,
        taskType: context.taskType,
        strategy: context.strategy,
      },
    };
    let deltaNormL2 = matrixNormL2(calculateDelta({ ...draft, fingerprint: '', deltaNormL2: 0 }));
    if (deltaNormL2 > maxDeltaNormL2) {
      const factorScale = Math.sqrt(maxDeltaNormL2 / deltaNormL2);
      for (const row of A) for (let index = 0; index < row.length; index += 1) row[index] *= factorScale;
      for (const row of B) for (let index = 0; index < row.length; index += 1) row[index] *= factorScale;
      deltaNormL2 = matrixNormL2(calculateDelta({ ...draft, fingerprint: '', deltaNormL2: 0 }));
    }
    const finalized: Omit<HyperPlasticLoRAAdapter, 'fingerprint'> = {
      ...draft,
      deltaNormL2,
    };
    const adapter: HyperPlasticLoRAAdapter = {
      ...finalized,
      fingerprint: adapterFingerprint(finalized),
    };
    return { status: 'candidate', reason: 'generated', adapter: freezeAdapter(adapter) };
  }
}

/**
 * Pure LoRA composition for a tiny offline experiment matrix. A fresh matrix is
 * returned; the caller's baseline matrix is never modified in place.
 */
export function applyLowRankAdapter(
  baseline: number[][],
  adapter: HyperPlasticLoRAAdapter,
): number[][] {
  if (!adapter || !adapter.target
    || !Number.isInteger(adapter.target.rows) || !Number.isInteger(adapter.target.cols)
    || adapter.target.rows < 1 || adapter.target.cols < 1
    || !Array.isArray(baseline) || baseline.length !== adapter.target.rows
    || baseline.some((row) => !Array.isArray(row) || row.length !== adapter.target.cols
      || row.some((value) => !Number.isFinite(value)))) {
    throw new RangeError('baseline-matrix-shape-or-value-invalid');
  }
  if (adapter.schema !== 'nk1-lora-v1'
    || typeof adapter.target.layer !== 'string' || !adapter.target.layer.trim()
    || !Number.isFinite(adapter.alpha) || adapter.alpha <= 0
    || !Number.isFinite(adapter.maxFactorAbs) || adapter.maxFactorAbs <= 0 || adapter.maxFactorAbs > 0.10
    || !Number.isFinite(adapter.maxDeltaNormL2) || adapter.maxDeltaNormL2 <= 0
    || adapter.rank < 1 || adapter.rank > 4
    || adapter.A.length !== adapter.rank
    || adapter.A.some((row) => row.length !== adapter.target.cols)
    || adapter.B.length !== adapter.target.rows
    || adapter.B.some((row) => row.length !== adapter.rank)
    || adapter.A.concat(adapter.B).some((row) =>
      row.some((value) => !Number.isFinite(value) || Math.abs(value) > adapter.maxFactorAbs + 1e-9))) {
    throw new RangeError('adapter-shape-or-factor-bound-invalid');
  }
  const { fingerprint, deltaNormL2, ...fingerprintPayload } = adapter;
  if (fingerprint !== adapterFingerprint(fingerprintPayload)) {
    throw new RangeError('adapter-fingerprint-mismatch');
  }
  const delta = calculateDelta(adapter);
  const actualDeltaNorm = matrixNormL2(delta);
  if (!Number.isFinite(deltaNormL2) || Math.abs(actualDeltaNorm - deltaNormL2) > 1e-8) {
    throw new RangeError('adapter-delta-norm-mismatch');
  }
  if (actualDeltaNorm > adapter.maxDeltaNormL2 + 1e-8) {
    throw new RangeError('adapter-delta-norm-exceeded');
  }
  return baseline.map((row, rowIndex) =>
    row.map((value, colIndex) => value + delta[rowIndex][colIndex]));
}
