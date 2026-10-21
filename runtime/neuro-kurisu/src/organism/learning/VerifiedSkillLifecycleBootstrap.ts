import { AtomicFileSkillStorePersistence } from './AtomicFileSkillStorePersistence.ts';
import { AtomicFileTrustedSkillShadowRunRegistry } from './TrustedSkillShadowRunRegistry.ts';
import { VersionedSkillCandidateStore } from './VersionedSkillCandidateStore.ts';
import { createContextBoundSkillShadowEvidenceVerifier } from './VerifiedSkillShadowEvidence.ts';

function loadTrustedVerifierKeys(raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim() === '') return new Map();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON must be valid JSON'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON must be an object keyed by verifier ID');
  }
  const keys = new Map<string, string>();
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!id.trim() || typeof value !== 'string' || !value.includes('BEGIN PUBLIC KEY')) {
      throw new Error('trusted shadow verifier keys must map non-empty IDs to PEM public keys');
    }
    keys.set(id, value);
  }
  return keys;
}

export interface VerifiedSkillLifecycleBootstrap {
  store: VersionedSkillCandidateStore;
  registry: AtomicFileTrustedSkillShadowRunRegistry;
  trustedVerifierCount: number;
}

/**
 * Production bootstrap for durable candidate state and independent run provenance.
 * Evidence verification is default-deny when no trusted verifier keys are configured.
 * Promotion authorization intentionally remains default-deny until an authenticated
 * approval authority is wired; caller-provided audit fields are not authorization.
 */
export function createVerifiedSkillLifecycleBootstrap(
  candidateStorePath: string,
  trustedRunRegistryPath: string,
  rawVerifierKeys = process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
): VerifiedSkillLifecycleBootstrap {
  if (!candidateStorePath.trim() || !trustedRunRegistryPath.trim()) {
    throw new Error('verified skill lifecycle persistence paths are required');
  }
  const trustedVerifierKeys = loadTrustedVerifierKeys(rawVerifierKeys);
  const registry = new AtomicFileTrustedSkillShadowRunRegistry(trustedRunRegistryPath);
  const verifyShadowEvidence = createContextBoundSkillShadowEvidenceVerifier(
    trustedVerifierKeys,
    (observation, candidate) => registry.resolve(observation, candidate),
  );
  const store = new VersionedSkillCandidateStore(
    new AtomicFileSkillStorePersistence(candidateStorePath),
    () => false,
    verifyShadowEvidence,
  );
  return { store, registry, trustedVerifierCount: trustedVerifierKeys.size };
}
