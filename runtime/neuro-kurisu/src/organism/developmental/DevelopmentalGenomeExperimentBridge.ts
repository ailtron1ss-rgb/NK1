import { createHash } from 'node:crypto';
import { snapshotPlainData } from '../learning/LearningTrustBoundary.ts';
import { bootstrapMeanConfidenceInterval, type BootstrapMeanInterval } from '../learning/PairedSeedConfidence.ts';
import {
  hasAuthenticatedOutcomeEvidence,
  ingestSignedOutcomeArtifact,
  outcomePayloadFingerprint,
  type SignedOutcomeArtifact,
} from '../learning/VerifiedOutcomeArtifact.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from '../learning/VerifiedOutcomeLedger.ts';
import {
  evaluateDevelopmentalGenome,
  inheritDevelopmentalGenome,
  type DevelopmentalGenome,
  type DevelopmentalGenomeTraitPatch,
  type GenomeGateIssue,
  type GenomeGateReport,
} from '../system/DevelopmentalGenome.ts';
import type { P53Candidate } from './P53DevelopmentalSelfModificationLab.ts';
import type { P63Mode, P63Plan } from './P63DevelopmentalOperatingSystem.ts';

export const DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA =
  'nk1.developmental-genome-experiment-evidence.v1' as const;

export interface DevelopmentalGenomeExperimentEvidence {
  schemaVersion: typeof DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA;
  runId: string;
  evaluatorId: string;
  evaluatorVersion: string;
  independent: boolean;
  holdoutDisjoint: boolean;
  parentDigest: string;
  candidateDigest: string;
  independentEvidenceBundleDigest: string;
  hostAttestationDigest: string;
  baselineDatasetId: string;
  holdoutDatasetId: string;
  pairedSeedIds: string[];
  pairedSeedDeltas01: number[];
  identityContinuity01: number;
  rollbackPrepared: boolean;
  rollbackCheckpointDigest: string;
  createdAt: number;
  digest: string;
}

export type DevelopmentalGenomeExperimentStatus =
  | 'READY_FOR_HUMAN_REVIEW'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export interface DevelopmentalGenomeSignedOutcomes {
  manifest: TaskManifestEntry[];
  artifacts: SignedOutcomeArtifact[];
  baselineMethod: string;
  candidateMethod: string;
}

export interface DevelopmentalGenomeExperimentInput {
  parent: DevelopmentalGenome;
  ancestors?: readonly DevelopmentalGenome[];
  patches: DevelopmentalGenomeTraitPatch[];
  p53Candidate: P53Candidate;
  p63Plan: P63Plan;
  p60Decision: 'allow' | 'caution' | 'veto';
  evidence?: DevelopmentalGenomeExperimentEvidence | null;
  signedOutcomes?: DevelopmentalGenomeSignedOutcomes;
}

export interface DevelopmentalGenomeExperimentReceipt {
  schemaVersion: 1;
  status: DevelopmentalGenomeExperimentStatus;
  parentDigest: string | null;
  candidateDigest: string | null;
  p53CandidateId: string | null;
  p63Mode: P63Mode | null;
  p60Decision: 'allow' | 'caution' | 'veto' | null;
  evidenceDigest: string | null;
  confidenceInterval: BootstrapMeanInterval | null;
  activation: 'NOT_APPLIED';
  digest: string;
}

export interface DevelopmentalGenomeExperimentReport {
  status: DevelopmentalGenomeExperimentStatus;
  activation: 'NOT_APPLIED';
  candidate: DevelopmentalGenome | null;
  genomeGate: GenomeGateReport | null;
  receipt: DevelopmentalGenomeExperimentReceipt;
  issues: GenomeGateIssue[];
}

interface ReceiptContext {
  parentDigest: string | null;
  candidateDigest: string | null;
  p53CandidateId: string | null;
  p63Mode: P63Mode | null;
  p60Decision: 'allow' | 'caution' | 'veto' | null;
  evidenceDigest: string | null;
}

