/**
 * Protected-artifact guard for the self-improvement contour.
 *
 * NK1 may propose and stage changes to its own behaviour, but it must never be
 * able to edit the mechanisms that judge it or the data those mechanisms are
 * measured against. This module is the single canonical owner of that rule:
 * it classifies repository-relative paths and fails closed on malformed input.
 *
 * The registry is intentionally self-referential: the guard file, the
 * verification subsystem, holdout fixtures and the exact-head CI workflows that
 * run them are all protected, so a self-edit cannot weaken its own checker.
 */

export type ProtectedArtifactClass =
  | 'verifier'
  | 'holdout'
  | 'evaluation-harness'
  | 'protected-artifact-registry'
  | 'verification-ci'
  | 'evidence-ledger';

export interface ProtectedArtifactRule {
  class: ProtectedArtifactClass;
  /** Repository-relative POSIX path prefix or suffix that identifies the artifact. */
  match: { prefix?: string; suffix?: string; includes?: string };
  reason: string;
}

export interface ProtectedArtifactVerdict {
  protected: boolean;
  path: string;
  artifactClass: ProtectedArtifactClass | null;
  reason: string;
}

export interface SelfModificationGuardResult {
  allowed: boolean;
  violations: ProtectedArtifactVerdict[];
  checkedPaths: number;
  reason: string;
}

const MAX_PATH_LENGTH = 512;

/** Canonical protected-artifact rules. Order does not matter; the first match wins per path. */
export const PROTECTED_ARTIFACT_RULES: readonly ProtectedArtifactRule[] = [
  {
    class: 'protected-artifact-registry',
    match: { suffix: 'src/organism/verification/ProtectedArtifactRegistry.ts' },
    reason: 'the protected-artifact registry cannot modify itself',
  },
  {
    class: 'verifier',
    match: { includes: 'src/organism/verification/' },
    reason: 'verification subsystem defines how the organism judges itself',
  },
  {
    class: 'verifier',
    match: { includes: 'OutcomeVerificationService' },
    reason: 'the verifier that mints outcome receipts cannot be rewritten by the thing it verifies',
  },
  {
    class: 'verifier',
    match: { includes: 'SkillRevisionGate' },
    reason: 'the skill-revision gate authorises learning promotions',
  },
  {
    class: 'verifier',
    match: { includes: 'LearningTrustBoundary' },
    reason: 'the learning trust boundary decides which experience may train the organism',
  },
  {
    class: 'verifier',
    match: { includes: 'ConstitutionalArbiter' },
    reason: 'the constitutional arbiter adjudicates organism-versus-invariant conflicts',
  },
  {
    class: 'verifier',
    match: { includes: 'CriticalFunctionPassport' },
    reason: 'critical-function passports gate privileged capabilities',
  },
  {
    class: 'verifier',
    match: { includes: 'CanonicalSelfAgencyAuthority' },
    reason: 'the self-agency authority is the gate this guard is attached to',
  },
  {
    class: 'verifier',
    match: { includes: 'Independent' },
    reason: 'independent evaluation providers must remain outside the self-edit surface',
  },
  {
    class: 'holdout',
    match: { includes: 'holdout' },
    reason: 'holdout datasets and harnesses must stay immutable during self-improvement',
  },
  {
    class: 'evaluation-harness',
    match: { includes: 'MemoryRetrievalBenchmark' },
    reason: 'retrieval promotion is decided by this harness and its labels',
  },
  {
    class: 'evaluation-harness',
    match: { includes: 'MemoryRetrievalExperiment' },
    reason: 'paired-seed sensitivity analysis is an evaluation owner',
  },
  {
    class: 'evidence-ledger',
    match: { includes: 'VerifiedOutcomeLedger' },
    reason: 'verified-outcome evidence cannot be rewritten by the thing it judges',
  },
  {
    class: 'evidence-ledger',
    match: { includes: 'HostOwnedIndependentEvaluationServices' },
    reason: 'host-owned independent evaluation is the promotion authority',
  },
  {
    class: 'verification-ci',
    match: { includes: 'tests/workpass72-' },
    reason: 'the restore-integrity and guard regressions must not be weakened by a self-edit',
  },
  {
    class: 'verification-ci',
    match: { prefix: '.github/workflows/' },
    reason: 'CI workflows are the exact-head evidence gate and must not be weakened by a self-edit',
  },
];

/**
 * Normalize a repository-relative path to a canonical POSIX form.
 * Backslashes are unified, `.` segments are dropped, `..` segments are resolved,
 * and any attempt to escape the repository root makes the path invalid.
 * Returns null for malformed input so callers fail closed.
 */
export function canonicalizeRepoPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_PATH_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) return null;
  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  if (segments.length === 0) return null;
  return segments.join('/');
}

/** Classify one path against the protected-artifact rules. Never throws. */
export function classifyProtectedArtifact(rawPath: unknown): ProtectedArtifactVerdict {
  const path = canonicalizeRepoPath(rawPath);
  if (path === null) {
    return { protected: true, path: String(rawPath ?? ''), artifactClass: null, reason: 'unparseable-path-fails-closed' };
  }
  const pathLower = path.toLowerCase();
  for (const rule of PROTECTED_ARTIFACT_RULES) {
    const { prefix, suffix, includes } = rule.match;
    const matched = (prefix !== undefined && path.startsWith(prefix))
      || (suffix !== undefined && path.endsWith(suffix))
      // Case-insensitive: identifiers vary in casing (e.g. `holdout` vs `Holdout`).
      || (includes !== undefined && pathLower.includes(includes.toLowerCase()));
    if (matched) return { protected: true, path, artifactClass: rule.class, reason: rule.reason };
  }
  return { protected: false, path, artifactClass: null, reason: 'not-protected' };
}

/**
 * Gate a proposed self-modification. Any protected path in the change set blocks
 * the whole proposal; malformed paths and non-array input fail closed.
 */
export function guardSelfModification(input: { changedPaths?: unknown; maxPaths?: number } | null | undefined): SelfModificationGuardResult {
  const maxPaths = Number.isSafeInteger(input?.maxPaths) && (input!.maxPaths as number) > 0
    ? Math.min(4096, input!.maxPaths as number)
    : 512;
  if (input === null || input === undefined || typeof input !== 'object' || Array.isArray(input)) {
    return { allowed: false, violations: [], checkedPaths: 0, reason: 'self-modification-input-invalid' };
  }
  const raw = input.changedPaths;
  if (raw === undefined) {
    return { allowed: true, violations: [], checkedPaths: 0, reason: 'no-changed-paths-declared' };
  }
  if (!Array.isArray(raw) || raw.length > maxPaths) {
    return { allowed: false, violations: [], checkedPaths: 0, reason: 'changed-paths-invalid-or-oversized' };
  }
  const violations: ProtectedArtifactVerdict[] = [];
  for (const entry of raw) {
    const verdict = classifyProtectedArtifact(entry);
    if (verdict.protected) violations.push(verdict);
  }
  return {
    allowed: violations.length === 0,
    violations,
    checkedPaths: raw.length,
    reason: violations.length === 0
      ? 'no-protected-artifact-touched'
      : 'protected-artifact-modification-blocked',
  };
}
