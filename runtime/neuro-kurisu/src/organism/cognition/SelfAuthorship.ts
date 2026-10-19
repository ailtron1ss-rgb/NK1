export type AuthorshipSource = 'intrinsic' | 'experience' | 'reflection' | 'dialogue';
export type AuthorshipStatus = 'active' | 'fulfilled' | 'superseded';

export interface SelfCommitment {
  id: string;
  statement: string;
  source: AuthorshipSource;
  strength: number;
  evidenceCount: number;
  status: AuthorshipStatus;
  createdAt: number;
  lastEvidenceAt: number;
}

export interface AuthorshipRevision {
  id: string;
  kind: 'commitment' | 'value' | 'goal';
  target: string;
  before: number;
  after: number;
  reason: string;
  evidence: string[];
  at: number;
}

export interface SelfAuthorshipState {
  version: 1;
  commitments: SelfCommitment[];
  revisions: AuthorshipRevision[];
  authorshipScore: number;
  selfAuthoredGoalCount: number;
  autonomousActionCount: number;
  lastAuthoredAt: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function defaultSelfAuthorship(): SelfAuthorshipState {
  return { version: 1, commitments: [], revisions: [], authorshipScore: 0.5, selfAuthoredGoalCount: 0, autonomousActionCount: 0, lastAuthoredAt: 0 };
}

export class SelfAuthorshipEngine {
  private state = defaultSelfAuthorship();
  restore(value: SelfAuthorshipState | undefined): void {
    this.state = { ...defaultSelfAuthorship(), ...(value ?? {}), commitments: [...(value?.commitments ?? [])], revisions: [...(value?.revisions ?? [])] };
  }
  snapshot(): SelfAuthorshipState { return structuredClone(this.state); }

  observeDecision(input: { action: string; autonomous: boolean; externalRequest: boolean; goalTitle?: string | null; reason?: string }): void {
    if (!input.autonomous || input.action === 'wait' || input.action === 'defer') return;
    this.state.autonomousActionCount += 1;
    this.state.authorshipScore = clamp(this.state.authorshipScore * 0.94 + 0.06);
    this.state.lastAuthoredAt = Date.now();
    if (input.goalTitle) {
      const key = input.goalTitle.slice(0, 180);
      const existing = this.state.commitments.find(c => c.statement === key && c.status === 'active');
      if (existing) {
        existing.evidenceCount += 1;
        existing.strength = clamp(existing.strength + 0.015);
        existing.lastEvidenceAt = Date.now();
      } else if (!input.externalRequest) {
        this.state.commitments.unshift({ id: `commit-${Date.now()}-${Math.random().toString(16).slice(2)}`, statement: key, source: 'intrinsic', strength: 0.54, evidenceCount: 1, status: 'active', createdAt: Date.now(), lastEvidenceAt: Date.now() });
        this.state.selfAuthoredGoalCount += 1;
      }
    }
    this.state.commitments = this.state.commitments.slice(0, 64);
  }

  observeOutcome(input: { success: number; surprise: number; selectedGoal?: string | null }): void {
    const delta = (clamp(input.success) - 0.5) * (0.03 + clamp(input.surprise) * 0.04);
    this.state.authorshipScore = clamp(this.state.authorshipScore + delta);
    if (input.selectedGoal) {
      const c = this.state.commitments.find(x => x.statement === input.selectedGoal && x.status === 'active');
      if (c) {
        c.evidenceCount += 1;
        c.strength = clamp(c.strength + delta * 0.6);
        c.lastEvidenceAt = Date.now();
        if (c.strength < 0.18) c.status = 'superseded';
        if (c.strength > 0.92 && c.evidenceCount >= 6) c.status = 'fulfilled';
      }
    }
  }

  revise(kind: AuthorshipRevision['kind'], target: string, before: number, after: number, reason: string, evidence: string[]): AuthorshipRevision {
    const revision: AuthorshipRevision = {
      id: `rev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind, target, before: clamp(before), after: clamp(after), reason: reason.slice(0, 240), evidence: evidence.slice(0, 12), at: Date.now(),
    };
    this.state.revisions.unshift(revision);
    this.state.revisions = this.state.revisions.slice(0, 256);
    this.state.lastAuthoredAt = revision.at;
    this.state.authorshipScore = clamp(this.state.authorshipScore * 0.97 + 0.03);
    return structuredClone(revision);
  }
}
