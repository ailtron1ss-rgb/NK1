import { createHash } from 'node:crypto';
import { VerifiedOutcomeLedger, type OutcomeAuthority, type EvaluationSplit } from '../learning/VerifiedOutcomeLedger.ts';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';

/**
 * The Invention Loop — evidence-gated lifecycle for converting hypotheses
 * into reproducible engineering improvements. It coordinates evidence; it
 * never executes arbitrary code, merges branches, publishes releases or
 * promotes model weights.
 */
export type InventionStage =
  | 'proposed' | 'designed' | 'prototyped' | 'tested'
  | 'critiqued' | 'replicating' | 'replicated' | 'holdingout'
  | 'accepted' | 'rejected';
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
  /** SHA-256 identity of the frozen test manifest and evaluation implementation. */
  testFingerprint: string;
  /** Measured baseline, captured before prototype evaluation. */
  baseline: number;
  /** Absolute metric delta corresponding to 1.0 normalized effect. */
  metricScale: number;
  /** Required normalized mean effect in [0, 1]. */
  minEffect: number;
  /** Minimum fraction of individual runs meeting minEffect. */
  minSuccessRate: number;
  /** One screening seed and fixed independent seed cohorts for later phases. */
  primarySeed: number;
  replicationSeeds: number[];
  holdoutSeeds: number[];
  lowerIsBetter?: boolean;
  /** Reviewer identities are frozen before any candidate evaluation. */
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
  /** One-shot preregistered evaluation; retries require a new invention record. */
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
export interface InventionPhaseSummary {
  kind: 'replication' | 'holdout';
  sampleCount: number;
  requiredSamples: number;
  successfulRuns: number;
  successRate01: number;
  meanEffect01: number;
  minimumEffect01: number;
  passed: boolean;
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
  phaseSummaries?: Partial<Record<'replication' | 'holdout', InventionPhaseSummary>>;
  critique?: InventionCritique;
  decisionReason?: string;
}
export interface InventionAuditEvent {
  sequence: number;
  action: InventionAuditAction;
  at: number;
  previousHash: string;
  hash: string;
  snapshot: InventionRecordCore;
}
export interface InventionRecord extends InventionRecordCore {
  auditTrail: InventionAuditEvent[];
}
export interface InventionLoopState {
  version: 3;
  records: InventionRecord[];
  accepted: number;
  rejected: number;
  quarantinedRecords: number;
}

