import { createHash } from 'node:crypto';
import type { OrganismRuntime } from '../core/OrganismRuntime.ts';
import type { P23LearningEngine } from './P23LearningEngine.ts';
import { isSafeLearningIdentity, snapshotPlainData, snapshotPlainDataEnvelope } from './LearningTrustBoundary.ts';

type RevisionArgs = Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>;
type Proposal = RevisionArgs[0];
type Baseline = RevisionArgs[3];
type CandidateEvaluation = RevisionArgs[4];
type Generator = RevisionArgs[5];
type Evaluator = RevisionArgs[6];
type Options = RevisionArgs[7];

export interface CompoundRepairRevisionInputs {
  proposal: Proposal;
  sourceCandidateId: string;
  baseline: Baseline;
  candidateEvaluation: CandidateEvaluation;
  generate: Generator;
  evaluateRevisedCandidate: Evaluator;
  options?: Options;
}

export type CompoundRepairRevisionInputProvider = (
  input: {
    skillId: string;
    repairFingerprints: string[];
    repairEvidence: ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>;
  },
) => Promise<CompoundRepairRevisionInputs>;

interface RevisionFailureBackoff {
  evidenceDigest: string;
  attempts: number;
  retryAfter: number;
  category: 'revision-generation-or-evaluation-failed';
}

export interface CompoundRepairRevisionOutcome {
  status: 'no-eligible-repair-evidence'|'already-staged-for-evidence'|'retry-backoff-active'|'candidate-staged';
  skillId: string;
  repairEvidenceCount: number;
  evidenceDigest?: string;
  candidateId?: string;
  durable?: boolean;
  attempts?: number;
  retryAfter?: number;
  retryInMs?: number;
  category?: 'revision-generation-or-evaluation-failed';
  repairFingerprints?: string[];
  result?: unknown;
}

export interface CompoundRepairRetryBackoffSnapshot {
  schemaVersion: 1;
  entries: Array<{
    skillId: string;
    evidenceDigest: string;
    attempts: number;
    retryAfter: number;
    category: 'revision-generation-or-evaluation-failed';
  }>;
}

/** Implemented by NK1's existing atomic FileStateStore; no second storage framework. */
export interface CompoundRepairRetryBackoffStore {
  load(): Promise<unknown>;
  save(value: CompoundRepairRetryBackoffSnapshot): Promise<void>;
}

const BASE_RETRY_BACKOFF_MS = 30 * 60 * 1000;
const MAX_RETRY_BACKOFF_MS = 24 * 60 * 60 * 1000;
const isSha256Digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export type CompoundRepairEvidenceRow = ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>[number];

/** Locale-independent UTF-16 code-unit order keeps SHA-256 fingerprints stable across hosts. */
function compareCanonicalText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Canonical representation of eligible repair evidence shared by the coordinator
 * and runtime. Row order, object insertion order, and candidateTools order are not
 * semantic evidence differences and must not manufacture new candidate revisions.
 */
