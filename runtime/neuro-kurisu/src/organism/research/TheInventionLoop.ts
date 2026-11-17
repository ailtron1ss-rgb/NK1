import { createHash } from 'node:crypto';
import {
  VerifiedOutcomeLedger,
  type EvaluationSplit,
  type TaskManifestEntry,
} from '../learning/VerifiedOutcomeLedger.ts';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';
import {
  hasAuthenticatedOutcomeEvidence,
  ingestSignedOutcomeArtifact,
  type SignedOutcomeArtifact,
  type SignedOutcomeMeasurement,
} from '../learning/VerifiedOutcomeArtifact.ts';

/**
 * The Invention Loop coordinates preregistration, blinded verification,
 * independent critique, multi-seed replication and holdout admission.
 * It records evidence; it never executes code, merges branches or publishes releases.
 */
export type InventionStage =
  | 'proposed' | 'designed' | 'prototyped' | 'tested' | 'critiqued'
  | 'replicating' | 'replicated' | 'holdingout' | 'accepted' | 'rejected';
export type OutcomeKind = 'primary' | 'replication' | 'holdout';
export type InventionVerifierPhase = OutcomeKind | 'critique';
export type InventionAuditAction =
  | 'proposed' | 'designed' | 'prototyped' | 'outcome-recorded'
  | 'critiqued' | 'accepted' | 'rejected';
export type InventionVerifierKeyResolver = (verifierId: string) => string | undefined;

