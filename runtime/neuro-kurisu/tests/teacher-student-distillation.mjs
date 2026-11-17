import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, verify as verifySignature } from 'node:crypto';
import {
  TeacherStudentDistillationDataset,
  createTeacherDistillationPayload,
  signTeacherDistillationPayloadForFixture,
  writeTeacherDistillationExport,
  createLlamaFactorySftConfig,
  canonicalTeacherDistillationPayload,
} from '../src/organism/learning/TeacherStudentDistillation.ts';
import { TeacherStudentDistillationGate } from '../src/organism/learning/TeacherStudentDistillationGate.ts';
import { runTeacherStudentDistillationTraining } from '../src/organism/learning/TeacherStudentDistillationTrainer.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import {
  ingestSignedOutcomeArtifact,
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustedKeys = new Map([['verifier-a', publicKeyPem]]);
const now = Date.now();

const tasks = [
  { taskId: 'train-1', taskVersion: 'v1', family: 'arithmetic-train', split: 'train', prompt: 'Solve 1 + 1.', systemPrompt: 'Be precise.', verifierId: 'verifier-a' },
  { taskId: 'validation-1', taskVersion: 'v1', family: 'summarization-validation', split: 'validation', prompt: 'Summarize the supplied paragraph.', systemPrompt: 'Be precise.', verifierId: 'verifier-a' },
  { taskId: 'holdout-1', taskVersion: 'v1', family: 'unseen-reasoning-holdout', split: 'holdout', prompt: 'Solve the unseen puzzle.', systemPrompt: 'Be precise.', verifierId: 'verifier-a' },
];

function teacherRecord(dataset, task, seed, completion, artifactId) {
  const evidenceRef = 'independent-review:' + artifactId;
  const payload = createTeacherDistillationPayload({
    artifactId,
    runId: 'run-' + artifactId,
    manifestFingerprint: dataset.manifestFingerprint(),
    taskId: task.taskId,
    taskVersion: task.taskVersion,
    teacherId: 'teacher-a',
    teacherModel: 'teacher/model-70b',
    teacherRevision: '2026-11-10-commit-a1b2c3d4',
    seed,
    prompt: task.prompt,
    systemPrompt: task.systemPrompt,
    completion,
    evidenceRef,
    authority: 'independent-verifier',
    verifierId: 'verifier-a',
    verifiedAt: now,
  });
  return {
    taskId: task.taskId,
    prompt: task.prompt,
    systemPrompt: task.systemPrompt,
    completion,
    teacherId: 'teacher-a',
    teacherModel: 'teacher/model-70b',
    teacherRevision: '2026-11-10-commit-a1b2c3d4',
    seed,
    evidenceRef,
    artifact: signTeacherDistillationPayloadForFixture(payload, privateKeyPem),
  };
}

// A related task family cannot appear in different splits.
assert.throws(() => new TeacherStudentDistillationDataset([
  tasks[0],
  { ...tasks[1], family: tasks[0].family },
  tasks[2],
]), /family-cross-split-leakage/);

const dataset = new TeacherStudentDistillationDataset(tasks);
const trainRecord = teacherRecord(dataset, tasks[0], 1, 'The answer is 2.', 'teacher-train-1');
const validationRecord = teacherRecord(dataset, tasks[1], 1, 'The paragraph says that systems need evidence.', 'teacher-validation-1');
const holdoutRecord = teacherRecord(dataset, tasks[2], 1, 'A withheld answer.', 'teacher-holdout-1');

assert.equal(dataset.ingestSignedExample(trainRecord, trustedKeys).accepted, true);
assert.equal(dataset.ingestSignedExample(validationRecord, trustedKeys).accepted, true);
assert.equal(dataset.ingestSignedExample(holdoutRecord, trustedKeys).rejection.code, 'holdout-example-forbidden',
  'teacher outputs for confirmatory holdout tasks must never be admitted to a distillation corpus');

// Duplicate evidence and conflicting answers for one task/teacher/seed are rejected.
assert.equal(dataset.ingestSignedExample(trainRecord, trustedKeys).rejection.code, 'duplicate-artifact');
const conflicting = teacherRecord(dataset, tasks[0], 1, 'A conflicting answer.', 'teacher-train-conflict');
assert.equal(dataset.ingestSignedExample(conflicting, trustedKeys).rejection.code, 'conflicting-sample');
const variantDataset = new TeacherStudentDistillationDataset(tasks);
for (let seed = 1; seed <= 8; seed++) {
  const variant = teacherRecord(variantDataset, tasks[0], seed, 'Teacher answer variant ' + seed, 'teacher-variant-' + seed);
  assert.equal(variantDataset.ingestSignedExample(variant, trustedKeys).accepted, true);
}
const ninthVariant = teacherRecord(variantDataset, tasks[0], 9, 'Teacher answer variant 9', 'teacher-variant-9');
assert.equal(variantDataset.ingestSignedExample(ninthVariant, trustedKeys).rejection.code, 'per-task-variant-limit',
  'a task/teacher/model revision may contribute no more than eight verified variants');


