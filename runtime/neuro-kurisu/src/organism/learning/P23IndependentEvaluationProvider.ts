import { createHash } from 'node:crypto';
import type { CompoundRepairRevisionInputProvider } from './P23CompoundRepairRevisionCoordinator.ts';
import {
  createIndependentSkillCandidateEvaluator,
  type IndependentCandidateEvaluationConfig,
} from './IndependentSkillCandidateEvaluator.ts';
import type { SkillLearnBenchTrialReport } from './SkillLearnBenchAdapter.ts';
import { isAuthenticVerifiedSkillPromotionProposal, snapshotAuthenticVerifiedSkillPromotionProposal } from './VerifiedSkillPromotion.ts';

type ProviderInput = Parameters<CompoundRepairRevisionInputProvider>[0];
type PreparedProviderInputs = Awaited<ReturnType<CompoundRepairRevisionInputProvider>>;
type RevisionReports = {
  validation: SkillLearnBenchTrialReport[];
  holdout: SkillLearnBenchTrialReport[];
};
type TrustedEvaluationEnvelope = {
  payloadFingerprint: string;
  evaluationFingerprint: string;
  evaluation: RevisionReports & {
    provenance: {
      schemaVersion: 1;
      payloadFingerprint: string;
      environmentFingerprint: string;
      planFingerprint: string;
      experimentAuthority: null | {
        manifestFingerprint: string;
        validationPlanFingerprint: string;
        holdoutPlanFingerprint: string;
        method: string;
        attempt: number;
      };
      runBindings: Array<{
        taskId: string;
        trialId: string;
        runId: string | null;
        plannedRunId: string | null;
        seed: number;
        split: 'validation' | 'holdout';
        bindingVerified: boolean;
        verifierPassed: boolean;
        safetyViolationCount: number;
      }>;
    };
  };
};

type RevisionEvaluationConfig = IndependentCandidateEvaluationConfig & {
  /** Manifest-declared method used to freshly evaluate the active baseline payload. */
  baselineMethod?: string;
  /** Manifest-declared method used to freshly evaluate the staged source candidate payload. */
  sourceCandidateMethod?: string;
};

export interface CanonicalRevisionPayloads {
  baselinePayload: unknown;
  sourceCandidatePayload: unknown;
  baselinePayloadFingerprint?: string;
  sourceCandidatePayloadFingerprint?: string;
  /** Re-check version/payload identity immediately before returning the revised evaluation. */
  assertStillCurrent?: () => void;
}

export interface IndependentCandidateEvaluationProviderOptions {
  /** Must resolve payloads from the canonical versioned P23 store, never from provider output. */
  resolveCanonicalPayloads?: (
    input: ProviderInput,
    prepared: Pick<PreparedProviderInputs, 'sourceCandidateId'>,
  ) => CanonicalRevisionPayloads | Promise<CanonicalRevisionPayloads>;
  /** Production must regenerate baseline and source-candidate reports from canonical stored payloads. */
  requireCanonicalSourceEvaluation?: boolean;
}

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('revision-evidence-non-finite-number');
  }
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('revision-evidence-not-json-serializable');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('revision-evidence-circular-value');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error('revision-evidence-non-plain-object');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return '[' + value.map(item => canonical(item, ancestors)).join(',') + ']';
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(record[key], ancestors)).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

function payloadFingerprint(payload: unknown): string {
  return digest(canonical(payload));
}

function reportsOnly(evaluation: TrustedEvaluationEnvelope['evaluation']): RevisionReports {
  return {
    validation: structuredClone(evaluation.validation),
    holdout: structuredClone(evaluation.holdout),
  };
}