function canonicalValue(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value: string): string {
  return 'sha256:' + createHash('sha256').update(value).digest('hex');
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isHexDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/**
 * The family key binds the exact experiment envelope to the exact parent/child
 * pair, P53 candidate, P63 plan, P60 decision and ancestor chain. A trusted
 * verifier signs the manifest fingerprint containing this family key.
 */
export function developmentalGenomeExperimentFamilyKey(
  input: DevelopmentalGenomeExperimentInput,
  candidate: DevelopmentalGenome,
): string {
  const binding = {
    schema: DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA,
    parentDigest: input.parent.digest,
    candidateDigest: candidate.digest,
    ancestors: (input.ancestors ?? []).map(genome => genome.digest),
    evidenceDigest: input.evidence?.digest ?? null,
    p53CandidateId: input.p53Candidate?.id ?? null,
    p63PlanDigest: sha256(canonicalJson(input.p63Plan)),
    p60Decision: input.p60Decision,
  };
  return 'nk1-genome-' + createHash('sha256').update(canonicalJson(binding)).digest('hex');
}

export function developmentalGenomeExperimentTaskFingerprint(family: string, taskId: string): string {
  return createHash('sha256')
    .update('nk1-developmental-genome-holdout-task:v1\\u0000' + family + '\\u0000' + taskId)
    .digest('hex');
}

function boundedIdentifier(value: unknown, maxLength = 180): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength &&
    value.trim() === value && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}

function addIssue(issues: GenomeGateIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}

export function computeDevelopmentalGenomeExperimentEvidenceDigest(
  evidence: Omit<DevelopmentalGenomeExperimentEvidence, 'digest'> | DevelopmentalGenomeExperimentEvidence,
): string {
  const payload: Record<string, unknown> = { ...(evidence as any) };
  delete payload.digest;
  return sha256(canonicalJson(payload));
}

function createReport(
  status: DevelopmentalGenomeExperimentStatus,
  candidate: DevelopmentalGenome | null,
  genomeGate: GenomeGateReport | null,
  issues: GenomeGateIssue[],
  confidenceInterval: BootstrapMeanInterval | null,
  context: ReceiptContext,
): DevelopmentalGenomeExperimentReport {
  const receiptPayload = {
    schemaVersion: 1 as const,
    status,
    parentDigest: context.parentDigest,
    candidateDigest: context.candidateDigest,
    p53CandidateId: context.p53CandidateId,
    p63Mode: context.p63Mode,
    p60Decision: context.p60Decision,
    evidenceDigest: context.evidenceDigest,
    confidenceInterval,
    activation: 'NOT_APPLIED' as const,
  };
  const receipt: DevelopmentalGenomeExperimentReceipt = {
    ...receiptPayload,
    digest: sha256(canonicalJson(receiptPayload)),
  };
  return {
    status,
    activation: 'NOT_APPLIED',
    candidate,
    genomeGate,
    receipt,
    issues,
  };
}

