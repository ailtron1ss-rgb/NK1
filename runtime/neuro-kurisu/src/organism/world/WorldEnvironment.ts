export type EnvironmentAction =
  | 'observe'
  | 'inspect'
  | 'move'
  | 'collect'
  | 'rest'
  | 'communicate';

export interface EnvironmentObject {
  id: string;
  label: string;
  location: string;
  value: number;
  visible: boolean;
  collected: boolean;
}

export interface EnvironmentSnapshot {
  tick: number;
  location: string;
  energy: number;
  attention: number;
  uncertainty: number;
  facts: string[];
  objects: EnvironmentObject[];
  events: string[];
}

export interface EnvironmentTransition {
  action: EnvironmentAction;
  valid: boolean;
  before: EnvironmentSnapshot;
  after: EnvironmentSnapshot;
  reward: number;
  rawReward: number;
  displayReward01: number;
  surprise: number;
  at: number;
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export interface PersistedWorld { snapshot: EnvironmentSnapshot; transitions: EnvironmentTransition[]; schemaVersion: 1; }

export class WorldEnvironment {
  private snapshotState: EnvironmentSnapshot = {
    tick: 0,
    location: 'home',
    energy: 0.85,
    attention: 0.8,
    uncertainty: 0.55,
    facts: ['home is a known safe location'],
    objects: [
      { id: 'notebook', label: 'notebook', location: 'home', value: 0.25, visible: true, collected: false },
      { id: 'unknown-box', label: 'unknown box', location: 'lab', value: 0.75, visible: false, collected: false },
      { id: 'terminal', label: 'terminal', location: 'lab', value: 0.5, visible: true, collected: false },
    ],
    events: [],
  };
  private transitions: EnvironmentTransition[] = [];

  snapshot(): EnvironmentSnapshot { return structuredClone(this.snapshotState); }
  history(): EnvironmentTransition[] { return structuredClone(this.transitions); }
  restore(persisted: PersistedWorld | null | undefined): void {
    if (!persisted?.snapshot) return;
    this.snapshotState = structuredClone(persisted.snapshot);
    this.transitions = Array.isArray(persisted.transitions) ? structuredClone(persisted.transitions).slice(0, 500) : [];
  }
  persisted(): PersistedWorld { return { snapshot: this.snapshot(), transitions: this.history(), schemaVersion: 1 }; }
  observationContext(): EnvironmentSnapshot { return this.snapshot(); }

  /** P2840: pure predictive simulation; does not mutate canonical world state.
   *
   * R10: simulation no longer constructs a second WorldEnvironment or clones the
   * entire transition history on every prediction. The predicted transition is
   * computed directly from a detached snapshot; canonical history is consulted
   * only for confidence, never copied into the hot path.
   */
  simulate(action: EnvironmentAction, from?: EnvironmentSnapshot): EnvironmentTransition {
    return this.computeTransition(action, from ?? this.snapshot());
  }

  /** P2840: commit an already simulated transition exactly once. */
  commit(transition: EnvironmentTransition): void {
    const currentTick = Number(this.snapshotState.tick);
    if (Number.isFinite(currentTick) && currentTick >= Number(transition.after.tick)) return;
    this.snapshotState = structuredClone(transition.after);
    const duplicate = this.transitions.findIndex(t => t.after.tick === transition.after.tick && t.at === transition.at);
    if (duplicate >= 0) return;
    this.transitions.unshift(structuredClone(transition));
    this.transitions = this.transitions.slice(0, 500);
  }

