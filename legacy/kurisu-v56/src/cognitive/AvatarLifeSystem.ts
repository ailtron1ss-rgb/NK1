/**
 * AvatarLifeSystem v1 — maps cognition to visual micro-behavior without assets.
 * Produces deterministic-ish state for gaze, breathing, posture and motion.
 */
import { clamp, readJson, writeJson } from './StateVault';

export interface AvatarLifeState {
  gazeX: number;
  gazeY: number;
  blinkRate: number;
  breathing: number;
  posture: 'neutral' | 'focused' | 'relaxed' | 'tired' | 'alert';
  motionEnergy: number;
  microExpression: number;
  ambientActivity: number;
  lastUpdateAt: number;
}
const KEY = 'kurisu_avatar_life_v1';
const fresh = (): AvatarLifeState => ({ gazeX: 0, gazeY: 0, blinkRate: 0.22, breathing: 0, posture: 'neutral', motionEnergy: 35, microExpression: 0, ambientActivity: 25, lastUpdateAt: 0 });

class AvatarLifeSystem {
  private state = readJson<AvatarLifeState>(KEY, fresh());
  snapshot() { return { ...this.state }; }
  update(input: { attention: number; curiosity: number; fatigue: number; confidence: number; speaking: boolean }, now = Date.now()) {
    const a = clamp(input.attention), c = clamp(input.curiosity), f = clamp(input.fatigue), conf = clamp(input.confidence);
    const t = now / 1000;
    this.state.gazeX = Math.sin(t * 0.37) * (10 + c * 0.12);
    this.state.gazeY = Math.cos(t * 0.29) * (6 + a * 0.08);
    this.state.blinkRate = clamp(18 + f * 0.35, 8, 55) / 100;
    this.state.breathing = (Math.sin(t * (input.speaking ? 1.7 : 1.1)) + 1) / 2;
    this.state.motionEnergy = clamp(18 + a * 0.55 + c * 0.25 - f * 0.45);
    this.state.microExpression = clamp((c * 0.35 + conf * 0.25) - f * 0.2);
    this.state.ambientActivity = clamp(20 + c * 0.5 - f * 0.35);
    this.state.posture = f > 72 ? 'tired' : a > 72 ? 'focused' : c > 70 ? 'alert' : a < 30 ? 'relaxed' : 'neutral';
    this.state.lastUpdateAt = now;
    writeJson(KEY, this.state);
    return this.snapshot();
  }
}
export const avatarLifeSystem = new AvatarLifeSystem();
