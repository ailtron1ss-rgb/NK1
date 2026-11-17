import { createHash } from 'node:crypto';
import { VerifiedOutcomeLedger, type OutcomeAuthority, type EvaluationSplit } from '../learning/VerifiedOutcomeLedger.ts';

/**
 * The Invention Loop — evidence-gated lifecycle for converting hypotheses
 * into reproducible engineering improvements. It coordinates evidence; it
 * never executes arbitrary code, merges branches, publishes releases or
 * promotes model weights.
 */
export type InventionStage =
  | 'proposed' | 'designed' | 'prototyped' | 'tested'
  | 'critiqued' | 'replicated' | 'accepted' | 'rejected';
export type OutcomeKind = 'primary' | 'replication' | 'holdout';
export type InventionAuditAction =
  | 'proposed' | 'designed' | 'prototyped' | 'outcome-recorded'
  | 'critiqued' | 'accepted' | 'rejected';

export interface InventionVerifierPlan {
  primary: string;
  critique: string;
  replication: string;
  holdout: string;
}
export interface InventionProtocol {
  question: string;
  hypothesis: string;
  successCriteria: string;
  /** Immutable identity of the test manifest and evaluation implementation. */
  testFingerprint: string;
  /** Measured baseline, captured before prototype evaluation. */
  baseline: number;
  /** Absolute metric delta corresponding to 1.0 normalized effect. */
  metricScale: number;
  /** Required normalized effect in [0, 1]. */
  minEffect: number;
  lowerIsBetter?: boolean;
  /** All reviewer identities are fixed before the candidate is evaluated. */
  verifierPlan: InventionVerifierPlan;
}
export interface InventionPrototype {
  reference: string;
  sha256: string;
}
export interface InventionOutcomeInput {
  id?: string;
  kind: OutcomeKind;
  authority: OutcomeAuthority;
  seed: number;
  attempt: number;
  runId: string;
  verifierId: string;
  environmentId: string;
  testFingerprint: string;
  evidenceRef: string;
  evidenceSha256: string;
  observed: number;
}
export interface InventionOutcome extends InventionOutcomeInput {
  id: string;
  effect01: number;
  passed: boolean;
  recordedAt: number;
}
export interface InventionCritiqueInput {
  reviewerId: string;
  reviewRef: string;
  reviewSha256: string;
  blockers?: string[];
  limitations?: string[];
}
export interface InventionCritique {
  reviewerId: string;
  reviewRef: string;
  reviewSha256: string;
  blockers: string[];
  limitations: string[];
  reviewedAt: number;
}

export interface InventionRecordCore {
  id: string;
  stage: InventionStage;
  protocol: InventionProtocol;
  createdAt: number;
  updatedAt: number;
  prototypeRef?: string;
  prototypeSha256?: string;
  outcomes: InventionOutcome[];
  critique?: InventionCritique;
  decisionReason?: string;
}
export interface InventionAuditEvent {
  sequence: number;
  action: InventionAuditAction;
  at: number;
  previousHash: string;
  hash: string;
  /** Full state after this transition, excluding auditTrail itself. */
  snapshot: InventionRecordCore;
}
export interface InventionRecord extends InventionRecordCore {
  auditTrail: InventionAuditEvent[];
}
export interface InventionLoopState {
  version: 2;
  records: InventionRecord[];
  /** Derived counters. Restore never trusts serialized counter values. */
  accepted: number;
  rejected: number;
  quarantinedRecords: number;
}

const GENESIS_HASH = '0'.repeat(64);
const SHA256_RE = /^[a-f0-9]{64}$/iu;
const MAX_RECORDS = 256;
const MAX_TEXT = 1000;
const STAGES: InventionStage[] = [
  'proposed', 'designed', 'prototyped', 'tested',
  'critiqued', 'replicated', 'accepted', 'rejected',
];
const AUDIT_ACTIONS: InventionAuditAction[] = [
  'proposed', 'designed', 'prototyped', 'outcome-recorded',
  'critiqued', 'accepted', 'rejected',
];

