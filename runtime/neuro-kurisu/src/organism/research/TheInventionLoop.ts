/**
 * The Invention Loop — evidence-gated lifecycle for turning hypotheses into
 * reproducible engineering improvements. This coordinator does not execute
 * arbitrary actions or merge/release code; it governs evidence and decisions.
 */
export type InventionStage =
  | 'proposed' | 'designed' | 'prototyped' | 'tested'
  | 'critiqued' | 'replicated' | 'accepted' | 'rejected';

export type OutcomeKind = 'primary' | 'replication' | 'holdout';
export interface InventionProtocol {
  question: string;
  hypothesis: string;
  successCriteria: string;
  testFingerprint: string;
  baseline: number;
  minEffect: number;
  lowerIsBetter?: boolean;
}
export interface InventionOutcome {
  id: string;
  kind: OutcomeKind;
  verifierId: string;
  environmentId: string;
  testFingerprint: string;
  observed: number;
  effect01: number;
  passed: boolean;
  recordedAt: number;
}
export interface InventionCritique {
  reviewerId: string;
  blockers: string[];
  limitations: string[];
  reviewedAt: number;
}
export interface InventionRecord {
  id: string;
  stage: InventionStage;
  protocol: InventionProtocol;
  createdAt: number;
  updatedAt: number;
  prototypeRef?: string;
  outcomes: InventionOutcome[];
  critique?: InventionCritique;
  decisionReason?: string;
}
export interface InventionLoopState {
  version: 1;
  records: InventionRecord[];
  accepted: number;
  rejected: number;
}
const clampText = (v: unknown, max = 500): string =>
  typeof v === 'string' ? v.normalize('NFKC').trim().slice(0, max) : '';
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const stages: InventionStage[] = ['proposed','designed','prototyped','tested','critiqued','replicated','accepted','rejected'];

export class TheInventionLoop {
  private state: InventionLoopState = { version: 1, records: [], accepted: 0, rejected: 0 };
  constructor(private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = () => globalThis.crypto?.randomUUID?.() ?? `inv-${Date.now()}-${Math.random().toString(16).slice(2)}`) {}

  snapshot(): InventionLoopState { return structuredClone(this.state); }

  restore(raw?: Partial<InventionLoopState> | null): void {
    const records = Array.isArray(raw?.records) ? raw!.records.filter((r): r is InventionRecord =>
      Boolean(r && typeof r.id === 'string' && stages.includes(r.stage) && r.protocol &&
        Array.isArray(r.outcomes))).slice(0, 256) : [];
    this.state = { version: 1, records: structuredClone(records),
      accepted: Math.max(0, Math.floor(Number(raw?.accepted) || 0)),
      rejected: Math.max(0, Math.floor(Number(raw?.rejected) || 0)) };
  }

  propose(input: InventionProtocol): InventionRecord {
    const protocol: InventionProtocol = {
      question: clampText(input?.question, 500),
      hypothesis: clampText(input?.hypothesis, 1000),
      successCriteria: clampText(input?.successCriteria, 1000),
      testFingerprint: clampText(input?.testFingerprint, 160),
      baseline: input?.baseline,
      minEffect: input?.minEffect,
      lowerIsBetter: input?.lowerIsBetter === true,
    };
    if (!protocol.question || !protocol.hypothesis || !protocol.successCriteria ||
        !protocol.testFingerprint || !finite(protocol.baseline) ||
        !finite(protocol.minEffect) || protocol.minEffect < 0 || protocol.minEffect > 1) {
      throw new Error('invalid-preregistration');
    }
    const record: InventionRecord = { id: clampText(this.id(), 120) || `invention-${this.now()}`,
      stage: 'proposed', protocol, createdAt: this.now(), updatedAt: this.now(), outcomes: [] };
    if (this.state.records.some(r => r.id === record.id)) throw new Error('duplicate-invention-id');
    this.state.records = [record, ...this.state.records].slice(0, 256);
    return structuredClone(record);
  }

  private find(id: string): InventionRecord {
    const record = this.state.records.find(r => r.id === id);
    if (!record) throw new Error('invention-not-found');
    if (record.stage === 'accepted' || record.stage === 'rejected') throw new Error('invention-closed');
    return record;
  }
  private touch(record: InventionRecord): void { record.updatedAt = this.now(); }

