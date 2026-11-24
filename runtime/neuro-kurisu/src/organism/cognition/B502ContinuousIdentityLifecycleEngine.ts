/**
 * B502 Continuous Identity Lifecycle Engine
 *
 * Compact identity continuity substrate for mobile/Termux execution.
 * It models continuity as a bounded, evidence-driven state rather than a
 * monotonically increasing counter.
 */
export interface IdentityEvent {
  id: string;
  timestamp: number;
  significance: number;
  emotionalWeight: number;
  tags: string[];
}

export interface IdentityState {
  continuityScore: number;
  accumulatedExperience: number;
  traits: Record<string, number>;
  history: IdentityEvent[];
}

const clamp01 = (value:number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export class B502ContinuousIdentityLifecycleEngine {
  private state: IdentityState = {
    continuityScore: 0.5,
    accumulatedExperience: 0,
    traits: { curiosity: 0.5, persistence: 0.5, reflection: 0.5 },
    history: [],
  };

  absorb(event: IdentityEvent): IdentityState {
    const significance = clamp01(event.significance);
    const emotionalWeight = clamp01(event.emotionalWeight);
    const influence = clamp01(significance * 0.7 + emotionalWeight * 0.3);
    this.state.accumulatedExperience += influence;
    // Bounded smoothing prevents an endless upward drift and preserves room
    // for later evidence to move the identity state in either direction.
    this.state.continuityScore = clamp01(this.state.continuityScore * 0.985 + influence * 0.015);

    if (event.tags.includes('learning')) this.state.traits.curiosity = clamp01(this.state.traits.curiosity * 0.995 + influence * 0.005);
    if (event.tags.includes('challenge')) this.state.traits.persistence = clamp01(this.state.traits.persistence * 0.995 + influence * 0.005);
    if (event.tags.includes('reflection')) this.state.traits.reflection = clamp01(this.state.traits.reflection * 0.995 + influence * 0.005);

    this.state.history.push({ ...event, significance, emotionalWeight, tags: [...event.tags].slice(0, 24) });
    if (this.state.history.length > 256) this.state.history.splice(0, this.state.history.length - 256);
    return this.snapshot();
  }

  restore(snapshot?: IdentityState | null): void {
    if (!snapshot) return;
    this.state = {
      continuityScore: clamp01(snapshot.continuityScore),
      accumulatedExperience: Math.max(0, Number(snapshot.accumulatedExperience) || 0),
      traits: Object.fromEntries(Object.entries(snapshot.traits ?? {}).slice(0, 32).map(([key, value]) => [key, clamp01(Number(value))])),
      history: Array.isArray(snapshot.history) ? snapshot.history.slice(-256) : [],
    };
  }

  snapshot(): IdentityState {
    return structuredClone(this.state);
  }
}

export default B502ContinuousIdentityLifecycleEngine;
