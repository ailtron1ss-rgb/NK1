/**
 * PredictiveLoop v1 — cheap predictive/self-monitoring layer.
 *
 * This is NOT a claim of consciousness. It models a useful cognitive loop:
 * predict -> observe -> measure mismatch -> update -> keep a compact trace.
 * It is intentionally CPU-cheap so it can run on mid-range Android.
 */

export interface PredictionTrace {
  id: string;
  createdAt: number;
  cue: string;
  prediction: string;
  confidence: number;
  actual?: string;
  error: number;
  resolved: boolean;
}

export interface PredictiveSnapshot {
  active?: PredictionTrace;
  history: PredictionTrace[];
  averageError: number;
  calibration: number;
}

const KEY = 'kurisu_predictive_loop_v1';
const MAX = 24;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const id = () => `pred_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function load(): PredictiveSnapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { history: [], averageError: 0, calibration: 50 };
    const p = JSON.parse(raw) as Partial<PredictiveSnapshot>;
    return {
      active: p.active,
      history: Array.isArray(p.history) ? p.history.slice(0, MAX) : [],
      averageError: clamp(Number(p.averageError ?? 0)),
      calibration: clamp(Number(p.calibration ?? 50))
    };
  } catch {
    return { history: [], averageError: 0, calibration: 50 };
  }
}

function save(s: PredictiveSnapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* persistence is optional */ }
}

class PredictiveLoop {
  private state = load();

  getSnapshot(): PredictiveSnapshot {
    return JSON.parse(JSON.stringify(this.state));
  }

  predict(cue: string, prediction: string, confidence: number) {
    const trace: PredictionTrace = {
      id: id(), createdAt: Date.now(), cue: cue.slice(0, 180),
      prediction: prediction.slice(0, 240), confidence: clamp(confidence),
      error: 0, resolved: false
    };
    this.state.active = trace;
    save(this.state);
    return trace;
  }

  resolve(actual: string, mismatchHint?: number) {
    const active = this.state.active;
    if (!active) return null;
    const actualText = actual.slice(0, 240);
    const semanticMismatch = mismatchHint ?? this.estimateMismatch(active.prediction, actualText);
    active.actual = actualText;
    active.error = clamp(semanticMismatch);
    active.resolved = true;
    this.state.history.unshift(active);
    this.state.history = this.state.history.slice(0, MAX);
    this.state.averageError = this.state.averageError * 0.86 + active.error * 0.14;
    const calibrationTarget = 100 - Math.abs(active.error - (100 - active.confidence));
    this.state.calibration = this.state.calibration * 0.9 + clamp(calibrationTarget) * 0.1;
    this.state.active = undefined;
    save(this.state);
    return active;
  }

  buildPromptHint(maxChars = 700) {
    const a = this.state.active;
    const lines = [
      '[PREDICTIVE LOOP]',
      a ? `active_prediction=${a.prediction.slice(0, 180)} | confidence=${Math.round(a.confidence)}` : 'active_prediction=none',
      `recent_prediction_error=${Math.round(this.state.averageError)} | calibration=${Math.round(this.state.calibration)}`,
      'Prefer calibrated uncertainty: if evidence is weak, verify or say that confidence is limited.'
    ];
    return lines.join('\n').slice(0, maxChars);
  }

  private estimateMismatch(prediction: string, actual: string) {
    const a = new Set(prediction.toLowerCase().split(/\W+/).filter(x => x.length > 3));
    const b = new Set(actual.toLowerCase().split(/\W+/).filter(x => x.length > 3));
    if (!a.size || !b.size) return 55;
    let overlap = 0;
    a.forEach(x => { if (b.has(x)) overlap += 1; });
    return clamp(100 - (overlap / Math.max(a.size, b.size)) * 100);
  }
}

export const predictiveLoop = new PredictiveLoop();