export function canonicalCompoundRepairEvidence(
  rawRows: readonly CompoundRepairEvidenceRow[],
): CompoundRepairEvidenceRow[] {
  let detached: unknown;
  try { detached=snapshotPlainData(rawRows); }
  catch { throw new Error('compound-repair-evidence-data-boundary-rejected'); }
  if(!Array.isArray(detached)||detached.length>96) {
    throw new Error('compound-repair-evidence-shape-invalid');
  }
  const canonical=detached.map((raw):CompoundRepairEvidenceRow=>{
    if(raw===null||typeof raw!=='object'||Array.isArray(raw)) {
      throw new Error('compound-repair-evidence-row-invalid');
    }
    const row=raw as Record<string,unknown>;
    const boundedText=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max&&value.trim()===value;
    if(!isSafeLearningIdentity(row.skillId,180)||
       !isSafeLearningIdentity(row.skillName,256)||
       !isSafeLearningIdentity(row.failureFingerprint,256)||
       !isSafeLearningIdentity(row.stepId,256)||
       !isSafeLearningIdentity(row.failedTool,180)||
       !boundedText(row.diagnosis,8192)||
       typeof row.contextSignature!=='string'||row.contextSignature.length>1024||
       !Array.isArray(row.candidateTools)||row.candidateTools.length===0||row.candidateTools.length>128||
       row.candidateTools.some((tool:unknown)=>!isSafeLearningIdentity(tool,180))||
       new Set(row.candidateTools).size!==row.candidateTools.length||
       !isSafeLearningIdentity(row.selectedTool,180)||
       !row.candidateTools.includes(row.selectedTool)||
       typeof row.verified!=='boolean'||
       typeof row.revisionEligible!=='boolean'||
       typeof row.confidence01!=='number'||!Number.isFinite(row.confidence01)||row.confidence01<0||row.confidence01>1||
       !Number.isSafeInteger(row.observedAt)||Number(row.observedAt)<0) {
      throw new Error('compound-repair-evidence-row-invalid');
    }
    const candidateTools=row.candidateTools as string[];
    return {
      skillId:row.skillId as string,skillName:row.skillName as string,failureFingerprint:row.failureFingerprint as string,
      stepId:row.stepId as string,failedTool:row.failedTool as string,diagnosis:row.diagnosis as CompoundRepairEvidenceRow['diagnosis'],
      contextSignature:row.contextSignature as string,
      candidateTools:[...candidateTools].sort(compareCanonicalText),
      selectedTool:row.selectedTool as string,verified:row.verified as boolean,confidence01:row.confidence01 as number,
      observedAt:row.observedAt as number,revisionEligible:row.revisionEligible as boolean,
    };
  });
  return canonical.sort((a,b) =>
    b.observedAt-a.observedAt ||
    compareCanonicalText(a.skillId,b.skillId) ||
    compareCanonicalText(a.failureFingerprint,b.failureFingerprint) ||
    compareCanonicalText(a.stepId,b.stepId) ||
    compareCanonicalText(a.contextSignature,b.contextSignature) ||
    compareCanonicalText(a.failedTool,b.failedTool) ||
    compareCanonicalText(a.selectedTool ?? '',b.selectedTool ?? '') ||
    compareCanonicalText(JSON.stringify(a),JSON.stringify(b))
  );
}
export function fingerprintCompoundRepairEvidence(
  rows: readonly CompoundRepairEvidenceRow[],
): string {
  return createHash('sha256').update(JSON.stringify(canonicalCompoundRepairEvidence(rows))).digest('hex');
}

/**
 * Orchestrates a real runtime repair observation into P23's existing revision lifecycle.
 *
 * The provider must obtain the authentic proposal and independently generated baseline /
 * candidate reports from the existing trusted evaluation pipeline. This class deliberately
 * does not synthesize either evidence or generator output. P23 remains responsible for
 * validating the proposal, reports, candidate source, fitness and staging gate.
 */
export class P23CompoundRepairRevisionCoordinator {
  private readonly runtime: OrganismRuntime;
  private readonly engine: P23LearningEngine;
  private readonly provideInputs: CompoundRepairRevisionInputProvider;
  private readonly retryBackoffStore?: CompoundRepairRetryBackoffStore;
  private readonly inFlightBySkill = new Map<string, Promise<CompoundRepairRevisionOutcome>>();
  // Bind coalescing to the evidence snapshot, not just the skill identity.
  // A request for newer evidence must not disappear behind a stale in-flight attempt.
  private readonly inFlightEvidenceDigestBySkill = new Map<string, string>();
  private readonly stagedEvidenceDigestsBySkill = new Map<string, Set<string>>();
  private readonly retryBackoffBySkill = new Map<string, RevisionFailureBackoff>();
  private retryBackoffPersistenceFailure: string | null = null;

  constructor(
    runtime: OrganismRuntime,
    engine: P23LearningEngine,
    provideInputs: CompoundRepairRevisionInputProvider,
    retryBackoffStore?: CompoundRepairRetryBackoffStore,
  ) {
    this.runtime = runtime;
    this.engine = engine;
    this.provideInputs = provideInputs;
    this.retryBackoffStore = retryBackoffStore;
  }

  private evidenceDigest(rows: ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>): string {
    return fingerprintCompoundRepairEvidence(rows);
  }

