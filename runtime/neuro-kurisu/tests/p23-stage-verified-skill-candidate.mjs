import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { stageVerifiedSkillCandidateBundle } from '../scripts/stage-verified-skill-candidate.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-stage-verified-candidate-'));
const previousKeys = process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
try {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const verifierId = 'stage-fixture-verifier';
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = JSON.stringify({ [verifierId]: publicPem });

  const manifest = Array.from({ length: 10 }, (_, i) => ({
    taskId: `stage-task-${i}`,
    family: i < 5 ? 'memory' : 'tool-use',
    split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`unique stage prompt ${i}`),
    verifierId,
    version: 'v1',
  }));
  const ledger = new VerifiedOutcomeLedger(manifest);
  const artifacts = [];
  for (let seed = 1; seed <= 5; seed++) {
    for (let i = 0; i < manifest.length; i++) {
      for (const [method, passed] of [['baseline', i < 6], ['candidate', i < 8]]) {
        const task = manifest[i];
        artifacts.push(signOutcomePayloadForFixture({
          schemaVersion: 1,
          artifactId: `stage-${task.taskId}-${method}-${seed}`,
          runId: `stage-run-${method}-${seed}`,
          manifestFingerprint: ledger.manifestFingerprint(),
          taskId: task.taskId,
          taskVersion: task.version,
          method,
          seed,
          attempt: 1,
          passed,
          verifierId,
          observedAt: Date.now(),
        }, privatePem));
      }
    }
  }
  const skill = {
    id: 'stage-memory-repair',
    contextKey: 'recall:partial',
    action: 'verify',
    totalUses: 20,
    trainUses: 12,
    validationUses: 8,
    trainSuccess01: 0.71,
    validationSuccess01: 0.76,
    confidence01: 0.74,
    status: 'candidate',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    validationWindowStartTick: 4,
    validationWindowEndTick: 24,
  };
  const bundlePath = path.join(root, 'signed-outcome-bundle.json');
  const stateFile = path.join(root, 'organism.json');
  await writeFile(bundlePath, JSON.stringify({
    schemaVersion: 1, manifest, baselineMethod: 'baseline', candidateMethod: 'candidate', skill, artifacts,
  }));
  const staged = await stageVerifiedSkillCandidateBundle({ bundlePath, stateFile });
  assert.equal(staged.status, 'staged');
  assert.equal(staged.skillId, skill.id);
  assert.equal(staged.canActivateAutomatically, false);
  assert.equal(staged.authenticatedEvidenceRows, 100);
  assert.match(staged.candidateId, /^[a-f0-9]{64}$/);

  // Candidate persistence is a separate locked store; a fresh Core reads the durable stage.
  const freshCore = new OrganismCore(new FileStateStore(stateFile));
  const snapshot = freshCore.verifiedSkillCandidateSnapshot();
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0].candidateId, staged.candidateId);
  assert.equal(snapshot.candidates[0].status, 'staged');
  assert.deepEqual(snapshot.active, []);

  const tampered = JSON.parse(await readFile(bundlePath, 'utf8'));
  tampered.artifacts[0].payload.passed = !tampered.artifacts[0].payload.passed;
  await writeFile(bundlePath, JSON.stringify(tampered));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /signed outcome artifact 0 was rejected: invalid-signature/,
  );
  const afterReject = new OrganismCore(new FileStateStore(stateFile)).verifiedSkillCandidateSnapshot();
  assert.equal(afterReject.candidates.length, 1, 'invalid signed evidence must not stage an extra candidate');
  assert.deepEqual(afterReject.active, [], 'staging never activates a skill');
  console.log('P23_STAGE_VERIFIED_SKILL_CANDIDATE=PASS signed outcomes gate stage only and fail closed');
} finally {
  if (previousKeys === undefined) delete process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
  else process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = previousKeys;
  await rm(root, { recursive: true, force: true });
}
