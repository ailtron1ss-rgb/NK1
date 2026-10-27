import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AtomicFileSkillStorePersistence } from '../src/organism/learning/AtomicFileSkillStorePersistence.ts';
import { VersionedSkillCandidateStore, InMemorySkillStorePersistence } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { createAuthenticatedSkillPromotionApprovalVerifier, canonicalSkillPromotionApprovalPayload, createSkillPromotionApprovalPayload } from '../src/organism/learning/AuthenticatedSkillPromotionApproval.ts';
import { createContextBoundSkillShadowEvidenceVerifier, signSkillShadowArtifactForFixture, skillShadowPayloadFingerprint } from '../src/organism/learning/VerifiedSkillShadowEvidence.ts';

function proposal(id, accepted=true, authenticatedEvidenceRows=20, unauthenticatedEvidenceRows=0) {
  // Successful fixtures must come from the canonical signed-evidence pipeline.
  if (accepted && unauthenticatedEvidenceRows === 0) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const trustedKeys = new Map([['verifier-v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const manifest = Array.from({ length: 10 }, (_, i) => ({
      taskId: `${id}-task-${i}`, family: i < 5 ? 'memory' : 'tool-use', split: 'holdout',
      promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`${id} unique prompt ${i}`),
      verifierId: 'verifier-v1', version: 'v1',
    }));
    const ledger = new VerifiedOutcomeLedger(manifest);
    for (let seed = 1; seed <= 5; seed++) for (let i = 0; i < manifest.length; i++) {
      for (const [method, passed] of [['baseline', i < 6], ['candidate', i < 8]]) {
        const task = manifest[i];
        const payload = {
          schemaVersion: 1, artifactId: `${id}-artifact-${task.taskId}-${method}-${seed}`,
          runId: `${id}-run-${method}-${seed}`, manifestFingerprint: ledger.manifestFingerprint(),
          taskId: task.taskId, taskVersion: task.version, method, seed, attempt: 1, passed,
          verifierId: task.verifierId, observedAt: Date.now(),
        };
        const artifact = signOutcomePayloadForFixture(payload, privateKeyPem);
        assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, artifact, trustedKeys).accepted, true);
      }
    }
    const generated = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
      minPairedTasks: 8, minAbsoluteGain: 0.1, minCompleteSeeds: 3,
    });
    assert.equal(generated.gate.accepted, true, 'the fixture must produce a genuinely accepted proposal');
    return generated;
  }
  // Negative cases deliberately use caller-constructed objects to prove they cannot cross the trust boundary.
  return {
    schemaVersion: 1, proposalId: id.repeat(64).slice(0, 64), outcomeFingerprint: 'b'.repeat(64),
    gate: { accepted }, canActivateAutomatically: false, authenticatedEvidenceRows, unauthenticatedEvidenceRows,
  };
}
const store = new VersionedSkillCandidateStore(new InMemorySkillStorePersistence(), () => true, () => true, () => true); // explicit test-only promotion, shadow and rollback authority adapters
const defaultDenyStore = new VersionedSkillCandidateStore(new InMemorySkillStorePersistence());
const defaultDenyCandidate = defaultDenyStore.stageCandidate(proposal('f'), 'deny-shadow-test', { instruction: 'must not enter shadow' });
assert.throws(() => defaultDenyStore.recordShadowObservation(defaultDenyCandidate.candidateId, {
  runId: 'unsigned-shadow-run', evidenceFingerprint: '1'.repeat(64), passed: true, observedAt: Date.now(),
}), /not authenticated by the configured evidence verifier/,
  'plausible unsigned shadow metadata must be denied by the default verifier');
assert.equal(defaultDenyStore.snapshot().active.length, 0, 'denied shadow evidence cannot activate a skill');

