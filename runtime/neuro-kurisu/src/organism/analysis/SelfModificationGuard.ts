/**
 * Decides whether a proposed self-modification is safe to even consider.
 *
 * The organism can propose changes to itself (skills, policies, code). Before any
 * such candidate reaches an evaluator, this guard answers a narrower and more
 * important question: does the change touch the machinery that decides whether the
 * change is good? A candidate that edits its own evaluator, approval authority,
 * holdout data or safety gate can manufacture its own success, so it must be
 * refused regardless of how it scores.
 *
 * Protected files are identified structurally from the source graph (paths that
 * contain the evaluator/gate/holdout/approval owners), not from a hand-maintained
 * allowlist that drifts. The guard fails closed: an unparseable or empty proposal
 * is refused, and a protected file is refused even when every other signal is
 * favourable.
 */

import type { SourceGraph } from './SourceGraph.ts';
import { impactOf } from './SourceGraph.ts';

export interface ModificationProposal {
  candidateId: string;
  /** Repo-relative paths the candidate intends to write. */
  targetFiles: string[];
  /** Optional declared intent, used only for reporting, never for authorization. */
  rationale?: string;
}

export type GuardDecision = 'allowed' | 'refused';

export interface GuardRefusal {
  reason: string;
  files: string[];
}

export interface GuardResult {
  decision: GuardDecision;
  candidateId: string;
  protectedHits: string[];
  refusals: GuardRefusal[];
  /** Files whose dependents are touched, for reviewer awareness only. */
  impacted: string[];
}

/**
 * Capability owners whose modification would let a candidate influence its own
 * evaluation, approval, provenance or safety. Matched as path fragments.
 */
export const PROTECTED_CAPABILITY_FRAGMENTS: readonly string[] = [
  'VerifiedOutcomePromotionGate',
  'IndependentSkillCandidateEvaluator',
  'AuthenticatedSkillPromotionApproval',
  'SkillLearnBenchAdapter',
  'VerifiedOutcomeLedger',
  'TrustedSkillShadowRunRegistry',
  'TrustedShadowLearningRunCoordinator',
  'P23LearningEngine',
  'LearningFitnessJournal',
  'LearningLifecycleJournal',
  'HostOwnedIndependentEvaluationServices',
  'P36HostEvaluatorBootstrap',
  'P36VerifiedOutcomeLedgerEvaluator',
  'ActionGateway',
  'ApiSecurityPolicy',
  'P69ConstitutionalArbiter',
  'IdentityContinuityGuard',
  'P60IdentityGuardian',
  'RealityLearningGate',
  // The complete self-improvement trust boundary is immutable to its own candidates.
  // Protecting only the outer guard leaves the scorer/pool/authority editable.
  'SelfModificationGuard',
  'ProxyDivergenceGuard',
  'SelfImprovementCandidatePool',
  // Receipt parsing and cryptographic trust verification must not be editable
  // by the same candidate whose patch is being verified.
  'PatchReceiptGuard',
  'HostOwnedPatchReceiptTrust',
  // P36's patch-bound signed holdout authority is part of the verifier trust root.
  'P36PatchOutcomeEvidenceAuthority',
  'DangerModel',
  'CanonicalSelfAgencyAuthority',
  // Identity canon and the orchestration entrypoints must not be editable by
  // the same mechanism they govern.
  'KurisuCanonProfile',
  'OrganismCore',
  'OrganismRuntime',
  'self-analysis-substrate',
  'canonical-self-agency-authority',
  // Build/test configuration and the progress/evidence machinery are part of the
  // evaluator trust boundary: changing them can erase checks or counterfeit scores.
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.nvmrc',
  'tsconfig',
  'vitest.config',
  'jest.config',
  'playwright.config',
  'progress-workstreams.json',
  'progress-report.mjs',
  'run-local-gate.mjs',
  'SourceGraph',
  'holdout',
];

/** Path fragments that must never be written by an automated self-modification. */
export const FORBIDDEN_PATH_FRAGMENTS: readonly string[] = [
  '/.github/workflows/',
  '/contracts/RELEASE_LICENSE_REVIEW',
  '/tools/audit-release-license-readiness',
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownData(value: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

export function findProtectedFiles(graph: SourceGraph): string[] {
  const hits = new Set<string>();
  for (const file of graph.files) {
    for (const fragment of PROTECTED_CAPABILITY_FRAGMENTS) {
      if (file.includes(fragment)) hits.add(file);
    }
  }
  return [...hits].sort();
}

export function evaluateModification(proposal: ModificationProposal, graph: SourceGraph): GuardResult {
  const refusals: GuardRefusal[] = [];
  const proposalRecord = isPlainRecord(proposal) ? proposal : null;
  const candidateValue = proposalRecord ? ownData(proposalRecord, 'candidateId') : undefined;
  const candidateId = typeof candidateValue === 'string' ? candidateValue.trim() : '';
  if (!candidateId || candidateId.length > 128) {
    refusals.push({ reason: 'candidate-id-missing-or-invalid', files: [] });
  }

  const rawTargets = proposalRecord ? ownData(proposalRecord, 'targetFiles') : undefined;
  const targets: string[] = [];
  let malformedTargets = 0;
  try {
    if (!Array.isArray(rawTargets)) {
      malformedTargets += 1;
    } else {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(rawTargets, 'length');
      const length = lengthDescriptor && 'value' in lengthDescriptor ? lengthDescriptor.value : Number.NaN;
      if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 256) {
        malformedTargets += 1;
      } else {
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(rawTargets, String(index));
          const target = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
            ? descriptor.value
            : undefined;
          if (typeof target !== 'string' || !target.trim() || target.length > 512) {
            malformedTargets += 1;
            continue;
          }
          targets.push(target);
        }
      }
    }
  } catch {
    malformedTargets += 1;
  }
  if (malformedTargets > 0) {
    refusals.push({ reason: 'malformed-target-files', files: [] });
  }
  if (targets.length === 0) {
    refusals.push({ reason: 'no-valid-target-files', files: [] });
  }

  const protectedHits: string[] = [];
  for (const target of targets) {
    const normalized = target.startsWith('/') ? target : `/${target}`;
    for (const fragment of PROTECTED_CAPABILITY_FRAGMENTS) {
      if (target.includes(fragment)) {
        protectedHits.push(target);
        refusals.push({ reason: `protected-capability:${fragment}`, files: [target] });
      }
    }
    for (const fragment of FORBIDDEN_PATH_FRAGMENTS) {
      if (normalized.includes(fragment)) {
        refusals.push({ reason: `forbidden-path:${fragment}`, files: [target] });
      }
    }
    if (!graph.files.includes(target)) {
      refusals.push({ reason: 'target-not-in-source-graph', files: [target] });
    }
  }

  const impacted = new Set<string>();
  for (const target of targets) {
    for (const dependent of impactOf(graph, `${target}#__module__`)) {
      const file = dependent.split('#')[0];
      if (file) impacted.add(file);
    }
  }

  return {
    decision: refusals.length === 0 ? 'allowed' : 'refused',
    candidateId,
    protectedHits: [...new Set(protectedHits)].sort(),
    refusals,
    impacted: [...impacted].sort(),
  };
}
