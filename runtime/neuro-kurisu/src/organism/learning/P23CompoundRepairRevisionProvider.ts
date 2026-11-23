import { createPublicKey } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { P23LearningEngine } from './P23LearningEngine.ts';
import type { VersionedSkillCandidateStore } from './VersionedSkillCandidateStore.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry } from './VerifiedOutcomeLedger.ts';
import {
  ingestSignedOutcomeArtifact,
  type SignedOutcomeArtifact,
} from './VerifiedOutcomeArtifact.ts';
import {
  isAuthenticVerifiedSkillPromotionProposal,
  proposeVerifiedSkillPromotion,
  type VerifiedSkillPromotionOptions,
} from './VerifiedSkillPromotion.ts';
import type { CompoundRepairRevisionInputProvider } from './P23CompoundRepairRevisionCoordinator.ts';

const MAX_DATASET_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_ENTRIES = 10_000;
const MAX_ARTIFACTS = 100_000;

type RevisionGenerator = Parameters<P23LearningEngine['generateAndStageReflectiveSkillRevision']>[5];
type RecordValue = Record<string, unknown>;

export interface NativeCompoundRepairRevisionProviderOptions {
  datasetPath: string;
  root: string;
  stateDirectory: string;
  candidateStore: VersionedSkillCandidateStore;
  generateSkillRevision: RevisionGenerator;
}

