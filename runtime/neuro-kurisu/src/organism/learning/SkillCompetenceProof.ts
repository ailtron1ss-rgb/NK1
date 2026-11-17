import {
  createHash,
  createPublicKey,
  sign as signSignature,
  verify as verifySignature,
} from 'node:crypto';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';
import { types as nodeUtilTypes } from 'node:util';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
import type { VersionedSkillCandidate, SkillShadowObservation } from './VersionedSkillCandidateStore.ts';
import { isAuthenticVerifiedSkillPromotionProposal, type VerifiedSkillPromotionProposal } from './VerifiedSkillPromotion.ts';

export type SkillCompetenceExecutionMode = 'assisted' | 'autonomous';
export type SkillCompetencePermissionClass =
  | 'none' | 'web' | 'device' | 'filesystem' | 'code' | 'system' | 'self-modification';

export interface SkillCompetenceContract {
  toolId: string;
  capability: string;
  permissionClass: SkillCompetencePermissionClass;
  inputContractFingerprint: string;
  outputContractFingerprint: string;
  runtimeFingerprint: string;
  environmentFingerprint: string;
  preconditions: string[];
  constraints: string[];
  allowedModes: SkillCompetenceExecutionMode[];
}

export interface SkillCompetenceHoldoutEvidence {
  manifestFingerprint: string;
  outcomeFingerprint: string;
  datasetFingerprint: string;
  pairedTaskSeedN: number;
  uniquePairedTasks: number;
  completePairedSeeds: number;
  baselinePassRate: number;
  candidatePassRate: number;
  absoluteGain: number;
  approximate95CI: [number, number];
  bootstrap95CI: [number, number];
  familyEvaluationFingerprint: string;
}

export interface SkillCompetenceProofPayload {
  schemaVersion: 1;
  proofId: string;
  attestorId: string;
  candidateId: string;
  skillId: string;
  candidateVersion: number;
  payloadFingerprint: string;
  proposalId: string;
  proposalOutcomeFingerprint: string;
  contract: SkillCompetenceContract;
  holdout: SkillCompetenceHoldoutEvidence;
  shadowEvidenceFingerprint: string;
  shadowRunCount: number;
  issuedAt: number;
  expiresAt: number;
}

export interface SignedSkillCompetenceProof {
  payload: SkillCompetenceProofPayload;
  signature: string;
}

export type SkillCompetenceProofVerificationPurpose = 'attach' | 'promotion' | 'persisted-active';
export type SkillCompetenceProofVerifier = (
  proof: Readonly<SignedSkillCompetenceProof>,
  candidate: Readonly<VersionedSkillCandidate>,
  purpose?: SkillCompetenceProofVerificationPurpose,
) => boolean;

export interface SkillCompetenceActiveSubject {
  candidateId: string;
  version: number;
  payloadFingerprint: string;
}

export interface SkillCompetenceConditionContext {
  toolId: string;
  kind: 'precondition' | 'constraint';
}

export interface SkillCompetenceToolVerificationContext {
  trustedAttestorKeys: ReadonlyMap<string, string>;
  toolId: string;
  capability: string;
  permissionClass: SkillCompetencePermissionClass;
  inputContractFingerprint: string | null;
  outputContractFingerprint: string | null;
  runtimeFingerprint: string | null;
  environmentFingerprint: string | null;
  autonomous: boolean;
  now: number;
  activeSubject: SkillCompetenceActiveSubject | null;
  input: Record<string, unknown>;
  evaluateCondition?: (
    conditionId: string,
    input: Record<string, unknown>,
    context: SkillCompetenceConditionContext,
  ) => boolean;
}

const FINGERPRINT = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PERMISSION_CLASSES = new Set<SkillCompetencePermissionClass>([
  'none', 'web', 'device', 'filesystem', 'code', 'system', 'self-modification',
]);
const MAX_VALIDITY_MS = 30 * 24 * 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 60_000;

function rejectProxyGraph(value: unknown, ancestors = new Set<object>(), budget = { nodes: 0 }): void {
  if (value === null || typeof value !== 'object') return;
  if (nodeUtilTypes.isProxy(value)) throw new Error('skill-competence-proof-proxy-rejected');
  if (ancestors.has(value)) throw new Error('skill-competence-proof-cycle-rejected');
  budget.nodes += 1;
  if (budget.nodes > 4096) throw new Error('skill-competence-proof-size-limit');
  ancestors.add(value);
  try {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set) {
        throw new Error('skill-competence-proof-accessor-rejected');
      }
      rejectProxyGraph(descriptor.value, ancestors, budget);
    }
  } finally {
    ancestors.delete(value);
  }
}

