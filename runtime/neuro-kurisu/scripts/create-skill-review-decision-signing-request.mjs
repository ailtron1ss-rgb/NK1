import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AtomicFileSkillReviewInboxPersistence } from '../src/organism/learning/AtomicFileSkillReviewInboxPersistence.mjs';
import { HexisSkillReviewInbox } from '../src/organism/learning/HexisSkillReviewInbox.ts';
import {
  canonicalSkillReviewDecisionPayload,
  createSkillReviewDecisionSigningPayload,
} from '../src/organism/learning/AuthenticatedSkillReviewDecision.ts';

const MAX_INBOX_BYTES = 10 * 1024 * 1024;
const isText = value => typeof value === 'string' && value.trim().length > 0;

/**
 * Create an unsigned, canonical payload for an external reviewer/approval service.
 * This command never loads or handles the review private key.
 */
export async function createSkillReviewDecisionSigningRequest({ reviewInboxPath, reviewId, keyId }) {
  if (!isText(reviewInboxPath) || !/^[a-f0-9]{64}$/.test(reviewId ?? '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(keyId ?? '')) {
    throw new Error('review inbox path, SHA-256 review ID and trusted signing key ID are required');
  }
  const absolutePath = path.resolve(reviewInboxPath);
  const info = await lstat(absolutePath);
  if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_INBOX_BYTES) {
    throw new Error('skill review inbox must be a regular non-symlink file no larger than 10 MiB');
  }
  const inbox = new HexisSkillReviewInbox(new AtomicFileSkillReviewInboxPersistence(absolutePath));
  const review = inbox.snapshot().records.find(record => record.packet.reviewId === reviewId);
  if (!review) throw new Error('matching skill review ID is absent from the durable review inbox');
  const payload = createSkillReviewDecisionSigningPayload(review, keyId);
  return {
    schemaVersion: 1,
    status: 'unsigned-review-decision-signing-request',
    algorithm: 'Ed25519',
    keyId,
    reviewId,
    payload,
    canonicalPayload: canonicalSkillReviewDecisionPayload(payload),
    warning: 'This payload is unsigned. An independent authenticated reviewer/approval service must sign canonicalPayload with the private key for keyId; never put that private key into NK1 or its environment.',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const [, , reviewInboxPath, reviewId, keyId] = process.argv;
  if (!reviewInboxPath || !reviewId || !keyId) {
    console.error('Usage: node --experimental-strip-types scripts/create-skill-review-decision-signing-request.mjs <review-inbox.json> <review-id> <trusted-key-id>');
    process.exitCode = 2;
  } else {
    try {
      console.log(JSON.stringify(await createSkillReviewDecisionSigningRequest({ reviewInboxPath, reviewId, keyId })));
    } catch (error) {
      console.error('skill review decision signing request failed: ' + String(error?.message || error));
      process.exitCode = 1;
    }
  }
}
