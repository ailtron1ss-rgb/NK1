const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x: number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const tanh = (x: number) => Math.tanh(Number.isFinite(x) ? x : 0);

function seededWeight(seed: number, scale = 0.022) {
  let x = (seed | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x ^= x >>> 15;
  return (((x >>> 0) / 4294967295) * 2 - 1) * scale;
}

function makeMatrix(rows: number, cols: number, seed: number, scale = 0.022) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => seededWeight(seed + r * 193 + c * 17, scale)),
  );
}

export interface MultiHorizonAllostasisInput {
  tick: number;
  at: number;
  energy01: number;
  thermal01: number;
  capacity01: number;
  load01: number;
  arousal01: number;
  recoveryDebt01: number;
  pressure01: number;
  awake: boolean;
  uncertainty01: number;
  predictionError01: number;
}

export interface MultiHorizonAllostasisState {
  version: 1;
  inputDim: number;
  hiddenDim: number;
  outputDim: number;
  hidden: number[];
  inputWeights: number[][];
  recurrentWeights: number[][];
  outputWeights: number[][];
  outputBias: number[];
  lastInput: number[];
  lastState: number[];
  lastPrediction: number[][];
  lastErrors: number[];
  samples: number;
  learningSteps: number;
  validatedHorizons: number[];
  quality: {
    validated: boolean;
    baselineMAE: number;
    modelMAE: number;
    improvement01: number;
    samples: number;
    horizonErrors: number[];
  };
  lastTick: number;
  lastAt: number;
}

function defaults(): MultiHorizonAllostasisState {
  const inputDim = 9;
  const hiddenDim = 24;
  const outputDim = 5;
  return {
    version: 1,
    inputDim,
    hiddenDim,
    outputDim,
    hidden: new Array(hiddenDim).fill(0),
    inputWeights: makeMatrix(hiddenDim, inputDim, 51001),
    recurrentWeights: makeMatrix(hiddenDim, hiddenDim, 52001),
    outputWeights: makeMatrix(outputDim, hiddenDim, 53001),
    outputBias: new Array(outputDim).fill(0),
    lastInput: new Array(inputDim).fill(0),
    lastState: new Array(5).fill(0.5),
    lastPrediction: Array.from({ length: 3 }, () => new Array(5).fill(0.5)),
    lastErrors: new Array(3).fill(0.5),
    samples: 0,
    learningSteps: 0,
    validatedHorizons: [],
    quality: {
      validated: false,
      baselineMAE: 0.5,
      modelMAE: 0.5,
      improvement01: 0,
      samples: 0,
      horizonErrors: [0.5, 0.5, 0.5],
    },
    lastTick: 0,
    lastAt: 0,
  };
}

const targetFromInput = (input: MultiHorizonAllostasisInput) => [
  input.energy01,
  input.capacity01,
  1 - input.thermal01,
  1 - input.load01,
  input.awake ? 1 : 0,
].map(clamp01);

export class MultiHorizonAllostasisSubstrate {
  private state = defaults();