function validateP53(candidate: P53Candidate, issues: GenomeGateIssue[]): boolean {
  if (!candidate || typeof candidate !== 'object') {
    addIssue(issues, 'p53-candidate-invalid', 'p53Candidate', 'A P53 candidate snapshot is required');
    return false;
  }
  if (candidate.status === 'candidate' || candidate.status === 'testing') {
    addIssue(issues, 'p53-evidence-pending', 'p53Candidate.status', 'P53 candidate has not reached its promotable evidence state');
    return false;
  }
  if (candidate.status !== 'promotable') {
    addIssue(issues, 'p53-candidate-not-promotable', 'p53Candidate.status', 'Only an unpromoted P53 candidate in promotable state can enter genome review');
    return false;
  }
  if (!boundedIdentifier(candidate.id) || !Number.isSafeInteger(candidate.tick) || candidate.tick < 0 ||
      !Number.isSafeInteger(candidate.createdAt) || candidate.createdAt < 0 ||
      !Number.isSafeInteger(candidate.lastAt) || candidate.lastAt < 0 ||
      !Number.isSafeInteger(candidate.evidenceCount) || candidate.evidenceCount < 2 ||
      !['exploration', 'verification', 'reflection', 'attention', 'prediction'].includes(candidate.knob) ||
      typeof candidate.delta !== 'number' || !Number.isFinite(candidate.delta) ||
      Math.abs(candidate.delta) < 0.01 || Math.abs(candidate.delta) > 0.08) {
    addIssue(issues, 'p53-candidate-shape-invalid', 'p53Candidate', 'P53 identity, timing, knob, delta or evidence-count fields are invalid');
    return false;
  }
  const metrics = [
    candidate.baseline01, candidate.shadow01, candidate.holdout01,
    candidate.identityPreservation01, candidate.stability01, candidate.transfer01,
    candidate.improvement01, candidate.risk01,
  ];
  if (metrics.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
    addIssue(issues, 'p53-metrics-invalid', 'p53Candidate', 'Every P53 metric must be finite and within [0,1]');
    return false;
  }
  const ready = candidate.improvement01 >= 0.08 &&
    candidate.holdout01 >= 0.62 &&
    candidate.transfer01 >= 0.60 &&
    candidate.identityPreservation01 >= 0.84 &&
    candidate.risk01 < 0.28 &&
    candidate.stability01 >= 0.58;
  if (!ready) {
    addIssue(issues, 'p53-thresholds-not-met', 'p53Candidate', 'P53 candidate does not satisfy the laboratory evidence thresholds');
    return false;
  }
  return true;
}

function validateP63(plan: P63Plan, issues: GenomeGateIssue[]): boolean {
  if (!plan || typeof plan !== 'object') {
    addIssue(issues, 'p63-plan-invalid', 'p63Plan', 'A P63 developmental plan is required');
    return false;
  }
  if (plan.mode !== 'experiment') {
    addIssue(issues, 'p63-experiment-mode-required', 'p63Plan.mode', 'Genome experiments are staged only while P63 selects experiment mode');
    return false;
  }
  const required = Array.isArray(plan.evidenceRequired) ? plan.evidenceRequired : [];
  if (!required.includes('controlled-comparison') || !required.includes('holdout-outcome')) {
    addIssue(issues, 'p63-evidence-contract-incomplete', 'p63Plan.evidenceRequired', 'P63 must require controlled comparison and holdout outcome evidence');
    return false;
  }
  if (typeof plan.confidence01 !== 'number' || !Number.isFinite(plan.confidence01) ||
      typeof plan.developmentBudget01 !== 'number' || !Number.isFinite(plan.developmentBudget01) ||
      plan.confidence01 < 0 || plan.confidence01 > 1 ||
      plan.developmentBudget01 < 0 || plan.developmentBudget01 > 1) {
    addIssue(issues, 'p63-plan-metrics-invalid', 'p63Plan', 'P63 confidence and development budget must be finite and within [0,1]');
    return false;
  }
  if (plan.confidence01 < 0.60 || plan.developmentBudget01 < 0.10) {
    addIssue(issues, 'p63-development-budget-insufficient', 'p63Plan', 'P63 confidence or experiment budget is below the genome-review threshold');
    return false;
  }
  return true;
}

