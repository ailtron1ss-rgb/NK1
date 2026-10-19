import { randomUUID } from 'node:crypto';

export type PressureType = 'attention-debt'|'contradiction'|'commitment'|'prediction-error'|'social'|'goal'|'curiosity';

export interface CognitivePressure {
  id: string;
  type: PressureType;
  description: string;
  level: number;
  decayRate: number;
  createdAt: number;
  lastActivatedAt: number;
  sourceIds: string[];
}

export interface CognitiveFieldState {
  arousal01: number;
  valence01: number;
  uncertainty01: number;
  salience01: number;
  conflict01: number;
  socialPressure01: number;
  taskPressure01: number;
  fatigue01: number;
  coherence01: number;
  attentionDebt01: number;
  unresolvedCount: number;
  pressures: CognitivePressure[];
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export const defaultCognitiveField = (): CognitiveFieldState => ({
  arousal01: 0.42, valence01: 0.58, uncertainty01: 0.35, salience01: 0.25, conflict01: 0.08,
  socialPressure01: 0.20, taskPressure01: 0.18, fatigue01: 0.18, coherence01: 0.82,
  attentionDebt01: 0, unresolvedCount: 0, pressures: [],
});

export class CognitiveFieldEngine {
  private state = defaultCognitiveField();

  restore(state: CognitiveFieldState | undefined): void {
    this.state = {
      ...defaultCognitiveField(), ...(state ?? {}),
      pressures: Array.isArray(state?.pressures) ? state!.pressures.slice(0, 96).map((p) => ({ ...p, sourceIds: Array.isArray(p.sourceIds) ? p.sourceIds.slice(0, 16) : [] })) : [],
    };
  }

  update(input: {
    surprise: number;
    novelty: number;
    uncertainty: number;
    goalPressure: number;
    socialNeed: number;
    energy: number;
    cognitiveLoad: number;
    identityCoherence: number;
    rewardPredictionError: number;
  }): CognitiveFieldState {
    const a = clamp(input.surprise * 0.28 + input.novelty * 0.18 + input.goalPressure * 0.16 + (1 - input.energy) * 0.12 + input.cognitiveLoad * 0.26);
    const valence = clamp(0.5 + (0.5 - input.cognitiveLoad) * 0.22 + (0.5 - input.uncertainty) * 0.18 + (0.5 - input.rewardPredictionError) * 0.18);
    const conflict = clamp(Math.abs(input.uncertainty - input.identityCoherence) * 0.35 + input.goalPressure * 0.22 + this.state.conflict01 * 0.45);
    this.state.arousal01 = clamp(this.state.arousal01 * 0.72 + a * 0.28);
    this.state.valence01 = clamp(this.state.valence01 * 0.78 + valence * 0.22);
    this.state.uncertainty01 = clamp(this.state.uncertainty01 * 0.74 + input.uncertainty * 0.26);
    this.state.salience01 = clamp(this.state.salience01 * 0.64 + Math.max(input.surprise, input.novelty, input.goalPressure) * 0.36);
    this.state.conflict01 = clamp(this.state.conflict01 * 0.62 + conflict * 0.38);
    this.state.socialPressure01 = clamp(this.state.socialPressure01 * 0.78 + input.socialNeed * 0.22);
    this.state.taskPressure01 = clamp(this.state.taskPressure01 * 0.76 + input.goalPressure * 0.24);
    this.state.fatigue01 = clamp(this.state.fatigue01 * 0.84 + (1 - input.energy) * 0.10 + input.cognitiveLoad * 0.06);
    this.state.coherence01 = clamp(this.state.coherence01 * 0.82 + input.identityCoherence * 0.18);
    this.decayPressures();
    this.state.attentionDebt01 = clamp(this.state.pressures.filter((p) => p.type === 'attention-debt').reduce((s, p) => s + p.level, 0) / 3);
    this.state.unresolvedCount = this.state.pressures.filter((p) => p.level > 0.25).length;
    return this.snapshot();
  }

  addPressure(type: PressureType, description: string, level: number, sourceIds: string[] = [], decayRate = 0.02): CognitivePressure {
    const clean = description.trim().slice(0, 180);
    const now = Date.now();
    const existing = this.state.pressures.find((p) => p.type === type && p.description === clean);
    if (existing) {
      existing.level = clamp(existing.level * 0.72 + clamp(level) * 0.28);
      existing.lastActivatedAt = now;
      existing.sourceIds = Array.from(new Set([...existing.sourceIds, ...sourceIds])).slice(-16);
      return structuredClone(existing);
    }
    const p: CognitivePressure = { id: randomUUID(), type, description: clean, level: clamp(level), decayRate: clamp(decayRate), createdAt: now, lastActivatedAt: now, sourceIds: sourceIds.slice(0, 16) };
    this.state.pressures = [p, ...this.state.pressures].slice(0, 96);
    return structuredClone(p);
  }

  resolvePressure(id: string, reduction = 0.65): void {
    const p = this.state.pressures.find((x) => x.id === id);
    if (!p) return;
    p.level = clamp(p.level * (1 - clamp(reduction)));
  }

  private decayPressures(): void {
    this.state.pressures = this.state.pressures.map((p) => ({ ...p, level: clamp(p.level * (1 - p.decayRate)) })).filter((p) => p.level > 0.03);
  }

  snapshot(): CognitiveFieldState { return structuredClone(this.state); }
  planningSnapshot(): CognitiveFieldState { return { ...this.state, pressures:this.state.pressures.slice(0,96), }; }
}
