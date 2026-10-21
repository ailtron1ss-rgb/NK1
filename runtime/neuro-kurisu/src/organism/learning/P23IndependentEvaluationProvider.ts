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
    const prepared = await provider(input);
    const config = evaluationConfigForRepair(structuredClone(input));
    return {
      ...prepared,
      evaluateRevisedCandidate: createIndependentSkillCandidateEvaluator(config),
    };
  };
}
