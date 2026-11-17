import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';
import {
  TheInventionLoop,
  inventionProtocolFingerprint,
  type InventionProtocol,
  type InventionStage,
  type InventionRecord,
} from './TheInventionLoop.ts';
import type { SignedOutcomeArtifact } from '../learning/VerifiedOutcomeArtifact.ts';

export type ScienceRole =
  | 'discoverer' | 'theorist' | 'experimentalist'
  | 'replicator' | 'skeptic' | 'auditor';

export interface ScienceActors {
  discoverer: string;
  theorist: string;
  experimentalist: string;
  replicator: string;
  skeptic: string;
  auditor: string;
}

export interface ScienceRoleSubjects {
  discoverer: string;
  theorist: string;
  experimentalist: string;
  replicator: string;
  skeptic: string;
  auditor: string;
}

export type ScienceStage =
  | 'discovered' | 'theorized' | 'registered' | 'prototyped'
  | 'tested' | 'critiqued' | 'replicating' | 'replicated'
  | 'holdingout' | 'awaiting-audit' | 'audit-complete'
  | 'audit-blocked' | 'rejected';

export interface ScienceArtifact {
  reference: string;
  sha256: string;
}

/** Stable host principal binding for a named actor in a scientific role. */
export type ScienceRoleIdentityResolver = (
  role: ScienceRole,
  actorId: string,
  scienceRecordId: string,
) => string | undefined;

/** Host artifact-store adapter; must verify bytes and compute their SHA-256. */
export type ScienceArtifactBytesVerifier = (
  artifact: ScienceArtifact,
  context: { scienceRecordId: string; purpose: 'evidence' | 'audit' },
) => boolean;

/** Snapshot of the canonical runtime capture; Science Republic never runs a second generator. */
export interface ScienceCandidateProvenance {
  id: string;
  experimentId: string;
  source: 'intrinsic' | 'dream-association';
  question: string;
  hypothesis: string;
  prediction: string;
  scientificProjectId: string;
  linkedGoal?: string;
  createdAt: number;
  createdTick: number;
  candidateFingerprint: string;
  status: 'awaiting-preregistration' | 'preregistered';
  inventionId?: string;
}

export interface ScienceDiscoveryInput {
  title: string;
  domain: string;
  observation: string;
  evidence: ScienceArtifact;
  actors: ScienceActors;
  candidate?: ScienceCandidateProvenance;
}

export interface ScienceTheoryInput {
  actorId: string;
  mechanism: string;
  predictions: string[];
  falsifiers: string[];
  alternatives: string[];
  evidence: ScienceArtifact;
}

export interface SciencePrototypeInput {
  actorId: string;
  reference: string;
  sha256: string;
}

export interface ScienceExperimentLinkInput {
  actorId: string;
  inventionId: string;
  manifest: ScienceArtifact;
  holdoutManifest: ScienceArtifact;
}

export interface ScienceCritiqueInput {
  actorId: string;
  artifact: SignedOutcomeArtifact;
}

export interface ScienceAuditInput {
  actorId: string;
  auditRef: string;
  auditSha256: string;
  /** Exact reference/digest pairs. Both omissions and unchecked extras are rejected. */
  checkedArtifacts: ScienceArtifact[];
  blockers?: string[];
  limitations?: string[];
}

export interface ScienceTheory {
  actorId: string;
  mechanism: string;
  predictions: string[];
  falsifiers: string[];
  alternatives: string[];
  evidence: ScienceArtifact;
  createdAt: number;
}

export interface ScienceAudit {
  actorId: string;
  auditRef: string;
  auditSha256: string;
  checkedArtifacts: ScienceArtifact[];
  blockers: string[];
  limitations: string[];
  signedEvidenceCount: number;
  result: 'reference-complete' | 'byte-verified' | 'blocked';
  artifactBytesVerified: boolean;
  completedAt: number;
}

export interface ScienceTrustBoundary {
  roleIdentity: 'declared-only' | 'host-attested';
  roleSubjects: ScienceRoleSubjects | null;
  signedEvidence: 'canonical-invention-loop-verified' | 'none';
  artifactBytesVerified: boolean;
  independentlyVerified: false;
  promotionEligible: false;
}

export interface ScienceRepublicRecordCore {
  id: string;
  stage: ScienceStage;
  actors: ScienceActors;
  title: string;
  domain: string;
  observation: string;
  discoveryEvidence: ScienceArtifact;
  candidate?: ScienceCandidateProvenance;
  createdAt: number;
  updatedAt: number;
  theory?: ScienceTheory;
  manifest?: ScienceArtifact;
  holdoutManifest?: ScienceArtifact;
  inventionId?: string;
  inventionStage?: InventionStage;
  prototype?: ScienceArtifact;
  audit?: ScienceAudit;
  trust: ScienceTrustBoundary;
}

export type ScienceAuditAction =
  | 'discovered' | 'theorized' | 'experiment-linked'
  | 'prototype-attached' | 'outcome-recorded'
  | 'critiqued' | 'audit-completed';

export interface ScienceAuditEvent {
  sequence: number;
  action: ScienceAuditAction;
  at: number;
  previousHash: string;
  hash: string;
  snapshot: ScienceRepublicRecordCore;
}

export interface ScienceRepublicRecord extends ScienceRepublicRecordCore {
  auditTrail: ScienceAuditEvent[];
}

export interface ScienceRepublicState {
  version: 1;
  records: ScienceRepublicRecord[];
  quarantinedRecords: number;
}

export interface ScienceRepublicCallbacks {
  recordOutcome?: (id: string, artifact: SignedOutcomeArtifact) => InventionRecord;
  critique?: (id: string, artifact: SignedOutcomeArtifact) => InventionRecord;
  resolveRoleIdentity?: ScienceRoleIdentityResolver;
  verifyArtifactBytes?: ScienceArtifactBytesVerifier;
  now?: () => number;
  id?: () => string;
}

