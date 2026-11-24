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

export interface AuthorshipPendingDecision {
  decisionId: string;
  action: string;
  autonomous: boolean;
  externalRequest: boolean;
  goalTitle: string | null;
  reason: string | null;
  createdAt: number;
}

export interface SelfAuthorshipState {
  version: 1;
  commitments: SelfCommitment[];
  revisions: AuthorshipRevision[];
  authorshipScore: number;
  selfAuthoredGoalCount: number;
  autonomousActionCount: number;
  lastAuthoredAt: number;
  /** Bounded, restart-safe intent ledger; selection alone is not authorship. */
  pendingDecisions: AuthorshipPendingDecision[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const PENDING_DECISION_LIMIT = 32;
const PENDING_DECISION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function defaultSelfAuthorship(): SelfAuthorshipState {
  return { version: 1, commitments: [], revisions: [], authorshipScore: 0.5, selfAuthoredGoalCount: 0, autonomousActionCount: 0, lastAuthoredAt: 0, pendingDecisions: [] };
}

export class SelfAuthorshipEngine {
  private state = defaultSelfAuthorship();

  restore(value: SelfAuthorshipState | undefined): void {
    const now = Date.now();
    const pendingDecisions = (Array.isArray(value?.pendingDecisions) ? value.pendingDecisions : [])
      .filter((row): row is AuthorshipPendingDecision => Boolean(
        row && typeof row === 'object' &&
        typeof row.decisionId === 'string' && row.decisionId.trim() &&
        typeof row.action === 'string' && row.action.trim() &&
        typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) &&
        typeof row.autonomous === 'boolean' && typeof row.externalRequest === 'boolean'
      ))
      .filter(row => now - row.createdAt <= PENDING_DECISION_MAX_AGE_MS && row.createdAt <= now + 60_000)
      .map(row => ({
        decisionId: row.decisionId.trim().slice(0, 192),
        action: row.action.trim().slice(0, 96),
        autonomous: row.autonomous,
        externalRequest: row.externalRequest,
        goalTitle: typeof row.goalTitle === 'string' ? row.goalTitle.slice(0, 180) : null,
        reason: typeof row.reason === 'string' ? row.reason.slice(0, 240) : null,
        createdAt: row.createdAt,
      }))
      .slice(0, PENDING_DECISION_LIMIT);
    this.state = {
      ...defaultSelfAuthorship(),
      ...(value ?? {}),
      commitments: [...(value?.commitments ?? [])].slice(0, 64),
      revisions: [...(value?.revisions ?? [])].slice(0, 256),
      pendingDecisions,
    };
  }

  snapshot(): SelfAuthorshipState { return structuredClone(this.state); }

  observeDecision(input: { decisionId: string; action: string; autonomous: boolean; externalRequest: boolean; goalTitle?: string | null; reason?: string }): void {
    const decisionId = String(input.decisionId ?? '').trim().slice(0, 192);
    if (!decisionId || !input.autonomous || input.action === 'wait' || input.action === 'defer') return;
    const now = Date.now();
    const pending: AuthorshipPendingDecision = {
      decisionId,
      action: String(input.action).slice(0, 96),
      autonomous: input.autonomous === true,
      externalRequest: input.externalRequest === true,
      goalTitle: typeof input.goalTitle === 'string' ? input.goalTitle.slice(0, 180) : null,
      reason: typeof input.reason === 'string' ? input.reason.slice(0, 240) : null,
      createdAt: now,
    };
    this.state.pendingDecisions = [
      pending,
      ...this.state.pendingDecisions.filter(row => row.decisionId !== decisionId && now - row.createdAt <= PENDING_DECISION_MAX_AGE_MS),
    ].slice(0, PENDING_DECISION_LIMIT);
  }

  observeOutcome(input: { decisionId: string; executed: boolean; success: number; surprise: number; selectedGoal?: string | null }): void {
    const decisionId = String(input.decisionId ?? '').trim().slice(0, 192);
    if (!decisionId) return;
    const pendingIndex = this.state.pendingDecisions.findIndex(row => row.decisionId === decisionId);
    if (pendingIndex < 0) return;
    const [pending] = this.state.pendingDecisions.splice(pendingIndex, 1);
    if (!pending || input.executed !== true || !pending.autonomous || pending.externalRequest) return;

    const delta = (clamp(input.success) - 0.5) * (0.03 + clamp(input.surprise) * 0.04);
    this.state.autonomousActionCount += 1;
    this.state.authorshipScore = clamp(this.state.authorshipScore * 0.94 + 0.06 + delta);
    this.state.lastAuthoredAt = Date.now();

    const goal = pending.goalTitle ?? input.selectedGoal ?? null;
    if (goal) {
      const key = goal.slice(0, 180);
      const existing = this.state.commitments.find(c => c.statement === key && c.status === 'active');
      if (existing) {
        existing.evidenceCount += 1;
        existing.strength = clamp(existing.strength + 0.015 + delta * 0.6);
        existing.lastEvidenceAt = Date.now();
        if (existing.strength < 0.18) existing.status = 'superseded';
        if (existing.strength > 0.92 && existing.evidenceCount >= 6) existing.status = 'fulfilled';
      } else {
        this.state.commitments.unshift({
          id: `commit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          statement: key,
          source: 'intrinsic',
          strength: clamp(0.54 + delta * 0.6),
          evidenceCount: 1,
          status: 'active',
          createdAt: Date.now(),
          lastEvidenceAt: Date.now(),
        });
        this.state.selfAuthoredGoalCount += 1;
      }
    }
    this.state.commitments = this.state.commitments.slice(0, 64);
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