// Untrusted keys and mismatched prompt content cannot enter the dataset.
const untrusted = new TeacherStudentDistillationDataset(tasks);
assert.equal(untrusted.ingestSignedExample(trainRecord, new Map()).rejection.code, 'untrusted-verifier');
const wrongPrompt = { ...validationRecord, prompt: 'a different prompt' };
assert.equal(untrusted.ingestSignedExample(wrongPrompt, trustedKeys).rejection.code, 'prompt-or-system-mismatch');

// Credential-like material is rejected before it can be exported to a training corpus.
const credentialRecord = teacherRecord(dataset, tasks[0], 2, 'password=super-secret-value-12345', 'teacher-secret');
assert.equal(dataset.ingestSignedExample(credentialRecord, trustedKeys).rejection.code, 'record-fields-invalid');

// End-to-end teacher collection calls a teacher provider, then a distinct signed verifier.
// The manifest's holdout task is skipped before either service sees its prompt.
const collected = new TeacherStudentDistillationDataset(tasks);
let teacherCallCount = 0;
let verifierCallCount = 0;
let artifactNumber = 0;
const teacherProvider = {
  async generate(request) {
    teacherCallCount++;
    return {
      completion: request.taskId === 'train-1' ? 'Verified teacher answer for training.' : 'Verified teacher answer for validation.',
      teacherId: 'teacher-a',
      teacherModel: 'teacher/model-70b',
      teacherRevision: '2026-11-10-commit-a1b2c3d4',
    };
  },
};
const independentVerifier = {
  async verify(request) {
    verifierCallCount++;
    const artifactId = 'collected-' + (++artifactNumber);
    const evidenceRef = 'independent-review:' + artifactId;
    const payload = createTeacherDistillationPayload({
      artifactId,
      runId: 'run-' + artifactId,
      manifestFingerprint: request.manifestFingerprint,
      taskId: request.taskId,
      taskVersion: request.taskVersion,
      teacherId: request.teacherId,
      teacherModel: request.teacherModel,
      teacherRevision: request.teacherRevision,
      seed: request.seed,
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      completion: request.completion,
      evidenceRef,
      authority: 'independent-verifier',
      verifierId: 'verifier-a',
      verifiedAt: now + artifactNumber,
    });
    return {
      accepted: true,
      evidenceRef,
      artifact: signTeacherDistillationPayloadForFixture(payload, privateKeyPem),
    };
  },
};
const collectionReport = await collected.collectTeacherExamples({
  taskIds: ['train-1', 'validation-1', 'holdout-1'],
  seeds: [1],
  teacher: teacherProvider,
  verifier: independentVerifier,
  trustedVerifierKeys: trustedKeys,
});
assert.equal(collectionReport.attempted, 2);
assert.equal(collectionReport.accepted, 2);
assert.equal(collectionReport.rejected, 1);
assert.equal(teacherCallCount, 2);
assert.equal(verifierCallCount, 2);
assert.equal(collected.snapshot().training.length, 1);
assert.equal(collected.snapshot().validation.length, 1);
assert.equal(collected.snapshot().withheldHoldoutExampleCount, 0);


const snapshot = dataset.snapshot();
assert.equal(snapshot.training.length, 1);
assert.equal(snapshot.validation.length, 1);
assert.equal(snapshot.withheldHoldoutExampleCount, 0);
assert.ok(!JSON.stringify(snapshot.training).includes('A withheld answer.'));
assert.ok(!JSON.stringify(snapshot.validation).includes('A withheld answer.'));

const exported = dataset.exportLlamaFactoryShareGPT();
const allExportedText = Object.values(exported.files).join('\n');
assert.ok(exported.files['train.jsonl'].includes('The answer is 2.'));
assert.ok(exported.files['validation.jsonl'].includes('The paragraph says'));
assert.ok(!allExportedText.includes('A withheld answer.'));
assert.ok(!allExportedText.includes('Solve the unseen puzzle.'));
assert.ok(!allExportedText.includes('holdout-1'));
assert.ok(!allExportedText.includes('A withheld answer.'));
assert.ok(exported.files['train-provenance.jsonl'].includes('teacher-train-1'));
assert.ok(exported.files['validation-provenance.jsonl'].includes('teacher-validation-1'));
assert.ok(!exported.files['train-provenance.jsonl'].includes('holdout-1'));
assert.ok(!exported.files['validation-provenance.jsonl'].includes('holdout-1'));
const trainProvenanceRows = exported.files['train-provenance.jsonl'].trim().split('\n').map(JSON.parse);
const validationProvenanceRows = exported.files['validation-provenance.jsonl'].trim().split('\n').map(JSON.parse);
assert.equal(trainProvenanceRows.length, 1);
assert.equal(validationProvenanceRows.length, 1);
for (const row of [...trainProvenanceRows, ...validationProvenanceRows]) {
  assert.equal(verifySignature(
    null,
    Buffer.from(canonicalTeacherDistillationPayload(row.signedArtifact.payload), 'utf8'),
    publicKey,
    Buffer.from(row.signedArtifact.signature, 'base64'),
  ), true, 'every exported teacher target retains its independently verified signature');
}
const detachedSnapshot = dataset.snapshot();
detachedSnapshot.training[0].signedArtifact.payload.teacherModel = 'tampered-after-snapshot';
assert.equal(dataset.snapshot().training[0].signedArtifact.payload.teacherModel, 'teacher/model-70b',
  'mutating an exported snapshot must not mutate the canonical in-memory dataset');