const p1 = proposal('a');
const forgedProposal = { ...p1 };
assert.throws(() => store.stageCandidate(forgedProposal, 'memory-repair', { instruction: 'forged' }),
  /authentic, accepted proposal/, 'copying every public proposal field cannot forge the module-private issuance identity');
const c1 = store.stageCandidate(p1, 'memory-repair', { instruction: 'version one', schemaVersion: 1 });
assert.equal(c1.version, 1);
assert.equal(c1.status, 'staged');
assert.equal(store.stageCandidate(p1, 'memory-repair', { instruction: 'version one', schemaVersion: 1 }).candidateId, c1.candidateId,
  'repeating the same stage request is idempotent');
assert.throws(() => store.stageCandidate(proposal('c', false), 'memory-repair', { instruction: 'bad' }), /accepted proposal/);
assert.throws(() => store.stageCandidate(proposal('d', true, 20, 1), 'memory-repair', { instruction: 'forged' }), /authenticated evidence/);
assert.throws(() => store.approveAndPromote(c1.candidateId, { approvedBy: 'reviewer', approvedAt: Date.now(), expectedActiveVersion: null }),
  /shadow staging/);
for (let i=1;i<=3;i++) store.recordShadowObservation(c1.candidateId, {
  runId: 'v1-shadow-'+i, evidenceFingerprint: String(i).repeat(64), passed: true, observedAt: Date.now(),
});
const active1 = store.approveAndPromote(c1.candidateId, {
  approvedBy: 'human-reviewer-1', approvedAt: Date.now(), expectedActiveVersion: null,
});
assert.equal(active1.version, 1);
assert.equal(store.snapshot().candidates.find(item => item.candidateId === c1.candidateId).status, 'active');

const p2 = proposal('e');
const c2 = store.stageCandidate(p2, 'memory-repair', { instruction: 'version two', schemaVersion: 1 });
assert.equal(c2.version, 2);
for (let i=1;i<=3;i++) store.recordShadowObservation(c2.candidateId, {
  runId: 'v2-shadow-'+i, evidenceFingerprint: (i+3).toString().repeat(64), passed: true, observedAt: Date.now(),
});
assert.throws(() => store.approveAndPromote(c2.candidateId, {
  approvedBy: 'human-reviewer-1', approvedAt: Date.now(), expectedActiveVersion: null,
}), /compare-and-swap/);
const active2 = store.approveAndPromote(c2.candidateId, {
  approvedBy: 'human-reviewer-1', approvedAt: Date.now(), expectedActiveVersion: 1,
});
assert.equal(active2.version, 2);
assert.equal(store.snapshot().active.find(item => item.skillId === 'memory-repair').version, 2);
const restored = store.rollback(c2.candidateId, { approvedBy: 'human-reviewer-1', approvedAt: Date.now(), expectedActiveVersion: 2 });
assert.equal(restored.version, 1);
assert.equal(restored.payload.instruction, 'version one');
assert.equal(store.snapshot().active.find(item => item.skillId === 'memory-repair').version, 1);
assert.equal(store.snapshot().candidates.find(item => item.candidateId === c2.candidateId).status, 'rolled-back');
assert.equal(store.snapshot().candidates.find(item => item.candidateId === c1.candidateId).status, 'active',
  'rollback restores the prior version lifecycle status as well as its payload');
assert.equal(store.snapshot().candidates.find(item => item.candidateId === c2.candidateId).approval.approvedBy, 'human-reviewer-1',
  'promotion approval is retained as an audit record');
assert.throws(() => store.rollback(c2.candidateId, { approvedBy: 'human-reviewer-1', approvedAt: Date.now(), expectedActiveVersion: 2 }), /currently promoted/);

