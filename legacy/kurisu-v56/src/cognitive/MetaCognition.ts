/** MetaCognition v1 — calibration, confidence and decision-quality checks. */
import { clamp, readJson, writeJson } from './StateVault';

export interface MetaSnapshot {
  decisions: number;
  overconfident: number;
  underconfident: number;
  averageConfidence: number;
  averageError: number;
  calibration: number;
  lastReviewAt: number;
}
const KEY = 'kurisu_meta_cognition_v1';
const fresh = (): MetaSnapshot => ({ decisions: 0, overconfident: 0, underconfident: 0, averageConfidence: 0, averageError: 0, calibration: 70, lastReviewAt: 0 });

class MetaCognition {
  private state = readJson<MetaSnapshot>(KEY, fresh());
  snapshot() { return { ...this.state }; }
  record(confidence: number, error: number) {
    const c = clamp(confidence), e = clamp(error);
    const n = this.state.decisions + 1;
    this.state.averageConfidence = (this.state.averageConfidence * this.state.decisions + c) / n;
    this.state.averageError = (this.state.averageError * this.state.decisions + e) / n;
    if (c > 75 && e > 60) this.state.overconfident++;
    if (c < 35 && e < 25) this.state.underconfident++;
    this.state.decisions = n;
    const miscalibration = Math.abs(c - (100 - e));
    this.state.calibration = clamp(this.state.calibration * 0.95 + (100 - miscalibration) * 0.05);
    writeJson(KEY, this.state);
  }
  review() { this.state.lastReviewAt = Date.now(); writeJson(KEY, this.state); }
  promptHint(max = 650) {
    const s = this.state;
    return `[META-COGNITION]\ncalibration=${Math.round(s.calibration)} avg_confidence=${Math.round(s.averageConfidence)} avg_error=${Math.round(s.averageError)}\nAvoid false certainty; confidence is a control signal, not proof.`.slice(0, max);
  }
}
export const metaCognition = new MetaCognition();
