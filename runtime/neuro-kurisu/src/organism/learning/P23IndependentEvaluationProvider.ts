import type { CompoundRepairRevisionInputProvider } from './P23CompoundRepairRevisionCoordinator.ts';
import { createIndependentSkillCandidateEvaluator, type IndependentCandidateEvaluationConfig } from './IndependentSkillCandidateEvaluator.ts';

type PreparedRevision = Awaited<ReturnType<CompoundRepairRevisionInputProvider>>;

/**
 * Runs the host-owned evaluator on the canonical baseline and source candidate,
 * then returns the same independent evaluator for the newly generated payload.
 * Native-provider payload identity is revalidated across each asynchronous boundary.
 * A host-provided evaluator is the only authority; provider-reported scores are ignored.
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
    const configInput = structuredClone(input);
    const providerInput = structuredClone(input);
    const prepared = await provider(providerInput);
    if (!prepared || typeof prepared.generate !== 'function' ||
        typeof prepared.evaluateRevisedCandidate !== 'function') {
      throw new Error('independent-candidate-evaluation-provider-output-invalid');
    }

    let proposal: PreparedRevision['proposal'];
    let baseline: PreparedRevision['baseline'];
    let candidateEvaluation: PreparedRevision['candidateEvaluation'];
    let options: PreparedRevision['options'];
    let baselinePayload: unknown;
    let sourceCandidatePayload: unknown;
    try {
      proposal = structuredClone(prepared.proposal);
      baseline = structuredClone(prepared.baseline);
      candidateEvaluation = structuredClone(prepared.candidateEvaluation);
      options = prepared.options === undefined ? undefined : structuredClone(prepared.options);
      baselinePayload = prepared.baselinePayload === undefined ? undefined : structuredClone(prepared.baselinePayload);
      sourceCandidatePayload = prepared.sourceCandidatePayload === undefined ? undefined : structuredClone(prepared.sourceCandidatePayload);
    } catch {
      throw new Error('independent-candidate-evaluation-provider-data-not-cloneable');
    }
    if (typeof prepared.sourceCandidateId !== 'string' || !prepared.sourceCandidateId.trim()) {
      throw new Error('independent-candidate-evaluation-provider-source-candidate-invalid');
    }
    const hasBaselinePayload = Object.prototype.hasOwnProperty.call(prepared, 'baselinePayload');
    const hasSourcePayload = Object.prototype.hasOwnProperty.call(prepared, 'sourceCandidatePayload');
    const hasNativePayloadBoundary = hasBaselinePayload || hasSourcePayload ||
      Object.prototype.hasOwnProperty.call(prepared, 'baselinePayloadFingerprint') ||
      Object.prototype.hasOwnProperty.call(prepared, 'sourceCandidatePayloadFingerprint') ||
      typeof prepared.assertCanonicalLineageCurrent === 'function';
    if (hasNativePayloadBoundary && (!hasBaselinePayload || !hasSourcePayload ||
        typeof prepared.baselinePayloadFingerprint !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(prepared.baselinePayloadFingerprint) ||
        typeof prepared.sourceCandidatePayloadFingerprint !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(prepared.sourceCandidatePayloadFingerprint) ||
        typeof prepared.assertCanonicalLineageCurrent !== 'function')) {
      throw new Error('native-p23-revision-canonical-payload-boundary-incomplete');
    }
    const assertCurrent = async (): Promise<void> => {
      await prepared.assertCanonicalLineageCurrent?.();
    };

    const config = evaluationConfigForRepair(configInput);
    if (!config || typeof config !== 'object') {
      throw new Error('independent-candidate-evaluation-config-invalid');
    }
    if (process.env.NODE_ENV === 'production' && !config.experimentAuthority) {
      throw new Error('production-independent-evaluation-experiment-authority-required');
    }

    const revisionEvaluator = createIndependentSkillCandidateEvaluator(config);
    if (hasNativePayloadBoundary) {
      const authority = config.experimentAuthority;
      const baselineMethod = config.baselineMethod;
      const sourceMethod = config.sourceCandidateMethod;
      const revisionMethod = authority?.method;
      const methods = [baselineMethod, sourceMethod, revisionMethod];
      if (!authority || methods.some(method => typeof method !== 'string' || !method.trim()) ||
          new Set(methods).size !== methods.length) {
        throw new Error('native-p23-revision-requires-three-distinct-host-owned-methods');
      }
      for (const plan of [authority.validationPlan, authority.holdoutPlan]) {
        const scheduled = new Set(plan.arms.map(arm => arm.method));
        if (methods.some(method => !scheduled.has(method!))) {
          throw new Error('native-p23-revision-method-not-scheduled-in-both-splits');
        }
      }

      const evaluateMethod = (method: string) => createIndependentSkillCandidateEvaluator({
        ...config,
        experimentAuthority: { ...authority, method },
      });
      await assertCurrent();
      const evaluationPlaceholder = { validation: [], holdout: [] };
      // RevisedCandidateEvaluator keeps the same request shape for every arm. The host
      // evaluator reads only payload and payloadFingerprint, then builds fresh reports.
      const baselineResult = await evaluateMethod(baselineMethod!)({
        payload: baselinePayload,
        payloadFingerprint: prepared.baselinePayloadFingerprint!,
        baseline: evaluationPlaceholder,
        previousEvaluation: evaluationPlaceholder,
      });
      await assertCurrent();
      const sourceResult = await evaluateMethod(sourceMethod!)({
        payload: sourceCandidatePayload,
        payloadFingerprint: prepared.sourceCandidatePayloadFingerprint!,
        baseline: evaluationPlaceholder,
        previousEvaluation: evaluationPlaceholder,
      });
      await assertCurrent();
      if (!baselineResult?.evaluation || !Array.isArray(baselineResult.evaluation.validation) ||
          !Array.isArray(baselineResult.evaluation.holdout) ||
          !sourceResult?.evaluation || !Array.isArray(sourceResult.evaluation.validation) ||
          !Array.isArray(sourceResult.evaluation.holdout)) {
        throw new Error('native-p23-revision-baseline-and-source-independent-reports-required');
      }
      baseline = structuredClone(baselineResult.evaluation);
      candidateEvaluation = structuredClone(sourceResult.evaluation);
    }

    const generate = async (request: Parameters<PreparedRevision['generate']>[0]) => {
      await assertCurrent();
      const candidate = await prepared.generate(request);
      await assertCurrent();
      return candidate;
    };
    const evaluateRevisedCandidate: PreparedRevision['evaluateRevisedCandidate'] = async request => {
      await assertCurrent();
      const result = await revisionEvaluator(request);
      await assertCurrent();
      return result;
    };
    return {
      proposal,
      sourceCandidateId: prepared.sourceCandidateId,
      baseline,
      candidateEvaluation,
      generate,
      evaluateRevisedCandidate,
      ...(options === undefined ? {} : { options }),
    };
  };
}