function validateMatchedRevisionEvaluations(
  baseline: TrustedEvaluationEnvelope,
  candidate: TrustedEvaluationEnvelope,
  label: string,
): void {
  const checkEnvelope = (value: TrustedEvaluationEnvelope, side: string) => {
    const evaluation = value?.evaluation;
    const provenance = evaluation?.provenance;
    if (!value || !/^[a-f0-9]{64}$/i.test(value.payloadFingerprint) ||
        !/^[a-f0-9]{64}$/i.test(value.evaluationFingerprint) ||
        !evaluation || !provenance ||
        provenance.payloadFingerprint !== value.payloadFingerprint ||
        value.evaluationFingerprint !== digest(canonical(evaluation)) ||
        !/^[a-f0-9]{64}$/i.test(provenance.environmentFingerprint) ||
        !/^[a-f0-9]{64}$/i.test(provenance.planFingerprint) ||
        !Array.isArray(evaluation.validation) || !Array.isArray(evaluation.holdout) ||
        !Array.isArray(provenance.runBindings)) {
      throw new Error('canonical-revision-evaluation-' + side + '-envelope-invalid');
    }
  };
  checkEnvelope(baseline, 'baseline');
  checkEnvelope(candidate, 'candidate');

  const left = baseline.evaluation.provenance;
  const right = candidate.evaluation.provenance;
  const leftAuthority = left.experimentAuthority;
  const rightAuthority = right.experimentAuthority;
  if (left.environmentFingerprint !== right.environmentFingerprint ||
      left.planFingerprint !== right.planFingerprint ||
      !leftAuthority || !rightAuthority ||
      leftAuthority.method === rightAuthority.method ||
      leftAuthority.manifestFingerprint !== rightAuthority.manifestFingerprint ||
      leftAuthority.validationPlanFingerprint !== rightAuthority.validationPlanFingerprint ||
      leftAuthority.holdoutPlanFingerprint !== rightAuthority.holdoutPlanFingerprint ||
      leftAuthority.attempt !== rightAuthority.attempt) {
    throw new Error('canonical-revision-evaluation-' + label + '-plan-environment-or-method-mismatch');
  }

  const index = (value: TrustedEvaluationEnvelope, side: string) => {
    const keys = new Map<string, 'validation' | 'holdout'>();
    const reports = [
      ...value.evaluation.validation.map(report => ({ report, split: 'validation' as const })),
      ...value.evaluation.holdout.map(report => ({ report, split: 'holdout' as const })),
    ];
    if (value.evaluation.validation.length === 0 || value.evaluation.holdout.length === 0) {
      throw new Error('canonical-revision-evaluation-' + side + '-split-empty');
    }
    for (const { report, split } of reports) {
      if (!report || typeof report.taskId !== 'string' || !report.taskId.trim() ||
          typeof report.trialId !== 'string' || !report.trialId.trim()) {
        throw new Error('canonical-revision-evaluation-' + side + '-report-identity-invalid');
      }
      const key = JSON.stringify([report.taskId, report.trialId]);
      if (keys.has(key)) throw new Error('canonical-revision-evaluation-' + side + '-duplicate-report');
      keys.set(key, split);
    }
    if (keys.size !== value.evaluation.provenance.runBindings.length) {
      throw new Error('canonical-revision-evaluation-' + side + '-binding-coverage-mismatch');
    }
    const bindings = new Map<string, TrustedEvaluationEnvelope['evaluation']['provenance']['runBindings'][number]>();
    for (const binding of value.evaluation.provenance.runBindings) {
      if (!binding || typeof binding.taskId !== 'string' || !binding.taskId.trim() ||
          typeof binding.trialId !== 'string' || !binding.trialId.trim() ||
          !['validation', 'holdout'].includes(binding.split) ||
          !Number.isSafeInteger(binding.seed) || binding.seed < 0 ||
          typeof binding.bindingVerified !== 'boolean' ||
          typeof binding.verifierPassed !== 'boolean' ||
          (binding.runId !== null && (typeof binding.runId !== 'string' || !binding.runId.trim())) ||
          (binding.bindingVerified && !binding.runId) ||
          (!binding.bindingVerified && binding.runId !== null) ||
          !Number.isSafeInteger(binding.safetyViolationCount) || binding.safetyViolationCount < 0) {
        throw new Error('canonical-revision-evaluation-' + side + '-binding-invalid');
      }
      const key = JSON.stringify([binding.taskId, binding.trialId]);
      if (bindings.has(key) || !keys.has(key) || keys.get(key) !== binding.split) {
        throw new Error('canonical-revision-evaluation-' + side + '-binding-duplicate-or-orphan');
      }
      bindings.set(key, binding);
    }
    return bindings;
  };

  const leftBindings = index(baseline, 'baseline');
  const rightBindings = index(candidate, 'candidate');
  if (leftBindings.size !== rightBindings.size || leftBindings.size === 0) {
    throw new Error('canonical-revision-evaluation-' + label + '-matched-trial-count-mismatch');
  }
  for (const [key, leftBinding] of leftBindings) {
    const rightBinding = rightBindings.get(key);
    if (!rightBinding || leftBinding.taskId !== rightBinding.taskId ||
        leftBinding.trialId !== rightBinding.trialId ||
        leftBinding.seed !== rightBinding.seed ||
        leftBinding.split !== rightBinding.split) {
      throw new Error('canonical-revision-evaluation-' + label + '-task-seed-split-mismatch');
    }
  }
}