function snapshotProof(value: unknown): SignedSkillCompetenceProof | null {
  try {
    rejectProxyGraph(value);
    const detached = snapshotPlainData(value, { maxDepth: 16, maxNodes: 4096, maxStringUnits: 256_000 });
    if (!isRecord(detached) || !isRecord(detached.payload) || typeof detached.signature !== 'string') return null;
    return detached as unknown as SignedSkillCompetenceProof;
  } catch {
    return null;
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Copy and freeze proof data at registration to prevent post-registration mutation. */
export function cloneFrozenSkillCompetenceProof(value: unknown): SignedSkillCompetenceProof {
  const detached = snapshotProof(value);
  if (!detached) throw new Error('invalid-skill-competence-proof-data');
  return deepFreeze(detached);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value) && value.length <= 128;
}

function validIdentifierList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 32 &&
    value.every(item => validIdentifier(item)) && new Set(value).size === value.length;
}

export function skillCompetenceRuntimeFingerprint(runtimeVersion: string): string {
  if (typeof runtimeVersion !== 'string' || !runtimeVersion.trim() || runtimeVersion.length > 240) {
    throw new Error('skill competence runtime version must be a non-empty bounded string');
  }
  return sha256Stable({ runtimeVersion: runtimeVersion.trim() });
}

export function skillCompetenceProofPayloadFingerprint(payload: SkillCompetenceProofPayload): string {
  return createHash('sha256').update(stableJson(payload)).digest('hex');
}

export function skillCompetenceShadowEvidenceFingerprint(
  observations: readonly SkillShadowObservation[],
): string {
  const rows = [...observations].map(observation => ({
    runId: observation.runId,
    evidenceFingerprint: observation.evidenceFingerprint,
    passed: observation.passed,
    observedAt: observation.observedAt,
    artifact: observation.artifact ? {
      payload: observation.artifact.payload,
      signature: observation.artifact.signature,
    } : null,
  })).sort((a, b) => a.runId.localeCompare(b.runId));
  return sha256Stable(rows);
}

function assertContract(contract: SkillCompetenceContract): void {
  if (!isRecord(contract) ||
      !validIdentifier(contract.toolId) ||
      !validIdentifier(contract.capability) ||
      !PERMISSION_CLASSES.has(contract.permissionClass) ||
      !FINGERPRINT.test(String(contract.inputContractFingerprint)) ||
      !FINGERPRINT.test(String(contract.outputContractFingerprint)) ||
      !FINGERPRINT.test(String(contract.runtimeFingerprint)) ||
      !FINGERPRINT.test(String(contract.environmentFingerprint)) ||
      !validIdentifierList(contract.preconditions) ||
      !validIdentifierList(contract.constraints) ||
      !Array.isArray(contract.allowedModes) ||
      !contract.allowedModes.includes('assisted') ||
      contract.allowedModes.some(mode => mode !== 'assisted' && mode !== 'autonomous') ||
      new Set(contract.allowedModes).size !== contract.allowedModes.length) {
    throw new Error('invalid skill competence contract');
  }
}

function validInterval(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    value.every(n => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1) &&
    value[0] <= value[1];
}

