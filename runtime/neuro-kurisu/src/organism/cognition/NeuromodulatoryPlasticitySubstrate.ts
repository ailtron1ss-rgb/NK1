import { symlog } from '../system/UpstreamReplayPrimitives.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x: number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const tanh = (x: number) => Math.tanh(Number.isFinite(x) ? x : 0);

function seededWeight(seed: number, scale = 0.025) {
  let x = (seed | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x ^= x >>> 15;
  return (((x >>> 0) / 4294967295) * 2 - 1) * scale;
}

function makeMatrix(rows: number, cols: number, seed: number) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => seededWeight(seed + r * 127 + c * 19)),
  );
}

export interface NeuromodulatoryPlasticityInput {
  dopamine01: number;
  norepinephrine01: number;
  acetylcholine01: number;
  serotonin01: number;
  explorationBias01: number;
  attentionGain01: number;
  updateRate01: number;
  predictionError01: number;
  uncertainty01: number;
  novelty01: number;
  energy01: number;
  load01: number;
  tick: number;
  at: number;
}

export interface NeuromodulatoryPlasticityState {
  version: 2;
  hiddenDim: number;
  inputDim: number;
  hidden: number[];
  inputWeights: number[][];
  recurrentWeights: number[][];
  outputWeights: number[][];
  outputBias: number[];
  lastInput: number[];
  lastOutput: number[];
  samples: number;
  learningSteps: number;
  eligibility: number[];
  outputWeightUncertainty: number[][];
  recurrentWeightUncertainty: number[][];
  outputWeightAnchor: number[][];
  outputWeightImportance: number[][];
  metaplasticity01: number;
  lastRewardSignal01: number;
  modulation01: number;
  quality: {
    validated: boolean;
    baselineImprovement01: number;
    modelImprovement01: number;
    advantage01: number;
    samples: number;
  };
  lastTick: number;
  lastAt: number;
}

function defaults(): NeuromodulatoryPlasticityState {
  const inputDim = 12;
  const hiddenDim = 24;
  const outputDim = 4;
  return {
    version: 2,
    hiddenDim,
    inputDim,
    hidden: new Array(hiddenDim).fill(0),
    inputWeights: makeMatrix(hiddenDim, inputDim, 61001),
    recurrentWeights: makeMatrix(hiddenDim, hiddenDim, 62001),
    outputWeights: makeMatrix(outputDim, hiddenDim, 63001),
    outputBias: new Array(outputDim).fill(0),
    lastInput: new Array(inputDim).fill(0),
    lastOutput: new Array(outputDim).fill(0.5),
    samples: 0,
    learningSteps: 0,
    eligibility: new Array(hiddenDim).fill(0),
    outputWeightUncertainty: makeMatrix(outputDim, hiddenDim, 64001).map((row) => row.map((value) => clamp01(0.65 - Math.abs(value) * 3))),
    recurrentWeightUncertainty: makeMatrix(hiddenDim, hiddenDim, 65001).map((row) => row.map((value) => clamp01(0.65 - Math.abs(value) * 3))),
    outputWeightAnchor: makeMatrix(outputDim, hiddenDim, 63001),
    outputWeightImportance: new Array(outputDim).fill(null).map(() => new Array(hiddenDim).fill(0)),
    metaplasticity01: 0.5,
    lastRewardSignal01: 0.5,
    modulation01: 0.5,
    quality: {
      validated: false,
      baselineImprovement01: 0,
      modelImprovement01: 0,
      advantage01: 0,
      samples: 0,
    },
    lastTick: 0,
    lastAt: 0,
  };
}

function importanceMassForDiagnostics(matrix: number[][]) {
  const values = matrix.flat();
  return values.reduce((sum, value) => sum + clamp01(value), 0) / Math.max(1, values.length);
}

export class NeuromodulatoryPlasticitySubstrate {
  private state = defaults();