export interface InventionVerifierPlan {
  primary: string;
  critique: string;
  replication: string;
  holdout: string;
}
export interface InventionProtocolProvenance {
  source: 'intrinsic' | 'dream-association' | 'manual';
  experimentId: string;
  scientificProjectId: string;
  linkedGoal?: string;
}
export interface InventionProtocol {
  question: string;
  hypothesis: string;
  successCriteria: string;
  /** SHA-256 identity of the frozen task manifest and evaluation implementation. */
  testFingerprint: string;
  /** Measured baseline, captured before prototype evaluation. */
  baseline: number;
  /** Absolute metric delta corresponding to 1.0 normalized effect. */
  metricScale: number;
  /** Required normalized mean effect in [0, 1]. */
  minEffect: number;
  /** Expected normalized effect recorded before evaluation; defaults to minEffect. */
  expectedEffect01?: number;
  /** Link back to the generator and scientific project that proposed this experiment. */
  provenance?: InventionProtocolProvenance;
  /** Minimum fraction of individual runs meeting minEffect. */
  minSuccessRate: number;
  /** One primary screening seed and fixed, disjoint phase cohorts. */
  primarySeed: number;
  replicationSeeds: number[];
  holdoutSeeds: number[];
  lowerIsBetter?: boolean;
  /** Verifier and reviewer identities are frozen before candidate evaluation. */
  verifierPlan: InventionVerifierPlan;
}
export interface InventionPrototype {
  reference: string;
  sha256: string;
}
export interface InventionOutcome {
  id: string;
  kind: OutcomeKind;
  authority: 'independent-verifier';
  seed: number;
  attempt: 1;
  runId: string;
  artifactId: string;
  verifierId: string;
  environmentId: string;
  testFingerprint: string;
  evidenceRef: string;
  evidenceSha256: string;
  observed: number;
  effect01: number;
  passed: boolean;
  attestationFingerprint: string;
  signedArtifact: SignedOutcomeArtifact;
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
export interface InventionCritique {
  reviewerId: string;
  reviewRef: string;
  reviewSha256: string;
  artifactId: string;
  attestationFingerprint: string;
  signedArtifact: SignedOutcomeArtifact;
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
  version: 4;
  records: InventionRecord[];
  accepted: number;
  rejected: number;
  quarantinedRecords: number;
}
export interface VerifiedInventionArtifact {
  artifactId: string;
  runId: string;
  verifierId: string;
  evidenceRef: string;
  attestationFingerprint: string;
}

const GENESIS_HASH = '0'.repeat(64);
const SHA256_RE = /^[a-f0-9]{64}$/iu;
const MAX_RECORDS = 256;
const MAX_AUDIT_EVENTS = 32;
const MIN_INDEPENDENT_SEEDS = 5;
const MAX_PHASE_SEEDS = 12;
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
export function inventionProtocolFingerprint(protocol: InventionProtocol): string {
  return sha256(protocol);
}
export function buildInventionVerifierManifest(
  inventionId: string,
  protocol: InventionProtocol,
  phase: InventionVerifierPhase,
  seed: number,
): TaskManifestEntry[] {
  const verifierId = protocol.verifierPlan[phase];
  const taskId = phase === 'critique'
    ? inventionId + ':critique'
    : inventionId + ':' + phase + ':' + seed;
  const split: EvaluationSplit = phase === 'holdout' ? 'holdout' : 'validation';
  return [{
    taskId,
    family: 'invention-loop',
    split,
    promptFingerprint: protocol.testFingerprint,
    verifierId,
    version: '1',
  }];
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
    (value.expectedEffect01 === undefined ||
      (finite(value.expectedEffect01) && value.expectedEffect01 >= 0 && value.expectedEffect01 <= 1)) &&
    (value.provenance === undefined || (
      isObject(value.provenance) &&
      ['intrinsic', 'dream-association', 'manual'].includes(String(value.provenance.source)) &&
      clampText(value.provenance.experimentId, 160).length > 0 &&
      clampText(value.provenance.scientificProjectId, 160).length > 0 &&
      (value.provenance.linkedGoal === undefined || clampText(value.provenance.linkedGoal, 160).length > 0)
    )) &&
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
function isSignedArtifact(value: unknown, contextType: SignedOutcomeMeasurement['contextType']): value is SignedOutcomeArtifact {
  if (!isObject(value) || typeof value.signature !== 'string' || !value.signature.trim() ||
      !isObject(value.payload)) return false;
  const payload = value.payload;
  const measurement = payload.measurement;
  return payload.schemaVersion === 1 &&
    typeof payload.artifactId === 'string' && typeof payload.runId === 'string' &&
    isObject(measurement) && measurement.contextType === contextType;
}
function isOutcome(value: unknown): value is InventionOutcome {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && typeof value.runId === 'string' &&
    (value.kind === 'primary' || value.kind === 'replication' || value.kind === 'holdout') &&
    value.authority === 'independent-verifier' &&
    Number.isSafeInteger(value.seed) && Number(value.seed) >= 0 &&
    Number(value.attempt) === 1 &&
    typeof value.artifactId === 'string' && typeof value.verifierId === 'string' &&
    typeof value.environmentId === 'string' &&
    typeof value.testFingerprint === 'string' && SHA256_RE.test(value.testFingerprint) &&
    typeof value.evidenceRef === 'string' && typeof value.evidenceSha256 === 'string' &&
    SHA256_RE.test(value.evidenceSha256) && finite(value.observed) &&
    finite(value.effect01) && value.effect01 >= 0 && value.effect01 <= 1 &&
    typeof value.passed === 'boolean' &&
    typeof value.attestationFingerprint === 'string' && SHA256_RE.test(value.attestationFingerprint) &&
    isSignedArtifact(value.signedArtifact, 'invention-outcome') && finite(value.recordedAt);
}
function isCritique(value: unknown): value is InventionCritique {
  if (!isObject(value)) return false;
  return typeof value.reviewerId === 'string' && typeof value.reviewRef === 'string' &&
    typeof value.reviewSha256 === 'string' && SHA256_RE.test(value.reviewSha256) &&
    typeof value.artifactId === 'string' &&
    typeof value.attestationFingerprint === 'string' && SHA256_RE.test(value.attestationFingerprint) &&
    isSignedArtifact(value.signedArtifact, 'invention-critique') &&
    Array.isArray(value.blockers) && value.blockers.every(item => typeof item === 'string') &&
    Array.isArray(value.limitations) && value.limitations.every(item => typeof item === 'string') &&
    finite(value.reviewedAt);
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
    (value.critique === undefined || isCritique(value.critique)) &&
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
function actionForStage(stage: InventionStage): InventionAuditAction {
  if (stage === 'proposed' || stage === 'designed' || stage === 'prototyped' ||
      stage === 'critiqued' || stage === 'accepted' || stage === 'rejected') return stage;
  return 'outcome-recorded';
}
function transitionAllowed(from: InventionStage, to: InventionStage): boolean {
  const next: Record<InventionStage, readonly InventionStage[]> = {
    proposed: ['designed', 'rejected'],
    designed: ['prototyped', 'rejected'],
    prototyped: ['tested', 'rejected'],
    tested: ['critiqued', 'rejected'],
    critiqued: ['replicating', 'rejected'],
    replicating: ['replicating', 'replicated', 'rejected'],
    replicated: ['holdingout', 'rejected'],
    holdingout: ['holdingout', 'accepted', 'rejected'],
    accepted: [],
    rejected: [],
  };
  return next[from].includes(to);
}
function verifyRecordAudit(record: unknown): record is InventionRecord {
  if (!isObject(record)) return false;
  const candidate = record as Record<string, unknown>;
  const trail = candidate.auditTrail;
  if (!isCore(candidate) || !Array.isArray(trail) ||
      trail.length < 1 || trail.length > MAX_AUDIT_EVENTS) return false;
  let previousHash = GENESIS_HASH;
  let previousSnapshot: InventionRecordCore | undefined;
  for (let index = 0; index < trail.length; index += 1) {
    const event = trail[index];
    if (!isObject(event) || event.sequence !== index + 1 ||
        !AUDIT_ACTIONS.includes(event.action as InventionAuditAction) ||
        !finite(event.at) || event.previousHash !== previousHash ||
        typeof event.hash !== 'string' || !SHA256_RE.test(event.hash) ||
        !isCore(event.snapshot) || event.snapshot.id !== record.id ||
        event.snapshot.updatedAt !== event.at ||
        actionForStage(event.snapshot.stage) !== event.action) return false;
    const snapshot = event.snapshot as InventionRecordCore;
    if (index === 0) {
      if (snapshot.stage !== 'proposed' || snapshot.outcomes.length !== 0 ||
          snapshot.critique !== undefined || snapshot.prototypeRef !== undefined ||
          snapshot.prototypeSha256 !== undefined) return false;
    } else if (previousSnapshot) {
      if (!transitionAllowed(previousSnapshot.stage, snapshot.stage) ||
          snapshot.createdAt !== previousSnapshot.createdAt ||
          canonical(snapshot.protocol) !== canonical(previousSnapshot.protocol) ||
          snapshot.updatedAt <= previousSnapshot.updatedAt) return false;
      const addedOutcomes = snapshot.outcomes.length - previousSnapshot.outcomes.length;
      const previousOutcomePrefix = snapshot.outcomes.slice(0, previousSnapshot.outcomes.length);
      if (canonical(previousOutcomePrefix) !== canonical(previousSnapshot.outcomes)) return false;
      if ((event.action === 'outcome-recorded' || event.action === 'accepted') && addedOutcomes !== 1) return false;
      if (event.action !== 'outcome-recorded' && event.action !== 'accepted' &&
          event.action !== 'rejected' && addedOutcomes !== 0) return false;
      if (event.action === 'rejected' && addedOutcomes !== 0 && addedOutcomes !== 1) return false;
      const critiqueWasAdded = previousSnapshot.critique === undefined && snapshot.critique !== undefined;
      if (critiqueWasAdded && event.action !== 'critiqued' && event.action !== 'rejected') return false;
      if (previousSnapshot.critique !== undefined &&
          canonical(previousSnapshot.critique) !== canonical(snapshot.critique)) return false;
      if (previousSnapshot.prototypeSha256 !== undefined &&
          previousSnapshot.prototypeSha256 !== snapshot.prototypeSha256) return false;
      if (previousSnapshot.prototypeRef !== undefined &&
          previousSnapshot.prototypeRef !== snapshot.prototypeRef) return false;
    }
    const payload = {
      sequence: event.sequence,
      action: event.action as InventionAuditAction,
      at: event.at,
      previousHash,
      snapshot,
    };
    if (event.hash !== auditHash(payload)) return false;
    previousHash = event.hash;
    previousSnapshot = snapshot;
  }
  const finalEvent = trail[trail.length - 1] as InventionAuditEvent;
  return canonical(finalEvent.snapshot) === canonical(coreOf(record as InventionRecord));
}

export class TheInventionLoop {
  private state: InventionLoopState = {
    version: 4, records: [], accepted: 0, rejected: 0, quarantinedRecords: 0,
  };

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly id: () => string = () =>
      globalThis.crypto?.randomUUID?.() ?? 'inv-' + Date.now() + '-' + Math.random().toString(16).slice(2),
    private readonly resolveVerifierKey: InventionVerifierKeyResolver = () => undefined,
  ) {}

  snapshot(): InventionLoopState {
    return structuredClone(this.state);
  }

  verifierManifest(id: string, phase: InventionVerifierPhase, seed: number): TaskManifestEntry[] {
    const record = this.state.records.find(item => item.id === id);
    if (!record) throw new Error('invention-not-found');
    if (phase === 'critique' && seed !== 0) throw new Error('invalid-critique-seed');
    const expected = phase === 'primary' ? [record.protocol.primarySeed] :
      phase === 'replication' ? record.protocol.replicationSeeds :
        phase === 'holdout' ? record.protocol.holdoutSeeds : [0];
    if (!expected.includes(seed)) throw new Error('seed-not-preregistered');
    return buildInventionVerifierManifest(id, record.protocol, phase, seed);
  }

  /** Restore only records whose audit chain and every signed artifact verify. */
  restore(raw?: Partial<InventionLoopState> | null): void {
    if (!raw) return;
    const detached = detach<Partial<InventionLoopState>>(raw, 'invalid-invention-state');
    const incoming = Array.isArray(detached.records) ? detached.records : [];
    if (detached.version !== 4) {
      this.state = {
        version: 4, records: [], accepted: 0, rejected: 0,
        quarantinedRecords: incoming.length,
      };
      return;
    }
    const records: InventionRecord[] = [];
    let quarantinedRecords = 0;
    const seen = new Set<string>();
    const seenArtifactIds = new Set<string>();
    const seenRunIds = new Set<string>();
    const seenEvidenceRefs = new Set<string>();
    for (const item of incoming.slice(0, MAX_RECORDS * 2)) {
      if (!verifyRecordAudit(item) || seen.has(item.id) || !this.verifyRecordAttestations(item)) {
        quarantinedRecords += 1;
        continue;
      }
      const receipts = [
        ...item.outcomes.map(outcome => ({
          artifactId: outcome.artifactId,
          runId: outcome.runId,
          evidenceRef: outcome.evidenceRef,
        })),
        ...(item.critique ? [{
          artifactId: item.critique.artifactId,
          runId: item.critique.signedArtifact.payload.runId,
          evidenceRef: 'signed-review:' + item.critique.artifactId + ':' + item.critique.attestationFingerprint,
        }] : []),
      ];
      if (receipts.some(receipt => seenArtifactIds.has(receipt.artifactId) ||
          seenRunIds.has(receipt.runId) || seenEvidenceRefs.has(receipt.evidenceRef))) {
        quarantinedRecords += 1;
        continue;
      }
      seen.add(item.id);
      for (const receipt of receipts) {
        seenArtifactIds.add(receipt.artifactId);
        seenRunIds.add(receipt.runId);
        seenEvidenceRefs.add(receipt.evidenceRef);
      }
      records.push(structuredClone(item));
    }
    this.state = {
      version: 4,
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

  private verifySignedArtifact(
    record: InventionRecord,
    rawArtifact: SignedOutcomeArtifact,
    phase: InventionVerifierPhase,
    seed: number,
  ): VerifiedInventionArtifact {
    const artifact = rawArtifact;
    const payload = artifact?.payload;
    if (!payload || typeof payload !== 'object') throw new Error('invalid-signed-artifact');
    const verifierId = record.protocol.verifierPlan[phase];
    if (payload.verifierId !== verifierId) {
      throw new Error(phase === 'critique' ? 'reviewer-plan-mismatch' : 'verifier-plan-mismatch');
    }
    const publicKey = this.resolveVerifierKey(verifierId);
    if (!publicKey) throw new Error('untrusted-verifier-key');

    const manifest = buildInventionVerifierManifest(record.id, record.protocol, phase, seed);
    const expectedTask = manifest[0]!;
    if (payload.taskId !== expectedTask.taskId || payload.method !== phase ||
        payload.taskVersion !== '1' || payload.seed !== seed || payload.attempt !== 1) {
      throw new Error('signed-artifact-context-mismatch');
    }
    const context = payload.measurement as SignedOutcomeMeasurement | undefined;
    if (!context) throw new Error('signed-measurement-required');
    const fingerprint = inventionProtocolFingerprint(record.protocol);
    if (context.experimentId !== record.id ||
        context.protocolFingerprint !== fingerprint ||
        context.prototypeSha256 !== record.prototypeSha256 ||
        context.testFingerprint !== record.protocol.testFingerprint) {
      throw new Error('attestation-context-mismatch');
    }
    if (phase === 'critique') {
      if (context.contextType !== 'invention-critique') throw new Error('signed-critique-required');
    } else if (context.contextType !== 'invention-outcome' || context.phase !== phase) {
      throw new Error('signed-outcome-required');
    }

    const ledger = new VerifiedOutcomeLedger(manifest);
    const ingested = ingestSignedOutcomeArtifact(ledger, manifest, artifact, new Map([[verifierId, publicKey]]));
    if (!ingested.accepted) throw new Error(ingested.rejection ?? 'signed-evidence-rejected');
    const row = ledger.snapshot().outcomes[0];
    const evidenceRef = row?.evidenceRef;
    if (!evidenceRef || !hasAuthenticatedOutcomeEvidence(ledger, evidenceRef)) {
      throw new Error('signed-evidence-trust-receipt-missing');
    }
    return {
      artifactId: payload.artifactId,
      runId: payload.runId,
      verifierId,
      evidenceRef,
      attestationFingerprint: ingested.artifactFingerprint,
    };
  }

  private verifyOutcomeContents(
    record: InventionRecord,
    artifact: SignedOutcomeArtifact,
    kind: OutcomeKind,
    expectedSeed: number,
  ): { verified: VerifiedInventionArtifact; context: Extract<SignedOutcomeMeasurement, { contextType: 'invention-outcome' }>; observed: number; effect01: number; passed: boolean } {
    const verified = this.verifySignedArtifact(record, artifact, kind, expectedSeed);
    const context = artifact.payload.measurement;
    if (!context || context.contextType !== 'invention-outcome' || context.phase !== kind ||
        !finite(context.observed) || !SHA256_RE.test(context.evidenceSha256) ||
        !clampText(context.environmentId, 180)) throw new Error('invalid-signed-measurement');
    const direction = record.protocol.lowerIsBetter ? -1 : 1;
    const effect01 = clamp01(((context.observed - record.protocol.baseline) * direction) /
      record.protocol.metricScale);
    const passed = effect01 >= record.protocol.minEffect;
    if (artifact.payload.passed !== passed) throw new Error('signed-outcome-result-mismatch');
    return { verified, context, observed: context.observed, effect01, passed };
  }

  private verifyCritiqueContents(
    record: InventionRecord,
    artifact: SignedOutcomeArtifact,
  ): { verified: VerifiedInventionArtifact; context: Extract<SignedOutcomeMeasurement, { contextType: 'invention-critique' }> } {
    const verified = this.verifySignedArtifact(record, artifact, 'critique', 0);
    const context = artifact.payload.measurement;
    if (!context || context.contextType !== 'invention-critique' ||
        !clampText(context.reviewRef, 512) || !SHA256_RE.test(context.reviewSha256) ||
        !Array.isArray(context.blockers) || !Array.isArray(context.limitations)) {
      throw new Error('invalid-signed-critique');
    }
    if (artifact.payload.passed !== (context.blockers.length === 0)) {
      throw new Error('signed-critique-result-mismatch');
    }
    return { verified, context };
  }

  private verifyRecordAttestations(record: InventionRecord): boolean {
    try {
      const seenRuns = new Set<string>();
      const seenArtifacts = new Set<string>();
      const seenEvidence = new Set<string>();
      const seenSeeds = new Set<string>();
      const seenEnvironments = new Set<string>();
      for (const outcome of record.outcomes) {
        const expectedSeeds = outcome.kind === 'primary' ? [record.protocol.primarySeed] :
          outcome.kind === 'replication' ? record.protocol.replicationSeeds : record.protocol.holdoutSeeds;
        const seedKey = outcome.kind + ':' + outcome.seed;
        if (!expectedSeeds.includes(outcome.seed) || seenSeeds.has(seedKey) ||
            seenRuns.has(outcome.runId) || seenArtifacts.has(outcome.artifactId) ||
            seenEvidence.has(outcome.evidenceRef) || seenEnvironments.has(outcome.environmentId) ||
            outcome.verifierId !== record.protocol.verifierPlan[outcome.kind] ||
            outcome.id !== record.id + ':' + outcome.kind + ':' + outcome.seed) return false;
        seenSeeds.add(seedKey);
        seenRuns.add(outcome.runId);
        seenArtifacts.add(outcome.artifactId);
        seenEvidence.add(outcome.evidenceRef);
        seenEnvironments.add(outcome.environmentId);
        const checked = this.verifyOutcomeContents(record, outcome.signedArtifact, outcome.kind, outcome.seed);
        if (checked.verified.artifactId !== outcome.artifactId ||
            checked.verified.runId !== outcome.runId ||
            checked.verified.evidenceRef !== outcome.evidenceRef ||
            checked.verified.attestationFingerprint !== outcome.attestationFingerprint ||
            checked.context.environmentId !== outcome.environmentId ||
            checked.context.testFingerprint !== outcome.testFingerprint ||
            checked.context.evidenceSha256 !== outcome.evidenceSha256 ||
            checked.observed !== outcome.observed || checked.effect01 !== outcome.effect01 ||
            checked.passed !== outcome.passed || checked.verified.verifierId !== outcome.verifierId) return false;
      }
      if (record.critique) {
        const checked = this.verifyCritiqueContents(record, record.critique.signedArtifact);
        const critiqueRunId = record.critique.signedArtifact.payload.runId;
        if (seenArtifacts.has(record.critique.artifactId) || seenRuns.has(critiqueRunId) ||
            checked.verified.artifactId !== record.critique.artifactId ||
            checked.verified.attestationFingerprint !== record.critique.attestationFingerprint ||
            checked.context.reviewRef !== record.critique.reviewRef ||
            checked.context.reviewSha256 !== record.critique.reviewSha256 ||
            canonical(checked.context.blockers) !== canonical(record.critique.blockers) ||
            canonical(checked.context.limitations) !== canonical(record.critique.limitations) ||
            checked.verified.verifierId !== record.critique.reviewerId) return false;
      }

      const replicationCount = record.outcomes.filter(outcome => outcome.kind === 'replication').length;
      const holdoutCount = record.outcomes.filter(outcome => outcome.kind === 'holdout').length;
      const replicationSummary = record.phaseSummaries?.replication;
      const holdoutSummary = record.phaseSummaries?.holdout;
      if ((replicationCount > 0) !== Boolean(replicationSummary) ||
          (holdoutCount > 0) !== Boolean(holdoutSummary)) return false;
      if (replicationSummary &&
          canonical(replicationSummary) !== canonical(this.summarizePhase(record, 'replication'))) return false;
      if (holdoutSummary &&
          canonical(holdoutSummary) !== canonical(this.summarizePhase(record, 'holdout'))) return false;
      if (record.outcomes.some(outcome => outcome.kind === 'replication' || outcome.kind === 'holdout') &&
          (!record.critique || record.critique.blockers.length > 0)) return false;
      if (['replicating', 'replicated', 'holdingout', 'accepted'].includes(record.stage) &&
          !record.critique) return false;
      if (['replicated', 'holdingout', 'accepted'].includes(record.stage) &&
          !replicationSummary?.passed) return false;
      if (['holdingout', 'accepted'].includes(record.stage) && !holdoutSummary) return false;
      if (record.stage === 'accepted' && !holdoutSummary?.passed) return false;
      if (record.critique?.blockers.length && record.stage !== 'rejected') return false;
      return true;
    } catch {
      return false;
    }
  }

  private prepareProtocol(input: InventionProtocol): InventionProtocol {
    const safe = detach<InventionProtocol>(input, 'invalid-preregistration-payload');
    if (!isObject(safe) || !isVerifierPlan(safe.verifierPlan) ||
        !Array.isArray(safe.replicationSeeds) || !Array.isArray(safe.holdoutSeeds) ||
        (safe.provenance !== undefined && !isObject(safe.provenance))) {
      throw new Error('invalid-preregistration-payload');
    }
    const protocol: InventionProtocol = {
      question: clampText(safe.question, 500),
      hypothesis: clampText(safe.hypothesis, MAX_TEXT),
      successCriteria: clampText(safe.successCriteria, MAX_TEXT),
      testFingerprint: clampText(safe.testFingerprint, 64).toLowerCase(),
      baseline: safe.baseline,
      metricScale: safe.metricScale,
      minEffect: safe.minEffect,
      expectedEffect01: safe.expectedEffect01 === undefined ? safe.minEffect : safe.expectedEffect01,
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
      provenance: safe.provenance ? {
        source: safe.provenance.source,
        experimentId: clampText(safe.provenance.experimentId, 160),
        scientificProjectId: clampText(safe.provenance.scientificProjectId, 160),
        linkedGoal: safe.provenance.linkedGoal === undefined
          ? undefined : clampText(safe.provenance.linkedGoal, 160),
      } : undefined,
    };
    const seedSet = new Set([
      protocol.primarySeed, ...protocol.replicationSeeds, ...protocol.holdoutSeeds,
    ]);
    if (!protocol.question || !protocol.hypothesis || !protocol.successCriteria ||
        !SHA256_RE.test(protocol.testFingerprint) || !finite(protocol.baseline) ||
        !finite(protocol.metricScale) || protocol.metricScale <= 0 ||
        !finite(protocol.minEffect) || protocol.minEffect < 0 || protocol.minEffect > 1 ||
        !finite(protocol.expectedEffect01) || protocol.expectedEffect01 < 0 || protocol.expectedEffect01 > 1 ||
        !finite(protocol.minSuccessRate) || protocol.minSuccessRate < 0.6 || protocol.minSuccessRate > 1 ||
        !Number.isSafeInteger(protocol.primarySeed) || protocol.primarySeed < 0 ||
        !isSeedArray(protocol.replicationSeeds) || !isSeedArray(protocol.holdoutSeeds) ||
        seedSet.size !== 1 + protocol.replicationSeeds.length + protocol.holdoutSeeds.length ||
        new Set(Object.values(protocol.verifierPlan)).size !== 4 ||
        Object.values(protocol.verifierPlan).some(value => !value) ||
        (protocol.provenance !== undefined &&
          (!protocol.provenance.experimentId || !protocol.provenance.scientificProjectId ||
            !['intrinsic', 'dream-association', 'manual'].includes(protocol.provenance.source) ||
            (protocol.provenance.linkedGoal !== undefined && !protocol.provenance.linkedGoal)))) {
      throw new Error('invalid-preregistration');
    }
    return protocol;
  }

  validateProtocol(input: InventionProtocol): InventionProtocol {
    return structuredClone(this.prepareProtocol(input));
  }

  propose(input: InventionProtocol): InventionRecord {
    const protocol = this.prepareProtocol(input);
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
    if (!isObject(safe)) throw new Error('invalid-prototype-payload');
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

  recordOutcome(id: string, input: SignedOutcomeArtifact): InventionRecord {
    const artifact = detach<SignedOutcomeArtifact>(input, 'invalid-outcome-payload');
    if (!isSignedArtifact(artifact, 'invention-outcome')) throw new Error('invalid-signed-artifact');
    const record = this.find(id);
    const phase = artifact.payload.measurement?.contextType === 'invention-outcome'
      ? artifact.payload.measurement.phase : undefined;
    let expectedKind: OutcomeKind | null = null;
    if (record.stage === 'prototyped') expectedKind = 'primary';
    else if (record.stage === 'critiqued' || record.stage === 'replicating') expectedKind = 'replication';
    else if (record.stage === 'replicated' || record.stage === 'holdingout') expectedKind = 'holdout';
    if (expectedKind === null || phase !== expectedKind) throw new Error('outcome-kind-not-allowed-at-stage');

    const seed = artifact.payload.seed;
    const expectedSeeds = expectedKind === 'primary' ? [record.protocol.primarySeed] :
      expectedKind === 'replication' ? record.protocol.replicationSeeds : record.protocol.holdoutSeeds;
    if (!Number.isSafeInteger(seed) || !expectedSeeds.includes(seed)) throw new Error('seed-not-preregistered');
    if (artifact.payload.attempt !== 1) throw new Error('attempt-must-be-one');

    const { verified, context, observed, effect01, passed } =
      this.verifyOutcomeContents(record, artifact, expectedKind, seed);
    const existingArtifacts = this.state.records.some(candidate =>
      candidate.outcomes.some(outcome => outcome.artifactId === verified.artifactId ||
        outcome.runId === verified.runId || outcome.evidenceRef === verified.evidenceRef) ||
      candidate.critique?.artifactId === verified.artifactId ||
      candidate.critique?.signedArtifact.payload.runId === verified.runId ||
      candidate.critique?.signedArtifact.payload.artifactId === verified.artifactId);
    if (existingArtifacts) throw new Error('duplicate-run-or-evidence-across-inventions');

    if (record.outcomes.some(outcome =>
      outcome.kind === expectedKind && outcome.seed === seed)) throw new Error('duplicate-seed');
    if (record.outcomes.some(outcome => outcome.runId === verified.runId ||
        outcome.evidenceRef === verified.evidenceRef ||
        (outcome.verifierId === verified.verifierId && outcome.environmentId === context.environmentId))) {
      throw new Error('duplicate-run-outcome-or-seed');
    }

    if (expectedKind === 'replication') {
      const primary = record.outcomes.find(outcome => outcome.kind === 'primary');
      if (!primary || primary.verifierId === verified.verifierId ||
          primary.environmentId === context.environmentId ||
          record.outcomes.some(outcome => outcome.kind === 'replication' &&
            outcome.environmentId === context.environmentId)) {
        throw new Error('replication-not-independent');
      }
    }
    if (expectedKind === 'holdout') {
      const priorNonHoldout = record.outcomes.filter(outcome => outcome.kind !== 'holdout');
      if (priorNonHoldout.some(outcome => outcome.verifierId === verified.verifierId) ||
          record.outcomes.some(outcome => outcome.environmentId === context.environmentId ||
            outcome.runId === verified.runId)) {
        throw new Error('holdout-must-be-independent');
      }
    }

    const outcome: InventionOutcome = {
      id: id + ':' + expectedKind + ':' + seed,
      kind: expectedKind,
      authority: 'independent-verifier',
      seed,
      attempt: 1,
      runId: verified.runId,
      artifactId: verified.artifactId,
      verifierId: verified.verifierId,
      environmentId: context.environmentId,
      testFingerprint: context.testFingerprint,
      evidenceRef: verified.evidenceRef,
      evidenceSha256: context.evidenceSha256,
      observed,
      effect01,
      passed,
      attestationFingerprint: verified.attestationFingerprint,
      signedArtifact: artifact,
      recordedAt: this.timestamp(),
    };
    record.outcomes.push(outcome);
    if (!passed && expectedKind === 'primary') {
      record.stage = 'rejected';
      record.decisionReason = 'primary-failed-preregistered-threshold';
    } else if (expectedKind === 'primary') {
      record.stage = 'tested';
    } else if (expectedKind === 'replication') {
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
    return this.commit(record, record.stage === 'accepted' ? 'accepted' :
      record.stage === 'rejected' ? 'rejected' : 'outcome-recorded');
  }

  critique(id: string, input: SignedOutcomeArtifact): InventionRecord {
    const artifact = detach<SignedOutcomeArtifact>(input, 'invalid-critique-payload');
    if (!isSignedArtifact(artifact, 'invention-critique')) throw new Error('invalid-critique-payload');
    const record = this.find(id);
    if (record.stage !== 'tested') throw new Error('critique-requires-tested-prototype');
    const { verified, context } = this.verifyCritiqueContents(record, artifact);
    const reused = this.state.records.some(candidate =>
      candidate.outcomes.some(outcome => outcome.artifactId === verified.artifactId ||
        outcome.runId === verified.runId || outcome.evidenceRef === verified.evidenceRef) ||
      candidate.critique?.artifactId === verified.artifactId ||
      candidate.critique?.signedArtifact.payload.runId === verified.runId);
    if (reused) throw new Error('duplicate-review-artifact');

    record.critique = {
      reviewerId: verified.verifierId,
      reviewRef: context.reviewRef,
      reviewSha256: context.reviewSha256,
      artifactId: verified.artifactId,
      attestationFingerprint: verified.attestationFingerprint,
      signedArtifact: artifact,
      blockers: structuredClone(context.blockers),
      limitations: structuredClone(context.limitations),
      reviewedAt: this.timestamp(),
    };
    if (context.blockers.length) {
      record.stage = 'rejected';
      record.decisionReason = 'independent-critique-blockers';
    } else {
      record.stage = 'critiqued';
    }
    this.touch(record);
    return this.commit(record, context.blockers.length ? 'rejected' : 'critiqued');
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
      attestationVerifiedRecords: records.filter(record => this.verifyRecordAttestations(record)).length,
      quarantinedRecords: this.state.quarantinedRecords,
      replicationRate: records.filter(record =>
        record.outcomes.some(outcome => outcome.kind === 'replication')).length /
        Math.max(1, records.filter(record =>
          record.outcomes.some(outcome => outcome.kind === 'primary')).length),
    };
  }
}