// The production-safe default denies promotion even if a caller fabricates plausible audit fields.
const denyStore = new VersionedSkillCandidateStore(new InMemorySkillStorePersistence(), () => false, () => true); // allow fixture shadow rows while testing default-deny approval
const denyCandidate = denyStore.stageCandidate(proposal('deny'), 'deny-by-default', { instruction: 'must not activate' });
for (let i=1;i<=3;i++) denyStore.recordShadowObservation(denyCandidate.candidateId, {
  runId: 'deny-shadow-'+i, evidenceFingerprint: (i+6).toString().repeat(64), passed: true, observedAt: Date.now(),
});
assert.throws(() => denyStore.approveAndPromote(denyCandidate.candidateId, {
  approvedBy: 'human-reviewer-1', approvedAt: Date.now(), expectedActiveVersion: null,
}), /not authenticated by the configured authority/,
'approval-shaped fields are not sufficient without an injected authenticated authority');
assert.equal(denyStore.snapshot().active.length, 0, 'default-deny approval must not mutate active skills');

// A real Ed25519 authority signature, rather than caller-supplied audit fields, is required to activate.
const approvalKeys = generateKeyPairSync('ed25519');
const approvalPublicPem = approvalKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const approvalPrivatePem = approvalKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
let approvalClock = Date.now();
const authenticatedApprovalVerifier = createAuthenticatedSkillPromotionApprovalVerifier(
  new Map([['operator-key-1', approvalPublicPem]]),
  { now: () => approvalClock },
);
const signedApprovalPersistence = new InMemorySkillStorePersistence();
const signedApprovalStore = new VersionedSkillCandidateStore(
  signedApprovalPersistence,
  authenticatedApprovalVerifier,
  () => true, // Only the approval authority is under test here; shadow signatures are covered above.
);
const approvalCandidate = signedApprovalStore.stageCandidate(proposal('signed-approval'), 'signed-approval-skill', { instruction: 'signed authority only' });
for (let i = 1; i <= 3; i++) signedApprovalStore.recordShadowObservation(approvalCandidate.candidateId, {
  runId: 'signed-approval-shadow-' + i, evidenceFingerprint: (i + 2).toString().repeat(64), passed: true, observedAt: Date.now(),
});
approvalClock = Date.now(); // Approval must postdate every signed shadow observation.
const approverTime = approvalClock;
const signedPayload = createSkillPromotionApprovalPayload(
  signedApprovalStore.snapshot().candidates[0], 'operator-key-1', 'approval-request-unique-1',
  approverTime, null, 3,
);
const signedArtifact = {
  payload: signedPayload,
  signature: sign(null, Buffer.from(canonicalSkillPromotionApprovalPayload(signedPayload), 'utf8'), approvalPrivatePem).toString('base64'),
};
const tamperedApproval = { approvedBy: 'operator-key-1', approvedAt: approverTime, expectedActiveVersion: null,
  artifact: { ...signedArtifact, payload: { ...signedPayload, shadowEvidenceFingerprint: 'f'.repeat(64) } } };
assert.throws(() => signedApprovalStore.approveAndPromote(approvalCandidate.candidateId, tamperedApproval, 3),
  /not authenticated by the configured authority/,
  'a signature cannot be reused after the candidate evidence digest changes');
assert.equal(signedApprovalStore.snapshot().active.length, 0, 'tampered signature must not activate a skill');
const validApproval = {
  approvedBy: 'operator-key-1', approvedAt: approverTime, expectedActiveVersion: null, artifact: signedArtifact,
};
const signedActive = signedApprovalStore.approveAndPromote(approvalCandidate.candidateId, validApproval, 3);
assert.equal(signedActive.version, 1);
assert.equal(signedApprovalStore.snapshot().candidates[0].approval.artifact.payload.candidateId, approvalCandidate.candidateId);
assert.throws(() => signedApprovalStore.approveAndPromote(approvalCandidate.candidateId, validApproval, 3),
  /must complete shadow staging/,
  'the same signed approval cannot activate the same candidate twice');
approvalClock += 24 * 60 * 60_000;
assert.equal(signedApprovalStore.snapshot().active.length, 1,
  'a valid active skill remains valid across restart after the 15-minute new-approval window expires');
