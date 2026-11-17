import { createPublicKey } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import type { VerifiedSkillPromotionProposal } from './VerifiedSkillPromotion.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from './VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, type SignedOutcomeArtifact } from './VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from './VerifiedSkillPromotion.ts';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

const MAX_BUNDLE_BYTES = 10 * 1024 * 1024;
const MAX_TASKS = 512;
const MAX_ARTIFACTS = 6_000;
const MAX_OUTCOME_AGE_MS = 30 * 24 * 60 * 60_000;
const MAX_FUTURE_SKEW_MS = 30_000;

export interface SynapticP23OutcomeBundle {
  schemaVersion: 1;
  manifest: TaskManifestEntry[];
  baselineMethod: string;
  candidateMethod: string;
  artifacts: SignedOutcomeArtifact[];
}

export interface SynapticP23OutcomeBundleProviderConfig {
  bundlePath: string;
  rawVerifierKeys?: string;
  now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const keys = Reflect.ownKeys(value);
  if (keys.length !== allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key))) {
    throw new Error('synaptic-p23-' + label + '-fields-invalid');
  }
}

function readTrustedVerifierKeys(raw: string | undefined): ReadonlyMap<string, string> {
  if (typeof raw !== 'string' || !raw.trim())
    throw new Error('synaptic-p23-local-verifier-keys-not-configured');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('synaptic-p23-local-verifier-keys-json-invalid'); }
  if (!isRecord(parsed)) throw new Error('synaptic-p23-local-verifier-keys-must-be-object');
  const keys = new Map<string, string>();
  for (const [id, pem] of Object.entries(parsed)) {
    if (!/^[a-z0-9][a-z0-9._:-]{1,95}$/.test(id) || typeof pem !== 'string' || pem.length > 8192)
      throw new Error('synaptic-p23-local-verifier-key-entry-invalid');
    let key;
    try { key = createPublicKey(pem); }
    catch { throw new Error('synaptic-p23-local-verifier-key-invalid'); }
    if (key.asymmetricKeyType !== 'ed25519')
      throw new Error('synaptic-p23-local-verifier-key-must-be-ed25519');
    keys.set(id, pem);
  }
  if (keys.size === 0) throw new Error('synaptic-p23-local-verifier-keys-empty');
  return keys;
}

async function readRegularBundle(filePath: string): Promise<unknown> {
  if (typeof filePath !== 'string' || !filePath.trim())
    throw new TypeError('synaptic-p23-outcome-bundle-path-required');
  const absolute = path.resolve(filePath);
  const entry = await lstat(absolute);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error('synaptic-p23-outcome-bundle-symlink-or-non-regular-file-rejected');
  }
  const noFollow = process.platform === 'win32' ? 0 : (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await open(absolute, fsConstants.O_RDONLY | noFollow);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 2 || info.size > MAX_BUNDLE_BYTES)
      throw new Error('synaptic-p23-outcome-bundle-must-be-regular-file-under-10mib');
    const encoded = await handle.readFile({ encoding: 'utf8' });
    const after = await handle.stat();
    if (after.ino !== info.ino || after.size !== info.size || after.mtimeMs !== info.mtimeMs)
      throw new Error('synaptic-p23-outcome-bundle-changed-while-reading');
    let parsed: unknown;
    try { parsed = JSON.parse(encoded); }
    catch { throw new Error('synaptic-p23-outcome-bundle-json-invalid'); }
    return snapshotPlainData(parsed, { maxDepth: 24, maxNodes: 100_000, maxStringUnits: 4 * 1024 * 1024 });
  } finally {
    await handle.close();
  }
}