  snapshot() {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<NeuromodulatoryPlasticityState> | null) {
    const d = defaults();
    const r = raw ?? {};
    const arr = (value: unknown, length: number, fill = 0) => {
      if (!Array.isArray(value)) return new Array(length).fill(fill);
      return value.slice(0, length)
        .concat(new Array(Math.max(0, length - value.length)).fill(fill))
        .slice(0, length);
    };
    const matrix = (value: unknown, rows: number, cols: number, seed: number) => {
      if (!Array.isArray(value)) return makeMatrix(rows, cols, seed);
      return Array.from({ length: rows }, (_, i) => arr(value[i], cols));
    };
    this.state = {
      ...d,
      ...r,
      version: 2,
      hidden: arr(r.hidden, d.hiddenDim),
      inputWeights: matrix(r.inputWeights, d.hiddenDim, d.inputDim, 61001),
      recurrentWeights: matrix(r.recurrentWeights, d.hiddenDim, d.hiddenDim, 62001),
      outputWeights: matrix(r.outputWeights, 4, d.hiddenDim, 63001),
      outputBias: arr(r.outputBias, 4, 0.5),
      lastInput: arr(r.lastInput, d.inputDim),
      lastOutput: arr(r.lastOutput, 4, 0.5),
      eligibility: arr(r.eligibility, d.hiddenDim),
      outputWeightUncertainty: matrix(r.outputWeightUncertainty, 4, d.hiddenDim, 64001).map((row) => row.map((v) => clamp01(Number(v ?? .65)))),
      recurrentWeightUncertainty: matrix(r.recurrentWeightUncertainty, d.hiddenDim, d.hiddenDim, 65001).map((row) => row.map((v) => clamp01(Number(v ?? .65)))),
      outputWeightAnchor: matrix(r.outputWeightAnchor ?? d.outputWeightAnchor, 4, d.hiddenDim, 63001),
      outputWeightImportance: matrix(r.outputWeightImportance ?? d.outputWeightImportance, 4, d.hiddenDim, 66001).map((row) => row.map((v) => clamp01(Number(v ?? 0)))),
      metaplasticity01: clamp01(Number(r.metaplasticity01 ?? d.metaplasticity01)),
      quality: { ...d.quality, ...(r.quality ?? {}) },
    };
  }

  private pack(input: NeuromodulatoryPlasticityInput) {
    return [
      input.dopamine01,
      input.norepinephrine01,
      input.acetylcholine01,
      input.serotonin01,
      input.explorationBias01,
      input.attentionGain01,
      input.updateRate01,
      input.predictionError01,
      input.uncertainty01,
      input.novelty01,
      input.energy01,
      input.load01,
    ].map(clamp01);
  }

  private hiddenStep(input: number[]) {
    const previous = this.state.hidden;
    const next = new Array(this.state.hiddenDim).fill(0);
    for (let j = 0; j < next.length; j += 1) {
      let z = 0;
      for (let k = 0; k < this.state.inputDim; k += 1) {
        z += (this.state.inputWeights[j][k] ?? 0) * (input[k] ?? 0);
      }
      for (let k = 0; k < this.state.hiddenDim; k += 1) {
        z += (this.state.recurrentWeights[j][k] ?? 0) * (previous[k] ?? 0);
      }
      next[j] = tanh(z);
    }
    return next;
  }

  private output(hidden: number[]) {
    return this.state.outputWeights.map((row, index) => {
      let z = this.state.outputBias[index] ?? 0;
      for (let j = 0; j < this.state.hiddenDim; j += 1) {
        z += (row[j] ?? 0) * (hidden[j] ?? 0);
      }
      return clamp01(0.5 + 0.35 * Math.tanh(z));
    });
  }

  observe(input: NeuromodulatoryPlasticityInput) {
    const packed = this.pack(input);
    const hidden = this.hiddenStep(packed);
    const output = this.output(hidden);
    const pressure = clamp01(
      0.5 * input.predictionError01
      + 0.25 * input.uncertainty01
      + 0.15 * input.novelty01
      + 0.1 * input.load01,
    );

    this.state.eligibility = this.state.eligibility.map((value, index) =>
      clamp11(0.92 * value + 0.08 * (hidden[index] ?? 0) * pressure));
    this.state.hidden = hidden;
    this.state.lastInput = packed;
    this.state.lastOutput = output;
    this.state.samples += 1;
    this.state.learningSteps += 1;
    this.state.modulation01 = pressure;
    this.state.lastTick = input.tick;
    this.state.lastAt = input.at;
    this.state.quality.samples = this.state.samples;
    return this.globalState();
  }