const GENESIS = '0'.repeat(64);
const SHA256_RE = /^[a-f0-9]{64}$/iu;
const MAX_RECORDS = 256;
const MAX_RESTORE_RECORDS = 512;
const MAX_AUDIT_EVENTS = 32;
const MAX_TEXT = 1200;
const MAX_LIST = 12;
const STAGES: ScienceStage[] = [
  'discovered', 'theorized', 'registered', 'prototyped', 'tested',
  'critiqued', 'replicating', 'replicated', 'holdingout',
  'awaiting-audit', 'audit-complete', 'audit-blocked', 'rejected',
];
const ACTIONS: ScienceAuditAction[] = [
  'discovered', 'theorized', 'experiment-linked',
  'prototype-attached', 'outcome-recorded', 'critiqued', 'audit-completed',
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const clean = (value: unknown, limit = 500): string =>
  typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, limit) : '';
const hashText = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase() : '';
const validHash = (value: unknown): value is string =>
  typeof value === 'string' && SHA256_RE.test(value);
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).filter(key => object[key] !== undefined).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
};
const digest = (value: unknown): string =>
  createHash('sha256').update(canonical(value)).digest('hex');

function detach<T>(value: unknown, code: string): T {
  try {
    return snapshotPlainData(value) as T;
  } catch {
    throw new Error(code);
  }
}

function cleanList(value: unknown, field: string, minimum = 1): string[] {
  if (!Array.isArray(value)) throw new Error('invalid-' + field);
  const rows = value.map(item => clean(item, 600)).filter(Boolean);
  const unique = [...new Set(rows)];
  if (unique.length < minimum || unique.length > MAX_LIST || unique.length !== rows.length) {
    throw new Error('invalid-' + field);
  }
  return unique;
}

function normalizeArtifact(value: unknown, field: string): ScienceArtifact {
  if (!isObject(value)) throw new Error('invalid-' + field);
  const reference = clean(value.reference, 512);
  const sha256 = hashText(value.sha256);
  if (!reference || !validHash(sha256)) throw new Error('invalid-' + field);
  return { reference, sha256 };
}

function normalizeActors(value: unknown): ScienceActors {
  if (!isObject(value)) throw new Error('invalid-science-actors');
  const keys: ScienceRole[] = [
    'discoverer', 'theorist', 'experimentalist', 'replicator', 'skeptic', 'auditor',
  ];
  const actors = Object.fromEntries(keys.map(key => [key, clean(value[key], 120)])) as unknown as ScienceActors;
  const ids = keys.map(key => actors[key]);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('science-roles-must-have-distinct-actors');
  }
  return actors;
}

function normalizeCandidate(value: unknown): ScienceCandidateProvenance {
  if (!isObject(value)) throw new Error('invalid-captured-candidate');
  const candidate: ScienceCandidateProvenance = {
    id: clean(value.id, 180),
    experimentId: clean(value.experimentId, 180),
    source: value.source as ScienceCandidateProvenance['source'],
    question: clean(value.question, 500),
    hypothesis: clean(value.hypothesis, MAX_TEXT),
    prediction: clean(value.prediction, 500),
    scientificProjectId: clean(value.scientificProjectId, 180),
    ...(value.linkedGoal === undefined ? {} : { linkedGoal: clean(value.linkedGoal, 180) }),
    createdAt: value.createdAt as number,
    createdTick: value.createdTick as number,
    candidateFingerprint: hashText(value.candidateFingerprint),
    status: value.status as ScienceCandidateProvenance['status'],
    ...(value.inventionId === undefined ? {} : { inventionId: clean(value.inventionId, 180) }),
  };
  if (!candidate.id || !candidate.experimentId ||
      !['intrinsic', 'dream-association'].includes(candidate.source) ||
      !candidate.question || !candidate.hypothesis || !candidate.prediction ||
      !candidate.scientificProjectId ||
      !['awaiting-preregistration', 'preregistered'].includes(candidate.status) ||
      (candidate.status === 'preregistered' && !candidate.inventionId) ||
      (candidate.status === 'awaiting-preregistration' && candidate.inventionId !== undefined) ||
      !finite(candidate.createdAt) || candidate.createdAt < 0 ||
      !Number.isSafeInteger(candidate.createdTick) || candidate.createdTick < 0 ||
      !validHash(candidate.candidateFingerprint)) {
    throw new Error('invalid-captured-candidate');
  }
  return candidate;
}

function coreOf(record: ScienceRepublicRecord): ScienceRepublicRecordCore {
  const { auditTrail: _auditTrail, ...core } = record;
  return structuredClone(core);
}

function eventHash(event: Omit<ScienceAuditEvent, 'hash'>): string {
  return digest({
    sequence: event.sequence,
    action: event.action,
    at: event.at,
    previousHash: event.previousHash,
    snapshot: event.snapshot,
  });
}

function isArtifact(value: unknown): value is ScienceArtifact {
  return isObject(value) && typeof value.reference === 'string' &&
    value.reference.length > 0 && validHash(value.sha256);
}

function isRoleSubjects(value: unknown): value is ScienceRoleSubjects {
  if (!isObject(value)) return false;
  const roles: ScienceRole[] = [
    'discoverer', 'theorist', 'experimentalist', 'replicator', 'skeptic', 'auditor',
  ];
  const subjects = roles.map(role => value[role]);
  return subjects.every(subject => typeof subject === 'string' && subject.length > 0) &&
    new Set(subjects).size === subjects.length;
}

function isActors(value: unknown): value is ScienceActors {
  if (!isObject(value)) return false;
  const keys: ScienceRole[] = [
    'discoverer', 'theorist', 'experimentalist', 'replicator', 'skeptic', 'auditor',
  ];
  const ids = keys.map(key => value[key]);
  return ids.every(id => typeof id === 'string' && id.length > 0) &&
    new Set(ids).size === ids.length;
}

