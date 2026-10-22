import type { CompoundRepairRevisionInputProvider } from './P23CompoundRepairRevisionCoordinator.ts';
import { createIndependentSkillCandidateEvaluator, type IndependentCandidateEvaluationConfig } from './IndependentSkillCandidateEvaluator.ts';

/**
 * Wraps the trusted repair-input provider and replaces its evaluator with one
 * that executes the exact generated payload through independent runtime authorities.
 * Proposal, source candidate, baseline and generator remain owned by the trusted
 * provider; caller-supplied candidate evaluation is never used.
 */
export function withIndependentCandidateEvaluation(
  provider: CompoundRepairRevisionInputProvider,
  evaluationConfigForRepair: (
    input: Parameters<CompoundRepairRevisionInputProvider>[0],
  ) => IndependentCandidateEvaluationConfig,
): CompoundRepairRevisionInputProvider {
  if (typeof provider !== 'function' || typeof evaluationConfigForRepair !== 'function') {
    throw new Error('independent-candidate-evaluation-provider-config-invalid');
  }
  return async input => {
    // Keep the evaluator's authority inputs independent from provider code. A
    // provider is allowed to prepare proposals, but it must not be able to mutate
    // the repair evidence/fingerprints later used to choose trusted task plans.
    const configInput = structuredClone(input);
    const providerInput = structuredClone(input);
    const prepared = await provider(providerInput);
    if (!prepared || typeof prepared.generate !== 'function' ||
        typeof prepared.evaluateRevisedCandidate !== 'function') {
      throw new Error('independent-candidate-evaluation-provider-output-invalid');
    }

    // Detach every data-bearing field before handing control to another async
    // authority. The provider may retain references to its returned proposal or
    // baseline and mutate them later; those objects feed the existing P23 gate.
    // Functions are intentionally retained as capabilities, not cloned as data.
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
      throw new Error('independent-candidate-evaluation-provider-data-not-cloneable');
    }
    if (typeof prepared.sourceCandidateId !== 'string' || !prepared.sourceCandidateId.trim()) {
      throw new Error('independent-candidate-evaluation-provider-source-candidate-invalid');
    }

    const config = evaluationConfigForRepair(configInput);
    // In production, a factory's existence alone is not sufficient: require the
    // canonical manifest + validation/holdout plans + verified-outcome ledger so
    // evaluation evidence is bound to scheduled runs before P23 can stage a revision.
    if (process.env.NODE_ENV === 'production' && !config?.experimentAuthority) {
      throw new Error('production-independent-evaluation-experiment-authority-required');
    }
    return {
      proposal,
      sourceCandidateId: prepared.sourceCandidateId,
      baseline,
      candidateEvaluation,
      generate: prepared.generate,
      evaluateRevisedCandidate: createIndependentSkillCandidateEvaluator(config),
      ...(options === undefined ? {} : { options }),
    };
  };
}