  design(id: string): InventionRecord {
    const r = this.find(id);
    if (r.stage !== 'proposed') throw new Error('invalid-stage-transition');
    r.stage = 'designed'; this.touch(r); return structuredClone(r);
  }
  prototype(id: string, reference: string): InventionRecord {
    const r = this.find(id);
    if (r.stage !== 'designed') throw new Error('invalid-stage-transition');
    const ref = clampText(reference, 300);
    if (!ref) throw new Error('prototype-reference-required');
    r.prototypeRef = ref; r.stage = 'prototyped'; this.touch(r); return structuredClone(r);
  }
  recordOutcome(id: string, input: Omit<InventionOutcome, 'id'|'passed'|'recordedAt'> & { id?: string }): InventionRecord {
    const r = this.find(id);
    const expected: OutcomeKind = r.stage === 'prototyped' ? 'primary' :
      r.stage === 'critiqued' ? 'replication' : r.stage === 'replicated' ? 'holdout' : 'invalid';
    if (input.kind !== expected) throw new Error('outcome-kind-not-allowed-at-stage');
    const verifierId = clampText(input.verifierId, 120);
    const environmentId = clampText(input.environmentId, 120);
    const fingerprint = clampText(input.testFingerprint, 160);
    if (!verifierId || !environmentId || fingerprint !== r.protocol.testFingerprint ||
        !finite(input.observed) || !finite(input.effect01) || input.effect01 < 0 || input.effect01 > 1) {
      throw new Error('invalid-outcome');
    }
    if (r.outcomes.some(o => o.id === input.id || (o.kind === input.kind &&
        o.verifierId === verifierId && o.environmentId === environmentId))) {
      throw new Error('duplicate-outcome');
    }
    if (input.kind === 'replication') {
      const primary = r.outcomes.find(o => o.kind === 'primary');
      if (!primary || primary.verifierId === verifierId || primary.environmentId === environmentId) {
        throw new Error('replication-not-independent');
      }
    }
    if (input.kind === 'holdout') {
      const prior = r.outcomes.filter(o => o.kind === 'primary' || o.kind === 'replication');
      if (prior.some(o => o.verifierId === verifierId || o.environmentId === environmentId)) {
        throw new Error('holdout-must-be-independent');
      }
    }
    const passed = input.effect01 >= r.protocol.minEffect;
    const outcome: InventionOutcome = { id: clampText(input.id, 160) || `${id}:${input.kind}:${r.outcomes.length}`,
      kind: input.kind, verifierId, environmentId, testFingerprint: fingerprint,
      observed: input.observed, effect01: input.effect01, passed, recordedAt: this.now() };
    if (r.outcomes.some(o => o.id === outcome.id)) throw new Error('duplicate-outcome');
    r.outcomes.push(outcome);
    if (!passed) { r.stage = 'rejected'; r.decisionReason = `${input.kind}-failed-preregistered-threshold`; this.state.rejected++; }
    else if (input.kind === 'primary') r.stage = 'tested';
    else if (input.kind === 'replication') r.stage = 'replicated';
    else { r.stage = 'accepted'; r.decisionReason = 'primary-replication-and-holdout-passed'; this.state.accepted++; }
    this.touch(r); return structuredClone(r);
  }
  critique(id: string, input: { reviewerId: string; blockers?: string[]; limitations?: string[] }): InventionRecord {
    const r = this.find(id);
    if (r.stage !== 'tested') throw new Error('critique-requires-tested-prototype');
    const reviewerId = clampText(input?.reviewerId, 120);
    if (!reviewerId) throw new Error('reviewer-required');
    const primary = r.outcomes.find(o => o.kind === 'primary');
    if (primary?.verifierId === reviewerId) throw new Error('reviewer-must-be-independent');
    const blockers = Array.isArray(input.blockers) ? input.blockers.map(x => clampText(x, 300)).filter(Boolean).slice(0, 32) : [];
    const limitations = Array.isArray(input.limitations) ? input.limitations.map(x => clampText(x, 300)).filter(Boolean).slice(0, 32) : [];
    r.critique = { reviewerId, blockers, limitations, reviewedAt: this.now() };
    if (blockers.length) { r.stage = 'rejected'; r.decisionReason = 'independent-critique-blockers'; this.state.rejected++; }
    else r.stage = 'critiqued';
    this.touch(r); return structuredClone(r);
  }
  reject(id: string, reason: string): InventionRecord {
    const r = this.find(id); r.stage = 'rejected';
    r.decisionReason = clampText(reason, 500) || 'rejected-by-review';
    this.state.rejected++; this.touch(r); return structuredClone(r);
  }
  metrics() {
    const records = this.state.records;
    return { total: records.length, byStage: Object.fromEntries(stages.map(s => [s, records.filter(r => r.stage === s).length])),
      accepted: this.state.accepted, rejected: this.state.rejected,
      replicationRate: records.filter(r => r.outcomes.some(o => o.kind === 'replication')).length /
        Math.max(1, records.filter(r => r.outcomes.some(o => o.kind === 'primary')).length) };
  }
}