function isScienceCore(value: unknown): value is ScienceRepublicRecordCore {
  if (!isObject(value) || !STAGES.includes(value.stage as ScienceStage) ||
      typeof value.id !== 'string' || !value.id ||
      !isActors(value.actors) ||
      typeof value.title !== 'string' || !value.title ||
      typeof value.domain !== 'string' || !value.domain ||
      typeof value.observation !== 'string' || !value.observation ||
      !isArtifact(value.discoveryEvidence) ||
      !finite(value.createdAt) || !finite(value.updatedAt)) return false;
  if (value.candidate !== undefined) {
    try { normalizeCandidate(value.candidate); } catch { return false; }
  }
  if (value.theory !== undefined) {
    const theory = value.theory;
    if (!isObject(theory) || typeof theory.actorId !== 'string' ||
        typeof theory.mechanism !== 'string' || !theory.mechanism ||
        !Array.isArray(theory.predictions) || !theory.predictions.length ||
        !Array.isArray(theory.falsifiers) || !theory.falsifiers.length ||
        !Array.isArray(theory.alternatives) || !theory.alternatives.length ||
        !isArtifact(theory.evidence) || !finite(theory.createdAt)) return false;
  }
  if (value.manifest !== undefined && !isArtifact(value.manifest)) return false;
  if (value.holdoutManifest !== undefined && !isArtifact(value.holdoutManifest)) return false;
  if (value.prototype !== undefined && !isArtifact(value.prototype)) return false;
  if (value.inventionId !== undefined && typeof value.inventionId !== 'string') return false;
  if (value.inventionStage !== undefined &&
      !['proposed','designed','prototyped','tested','critiqued','replicating',
        'replicated','holdingout','accepted','rejected'].includes(String(value.inventionStage))) return false;
  if (value.audit !== undefined) {
    const audit = value.audit;
    if (!isObject(audit) || typeof audit.actorId !== 'string' ||
        typeof audit.auditRef !== 'string' || !validHash(audit.auditSha256) ||
        !Array.isArray(audit.checkedArtifacts) || !audit.checkedArtifacts.every(isArtifact) ||
        !Array.isArray(audit.blockers) || !Array.isArray(audit.limitations) ||
        !Number.isSafeInteger(audit.signedEvidenceCount) || Number(audit.signedEvidenceCount) < 0 ||
        !['reference-complete', 'byte-verified', 'blocked'].includes(String(audit.result)) ||
        typeof audit.artifactBytesVerified !== 'boolean' ||
        !finite(audit.completedAt)) return false;
  }
  const trust = value.trust;
  if (!isObject(trust) ||
      !['declared-only', 'host-attested'].includes(String(trust.roleIdentity)) ||
      (trust.roleIdentity === 'host-attested' && !isRoleSubjects(trust.roleSubjects)) ||
      (trust.roleIdentity === 'declared-only' && trust.roleSubjects !== null) ||
      (trust.signedEvidence !== 'canonical-invention-loop-verified' && trust.signedEvidence !== 'none') ||
      typeof trust.artifactBytesVerified !== 'boolean' ||
      trust.independentlyVerified !== false || trust.promotionEligible !== false) return false;
  const auditValue = value.audit;
  if (auditValue === undefined && trust.artifactBytesVerified !== false) return false;
  if (auditValue !== undefined) {
    if (!isObject(auditValue) ||
        trust.artifactBytesVerified !== auditValue.artifactBytesVerified) return false;
  }
  return true;
}

function verifyRecord(value: unknown): value is ScienceRepublicRecord {
  if (!isObject(value) || !isScienceCore(value) || !Array.isArray(value.auditTrail) ||
      value.auditTrail.length < 1 || value.auditTrail.length > MAX_AUDIT_EVENTS) return false;
  let previousHash = GENESIS;
  for (let index = 0; index < value.auditTrail.length; index += 1) {
    const event = value.auditTrail[index];
    if (!isObject(event) || event.sequence !== index + 1 ||
        !ACTIONS.includes(event.action as ScienceAuditAction) ||
        !finite(event.at) || event.previousHash !== previousHash ||
        !validHash(event.hash) || !isScienceCore(event.snapshot) ||
        event.snapshot.id !== value.id || event.snapshot.updatedAt !== event.at) return false;
    const unsigned = {
      sequence: event.sequence,
      action: event.action as ScienceAuditAction,
      at: event.at,
      previousHash,
      snapshot: event.snapshot,
    };
    if (event.hash !== eventHash(unsigned)) return false;
    previousHash = event.hash;
  }
  const finalEvent = value.auditTrail[value.auditTrail.length - 1] as ScienceAuditEvent;
  return canonical(finalEvent.snapshot) === canonical(coreOf(value as unknown as ScienceRepublicRecord));
}

function stageForInvention(stage: InventionStage): ScienceStage {
  const map: Record<InventionStage, ScienceStage> = {
    proposed: 'registered',
    designed: 'registered',
    prototyped: 'prototyped',
    tested: 'tested',
    critiqued: 'critiqued',
    replicating: 'replicating',
    replicated: 'replicated',
    holdingout: 'holdingout',
    accepted: 'awaiting-audit',
    rejected: 'rejected',
  };
  return map[stage];
}

function outcomeEvidence(record: InventionRecord): ScienceArtifact[] {
  return record.outcomes.map(outcome => {
    const measurement = outcome.signedArtifact.payload.measurement;
    if (!measurement || measurement.contextType !== 'invention-outcome') {
      throw new Error('invention-outcome-measurement-missing');
    }
    return {
      reference: outcome.evidenceRef,
      sha256: outcome.attestationFingerprint,
    };
  });
}

/**
 * Science Republic is the governance/provenance layer above the canonical
 * signed Invention Loop. It never executes candidate code or owns a second
 * verifier, outcome scorer, scientific-method engine or generator.
 */
