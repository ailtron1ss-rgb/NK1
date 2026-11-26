import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalConstitutionReviewPayload } from '../src/organism/cognition/evolution/ConstitutionReviewAuthority.ts';

const runtimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(os.tmpdir(), 'nk1-constitution-server-'));
const port = 24000 + Math.floor(Math.random() * 12000);
const hostKey = 'omestro20-server-e2e-hmac-key-minimum-32-bytes';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const reviewerId = 'server-e2e-reviewer';
const env = {
  ...process.env, HOST: '127.0.0.1', PORT: String(port), STATE_DIR: stateDir, NODE_ENV: 'test',
  NEURO_CONSTITUTION_HMAC_KEY: hostKey,
  NEURO_CONSTITUTION_REVIEW_KEYS_JSON: JSON.stringify({ [reviewerId]: publicPem }),
  NEURO_RATE_LIMIT: '240',
};
const baseUrl = `http://127.0.0.1:${port}`;
let child;
let output = '';
const start = async () => {
  output = '';
  child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], { cwd: runtimeRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => output += String(data));
  child.stderr.on('data', data => output += String(data));
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error('runtime exited before ready: ' + output.slice(-2500));
    try {
      const response = await fetch(baseUrl + '/api/health', { signal: AbortSignal.timeout(1200) });
      const value = await response.json();
      if (response.ok && value.ready === true) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('runtime readiness timeout: ' + output.slice(-2500));
};
const stop = async () => {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
};
const post = async (route, value) => {
  const response = await fetch(baseUrl + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value), signal: AbortSignal.timeout(12_000) });
  let data = {}; try { data = await response.json(); } catch {}
  return { status: response.status, data };
};
const get = async route => {
  const response = await fetch(baseUrl + route, { signal: AbortSignal.timeout(8_000) });
  return { status: response.status, data: await response.json() };
};
try {
  await start();
  const initial = await get('/api/organism/constitution');
  assert.equal(initial.status, 200);
  assert.equal(initial.data.active.version, '1.0.0');
  assert.deepEqual(initial.data.reviewAuthority.reviewerIds, [reviewerId]);

  const proposalResponse = await post('/api/organism/constitution/proposals', {
    authorId: 'attacker-controlled-author-id', baseVersion: '1.0.0', change: 'add',
    proposedRule: {
      id: 'workflow.server-e2e-provenance', title: 'Server E2E provenance rule',
      statement: 'Engineering workflows preserve source revision and independently verifiable test evidence.',
      domain: 'workflow', scope: 'Server integration test only.',
    },
    motivation: 'Verify the complete proposal, signature, approval, activation, and rollback path.',
    scope: 'An isolated test runtime.',
    counterexample: 'A workflow reports success without retaining evidence provenance.',
    riskAssessment: { level: 'low', summary: 'A bounded metadata rule is added to disposable state.',
      mitigations: ['Do not execute external side effects.', 'Keep this test state isolated.'] },
    testPlan: ['Accept only a trusted Ed25519 review bound to the exact digest.', 'Consume one-shot owner approval before activation.'],
  });
  assert.equal(proposalResponse.status, 201, JSON.stringify(proposalResponse.data));
  const proposal = proposalResponse.data.proposal;
  assert.equal(proposal.authorId, 'loopback-owner', 'host must ignore caller-supplied author identity');
  assert.equal(proposal.status, 'pending-review');

  const payload = {
    schemaVersion: 1, proposalId: proposal.id, candidateDigest: proposal.candidateDigest, reviewerId,
    decision: 'approve', invariantsPassed: true,
    tests: { planned: 2, executed: 2, passed: 2, failed: 0, holdoutCases: 2, holdoutPassed: true },
    evidenceRefs: ['ci://nk1/server-e2e/constitution-review', 'holdout://nk1/server-e2e/independent'],
    rationale: 'The isolated server contract and independent holdout assertions passed.', at: Date.now(),
  };
  const signPayload = value => sign(null, Buffer.from(canonicalConstitutionReviewPayload(value), 'utf8'), privatePem).toString('base64');
  const forged = { payload: { ...payload, candidateDigest: 'b'.repeat(64) }, signature: signPayload(payload) };
  const forgedResponse = await post(`/api/organism/constitution/proposals/${encodeURIComponent(proposal.id)}/review`, { artifact: forged });
  assert.equal(forgedResponse.status, 403, 'wrong proposal digest must be rejected');
  const approvedReview = { payload, signature: signPayload(payload) };
  const reviewResponse = await post(`/api/organism/constitution/proposals/${encodeURIComponent(proposal.id)}/review`, { artifact: approvedReview });
  assert.equal(reviewResponse.status, 200, JSON.stringify(reviewResponse.data));
  assert.equal(reviewResponse.data.proposal.status, 'awaiting-ratification');

  const ratificationChallenge = await post(`/api/organism/constitution/proposals/${encodeURIComponent(proposal.id)}/ratify`, {});
  assert.equal(ratificationChallenge.status, 403);
  assert.equal(ratificationChallenge.data.approvalRequired, true);
  assert.equal(ratificationChallenge.data.approvalRequest.toolId, 'nk1.system.constitution.ratify');
  assert.equal(ratificationChallenge.data.approvalRequest.permissionClass, 'system');
  assert.equal(ratificationChallenge.data.approvalRequest.operation, 'direct');
  const ratificationId = ratificationChallenge.data.approvalRequest.id;
  const resolved = await post('/api/organism/tools/permissions/resolve', { requestId: ratificationId, approved: true });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.data));
  assert.equal(resolved.data.request.status, 'approved');
  const ratified = await post(`/api/organism/constitution/proposals/${encodeURIComponent(proposal.id)}/ratify`, { approvalId: ratificationId });
  assert.equal(ratified.status, 200, JSON.stringify(ratified.data));
  assert.equal(ratified.data.proposal.status, 'ratified');
  assert.equal(ratified.data.proposal.approval.approverId, 'owner');

  const activated = await post(`/api/organism/constitution/proposals/${encodeURIComponent(proposal.id)}/activate`, {});
  assert.equal(activated.status, 200, JSON.stringify(activated.data));
  assert.equal(activated.data.revision.version, '1.1.0');
  assert.equal(activated.data.revision.rules.length, 1);
  const replay = await post(`/api/organism/constitution/proposals/${encodeURIComponent(proposal.id)}/ratify`, { approvalId: ratificationId });
  assert.equal(replay.status, 409);

  const rollbackReason = 'Server E2E rollback after the test-only activation.';
  const rollbackChallenge = await post('/api/organism/constitution/rollback', { targetVersion: '1.0.0', reason: rollbackReason });
  assert.equal(rollbackChallenge.status, 403);
  assert.equal(rollbackChallenge.data.approvalRequired, true);
  assert.equal(rollbackChallenge.data.approvalRequest.toolId, 'nk1.system.constitution.rollback');
  const rollbackId = rollbackChallenge.data.approvalRequest.id;
  const rollbackApproved = await post('/api/organism/tools/permissions/resolve', { requestId: rollbackId, approved: true });
  assert.equal(rollbackApproved.status, 200);
  const rollback = await post('/api/organism/constitution/rollback', { targetVersion: '1.0.0', reason: rollbackReason, approvalId: rollbackId });
  assert.equal(rollback.status, 200, JSON.stringify(rollback.data));
  assert.equal(rollback.data.revision.version, '1.2.0');
  assert.equal(rollback.data.revision.rollbackOf, '1.0.0');
  assert.equal(rollback.data.revision.rules.length, 0);

  const finalState = await get('/api/organism/constitution');
  assert.equal(finalState.data.active.version, '1.2.0');
  assert.ok(finalState.data.auditEvents.some(event => event.type === 'constitution.rollback'));
  const permissionState = await get('/api/organism/tools/permissions');
  assert.equal(permissionState.data.permissions.consumed, 2);
  assert.ok(permissionState.data.permissions.requests.filter(row => row.status === 'consumed').length >= 2);
  console.log('OMESTRO_20_CONSTITUTION_SERVER_E2E=PASS proposal=1 signed-review=1 owner-approvals=2 activation=1 rollback=1');
} finally {
  await stop();
  await rm(stateDir, { recursive: true, force: true });
}
