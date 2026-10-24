import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  ingestSignedOutcomeArtifact, signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import {
  AtomicFileSkillReviewInboxPersistence, HexisSkillReviewInbox,
  assertSkillReviewReadyForSignedPromotion,
} from '../src/organism/learning/HexisSkillReviewInbox.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const verifierId = 'omega-fixture-verifier';
const manifest = Array.from({ length: 8 }, (_, i) => ({
  taskId: 'omega-task-' + i,
  family: ['memory', 'reasoning', 'transfer'][i % 3],
  split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('Omega verified task prompt ' + i),
  verifierId,
  version: '1',
}));
const ledger = new VerifiedOutcomeLedger(manifest);
const trustedKeys = new Map([[verifierId, publicPem]]);
let artifactCount = 0;
for (let seed = 0; seed < 3; seed++) {
  for (const task of manifest) {
    for (const method of ['baseline', 'candidate']) {
      const payload = {
        schemaVersion: 1,
        artifactId: 'omega-artifact-' + artifactCount++,
        runId: 'omega-run-' + seed + '-' + task.taskId + '-' + method,
        manifestFingerprint: ledger.manifestFingerprint(),
        taskId: task.taskId,
        taskVersion: task.version,
        method,
        seed,
        attempt: 1,
        passed: method === 'candidate',
        verifierId,
        observedAt: 1_800_000_000_000 + artifactCount,
      };
      const artifact = signOutcomePayloadForFixture(payload, privatePem);
      const result = ingestSignedOutcomeArtifact(ledger, manifest, artifact, trustedKeys);
      assert.equal(result.accepted, true, 'the signed fixture outcome must enter the evidence ledger');
    }
  }
}
const proposal = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate');
assert.equal(proposal.gate.accepted, true, 'independent paired evidence should produce an accepted proposal');
assert.equal(proposal.unauthenticatedEvidenceRows, 0);
assert.equal(proposal.completePairedSeeds, 3);

const skillId = 'omega-memory-skill';
const payload = { instructions: 'A review-only fixture; not a live skill.' };
const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
};
const artifactFingerprint = createHash('sha256').update(canonical(payload)).digest('hex');
const proposalId = proposal.proposalId;
const candidateId = createHash('sha256').update(JSON.stringify([
  skillId, 1, proposalId, artifactFingerprint,
])).digest('hex');
const candidate = {
  candidateId,
  skillId,
  version: 1,
  payload,
  payloadFingerprint: artifactFingerprint,
  proposalId,
  proposalOutcomeFingerprint: proposal.outcomeFingerprint,
  baseVersion: null,
  previousActive: null,
  status: 'shadow',
  shadowObservations: [{
    runId: 'omega-shadow-run-1',
    evidenceFingerprint: 'd'.repeat(64),
    passed: true,
    observedAt: 1_800_000_000_100,
  }],
  createdAt: 1_800_000_000_000,
};

const root = mkdtempSync(path.join(os.tmpdir(), 'nk1-omega-review-'));
try {
  const inboxPath = path.join(root, 'skill-review-inbox.json');
  const persistence = new AtomicFileSkillReviewInboxPersistence(inboxPath);
  const inbox = new HexisSkillReviewInbox(persistence);
  const submitted = inbox.submit(proposal, candidate, 1_800_000_000_300);
  assert.equal(submitted.status, 'pending');
  assert.equal(submitted.packet.candidateId, candidate.candidateId);
  assert.equal(submitted.packet.artifactFingerprint, artifactFingerprint);
  assert.equal(submitted.packet.authenticatedEvidenceRows, proposal.authenticatedEvidenceRows);
  assert.equal(submitted.packet.evaluation.absoluteGain, 1);
  assert.equal(JSON.stringify(submitted.packet).includes('Omega verified task prompt'), false,
    'the human review packet must not expose raw holdout prompts');
  assert.equal(inbox.submit(proposal, candidate, 1_800_000_000_010).packet.reviewId, submitted.packet.reviewId,
    'identical evidence packet submissions must be idempotent');
  assert.throws(() => assertSkillReviewReadyForSignedPromotion(submitted, candidate),
    /completed positive human review/,
    'a pending review must not be accepted as authorization to request signed promotion');

  const approved = inbox.decide(submitted.packet.reviewId, {
    outcome: 'approve', reviewerId: 'reviewer-omega', rationale: 'Evidence and regression summaries reviewed',
    decidedAt: 1_800_000_000_320,
  });
  assert.equal(approved.status, 'approved-for-signed-promotion');
  assert.doesNotThrow(() => assertSkillReviewReadyForSignedPromotion(approved, candidate));
  assert.throws(() => inbox.decide(submitted.packet.reviewId, {
    outcome: 'reject', reviewerId: 'reviewer-omega', rationale: 'Contradictory duplicate decision',
    decidedAt: 1_800_000_000_330,
  }), /already has a final decision/);

  const staleCandidate = {
    ...candidate,
    payloadFingerprint: 'e'.repeat(64),
  };
  assert.throws(() => assertSkillReviewReadyForSignedPromotion(approved, staleCandidate), /stale or bound to another/);

  const reopened = new HexisSkillReviewInbox(new AtomicFileSkillReviewInboxPersistence(inboxPath));
  assert.equal(reopened.snapshot().revision, 2, 'the packet and decision must persist over restart');
  assert.equal(reopened.getForCandidate(candidateId).status, 'approved-for-signed-promotion');

  const tampered = reopened.snapshot();
  tampered.records[0].packet.artifactFingerprint = 'f'.repeat(64);
  writeFileSync(inboxPath, JSON.stringify(tampered), 'utf8');
  assert.throws(() => new HexisSkillReviewInbox(new AtomicFileSkillReviewInboxPersistence(inboxPath)), /digest|snapshot|packet/i,
    'the digest-bound review packet must reject on-disk tampering');

  const fake = { ...proposal, proposalId: '9'.repeat(64) };
  assert.throws(() => inbox.submit(fake, candidate, 1_800_000_000_340), /authentic proposal/);
  console.log('OPERATION_OMEGA_HEXIS_REVIEW_INBOX=PASS signed evidence -> review packet -> durable human decision; activation remains separately signed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