export class ScienceRepublic {
  private state: ScienceRepublicState = {
    version: 1,
    records: [],
    quarantinedRecords: 0,
  };
  private readonly now: () => number;
  private readonly id: () => string;
  private readonly recordOutcomeDelegate: (id: string, artifact: SignedOutcomeArtifact) => InventionRecord;
  private readonly critiqueDelegate: (id: string, artifact: SignedOutcomeArtifact) => InventionRecord;
  private resolveRoleIdentity?: ScienceRoleIdentityResolver;
  private verifyArtifactBytes?: ScienceArtifactBytesVerifier;
  readonly inventionLoop: TheInventionLoop;

  constructor(
    inventionLoop: TheInventionLoop,
    callbacks: ScienceRepublicCallbacks = {},
  ) {
    if (!inventionLoop) throw new Error('science-republic-invention-loop-required');
    this.inventionLoop = inventionLoop;
    this.now = callbacks.now ?? (() => Date.now());
    this.id = callbacks.id ?? (() =>
      globalThis.crypto?.randomUUID?.() ?? 'science-' + Date.now() + '-' + Math.random().toString(16).slice(2));
    this.resolveRoleIdentity = callbacks.resolveRoleIdentity;
    this.verifyArtifactBytes = callbacks.verifyArtifactBytes;
    this.recordOutcomeDelegate = callbacks.recordOutcome ??
      ((recordId, artifact) => this.inventionLoop.recordOutcome(recordId, artifact));
    this.critiqueDelegate = callbacks.critique ??
      ((recordId, artifact) => this.inventionLoop.critique(recordId, artifact));
  }

  configureRoleIdentityResolver(resolve?: ScienceRoleIdentityResolver): void {
    if (resolve !== undefined && typeof resolve !== 'function') {
      throw new Error('invalid-science-role-identity-resolver');
    }
    this.resolveRoleIdentity = resolve;
  }

  configureArtifactBytesVerifier(verify?: ScienceArtifactBytesVerifier): void {
    if (verify !== undefined && typeof verify !== 'function') {
      throw new Error('invalid-science-artifact-bytes-verifier');
    }
    this.verifyArtifactBytes = verify;
  }

  snapshot(): ScienceRepublicState {
    return structuredClone(this.state);
  }

  get(id: string): ScienceRepublicRecord {
    const record = this.state.records.find(row => row.id === id);
    if (!record) throw new Error('science-record-not-found');
    return structuredClone(record);
  }

  metrics() {
    return {
      total: this.state.records.length,
      byStage: Object.fromEntries(STAGES.map(stage => [
        stage, this.state.records.filter(record => record.stage === stage).length,
      ])),
      quarantinedRecords: this.state.quarantinedRecords,
      capturedCandidates: this.state.records.filter(record => Boolean(record.candidate)).length,
      signedEvidenceCases: this.state.records.filter(record =>
        record.trust.signedEvidence === 'canonical-invention-loop-verified').length,
      hostAttestedRecords: this.state.records.filter(record =>
        record.trust.roleIdentity === 'host-attested').length,
      declaredIdentityRecords: this.state.records.filter(record =>
        record.trust.roleIdentity === 'declared-only').length,
      byteVerifiedAudits: this.state.records.filter(record =>
        record.audit?.result === 'byte-verified').length,
      referenceOnlyAudits: this.state.records.filter(record =>
        record.audit?.result === 'reference-complete').length,
      independentlyVerified: 0,
      promotionEligible: 0,
    };
  }

  private timestamp(): number {
    const value = this.now();
    if (!finite(value) || value < 0) throw new Error('invalid-science-clock');
    return Math.floor(value);
  }

  private resolveRoleSubjects(
    scienceRecordId: string,
    actors: ScienceActors,
  ): ScienceRoleSubjects | null {
    if (!this.resolveRoleIdentity) return null;
    const roles: ScienceRole[] = [
      'discoverer', 'theorist', 'experimentalist', 'replicator', 'skeptic', 'auditor',
    ];
    let subjects: string[];
    try {
      subjects = roles.map(role => clean(
        this.resolveRoleIdentity!(role, actors[role], scienceRecordId),
        180,
      ));
    } catch {
      throw new Error('science-role-identity-attestation-failed');
    }
    if (subjects.some(subject => !subject) || new Set(subjects).size !== subjects.length) {
      throw new Error('science-role-identities-must-be-distinct');
    }
    return Object.fromEntries(roles.map((role, index) => [role, subjects[index]])) as unknown as ScienceRoleSubjects;
  }

  private roleBindingsValid(record: ScienceRepublicRecord): boolean {
    if (record.trust.roleIdentity === 'declared-only') {
      return record.trust.roleSubjects === null;
    }
    if (!record.trust.roleSubjects || !this.resolveRoleIdentity) return false;
    try {
      const current = this.resolveRoleSubjects(record.id, record.actors);
      return Boolean(current && canonical(current) === canonical(record.trust.roleSubjects));
    } catch {
      return false;
    }
  }

  private verifyBytes(
    artifact: ScienceArtifact,
    scienceRecordId: string,
    purpose: 'evidence' | 'audit',
  ): boolean {
    if (!this.verifyArtifactBytes) return false;
    try {
      return this.verifyArtifactBytes(artifact, { scienceRecordId, purpose }) === true;
    } catch {
      return false;
    }
  }

  private assertRoleActor(
    record: ScienceRepublicRecord,
    role: ScienceRole,
    actorId: string,
  ): void {
    const normalizedActor = clean(actorId, 120);
    if (!normalizedActor || normalizedActor !== record.actors[role]) {
      throw new Error('science-' + role + '-role-mismatch');
    }
    if (record.trust.roleIdentity === 'host-attested') {
      if (!this.resolveRoleIdentity || !record.trust.roleSubjects) {
        throw new Error('science-role-identity-authority-unavailable');
      }
      let currentSubject = '';
      try {
        currentSubject = clean(
          this.resolveRoleIdentity(role, normalizedActor, record.id),
          180,
        );
      } catch {
        throw new Error('science-role-identity-attestation-failed');
      }
      if (!currentSubject || currentSubject !== record.trust.roleSubjects[role]) {
        throw new Error('science-role-identity-binding-changed');
      }
    }
  }