interface VerifiedProposalDataset {
  manifest: TaskManifestEntry[];
  artifacts: SignedOutcomeArtifact[];
  baselineMethod: string;
  candidateMethod: string;
  baselinePayloadFingerprint: string;
  candidatePayloadFingerprint: string;
  gateOptions: VerifiedSkillPromotionOptions;
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPathWithin(parent: string, candidate: string): boolean {
  const root = path.resolve(parent);
  const target = path.resolve(candidate);
  const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target;
  const prefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep;
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(prefix);
}

async function canonicalPotentialPath(input: string): Promise<string> {
  let cursor = path.resolve(input);
  const suffix: string[] = [];
  for (;;) {
    try {
      const actual = await realpath(cursor);
      return path.resolve(actual, ...suffix);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new Error('native-p23-path-cannot-be-resolved');
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

function loadTrustedVerifierKeys(raw = process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON): ReadonlyMap<string, string> {
  if (!raw?.trim()) throw new Error('native-p23-revision-trusted-verifier-keys-required');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('native-p23-revision-verifier-keyring-json-invalid'); }
  if (!isRecord(value) || Object.keys(value).length < 1 || Object.keys(value).length > 128) {
    throw new Error('native-p23-revision-verifier-keyring-invalid');
  }
  const keys = new Map<string, string>();
  for (const [id, pem] of Object.entries(value)) {
    if (!id.trim() || id.length > 128 || typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) {
      throw new Error('native-p23-revision-verifier-key-invalid');
    }
    let keyType: string | undefined;
    try { keyType = createPublicKey(pem).asymmetricKeyType; } catch {
      throw new Error('native-p23-revision-verifier-key-invalid');
    }
    if (keyType !== 'ed25519') throw new Error('native-p23-revision-verifier-key-must-be-ed25519');
    keys.set(id, pem);
  }
  return keys;
}

function parseGateOptions(value: unknown): VerifiedSkillPromotionOptions {
  if (value === undefined) return {};
  if (!isRecord(value) || !onlyKeys(value, ['minPairedTasks', 'minAbsoluteGain', 'maxFamilyRegression', 'minCompleteSeeds'])) {
    throw new Error('native-p23-revision-gate-options-invalid');
  }
  const output: VerifiedSkillPromotionOptions = {};
  if (value.minPairedTasks !== undefined) {
    if (!Number.isSafeInteger(value.minPairedTasks as number) || (value.minPairedTasks as number) < 2 || (value.minPairedTasks as number) > 10_000) {
      throw new Error('native-p23-revision-min-paired-tasks-invalid');
    }
    output.minPairedTasks = value.minPairedTasks as number;
  }
  if (value.minAbsoluteGain !== undefined) {
    if (typeof value.minAbsoluteGain !== 'number' || !Number.isFinite(value.minAbsoluteGain) || value.minAbsoluteGain < 0 || value.minAbsoluteGain > 1) {
      throw new Error('native-p23-revision-minimum-gain-invalid');
    }
    output.minAbsoluteGain = value.minAbsoluteGain;
  }
  if (value.maxFamilyRegression !== undefined) {
    if (typeof value.maxFamilyRegression !== 'number' || !Number.isFinite(value.maxFamilyRegression) || value.maxFamilyRegression < 0 || value.maxFamilyRegression > 1) {
      throw new Error('native-p23-revision-family-regression-invalid');
    }
    output.maxFamilyRegression = value.maxFamilyRegression;
  }
  if (value.minCompleteSeeds !== undefined) {
    if (!Number.isSafeInteger(value.minCompleteSeeds as number) || (value.minCompleteSeeds as number) < 3 || (value.minCompleteSeeds as number) > 1000) {
      throw new Error('native-p23-revision-min-complete-seeds-invalid');
    }
    output.minCompleteSeeds = value.minCompleteSeeds as number;
  }
  return output;
}

function parseDataset(value: unknown): VerifiedProposalDataset {
  if (!isRecord(value) || !onlyKeys(value, ['schemaVersion', 'manifest', 'artifacts', 'baselineMethod', 'candidateMethod', 'gateOptions']) ||
      value.schemaVersion !== 1 || !Array.isArray(value.manifest) || !Array.isArray(value.artifacts) ||
      value.manifest.length < 2 || value.manifest.length > MAX_MANIFEST_ENTRIES ||
      value.artifacts.length < 1 || value.artifacts.length > MAX_ARTIFACTS ||
      !isNonEmptyString(value.baselineMethod) || !isNonEmptyString(value.candidateMethod) ||
      value.baselineMethod === value.candidateMethod) {
    throw new Error('native-p23-revision-dataset-schema-invalid');
  }
  for (const row of value.manifest) {
    if (!isRecord(row) || !onlyKeys(row, ['taskId', 'family', 'split', 'promptFingerprint', 'verifierId', 'version']) ||
        !isNonEmptyString(row.taskId) || !isNonEmptyString(row.family) ||
        !['train', 'validation', 'holdout'].includes(String(row.split)) ||
        !/^[a-f0-9]{64}$/i.test(String(row.promptFingerprint ?? '')) ||
        !isNonEmptyString(row.verifierId) || !isNonEmptyString(row.version)) {
      throw new Error('native-p23-revision-task-manifest-entry-invalid');
    }
  }
  if (!value.manifest.some(row => isRecord(row) && row.split === 'validation') ||
      !value.manifest.some(row => isRecord(row) && row.split === 'holdout')) {
    throw new Error('native-p23-revision-validation-and-holdout-manifest-required');
  }
  const signedPayloadKeys = [
    'schemaVersion', 'artifactId', 'runId', 'manifestFingerprint', 'taskId',
    'taskVersion', 'method', 'seed', 'attempt', 'passed', 'verifierId', 'observedAt',
    'payloadFingerprint',
  ];
  for (const artifact of value.artifacts) {
    if (!isRecord(artifact) || !onlyKeys(artifact, ['payload', 'signature']) ||
        !isRecord(artifact.payload) || !onlyKeys(artifact.payload, signedPayloadKeys) ||
        !isNonEmptyString(artifact.signature)) {
      throw new Error('native-p23-revision-signed-artifact-shape-invalid');
    }
  }

  // The method label and outcome alone are insufficient to identify executable
  // content. Each trusted signer must bind outcomes to the exact payload digest.
  const fingerprintsForMethod = (method: string): string => {
    const fingerprints = new Set<string>();
    for (const artifact of value.artifacts as SignedOutcomeArtifact[]) {
      const payload = artifact.payload as unknown as RecordValue;
      if (payload.method !== method) continue;
      const fingerprint = payload.payloadFingerprint;
      if (!isNonEmptyString(fingerprint) || !/^[a-f0-9]{64}$/i.test(fingerprint)) {
        throw new Error('native-p23-revision-signed-payload-fingerprint-required:' + method);
      }
      fingerprints.add(fingerprint.toLowerCase());
    }
    if (fingerprints.size !== 1) {
      throw new Error('native-p23-revision-method-must-bind-one-payload-fingerprint:' + method);
    }
    return [...fingerprints][0];
  };
  const baselinePayloadFingerprint = fingerprintsForMethod(value.baselineMethod);
  const candidatePayloadFingerprint = fingerprintsForMethod(value.candidateMethod);
  if (baselinePayloadFingerprint === candidatePayloadFingerprint) {
    throw new Error('native-p23-revision-baseline-and-candidate-payload-fingerprints-identical');
  }

  return {
    manifest: value.manifest as TaskManifestEntry[],
    artifacts: value.artifacts as SignedOutcomeArtifact[],
    baselineMethod: value.baselineMethod,
    candidateMethod: value.candidateMethod,
    baselinePayloadFingerprint,
    candidatePayloadFingerprint,
    gateOptions: parseGateOptions(value.gateOptions),
  };
}

async function readDataset(pathSetting: string, root: string, stateDirectory: string): Promise<VerifiedProposalDataset> {
  if (!isNonEmptyString(pathSetting) || !isNonEmptyString(root) || !isNonEmptyString(stateDirectory)) {
    throw new Error('native-p23-revision-dataset-path-config-invalid');
  }
  const configured = path.isAbsolute(pathSetting) ? path.resolve(pathSetting) : path.resolve(root, pathSetting);
  const linkInfo = await lstat(configured);
  if (linkInfo.isSymbolicLink() || !linkInfo.isFile()) {
    throw new Error('native-p23-revision-dataset-must-be-a-regular-non-symlink-file');
  }
  if (process.platform !== 'win32' && (linkInfo.mode & 0o022) !== 0) {
    throw new Error('native-p23-revision-dataset-must-not-be-group-or-world-writable');
  }
  if (linkInfo.size < 1 || linkInfo.size > MAX_DATASET_BYTES) {
    throw new Error('native-p23-revision-dataset-size-invalid');
  }
  const actualPath = await realpath(configured);
  const actualInfo = await stat(actualPath);
  if (!actualInfo.isFile()) throw new Error('native-p23-revision-dataset-must-be-a-regular-file');
  const actualParent = await stat(path.dirname(actualPath));
  if (process.platform !== 'win32' && (actualParent.mode & 0o022) !== 0) {
    throw new Error('native-p23-revision-dataset-parent-must-not-be-group-or-world-writable');
  }
  const statePath = await canonicalPotentialPath(stateDirectory);
  if (isPathWithin(statePath, actualPath)) {
    throw new Error('native-p23-revision-dataset-must-be-outside-mutable-state-directory');
  }
  // Open the resolved inode itself. O_NOFOLLOW blocks a symlink swap at the
  // final path component; fstat binds the opened descriptor to the inode checked
  // before open, and a second fstat detects mutation while the bytes are read.
  const flags = constants.O_RDONLY |
    (process.platform === 'win32' ? 0 : (constants.O_NOFOLLOW ?? 0));
  const handle = await open(actualPath, flags);
  let raw: string;
  try {
    const openedInfo = await handle.stat();
    if (!openedInfo.isFile() || openedInfo.dev !== actualInfo.dev || openedInfo.ino !== actualInfo.ino) {
      throw new Error('native-p23-revision-dataset-file-changed-before-open');
    }
    if (process.platform !== 'win32' && (openedInfo.mode & 0o022) !== 0) {
      throw new Error('native-p23-revision-dataset-must-not-be-group-or-world-writable');
    }
    if (openedInfo.size < 1 || openedInfo.size > MAX_DATASET_BYTES) {
      throw new Error('native-p23-revision-dataset-size-invalid');
    }
    raw = await handle.readFile('utf8');
    const afterRead = await handle.stat();
    if (afterRead.dev !== openedInfo.dev || afterRead.ino !== openedInfo.ino ||
        afterRead.size !== openedInfo.size || afterRead.mtimeMs !== openedInfo.mtimeMs ||
        afterRead.ctimeMs !== openedInfo.ctimeMs) {
      throw new Error('native-p23-revision-dataset-mutated-during-read');
    }
  } finally {
    await handle.close();
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_DATASET_BYTES) throw new Error('native-p23-revision-dataset-size-invalid');
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch {
    throw new Error('native-p23-revision-dataset-json-invalid');
  }
  return parseDataset(decoded);
}

async function issueVerifiedProposal(
  datasetPath: string,
  root: string,
  stateDirectory: string,
  trustedKeys: ReadonlyMap<string, string>,
) {
  const dataset = await readDataset(datasetPath, root, stateDirectory);
  const ledger = new VerifiedOutcomeLedger(dataset.manifest);
  for (const artifact of dataset.artifacts) {
    const ingested = ingestSignedOutcomeArtifact(ledger, dataset.manifest, artifact, trustedKeys);
    if (!ingested.accepted) {
      throw new Error('native-p23-revision-signed-outcome-rejected:' + (ingested.rejection ?? 'unknown'));
    }
  }
  const proposal = proposeVerifiedSkillPromotion(ledger, dataset.baselineMethod, dataset.candidateMethod, dataset.gateOptions);
  if (!isAuthenticVerifiedSkillPromotionProposal(proposal) || proposal.gate.accepted !== true ||
      proposal.authenticatedEvidenceRows < 1 || proposal.unauthenticatedEvidenceRows !== 0) {
    throw new Error('native-p23-revision-dataset-does-not-authorize-revision');
  }
  return { dataset, proposal };
}

/**
 * Native Hermes/P23 provider. This removes the need for a custom executable
 * provider module while retaining signed outcome artifacts, the canonical
 * versioned candidate store, and the separately configured host-owned evaluator.
 *
 * Dataset JSON schema:
 * { schemaVersion: 1, manifest: TaskManifestEntry[], artifacts: SignedOutcomeArtifact[],
 *   baselineMethod: string, candidateMethod: string, gateOptions?: VerifiedSkillPromotionOptions }
 * Signatures are verified against NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON; keys are never read from the dataset.
 */
export async function createNativeCompoundRepairRevisionProvider(
  options: NativeCompoundRepairRevisionProviderOptions,
): Promise<CompoundRepairRevisionInputProvider> {
  if (!options || !options.candidateStore || typeof options.generateSkillRevision !== 'function') {
    throw new Error('native-p23-revision-provider-config-invalid');
  }
  const datasetPath = options.datasetPath;
  const trustedKeys = loadTrustedVerifierKeys();
  // Fail early on malformed, untrusted or unsafe input; reload it on every repair
  // so an updated signed evidence dataset cannot silently reuse stale proposal state.
  await issueVerifiedProposal(datasetPath, options.root, options.stateDirectory, trustedKeys);
  return async input => {
    if (!input || !isNonEmptyString(input.skillId)) throw new Error('native-p23-revision-skill-id-required');
    const { dataset, proposal } = await issueVerifiedProposal(datasetPath, options.root, options.stateDirectory, trustedKeys);
    const snapshot = options.candidateStore.snapshot();
    const active = snapshot.active.find(candidate => candidate.skillId === input.skillId);
    if (!active) throw new Error('native-p23-revision-active-baseline-required');
    const eligible = snapshot.candidates.filter(candidate =>
      candidate.skillId === input.skillId &&
      candidate.proposalId === proposal.proposalId &&
      candidate.proposalOutcomeFingerprint === proposal.outcomeFingerprint &&
      candidate.payloadFingerprint.toLowerCase() === dataset.candidatePayloadFingerprint &&
      ['staged', 'shadow', 'active'].includes(candidate.status),
    ).sort((a, b) => b.version - a.version || b.createdAt - a.createdAt);
    const source = eligible[0];
    if (!source) {
      throw new Error('native-p23-revision-no-candidate-matches-signed-proposal-and-payload');
    }

    let baselinePayload: unknown;
    let baselinePayloadFingerprint: string;
    let baselineIdentity: { version: number; payloadFingerprint: string; proposalId: string };
    if (source.status === 'active') {
      if (active.version !== source.version ||
          active.payloadFingerprint.toLowerCase() !== dataset.candidatePayloadFingerprint ||
          active.proposalId !== source.proposalId ||
          !source.previousActive ||
          source.previousActive.payloadFingerprint.toLowerCase() !== dataset.baselinePayloadFingerprint) {
        throw new Error('native-p23-revision-active-source-payload-binding-mismatch');
      }
      baselinePayload = source.previousActive.payload;
      baselinePayloadFingerprint = source.previousActive.payloadFingerprint;
      baselineIdentity = {
        version: source.previousActive.version,
        payloadFingerprint: source.previousActive.payloadFingerprint,
        proposalId: source.previousActive.proposalId,
      };
    } else {
      if (active.payloadFingerprint.toLowerCase() !== dataset.baselinePayloadFingerprint) {
        throw new Error('native-p23-revision-active-baseline-payload-binding-mismatch');
      }
      if (source.baseVersion !== active.version) {
        throw new Error('native-p23-revision-source-base-version-is-stale');
      }
      baselinePayload = active.payload;
      baselinePayloadFingerprint = active.payloadFingerprint;
      baselineIdentity = {
        version: active.version,
        payloadFingerprint: active.payloadFingerprint,
        proposalId: active.proposalId,
      };
    }

    const sourceIdentity = {
      candidateId: source.candidateId,
      skillId: source.skillId,
      version: source.version,
      status: source.status,
      payloadFingerprint: source.payloadFingerprint,
      proposalId: source.proposalId,
      proposalOutcomeFingerprint: source.proposalOutcomeFingerprint,
      baseVersion: source.baseVersion,
    };
    const activeIdentity = {
      version: active.version,
      payloadFingerprint: active.payloadFingerprint,
      proposalId: active.proposalId,
    };
    const assertCanonicalLineageCurrent = async (): Promise<void> => {
      const latest = await issueVerifiedProposal(datasetPath, options.root, options.stateDirectory, trustedKeys);
      if (latest.proposal.proposalId !== proposal.proposalId ||
          latest.proposal.outcomeFingerprint !== proposal.outcomeFingerprint ||
          latest.dataset.baselinePayloadFingerprint !== dataset.baselinePayloadFingerprint ||
          latest.dataset.candidatePayloadFingerprint !== dataset.candidatePayloadFingerprint) {
        throw new Error('native-p23-revision-signed-dataset-changed-during-independent-evaluation');
      }
      const current = options.candidateStore.snapshot();
      const currentSource = current.candidates.find(candidate => candidate.candidateId === sourceIdentity.candidateId);
      const currentActive = current.active.find(candidate => candidate.skillId === input.skillId);
      if (!currentSource || !currentActive ||
          currentSource.skillId !== sourceIdentity.skillId ||
          currentSource.version !== sourceIdentity.version ||
          currentSource.status !== sourceIdentity.status ||
          currentSource.payloadFingerprint !== sourceIdentity.payloadFingerprint ||
          currentSource.proposalId !== sourceIdentity.proposalId ||
          currentSource.proposalOutcomeFingerprint !== sourceIdentity.proposalOutcomeFingerprint ||
          currentSource.baseVersion !== sourceIdentity.baseVersion ||
          currentActive.version !== activeIdentity.version ||
          currentActive.payloadFingerprint !== activeIdentity.payloadFingerprint ||
          currentActive.proposalId !== activeIdentity.proposalId) {
        throw new Error('native-p23-revision-canonical-store-lineage-changed-during-independent-evaluation');
      }
      const currentBaseline = currentSource.status === 'active' ? currentSource.previousActive : currentActive;
      if (!currentBaseline ||
          currentBaseline.version !== baselineIdentity.version ||
          currentBaseline.payloadFingerprint !== baselineIdentity.payloadFingerprint ||
          currentBaseline.proposalId !== baselineIdentity.proposalId) {
        throw new Error('native-p23-revision-baseline-changed-during-independent-evaluation');
      }
    };

    return {
      proposal,
      sourceCandidateId: source.candidateId,
      // These placeholders are never trusted; withIndependentCandidateEvaluation
      // replaces them with three distinct host-owned method evaluations.
      baseline: { validation: [], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      baselinePayload,
      baselinePayloadFingerprint,
      sourceCandidatePayload: source.payload,
      sourceCandidatePayloadFingerprint: source.payloadFingerprint,
      assertCanonicalLineageCurrent,
      generate: options.generateSkillRevision,
      evaluateRevisedCandidate: async () => {
        throw new Error('native-p23-revision-requires-independent-evaluation-wrapper');
      },
    };
  };
}
