import { createHash } from 'node:crypto';
import type { OrganismRuntime } from '../core/OrganismRuntime.ts';
import type { P23LearningEngine } from './P23LearningEngine.ts';

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
  /** Optional canonical payloads for the native path; the host wrapper independently evaluates all three methods. */
  baselinePayload?: unknown;
  baselinePayloadFingerprint?: string;
  sourceCandidatePayload?: unknown;
  sourceCandidatePayloadFingerprint?: string;
  /** Revalidates signed dataset and canonical versioned-store lineage across async evaluation boundaries. */
  assertCanonicalLineageCurrent?: () => Promise<void> | void;
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

const BASE_RETRY_BACKOFF_MS = 30 * 60 * 1000;
const MAX_RETRY_BACKOFF_MS = 24 * 60 * 60 * 1000;

/**
 * Orchestrates a real runtime repair observation into P23's existing revision lifecycle.
 *
 * The provider must obtain the authentic proposal and independently generated baseline /
 * candidate reports from the existing trusted evaluation pipeline. This class deliberately
 * does not synthesize either evidence or generator output. P23 remains responsible for
 * validating the proposal, reports, candidate source, fitness and staging gate.
 */
export class P23CompoundRepairRevisionCoordinator {
  private readonly inFlightBySkill = new Map<string, Promise<any>>();
  private readonly stagedEvidenceDigestsBySkill = new Map<string, Set<string>>();
  private readonly retryBackoffBySkill = new Map<string, RevisionFailureBackoff>();
  private readonly runtime: OrganismRuntime;
  private readonly engine: P23LearningEngine;
  private readonly provideInputs: CompoundRepairRevisionInputProvider;

  constructor(
    runtime: OrganismRuntime,
    engine: P23LearningEngine,
    provideInputs: CompoundRepairRevisionInputProvider,
  ) {
    this.runtime = runtime;
    this.engine = engine;
    this.provideInputs = provideInputs;
  }

  private evidenceDigest(rows: ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>): string {
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }

  /**
   * Coalesce concurrent requests and stage at most once for an identical evidence
   * digest within this coordinator lifetime. New repair evidence creates a new digest.
   * The P23 gate and explicit activation approval remain separate authorities.
   */
  reviseFromObservedRepairs(skillId: string) {
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
    const repairEvidence = this.runtime.compoundSkillRepairEvidence(normalizedSkillId)
      .filter(row => row.revisionEligible);
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
    if (inFlight) return inFlight;

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
      .then(result => {
        if (result.status === 'candidate-staged') {
          this.retryBackoffBySkill.delete(normalizedSkillId);
          const completed = this.stagedEvidenceDigestsBySkill.get(normalizedSkillId) ?? new Set<string>();
          completed.add(initialEvidenceDigest);
          while (completed.size > 32) completed.delete(completed.values().next().value!);
          this.stagedEvidenceDigestsBySkill.set(normalizedSkillId, completed);
          while (this.stagedEvidenceDigestsBySkill.size > 128) {
            this.stagedEvidenceDigestsBySkill.delete(this.stagedEvidenceDigestsBySkill.keys().next().value!);
          }
        }
        return result;
      })
      .catch(error => {
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
        throw error;
      })
      .finally(() => {
        if (this.inFlightBySkill.get(normalizedSkillId) === tracked) this.inFlightBySkill.delete(normalizedSkillId);
      });
    this.inFlightBySkill.set(normalizedSkillId, tracked);
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
    }));
  }

  private async reviseFromEvidenceSnapshot(
    skillId: string,
    repairEvidence: ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>,
    initialEvidenceDigest: string,
  ) {
    const fingerprints = [...new Set(repairEvidence.map(row => row.failureFingerprint))];
    const prepared = await this.provideInputs({
      skillId,
      repairFingerprints: fingerprints,
      repairEvidence: structuredClone(repairEvidence),
    });
    if (!prepared || typeof prepared.sourceCandidateId !== 'string' || !prepared.sourceCandidateId.trim()) {
      throw new Error('trusted revision input provider must return a source candidate id');
    }
    if (!prepared.proposal || !prepared.baseline || !prepared.candidateEvaluation ||
        typeof prepared.generate !== 'function' || typeof prepared.evaluateRevisedCandidate !== 'function') {
      throw new Error('trusted revision input provider returned incomplete proposal/evaluation/generator inputs');
    }

    // Treat provider output as untrusted mutable data even when the caller did not
    // opt into withIndependentCandidateEvaluation. Snapshot the data envelope before
    // any further runtime calls; retain only the generator/evaluator functions as
    // explicit capabilities. Fail closed rather than stage evidence we cannot detach.
    let proposal: typeof prepared.proposal;
    let baseline: typeof prepared.baseline;
    let candidateEvaluation: typeof prepared.candidateEvaluation;
    let options: typeof prepared.options;
    try {
      proposal = structuredClone(prepared.proposal);
      baseline = structuredClone(prepared.baseline);
      candidateEvaluation = structuredClone(prepared.candidateEvaluation);
      options = prepared.options === undefined ? undefined : structuredClone(prepared.options);
    } catch {
      throw new Error('compound-repair-revision-provider-data-not-cloneable');
    }
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