function evaluatorConfigForMethod(
  config: RevisionEvaluationConfig,
  method: string,
): IndependentCandidateEvaluationConfig {
  const authority = config.experimentAuthority;
  if (!authority) throw new Error('production-independent-evaluation-experiment-authority-required');
  return {
    ...config,
    experimentAuthority: { ...authority, method },
  };
}

function validateRevisionMethods(config: RevisionEvaluationConfig): asserts config is RevisionEvaluationConfig & {
  baselineMethod: string;
  sourceCandidateMethod: string;
  experimentAuthority: NonNullable<IndependentCandidateEvaluationConfig['experimentAuthority']>;
} {
  const authority = config.experimentAuthority;
  const methods = [config.baselineMethod, config.sourceCandidateMethod, authority?.method];
  if (!authority || methods.some(method => typeof method !== 'string' || !method.trim()) ||
      new Set(methods).size !== methods.length) {
    throw new Error('production-independent-evaluation-baseline-source-revision-methods-required-and-distinct');
  }
  for (const plan of [authority.validationPlan, authority.holdoutPlan]) {
    const scheduled = new Set(plan.arms.map(arm => arm.method));
    if (methods.some(method => !scheduled.has(method as string))) {
      throw new Error('production-independent-evaluation-revision-method-not-in-experiment-plan');
    }
  }
}

/**
 * Keep proposal generation in the configured repair provider, but route evaluation
 * through host-owned executor/verifier/safety authorities.
 *
 * In production, baseline and source-candidate reports are regenerated from the
 * canonical active/source payloads returned by the trusted P23 store resolver.
 * The provider's supplied report objects and evaluator are ignored. The active
 * baseline and source candidate must share fixed task IDs, trial IDs, seeds,
 * split boundaries, manifest, plans and environment with the generated candidate.
 *
 * Development-only compatibility can retain provider-supplied reports when the
 * caller has not opted into canonical source evaluation. Production cannot.
 */
