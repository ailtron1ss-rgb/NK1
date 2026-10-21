import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AtomicFileTrustedSkillShadowRunRegistry } from '../src/organism/learning/TrustedSkillShadowRunRegistry.ts';
import { createVerifiedSkillLifecycleBootstrap } from '../src/organism/learning/VerifiedSkillLifecycleBootstrap.ts';
import { signOutcomePayloadForFixture, ingestSignedOutcomeArtifact } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import {
  canonicalSkillPromotionApprovalPayload,
  createSkillPromotionApprovalPayload,
} from '../src/organism/learning/AuthenticatedSkillPromotionApproval.ts';
import {
  signSkillShadowArtifactForFixture,
  skillShadowPayloadFingerprint,
} from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

const root = mkdtempSync(join(tmpdir(), 'nk1-workpass239-e2e-'));
const fingerprint = (char) => char.repeat(64);
try {
  const verifier = generateKeyPairSync('ed25519');
  const verifierPublic = verifier.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const verifierPrivate = verifier.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const approver = generateKeyPairSync('ed25519');
  const approverPublic = approver.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const approverPrivate = approver.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const verifierKeys = JSON.stringify({ 'shadow-verifier-v1': verifierPublic });
  const approvalKeys = JSON.stringify({ 'promotion-operator-1': approverPublic });
  const candidatePath = join(root, 'candidates.json');
  const registryPath = join(root, 'trusted-runs.json');

  // Build a real proposal from signed, manifest-bound paired outcomes. This is
  // fixture evidence, but it traverses the same canonical trust boundary as runtime.
  const manifest = Array.from({ length: 10 }, (_, i) => ({
    taskId: `task-${i}`,
    family: i < 5 ? 'memory' : 'tool-use',
    split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`workpass239 prompt ${i}`),
    verifierId: 'outcome-verifier-v1',
    version: 'v1',
  }));
  const ledger = new VerifiedOutcomeLedger(manifest);
  const manifestFingerprint = ledger.manifestFingerprint();
  for (let seed = 1; seed <= 5; seed++) {
    for (let i = 0; i < manifest.length; i++) {
      for (const [method, passed] of [['baseline', i < 6], ['candidate', i < 8]]) {
        const task = manifest[i];
        const payload = {
          schemaVersion: 1,
          artifactId: `wp239-${task.taskId}-${method}-${seed}`,
          runId: `wp239-run-${method}-${seed}`,
          manifestFingerprint,
          taskId: task.taskId,
          taskVersion: task.version,
          method,
          seed,
          attempt: 1,
          passed,
          verifierId: task.verifierId,
          observedAt: Date.now(),
        };
        const artifact = signOutcomePayloadForFixture(payload, verifierPrivate);
        const accepted = ingestSignedOutcomeArtifact(ledger, manifest, artifact,
          new Map([['outcome-verifier-v1', verifierPublic]]));
        assert.equal(accepted.accepted, true, 'signed manifest-bound outcome must enter the canonical ledger');
      }
    }
  }
  const proposal = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
    minPairedTasks: 8, minAbsoluteGain: 0.1, minCompleteSeeds: 3,
  });
  assert.equal(proposal.gate.accepted, true, 'paired signed outcome fixture must pass the proposal gate');

  const first = createVerifiedSkillLifecycleBootstrap(candidatePath, registryPath, verifierKeys, approvalKeys);
  const staged = first.store.stageCandidate(proposal, 'memory-repair', {
    instruction: 'verified repair policy v1',
    strategy: 'bounded-retry-after-independent-verification',
  });
  assert.equal(staged.status, 'staged');

  const observations = [];
  for (let i = 0; i < 3; i++) {
    const context = {
      runId: `wp239-shadow-run-${i + 1}`,
      taskId: manifest[i].taskId,
      seed: 101 + i,
      manifestFingerprint,
      runtimeVersion: 'nk1-workpass239-e2e',
    };
    first.registry.register(context);
    const payload = {
      schemaVersion: 1,
      artifactId: `wp239-shadow-artifact-${i + 1}`,
      candidateId: staged.candidateId,
      skillId: staged.skillId,
      candidateVersion: staged.version,
      payloadFingerprint: staged.payloadFingerprint,
      proposalOutcomeFingerprint: staged.proposalOutcomeFingerprint,
      runId: context.runId,
      taskId: context.taskId,
      manifestFingerprint: context.manifestFingerprint,
      seed: context.seed,
      runtimeVersion: context.runtimeVersion,
      passed: true,
      observedAt: Date.now(),
      verifierId: 'shadow-verifier-v1',
    };
    const artifact = signSkillShadowArtifactForFixture(payload, verifierPrivate);
    const observation = {
      runId: context.runId,
      evidenceFingerprint: skillShadowPayloadFingerprint(payload),
      passed: payload.passed,
      observedAt: payload.observedAt,
      artifact,
    };
    first.store.recordShadowObservation(staged.candidateId, observation);
    observations.push(observation);
  }

  // Reconstruct both durable authorities as if the host process restarted.
  const afterRestart = createVerifiedSkillLifecycleBootstrap(candidatePath, registryPath, verifierKeys, approvalKeys);
  assert.equal(afterRestart.store.snapshot().candidates.find(x => x.candidateId === staged.candidateId).shadowObservations.length, 3);
  assert.equal(afterRestart.registry.snapshot().runs.length, 3);
  assert.throws(
    () => afterRestart.store.recordShadowObservation(staged.candidateId, observations[0]),
    /duplicate shadow run id/,
    'a signed receipt replay must not count twice after restart',
  );

  const candidate = afterRestart.store.snapshot().candidates.find(x => x.candidateId === staged.candidateId);
  const approvedAt = Date.now();
  const approvalPayload = createSkillPromotionApprovalPayload(
    candidate, 'promotion-operator-1', 'wp239-approval-1', approvedAt, null, 3,
  );
  const approvalSignature = sign(
    null,
    Buffer.from(canonicalSkillPromotionApprovalPayload(approvalPayload), 'utf8'),
    approver.privateKey,
  ).toString('base64');
  const approval = {
    approvedBy: 'promotion-operator-1',
    approvedAt,
    expectedActiveVersion: null,
    artifact: { payload: approvalPayload, signature: approvalSignature },
  };
  const active = afterRestart.store.approveAndPromote(staged.candidateId, approval, 3);
  assert.equal(active.version, 1);
  assert.equal(active.payload.instruction, 'verified repair policy v1');

  // The activated state is itself reconstructed and re-authenticated on startup.
  const finalRestart = createVerifiedSkillLifecycleBootstrap(candidatePath, registryPath, verifierKeys, approvalKeys);
  assert.equal(finalRestart.store.snapshot().active[0].payloadFingerprint, staged.payloadFingerprint);
  assert.equal(finalRestart.store.snapshot().active[0].version, 1);
  assert.throws(
    () => finalRestart.store.recordShadowObservation(staged.candidateId, observations[1]),
    /not eligible for shadow evaluation/,
    'a replay after activation cannot reopen or mutate the active candidate',
  );
  assert.throws(
    () => finalRestart.store.approveAndPromote(staged.candidateId, approval, 3),
    /candidate must complete shadow staging/,
    'a consumed approval cannot promote the same candidate a second time',
  );

  console.log('WORKPASS239_DURABLE_SIGNED_PROMOTION_E2E=PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
