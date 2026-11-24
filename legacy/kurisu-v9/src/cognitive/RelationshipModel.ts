/**
 * Multi-dimensional relationship model (not a single "love meter").
 */

export type RelationStage =
  | 'Stranger'
  | 'Acquaintance'
  | 'Friend'
  | 'CloseFriend'
  | 'TrustedCompanion';

export interface RelationshipState {
  stage: RelationStage;
  trust: number;
  respect: number;
  familiarity: number;
  comfort: number;
  affection: number;
  openness: number;
  reliability: number;
  conflict: number;
  sharedJokes: string[];
  promises: string[];
  boundariesHonored: number;
  boundariesBroken: number;
  lastShiftReason: string;
}

export class RelationshipModel {
  private state: RelationshipState = {
    stage: 'Acquaintance',
    trust: 42,
    respect: 55,
    familiarity: 20,
    comfort: 28,
    affection: 25,
    openness: 22,
    reliability: 40,
    conflict: 12,
    sharedJokes: [],
    promises: [],
    boundariesHonored: 0,
    boundariesBroken: 0,
    lastShiftReason: 'initial'
  };

  get() {
    return { ...this.state, sharedJokes: [...this.state.sharedJokes], promises: [...this.state.promises] };
  }

  applyInteraction(kind: 'honest' | 'respectful' | 'lie' | 'tease' | 'support' | 'insult' | 'deep_talk' | 'science') {
    const s = this.state;
    switch (kind) {
      case 'honest':
      case 'respectful':
        s.trust += 2; s.respect += 2; s.reliability += 1; break;
      case 'support':
        s.affection += 2; s.comfort += 2; s.trust += 1; break;
      case 'deep_talk':
        s.openness += 3; s.familiarity += 2; s.comfort += 1; break;
      case 'science':
        s.respect += 3; s.familiarity += 1; break;
      case 'tease':
        s.familiarity += 1; s.comfort += 1; s.conflict += 0.5; break;
      case 'lie':
        s.trust -= 5; s.reliability -= 4; s.conflict += 4; s.boundariesBroken += 1; break;
      case 'insult':
        s.respect -= 6; s.trust -= 4; s.conflict += 6; s.boundariesBroken += 1; break;
    }
    this.clampAll();
    this.recomputeStage();
  }

  honorBoundary() {
    this.state.boundariesHonored += 1;
    this.state.trust += 2;
    this.state.respect += 1;
    this.clampAll();
    this.recomputeStage();
    this.state.lastShiftReason = 'boundary honored';
  }

  addPromise(text: string) {
    this.state.promises.unshift(text);
    this.state.promises = this.state.promises.slice(0, 20);
  }

  addJoke(text: string) {
    this.state.sharedJokes.unshift(text);
    this.state.sharedJokes = this.state.sharedJokes.slice(0, 30);
    this.state.familiarity += 1;
    this.clampAll();
  }

  private recomputeStage() {
    const s = this.state;
    const score = (s.trust + s.comfort + s.familiarity + s.affection + s.openness) / 5;
    let stage: RelationStage = 'Stranger';
    if (score >= 25) stage = 'Acquaintance';
    if (score >= 45 && s.trust >= 50) stage = 'Friend';
    if (score >= 60 && s.trust >= 65 && s.openness >= 45) stage = 'CloseFriend';
    if (score >= 75 && s.trust >= 80 && s.reliability >= 70) stage = 'TrustedCompanion';
    if (stage !== s.stage) {
      s.lastShiftReason = `stage ${s.stage} → ${stage}`;
      s.stage = stage;
    }
  }

  private clampAll() {
    const keys: (keyof RelationshipState)[] = [
      'trust','respect','familiarity','comfort','affection','openness','reliability','conflict'
    ];
    for (const k of keys) {
      const v = this.state[k];
      if (typeof v === 'number') (this.state as any)[k] = Math.max(0, Math.min(100, v));
    }
  }

  summaryForPrompt(): string {
    const s = this.state;
    return `Отношения: ${s.stage} | trust ${s.trust} respect ${s.respect} comfort ${s.comfort} affection ${s.affection} openness ${s.openness} conflict ${s.conflict}`;
  }
}

export const relationshipModel = new RelationshipModel();
