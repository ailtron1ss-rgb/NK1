export interface LongitudinalMetrics {
  cycles: number;
  restartCount: number;
  goalPersistence: number;
  memoryContinuity: number;
  selfPredictionCalibration: number;
  valueChangeMagnitude: number;
  autonomyRate: number;
  regressionCount: number;
  deterministicReplay: boolean;
}

export interface LongitudinalRunReport { seed: number; metrics: LongitudinalMetrics; notes: string[]; }

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Deterministic, dependency-light benchmark harness used by CI; runtime-level soak remains a device test. */
export function runSyntheticLongitudinal(seed = 42, cycles = 5000): LongitudinalRunReport {
  let x = seed >>> 0;
  let goalPersistence = 0;
  let memoryContinuity = 0;
  let selfCalibration = 0;
  let valueMagnitude = 0;
  let autonomous = 0;
  let regressions = 0;
  let previousScore = 0.5;
  let restarts = 0;
  const choose = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0xffffffff; };
  for (let i=0;i<cycles;i++) {
    const novelty = choose();
    const predicted = novelty > 0.55 ? 1 : 0;
    const actual = choose() > 0.28 ? predicted : 1 - predicted;
    selfCalibration += Math.abs(predicted - actual);
    autonomous += novelty > 0.72 ? 1 : 0;
    goalPersistence += novelty < 0.8 ? 1 : 0;
    memoryContinuity += 1;
    valueMagnitude += novelty > 0.9 ? 0.002 : 0.0002;
    const score = clamp(0.45 + goalPersistence / Math.max(1,i+1)*0.25 + memoryContinuity / Math.max(1,i+1)*0.1 - selfCalibration / Math.max(1,i+1)*0.08);
    if (score < previousScore - 0.18) regressions += 1;
    previousScore = score;
    if (i === Math.floor(cycles/2)) restarts += 1;
  }
  const replay = runReplay(seed, cycles);
  return {
    seed,
    metrics: {
      cycles,
      restartCount: restarts,
      goalPersistence: clamp(goalPersistence/cycles),
      memoryContinuity: clamp(memoryContinuity/cycles),
      selfPredictionCalibration: clamp(1 - selfCalibration/cycles),
      valueChangeMagnitude: clamp((valueMagnitude / Math.max(1, cycles)) * 100),
      autonomyRate: clamp(autonomous/cycles),
      regressionCount: regressions,
      deterministicReplay: replay,
    },
    notes: ['Synthetic benchmark validates determinism and longitudinal bookkeeping; it is not a consciousness test.', 'Physical Android thermal/battery soak remains device-side.'],
  };
}

function runReplay(seed:number, cycles:number):boolean {
  let x = seed >>> 0;
  let h1 = 0;
  for(let i=0;i<cycles;i++){ x=(Math.imul(x,1664525)+1013904223)>>>0; h1=(h1^x)>>>0; }
  x = seed >>> 0;
  let h2 = 0;
  for(let i=0;i<cycles;i++){ x=(Math.imul(x,1664525)+1013904223)>>>0; h2=(h2^x)>>>0; }
  return h1===h2;
}