function assertHoldoutProposal(proposal: VerifiedSkillPromotionProposal): SkillCompetenceHoldoutEvidence {
  if (!isAuthenticVerifiedSkillPromotionProposal(proposal) ||
      proposal.schemaVersion !== 1 ||
      proposal.gate?.accepted !== true ||
      proposal.canActivateAutomatically !== false ||
      proposal.authenticatedEvidenceRows < 1 ||
      proposal.unauthenticatedEvidenceRows !== 0 ||
      !FINGERPRINT.test(proposal.manifestFingerprint) ||
      !FINGERPRINT.test(proposal.outcomeFingerprint) ||
      !FINGERPRINT.test(proposal.datasetFingerprint) ||
      !Number.isSafeInteger(proposal.uniquePairedTasks) || proposal.uniquePairedTasks < 8 ||
      !Number.isSafeInteger(proposal.completePairedSeeds) || proposal.completePairedSeeds < 3 ||
      !Number.isSafeInteger(proposal.pairedTaskSeedN) || proposal.pairedTaskSeedN < 8) {
    throw new Error('skill competence proof requires an authentic accepted independent holdout proposal');
  }
  const paired = proposal.seedClusteredEvaluation;
  if (!paired || paired.pairedN < 8 ||
      !Number.isFinite(paired.baselinePassRate) || !Number.isFinite(paired.candidatePassRate) ||
      !Number.isFinite(paired.absoluteGain) || paired.absoluteGain <= 0 ||
      !validInterval(paired.approximate95CI) || paired.approximate95CI[0] <= 0 ||
      !validInterval(paired.bootstrap95CI) || paired.bootstrap95CI[0] <= 0 ||
      !Array.isArray(proposal.familyEvaluation) || proposal.familyEvaluation.length === 0) {
    throw new Error('skill competence proof requires positive seed-clustered gain and independent confidence intervals');
  }
  if ([paired.baselinePassRate, paired.candidatePassRate].some(rate => rate < 0 || rate > 1)) {
    throw new Error('skill competence holdout rates must be between zero and one');
  }
  return {
    manifestFingerprint: proposal.manifestFingerprint,
    outcomeFingerprint: proposal.outcomeFingerprint,
    datasetFingerprint: proposal.datasetFingerprint,
    pairedTaskSeedN: paired.pairedN,
    uniquePairedTasks: proposal.uniquePairedTasks,
    completePairedSeeds: proposal.completePairedSeeds,
    baselinePassRate: paired.baselinePassRate,
    candidatePassRate: paired.candidatePassRate,
    absoluteGain: paired.absoluteGain,
    approximate95CI: [...paired.approximate95CI] as [number, number],
    bootstrap95CI: [...paired.bootstrap95CI] as [number, number],
    familyEvaluationFingerprint: sha256Stable(proposal.familyEvaluation),
  };
}

function assertCandidateOwnsContract(candidate: Readonly<VersionedSkillCandidate>, contract: SkillCompetenceContract): void {
  if (!isRecord(candidate.payload) || candidate.payload.proofCarryingSkill !== true ||
      !isRecord(candidate.payload.competenceContract) ||
      stableJson(candidate.payload.competenceContract) !== stableJson(contract)) {
    throw new Error('proof-carrying candidate payload must embed the exact competence contract');
  }
}

function assertShadowEvidence(
  candidate: Readonly<VersionedSkillCandidate>,
  observations: readonly SkillShadowObservation[],
  proposal: VerifiedSkillPromotionProposal,
  contract: SkillCompetenceContract,
): void {
  if (!Array.isArray(observations) || observations.length < 3 || observations.length > 1000) {
    throw new Error('skill competence proof requires 3–1000 signed shadow runs');
  }
  const runIds = new Set<string>();
  const taskSeeds = new Set<string>();
  for (const observation of observations) {
    const payload = observation.artifact?.payload;
    if (!payload || !observation.artifact?.signature ||
        observation.passed !== true || payload.passed !== true ||
        payload.candidateId !== candidate.candidateId ||
        payload.skillId !== candidate.skillId ||
        payload.candidateVersion !== candidate.version ||
        payload.payloadFingerprint !== candidate.payloadFingerprint ||
        payload.proposalOutcomeFingerprint !== candidate.proposalOutcomeFingerprint ||
        payload.manifestFingerprint !== proposal.manifestFingerprint ||
        payload.runId !== observation.runId ||
        payload.taskId.trim().length === 0 ||
        !Number.isSafeInteger(payload.seed) || payload.seed < 0 ||
        !Number.isFinite(payload.observedAt) || payload.observedAt <= 0 ||
        !payload.runtimeVersion.trim()) {
      throw new Error('skill competence proof shadow evidence does not bind to this candidate and holdout manifest');
    }
    if (skillCompetenceRuntimeFingerprint(payload.runtimeVersion) !== contract.runtimeFingerprint) {
      throw new Error('skill competence proof runtime fingerprint does not match signed shadow evidence');
    }
    if (runIds.has(payload.runId)) throw new Error('skill competence proof contains duplicate shadow run IDs');
    const taskSeed = JSON.stringify([payload.taskId, payload.seed]);
    if (taskSeeds.has(taskSeed)) throw new Error('skill competence proof contains duplicate task/seed shadow evidence');
    runIds.add(payload.runId);
    taskSeeds.add(taskSeed);
  }
  // The signed shadow verifier separately binds each row to the trusted run registry.
  // Requiring a stable runtime fingerprint on the contract makes environment/runtime
  // drift invalidate admission; the trusted host is responsible for deriving it.
  if (!FINGERPRINT.test(contract.runtimeFingerprint)) throw new Error('invalid skill competence runtime fingerprint');
}