  /** Restore the last retry deadline per skill before background revision becomes available. */
  async restoreRetryBackoff(): Promise<void> {
    if (!this.retryBackoffStore) return;
    const stored = await this.retryBackoffStore.load();
    if (stored === null || stored === undefined) return;
    let detached: unknown;
    try { detached = snapshotPlainData(stored); }
    catch { throw new Error('compound-repair-retry-backoff-state-data-boundary-rejected'); }
    if (!detached || typeof detached !== 'object' || Array.isArray(detached)) {
      throw new Error('compound-repair-retry-backoff-state-invalid');
    }
    const snapshot = detached as Record<string, unknown>;
    if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.entries) ||
        snapshot.entries.length > 128 ||
        Object.keys(snapshot).sort().join(',') !== 'entries,schemaVersion') {
      throw new Error('compound-repair-retry-backoff-state-invalid');
    }
    const restored = new Map<string, RevisionFailureBackoff>();
    for (const raw of snapshot.entries) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('compound-repair-retry-backoff-entry-invalid');
      }
      const row = raw as Record<string, unknown>;
      if (Object.keys(row).sort().join(',') !== 'attempts,category,evidenceDigest,retryAfter,skillId' ||
          !isSafeLearningIdentity(row.skillId, 180) ||
          !isSha256Digest(row.evidenceDigest) ||
          !Number.isSafeInteger(row.attempts) || Number(row.attempts) < 1 || Number(row.attempts) > 12 ||
          !Number.isSafeInteger(row.retryAfter) || Number(row.retryAfter) < 0 ||
          row.category !== 'revision-generation-or-evaluation-failed' ||
          restored.has(row.skillId as string)) {
        throw new Error('compound-repair-retry-backoff-entry-invalid');
      }
      restored.set(row.skillId as string, {
        evidenceDigest: row.evidenceDigest as string,
        attempts: row.attempts as number,
        retryAfter: row.retryAfter as number,
        category: 'revision-generation-or-evaluation-failed',
      });
    }
    this.retryBackoffBySkill.clear();
    for (const [skillId, row] of restored) this.retryBackoffBySkill.set(skillId, row);
    this.retryBackoffPersistenceFailure = null;
  }

  private retryBackoffSnapshot(): CompoundRepairRetryBackoffSnapshot {
    const entries = [...this.retryBackoffBySkill.entries()]
      .sort(([a], [b]) => compareCanonicalText(a, b))
      .map(([skillId, row]) => ({
        skillId,
        evidenceDigest: row.evidenceDigest,
        attempts: row.attempts,
        retryAfter: row.retryAfter,
        category: row.category,
      }));
    return { schemaVersion: 1, entries };
  }

  private async persistRetryBackoff(): Promise<void> {
    if (!this.retryBackoffStore) return;
    try {
      await this.retryBackoffStore.save(this.retryBackoffSnapshot());
      this.retryBackoffPersistenceFailure = null;
    } catch {
      this.retryBackoffPersistenceFailure = 'retry-backoff-state-save-failed';
      throw new Error('compound-repair-retry-backoff-state-save-failed');
    }
  }

  retryBackoffPersistenceDiagnostics() {
    return {
      configured: Boolean(this.retryBackoffStore),
      available: Boolean(this.retryBackoffStore) && this.retryBackoffPersistenceFailure === null,
      lastFailure: this.retryBackoffPersistenceFailure,
      entryCount: this.retryBackoffBySkill.size,
    };
  }

  /**
   * Coalesce concurrent requests and stage at most once for an identical evidence
   * digest within this coordinator lifetime. New repair evidence creates a new digest.
   * The P23 gate and explicit activation approval remain separate authorities.
   */
  async reviseFromObservedRepairs(skillId: string): Promise<CompoundRepairRevisionOutcome> {
    if (typeof skillId !== 'string' || skillId.trim().length === 0) {
      throw new Error('compound skill id is required');
    }
    const normalizedSkillId = skillId.normalize('NFKC').trim();
    if (normalizedSkillId.length > 180 || Array.from(normalizedSkillId).some(character => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    })) {
      throw new Error('compound skill id is invalid');
    }
    const repairEvidence = canonicalCompoundRepairEvidence(
      this.runtime.compoundSkillRepairEvidence(normalizedSkillId).filter(row => row.revisionEligible),
    );
    if (repairEvidence.length === 0) {
      return Promise.resolve({ status: 'no-eligible-repair-evidence' as const, skillId: normalizedSkillId, repairEvidenceCount: 0 });
    }

    const initialEvidenceDigest = this.evidenceDigest(repairEvidence);
    // The versioned candidate store preserves this lineage across coordinator/runtime
    // restarts. The in-memory digest map below is only a fast-path, not the durable gate.
    const candidateSnapshot = typeof (this.engine as any).verifiedSkillCandidateSnapshot === 'function'
      ? this.engine.verifiedSkillCandidateSnapshot()
      : null;
    const persistedCandidate = candidateSnapshot?.candidates?.find((candidate: any) =>
      candidate.skillId === normalizedSkillId &&
      candidate.revisionProvenance?.sourceEvidenceFingerprint === initialEvidenceDigest);
    if (persistedCandidate) {
      const completed = this.stagedEvidenceDigestsBySkill.get(normalizedSkillId) ?? new Set<string>();
      completed.add(initialEvidenceDigest);
      this.stagedEvidenceDigestsBySkill.set(normalizedSkillId, completed);
      return Promise.resolve({
        status: 'already-staged-for-evidence' as const,
        skillId: normalizedSkillId,
        repairEvidenceCount: repairEvidence.length,
        evidenceDigest: initialEvidenceDigest,
        candidateId: persistedCandidate.candidateId,
        durable: true,
      });
    }
    const staged = this.stagedEvidenceDigestsBySkill.get(normalizedSkillId);
    if (staged?.has(initialEvidenceDigest)) {
      return Promise.resolve({
        status: 'already-staged-for-evidence' as const,
        skillId: normalizedSkillId,
        repairEvidenceCount: repairEvidence.length,
        evidenceDigest: initialEvidenceDigest,
      });
    }
    const inFlight = this.inFlightBySkill.get(normalizedSkillId);
    if (inFlight) {
      if (this.inFlightEvidenceDigestBySkill.get(normalizedSkillId) === initialEvidenceDigest) return inFlight;
      // A newer evidence snapshot arrived while the old revision was preparing.
      // Wait for the stale attempt to settle, then re-read the canonical ledger and
      // process the latest digest. Swallow only the predecessor's error here; its
      // original caller still receives it and the fresh attempt has its own gates.
      return inFlight.catch(() => undefined).then(() => this.reviseFromObservedRepairs(normalizedSkillId));
    }

    const failed = this.retryBackoffBySkill.get(normalizedSkillId);
    if (failed?.evidenceDigest === initialEvidenceDigest && Date.now() < failed.retryAfter) {
      return Promise.resolve({
        status: 'retry-backoff-active' as const,
        skillId: normalizedSkillId,
        repairEvidenceCount: repairEvidence.length,
        evidenceDigest: initialEvidenceDigest,
        attempts: failed.attempts,
        retryAfter: failed.retryAfter,
        retryInMs: Math.max(0, failed.retryAfter - Date.now()),
        category: failed.category,
      });
    }

    const tracked = this.reviseFromEvidenceSnapshot(normalizedSkillId, repairEvidence, initialEvidenceDigest)
      .then(async result => {
        if (result.status === 'candidate-staged') {
          this.retryBackoffBySkill.delete(normalizedSkillId);
          const completed = this.stagedEvidenceDigestsBySkill.get(normalizedSkillId) ?? new Set<string>();
          completed.add(initialEvidenceDigest);
          while (completed.size > 32) completed.delete(completed.values().next().value!);
          this.stagedEvidenceDigestsBySkill.set(normalizedSkillId, completed);
          while (this.stagedEvidenceDigestsBySkill.size > 128) {
            this.stagedEvidenceDigestsBySkill.delete(this.stagedEvidenceDigestsBySkill.keys().next().value!);
          }
          // Candidate-store provenance remains the duplicate-stage authority if this best-effort cleanup fails.
          try { await this.persistRetryBackoff(); } catch { /* surfaced by persistence diagnostics */ }
        }
        return result;
      })
      .catch(async error => {
        const prior = this.retryBackoffBySkill.get(normalizedSkillId);
        const attempts = Math.min(12, prior?.evidenceDigest === initialEvidenceDigest ? prior.attempts + 1 : 1);
        const retryAfter = Date.now() + Math.min(MAX_RETRY_BACKOFF_MS, BASE_RETRY_BACKOFF_MS * 2 ** (attempts - 1));
        this.retryBackoffBySkill.set(normalizedSkillId, {
          evidenceDigest: initialEvidenceDigest,
          attempts,
          retryAfter,
          category: 'revision-generation-or-evaluation-failed',
        });
        while (this.retryBackoffBySkill.size > 128) {
          this.retryBackoffBySkill.delete(this.retryBackoffBySkill.keys().next().value!);
        }
        try {
          await this.persistRetryBackoff();
        } catch {
          const persistenceError = new Error('compound-repair-revision-failed-and-retry-backoff-was-not-persisted');
          Object.assign(persistenceError, { originalError: error });
          throw persistenceError;
        }
        throw error;
      })
      .finally(() => {
        if (this.inFlightBySkill.get(normalizedSkillId) === tracked) {
          this.inFlightBySkill.delete(normalizedSkillId);
          this.inFlightEvidenceDigestBySkill.delete(normalizedSkillId);
        }
      });
    this.inFlightBySkill.set(normalizedSkillId, tracked);
    this.inFlightEvidenceDigestBySkill.set(normalizedSkillId, initialEvidenceDigest);
    return tracked;
  }

  retryBackoffDiagnostics() {
    const now = Date.now();
    return [...this.retryBackoffBySkill.entries()].map(([skillId, row]) => ({
      skillId,
      evidenceDigest: row.evidenceDigest,
      attempts: row.attempts,
      retryAfter: row.retryAfter,
      remainingMs: Math.max(0, row.retryAfter - now),
      active: now < row.retryAfter,
      category: row.category,
      durable: Boolean(this.retryBackoffStore),
      persistenceHealthy: Boolean(this.retryBackoffStore) && this.retryBackoffPersistenceFailure === null,
    }));
  }

  private async reviseFromEvidenceSnapshot(
    skillId: string,
    repairEvidence: ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>,
    initialEvidenceDigest: string,
  ): Promise<CompoundRepairRevisionOutcome> {
    const fingerprints = [...new Set(repairEvidence.map(row => row.failureFingerprint))];
    const rawPrepared = await this.provideInputs({
      skillId,
      repairFingerprints: fingerprints,
      repairEvidence: snapshotPlainData(repairEvidence) as ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>,
    });
    // Read provider-owned fields only from descriptors. structuredClone() can invoke
    // getters, so it is not a safe boundary for a provider that the coordinator treats
    // as mutable/untrusted data. Keep exactly two function-valued capabilities.
    let prepared: CompoundRepairRevisionInputs;
    try {
      const envelope = snapshotPlainDataEnvelope(rawPrepared, ['generate', 'evaluateRevisedCandidate']);
      prepared = {
        proposal: envelope.data.proposal as Proposal,
        sourceCandidateId: envelope.data.sourceCandidateId as string,
        baseline: envelope.data.baseline as Baseline,
        candidateEvaluation: envelope.data.candidateEvaluation as CandidateEvaluation,
        generate: envelope.capabilities.generate as Generator,
        evaluateRevisedCandidate: envelope.capabilities.evaluateRevisedCandidate as Evaluator,
        ...(envelope.data.options !== undefined ? { options: envelope.data.options as Options } : {}),
      };
    } catch {
      throw new Error('compound-repair-revision-provider-data-boundary-rejected');
    }
    if (typeof prepared.sourceCandidateId !== 'string' || !prepared.sourceCandidateId.trim()) {
      throw new Error('trusted revision input provider must return a source candidate id');
    }
    if (!prepared.proposal || !prepared.baseline || !prepared.candidateEvaluation ||
        typeof prepared.generate !== 'function' || typeof prepared.evaluateRevisedCandidate !== 'function') {
      throw new Error('trusted revision input provider returned incomplete proposal/evaluation/generator inputs');
    }
    const proposal = prepared.proposal;
    const baseline = prepared.baseline;
    const candidateEvaluation = prepared.candidateEvaluation;
    const options = prepared.options;
    const sourceCandidateId = prepared.sourceCandidateId;
    const generate = prepared.generate;
    const evaluateRevisedCandidate = prepared.evaluateRevisedCandidate;

    // The provider may perform asynchronous work. Re-read the runtime ledger before
    // staging so the proposal/evaluation cannot silently drift away from the repairs
    // that justified this revision. Runtime entry is queue-serialized; a changed
    // evidence set is a stale-input failure, never a reason to stage a candidate.
    const currentEvidence = this.runtime.compoundSkillRepairEvidence(skillId)
      .filter(row => row.revisionEligible);
    if (this.evidenceDigest(currentEvidence) !== initialEvidenceDigest) {
      throw new Error('compound repair evidence changed while trusted revision inputs were being prepared; retry with a fresh evaluation');
    }

    const result = await this.runtime.generateCompoundSkillRevision({
      engine: this.engine,
      proposal,
      skillId,
      sourceCandidateId,
      baseline,
      candidateEvaluation,
      generate,
      evaluateRevisedCandidate,
      ...(options ? { options } : {}),
      sourceEvidenceFingerprint: initialEvidenceDigest,
    });
    return {
      status: 'candidate-staged' as const,
      skillId,
      repairFingerprints: fingerprints,
      repairEvidenceCount: result.repairEvidenceCount,
      candidateId: result.candidate.candidateId,
      result,
    };
  }
}
