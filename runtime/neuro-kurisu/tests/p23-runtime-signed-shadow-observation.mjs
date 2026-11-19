import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { computeVersionedSkillCandidateId } from '../src/organism/learning/VersionedSkillCandidateStore.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-signed-shadow-e2e-'));
const priorKeys = process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const verifierId = 'p23-e2e-verifier';
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = JSON.stringify({ [verifierId]: publicPem });
let runtime;
try {
  const manifest = Array.from({ length: 10 }, (_, i) => ({
    taskId: `e2e-task-${i}`,
    family: i < 5 ? 'memory' : 'tool-use',
    split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(`unique e2e prompt ${i}`),
    verifierId,
    version: 'v1',
  }));
  const ledger = new VerifiedOutcomeLedger(manifest);
  const signOutcome = (task, method, seed, passed) => {
    const payload = {
      schemaVersion: 1,
      artifactId: `e2e-${task.taskId}-${method}-${seed}`,
      runId: `e2e-run-${method}-${seed}`,
      manifestFingerprint: ledger.manifestFingerprint(),
      taskId: task.taskId,
      taskVersion: task.version,
      method,
      seed,
      attempt: 1,
      passed,
      verifierId,
      observedAt: Date.now(),
    };
    return ingestSignedOutcomeArtifact(ledger, manifest, signOutcomePayloadForFixture(payload, privatePem),
      new Map([[verifierId, publicPem]]));
  };
  for (let seed = 1; seed <= 5; seed++) {
    for (let i = 0; i < manifest.length; i++) {
      assert.equal(signOutcome(manifest[i], 'baseline', seed, i < 6).accepted, true);
      assert.equal(signOutcome(manifest[i], 'candidate', seed, i < 8).accepted, true);
    }
  }
  const proposal = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
    minPairedTasks: 8, minAbsoluteGain: 0.1, minCompleteSeeds: 3,
  });
  assert.equal(proposal.gate.accepted, true, 'candidate fixture must be backed by accepted signed holdout evidence');

  const skill = {
    id: 'e2e-memory-repair',
    contextKey: 'recall:missing-item',
    action: 'verify',
    totalUses: 12,
    trainUses: 8,
    validationUses: 4,
    trainSuccess01: 0.7,
    validationSuccess01: 0.75,
    confidence01: 0.72,
    status: 'candidate',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    validationWindowStartTick: 0,
    validationWindowEndTick: 10,
  };
  const canonical = value => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  };
  const payloadFingerprint = createHash('sha256').update(canonical(skill)).digest('hex');
  const expectedCandidateId = computeVersionedSkillCandidateId({
    skillId: skill.id,
    version: 1,
    proposalId: proposal.proposalId,
    payloadFingerprint,
  });
  const runtimeVersion = 'nk1-e2e-runtime-145';
  const stateFile = path.join(root, 'organism.json');
  const observationFileName = 'verified-skill-shadow-observation.json';

  const childCode = [
    "const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');",
    "function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}",
    "const payload={schemaVersion:1,artifactId:'shadow-'+process.env.NK1_LEARNING_RUN_ID,candidateId:process.env.NK1_TEST_CANDIDATE_ID,skillId:process.env.NK1_TEST_SKILL_ID,candidateVersion:Number(process.env.NK1_TEST_CANDIDATE_VERSION),payloadFingerprint:process.env.NK1_TEST_PAYLOAD_FINGERPRINT,proposalOutcomeFingerprint:process.env.NK1_TEST_PROPOSAL_OUTCOME_FINGERPRINT,runId:process.env.NK1_LEARNING_RUN_ID,taskId:process.env.NK1_LEARNING_TASK_ID,manifestFingerprint:process.env.NK1_LEARNING_MANIFEST_FINGERPRINT,seed:Number(process.env.NK1_LEARNING_SEED),runtimeVersion:process.env.NK1_TEST_RUNTIME_VERSION,passed:true,observedAt:Date.now(),verifierId:process.env.NK1_TEST_VERIFIER_ID};",
    "const bytes=Buffer.from(canonical(payload),'utf8');",
    "const signature=crypto.sign(null,bytes,process.env.NK1_TEST_SHADOW_PRIVATE_KEY).toString('base64');",
    "const evidenceFingerprint=crypto.createHash('sha256').update(bytes).digest('hex');",
    "const observation={runId:payload.runId,evidenceFingerprint,passed:payload.passed,observedAt:payload.observedAt,artifact:{payload,signature}};",
    "fs.writeFileSync(path.join(process.env.NK1_LEARNING_RUN_DIR,process.env.NK1_LEARNING_SIGNED_OBSERVATION_FILENAME),JSON.stringify(observation));",
    "process.stdout.write('signed-shadow-observation-written');",
  ].join('\n');

  runtime = new OrganismRuntime({
    stateFile,
    autoRun: false,
    enableLanguage: false,
    journal: { write: async () => {} },
    trustedShadowLearning: {
      enabled: true,
      intervalMs: 300_000,
      initialDelayMs: 300_000,
      runtimeVersion,
      taskId: 'e2e-task-0',
      taskVersion: 'v1',
      candidateId: expectedCandidateId,
      manifestFingerprint: proposal.manifestFingerprint,
      planFingerprint: 'd'.repeat(64),
      command: {
        executable: process.execPath,
        args: ['-e', childCode],
        cwd: process.cwd(),
        runRoot: path.join(root, 'runs'),
        surviveDir: path.join(root, 'survive'),
        timeoutMs: 5000,
        maxOutputBytes: 8192,
        env: {
          NK1_TEST_SHADOW_PRIVATE_KEY: privatePem,
          NK1_TEST_CANDIDATE_ID: expectedCandidateId,
          NK1_TEST_SKILL_ID: skill.id,
          NK1_TEST_CANDIDATE_VERSION: '1',
          NK1_TEST_PAYLOAD_FINGERPRINT: payloadFingerprint,
          NK1_TEST_PROPOSAL_OUTCOME_FINGERPRINT: proposal.outcomeFingerprint,
          NK1_TEST_RUNTIME_VERSION: runtimeVersion,
          NK1_TEST_VERIFIER_ID: verifierId,
        },
      },
    },
  });
  const staged = runtime.core.stageVerifiedSkillCandidate(proposal, skill);
  assert.equal(staged.candidateId, expectedCandidateId);
  assert.equal(staged.status, 'staged');
  await runtime.init();

  const result = await runtime.runTrustedShadowLearningOnce();
  assert.equal(result.receipt.status, 'completed');
  assert.match(result.receipt.stdout, /signed-shadow-observation-written/);
  const diagnostics = runtime.trustedShadowLearningDiagnostics();
  assert.equal(diagnostics.lastEvidenceStatus, 'accepted', diagnostics.lastEvidenceError ?? 'signed shadow evidence should be accepted');
  assert.equal(diagnostics.lastError, null);

  const lifecycle = runtime.core.verifiedSkillCandidateSnapshot();
  const candidate = lifecycle.candidates.find(item => item.candidateId === staged.candidateId);
  assert.ok(candidate);
  assert.equal(candidate.status, 'shadow');
  assert.equal(candidate.shadowObservations.length, 1);
  assert.equal(candidate.shadowObservations[0].runId, result.receipt.runId);
  assert.equal(candidate.shadowObservations[0].artifact.payload.seed, diagnostics.lastSeed);
  assert.equal(candidate.shadowObservations[0].artifact.payload.manifestFingerprint, proposal.manifestFingerprint);
  assert.deepEqual(lifecycle.active, [], 'trusted shadow evidence must not auto-promote or activate a candidate');

  const registryPath = `${stateFile}.trusted-skill-shadow-runs.json`;
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  assert.equal(registry.runs.length, 1);
  assert.equal(registry.runs[0].runId, result.receipt.runId);
  console.log('P23_RUNTIME_SIGNED_SHADOW_OBSERVATION=PASS real Core staging durable registration signature/context binding no-auto-promotion');
} finally {
  if (runtime) await runtime.stop().catch(() => {});
  if (priorKeys === undefined) delete process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON;
  else process.env.NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON = priorKeys;
  await rm(root, { recursive: true, force: true });
}