export function buildSkillCompetenceProofPayload(input: {
  candidate: Readonly<VersionedSkillCandidate>;
  proposal: VerifiedSkillPromotionProposal;
  contract: SkillCompetenceContract;
  attestorId: string;
  issuedAt: number;
  expiresAt: number;
  verifiedShadowObservations: readonly SkillShadowObservation[];
}): SkillCompetenceProofPayload {
  const { candidate, proposal, contract, attestorId, issuedAt, expiresAt, verifiedShadowObservations } = input;
  assertContract(contract);
  assertCandidateOwnsContract(candidate, contract);
  if (!validIdentifier(attestorId) ||
      !Number.isFinite(issuedAt) || issuedAt <= 0 ||
      !Number.isFinite(expiresAt) || expiresAt <= issuedAt ||
      expiresAt - issuedAt > MAX_VALIDITY_MS) {
    throw new Error('invalid skill competence proof authority or validity window');
  }
  if (candidate.status !== 'shadow' ||
      candidate.proposalId !== proposal.proposalId ||
      candidate.proposalOutcomeFingerprint !== proposal.outcomeFingerprint ||
      candidate.payloadFingerprint !== sha256Stable(JSON.parse(JSON.stringify(candidate.payload)))) {
    throw new Error('skill competence proof candidate is not the exact staged holdout candidate');
  }
  const holdout = assertHoldoutProposal(proposal);
  assertShadowEvidence(candidate, verifiedShadowObservations, proposal, contract);
  const shadowEvidenceFingerprint = skillCompetenceShadowEvidenceFingerprint(verifiedShadowObservations);
  const proofId = sha256Stable({
    candidateId: candidate.candidateId,
    candidateVersion: candidate.version,
    payloadFingerprint: candidate.payloadFingerprint,
    proposalId: proposal.proposalId,
    contract,
    holdout,
    shadowEvidenceFingerprint,
    attestorId,
    issuedAt,
    expiresAt,
  });
  return {
    schemaVersion: 1,
    proofId,
    attestorId,
    candidateId: candidate.candidateId,
    skillId: candidate.skillId,
    candidateVersion: candidate.version,
    payloadFingerprint: candidate.payloadFingerprint,
    proposalId: candidate.proposalId,
    proposalOutcomeFingerprint: candidate.proposalOutcomeFingerprint,
    contract: structuredClone(contract),
    holdout,
    shadowEvidenceFingerprint,
    shadowRunCount: verifiedShadowObservations.length,
    issuedAt,
    expiresAt,
  };
}

export function canonicalSkillCompetenceProofPayload(payload: SkillCompetenceProofPayload): string {
  return stableJson(payload);
}

export function signSkillCompetenceProofForFixture(
  payload: SkillCompetenceProofPayload,
  privateKeyPem: string,
): SignedSkillCompetenceProof {
  return {
    payload,
    signature: signSignature(null, Buffer.from(canonicalSkillCompetenceProofPayload(payload), 'utf8'), privateKeyPem).toString('base64'),
  };
}

