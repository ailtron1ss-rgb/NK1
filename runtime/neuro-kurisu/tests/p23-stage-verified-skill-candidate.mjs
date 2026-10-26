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
const previousFamilyPolicy = process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON;
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
  const createArtifacts = (baselinePasses, candidatePasses) => {
    const artifacts = [];
    for (let seed = 1; seed <= 5; seed++) {
      for (let i = 0; i < manifest.length; i++) {
        for (const [method, passed] of [
          ['baseline', baselinePasses(i)],
          ['candidate', candidatePasses(i)],
        ]) {
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
    return artifacts;
  };
  // The intended memory family improves by 0.60; tool-use improves by 0.40.
  const artifacts = createArtifacts(i => i < 2, i => i < 7);
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
  const validBundle = {
    schemaVersion: 1, manifest, baselineMethod: 'baseline', candidateMethod: 'candidate', skill,
    artifacts,
  };
  delete process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON;
  await writeFile(bundlePath, JSON.stringify(validBundle));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON is required/,
  );

  // The untrusted candidate bundle cannot select or weaken its promotion policy.
  process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON = JSON.stringify({ [skill.id]: { memory: 0.2 } });
  const embeddedPolicyBundle = {
    ...validBundle,
    promotionPolicy: { minimumFamilyGainByFamily: { memory: 0.0001 } },
  };
  await writeFile(bundlePath, JSON.stringify(embeddedPolicyBundle));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /unknown top-level fields/,
  );

  process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON = JSON.stringify({ [skill.id]: { transfer: 0.01 } });
  await writeFile(bundlePath, JSON.stringify(validBundle));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /not represented in holdout manifest: transfer/,
  );
  process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON = JSON.stringify({ [skill.id]: { memory: 0 } });
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /thresholds must be finite numbers in \(0, 1\]/,
  );

  process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON = JSON.stringify({ [skill.id]: { memory: 0.2 } });
  await writeFile(bundlePath, JSON.stringify(validBundle));
  const staged = await stageVerifiedSkillCandidateBundle({ bundlePath, stateFile });
  assert.equal(staged.status, 'staged');
  assert.equal(staged.skillId, skill.id);
  assert.equal(staged.canActivateAutomatically, false);
  assert.equal(staged.authenticatedEvidenceRows, 100);
  assert.deepEqual(staged.evaluationPolicy.minimumFamilyGainByFamily, { memory: 0.2 });
  assert.ok(staged.familyEvaluation.find(item => item.family === 'memory').absoluteGain >= 0.2,
    'the actual staging path must expose and enforce gain in the skill-scoped family');
  assert.match(staged.candidateId, /^[a-f0-9]{64}$/);

  // Candidate persistence is a separate locked store; a fresh Core reads the durable stage.
  const freshCore = new OrganismCore(new FileStateStore(stateFile));
  const snapshot = freshCore.verifiedSkillCandidateSnapshot();
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0].candidateId, staged.candidateId);
  assert.equal(snapshot.candidates[0].status, 'staged');
  assert.deepEqual(snapshot.active, []);

  const tampered = JSON.parse(JSON.stringify(validBundle));
  tampered.artifacts[0].payload.passed = !tampered.artifacts[0].payload.passed;
  await writeFile(bundlePath, JSON.stringify(tampered));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /signed outcome artifact 0 was rejected: invalid-signature/,
  );
  const afterReject = new OrganismCore(new FileStateStore(stateFile)).verifiedSkillCandidateSnapshot();
  assert.equal(afterReject.candidates.length, 1, 'invalid signed evidence must not stage an extra candidate');
  assert.deepEqual(afterReject.active, [], 'staging never activates a skill');

  const invalidSkill = JSON.parse(JSON.stringify(validBundle));
  invalidSkill.skill.confidence01 = 1.5;
  await writeFile(bundlePath, JSON.stringify(invalidSkill));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /canonical P23 policy-skill bounds/,
  );
  const afterInvalidSkill = new OrganismCore(new FileStateStore(stateFile)).verifiedSkillCandidateSnapshot();
  assert.equal(afterInvalidSkill.candidates.length, 1, 'out-of-range skill scores cannot mutate candidate storage');
  assert.deepEqual(afterInvalidSkill.active, []);

  // An aggregate gain of 0.20 is still rejected when the required memory family has zero gain.
  process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON = JSON.stringify({ [skill.id]: { memory: 0.01 } });
  const zeroMemoryGainBundle = {
    ...validBundle,
    artifacts: createArtifacts(i => i < 6, i => i < 8),
  };
  await writeFile(bundlePath, JSON.stringify(zeroMemoryGainBundle));
  await assert.rejects(
    () => stageVerifiedSkillCandidateBundle({ bundlePath, stateFile }),
    /required-family-gain-below-threshold:memory/,
  );
  const afterFamilyGate = new OrganismCore(new FileStateStore(stateFile)).verifiedSkillCandidateSnapshot();
  assert.equal(afterFamilyGate.candidates.length, 1, 'family-gate rejection must not stage another candidate');
  assert.deepEqual(afterFamilyGate.active, [], 'family-gate rejection must never activate a skill');

  console.log('P23_STAGE_VERIFIED_SKILL_CANDIDATE=PASS explicit family floors required, signed gains scoped, misleading aggregate rejected, durable stage no activation');
} finally {
  if (previousKeys === undefined) delete process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
  else process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = previousKeys;
  if (previousFamilyPolicy === undefined) delete process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON;
  else process.env.NEURO_SKILL_PROMOTION_FAMILY_POLICY_JSON = previousFamilyPolicy;
  await rm(root, { recursive: true, force: true });
}