  private touch(record: ScienceRepublicRecord): void {
    record.updatedAt = Math.max(record.updatedAt + 1, this.timestamp());
  }

  private commit(
    record: ScienceRepublicRecord,
    action: ScienceAuditAction,
  ): ScienceRepublicRecord {
    const previous = record.auditTrail[record.auditTrail.length - 1];
    const unsigned: Omit<ScienceAuditEvent, 'hash'> = {
      sequence: (previous?.sequence ?? 0) + 1,
      action,
      at: record.updatedAt,
      previousHash: previous?.hash ?? GENESIS,
      snapshot: coreOf(record),
    };
    if (unsigned.sequence > MAX_AUDIT_EVENTS) throw new Error('science-audit-event-capacity');
    record.auditTrail.push({ ...unsigned, hash: eventHash(unsigned) });
    return structuredClone(record);
  }

  private find(id: string, allowRejected = false): ScienceRepublicRecord {
    const record = this.state.records.find(row => row.id === id);
    if (!record) throw new Error('science-record-not-found');
    if (record.stage === 'audit-complete' || record.stage === 'audit-blocked' ||
        (record.stage === 'rejected' && !allowRejected)) {
      throw new Error('science-record-closed');
    }
    return record;
  }

  private requireCanonicalInvention(record: InventionRecord): InventionRecord {
    const canonicalRecord = this.inventionLoop.snapshot().records.find(item => item.id === record.id);
    if (!canonicalRecord || canonical(canonicalRecord) !== canonical(record)) {
      throw new Error('science-delegate-returned-noncanonical-invention');
    }
    return canonicalRecord;
  }

  private inventionFor(record: ScienceRepublicRecord): InventionRecord {
    if (!record.inventionId) throw new Error('science-experiment-not-linked');
    const invention = this.inventionLoop.snapshot().records.find(row => row.id === record.inventionId);
    if (!invention) throw new Error('science-invention-record-missing');
    if (invention.stage !== record.inventionStage) throw new Error('science-invention-stage-drift');
    return invention;
  }

  private ensureArtifactReferencesUnique(
    record: ScienceRepublicRecord,
    candidates: ScienceArtifact[],
  ): void {
    const existing = [
      record.discoveryEvidence,
      record.theory?.evidence,
      record.manifest,
      record.holdoutManifest,
      record.prototype,
    ].filter((value): value is ScienceArtifact => Boolean(value));
    const artifacts = [...existing, ...candidates];
    const references = artifacts.map(item => item.reference);
    const digests = artifacts.map(item => item.sha256);
    if (new Set(references).size !== references.length ||
        new Set(digests).size !== digests.length) {
      throw new Error('science-artifact-reference-or-digest-collision');
    }
  }

  discover(input: ScienceDiscoveryInput): ScienceRepublicRecord {
    const safe = detach<ScienceDiscoveryInput>(input, 'invalid-science-discovery-payload');
    if (!isObject(safe)) throw new Error('invalid-science-discovery-payload');
    const title = clean(safe.title, 180);
    const domain = clean(safe.domain, 100);
    const observation = clean(safe.observation, MAX_TEXT);
    const evidence = normalizeArtifact(safe.evidence, 'discovery-evidence');
    const actors = normalizeActors(safe.actors);
    const candidate = safe.candidate === undefined ? undefined : normalizeCandidate(safe.candidate);
    if (!title || !domain || !observation) throw new Error('science-discovery-fields-required');
    if (candidate && this.state.records.some(row => row.candidate?.experimentId === candidate.experimentId)) {
      throw new Error('science-candidate-already-admitted');
    }
    if (this.state.records.length >= MAX_RECORDS) throw new Error('science-capacity-reached');
    const recordId = clean(this.id(), 120);
    if (!recordId || this.state.records.some(row => row.id === recordId)) {
      throw new Error('duplicate-science-record-id');
    }
    const roleSubjects = this.resolveRoleSubjects(recordId, actors);
    const at = this.timestamp();
    const record: ScienceRepublicRecord = {
      id: recordId,
      stage: 'discovered',
      actors,
      title,
      domain,
      observation,
      discoveryEvidence: evidence,
      ...(candidate ? { candidate } : {}),
      createdAt: at,
      updatedAt: at,
      trust: {
        roleIdentity: roleSubjects ? 'host-attested' : 'declared-only',
        roleSubjects,
        signedEvidence: 'none',
        artifactBytesVerified: false,
        independentlyVerified: false,
        promotionEligible: false,
      },
      auditTrail: [],
    };
    this.state.records.unshift(record);
    return this.commit(record, 'discovered');
  }

  /** Admit the existing runtime capture; do not invoke a second hypothesis generator. */
  discoverFromCapturedCandidate(input: {
    candidate: ScienceCandidateProvenance;
    domain: string;
    observation: string;
    evidence: ScienceArtifact;
    actors: ScienceActors;
  }): ScienceRepublicRecord {
    const safe = detach<typeof input>(input, 'invalid-science-captured-candidate');
    if (!isObject(safe)) throw new Error('invalid-science-captured-candidate');
    const candidate = normalizeCandidate(safe.candidate);
    if (candidate.status !== 'awaiting-preregistration') {
      throw new Error('science-captured-candidate-already-preregistered');
    }
    return this.discover({
      title: candidate.question,
      domain: safe.domain,
      observation: safe.observation,
      evidence: safe.evidence,
      actors: safe.actors,
      candidate,
    });
  }