const clampText = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, max) : '';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter(key => object[key] !== undefined).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}
function sha256(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function coreOf(record: InventionRecord): InventionRecordCore {
  const { auditTrail: _auditTrail, ...core } = record;
  return structuredClone(core);
}
function isProtocol(value: unknown): value is InventionProtocol {
  if (!isObject(value)) return false;
  const verifierPlan = value.verifierPlan;
  if (!isObject(verifierPlan)) return false;
  const verifierIds = [verifierPlan.primary, verifierPlan.critique, verifierPlan.replication, verifierPlan.holdout];
  return typeof value.question === 'string' &&
    typeof value.hypothesis === 'string' &&
    typeof value.successCriteria === 'string' &&
    typeof value.testFingerprint === 'string' && SHA256_RE.test(value.testFingerprint) &&
    finite(value.baseline) && finite(value.metricScale) && value.metricScale > 0 &&
    finite(value.minEffect) && value.minEffect >= 0 && value.minEffect <= 1 &&
    (value.lowerIsBetter === undefined || typeof value.lowerIsBetter === 'boolean') &&
    verifierIds.every(id => typeof id === 'string' && clampText(id, 120).length > 0) &&
    new Set(verifierIds.map(id => clampText(id, 120))).size === 4;
}
function isOutcome(value: unknown): value is InventionOutcome {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && typeof value.runId === 'string' &&
    (value.kind === 'primary' || value.kind === 'replication' || value.kind === 'holdout') &&
    (value.authority === 'independent-verifier' || value.authority === 'human-review') &&
    Number.isSafeInteger(value.seed) && Number(value.seed) >= 0 &&
    Number.isSafeInteger(value.attempt) && Number(value.attempt) >= 1 &&
    typeof value.verifierId === 'string' && typeof value.environmentId === 'string' &&
    typeof value.testFingerprint === 'string' && typeof value.evidenceRef === 'string' &&
    typeof value.evidenceSha256 === 'string' && SHA256_RE.test(value.evidenceSha256) &&
    finite(value.observed) && finite(value.effect01) && value.effect01 >= 0 && value.effect01 <= 1 &&
    typeof value.passed === 'boolean' && finite(value.recordedAt);
}
function isCore(value: unknown): value is InventionRecordCore {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && STAGES.includes(value.stage as InventionStage) &&
    isProtocol(value.protocol) && finite(value.createdAt) && finite(value.updatedAt) &&
    Array.isArray(value.outcomes) && value.outcomes.every(isOutcome) &&
    (value.prototypeRef === undefined || typeof value.prototypeRef === 'string') &&
    (value.prototypeSha256 === undefined ||
      (typeof value.prototypeSha256 === 'string' && SHA256_RE.test(value.prototypeSha256))) &&
    (value.decisionReason === undefined || typeof value.decisionReason === 'string');
}

function auditHash(event: Omit<InventionAuditEvent, 'hash'>): string {
  return sha256({
    sequence: event.sequence,
    action: event.action,
    at: event.at,
    previousHash: event.previousHash,
    snapshot: event.snapshot,
  });
}
function verifyRecordAudit(record: unknown): record is InventionRecord {
  if (!isObject(record)) return false;
  const candidate = record as Record<string, unknown>;
  const trail = candidate.auditTrail;
  if (!isCore(candidate) || !Array.isArray(trail) || trail.length < 1 || trail.length > 8) return false;
  let previousHash = GENESIS_HASH;
  for (let index = 0; index < trail.length; index += 1) {
    const event = trail[index];
    if (!isObject(event) || event.sequence !== index + 1 ||
        !AUDIT_ACTIONS.includes(event.action as InventionAuditAction) ||
        !finite(event.at) || event.previousHash !== previousHash ||
        typeof event.hash !== 'string' || !SHA256_RE.test(event.hash) ||
        !isCore(event.snapshot) || event.snapshot.id !== record.id ||
        event.snapshot.updatedAt !== event.at) return false;
    const payload = {
      sequence: event.sequence,
      action: event.action as InventionAuditAction,
      at: event.at,
      previousHash,
      snapshot: event.snapshot,
    };
    const expectedHash = auditHash(payload);
    if (event.hash !== expectedHash) return false;
    previousHash = event.hash;
  }
  const finalEvent = trail[trail.length - 1] as InventionAuditEvent;
  return canonical(finalEvent.snapshot) === canonical(coreOf(record as InventionRecord));
}

export class TheInventionLoop {
  private state: InventionLoopState = {
    version: 2, records: [], accepted: 0, rejected: 0, quarantinedRecords: 0,
  };

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = () =>
      globalThis.crypto?.randomUUID?.() ?? `inv-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  ) {}

  snapshot(): InventionLoopState {
    return structuredClone(this.state);
  }

  /**
   * Restores only records whose per-record hash chain validates. Version-1
   * records had no audit receipts and are quarantined rather than promoted.
   */
  restore(raw?: Partial<InventionLoopState> | null): void {
    const incoming = Array.isArray(raw?.records) ? raw!.records : [];
    if (raw?.version !== 2) {
      this.state = {
        version: 2, records: [], accepted: 0, rejected: 0,
        quarantinedRecords: incoming.length,
      };
      return;
    }
    const records: InventionRecord[] = [];
    let quarantinedRecords = 0;
    const seen = new Set<string>();
    for (const candidate of incoming.slice(0, MAX_RECORDS * 2)) {
      if (!verifyRecordAudit(candidate) || seen.has(candidate.id)) {
        quarantinedRecords += 1;
        continue;
      }
      seen.add(candidate.id);
      records.push(structuredClone(candidate));
    }
    this.state = {
      version: 2,
      records: records.slice(0, MAX_RECORDS),
      accepted: records.filter(record => record.stage === 'accepted').length,
      rejected: records.filter(record => record.stage === 'rejected').length,
      quarantinedRecords: quarantinedRecords + Math.max(0, incoming.length - MAX_RECORDS * 2),
    };
  }

  private timestamp(): number {
    const value = this.now();
    if (!finite(value) || value < 0) throw new Error('invalid-clock');
    return Math.floor(value);
  }
  private touch(record: InventionRecord): void {
    record.updatedAt = Math.max(record.updatedAt + 1, this.timestamp());
  }
  private recordAudit(record: InventionRecord, action: InventionAuditAction): void {
    const previous = record.auditTrail[record.auditTrail.length - 1];
    const unsigned: Omit<InventionAuditEvent, 'hash'> = {
      sequence: (previous?.sequence ?? 0) + 1,
      action,
      at: record.updatedAt,
      previousHash: previous?.hash ?? GENESIS_HASH,
      snapshot: coreOf(record),
    };
    record.auditTrail.push({ ...unsigned, hash: auditHash(unsigned) });
  }
  private refreshCounters(): void {
    this.state.accepted = this.state.records.filter(record => record.stage === 'accepted').length;
    this.state.rejected = this.state.records.filter(record => record.stage === 'rejected').length;
  }
  private commit(record: InventionRecord, action: InventionAuditAction): InventionRecord {
    this.recordAudit(record, action);
    this.refreshCounters();
    return structuredClone(record);
  }
  private find(id: string): InventionRecord {
    const record = this.state.records.find(item => item.id === id);
    if (!record) throw new Error('invention-not-found');
    if (record.stage === 'accepted' || record.stage === 'rejected') throw new Error('invention-closed');
    return record;
  }

  propose(input: InventionProtocol): InventionRecord {
    const protocol: InventionProtocol = {
      question: clampText(input?.question, 500),
      hypothesis: clampText(input?.hypothesis, MAX_TEXT),
      successCriteria: clampText(input?.successCriteria, MAX_TEXT),
      testFingerprint: clampText(input?.testFingerprint, 160),
      baseline: input?.baseline,
      metricScale: input?.metricScale,
      minEffect: input?.minEffect,
      lowerIsBetter: input?.lowerIsBetter === true,
      verifierPlan: {
        primary: clampText(input?.verifierPlan?.primary, 120),
        critique: clampText(input?.verifierPlan?.critique, 120),
        replication: clampText(input?.verifierPlan?.replication, 120),
        holdout: clampText(input?.verifierPlan?.holdout, 120),
      },
    };
    if (!protocol.question || !protocol.hypothesis || !protocol.successCriteria ||
        !protocol.testFingerprint || !finite(protocol.baseline) ||
        !finite(protocol.metricScale) || protocol.metricScale <= 0 ||
        !finite(protocol.minEffect) || protocol.minEffect < 0 || protocol.minEffect > 1 ||
        !SHA256_RE.test(protocol.testFingerprint) ||
        new Set(Object.values(protocol.verifierPlan)).size !== 4 ||
        Object.values(protocol.verifierPlan).some(value => !value)) {
      throw new Error('invalid-preregistration');
    }
    const at = this.timestamp();
    const record: InventionRecord = {
      id: clampText(this.id(), 120) || `invention-${at}`,
      stage: 'proposed',
      protocol,
      createdAt: at,
      updatedAt: at,
      outcomes: [],
      auditTrail: [],
    };
    if (this.state.records.some(item => item.id === record.id)) throw new Error('duplicate-invention-id');
    this.state.records = [record, ...this.state.records].slice(0, MAX_RECORDS);
    return this.commit(record, 'proposed');
  }

  design(id: string): InventionRecord {
    const record = this.find(id);
    if (record.stage !== 'proposed') throw new Error('invalid-stage-transition');
    record.stage = 'designed';
    this.touch(record);
    return this.commit(record, 'designed');
  }

  prototype(id: string, input: InventionPrototype): InventionRecord {
    const record = this.find(id);
    if (record.stage !== 'designed') throw new Error('invalid-stage-transition');
    const reference = clampText(input?.reference, 300);
    const digest = clampText(input?.sha256, 64).toLowerCase();
    if (!reference || !SHA256_RE.test(digest)) throw new Error('invalid-prototype');
    record.prototypeRef = reference;
    record.prototypeSha256 = digest;
    record.stage = 'prototyped';
    this.touch(record);
    return this.commit(record, 'prototyped');
  }

  recordOutcome(id: string, input: InventionOutcomeInput): InventionRecord {
    const record = this.find(id);
    let expectedKind: OutcomeKind | null = null;
    if (record.stage === 'prototyped') expectedKind = 'primary';
    else if (record.stage === 'critiqued') expectedKind = 'replication';
    else if (record.stage === 'replicated') expectedKind = 'holdout';
    if (expectedKind === null || input?.kind !== expectedKind) {
      throw new Error('outcome-kind-not-allowed-at-stage');
    }

    const runId = clampText(input.runId, 160);
    const verifierId = clampText(input.verifierId, 120);
    const environmentId = clampText(input.environmentId, 120);
    const fingerprint = clampText(input.testFingerprint, 160);
    const evidenceRef = clampText(input.evidenceRef, 512);
    const evidenceSha256 = clampText(input.evidenceSha256, 64).toLowerCase();
    if (!runId || !verifierId || !environmentId || !evidenceRef ||
        !SHA256_RE.test(evidenceSha256) || fingerprint !== record.protocol.testFingerprint ||
        !finite(input.observed)) {
      throw new Error('invalid-outcome');
    }
    const expectedVerifier = record.protocol.verifierPlan[input.kind];
    if (verifierId !== expectedVerifier) throw new Error('verifier-plan-mismatch');
    if (input.authority !== 'independent-verifier' && input.authority !== 'human-review') {
      throw new Error('outcome-not-authoritative:self-report-not-authoritative');
    }
    if (!Number.isSafeInteger(input.seed) || input.seed < 0 ||
        !Number.isSafeInteger(input.attempt) || input.attempt < 1) {
      throw new Error('invalid-outcome-identity');
    }
    const outcomeId = clampText(input.id, 160) || `${id}:${input.kind}:${record.outcomes.length}`;
    if (this.state.records.some(candidate => candidate.outcomes.some(outcome =>
      outcome.id === outcomeId || outcome.runId === runId || outcome.evidenceRef === evidenceRef))) {
      throw new Error('duplicate-run-or-evidence-across-inventions');
    }
    if (record.outcomes.some(outcome => outcome.id === outcomeId || outcome.runId === runId ||
        (outcome.verifierId === verifierId && outcome.environmentId === environmentId))) {
      throw new Error('duplicate-run-or-outcome');
    }

    if (input.kind === 'replication') {
      const primary = record.outcomes.find(outcome => outcome.kind === 'primary');
      if (!primary || primary.verifierId === verifierId || primary.environmentId === environmentId) {
        throw new Error('replication-not-independent');
      }
    }
    if (input.kind === 'holdout') {
      if (record.outcomes.some(outcome =>
        outcome.verifierId === verifierId || outcome.environmentId === environmentId ||
        outcome.runId === runId)) {
        throw new Error('holdout-must-be-independent');
      }
    }

    const direction = record.protocol.lowerIsBetter ? -1 : 1;
    const normalizedDelta = ((input.observed - record.protocol.baseline) * direction) /
      record.protocol.metricScale;
    const effect01 = clamp01(normalizedDelta);
    const passed = effect01 >= record.protocol.minEffect;
    const taskId = `${record.id}:${input.kind}`;
    const split: EvaluationSplit = input.kind === 'holdout' ? 'holdout' : 'validation';
    const verifierLedger = new VerifiedOutcomeLedger([{
      taskId, family: 'invention-loop', split,
      promptFingerprint: record.protocol.testFingerprint,
      verifierId, version: '1',
    }]);
    const verified = verifierLedger.record({
      taskId, taskVersion: '1', method: input.kind,
      seed: input.seed, attempt: input.attempt, passed,
      authority: input.authority, verifierId, evidenceRef,
      observedAt: this.timestamp(),
    });
    if (!verified.accepted) throw new Error(`outcome-not-authoritative:${verified.rejection?.code ?? 'unknown'}`);
    const outcome: InventionOutcome = {
      id: outcomeId,
      kind: input.kind,
      authority: input.authority,
      seed: input.seed,
      attempt: input.attempt,
      runId,
      verifierId,
      environmentId,
      testFingerprint: fingerprint,
      evidenceRef,
      evidenceSha256,
      observed: input.observed,
      effect01,
      passed,
      recordedAt: this.timestamp(),
    };
    record.outcomes.push(outcome);
    if (!passed) {
      record.stage = 'rejected';
      record.decisionReason = `${input.kind}-failed-preregistered-threshold`;
    } else if (input.kind === 'primary') {
      record.stage = 'tested';
    } else if (input.kind === 'replication') {
      record.stage = 'replicated';
    } else {
      record.stage = 'accepted';
      record.decisionReason = 'primary-replication-and-holdout-passed';
    }
    this.touch(record);
    return this.commit(record, input.kind === 'holdout' && passed ? 'accepted' :
      !passed ? 'rejected' : 'outcome-recorded');
  }

  critique(id: string, input: InventionCritiqueInput): InventionRecord {
    const record = this.find(id);
    if (record.stage !== 'tested') throw new Error('critique-requires-tested-prototype');
    const reviewerId = clampText(input?.reviewerId, 120);
    const reviewRef = clampText(input?.reviewRef, 512);
    const reviewSha256 = clampText(input?.reviewSha256, 64).toLowerCase();
    if (!reviewerId || !reviewRef || !SHA256_RE.test(reviewSha256)) throw new Error('invalid-critique');
    if (reviewerId !== record.protocol.verifierPlan.critique) throw new Error('reviewer-plan-mismatch');
    if (record.outcomes.some(outcome => outcome.verifierId === reviewerId)) {
      throw new Error('reviewer-must-be-independent');
    }
    const blockers = Array.isArray(input.blockers) ?
      input.blockers.map(value => clampText(value, 300)).filter(Boolean).slice(0, 32) : [];
    const limitations = Array.isArray(input.limitations) ?
      input.limitations.map(value => clampText(value, 300)).filter(Boolean).slice(0, 32) : [];
    record.critique = { reviewerId, reviewRef, reviewSha256, blockers, limitations, reviewedAt: this.timestamp() };
    if (blockers.length) {
      record.stage = 'rejected';
      record.decisionReason = 'independent-critique-blockers';
    } else {
      record.stage = 'critiqued';
    }
    this.touch(record);
    return this.commit(record, blockers.length ? 'rejected' : 'critiqued');
  }

  reject(id: string, reason: string): InventionRecord {
    const record = this.find(id);
    record.stage = 'rejected';
    record.decisionReason = clampText(reason, 500) || 'rejected-by-review';
    this.touch(record);
    return this.commit(record, 'rejected');
  }

  metrics() {
    const records = this.state.records;
    return {
      total: records.length,
      byStage: Object.fromEntries(STAGES.map(stage => [
        stage, records.filter(record => record.stage === stage).length,
      ])),
      accepted: this.state.accepted,
      rejected: this.state.rejected,
      auditVerifiedRecords: records.filter(verifyRecordAudit).length,
      quarantinedRecords: this.state.quarantinedRecords,
      replicationRate: records.filter(record =>
        record.outcomes.some(outcome => outcome.kind === 'replication')).length /
        Math.max(1, records.filter(record =>
          record.outcomes.some(outcome => outcome.kind === 'primary')).length),
    };
  }
}