function validateBundle(raw: unknown, expectedCandidateMethod: string): SynapticP23OutcomeBundle {
  if (!isRecord(raw)) throw new TypeError('synaptic-p23-outcome-bundle-must-be-object');
  exactKeys(raw, ['schemaVersion', 'manifest', 'baselineMethod', 'candidateMethod', 'artifacts'], 'outcome-bundle');
  if (raw.schemaVersion !== 1 ||
      !Array.isArray(raw.manifest) || raw.manifest.length < 8 || raw.manifest.length > MAX_TASKS ||
      !Array.isArray(raw.artifacts) || raw.artifacts.length < 80 || raw.artifacts.length > MAX_ARTIFACTS ||
      typeof raw.baselineMethod !== 'string' || !raw.baselineMethod.trim() ||
      typeof raw.candidateMethod !== 'string' || !raw.candidateMethod.trim() ||
      raw.baselineMethod === raw.candidateMethod ||
      raw.candidateMethod !== expectedCandidateMethod) {
    throw new Error('synaptic-p23-outcome-bundle-shape-or-method-binding-invalid');
  }

  const manifest = raw.manifest as TaskManifestEntry[];
  const taskIds = new Set<string>();
  const families = new Set<string>();
  for (const task of manifest) {
    if (!isRecord(task)) throw new Error('synaptic-p23-outcome-manifest-entry-invalid');
    exactKeys(task, ['taskId', 'family', 'split', 'promptFingerprint', 'verifierId', 'version'], 'manifest-entry');
    if (typeof task.taskId !== 'string' || !task.taskId.trim() ||
        typeof task.family !== 'string' || !task.family.trim() ||
        task.split !== 'holdout' ||
        typeof task.promptFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(task.promptFingerprint) ||
        typeof task.verifierId !== 'string' || !task.verifierId.trim() ||
        typeof task.version !== 'string' || !task.version.trim() ||
        taskIds.has(task.taskId)) {
      throw new Error('synaptic-p23-outcome-manifest-entry-invalid');
    }
    taskIds.add(task.taskId);
    families.add(task.family);
  }
  if (families.size < 2) throw new Error('synaptic-p23-outcome-manifest-needs-two-holdout-families');

  const artifacts = raw.artifacts as SignedOutcomeArtifact[];
  for (const artifact of artifacts) {
    if (!isRecord(artifact)) throw new Error('synaptic-p23-outcome-artifact-invalid');
    exactKeys(artifact, ['payload', 'signature'], 'outcome-artifact');
    if (!isRecord(artifact.payload) || typeof artifact.signature !== 'string')
      throw new Error('synaptic-p23-outcome-artifact-invalid');
    exactKeys(artifact.payload, [
      'schemaVersion', 'artifactId', 'runId', 'manifestFingerprint', 'taskId',
      'taskVersion', 'method', 'seed', 'attempt', 'passed', 'verifierId', 'observedAt',
    ], 'outcome-payload');
    if (artifact.payload.schemaVersion !== 1 ||
        ![raw.baselineMethod, raw.candidateMethod].includes(String(artifact.payload.method)) ||
        typeof artifact.payload.observedAt !== 'number' ||
        !Number.isSafeInteger(artifact.payload.observedAt)) {
      throw new Error('synaptic-p23-outcome-payload-invalid');
    }
  }
  return {
    schemaVersion: 1,
    manifest: manifest as TaskManifestEntry[],
    baselineMethod: raw.baselineMethod,
    candidateMethod: raw.candidateMethod,
    artifacts,
  };
}

/**
 * Host-local provider for signed holdout results. It reads a bounded regular file
 * without following symlinks, re-verifies every Ed25519 outcome against the exact
 * manifest, and creates the process-authentic proposal through NK1's canonical
 * VerifiedOutcomeLedger. No proposal JSON or remote certificate is accepted.
 */
export function createSynapticP23AdmissionProvider(config: SynapticP23OutcomeBundleProviderConfig) {
  if (!config || typeof config.bundlePath !== 'string' || !config.bundlePath.trim())
    throw new TypeError('synaptic-p23-outcome-bundle-path-required');
  const trustedVerifierKeys = readTrustedVerifierKeys(
    config.rawVerifierKeys ?? process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON,
  );
  const now = config.now ?? Date.now;
  return async ({ candidateMethod }: { candidateMethod: string }): Promise<VerifiedSkillPromotionProposal> => {
    if (typeof candidateMethod !== 'string' || !candidateMethod.startsWith('synaptic-commons:') ||
        !/^[a-f0-9]{64}$/.test(candidateMethod.slice('synaptic-commons:'.length))) {
      throw new Error('synaptic-p23-candidate-method-invalid');
    }
    const raw = await readRegularBundle(config.bundlePath);
    const bundle = validateBundle(raw, candidateMethod);
    const ledger = new VerifiedOutcomeLedger(bundle.manifest);
    const current = now();
    for (let index = 0; index < bundle.artifacts.length; index += 1) {
      const artifact = bundle.artifacts[index]!;
      const observedAt = artifact.payload.observedAt;
      if (observedAt < current - MAX_OUTCOME_AGE_MS || observedAt > current + MAX_FUTURE_SKEW_MS) {
        throw new Error('synaptic-p23-outcome-artifact-time-out-of-window:' + index);
      }
      const result = ingestSignedOutcomeArtifact(ledger, bundle.manifest, artifact, trustedVerifierKeys);
      if (!result.accepted) {
        throw new Error('synaptic-p23-outcome-artifact-rejected:' + index + ':' + (result.rejection ?? 'unknown'));
      }
    }
    const proposal = proposeVerifiedSkillPromotion(ledger, bundle.baselineMethod, bundle.candidateMethod, {
      minPairedTasks: 8,
      minAbsoluteGain: 0.1,
      minCompleteSeeds: 5,
    });
    if (!proposal.gate.accepted || proposal.authenticatedEvidenceRows !== bundle.artifacts.length ||
        proposal.unauthenticatedEvidenceRows !== 0 ||
        proposal.uniquePairedTasks < 8 || proposal.completePairedSeeds < 5 ||
        proposal.pairedTaskSeedN < 5) {
      throw new Error('synaptic-p23-local-outcome-evidence-gate-rejected:' + proposal.gate.reason);
    }
    return proposal;
  };
}
