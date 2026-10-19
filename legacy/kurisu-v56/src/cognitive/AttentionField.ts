/**
 * AttentionField v1 — bounded competition for a tiny global workspace.
 * No LLM required. Designed to be called only on meaningful events.
 */
import { clamp, readJson, uid, writeJson } from './StateVault';

export type AttentionSource = 'user' | 'memory' | 'goal' | 'curiosity' | 'prediction' | 'self' | 'environment' | 'error';

export interface AttentionCandidate {
  id: string;
  source: AttentionSource;
  label: string;
  salience: number;
  urgency: number;
  novelty: number;
  relevance: number;
  uncertainty: number;
  emotionalLoad: number;
  createdAt: number;
  expiresAt?: number;
}

export interface AttentionSnapshot {
  workspace: AttentionCandidate[];
  lastWinnerId?: string;
  competitionCount: number;
  focusStability: number;
  capacity: number;
}

const KEY = 'kurisu_attention_field_v1';
const CAPACITY = 5;
const fresh = (): AttentionSnapshot => ({ workspace: [], competitionCount: 0, focusStability: 72, capacity: CAPACITY });

export class AttentionField {
  private state = readJson<AttentionSnapshot>(KEY, fresh());

  snapshot() { return JSON.parse(JSON.stringify(this.state)) as AttentionSnapshot; }

  submit(input: Omit<AttentionCandidate, 'id' | 'createdAt'>) {
    const candidate: AttentionCandidate = { ...input, id: uid('attn'), createdAt: Date.now() };
    this.state.workspace.push(candidate);
    this.state.workspace = this.state.workspace.slice(-18);
    return this.compete();
  }

  compete(now = Date.now()) {
    const active = this.state.workspace.filter(c => !c.expiresAt || c.expiresAt > now);
    const ranked = active.map(c => ({ c, score: this.score(c, now) })).sort((a, b) => b.score - a.score);
    const winners = ranked.slice(0, CAPACITY).map(x => x.c);
    const previous = this.state.lastWinnerId;
    this.state.workspace = winners;
    this.state.lastWinnerId = winners[0]?.id;
    this.state.competitionCount++;
    if (previous && winners[0]?.id === previous) this.state.focusStability = clamp(this.state.focusStability + 1.5);
    else this.state.focusStability = clamp(this.state.focusStability - 2.5 + (winners.length ? 1 : 0));
    writeJson(KEY, this.state);
    return { winner: winners[0], workspace: winners, score: winners[0] ? this.score(winners[0], now) : 0 };
  }

  decay(now = Date.now()) {
    this.state.workspace = this.state.workspace.filter(c => !c.expiresAt || c.expiresAt > now);
    this.state.workspace.forEach(c => {
      c.salience = clamp(c.salience * 0.985);
      c.emotionalLoad = clamp(c.emotionalLoad * 0.992);
    });
    writeJson(KEY, this.state);
  }

  promptHint(max = 1200) {
    const s = this.state;
    return [
      '[ATTENTION FIELD]',
      `capacity=${s.capacity} focus_stability=${Math.round(s.focusStability)}`,
      `workspace=${s.workspace.map(c => `${c.source}:${c.label.slice(0, 70)}`).join(' | ') || 'empty'}`,
      'Attention is a bounded resource; do not treat every candidate as equally important.'
    ].join('\n').slice(0, max);
  }

  private score(c: AttentionCandidate, now: number) {
    const ageSec = Math.max(0, (now - c.createdAt) / 1000);
    const decay = Math.max(0.35, 1 - ageSec / 180);
    return clamp(
      (c.salience * 0.22 + c.urgency * 0.20 + c.novelty * 0.14 + c.relevance * 0.20 + c.uncertainty * 0.08 + c.emotionalLoad * 0.16) * decay
    );
  }
}

export const attentionField = new AttentionField();
