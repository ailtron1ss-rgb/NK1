import type { OrganismRuntime } from '../core/OrganismRuntime.ts';
import type { P23LearningEngine } from './P23LearningEngine.ts';

type RevisionArgs = Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>;
type Proposal = RevisionArgs[0];
type Baseline = RevisionArgs[3];
type CandidateEvaluation = RevisionArgs[4];
type Generator = RevisionArgs[5];
type Options = RevisionArgs[6];

export interface CompoundRepairRevisionInputs {
  proposal: Proposal;
  sourceCandidateId: string;
  baseline: Baseline;
  candidateEvaluation: CandidateEvaluation;
  generate: Generator;
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
        typeof prepared.generate !== 'function') {
      throw new Error('trusted revision input provider returned incomplete proposal/evaluation/generator inputs');
    }

    // The provider may perform asynchronous work. Re-read the runtime ledger before
    // staging so the proposal/evaluation cannot silently drift away from the repairs
    // that justified this revision. Runtime entry is queue-serialized; a changed
    // evidence set is a stale-input failure, never a reason to stage a candidate.
    const currentEvidence = this.runtime.compoundSkillRepairEvidence(skillId)
      .filter(row => row.revisionEligible);
    const currentFingerprints = [...new Set(currentEvidence.map(row => row.failureFingerprint))].sort();
    const preparedFingerprints = [...fingerprints].sort();
    if (currentEvidence.length !== repairEvidence.length ||
        currentFingerprints.length !== preparedFingerprints.length ||
        currentFingerprints.some((fingerprint, index) => fingerprint !== preparedFingerprints[index])) {
      throw new Error('compound repair evidence changed while trusted revision inputs were being prepared; retry with a fresh evaluation');
    }

    const result = await this.runtime.generateCompoundSkillRevision({
      engine: this.engine,
      proposal: prepared.proposal,
      skillId,
      sourceCandidateId: prepared.sourceCandidateId,
      baseline: prepared.baseline,
      candidateEvaluation: prepared.candidateEvaluation,
      generate: prepared.generate,
      ...(prepared.options ? { options: prepared.options } : {}),
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
