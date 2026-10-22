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
}

export type CompoundRepairRevisionInputProvider = (
  input: {
    skillId: string;
    repairFingerprints: string[];
    repairEvidence: ReturnType<OrganismRuntime['compoundSkillRepairEvidence']>;
  },
) => Promise<CompoundRepairRevisionInputs>;

/**
 * Orchestrates a real runtime repair observation into P23's existing revision lifecycle.
 *
 * The provider must obtain the authentic proposal and independently generated baseline /
 * candidate reports from the existing trusted evaluation pipeline. This class deliberately
 * does not synthesize either evidence or generator output. P23 remains responsible for
 * validating the proposal, reports, candidate source, fitness and staging gate.
 */
export class P23CompoundRepairRevisionCoordinator {
  constructor(
    private readonly runtime: OrganismRuntime,
    private readonly engine: P23LearningEngine,
    private readonly provideInputs: CompoundRepairRevisionInputProvider,
  ) {}

  async reviseFromObservedRepairs(skillId: string) {
    if (typeof skillId !== 'string' || skillId.trim().length === 0) {
      throw new Error('compound skill id is required');
    }
    const repairEvidence = this.runtime.compoundSkillRepairEvidence(skillId)
      .filter(row => row.revisionEligible);
    if (repairEvidence.length === 0) {
      return { status: 'no-eligible-repair-evidence' as const, skillId, repairEvidenceCount: 0 };
    }

    const evidenceDigest = (rows: typeof repairEvidence) => createHash('sha256')
      .update(JSON.stringify(rows))
      .digest('hex');
    const initialEvidenceDigest = evidenceDigest(repairEvidence);
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
    if (evidenceDigest(currentEvidence) !== initialEvidenceDigest) {
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