assert.match(exported.files['dataset_info.json'], /nk1_teacher_student_train/);
assert.match(exported.files['dataset_info.json'], /nk1_teacher_student_validation/);
assert.match(exported.files['manifest.json'], /"holdoutExported": false/);

const config = createLlamaFactorySftConfig({
  modelNameOrPath: 'Qwen/Qwen2.5-7B-Instruct',
  modelRevision: '2026-10-10-commit-abc12345',
  datasetDirectory: '/tmp/nk1-distillation',
  outputDirectory: '/tmp/nk1-distillation/output',
  template: 'qwen',
  cutoffLen: 2048,
  loraRank: 16,
  learningRate: 0.00005,
  numTrainEpochs: 2,
  perDeviceTrainBatchSize: 1,
  gradientAccumulationSteps: 8,
  quantizationBit: 4,
});
assert.match(config.yaml, /^dataset: nk1_teacher_student_train$/m);
assert.match(config.yaml, /^eval_dataset: nk1_teacher_student_validation$/m);
assert.match(config.yaml, /^finetuning_type: lora$/m);
assert.doesNotMatch(config.yaml, /holdout/i);
assert.throws(() => createLlamaFactorySftConfig({
  modelNameOrPath: 'Qwen/Qwen2.5-7B-Instruct',
  modelRevision: 'latest',
  datasetDirectory: '/tmp/dataset',
  outputDirectory: '/tmp/output',
  template: 'qwen',
  cutoffLen: 2048,
  loraRank: 16,
  learningRate: 0.00005,
  numTrainEpochs: 2,
  perDeviceTrainBatchSize: 1,
  gradientAccumulationSteps: 8,
}), /training-config-invalid/);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'nk1-teacher-student-'));
try {
  const exportDirectory = path.join(tempRoot, 'export');
  const written = await writeTeacherDistillationExport(exportDirectory, exported);
  assert.equal(await readFile(written['train.jsonl'], 'utf8'), exported.files['train.jsonl']);
  await assert.rejects(writeTeacherDistillationExport(exportDirectory, exported), /EEXIST/,
    'an existing dataset export must not be silently overwritten');

  // Exercise the real process supervisor boundary with a tiny local fake CLI.
  const runnerWorkspace = path.join(tempRoot, 'runner');
  const runRoot = path.join(tempRoot, 'runs');
  const surviveDirectory = path.join(tempRoot, 'candidate-survive');
  await import('node:fs/promises').then(fs => fs.mkdir(runnerWorkspace, { recursive: true }));
  const configPath = path.join(runnerWorkspace, 'train.yaml');
  await writeFile(configPath, config.yaml, 'utf8');
  const fakeCliPath = path.join(runnerWorkspace, 'fake-llamafactory.mjs');
  const fakeCli = '#!' + process.execPath + '\n' +
    'import { readFileSync } from "node:fs";\n' +
    'if (process.argv[2] !== "train") process.exit(21);\n' +
    'const yaml = readFileSync(process.argv[3], "utf8");\n' +
    'if (!yaml.includes("nk1_teacher_student_train") || !yaml.includes("nk1_teacher_student_validation")) process.exit(22);\n' +
    'if (yaml.toLowerCase().includes("holdout")) process.exit(23);\n' +
    'console.log("TRAIN_CONFIG_ACCEPTED");\n';
  await writeFile(fakeCliPath, fakeCli, 'utf8');
  await chmod(fakeCliPath, 0o755);

  const run = await runTeacherStudentDistillationTraining({
    workspaceDirectory: runnerWorkspace,
    configPath: 'train.yaml',
    expectedConfigFingerprint: config.fingerprint,
    datasetFingerprint: exported.datasetFingerprint,
    executable: fakeCliPath,
    runRoot,
    surviveDirectory,
    seed: 17,
    timeoutMs: 30_000,
  });
  assert.equal(run.receipt.status, 'completed');
  assert.equal(run.receipt.exitCode, 0);
  assert.match(run.receipt.stdout, /TRAIN_CONFIG_ACCEPTED/);
  assert.ok(run.receipt.boundaries.some(line => line.includes('execution, not task correctness')));

  await assert.rejects(runTeacherStudentDistillationTraining({
    workspaceDirectory: runnerWorkspace,
    configPath: 'train.yaml',
    expectedConfigFingerprint: 'f'.repeat(64),
    datasetFingerprint: exported.datasetFingerprint,
    executable: fakeCliPath,
    runRoot,
    surviveDirectory,
  }), /config-fingerprint-mismatch/);

  await assert.rejects(runTeacherStudentDistillationTraining({
    workspaceDirectory: runnerWorkspace,
    configPath: '../outside.yaml',
    expectedConfigFingerprint: config.fingerprint,
    datasetFingerprint: exported.datasetFingerprint,
    executable: fakeCliPath,
    runRoot,
    surviveDirectory,
  }), /config-path-outside-workspace/);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

// Build a real signed P23 outcome ledger for paired validation and holdout evaluation.
const evaluationManifest = [];
for (const [taskId, family, split] of [
  ['val-1', 'validation-family', 'validation'],
  ['val-2', 'validation-family', 'validation'],
  ['holdout-a-1', 'holdout-family-a', 'holdout'],
  ['holdout-b-1', 'holdout-family-b', 'holdout'],
]) {
  evaluationManifest.push({
    taskId, family, split,
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('prompt:' + taskId),
    verifierId: 'verifier-a',
    version: 'v1',
  });
}
const ledger = new VerifiedOutcomeLedger(evaluationManifest);
const manifestFingerprint = ledger.manifestFingerprint();
let outcomeCounter = 0;
function recordOutcome(taskId, method, seed, passed) {
  const payload = {
    schemaVersion: 1,
    artifactId: 'outcome-' + (++outcomeCounter),
    runId: 'paired-run-' + method + '-' + seed + '-' + taskId,
    manifestFingerprint,
    taskId,
    taskVersion: 'v1',
    method,
    seed,
    attempt: 1,
    passed,
    verifierId: 'verifier-a',
    observedAt: now + outcomeCounter,
  };
  const artifact = signOutcomePayloadForFixture(payload, privateKeyPem);
  const result = ingestSignedOutcomeArtifact(ledger, evaluationManifest, artifact, trustedKeys);
  assert.equal(result.accepted, true);
}
for (const task of evaluationManifest.filter(row => row.split === 'validation')) {
  for (let seed = 1; seed <= 3; seed++) {
    recordOutcome(task.taskId, 'baseline', seed, false);
    recordOutcome(task.taskId, 'student-candidate', seed, true);
  }
}
for (const task of evaluationManifest.filter(row => row.split === 'holdout')) {
  for (let seed = 1; seed <= 5; seed++) {
    recordOutcome(task.taskId, 'baseline', seed, false);
    recordOutcome(task.taskId, 'student-candidate', seed, true);
  }
}

const gate = new TeacherStudentDistillationGate();
const gateReport = gate.evaluateOnce({
  ledger,
  candidateFingerprint: 'a'.repeat(64),
  baselineMethod: 'baseline',
  studentMethod: 'student-candidate',
});
assert.equal(gateReport.status, 'eligible-for-manual-review');
assert.equal(gateReport.holdout.pairedSeedCount, 5);
assert.equal(gateReport.holdoutFamilies.length, 2);
assert.equal(gateReport.manualApprovalRequired, true);
assert.equal(gateReport.automaticActivation, false);
const repeatedGateReport = gate.evaluateOnce({
  ledger,
  candidateFingerprint: 'a'.repeat(64),
  baselineMethod: 'baseline',
  studentMethod: 'student-candidate',
});
assert.equal(repeatedGateReport.status, 'already-consumed');
const restoredGate = new TeacherStudentDistillationGate(gate.snapshot());
assert.equal(restoredGate.evaluateOnce({
  ledger,
  candidateFingerprint: 'a'.repeat(64),
  baselineMethod: 'baseline',
  studentMethod: 'student-candidate',
}).status, 'already-consumed');

const unauthenticatedLedger = new VerifiedOutcomeLedger(evaluationManifest);
const unauthenticatedGate = new TeacherStudentDistillationGate().evaluateOnce({
  ledger: unauthenticatedLedger,
  candidateFingerprint: 'b'.repeat(64),
  baselineMethod: 'baseline',
  studentMethod: 'student-candidate',
});
assert.equal(unauthenticatedGate.status, 'insufficient-evidence',
  'unsigned/self-reported outcomes must not satisfy the holdout gate');

console.log('TEACHER_STUDENT_DISTILLATION=PASS');