  theorize(id: string, input: ScienceTheoryInput): ScienceRepublicRecord {
    const safe = detach<ScienceTheoryInput>(input, 'invalid-science-theory-payload');
    if (!isObject(safe)) throw new Error('invalid-science-theory-payload');
    const record = this.find(id);
    if (record.stage !== 'discovered') throw new Error('science-theory-requires-discovery');
    this.assertRoleActor(record, 'theorist', safe.actorId);
    const mechanism = clean(safe.mechanism, MAX_TEXT);
    const predictions = cleanList(safe.predictions, 'science-predictions');
    const falsifiers = cleanList(safe.falsifiers, 'science-falsifiers');
    const alternatives = cleanList(safe.alternatives, 'science-alternatives');
    const evidence = normalizeArtifact(safe.evidence, 'science-theory-evidence');
    if (!mechanism) throw new Error('science-theory-mechanism-required');
    this.ensureArtifactReferencesUnique(record, [evidence]);
    record.theory = {
      actorId: record.actors.theorist,
      mechanism, predictions, falsifiers, alternatives, evidence,
      createdAt: this.timestamp(),
    };
    record.stage = 'theorized';
    this.touch(record);
    return this.commit(record, 'theorized');
  }

  private validateExperimentPlanCore(
    record: ScienceRepublicRecord,
    actorId: string,
    protocol: InventionProtocol,
    manifest: ScienceArtifact,
    holdoutManifest: ScienceArtifact,
  ): InventionProtocol {
    if (record.stage !== 'theorized' || !record.theory) {
      throw new Error('science-experiment-requires-theory');
    }
    this.assertRoleActor(record, 'experimentalist', actorId);
    const normalized = this.inventionLoop.validateProtocol(protocol);
    const plan = normalized.verifierPlan;
    if (plan.critique !== record.actors.skeptic || plan.replication !== record.actors.replicator) {
      throw new Error('science-skeptic-or-replicator-role-mismatch');
    }
    const roleIds = Object.values(record.actors);
    if (roleIds.includes(plan.primary) || roleIds.includes(plan.holdout) || plan.primary === plan.holdout) {
      throw new Error('science-evaluators-must-be-distinct-from-roles-and-each-other');
    }
    if (normalized.question !== record.title ||
        normalized.hypothesis !== record.theory.mechanism) {
      throw new Error('science-preregistration-must-match-theory');
    }
    const provenance = normalized.provenance;
    if (!provenance) throw new Error('science-provenance-required');
    if (record.candidate) {
      if (provenance.source !== record.candidate.source ||
          provenance.experimentId !== record.candidate.experimentId ||
          provenance.scientificProjectId !== record.candidate.scientificProjectId ||
          provenance.linkedGoal !== record.candidate.linkedGoal) {
        throw new Error('science-captured-candidate-provenance-mismatch');
      }
    } else if (provenance.source !== 'manual' || provenance.experimentId !== record.id) {
      throw new Error('science-manual-provenance-mismatch');
    }
    if (manifest.sha256 !== normalized.testFingerprint ||
        holdoutManifest.sha256 !== normalized.holdoutTestFingerprint) {
      throw new Error('science-frozen-manifest-fingerprint-mismatch');
    }
    this.ensureArtifactReferencesUnique(record, [manifest, holdoutManifest]);
    return normalized;
  }

  validateExperimentPlan(id: string, input: {
    actorId: string;
    protocol: InventionProtocol;
    manifest: ScienceArtifact;
    holdoutManifest: ScienceArtifact;
  }): InventionProtocol {
    const safe = detach<typeof input>(input, 'invalid-science-experiment-plan');
    if (!isObject(safe)) throw new Error('invalid-science-experiment-plan');
    const record = this.find(id);
    return this.validateExperimentPlanCore(
      record,
      safe.actorId,
      safe.protocol,
      normalizeArtifact(safe.manifest, 'science-test-manifest'),
      normalizeArtifact(safe.holdoutManifest, 'science-holdout-manifest'),
    );
  }

  attachPreregisteredExperiment(id: string, input: ScienceExperimentLinkInput): ScienceRepublicRecord {
    const safe = detach<ScienceExperimentLinkInput>(input, 'invalid-science-experiment-link');
    if (!isObject(safe)) throw new Error('invalid-science-experiment-link');
    const record = this.find(id);
    const inventionId = clean(safe.inventionId, 120);
    const manifest = normalizeArtifact(safe.manifest, 'science-test-manifest');
    const holdoutManifest = normalizeArtifact(safe.holdoutManifest, 'science-holdout-manifest');
    const invention = this.inventionLoop.snapshot().records.find(row => row.id === inventionId);
    if (!invention) throw new Error('science-invention-not-found');
    this.validateExperimentPlanCore(record, safe.actorId, invention.protocol, manifest, holdoutManifest);
    if (invention.stage !== 'proposed') throw new Error('science-invention-must-be-newly-preregistered');
    const designed = this.inventionLoop.design(inventionId);
    record.manifest = manifest;
    record.holdoutManifest = holdoutManifest;
    if (record.candidate) {
      record.candidate.status = 'preregistered';
      record.candidate.inventionId = designed.id;
    }
    record.inventionId = designed.id;
    record.inventionStage = designed.stage;
    record.stage = 'registered';
    this.touch(record);
    return this.commit(record, 'experiment-linked');
  }

  attachPrototype(id: string, input: SciencePrototypeInput): ScienceRepublicRecord {
    const safe = detach<SciencePrototypeInput>(input, 'invalid-science-prototype');
    if (!isObject(safe)) throw new Error('invalid-science-prototype');
    const record = this.find(id);
    if (record.stage !== 'registered' || !record.inventionId) {
      throw new Error('science-prototype-requires-registered-experiment');
    }
    this.assertRoleActor(record, 'experimentalist', safe.actorId);
    const prototype = normalizeArtifact({
      reference: safe.reference, sha256: safe.sha256,
    }, 'science-prototype');
    this.ensureArtifactReferencesUnique(record, [prototype]);
    const invention = this.inventionLoop.prototype(record.inventionId, prototype);
    record.prototype = prototype;
    record.inventionStage = invention.stage;
    record.stage = 'prototyped';
    this.touch(record);
    return this.commit(record, 'prototype-attached');
  }