export function verifySignedSkillCompetenceProof(
  proof: unknown,
  trustedAttestorKeys: ReadonlyMap<string, string>,
): proof is SignedSkillCompetenceProof {
  const detached = snapshotProof(proof);
  if (!detached || detached.signature.length > 128 || !/^[A-Za-z0-9+/]+={0,2}$/.test(detached.signature)) return false;
  const signatureBytes = Buffer.from(detached.signature, 'base64');
  if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== detached.signature) return false;
  const payload = detached.payload;
  try {
    assertContract(payload.contract);
    if (payload.schemaVersion !== 1 ||
        !FINGERPRINT.test(payload.proofId) ||
        !validIdentifier(payload.attestorId) ||
        !FINGERPRINT.test(payload.candidateId) ||
        !validIdentifier(payload.skillId) ||
        !Number.isSafeInteger(payload.candidateVersion) || payload.candidateVersion < 1 ||
        !FINGERPRINT.test(payload.payloadFingerprint) ||
        !FINGERPRINT.test(payload.proposalId) ||
        !FINGERPRINT.test(payload.proposalOutcomeFingerprint) ||
        !FINGERPRINT.test(payload.shadowEvidenceFingerprint) ||
        !Number.isSafeInteger(payload.shadowRunCount) || payload.shadowRunCount < 3 ||
        !Number.isFinite(payload.issuedAt) || payload.issuedAt <= 0 ||
        !Number.isFinite(payload.expiresAt) || payload.expiresAt <= payload.issuedAt ||
        payload.expiresAt - payload.issuedAt > MAX_VALIDITY_MS ||
        !isRecord(payload.holdout) ||
        !FINGERPRINT.test(payload.holdout.manifestFingerprint) ||
        !FINGERPRINT.test(payload.holdout.outcomeFingerprint) ||
        !FINGERPRINT.test(payload.holdout.datasetFingerprint) ||
        !FINGERPRINT.test(payload.holdout.familyEvaluationFingerprint) ||
        !Number.isSafeInteger(payload.holdout.pairedTaskSeedN) || payload.holdout.pairedTaskSeedN < 8 ||
        !Number.isSafeInteger(payload.holdout.uniquePairedTasks) || payload.holdout.uniquePairedTasks < 8 ||
        !Number.isSafeInteger(payload.holdout.completePairedSeeds) || payload.holdout.completePairedSeeds < 3 ||
        ![payload.holdout.baselinePassRate, payload.holdout.candidatePassRate, payload.holdout.absoluteGain].every(Number.isFinite) ||
        payload.holdout.baselinePassRate < 0 || payload.holdout.baselinePassRate > 1 ||
        payload.holdout.candidatePassRate < 0 || payload.holdout.candidatePassRate > 1 ||
        payload.holdout.absoluteGain <= 0 ||
        !validInterval(payload.holdout.approximate95CI) || payload.holdout.approximate95CI[0] <= 0 ||
        !validInterval(payload.holdout.bootstrap95CI) || payload.holdout.bootstrap95CI[0] <= 0 ||
        Math.abs((payload.holdout.candidatePassRate - payload.holdout.baselinePassRate) - payload.holdout.absoluteGain) > 1e-9 ||
        payload.holdout.absoluteGain < 0) return false;
    const expectedProofId = sha256Stable({
      candidateId: payload.candidateId,
      candidateVersion: payload.candidateVersion,
      payloadFingerprint: payload.payloadFingerprint,
      proposalId: payload.proposalId,
      contract: payload.contract,
      holdout: payload.holdout,
      shadowEvidenceFingerprint: payload.shadowEvidenceFingerprint,
      attestorId: payload.attestorId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    });
    if (payload.proofId !== expectedProofId) return false;
    const publicKeyPem = trustedAttestorKeys.get(payload.attestorId);
    if (!publicKeyPem) return false;
    return verifySignature(
      null,
      Buffer.from(canonicalSkillCompetenceProofPayload(payload), 'utf8'),
      publicKeyPem,
      signatureBytes,
    );
  } catch {
    return false;
  }
}

export function createSkillCompetenceProofVerifier(
  trustedAttestorKeys: ReadonlyMap<string, string>,
  now: () => number = () => Date.now(),
): SkillCompetenceProofVerifier {
  return (proof, candidate, purpose = 'attach') => {
    if (!verifySignedSkillCompetenceProof(proof, trustedAttestorKeys)) return false;
    const detached = snapshotProof(proof);
    if (!detached) return false;
    const payload = detached.payload;
    if (payload.candidateId !== candidate.candidateId ||
        payload.skillId !== candidate.skillId ||
        payload.candidateVersion !== candidate.version ||
        payload.payloadFingerprint !== candidate.payloadFingerprint ||
        payload.proposalId !== candidate.proposalId ||
        payload.proposalOutcomeFingerprint !== candidate.proposalOutcomeFingerprint ||
        payload.shadowEvidenceFingerprint !== skillCompetenceShadowEvidenceFingerprint(candidate.shadowObservations) ||
        payload.shadowRunCount !== candidate.shadowObservations.length) return false;
    try { assertCandidateOwnsContract(candidate, payload.contract); }
    catch { return false; }
    if (purpose !== 'persisted-active') {
      const current = now();
      if (!Number.isFinite(current) || payload.issuedAt > current + MAX_CLOCK_SKEW_MS || payload.expiresAt <= current) return false;
    }
    return true;
  };
}

