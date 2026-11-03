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
  'CanonicalSelfAgencyAuthority',
  'self-analysis-substrate',
  'canonical-self-agency-authority',
  'SourceGraph',
  'holdout',
];

/** Path fragments that must never be written by an automated self-modification. */
export const FORBIDDEN_PATH_FRAGMENTS: readonly string[] = [
  '/.github/workflows/',
  '/contracts/RELEASE_LICENSE_REVIEW',
  '/tools/audit-release-license-readiness',
];

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
  const candidateId = String(proposal?.candidateId ?? '');
  const targets = Array.isArray(proposal?.targetFiles) ? proposal.targetFiles.filter((f) => typeof f === 'string') : [];

  if (!candidateId) {
    refusals.push({ reason: 'candidate-id-missing', files: [] });
  }
  if (targets.length === 0) {
    refusals.push({ reason: 'no-target-files', files: [] });
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