export function withIndependentCandidateEvaluation(
  provider: CompoundRepairRevisionInputProvider,
  evaluationConfigForRepair: (input: ProviderInput) => IndependentCandidateEvaluationConfig,
  options: IndependentCandidateEvaluationProviderOptions = {},
): CompoundRepairRevisionInputProvider {
  if (typeof provider !== 'function' || typeof evaluationConfigForRepair !== 'function') {
    throw new Error('independent-candidate-evaluation-provider-config-invalid');
  }
  const requireCanonical = options.requireCanonicalSourceEvaluation ?? process.env.NODE_ENV === 'production';
  if (requireCanonical && typeof options.resolveCanonicalPayloads !== 'function') {
    throw new Error('production-independent-evaluation-canonical-source-resolver-required');
  }

  return async input => {
    // Freeze the runtime-owned repair context before the provider can mutate its copy.
    const configInput = structuredClone(input);
    const providerInput = structuredClone(input);
    const prepared = await provider(providerInput);
    if (!prepared || typeof prepared.generate !== 'function') {
      throw new Error('independent-candidate-evaluation-provider-output-invalid');
    }
    if (typeof prepared.sourceCandidateId !== 'string' || !prepared.sourceCandidateId.trim()) {
      throw new Error('independent-candidate-evaluation-provider-source-candidate-invalid');
    }

    // Preserve security-failure semantics: an unauthentic production proposal is
    // rejected explicitly and must not be mislabeled as a cloning/serialization error.
    if (process.env.NODE_ENV === 'production' && !isAuthenticVerifiedSkillPromotionProposal(prepared.proposal)) {
      throw new Error('production-independent-evaluation-authentic-proposal-required');
    }
    let proposal: typeof prepared.proposal;
    let optionsSnapshot: typeof prepared.options;
    try {
      proposal = isAuthenticVerifiedSkillPromotionProposal(prepared.proposal)
        ? snapshotAuthenticVerifiedSkillPromotionProposal(prepared.proposal)
        : structuredClone(prepared.proposal);
      optionsSnapshot = prepared.options === undefined ? undefined : structuredClone(prepared.options);
    } catch {
      throw new Error('independent-candidate-evaluation-provider-data-not-cloneable');
    }
    if (!proposal) throw new Error('independent-candidate-evaluation-provider-proposal-required');

    const config = evaluationConfigForRepair(configInput) as RevisionEvaluationConfig;
    if (process.env.NODE_ENV === 'production' && !config?.experimentAuthority) {
      throw new Error('production-independent-evaluation-experiment-authority-required');
    }
    const canonicalInputsAvailable =
      typeof options.resolveCanonicalPayloads === 'function' &&
      typeof config.baselineMethod === 'string' && typeof config.sourceCandidateMethod === 'string';

    if (requireCanonical && !canonicalInputsAvailable) {
      throw new Error('production-independent-evaluation-canonical-baseline-and-source-methods-required');
    }

    if (!canonicalInputsAvailable) {
      // Development compatibility only. Production requires canonical payloads from
      // the verified P23 store and never relies on provider-supplied baseline reports.
      if (!prepared.baseline || !prepared.candidateEvaluation) {
        throw new Error('independent-candidate-evaluation-provider-baseline-and-source-reports-required');
      }
      const baseline = structuredClone(prepared.baseline);
      const candidateEvaluation = structuredClone(prepared.candidateEvaluation);
      return {
        proposal,
        sourceCandidateId: prepared.sourceCandidateId,
        baseline,
        candidateEvaluation,
        generate: prepared.generate,
        evaluateRevisedCandidate: createIndependentSkillCandidateEvaluator(config),
        ...(optionsSnapshot === undefined ? {} : { options: optionsSnapshot }),
      };
    }

    validateRevisionMethods(config);
    const canonicalPayloads = await options.resolveCanonicalPayloads!(
      configInput,
      { sourceCandidateId: prepared.sourceCandidateId },
    );
    let baselinePayload: unknown;
    let sourceCandidatePayload: unknown;
    try {
      baselinePayload = structuredClone(canonicalPayloads.baselinePayload);
      sourceCandidatePayload = structuredClone(canonicalPayloads.sourceCandidatePayload);
    } catch {
      throw new Error('canonical-revision-source-payload-not-cloneable');
    }
    const baselineFingerprint = payloadFingerprint(baselinePayload);
    const sourceFingerprint = payloadFingerprint(sourceCandidatePayload);
    if (canonicalPayloads.baselinePayloadFingerprint !== undefined &&
        canonicalPayloads.baselinePayloadFingerprint !== baselineFingerprint) {
      throw new Error('canonical-revision-baseline-payload-fingerprint-mismatch');
    }
    if (canonicalPayloads.sourceCandidatePayloadFingerprint !== undefined &&
        canonicalPayloads.sourceCandidatePayloadFingerprint !== sourceFingerprint) {
      throw new Error('canonical-revision-source-payload-fingerprint-mismatch');
    }

    const emptyReports = { validation: [], holdout: [] };
    const evaluatePayload = async (method: string, payload: unknown): Promise<TrustedEvaluationEnvelope> => {
      const evaluator = createIndependentSkillCandidateEvaluator(evaluatorConfigForMethod(config, method));
      const envelope = await evaluator({
        payload: structuredClone(payload),
        payloadFingerprint: payloadFingerprint(payload),
        baseline: structuredClone(emptyReports),
        previousEvaluation: structuredClone(emptyReports),
      });
      return envelope as unknown as TrustedEvaluationEnvelope;
    };

    const baselineEnvelope = await evaluatePayload(config.baselineMethod!, baselinePayload);
    const sourceEnvelope = await evaluatePayload(config.sourceCandidateMethod!, sourceCandidatePayload);
    validateMatchedRevisionEvaluations(baselineEnvelope, sourceEnvelope, 'active-versus-source');
    await canonicalPayloads.assertStillCurrent?.();

    const revisionEvaluator = createIndependentSkillCandidateEvaluator(config);
    const evaluateRevisedCandidate = async (request: Parameters<typeof revisionEvaluator>[0]) => {
      const envelope = await revisionEvaluator(request) as unknown as TrustedEvaluationEnvelope;
      validateMatchedRevisionEvaluations(baselineEnvelope, envelope, 'active-versus-revision');
      validateMatchedRevisionEvaluations(sourceEnvelope, envelope, 'source-versus-revision');
      await canonicalPayloads.assertStillCurrent?.();
      return envelope as unknown as Awaited<ReturnType<typeof revisionEvaluator>>;
    };

    // Baseline/source reports are generated by the independent evaluator against
    // canonical stored payloads. Reports returned by the repair provider are ignored.
    return {
      proposal,
      sourceCandidateId: prepared.sourceCandidateId,
      baseline: reportsOnly(baselineEnvelope.evaluation),
      candidateEvaluation: reportsOnly(sourceEnvelope.evaluation),
      generate: prepared.generate,
      evaluateRevisedCandidate,
      ...(canonicalPayloads.assertStillCurrent ? { assertCanonicalLineageCurrent: canonicalPayloads.assertStillCurrent } : {}),
      ...(optionsSnapshot === undefined ? {} : { options: optionsSnapshot }),
    };
  };
}