  recordOutcome(id: string, artifact: SignedOutcomeArtifact): ScienceRepublicRecord {
    const safe = detach<SignedOutcomeArtifact>(artifact, 'invalid-science-signed-outcome');
    if (!isObject(safe) || !isObject(safe.payload) ||
        !isObject(safe.payload.measurement)) throw new Error('invalid-science-signed-outcome');
    const record = this.find(id);
    if (!record.prototype || !record.inventionId) throw new Error('science-prototype-required');
    const measurement = safe.payload.measurement;
    if (measurement.contextType !== 'invention-outcome') throw new Error('science-outcome-measurement-required');
    if (measurement.phase === 'replication') {
      this.assertRoleActor(record, 'replicator', safe.payload.verifierId);
    }
    if (measurement.phase === 'holdout' &&
        safe.payload.verifierId === record.actors.auditor) {
      throw new Error('science-auditor-cannot-run-holdout');
    }
    const invention = this.requireCanonicalInvention(
      this.recordOutcomeDelegate(record.inventionId, safe),
    );
    record.inventionStage = invention.stage;
    record.stage = stageForInvention(invention.stage);
    record.trust.signedEvidence = 'canonical-invention-loop-verified';
    this.touch(record);
    return this.commit(record, 'outcome-recorded');
  }

  critique(id: string, input: ScienceCritiqueInput): ScienceRepublicRecord {
    const safe = detach<ScienceCritiqueInput>(input, 'invalid-science-critique');
    if (!isObject(safe) || !isObject(safe.artifact) || !isObject(safe.artifact.payload)) {
      throw new Error('invalid-science-critique');
    }
    const record = this.find(id);
    if (!record.inventionId || !record.prototype) throw new Error('science-critique-requires-prototype');
    this.assertRoleActor(record, 'skeptic', safe.actorId);
    this.assertRoleActor(record, 'skeptic', safe.artifact.payload.verifierId);
    const invention = this.requireCanonicalInvention(
      this.critiqueDelegate(record.inventionId, safe.artifact),
    );
    record.inventionStage = invention.stage;
    record.stage = stageForInvention(invention.stage);
    record.trust.signedEvidence = 'canonical-invention-loop-verified';
    this.touch(record);
    return this.commit(record, 'critiqued');
  }

  private requiredAuditArtifacts(record: ScienceRepublicRecord, invention: InventionRecord): ScienceArtifact[] {
    if (!record.theory || !record.manifest || !record.holdoutManifest || !record.prototype) {
      throw new Error('science-audit-requires-complete-artifacts');
    }
    const required: ScienceArtifact[] = [
      record.discoveryEvidence,
      record.theory.evidence,
      record.manifest,
      record.holdoutManifest,
      record.prototype,
      ...outcomeEvidence(invention),
    ];
    if (invention.critique) {
      required.push({
        reference: invention.critique.reviewRef,
        sha256: invention.critique.reviewSha256,
      });
      required.push({
        reference: 'signed-critique:' + invention.critique.artifactId,
        sha256: invention.critique.attestationFingerprint,
      });
    }
    return required;
  }

  audit(id: string, input: ScienceAuditInput): ScienceRepublicRecord {
    const safe = detach<ScienceAuditInput>(input, 'invalid-science-audit');
    if (!isObject(safe)) throw new Error('invalid-science-audit');
    const record = this.find(id, true);
    if (record.audit) throw new Error('science-audit-already-recorded');
    if (!record.inventionId || !record.theory || !record.manifest ||
        !record.holdoutManifest || !record.prototype) {
      throw new Error('science-audit-requires-complete-research');
    }
    this.assertRoleActor(record, 'auditor', safe.actorId);
    const invention = this.inventionFor(record);
    if (invention.stage !== 'accepted' && invention.stage !== 'rejected') {
      throw new Error('science-audit-requires-terminal-invention');
    }
    const auditRef = clean(safe.auditRef, 512);
    const auditSha256 = hashText(safe.auditSha256);
    if (!auditRef || !validHash(auditSha256)) throw new Error('invalid-science-audit-artifact');
    const required = this.requiredAuditArtifacts(record, invention);
    const checked = Array.isArray(safe.checkedArtifacts)
      ? safe.checkedArtifacts.map(item => normalizeArtifact(item, 'science-audited-artifact'))
      : [];
    const checkedByRef = new Map<string, string>();
    for (const artifact of checked) {
      if (checkedByRef.has(artifact.reference)) throw new Error('duplicate-science-audit-reference');
      checkedByRef.set(artifact.reference, artifact.sha256);
    }
    if (checked.length !== required.length ||
        required.some(item => checkedByRef.get(item.reference) !== item.sha256)) {
      throw new Error('science-audit-manifest-incomplete-or-mismatched');
    }
    if (required.some(item => item.reference === auditRef || item.sha256 === auditSha256)) {
      throw new Error('science-audit-reference-or-digest-collision');
    }
    const blockers = Array.isArray(safe.blockers)
      ? safe.blockers.map(item => clean(item, 400)).filter(Boolean).slice(0, MAX_LIST)
      : [];
    const limitations = Array.isArray(safe.limitations)
      ? safe.limitations.map(item => clean(item, 400)).filter(Boolean).slice(0, MAX_LIST)
      : [];
    const auditArtifact: ScienceArtifact = { reference: auditRef, sha256: auditSha256 };
    const artifactBytesVerified = required.every(item =>
      this.verifyBytes(item, record.id, 'evidence')) &&
      this.verifyBytes(auditArtifact, record.id, 'audit');
    const result = invention.stage === 'accepted' && blockers.length === 0
      ? artifactBytesVerified ? 'byte-verified' : 'reference-complete'
      : 'blocked';
    record.audit = {
      actorId: record.actors.auditor,
      auditRef,
      auditSha256,
      checkedArtifacts: checked,
      blockers,
      limitations,
      signedEvidenceCount: invention.outcomes.length + (invention.critique ? 1 : 0),
      result,
      artifactBytesVerified,
      completedAt: this.timestamp(),
    };
    record.trust.artifactBytesVerified = artifactBytesVerified;
    record.stage = result === 'reference-complete' || result === 'byte-verified' ? 'audit-complete' :
      invention.stage === 'rejected' ? 'rejected' : 'audit-blocked';
    this.touch(record);
    return this.commit(record, 'audit-completed');
  }