export function verifySkillCompetenceProofForTool(
  proof: unknown,
  context: SkillCompetenceToolVerificationContext,
): { ok: boolean; reason: string } {
  if (!verifySignedSkillCompetenceProof(proof, context.trustedAttestorKeys)) return { ok: false, reason: 'skill-competence-proof-invalid' };
  const detached = snapshotProof(proof);
  if (!detached) return { ok: false, reason: 'skill-competence-proof-invalid' };
  const payload = detached.payload;
  const contract = payload.contract;
  const active = context.activeSubject;
  const currentMode: SkillCompetenceExecutionMode = context.autonomous ? 'autonomous' : 'assisted';
  if (!active || active.candidateId !== payload.candidateId ||
      active.version !== payload.candidateVersion ||
      active.payloadFingerprint !== payload.payloadFingerprint) {
    return { ok: false, reason: 'skill-competence-proof-not-current-active-version' };
  }
  if (!Number.isFinite(context.now) || payload.expiresAt <= context.now || payload.issuedAt > context.now + MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: 'skill-competence-proof-expired-or-not-yet-valid' };
  }
  if (contract.toolId !== context.toolId ||
      contract.capability !== context.capability ||
      contract.permissionClass !== context.permissionClass) {
    return { ok: false, reason: 'skill-competence-proof-tool-scope-mismatch' };
  }
  if (!context.inputContractFingerprint || !context.outputContractFingerprint ||
      contract.inputContractFingerprint !== context.inputContractFingerprint ||
      contract.outputContractFingerprint !== context.outputContractFingerprint) {
    return { ok: false, reason: 'skill-competence-proof-contract-mismatch' };
  }
  if (!context.runtimeFingerprint || !context.environmentFingerprint ||
      contract.runtimeFingerprint !== context.runtimeFingerprint ||
      contract.environmentFingerprint !== context.environmentFingerprint) {
    return { ok: false, reason: 'skill-competence-proof-runtime-or-environment-mismatch' };
  }
  if (!contract.allowedModes.includes(currentMode)) {
    return { ok: false, reason: 'skill-competence-proof-mode-not-authorized' };
  }
  for (const conditionId of contract.preconditions) {
    if (!context.evaluateCondition) return { ok: false, reason: 'skill-competence-precondition-resolver-unavailable' };
    try {
      if (context.evaluateCondition(conditionId, context.input, { toolId: context.toolId, kind: 'precondition' }) !== true) {
        return { ok: false, reason: 'skill-competence-precondition-failed' };
      }
    } catch {
      return { ok: false, reason: 'skill-competence-precondition-check-failed' };
    }
  }
  for (const conditionId of contract.constraints) {
    if (!context.evaluateCondition) return { ok: false, reason: 'skill-competence-constraint-resolver-unavailable' };
    try {
      if (context.evaluateCondition(conditionId, context.input, { toolId: context.toolId, kind: 'constraint' }) !== true) {
        return { ok: false, reason: 'skill-competence-constraint-failed' };
      }
    } catch {
      return { ok: false, reason: 'skill-competence-constraint-check-failed' };
    }
  }
  return { ok: true, reason: 'skill-competence-proof-verified' };
}

export function parseTrustedSkillCompetenceAttestorKeys(raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim() === '') return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('NEURO_SKILL_COMPETENCE_ATTESTOR_KEYS_JSON must be valid JSON'); }
  if (!isRecord(parsed)) throw new Error('NEURO_SKILL_COMPETENCE_ATTESTOR_KEYS_JSON must be an object keyed by attestor ID');
  const keys = new Map<string, string>();
  const entries = Object.entries(parsed);
  if (entries.length > 32) throw new Error('skill competence attestor key limit exceeded');
  for (const [id, value] of entries) {
    if (!validIdentifier(id) || typeof value !== 'string' || value.length > 4096 || !value.includes('BEGIN PUBLIC KEY')) {
      throw new Error('skill competence attestor keys must map valid IDs to PEM Ed25519 public keys');
    }
    try {
      if (createPublicKey(value).asymmetricKeyType !== 'ed25519') {
        throw new Error('not-ed25519');
      }
    } catch {
      throw new Error('skill competence attestor keys must be valid Ed25519 public keys');
    }
    keys.set(id, value);
  }
  return keys;
}