  learnFromOutcome(rewardSignal01: number, predictionDelta01: number) {
    const rewardError = clamp11(rewardSignal01 - 0.5);
    const delta = clamp11(predictionDelta01);
    const teachingSignal = clamp11(symlog(rewardError + delta * 0.65));
    const learningRate = 0.012 / Math.sqrt(1 + this.state.learningSteps / 5000);
    const uncertaintyFeedback = clamp01(0.5 + Math.abs(delta) * 0.35 + Math.abs(rewardError) * 0.25);
    const consolidationEvidence = clamp01(.25 + .45 * Math.abs(teachingSignal) + .20 * (1 - this.state.modulation01) + .10 * clamp01(Math.abs(delta)));
    const consolidationStrength = .0018 * (0.35 + 0.65 * this.state.metaplasticity01) * consolidationEvidence;
    let uncertaintyMass = 0;

    for (let outputIndex = 0; outputIndex < 4; outputIndex += 1) {
      const gain = outputIndex === 0 ? 1 : outputIndex === 1 ? 0.7 : outputIndex === 2 ? 0.55 : 0.35;
      for (let j = 0; j < this.state.hiddenDim; j += 1) {
        const uncertainty = clamp01(this.state.outputWeightUncertainty[outputIndex]?.[j] ?? 0.65);
        const plasticity = 0.35 + 0.65 * uncertainty;
        const importance = clamp01(this.state.outputWeightImportance[outputIndex]?.[j] ?? 0);
        const anchoredDelta = this.state.outputWeights[outputIndex][j]! - (this.state.outputWeightAnchor[outputIndex]?.[j] ?? this.state.outputWeights[outputIndex][j]!);
        const consolidationCorrection = -consolidationStrength * importance * anchoredDelta;
        const update = learningRate * teachingSignal * (this.state.eligibility[j] ?? 0) * gain * plasticity + consolidationCorrection;
        this.state.outputWeights[outputIndex][j] = clamp11(this.state.outputWeights[outputIndex][j] + update);
        const importanceGain = consolidationEvidence * (1 - uncertainty) * .0022;
        this.state.outputWeightImportance[outputIndex][j] = clamp01(importance + importanceGain - importance * .00035);
        this.state.outputWeightAnchor[outputIndex][j] = clamp11(
          (this.state.outputWeightAnchor[outputIndex]?.[j] ?? this.state.outputWeights[outputIndex][j]!)
          + .004 * consolidationEvidence * (1 - importance) * (this.state.outputWeights[outputIndex][j]! - (this.state.outputWeightAnchor[outputIndex]?.[j] ?? this.state.outputWeights[outputIndex][j]!)),
        );
        this.state.outputWeightUncertainty[outputIndex][j] = clamp01(
          uncertainty * 0.997
          + uncertaintyFeedback * 0.0015
          + (Math.abs(update) < 1e-7 ? 0.00025 : -0.00035)
        );
        uncertaintyMass += this.state.outputWeightUncertainty[outputIndex][j];
      }
      this.state.outputBias[outputIndex] = clamp11(
        this.state.outputBias[outputIndex] + learningRate * teachingSignal * (outputIndex === 0 ? 1 : 0.6),
      );
    }

    this.state.metaplasticity01 = clamp01(this.state.metaplasticity01 * 0.94 + (uncertaintyMass / Math.max(1, 4 * this.state.hiddenDim)) * 0.06);

    this.state.lastRewardSignal01 = clamp01(rewardSignal01);
    this.state.quality.modelImprovement01 = clamp01(
      this.state.quality.modelImprovement01 + Math.max(0, delta) * 0.02,
    );
    this.state.quality.baselineImprovement01 = clamp01(
      this.state.quality.baselineImprovement01 + Math.max(0, rewardError) * 0.01,
    );
    this.state.quality.advantage01 = this.state.quality.modelImprovement01
      - this.state.quality.baselineImprovement01;
    this.state.quality.samples = this.state.samples;
    this.state.quality.validated = this.state.samples >= 96 && this.state.quality.advantage01 > 0.02;
    return this.globalState();
  }

  globalState() {
    return {
      modulation01: this.state.modulation01,
      plasticLearning01: this.state.learningSteps / Math.max(1, this.state.learningSteps + 64),
      explorationGain01: clamp01(this.state.lastOutput[0] ?? 0.5),
      attentionGain01: clamp01(this.state.lastOutput[1] ?? 0.5),
      updateRate01: clamp01(this.state.lastOutput[2] ?? 0.5),
      recoveryGain01: clamp01(this.state.lastOutput[3] ?? 0.5),
      quality: structuredClone(this.state.quality),
      metaplasticity01: this.state.metaplasticity01,
      outputUncertaintyMean01: this.state.outputWeightUncertainty.flat().reduce((a,b)=>a+b,0) / Math.max(1,this.state.outputWeightUncertainty.flat().length),
      outputImportanceMean01: importanceMassForDiagnostics(this.state.outputWeightImportance),
      samples: this.state.samples,
    };
  }
}