const GENESIS_HASH = '0'.repeat(64);
const SHA256_RE = /^[a-f0-9]{64}$/iu;
const MAX_RECORDS = 256;
const MAX_AUDIT_EVENTS = 32;
const MIN_INDEPENDENT_SEEDS = 5;
const MAX_PHASE_SEEDS = 32;
const MAX_TEXT = 1000;
const STAGES: InventionStage[] = [
  'proposed', 'designed', 'prototyped', 'tested', 'critiqued',
  'replicating', 'replicated', 'holdingout', 'accepted', 'rejected',
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

function detach<T>(value: unknown, errorCode: string): T {
  try {
    return snapshotPlainData(value) as T;
  } catch {
    throw new Error(errorCode);
  }
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).filter(key => object[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
}
function sha256(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function coreOf(record: InventionRecord): InventionRecordCore {
  const { auditTrail: _auditTrail, ...core } = record;
  return structuredClone(core);
}
function isSeedArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= MIN_INDEPENDENT_SEEDS &&
    value.length <= MAX_PHASE_SEEDS &&
    value.every(seed => Number.isSafeInteger(seed) && Number(seed) >= 0) &&
    new Set(value).size === value.length;
}
function isVerifierPlan(value: unknown): value is InventionVerifierPlan {
  if (!isObject(value)) return false;
  const ids = [value.primary, value.critique, value.replication, value.holdout];
  return ids.every(id => typeof id === 'string' && clampText(id, 120).length > 0) &&
    new Set(ids.map(id => clampText(id, 120))).size === 4;
}
function isProtocol(value: unknown): value is InventionProtocol {
  if (!isObject(value) || !isVerifierPlan(value.verifierPlan)) return false;
  const allSeeds = [
    value.primarySeed,
    ...(Array.isArray(value.replicationSeeds) ? value.replicationSeeds : []),
    ...(Array.isArray(value.holdoutSeeds) ? value.holdoutSeeds : []),
  ];
  return typeof value.question === 'string' &&
    typeof value.hypothesis === 'string' &&
    typeof value.successCriteria === 'string' &&
    typeof value.testFingerprint === 'string' && SHA256_RE.test(value.testFingerprint) &&
    finite(value.baseline) && finite(value.metricScale) && value.metricScale > 0 &&
    finite(value.minEffect) && value.minEffect >= 0 && value.minEffect <= 1 &&
    finite(value.minSuccessRate) && value.minSuccessRate >= 0.6 && value.minSuccessRate <= 1 &&
    Number.isSafeInteger(value.primarySeed) && Number(value.primarySeed) >= 0 &&
    isSeedArray(value.replicationSeeds) && isSeedArray(value.holdoutSeeds) &&
    (value.lowerIsBetter === undefined || typeof value.lowerIsBetter === 'boolean') &&
    new Set(allSeeds).size === allSeeds.length;
}
function isPhaseSummary(value: unknown): value is InventionPhaseSummary {
  if (!isObject(value)) return false;
  return (value.kind === 'replication' || value.kind === 'holdout') &&
    Number.isSafeInteger(value.sampleCount) && Number(value.sampleCount) >= 0 &&
    Number.isSafeInteger(value.requiredSamples) && Number(value.requiredSamples) >= MIN_INDEPENDENT_SEEDS &&
    Number.isSafeInteger(value.successfulRuns) && Number(value.successfulRuns) >= 0 &&
    Number(value.successfulRuns) <= Number(value.sampleCount) &&
    finite(value.successRate01) && value.successRate01 >= 0 && value.successRate01 <= 1 &&
    finite(value.meanEffect01) && value.meanEffect01 >= 0 && value.meanEffect01 <= 1 &&
    finite(value.minimumEffect01) && value.minimumEffect01 >= 0 && value.minimumEffect01 <= 1 &&
    typeof value.passed === 'boolean';
}
function isOutcome(value: unknown): value is InventionOutcome {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && typeof value.runId === 'string' &&
    (value.kind === 'primary' || value.kind === 'replication' || value.kind === 'holdout') &&
    (value.authority === 'independent-verifier' || value.authority === 'human-review') &&
    Number.isSafeInteger(value.seed) && Number(value.seed) >= 0 &&
    Number(value.attempt) === 1 &&
    typeof value.verifierId === 'string' && typeof value.environmentId === 'string' &&
    typeof value.testFingerprint === 'string' && SHA256_RE.test(value.testFingerprint) &&
    typeof value.evidenceRef === 'string' && typeof value.evidenceSha256 === 'string' &&
    SHA256_RE.test(value.evidenceSha256) && finite(value.observed) &&
    finite(value.effect01) && value.effect01 >= 0 && value.effect01 <= 1 &&
    typeof value.passed === 'boolean' && finite(value.recordedAt);
}
function isCore(value: unknown): value is InventionRecordCore {
  if (!isObject(value)) return false;
  const summaries = value.phaseSummaries;
  return typeof value.id === 'string' && STAGES.includes(value.stage as InventionStage) &&
    isProtocol(value.protocol) && finite(value.createdAt) && finite(value.updatedAt) &&
    Array.isArray(value.outcomes) && value.outcomes.every(isOutcome) &&
    (value.prototypeRef === undefined || typeof value.prototypeRef === 'string') &&
    (value.prototypeSha256 === undefined ||
      (typeof value.prototypeSha256 === 'string' && SHA256_RE.test(value.prototypeSha256))) &&
    (summaries === undefined || (isObject(summaries) &&
      (summaries.replication === undefined || isPhaseSummary(summaries.replication)) &&
      (summaries.holdout === undefined || isPhaseSummary(summaries.holdout)))) &&
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
  if (!isCore(candidate) || !Array.isArray(trail) ||
      trail.length < 1 || trail.length > MAX_AUDIT_EVENTS) return false;
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
    if (event.hash !== auditHash(payload)) return false;
    previousHash = event.hash;
  }
  const finalEvent = trail[trail.length - 1] as InventionAuditEvent;
  return canonical(finalEvent.snapshot) === canonical(coreOf(record as InventionRecord));
}

export class TheInventionLoop {
  private state: InventionLoopState = {
    version: 3, records: [], accepted: 0, rejected: 0, quarantinedRecords: 0,
  };

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = () =>
      globalThis.crypto?.randomUUID?.() ?? 'inv-' + Date.now() + '-' + Math.random().toString(16).slice(2),
  ) {}

  snapshot(): InventionLoopState {
    return structuredClone(this.state);
  }

  /** Restore only records with a valid per-record audit chain. */
  restore(raw?: Partial<InventionLoopState> | null): void {
    if (!raw) return;
    const detached = detach<Partial<InventionLoopState>>(raw, 'invalid-invention-state');
    const incoming = Array.isArray(detached.records) ? detached.records : [];
    if (detached.version !== 3) {
      this.state = {
        version: 3, records: [], accepted: 0, rejected: 0,
        quarantinedRecords: incoming.length,
      };
      return;
    }
    const records: InventionRecord[] = [];
    let quarantinedRecords = 0;
    const seen = new Set<string>();
    for (const item of incoming.slice(0, MAX_RECORDS * 2)) {
      if (!verifyRecordAudit(item) || seen.has(item.id)) {
        quarantinedRecords += 1;
        continue;
      }
      seen.add(item.id);
      records.push(structuredClone(item));
    }
    this.state = {
      version: 3,
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
  private summarizePhase(record: InventionRecord, kind: 'replication' | 'holdout'): InventionPhaseSummary {
    const expected = kind === 'replication' ?
      record.protocol.replicationSeeds : record.protocol.holdoutSeeds;
    const outcomes = record.outcomes.filter(outcome => outcome.kind === kind);
    const successfulRuns = outcomes.filter(outcome => outcome.passed).length;
    const meanEffect01 = outcomes.length ?
      outcomes.reduce((sum, outcome) => sum + outcome.effect01, 0) / outcomes.length : 0;
    const successRate01 = outcomes.length ? successfulRuns / outcomes.length : 0;
    const minimumEffect01 = outcomes.length ?
      Math.min(...outcomes.map(outcome => outcome.effect01)) : 0;
    const complete = outcomes.length === expected.length &&
      expected.every(seed => outcomes.some(outcome => outcome.seed === seed));
    return {
      kind,
      sampleCount: outcomes.length,
      requiredSamples: expected.length,
      successfulRuns,
      successRate01,
      meanEffect01,
      minimumEffect01,
      passed: complete && meanEffect01 >= record.protocol.minEffect &&
        successRate01 >= record.protocol.minSuccessRate,
    };
  }

  propose(input: InventionProtocol): InventionRecord {
    const safe = detach<InventionProtocol>(input, 'invalid-preregistration-payload');
    const protocol: InventionProtocol = {
      question: clampText(safe.question, 500),
      hypothesis: clampText(safe.hypothesis, MAX_TEXT),
      successCriteria: clampText(safe.successCriteria, MAX_TEXT),
      testFingerprint: clampText(safe.testFingerprint, 64).toLowerCase(),
      baseline: safe.baseline,
      metricScale: safe.metricScale,
      minEffect: safe.minEffect,
      minSuccessRate: safe.minSuccessRate,
      primarySeed: safe.primarySeed,
      replicationSeeds: [...safe.replicationSeeds],
      holdoutSeeds: [...safe.holdoutSeeds],
      lowerIsBetter: safe.lowerIsBetter === true,
      verifierPlan: {
        primary: clampText(safe.verifierPlan.primary, 120),
        critique: clampText(safe.verifierPlan.critique, 120),
        replication: clampText(safe.verifierPlan.replication, 120),
        holdout: clampText(safe.verifierPlan.holdout, 120),
      },
    };
    const seedSet = new Set([
      protocol.primarySeed, ...protocol.replicationSeeds, ...protocol.holdoutSeeds,
    ]);
    if (!protocol.question || !protocol.hypothesis || !protocol.successCriteria ||
        !SHA256_RE.test(protocol.testFingerprint) || !finite(protocol.baseline) ||
        !finite(protocol.metricScale) || protocol.metricScale <= 0 ||
        !finite(protocol.minEffect) || protocol.minEffect < 0 || protocol.minEffect > 1 ||
        !finite(protocol.minSuccessRate) || protocol.minSuccessRate < 0.6 || protocol.minSuccessRate > 1 ||
        !Number.isSafeInteger(protocol.primarySeed) || protocol.primarySeed < 0 ||
        !isSeedArray(protocol.replicationSeeds) || !isSeedArray(protocol.holdoutSeeds) ||
        seedSet.size !== 1 + protocol.replicationSeeds.length + protocol.holdoutSeeds.length ||
        new Set(Object.values(protocol.verifierPlan)).size !== 4 ||
        Object.values(protocol.verifierPlan).some(value => !value)) {
      throw new Error('invalid-preregistration');
    }
    const at = this.timestamp();
    const record: InventionRecord = {
      id: clampText(this.id(), 120) || 'invention-' + at,
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
    const safe = detach<InventionPrototype>(input, 'invalid-prototype-payload');
    const record = this.find(id);
    if (record.stage !== 'designed') throw new Error('invalid-stage-transition');
    const reference = clampText(safe.reference, 300);
    const digest = clampText(safe.sha256, 64).toLowerCase();
    if (!reference || !SHA256_RE.test(digest)) throw new Error('invalid-prototype');
    record.prototypeRef = reference;
    record.prototypeSha256 = digest;
    record.stage = 'prototyped';
    this.touch(record);
    return this.commit(record, 'prototyped');
  }

  recordOutcome(id: string, input: InventionOutcomeInput): InventionRecord {
    const safe = detach<InventionOutcomeInput>(input, 'invalid-outcome-payload');
    const record = this.find(id);
    let expectedKind: OutcomeKind | null = null;
    if (record.stage === 'prototyped') expectedKind = 'primary';
    else if (record.stage === 'critiqued' || record.stage === 'replicating') expectedKind = 'replication';
    else if (record.stage === 'replicated' || record.stage === 'holdingout') expectedKind = 'holdout';
    if (expectedKind === null || safe.kind !== expectedKind) {
      throw new Error('outcome-kind-not-allowed-at-stage');
    }

    const runId = clampText(safe.runId, 160);
    const verifierId = clampText(safe.verifierId, 120);
    const environmentId = clampText(safe.environmentId, 120);
    const fingerprint = clampText(safe.testFingerprint, 64).toLowerCase();
    const evidenceRef = clampText(safe.evidenceRef, 512);
    const evidenceSha256 = clampText(safe.evidenceSha256, 64).toLowerCase();
    if (!runId || !verifierId || !environmentId || !evidenceRef ||
        !SHA256_RE.test(evidenceSha256) || fingerprint !== record.protocol.testFingerprint ||
        !finite(safe.observed)) {
      throw new Error('invalid-outcome');
    }
    const expectedVerifier = record.protocol.verifierPlan[safe.kind];
    if (verifierId !== expectedVerifier) throw new Error('verifier-plan-mismatch');
    if (safe.authority !== 'independent-verifier' && safe.authority !== 'human-review') {
      throw new Error('outcome-not-authoritative:self-report-not-authoritative');
    }
    if (!Number.isSafeInteger(safe.seed) || safe.seed < 0 ||
        !Number.isSafeInteger(safe.attempt) || safe.attempt !== 1) {
      throw new Error('attempt-must-be-one-and-seed-valid');
    }
    const expectedSeeds = safe.kind === 'primary' ? [record.protocol.primarySeed] :
      safe.kind === 'replication' ? record.protocol.replicationSeeds : record.protocol.holdoutSeeds;
    if (!expectedSeeds.includes(safe.seed)) throw new Error('seed-not-preregistered');
    const outcomeId = clampText(safe.id, 160) || id + ':' + safe.kind + ':' + safe.seed;
    if (this.state.records.some(candidate => candidate.outcomes.some(outcome =>
      outcome.id === outcomeId || outcome.runId === runId || outcome.evidenceRef === evidenceRef))) {
      throw new Error('duplicate-run-or-evidence-across-inventions');
    }
    if (record.outcomes.some(outcome => outcome.kind === safe.kind && outcome.seed === safe.seed)) {
      throw new Error('duplicate-seed');
    }
    if (record.outcomes.some(outcome => outcome.id === outcomeId ||
        outcome.runId === runId ||
        (outcome.verifierId === verifierId && outcome.environmentId === environmentId))) {
      throw new Error('duplicate-run-outcome-or-seed');
    }

    if (safe.kind === 'replication') {
      const primary = record.outcomes.find(outcome => outcome.kind === 'primary');
      if (!primary || primary.verifierId === verifierId || primary.environmentId === environmentId ||
          record.outcomes.some(outcome => outcome.kind === 'replication' && outcome.environmentId === environmentId)) {
        throw new Error('replication-not-independent');
      }
    }
    if (safe.kind === 'holdout') {
      if (record.outcomes.some(outcome =>
        outcome.verifierId === verifierId || outcome.environmentId === environmentId ||
        outcome.runId === runId)) {
        throw new Error('holdout-must-be-independent');
      }
    }

    const direction = record.protocol.lowerIsBetter ? -1 : 1;
    const normalizedDelta = ((safe.observed - record.protocol.baseline) * direction) /
      record.protocol.metricScale;
    const effect01 = clamp01(normalizedDelta);
    const passed = effect01 >= record.protocol.minEffect;
    const taskId = id + ':' + safe.kind + ':' + safe.seed;
    const split: EvaluationSplit = safe.kind === 'holdout' ? 'holdout' : 'validation';
    const verifierLedger = new VerifiedOutcomeLedger([{
      taskId, family: 'invention-loop', split,
      promptFingerprint: record.protocol.testFingerprint,
      verifierId, version: '1',
    }]);
    const verified = verifierLedger.record({
      taskId, taskVersion: '1', method: safe.kind,
      seed: safe.seed, attempt: safe.attempt, passed,
      authority: safe.authority, verifierId, evidenceRef,
      observedAt: this.timestamp(),
    });
    if (!verified.accepted) {
      throw new Error('outcome-not-authoritative:' + (verified.rejection?.code ?? 'unknown'));
    }

    const outcome: InventionOutcome = {
      id: outcomeId,
      kind: safe.kind,
      authority: safe.authority,
      seed: safe.seed,
      attempt: safe.attempt,
      runId,
      verifierId,
      environmentId,
      testFingerprint: fingerprint,
      evidenceRef,
      evidenceSha256,
      observed: safe.observed,
      effect01,
      passed,
      recordedAt: this.timestamp(),
    };
    record.outcomes.push(outcome);
    if (!passed && safe.kind === 'primary') {
      record.stage = 'rejected';
      record.decisionReason = 'primary-failed-preregistered-threshold';
    } else if (safe.kind === 'primary') {
      record.stage = 'tested';
    } else if (safe.kind === 'replication') {
      const summary = this.summarizePhase(record, 'replication');
      record.phaseSummaries = { ...(record.phaseSummaries ?? {}), replication: summary };
      if (summary.sampleCount < summary.requiredSamples) {
        record.stage = 'replicating';
      } else if (summary.passed) {
        record.stage = 'replicated';
      } else {
        record.stage = 'rejected';
        record.decisionReason = 'replication-cohort-failed-preregistered-gate';
      }
    } else {
      const summary = this.summarizePhase(record, 'holdout');
      record.phaseSummaries = { ...(record.phaseSummaries ?? {}), holdout: summary };
      if (summary.sampleCount < summary.requiredSamples) {
        record.stage = 'holdingout';
      } else if (summary.passed) {
        record.stage = 'accepted';
        record.decisionReason = 'replication-and-holdout-cohorts-passed';
      } else {
        record.stage = 'rejected';
        record.decisionReason = 'holdout-cohort-failed-preregistered-gate';
      }
    }
    this.touch(record);
    return this.commit(record,
      record.stage === 'accepted' ? 'accepted' :
        record.stage === 'rejected' ? 'rejected' : 'outcome-recorded');
  }

  critique(id: string, input: InventionCritiqueInput): InventionRecord {
    const safe = detach<InventionCritiqueInput>(input, 'invalid-critique-payload');
    const record = this.find(id);
    if (record.stage !== 'tested') throw new Error('critique-requires-tested-prototype');
    const reviewerId = clampText(safe.reviewerId, 120);
    const reviewRef = clampText(safe.reviewRef, 512);
    const reviewSha256 = clampText(safe.reviewSha256, 64).toLowerCase();
    if (!reviewerId || !reviewRef || !SHA256_RE.test(reviewSha256)) throw new Error('invalid-critique');
    if (reviewerId !== record.protocol.verifierPlan.critique) throw new Error('reviewer-plan-mismatch');
    if (record.outcomes.some(outcome => outcome.verifierId === reviewerId)) {
      throw new Error('reviewer-must-be-independent');
    }
    const blockers = Array.isArray(safe.blockers) ?
      safe.blockers.map(value => clampText(value, 300)).filter(Boolean).slice(0, 32) : [];
    const limitations = Array.isArray(safe.limitations) ?
      safe.limitations.map(value => clampText(value, 300)).filter(Boolean).slice(0, 32) : [];
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
