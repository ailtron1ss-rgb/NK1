import { createPublicKey } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  canonicalSkillPromotionApprovalPayload,
  createSkillPromotionApprovalPayload,
} from '../src/organism/learning/AuthenticatedSkillPromotionApproval.ts';
import { AtomicFileTrustedSkillShadowRunRegistry } from '../src/organism/learning/TrustedSkillShadowRunRegistry.ts';
import { createContextBoundSkillShadowEvidenceVerifier } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const MAX_STORE_BYTES = 10 * 1024 * 1024;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

export async function createSkillPromotionApprovalRequest({ storePath, registryPath, rawVerifierKeys = process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON, candidateId, approverId, approvalId, minShadowRuns = 3, now = Date.now() }) {
  if (!nonEmpty(storePath) || !nonEmpty(registryPath) || !/^[a-f0-9]{64}$/.test(candidateId ?? '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(approverId ?? '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(approvalId ?? '') ||
      !Number.isSafeInteger(minShadowRuns) || minShadowRuns < 1 || minShadowRuns > 1000 ||
      !Number.isFinite(now) || now <= 0) {
    throw new Error('candidate ID, approver/approval IDs, shadow threshold, and timestamp must be valid');
  }
  const absolutePath = path.resolve(storePath);
  const fileInfo = await lstat(absolutePath);
  if (fileInfo.isSymbolicLink() || !fileInfo.isFile() || fileInfo.size > MAX_STORE_BYTES) {
    throw new Error('candidate store must be a regular non-symlink file no larger than 10 MiB');
  }
  let snapshot;
  try { snapshot = JSON.parse(await readFile(absolutePath, 'utf8')); }
  catch (error) { throw new Error(`candidate store could not be parsed: ${String(error?.message || error)}`); }
  if (!isRecord(snapshot) || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.revision) ||
      !Array.isArray(snapshot.active) || !Array.isArray(snapshot.candidates)) {
    throw new Error('candidate store snapshot schema is invalid');
  }
  const candidate = snapshot.candidates.find(item => item?.candidateId === candidateId);
  if (!candidate) throw new Error('candidate ID is absent from the durable candidate store');
  if (candidate.status !== 'shadow') throw new Error('approval requests require a shadow candidate; staged/active/retired candidates are not eligible');
  if (!Array.isArray(candidate.shadowObservations) || candidate.shadowObservations.length < minShadowRuns ||
      candidate.shadowObservations.some(item => item?.passed !== true)) {
    throw new Error('candidate does not satisfy the requested all-passing shadow run threshold');
  }
  if (rawVerifierKeys === undefined || rawVerifierKeys.trim() === '') {
    throw new Error('NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON is required to verify shadow evidence before requesting approval');
  }
  let parsedKeys;
  try { parsedKeys = JSON.parse(rawVerifierKeys); }
  catch { throw new Error('NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON must be valid JSON'); }
  if (!isRecord(parsedKeys) || Object.keys(parsedKeys).length === 0 || Object.keys(parsedKeys).length > 64) {
    throw new Error('trusted shadow verifier key set must contain between 1 and 64 entries');
  }
  const trustedKeys = new Map();
  for (const [id, pem] of Object.entries(parsedKeys)) {
    if (!nonEmpty(id) || typeof pem !== 'string') throw new Error('trusted shadow verifier key entry is malformed');
    let key;
    try { key = createPublicKey(pem); }
    catch { throw new Error('trusted shadow verifier keys must be valid Ed25519 public keys'); }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('trusted shadow verifier keys must be valid Ed25519 public keys');
    trustedKeys.set(id, pem);
  }
  const registryInfo = await lstat(path.resolve(registryPath));
  if (registryInfo.isSymbolicLink() || !registryInfo.isFile() || registryInfo.size > MAX_STORE_BYTES) {
    throw new Error('trusted run registry must be a regular non-symlink file no larger than 10 MiB');
  }
  const registry = new AtomicFileTrustedSkillShadowRunRegistry(path.resolve(registryPath));
  const verifyEvidence = createContextBoundSkillShadowEvidenceVerifier(trustedKeys, (observation, observedCandidate) =>
    registry.resolve(observation, observedCandidate));
  for (const observation of candidate.shadowObservations) {
    let valid = false;
    try { valid = verifyEvidence(observation, candidate); } catch { valid = false; }
    if (valid !== true) throw new Error('candidate contains shadow evidence that fails signature or trusted-run context verification');
  }
  const active = snapshot.active.find(item => item?.skillId === candidate.skillId) ?? null;
  const expectedActiveVersion = active?.version ?? null;
  if (candidate.baseVersion !== expectedActiveVersion) {
    throw new Error('candidate base version does not match current active version; refresh/re-stage before requesting approval');
  }
  const payload = createSkillPromotionApprovalPayload(
    candidate, approverId, approvalId, now, expectedActiveVersion, minShadowRuns,
  );
  const canonicalPayload = canonicalSkillPromotionApprovalPayload(payload);
  return {
    schemaVersion: 1,
    status: 'approval-request-only',
    signingAlgorithm: 'Ed25519',
    candidateId: candidate.candidateId,
    skillId: candidate.skillId,
    candidateVersion: candidate.version,
    expectedActiveVersion,
    minShadowRuns,
    payload,
    canonicalPayload,
    warning: 'This is an unsigned request. It does not authorize activation. An independent authenticated approver must sign canonicalPayload with a key whose public key is configured in NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON.',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const [, , storePath, registryPath, candidateId, approverId, approvalId, rawMinRuns] = process.argv;
  if (!storePath || !registryPath || !candidateId || !approverId || !approvalId) {
    console.error(`Usage: NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON='{"verifier-id":"<Ed25519 public PEM>"}' node --experimental-strip-types scripts/create-skill-promotion-approval-request.mjs <candidate-store.json> <trusted-run-registry.json> <candidate-id> <approver-id> <approval-id> [min-shadow-runs]`);
    process.exitCode = 2;
  } else {
    try {
      const minShadowRuns = rawMinRuns === undefined ? 3 : Number(rawMinRuns);
      const result = await createSkillPromotionApprovalRequest({
        storePath, registryPath, candidateId, approverId, approvalId, minShadowRuns,
      });
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`skill promotion approval request failed: ${String(error?.message || error)}`);
      process.exitCode = 1;
    }
  }
}