  private validateLinkedRecord(
    record: ScienceRepublicRecord,
    invention: InventionRecord,
  ): boolean {
    if (!record.inventionId || record.inventionId !== invention.id ||
        record.inventionStage !== invention.stage || !record.theory ||
        !record.manifest || !record.holdoutManifest || !record.prototype ||
        invention.protocol.question !== record.title ||
        invention.protocol.hypothesis !== record.theory.mechanism ||
        invention.protocol.testFingerprint !== record.manifest.sha256 ||
        invention.protocol.holdoutTestFingerprint !== record.holdoutManifest.sha256 ||
        invention.prototypeRef !== record.prototype.reference ||
        invention.prototypeSha256 !== record.prototype.sha256) return false;

    const roles = Object.values(record.actors);
    const plan = invention.protocol.verifierPlan;
    if (plan.critique !== record.actors.skeptic ||
        plan.replication !== record.actors.replicator ||
        roles.includes(plan.primary) || roles.includes(plan.holdout) ||
        plan.primary === plan.holdout) return false;

    const provenance = invention.protocol.provenance;
    if (!provenance) return false;
    if (record.candidate) {
      if (provenance.source !== record.candidate.source ||
          provenance.experimentId !== record.candidate.experimentId ||
          provenance.scientificProjectId !== record.candidate.scientificProjectId ||
          provenance.linkedGoal !== record.candidate.linkedGoal) return false;
    } else if (provenance.source !== 'manual' || provenance.experimentId !== record.id) {
      return false;
    }

    const signedEvidencePresent = invention.outcomes.length > 0 || Boolean(invention.critique);
    if (record.trust.signedEvidence !== (signedEvidencePresent
      ? 'canonical-invention-loop-verified' : 'none') ||
        !this.roleBindingsValid(record)) return false;

    if (!record.audit) {
      return record.trust.artifactBytesVerified === false &&
        record.stage === stageForInvention(invention.stage);
    }
    if (invention.stage !== 'accepted' && invention.stage !== 'rejected') return false;
    if (record.audit.actorId !== record.actors.auditor ||
        record.audit.artifactBytesVerified !== record.trust.artifactBytesVerified ||
        record.audit.signedEvidenceCount !== invention.outcomes.length + (invention.critique ? 1 : 0)) {
      return false;
    }
    let required: ScienceArtifact[];
    try {
      required = this.requiredAuditArtifacts(record, invention);
    } catch {
      return false;
    }
    const checked = new Map<string, string>();
    for (const item of record.audit.checkedArtifacts) {
      if (checked.has(item.reference)) return false;
      checked.set(item.reference, item.sha256);
    }
    if (checked.size !== required.length ||
        required.some(item => checked.get(item.reference) !== item.sha256) ||
        required.some(item => item.reference === record.audit?.auditRef)) return false;

    if (record.audit.result === 'byte-verified') {
      const auditArtifact: ScienceArtifact = {
        reference: record.audit.auditRef,
        sha256: record.audit.auditSha256,
      };
      if (!required.every(item => this.verifyBytes(item, record.id, 'evidence')) ||
          !this.verifyBytes(auditArtifact, record.id, 'audit')) return false;
    }

    if (invention.stage === 'accepted' && record.audit.result === 'reference-complete') {
      return record.stage === 'audit-complete' && record.audit.blockers.length === 0 &&
        record.audit.artifactBytesVerified === false;
    }
    if (invention.stage === 'accepted' && record.audit.result === 'byte-verified') {
      return record.stage === 'audit-complete' && record.audit.blockers.length === 0 &&
        record.audit.artifactBytesVerified === true;
    }
    if (invention.stage === 'accepted' && record.audit.result === 'blocked') {
      return record.stage === 'audit-blocked' && record.audit.blockers.length > 0;
    }
    return invention.stage === 'rejected' &&
      record.stage === 'rejected' && record.audit.result === 'blocked';
  }

  restore(raw?: Partial<ScienceRepublicState> | null): void {
    if (!raw) return;
    const detached = detach<Partial<ScienceRepublicState>>(raw, 'invalid-science-state');
    const incoming = Array.isArray(detached.records) ? detached.records : [];
    if (detached.version !== 1) {
      this.state = { version: 1, records: [], quarantinedRecords: incoming.length };
      return;
    }
    const linkedInventions = new Map(
      this.inventionLoop.snapshot().records.map(invention => [invention.id, invention]),
    );
    const records: ScienceRepublicRecord[] = [];
    const seenIds = new Set<string>();
    const seenCandidateIds = new Set<string>();
    let quarantined = 0;
    for (const item of incoming.slice(0, MAX_RESTORE_RECORDS)) {
      if (!verifyRecord(item) || !this.roleBindingsValid(item) || seenIds.has(item.id) ||
          (item.candidate && seenCandidateIds.has(item.candidate.experimentId))) {
        quarantined += 1;
        continue;
      }
      if (item.inventionId) {
        const linked = linkedInventions.get(item.inventionId);
        if (!linked || !this.validateLinkedRecord(item, linked)) {
          quarantined += 1;
          continue;
        }
      } else if (item.stage !== 'discovered' && item.stage !== 'theorized') {
        quarantined += 1;
        continue;
      }
      seenIds.add(item.id);
      if (item.candidate) seenCandidateIds.add(item.candidate.experimentId);
      records.push(structuredClone(item));
    }
    this.state = {
      version: 1,
      records: records.slice(0, MAX_RECORDS),
      quarantinedRecords: quarantined + Math.max(0, incoming.length - MAX_RESTORE_RECORDS),
    };
  }
}