assert.throws(() => new VersionedSkillCandidateStore(signedApprovalPersistence, () => false, () => true),
  /persisted active skill approval failed signature\/context verification/,
  'restoration with an unconfigured approval authority fails closed instead of trusting persisted JSON');
const tamperedActiveSnapshot = JSON.parse(JSON.stringify(signedApprovalPersistence.read()));
tamperedActiveSnapshot.candidates[0].baseVersion = 41; // Not part of candidateId; restore must still bind CAS metadata to the signed approval.
const tamperedPersistence = {
  read: () => JSON.parse(JSON.stringify(tamperedActiveSnapshot)),
  compareAndSwap: () => false,
};
assert.throws(() => new VersionedSkillCandidateStore(tamperedPersistence, authenticatedApprovalVerifier, () => true),
  /promotion CAS\/activation metadata is not bound to the signed approval/,
  'a structurally valid state file cannot rewrite the active skill base-version CAS metadata');

const persistence = new InMemorySkillStorePersistence();
const first = new VersionedSkillCandidateStore(persistence);
const second = new VersionedSkillCandidateStore(persistence);
const staged = first.stageCandidate(proposal('f'), 'tool-use', { instruction: 'safe' });
assert.equal(second.snapshot().candidates.some(item => item.candidateId === staged.candidateId), true,
  'separate store instances observe the same persistence snapshot');