  snapshot() {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<MultiHorizonAllostasisState> | null) {
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
      hidden: arr(r.hidden, d.hiddenDim),
      inputWeights: matrix(r.inputWeights, d.hiddenDim, d.inputDim, 51001),
      recurrentWeights: matrix(r.recurrentWeights, d.hiddenDim, d.hiddenDim, 52001),
      outputWeights: matrix(r.outputWeights, 5, d.hiddenDim, 53001),
      outputBias: arr(r.outputBias, 5),
      lastInput: arr(r.lastInput, d.inputDim),
      lastState: arr(r.lastState, 5, 0.5),
      lastPrediction: Array.from({ length: 3 }, (_, i) =>
        arr(Array.isArray(r.lastPrediction) ? r.lastPrediction[i] : undefined, 5, 0.5),
      ),
      lastErrors: arr(r.lastErrors, 3, 0.5),
      quality: {
        ...d.quality,
        ...(r.quality ?? {}),
        horizonErrors: arr(r.quality?.horizonErrors, 3, 0.5),
      },
    };
  }

  private pack(input: MultiHorizonAllostasisInput) {
    return [
      input.energy01,
      input.thermal01,
      input.capacity01,
      input.load01,
      input.arousal01,
      input.recoveryDebt01,
      input.pressure01,
      input.awake ? 1 : 0,
      input.uncertainty01,
    ].map(clamp11);
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

  private projectHidden(hidden: number[], steps: number) {
    let current = hidden.slice();
    for (let step = 1; step < steps; step += 1) {
      const next = new Array(this.state.hiddenDim).fill(0);
      for (let j = 0; j < next.length; j += 1) {
        let z = 0;
        for (let k = 0; k < this.state.hiddenDim; k += 1) {
          z += (this.state.recurrentWeights[j][k] ?? 0) * (current[k] ?? 0);
        }
        next[j] = tanh(z);
      }
      current = next;
    }
    return current;
  }

  private predict(hidden: number[], base: number[]) {
    return [1, 2, 4].map((steps) => {
      const rolled = this.projectHidden(hidden, steps);
      const output = new Array(5);
      for (let i = 0; i < 5; i += 1) {
        let z = this.state.outputBias[i] ?? 0;
        for (let j = 0; j < this.state.hiddenDim; j += 1) {
          z += (this.state.outputWeights[i][j] ?? 0) * (rolled[j] ?? 0);
        }
        output[i] = clamp01((base[i] ?? 0.5) + 0.12 * Math.tanh(z) * Math.min(1, steps * 0.55));
      }
      return output;
    });
  }

  private learn(hidden: number[], input: number[], targetState: number[]) {
    const prediction = this.predict(hidden, targetState)[0];
    const learningRate = 0.009 / Math.sqrt(1 + this.state.learningSteps / 4000);
    const hiddenGradient = new Array(this.state.hiddenDim).fill(0);

    for (let i = 0; i < 5; i += 1) {
      const error = targetState[i] - prediction[i];
      const row = this.state.outputWeights[i];
      for (let j = 0; j < this.state.hiddenDim; j += 1) {
        hiddenGradient[j] += (row[j] ?? 0) * error;
        row[j] = clamp11((row[j] ?? 0) + learningRate * error * (hidden[j] ?? 0));
      }
      this.state.outputBias[i] = clamp11((this.state.outputBias[i] ?? 0) + learningRate * error);
    }

    for (let j = 0; j < this.state.hiddenDim; j += 1) {
      const delta = hiddenGradient[j] * (1 - (hidden[j] ?? 0) ** 2);
      for (let k = 0; k < this.state.inputDim; k += 1) {
        this.state.inputWeights[j][k] = clamp11(
          (this.state.inputWeights[j][k] ?? 0) + learningRate * delta * (input[k] ?? 0),
        );
      }
      for (let k = 0; k < this.state.hiddenDim; k += 1) {
        this.state.recurrentWeights[j][k] = clamp11(
          (this.state.recurrentWeights[j][k] ?? 0) + learningRate * delta * (this.state.hidden[k] ?? 0),
        );
      }
    }
  }

  observe(input: MultiHorizonAllostasisInput) {
    const packed = this.pack(input);
    const previousHidden = this.state.hidden.slice();
    const hidden = this.hiddenStep(packed);
    const targetState = targetFromInput(input);

    if (this.state.samples > 0) {
      this.learn(this.state.hidden.slice(), this.state.lastInput, this.state.lastState);
    }

    const predictions = this.predict(hidden, targetState);
    const errors = predictions.map(
      (prediction) => prediction.reduce((sum, value, index) => sum + Math.abs(value - targetState[index]), 0) / 5,
    );
    const persistenceBaseline = this.state.samples > 0
      ? this.state.lastState.reduce((sum, value, index) => sum + Math.abs(value - targetState[index]), 0) / 5
      : errors[0];

    this.state.hidden = hidden;
    this.state.lastInput = packed;
    this.state.lastState = targetState;
    this.state.lastPrediction = predictions;
    this.state.lastErrors = errors;
    this.state.samples += 1;
    this.state.learningSteps += 1;

    const oldQuality = this.state.quality;
    const modelMAE = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    const baselineMAE = oldQuality.samples > 0
      ? oldQuality.baselineMAE * 0.97 + persistenceBaseline * 0.03
      : persistenceBaseline;
    const improvement = clamp01((baselineMAE - modelMAE) / Math.max(0.02, baselineMAE));
    const validatedHorizons = errors
      .map((error, index) => ({ error, horizon: index + 1 }))
      .filter(({ error }) => error + 0.005 < Math.max(0.001, baselineMAE))
      .map(({ horizon }) => horizon);

    this.state.validatedHorizons = validatedHorizons;
    this.state.quality = {
      validated: this.state.samples >= 96 && validatedHorizons.length >= 2 && improvement >= 0.04,
      baselineMAE,
      modelMAE,
      improvement01: improvement,
      samples: this.state.samples,
      horizonErrors: errors,
    };
    this.state.lastTick = input.tick;
    this.state.lastAt = input.at;

    return {
      predictions: structuredClone(predictions),
      horizonErrors: errors,
      validatedHorizons: [...validatedHorizons],
      quality: structuredClone(this.state.quality),
    };
  }

  globalState() {
    return structuredClone(this.state.quality);
  }
}