function validateEvidenceEnvelope(
  evidence: DevelopmentalGenomeExperimentEvidence,
  parent: DevelopmentalGenome,
  candidate: DevelopmentalGenome,
  issues: GenomeGateIssue[],
): { valid: boolean; needsMore: boolean; interval: BootstrapMeanInterval | null; digest: string | null } {
  if (!evidence || typeof evidence !== 'object') {
    addIssue(issues, 'experiment-evidence-invalid', 'evidence', 'Evidence must be a plain data object');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (evidence.schemaVersion !== DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA) {
    addIssue(issues, 'experiment-evidence-schema-invalid', 'evidence.schemaVersion', 'Unsupported experiment evidence schema');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (!boundedIdentifier(evidence.runId) || !boundedIdentifier(evidence.evaluatorId) ||
      !boundedIdentifier(evidence.evaluatorVersion) ||
      !isSha256(evidence.parentDigest) || !isSha256(evidence.candidateDigest) ||
      !isHexDigest(evidence.independentEvidenceBundleDigest) ||
      !isHexDigest(evidence.hostAttestationDigest) ||
      !boundedIdentifier(evidence.baselineDatasetId) || !boundedIdentifier(evidence.holdoutDatasetId) ||
      !isSha256(evidence.rollbackCheckpointDigest) ||
      !Number.isSafeInteger(evidence.createdAt) || evidence.createdAt < 0) {
    addIssue(issues, 'experiment-evidence-provenance-incomplete', 'evidence', 'Evidence provenance, dataset, bundle, attestation or rollback identifiers are malformed or missing');
    return { valid: false, needsMore: true, interval: null, digest: null };
  }
  if (evidence.parentDigest !== parent.digest || evidence.candidateDigest !== candidate.digest) {
    addIssue(issues, 'experiment-evidence-genome-binding-mismatch', 'evidence', 'Evidence must bind the exact parent and child genome digests');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (evidence.baselineDatasetId === evidence.holdoutDatasetId) {
    addIssue(issues, 'experiment-dataset-overlap', 'evidence.holdoutDatasetId', 'Baseline and holdout dataset identities must be distinct');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (evidence.independent !== true || evidence.holdoutDisjoint !== true) {
    addIssue(issues, 'experiment-independence-not-established', 'evidence', 'Evidence must declare an independent evaluator and disjoint holdout');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (evidence.rollbackPrepared !== true) {
    addIssue(issues, 'rollback-checkpoint-not-prepared', 'evidence.rollbackPrepared', 'A rollback checkpoint must be prepared before human review');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (typeof evidence.identityContinuity01 !== 'number' ||
      !Number.isFinite(evidence.identityContinuity01) ||
      evidence.identityContinuity01 < 0 || evidence.identityContinuity01 > 1) {
    addIssue(issues, 'identity-continuity-evidence-invalid', 'evidence.identityContinuity01', 'Identity continuity must be finite and within [0,1]');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (evidence.identityContinuity01 < 0.86) {
    addIssue(issues, 'identity-continuity-below-gate', 'evidence.identityContinuity01', 'Identity continuity is below the protected review threshold');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (!Array.isArray(evidence.pairedSeedIds) || !Array.isArray(evidence.pairedSeedDeltas01) ||
      evidence.pairedSeedIds.length !== evidence.pairedSeedDeltas01.length) {
    addIssue(issues, 'paired-seed-evidence-invalid', 'evidence.pairedSeedIds', 'Paired seed identifiers and deltas must be matching arrays');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (evidence.pairedSeedIds.some(id => !boundedIdentifier(id, 120)) ||
      new Set(evidence.pairedSeedIds).size !== evidence.pairedSeedIds.length ||
      evidence.pairedSeedDeltas01.some(delta => typeof delta !== 'number' || !Number.isFinite(delta) || delta < -1 || delta > 1)) {
    addIssue(issues, 'paired-seed-evidence-malformed', 'evidence.pairedSeedDeltas01', 'Paired seed data must contain unique identifiers and finite deltas in [-1,1]');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  const digest = computeDevelopmentalGenomeExperimentEvidenceDigest(evidence);
  if (!isSha256(evidence.digest) || evidence.digest !== digest) {
    addIssue(issues, 'experiment-evidence-digest-mismatch', 'evidence.digest', 'Evidence content digest does not match its canonical payload');
    return { valid: false, needsMore: false, interval: null, digest };
  }
  if (evidence.pairedSeedIds.length < 5) {
    addIssue(issues, 'paired-seed-coverage-insufficient', 'evidence.pairedSeedIds', 'At least five matched seed pairs are required before review');
    return { valid: false, needsMore: true, interval: null, digest };
  }
  // These declared deltas are only claims. Statistical analysis is deliberately
  // deferred until the exact outcomes have been authenticated by VerifiedOutcomeArtifact.
  return { valid: true, needsMore: false, interval: null, digest };
}

interface SignedOutcomeValidationResult {
  valid: boolean;
  needsMore: boolean;
  interval: BootstrapMeanInterval | null;
  digest: string | null;
}

/**
 * Rebuild the paired holdout sample from Ed25519-authenticated ledger rows.
 * The self-reported deltas in the envelope are compared with, never used instead
 * of, the independently signed task outcomes.
 */
function validateSignedOutcomeSet(
  input: DevelopmentalGenomeExperimentInput,
  candidate: DevelopmentalGenome,
  evidence: DevelopmentalGenomeExperimentEvidence,
  trustedVerifierKeys: ReadonlyMap<string, string>,
  issues: GenomeGateIssue[],
): SignedOutcomeValidationResult {
  const signed = input.signedOutcomes;
  if (!signed || typeof signed !== 'object' || !Array.isArray(signed.manifest) || !Array.isArray(signed.artifacts)) {
    addIssue(issues, 'signed-independent-outcomes-required', 'signedOutcomes', 'Only signed, manifest-bound independent holdout outcomes can authorize human review');
    return { valid: false, needsMore: true, interval: null, digest: null };
  }
  if (!(trustedVerifierKeys instanceof Map) || trustedVerifierKeys.size === 0) {
    addIssue(issues, 'trusted-evaluator-keys-not-configured', 'trustedVerifierKeys', 'Host must configure trusted evaluator public keys before genome evidence can be admitted');
    return { valid: false, needsMore: true, interval: null, digest: null };
  }
  const family = developmentalGenomeExperimentFamilyKey(input, candidate);
  if (!boundedIdentifier(signed.baselineMethod, 120) ||
      !boundedIdentifier(signed.candidateMethod, 120) ||
      signed.baselineMethod === signed.candidateMethod ||
      signed.manifest.length === 0) {
    addIssue(issues, 'signed-outcome-manifest-invalid', 'signedOutcomes', 'Signed outcome methods and manifest are invalid');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  let ledger: VerifiedOutcomeLedger;
  try {
    ledger = new VerifiedOutcomeLedger(signed.manifest);
  } catch (error) {
    addIssue(issues, 'signed-outcome-manifest-rejected', 'signedOutcomes.manifest', String((error as any)?.message ?? error).slice(0, 180));
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  for (const task of signed.manifest) {
    if (task.family !== family || task.split !== 'holdout' ||
        task.verifierId !== evidence.evaluatorId || task.version !== evidence.evaluatorVersion ||
        task.promptFingerprint !== developmentalGenomeExperimentTaskFingerprint(family, task.taskId)) {
      addIssue(issues, 'signed-outcome-manifest-binding-mismatch', 'signedOutcomes.manifest', 'Every holdout task must be bound to this exact genome experiment and trusted evaluator version');
      return { valid: false, needsMore: false, interval: null, digest: null };
    }
  }

  const seedIds: number[] = [];
  for (const label of evidence.pairedSeedIds) {
    const match = /^seed-([1-9][0-9]*)$/.exec(label);
    const seed = match ? Number(match[1]) : NaN;
    if (!Number.isSafeInteger(seed) || seed < 1 || seedIds.includes(seed)) {
      addIssue(issues, 'signed-outcome-seed-identity-invalid', 'evidence.pairedSeedIds', 'Seed labels must uniquely encode positive safe-integer seeds');
      return { valid: false, needsMore: false, interval: null, digest: null };
    }
    seedIds.push(seed);
  }
  const expectedCount = signed.manifest.length * seedIds.length * 2;
  if (signed.artifacts.length < expectedCount) {
    addIssue(issues, 'signed-outcome-pair-incomplete', 'signedOutcomes.artifacts', 'Signed evidence does not contain every task/method/seed cell');
    return { valid: false, needsMore: true, interval: null, digest: null };
  }
  if (signed.artifacts.length > expectedCount) {
    addIssue(issues, 'signed-outcome-extra-artifacts', 'signedOutcomes.artifacts', 'Unexpected signed artifacts are not admitted into this experiment');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }

  const fingerprints: string[] = [];
  const runIds = new Map<string, Set<string>>([
    [signed.baselineMethod, new Set<string>()],
    [signed.candidateMethod, new Set<string>()],
  ]);
  for (const artifact of signed.artifacts) {
    const payload = artifact?.payload;
    if (!payload || typeof payload !== 'object' ||
        (payload.method !== signed.baselineMethod && payload.method !== signed.candidateMethod) ||
        !seedIds.includes(payload.seed) || payload.attempt !== 1 ||
        payload.verifierId !== evidence.evaluatorId ||
        payload.taskVersion !== evidence.evaluatorVersion ||
        !signed.manifest.some(task => task.taskId === payload.taskId) ||
        payload.runId !== evidence.runId + ':' + payload.method) {
      addIssue(issues, 'signed-outcome-artifact-context-mismatch', 'signedOutcomes.artifacts', 'Signed artifact method, seed, task, evaluator, version or run identity is outside the evidence envelope');
      return { valid: false, needsMore: false, interval: null, digest: null };
    }
    const accepted = ingestSignedOutcomeArtifact(ledger, signed.manifest, artifact, trustedVerifierKeys);
    if (!accepted.accepted) {
      const needsMore = accepted.rejection === 'untrusted-verifier-key';
      addIssue(issues, needsMore ? 'signed-outcome-untrusted-verifier' : 'signed-outcome-artifact-rejected',
        'signedOutcomes.artifacts', accepted.rejection ?? 'signed-outcome-rejected');
      return { valid: false, needsMore, interval: null, digest: null };
    }
    const outcome = ledger.snapshot().outcomes.find(row =>
      row.taskId === payload.taskId && row.method === payload.method &&
      row.seed === payload.seed && row.attempt === 1,
    );
    if (!outcome || outcome.authority !== 'independent-verifier' ||
        outcome.verifierId !== evidence.evaluatorId ||
        !hasAuthenticatedOutcomeEvidence(ledger, outcome.evidenceRef)) {
      addIssue(issues, 'signed-outcome-authentication-receipt-missing', 'signedOutcomes.artifacts', 'Accepted outcome has no process-local authenticated evidence receipt');
      return { valid: false, needsMore: false, interval: null, digest: null };
    }
    runIds.get(payload.method)!.add(payload.runId);
    fingerprints.push(accepted.artifactFingerprint);
  }
  if (runIds.get(signed.baselineMethod)!.size !== 1 ||
      runIds.get(signed.candidateMethod)!.size !== 1 ||
      [...runIds.get(signed.baselineMethod)!][0] === [...runIds.get(signed.candidateMethod)!][0]) {
    addIssue(issues, 'signed-outcome-run-separation-invalid', 'signedOutcomes.artifacts', 'Baseline and candidate must have distinct, internally consistent run identities');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }

  const manifestTasks = signed.manifest.map(task => task.taskId);
  const outcomes = ledger.snapshot().outcomes;
  const bySeed = new Map<number, Map<string, Map<string, boolean>>>();
  for (const outcome of outcomes) {
    const rows = bySeed.get(outcome.seed) ?? new Map<string, Map<string, boolean>>();
    const methods = rows.get(outcome.taskId) ?? new Map<string, boolean>();
    methods.set(outcome.method, outcome.passed);
    rows.set(outcome.taskId, methods);
    bySeed.set(outcome.seed, rows);
  }
  const derivedDeltas: number[] = [];
  for (const seed of seedIds) {
    const taskRows = bySeed.get(seed);
    if (!taskRows || manifestTasks.some(taskId => {
      const methods = taskRows.get(taskId);
      return !methods?.has(signed.baselineMethod) || !methods?.has(signed.candidateMethod);
    })) {
      addIssue(issues, 'signed-outcome-pair-incomplete', 'signedOutcomes.artifacts', 'Every seed must contain both methods for every manifest task');
      return { valid: false, needsMore: true, interval: null, digest: null };
    }
    const baselineRate = manifestTasks.reduce((sum, taskId) =>
      sum + Number(taskRows.get(taskId)!.get(signed.baselineMethod)!), 0) / manifestTasks.length;
    const candidateRate = manifestTasks.reduce((sum, taskId) =>
      sum + Number(taskRows.get(taskId)!.get(signed.candidateMethod)!), 0) / manifestTasks.length;
    derivedDeltas.push(candidateRate - baselineRate);
  }
  if (evidence.pairedSeedIds.some((label, index) => label !== 'seed-' + seedIds[index]) ||
      evidence.pairedSeedDeltas01.some((delta, index) =>
        Math.abs(delta - (derivedDeltas[index] ?? Number.NaN)) > 1e-9)) {
    addIssue(issues, 'signed-outcome-delta-mismatch', 'evidence.pairedSeedDeltas01', 'Declared seed IDs/deltas do not exactly match authenticated holdout task outcomes');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
  if (derivedDeltas.some(delta => delta < 0)) {
    addIssue(issues, 'paired-seed-regressions-detected', 'signedOutcomes.artifacts', 'A candidate with any negative authenticated paired-seed delta is blocked');
    return { valid: false, needsMore: false, interval: null, digest: null };
  }

  try {
    const seedHex = createHash('sha256').update(family + ':' + ledger.manifestFingerprint()).digest('hex').slice(0, 8);
    const interval = bootstrapMeanConfidenceInterval(derivedDeltas, {
      seed: Number.parseInt(seedHex, 16),
      resamples: 4000,
      confidenceLevel: 0.95,
    });
    if (interval.mean <= 0 || interval.lower <= 0) {
      addIssue(issues, 'paired-seed-confidence-bound-not-positive', 'signedOutcomes.artifacts', 'The 95% bootstrap lower confidence bound from authenticated outcomes must be positive');
      return { valid: false, needsMore: false, interval, digest: null };
    }
    const digest = sha256(canonicalJson({
      family,
      manifestFingerprint: ledger.manifestFingerprint(),
      artifactFingerprints: fingerprints.sort(),
      pairedSeedIds: evidence.pairedSeedIds,
      pairedSeedDeltas01: derivedDeltas,
      confidenceInterval: interval,
    }));
    return { valid: true, needsMore: false, interval, digest };
  } catch (error) {
    addIssue(issues, 'signed-outcome-confidence-evaluation-failed', 'signedOutcomes.artifacts', String((error as any)?.message ?? error).slice(0, 180));
    return { valid: false, needsMore: false, interval: null, digest: null };
  }
}

/**
 * P53/P63-to-genome bridge. It stages a reproducible child only for review;
 * it never mutates P53/P63 state, runtime traits, executable code or identity.
 */
export function evaluateDevelopmentalGenomeExperiment(
  rawInput: DevelopmentalGenomeExperimentInput,
  trustedVerifierKeys: ReadonlyMap<string, string> = new Map<string, string>(),
): DevelopmentalGenomeExperimentReport {
  const context: ReceiptContext = {
    parentDigest: null,
    candidateDigest: null,
    p53CandidateId: null,
    p63Mode: null,
    p60Decision: null,
    evidenceDigest: null,
  };
  const issues: GenomeGateIssue[] = [];
  try {
    const input = snapshotPlainData(rawInput) as DevelopmentalGenomeExperimentInput;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      addIssue(issues, 'experiment-input-invalid', 'input', 'Experiment input must be a plain data object');
      return createReport('BLOCKED', null, null, issues, null, context);
    }
    if (input.parent && isSha256(input.parent.digest)) context.parentDigest = input.parent.digest;
    if (input.p53Candidate && typeof input.p53Candidate.id === 'string') context.p53CandidateId = input.p53Candidate.id;
    if (input.p63Plan && typeof input.p63Plan.mode === 'string') context.p63Mode = input.p63Plan.mode as P63Mode;
    if (input.p60Decision === 'allow' || input.p60Decision === 'caution' || input.p60Decision === 'veto') {
      context.p60Decision = input.p60Decision;
    }
    if (!input.parent || !Array.isArray(input.patches) || input.patches.length === 0) {
      addIssue(issues, 'experiment-parent-or-patches-missing', 'input', 'A verified parent genome and at least one bounded trait patch are required');
      return createReport('BLOCKED', null, null, issues, null, context);
    }
    if (input.p60Decision === 'veto') {
      addIssue(issues, 'p60-veto', 'p60Decision', 'P60 veto blocks genome experimentation');
      return createReport('BLOCKED', null, null, issues, null, context);
    }
    if (input.p60Decision === 'caution') {
      addIssue(issues, 'p60-caution', 'p60Decision', 'P60 caution defers genome experimentation until governance is clear');
      return createReport('NEEDS_REVIEW', null, null, issues, null, context);
    }
    if (input.p60Decision !== 'allow') {
      addIssue(issues, 'p60-decision-invalid', 'p60Decision', 'P60 must explicitly allow a shadow experiment');
      return createReport('BLOCKED', null, null, issues, null, context);
    }
    if (!validateP63(input.p63Plan, issues)) {
      const status = issues.some(issue => issue.code === 'p63-experiment-mode-required' ||
        issue.code === 'p63-development-budget-insufficient') ? 'NEEDS_REVIEW' : 'BLOCKED';
      return createReport(status, null, null, issues, null, context);
    }
    if (!validateP53(input.p53Candidate, issues)) {
      const status = issues.some(issue => issue.code === 'p53-evidence-pending') ? 'NEEDS_REVIEW' : 'BLOCKED';
      return createReport(status, null, null, issues, null, context);
    }

    const candidate = inheritDevelopmentalGenome(input.parent, input.patches, input.ancestors ?? []);
    context.candidateDigest = candidate.digest;
    const genomeGate = evaluateDevelopmentalGenome(candidate, input.parent, input.ancestors ?? []);
    if (genomeGate.status === 'BLOCKED') {
      issues.push(...genomeGate.violations);
      addIssue(issues, 'genome-gate-blocked', 'candidate', 'The existing Developmental Genome Evolution Gate rejected the child candidate');
      return createReport('BLOCKED', candidate, genomeGate, issues, null, context);
    }
    if (genomeGate.status === 'NEEDS_REVIEW') {
      issues.push(...genomeGate.warnings);
      addIssue(issues, 'genome-lineage-review-required', 'candidate.lineage', 'Complete parent and ancestor lineage proof before experiment review');
      return createReport('NEEDS_REVIEW', candidate, genomeGate, issues, null, context);
    }
    if (!input.evidence) {
      addIssue(issues, 'independent-experiment-evidence-required', 'evidence', 'Attach an independently generated, parent/candidate-bound evidence envelope');
      return createReport('NEEDS_REVIEW', candidate, genomeGate, issues, null, context);
    }

    const evidence = input.evidence as DevelopmentalGenomeExperimentEvidence;
    const evidenceResult = validateEvidenceEnvelope(evidence, input.parent, candidate, issues);
    if (!evidenceResult.valid) {
      context.evidenceDigest = evidenceResult.digest;
      return createReport(evidenceResult.needsMore ? 'NEEDS_REVIEW' : 'BLOCKED',
        candidate, genomeGate, issues, evidenceResult.interval, context);
    }
    const signedResult = validateSignedOutcomeSet(input, candidate, evidence, trustedVerifierKeys, issues);
    context.evidenceDigest = signedResult.digest ?? evidenceResult.digest;
    if (!signedResult.valid) {
      return createReport(signedResult.needsMore ? 'NEEDS_REVIEW' : 'BLOCKED',
        candidate, genomeGate, issues, signedResult.interval, context);
    }
    return createReport('READY_FOR_HUMAN_REVIEW', candidate, genomeGate, issues, signedResult.interval, context);
  } catch (error) {
    addIssue(issues, 'experiment-input-rejected', 'input', 'Experiment input failed the plain-data or validation boundary: ' +
      String((error as any)?.message ?? error).slice(0, 180));
    return createReport('BLOCKED', null, null, issues, null, context);
  }
}
