import { createPublicKey } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AtomicFileSkillReviewInboxPersistence } from '../src/organism/learning/AtomicFileSkillReviewInboxPersistence.mjs';
import { HexisSkillReviewInbox, assertSkillReviewReadyForSignedPromotion } from '../src/organism/learning/HexisSkillReviewInbox.ts';
import { parseTrustedSkillReviewDecisionKeys, verifySignedSkillReviewDecisionArtifact } from '../src/organism/learning/AuthenticatedSkillReviewDecision.ts';
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


/**
 * Operator-facing guarded path: a normal unsigned promotion request is returned
 * only after a persisted human review is approved for this exact candidate and
 * its unchanged shadow-evidence set. The final Ed25519 activation approval is
 * still a separate step.
 */
export async function createReviewedSkillPromotionApprovalRequest({
  reviewInboxPath, reviewId, signedReviewDecisionPath,
  rawReviewVerifierKeys = process.env.NEURO_SKILL_REVIEW_APPROVAL_KEYS_JSON,
  ...requestOptions
}) {
  if (!nonEmpty(reviewInboxPath) || !/^[a-f0-9]{64}$/.test(reviewId ?? '') ||
      !nonEmpty(signedReviewDecisionPath)) {
    throw new Error('a review inbox path, SHA-256 review ID and signed decision artifact path are required');
  }

  // Keep the existing cryptographic shadow-evidence checks and canonical payload
  // generation as the single source of truth for the underlying approval request.
  const request = await createSkillPromotionApprovalRequest(requestOptions);

  // Re-read candidate state after generating the unsigned request and bind every
  // request-critical field to the current durable candidate before returning it.
  const storePath = path.resolve(requestOptions.storePath);
  const storeInfo = await lstat(storePath);
  if (storeInfo.isSymbolicLink() || !storeInfo.isFile() || storeInfo.size > MAX_STORE_BYTES) {
    throw new Error('candidate store must be a regular non-symlink file no larger than 10 MiB');
  }
  let snapshot;
  try { snapshot = JSON.parse(await readFile(storePath, 'utf8')); }
  catch (error) { throw new Error(`candidate store could not be parsed during review binding: ${String(error?.message || error)}`); }
  if (!isRecord(snapshot) || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.revision) ||
      !Array.isArray(snapshot.active) || !Array.isArray(snapshot.candidates)) {
    throw new Error('candidate store snapshot schema is invalid during review binding');
  }
  const candidate = snapshot.candidates.find(item => item?.candidateId === requestOptions.candidateId);
  if (!candidate) throw new Error('candidate disappeared before review binding completed');
  const active = snapshot.active.find(item => item?.skillId === candidate.skillId) ?? null;
  const activeVersion = active?.version ?? null;
  if (candidate.baseVersion !== activeVersion ||
      request.expectedActiveVersion !== activeVersion ||
      request.payload?.expectedActiveVersion !== activeVersion) {
    throw new Error('candidate active-version context changed while creating the review-bound approval request');
  }

  const inboxPath = path.resolve(reviewInboxPath);
  const inboxInfo = await lstat(inboxPath);
  if (inboxInfo.isSymbolicLink() || !inboxInfo.isFile() || inboxInfo.size > MAX_STORE_BYTES) {
    throw new Error('skill review inbox must be a regular non-symlink file no larger than 10 MiB');
  }
  const inbox = new HexisSkillReviewInbox(new AtomicFileSkillReviewInboxPersistence(inboxPath));
  const review = inbox.snapshot().records.find(record => record.packet.reviewId === reviewId);
  if (!review) throw new Error('matching skill review ID is absent from the durable review inbox');

  const signedDecisionPath = path.resolve(signedReviewDecisionPath);
  const signedDecisionInfo = await lstat(signedDecisionPath);
  if (signedDecisionInfo.isSymbolicLink() || !signedDecisionInfo.isFile() || signedDecisionInfo.size > 1024 * 1024) {
    throw new Error('signed review decision must be a regular non-symlink file no larger than 1 MiB');
  }
  let signedDecisionArtifact;
  try { signedDecisionArtifact = JSON.parse(await readFile(signedDecisionPath, 'utf8')); }
  catch (error) { throw new Error(`signed review decision could not be parsed: ${String(error?.message || error)}`); }
  const trustedReviewKeys = parseTrustedSkillReviewDecisionKeys(rawReviewVerifierKeys);
  const authenticatedReviewDecision = verifySignedSkillReviewDecisionArtifact(signedDecisionArtifact, trustedReviewKeys, review);

  assertSkillReviewReadyForSignedPromotion(review, candidate);
  const payload = request.payload;
  if (request.status !== 'approval-request-only' ||
      request.candidateId !== candidate.candidateId ||
      request.skillId !== candidate.skillId ||
      request.candidateVersion !== candidate.version ||
      payload?.candidateId !== candidate.candidateId ||
      payload?.skillId !== candidate.skillId ||
      payload?.candidateVersion !== candidate.version ||
      payload?.payloadFingerprint !== candidate.payloadFingerprint ||
      payload?.proposalId !== candidate.proposalId ||
      payload?.proposalOutcomeFingerprint !== candidate.proposalOutcomeFingerprint ||
      payload?.shadowEvidenceFingerprint !== review.packet.shadowEvidenceFingerprint ||
      request.canonicalPayload !== canonicalSkillPromotionApprovalPayload(payload)) {
    throw new Error('unsigned request does not match the approved review and current candidate evidence');
  }

  return {
    ...request,
    humanReview: {
      reviewId: review.packet.reviewId,
      status: review.status,
      reviewerId: review.decision.reviewerId,
      decidedAt: review.decision.decidedAt,
      decisionDigest: review.decision.digest,
      authenticated: true,
      signingKeyId: authenticatedReviewDecision.keyId,
      signedDecisionDigest: authenticatedReviewDecision.decisionDigest,
    },
    warning: request.warning + ' A matching approved human review was verified with a trusted Ed25519 signature; this remains an unsigned request and still does not authorize activation.',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const [, , storePath, registryPath, reviewInboxPath, reviewId, signedReviewDecisionPath, candidateId, approverId, approvalId, rawMinRuns] = process.argv;
  if (!storePath || !registryPath || !reviewInboxPath || !reviewId || !signedReviewDecisionPath || !candidateId || !approverId || !approvalId) {
    console.error(`Usage: NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON='{"verifier-id":"<Ed25519 public PEM>"}' NEURO_SKILL_REVIEW_APPROVAL_KEYS_JSON='{"reviewer-key-id":"<Ed25519 public PEM>"}' node --experimental-strip-types scripts/create-skill-promotion-approval-request.mjs <candidate-store.json> <trusted-run-registry.json> <review-inbox.json> <review-id> <signed-review-decision.json> <candidate-id> <approver-id> <approval-id> [min-shadow-runs]`);
    process.exitCode = 2;
  } else {
    try {
      const minShadowRuns = rawMinRuns === undefined ? 3 : Number(rawMinRuns);
      const result = await createReviewedSkillPromotionApprovalRequest({
        storePath, registryPath, reviewInboxPath, reviewId, signedReviewDecisionPath, candidateId, approverId, approvalId, minShadowRuns,
      });
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`skill promotion approval request failed: ${String(error?.message || error)}`);
      process.exitCode = 1;
    }
  }
}
