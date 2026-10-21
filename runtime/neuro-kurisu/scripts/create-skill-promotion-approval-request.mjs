import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  canonicalSkillPromotionApprovalPayload,
  createSkillPromotionApprovalPayload,
} from '../src/organism/learning/AuthenticatedSkillPromotionApproval.ts';

const MAX_STORE_BYTES = 10 * 1024 * 1024;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

export async function createSkillPromotionApprovalRequest({ storePath, candidateId, approverId, approvalId, minShadowRuns = 3, now = Date.now() }) {
  if (!nonEmpty(storePath) || !/^[a-f0-9]{64}$/.test(candidateId ?? '') ||
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
  const [, , storePath, candidateId, approverId, approvalId, rawMinRuns] = process.argv;
  if (!storePath || !candidateId || !approverId || !approvalId) {
    console.error('Usage: node --experimental-strip-types scripts/create-skill-promotion-approval-request.mjs <candidate-store.json> <candidate-id> <approver-id> <approval-id> [min-shadow-runs]');
    process.exitCode = 2;
  } else {
    try {
      const minShadowRuns = rawMinRuns === undefined ? 3 : Number(rawMinRuns);
      const result = await createSkillPromotionApprovalRequest({
        storePath, candidateId, approverId, approvalId, minShadowRuns,
      });
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`skill promotion approval request failed: ${String(error?.message || error)}`);
      process.exitCode = 1;
    }
  }
}