const tempRoot = mkdtempSync(join(tmpdir(), 'nk1-skill-store-'));
try {
  const filePath = join(tempRoot, 'state', 'skills.json');
  const durable = new AtomicFileSkillStorePersistence(filePath);
  const durableStore = new VersionedSkillCandidateStore(durable);
  const durableCandidate = durableStore.stageCandidate(proposal('g'), 'file-backed-skill', { instruction: 'persisted' });
  const afterRestart = new VersionedSkillCandidateStore(new AtomicFileSkillStorePersistence(filePath));
  assert.equal(afterRestart.snapshot().candidates[0].candidateId, durableCandidate.candidateId,
    'atomic file adapter restores candidate state across store reconstruction');
  assert.equal(durable.compareAndSwap(0, { schemaVersion: 1, revision: 1, active: [], candidates: [] }), false,
    'stale revisions cannot overwrite a newer durable snapshot');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

/**
 * WorkPass130: signed receipts must survive JSON restart and be rechecked against
 * trusted execution context, not merely trusted because persistence parsed them.
 */
const shadowKeyPair = generateKeyPairSync('ed25519');
const shadowPublicPem = shadowKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const shadowPrivatePem = shadowKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const shadowKeys = new Map([['trusted-shadow-v1', shadowPublicPem]]);
const trustedManifest = 'e'.repeat(64);
const trustedRuntime = 'nk1-runtime-workpass131';
const trustedRunId = 'wp130-shadow-run';
const trustedTaskId = 'holdout-task-1';
const trustedSeed = 17;
const contextVerifier = createContextBoundSkillShadowEvidenceVerifier(shadowKeys, () => ({
  runId: trustedRunId, taskId: trustedTaskId, seed: trustedSeed,
  manifestFingerprint: trustedManifest, runtimeVersion: trustedRuntime,
}));
const shadowTempRoot = mkdtempSync(join(tmpdir(), 'nk1-signed-shadow-'));
const shadowPath = join(shadowTempRoot, 'state', 'signed-shadow.json');
const shadowPersistence = new AtomicFileSkillStorePersistence(shadowPath);
const shadowStore = new VersionedSkillCandidateStore(shadowPersistence, () => true, contextVerifier);
const shadowCandidate = shadowStore.stageCandidate(proposal('h'), 'persisted-signed-shadow', { instruction: 'verified across restart' });
const shadowPayload = {
  schemaVersion: 1, artifactId: 'wp130-shadow-artifact', candidateId: shadowCandidate.candidateId,
  skillId: shadowCandidate.skillId, candidateVersion: shadowCandidate.version,
  payloadFingerprint: shadowCandidate.payloadFingerprint,
  proposalOutcomeFingerprint: shadowCandidate.proposalOutcomeFingerprint,
  runId: trustedRunId, taskId: trustedTaskId, manifestFingerprint: trustedManifest,
  seed: trustedSeed, runtimeVersion: trustedRuntime, passed: true, observedAt: Date.now(),
  verifierId: 'trusted-shadow-v1',
};
const shadowArtifact = signSkillShadowArtifactForFixture(shadowPayload, shadowPrivatePem);
const shadowObservation = {
  runId: shadowPayload.runId, evidenceFingerprint: skillShadowPayloadFingerprint(shadowPayload),
  passed: true, observedAt: shadowPayload.observedAt, artifact: shadowArtifact,
};
shadowStore.recordShadowObservation(shadowCandidate.candidateId, shadowObservation);
const restoredShadowStore = new VersionedSkillCandidateStore(
  new AtomicFileSkillStorePersistence(shadowPath), () => true, contextVerifier,
);
assert.equal(restoredShadowStore.snapshot().candidates[0].shadowObservations[0].artifact.signature,
  shadowArtifact.signature, 'signed receipt survives durable JSON reconstruction byte-for-byte');
const mismatchedTrustedContexts = [
  [{ runId: 7, taskId: trustedTaskId, seed: trustedSeed,
    manifestFingerprint: trustedManifest, runtimeVersion: trustedRuntime }, 'malformed run ID'],
  [{ runId: 'different-run', taskId: trustedTaskId, seed: trustedSeed,
    manifestFingerprint: trustedManifest, runtimeVersion: trustedRuntime }, 'different run ID'],
  [{ runId: trustedRunId, taskId: 'different-task', seed: trustedSeed,
    manifestFingerprint: trustedManifest, runtimeVersion: trustedRuntime }, 'different task ID'],
  [{ runId: trustedRunId, taskId: trustedTaskId, seed: trustedSeed + 1,
    manifestFingerprint: trustedManifest, runtimeVersion: trustedRuntime }, 'different random seed'],
  [{ runId: trustedRunId, taskId: trustedTaskId, seed: trustedSeed,
    manifestFingerprint: 'f'.repeat(64), runtimeVersion: trustedRuntime }, 'different manifest'],
  [{ runId: trustedRunId, taskId: trustedTaskId, seed: trustedSeed,
    manifestFingerprint: trustedManifest, runtimeVersion: 'different-runtime' }, 'different runtime version'],
];
for (const [trustedContext, label] of mismatchedTrustedContexts) {
  const wrongContextVerifier = createContextBoundSkillShadowEvidenceVerifier(shadowKeys, () => trustedContext);
  const wrongContextStore = new VersionedSkillCandidateStore(
    new AtomicFileSkillStorePersistence(shadowPath), () => true, wrongContextVerifier,
  );
  assert.throws(() => wrongContextStore.approveAndPromote(shadowCandidate.candidateId, {
    approvedBy: 'fixture-authority', approvedAt: Date.now(), expectedActiveVersion: null,
  }, 1), /persisted shadow evidence failed authentication/,
    `signed receipt with ${label} mismatch is denied after restart`);
}
const acceptedAfterRestart = restoredShadowStore.approveAndPromote(shadowCandidate.candidateId, {
  approvedBy: 'fixture-authority', approvedAt: Date.now(), expectedActiveVersion: null,
}, 1);
assert.equal(acceptedAfterRestart.version, shadowCandidate.version,
  'receipt is revalidated and accepted after restart only with matching trusted context');
rmSync(shadowTempRoot, { recursive: true, force: true });

console.log('P23_VERSIONED_SKILL_CANDIDATE_STORE=PASS');
