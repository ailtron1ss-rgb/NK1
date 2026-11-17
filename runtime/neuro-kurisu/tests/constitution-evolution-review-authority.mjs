import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  canonicalConstitutionReviewPayload,
  createAuthenticatedConstitutionReviewVerifier,
  parseTrustedConstitutionReviewKeys,
} from '../src/organism/cognition/evolution/ConstitutionReviewAuthority.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trusted = parseTrustedConstitutionReviewKeys(JSON.stringify({ 'independent-reviewer-1': publicPem }));
assert.equal(trusted.size, 1);
assert.throws(() => parseTrustedConstitutionReviewKeys(JSON.stringify({ reviewer: 'not-a-public-key' })), /Ed25519/);
assert.throws(() => parseTrustedConstitutionReviewKeys(JSON.stringify(Object.fromEntries(
  Array.from({ length: 17 }, (_, i) => ['reviewer-' + i, publicPem])
))), /16-key limit/);

const expected = {
  proposalId: 'constitution-proposal-001',
  candidateDigest: 'a'.repeat(64),
  authorId: 'loopback-owner',
  testPlanCount: 2,
};
const payload = {
  schemaVersion: 1,
  proposalId: expected.proposalId,
  candidateDigest: expected.candidateDigest,
  reviewerId: 'independent-reviewer-1',
  decision: 'approve',
  invariantsPassed: true,
  tests: { planned: 2, executed: 2, passed: 2, failed: 0, holdoutCases: 3, holdoutPassed: true },
  evidenceRefs: ['ci://nk1/constitution/unit/123', 'holdout://nk1/constitution/seeded/42'],
  rationale: 'Independent clean-run and holdout evidence reviewed.',
  at: 95_000,
};
const signPayload = value => sign(null, Buffer.from(canonicalConstitutionReviewPayload(value), 'utf8'), privatePem).toString('base64');
const artifact = { payload, signature: signPayload(payload) };
const verifier = createAuthenticatedConstitutionReviewVerifier(trusted, { now: () => 100_000, maxAgeMs: 15_000, allowedClockSkewMs: 1_000 });
const accepted = verifier(artifact, expected);
assert.ok(accepted, 'trusted fresh reviewer signature with matching proposal digest is accepted');
assert.equal(accepted.reviewerId, 'independent-reviewer-1');
assert.equal(accepted.candidateDigest, expected.candidateDigest);
assert.equal(accepted.tests.holdoutCases, 3);

// Payload changes, stale/future approvals, author self-review, and untrusted keys fail closed.
const alteredDigest = { ...artifact, payload: { ...payload, candidateDigest: 'b'.repeat(64) } };
assert.equal(verifier(alteredDigest, expected), null);
const stale = { ...payload, at: 1 };
assert.equal(verifier({ payload: stale, signature: signPayload(stale) }, expected), null);
const future = { ...payload, at: 102_000 };
assert.equal(verifier({ payload: future, signature: signPayload(future) }, expected), null);
const selfReview = { ...payload, reviewerId: expected.authorId };
assert.equal(verifier({ payload: selfReview, signature: signPayload(selfReview) }, expected), null);
const untrusted = { ...payload, reviewerId: 'unknown-reviewer' };
assert.equal(verifier({ payload: untrusted, signature: signPayload(untrusted) }, expected), null);
assert.equal(verifier({ payload, signature: 'AAAA' }, expected), null);

// Approvals must prove every planned test passed and include independent holdout cases.
const failedTests = { ...payload, tests: { ...payload.tests, passed: 1, failed: 1 } };
assert.equal(verifier({ payload: failedTests, signature: signPayload(failedTests) }, expected), null);
const missingHoldout = { ...payload, tests: { ...payload.tests, holdoutCases: 0 } };
assert.equal(verifier({ payload: missingHoldout, signature: signPayload(missingHoldout) }, expected), null);
const wrongPlan = { ...payload, tests: { ...payload.tests, planned: 3, executed: 3, passed: 3 } };
assert.equal(verifier({ payload: wrongPlan, signature: signPayload(wrongPlan) }, expected), null);
const noEvidence = { ...payload, evidenceRefs: [] };
assert.equal(verifier({ payload: noEvidence, signature: signPayload(noEvidence) }, expected), null);

const reject = { ...payload, decision: 'reject', rationale: 'A required invariant was not preserved.' };
assert.ok(verifier({ payload: reject, signature: signPayload(reject) }, expected));
const shuffled = { at: payload.at, rationale: payload.rationale, ...payload };
assert.equal(canonicalConstitutionReviewPayload(shuffled), canonicalConstitutionReviewPayload(payload));

console.log('OMESTRO_20_CONSTITUTION_REVIEW_AUTHORITY=PASS checks=14');