  private computeTransition(action: EnvironmentAction, from: EnvironmentSnapshot): EnvironmentTransition {
    const before = structuredClone(from);
    const s = structuredClone(from);
    const reasons: string[] = [];
    let reward = 0.05;
    let surprise = 0.02;
    let valid = true;
    s.tick += 1;

    switch (action) {
      case 'observe':
        s.energy = clamp(s.energy - 0.015);
        s.attention = clamp(s.attention - 0.01);
        s.uncertainty = clamp(s.uncertainty - 0.04);
        s.facts.push(`observed:${s.location}`);
        reward = 0.12;
        reasons.push(`observed ${s.location}`);
        break;
      case 'inspect': {
        s.energy = clamp(s.energy - 0.045);
        s.attention = clamp(s.attention - 0.04);
        const hidden = s.objects.find(o => o.location === s.location && !o.visible);
        if (hidden) {
          hidden.visible = true;
          s.uncertainty = clamp(s.uncertainty - 0.16);
          s.facts.push(`discovered:${hidden.id}`);
          reward = hidden.value;
          surprise = 0.06;
          reasons.push(`discovered ${hidden.label}`);
        } else {
          s.uncertainty = clamp(s.uncertainty - 0.02);
          reward = 0.03;
          reasons.push('nothing novel was found');
        }
        break;
      }
      case 'move':
        s.energy = clamp(s.energy - 0.06);
        s.attention = clamp(s.attention - 0.03);
        s.location = s.location === 'home' ? 'lab' : 'home';
        s.uncertainty = clamp(s.uncertainty + 0.02);
        reward = 0.08;
        reasons.push(`moved to ${s.location}`);
        break;
      case 'collect': {
        s.energy = clamp(s.energy - 0.05);
        const item = s.objects.find(o => o.location === s.location && o.visible && !o.collected);
        if (item) {
          item.collected = true;
          s.facts.push(`collected:${item.id}`);
          reward = item.value;
          s.uncertainty = clamp(s.uncertainty - 0.05);
          reasons.push(`collected ${item.label}`);
        } else {
          reward = -0.04;
          surprise = 0.1;
          valid = false;
          reasons.push('nothing collectible was available');
        }
        break;
      }
      case 'rest':
        s.energy = clamp(s.energy + 0.16);
        s.attention = clamp(s.attention + 0.14);
        reward = 0.15;
        reasons.push('restored energy and attention');
        break;
      case 'communicate':
        s.energy = clamp(s.energy - 0.025);
        s.attention = clamp(s.attention - 0.02);
        s.facts.push('communication_channel_exercised');
        reward = 0.09;
        reasons.push('communication channel exercised');
        break;
    }

    s.facts = Array.from(new Set(s.facts)).slice(-120);
    s.events.unshift(...reasons);
    s.events = s.events.slice(0, 40);
    const after = structuredClone(s);
    return {
      action,
      before,
      after,
      reward: Math.max(-1, Math.min(1, Number.isFinite(reward) ? reward : 0)),
      rawReward: reward,
      displayReward01: clamp((reward + 1) / 2),
      surprise,
      valid,
      at: Date.now(),
    };
  }

  step(action: EnvironmentAction): EnvironmentTransition {
    const transition = this.computeTransition(action, this.snapshotState);
    this.snapshotState = structuredClone(transition.after);
    this.transitions.unshift(structuredClone(transition));
    this.transitions = this.transitions.slice(0, 500);
    return structuredClone(transition);
  }

  project(action: EnvironmentAction, from?: EnvironmentSnapshot): { next: EnvironmentSnapshot; reward: number; confidence: number; valid: boolean } {
    const transition = this.computeTransition(action, from ?? this.snapshotState);
    return {
      next: transition.after,
      reward: transition.reward,
      confidence: 0.45 + Math.min(0.45, this.transitions.length / 250),
      valid: transition.valid,
    };
  }

  projectSequence(actions: EnvironmentAction[]): { next: EnvironmentSnapshot; rewards: number[]; confidences: number[]; validities: boolean[] } {
    let state = this.snapshot();
    const rewards: number[] = [];
    const confidences: number[] = [];
    const validities: boolean[] = [];
    for (const action of actions) {
      const projection = this.project(action, state);
      state = projection.next; rewards.push(projection.reward); confidences.push(projection.confidence); validities.push(projection.valid);
    }
    return { next: state, rewards, confidences, validities };
  }

  toOrganismObservation(): { novelty: number; surprise: number; socialSignal: number; worldEvent: { type: string; importance: number; payload: Record<string, unknown> }; worldContext: EnvironmentSnapshot } {
    const s = this.snapshotState;
    return {
      novelty: clamp(s.objects.filter(o => o.visible && !o.collected).length / 4 + (s.location === 'lab' ? 0.18 : 0)),
      surprise: this.transitions[0]?.surprise ?? 0.05,
      socialSignal: 0.35,
      worldEvent: { type: 'environment_tick', importance: clamp(s.uncertainty), payload: { location: s.location, facts: s.facts.slice(-8) } },
      worldContext: structuredClone(s) as any,
    };
  }
}
