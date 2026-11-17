import { createHash, randomUUID, verify as verifySignature } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { canonicalTeacherDistillationPayload, teacherDistillationPayloadFingerprint } from './TeacherStudentDistillation.ts';
import { runLearningProcess, type LearningProcessResult } from './LearningProcessSupervisor.ts';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const isSafeText = (value: unknown, max = 4096): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizedPromptFingerprint = (value: string) =>
  sha256(value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'));
const textFingerprint = (value: string) => sha256(value.normalize('NFC'));
function parseJsonl(value: string): unknown[] {
  try { return value.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line) as unknown); }
  catch { throw new Error('teacher-distillation-dataset-jsonl-invalid'); }
}
function readQuotedConfigString(config: string, key: string): string {
  const match = config.match(new RegExp('^' + key + ':\\s*("(?:[^"\\\\]|\\\\.)*")\\s*
export interface RunTeacherStudentDistillationTrainingInput {
  /** Directory which owns the exported dataset and trainer config. */
  workspaceDirectory: string;
  /** Relative YAML config path, constrained to workspaceDirectory. */
  configPath: string;
  /** Fingerprint returned by createLlamaFactorySftConfig(). */
  expectedConfigFingerprint: string;
  /** Fingerprint returned by TeacherStudentDistillationDataset.snapshot(). */
  datasetFingerprint: string;
  /** Trusted verifier public keys for re-checking every exported row before training. */
  trustedVerifierKeys: ReadonlyMap<string, string>;
  /** Host-pinned command. Defaults to llamafactory-cli; no shell is ever used. */
  executable?: string;
  runRoot: string;
  surviveDirectory: string;
  seed?: number;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

/**
 * Executes a pinned LLaMA Factory config through NK1's existing learning supervisor.
 * The supervisor receipt proves process execution only, not model quality or promotion.
 */
export async function runTeacherStudentDistillationTraining(
  input: RunTeacherStudentDistillationTrainingInput,
): Promise<LearningProcessResult> {
  if (!input || !isSafeText(input.workspaceDirectory) || !isSafeText(input.configPath) ||
      !isDigest(input.expectedConfigFingerprint) || !isDigest(input.datasetFingerprint) ||
      !(input.trustedVerifierKeys instanceof Map) ||
      !isSafeText(input.runRoot) || !isSafeText(input.surviveDirectory) ||
      (input.executable !== undefined && !isSafeText(input.executable, 512)) ||
      (input.seed !== undefined && (!Number.isSafeInteger(input.seed) || input.seed < 0)) ||
      (input.timeoutMs !== undefined && (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 3_600_000)) ||
      (input.maxOutputBytes !== undefined && (!Number.isSafeInteger(input.maxOutputBytes) || input.maxOutputBytes < 1 || input.maxOutputBytes > 16_777_216))) {
    throw new Error('teacher-distillation-training-input-invalid');
  }
  if (input.signal?.aborted) throw new Error('teacher-distillation-training-cancelled-before-start');
  const trustedVerifierKeys = new Map(input.trustedVerifierKeys);
  if ([...trustedVerifierKeys].some(([id, key]) => !isSafeText(id, 256) || typeof key !== 'string' || !key.trim())) {
    throw new Error('teacher-distillation-training-verifier-keys-invalid');
  }

  const workspace = await realpath(path.resolve(input.workspaceDirectory));
  const unresolvedConfig = path.resolve(workspace, input.configPath);
  const config = await realpath(unresolvedConfig);
  const relative = path.relative(workspace, config);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('teacher-distillation-config-path-outside-workspace');
  }
  const metadata = await lstat(unresolvedConfig);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error('teacher-distillation-config-must-be-regular-file');
  }
  const configText = await readFile(config, 'utf8');
  if (sha256(configText) !== input.expectedConfigFingerprint) {
    throw new Error('teacher-distillation-config-fingerprint-mismatch');
  }
  const hasTrain = /^dataset:\s*nk1_teacher_student_train\s*$/m.test(configText);
  const hasValidation = /^eval_dataset:\s*nk1_teacher_student_validation\s*$/m.test(configText);
  const hasLora = /^finetuning_type:\s*lora\s*$/m.test(configText);
  if (!hasTrain || !hasValidation || !hasLora || /\bholdout\b/i.test(configText)) {
    throw new Error('teacher-distillation-config-split-contract-invalid');
  }

  const datasetDirectory = readQuotedConfigString(configText, 'dataset_dir');
  const verifiedDataset = await verifySignedDataset({
    workspace,
    datasetDirectory,
    expectedFingerprint: input.datasetFingerprint,
    trustedKeys: trustedVerifierKeys,
  });

  const planFingerprint = sha256(JSON.stringify({
    datasetFingerprint: input.datasetFingerprint,
    manifestFingerprint: verifiedDataset.manifestFingerprint,
    verifiedRows: verifiedDataset.rowCount,
    configFingerprint: input.expectedConfigFingerprint,
    executable: input.executable ?? 'llamafactory-cli',
    arguments: ['train', relative.split(path.sep).join('/')],
  }));
  const runId = randomUUID();
  return runLearningProcess({
    runId,
    manifestFingerprint: verifiedDataset.manifestFingerprint,
    taskId: 'teacher-student-distillation',
    taskVersion: '1',
    seed: input.seed ?? 1,
    arm: 'candidate',
    method: 'llamafactory-sft-lora',
  }, planFingerprint, {
    executable: input.executable ?? 'llamafactory-cli',
    args: ['train', config],
    cwd: workspace,
    runRoot: input.runRoot,
    surviveDir: input.surviveDirectory,
    timeoutMs: input.timeoutMs ?? 3_600_000,
    maxOutputBytes: input.maxOutputBytes ?? 2_097_152,
    // Deliberately inherit only non-secret runtime/toolchain paths and device selectors.
    // Credentials such as HF_TOKEN must be passed by an explicit host secret capability,
    // never inherited implicitly from an arbitrary parent process environment.
    inheritEnv: ['PATH', 'HOME', 'TMPDIR', 'CUDA_VISIBLE_DEVICES', 'CUDA_HOME',
      'LD_LIBRARY_PATH', 'HF_HOME', 'HF_HUB_CACHE', 'TRANSFORMERS_CACHE', 'TORCH_HOME'],
    signal: input.signal,
  });
}
, 'm'));
  if (!match) throw new Error('teacher-distillation-config-' + key + '-invalid');
  try {
    const value: unknown = JSON.parse(match[1]!);
    if (!isSafeText(value)) throw new Error('not-string');
    return value;
  } catch { throw new Error('teacher-distillation-config-' + key + '-invalid'); }
}
async function verifySignedDataset(input: {
  workspace: string;
  datasetDirectory: string;
  expectedFingerprint: string;
  trustedKeys: ReadonlyMap<string, string>;
}): Promise<{ manifestFingerprint: string; rowCount: number }> {
  const unresolved = path.resolve(input.workspace, input.datasetDirectory);
  const root = await realpath(unresolved);
  const relative = path.relative(input.workspace, root);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('teacher-distillation-dataset-path-outside-workspace');
  }
  const dirStat = await lstat(unresolved);
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    throw new Error('teacher-distillation-dataset-directory-invalid');
  }
  const readSafe = async (name: string) => {
    const filename = path.join(root, name);
    const stat = await lstat(filename);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('teacher-distillation-dataset-file-not-regular');
    const resolved = await realpath(filename);
    if (path.dirname(resolved) !== root) throw new Error('teacher-distillation-dataset-file-outside-root');
    return readFile(resolved, 'utf8');
  };
  const [manifestText, trainText, validationText, infoText, trainProofText, validationProofText] =
    await Promise.all([
      readSafe('manifest.json'), readSafe('train.jsonl'), readSafe('validation.jsonl'),
      readSafe('dataset_info.json'), readSafe('train-provenance.jsonl'), readSafe('validation-provenance.jsonl'),
    ]);
  let manifest: Record<string, unknown>;
  let info: Record<string, unknown>;
  try {
    const m: unknown = JSON.parse(manifestText);
    const d: unknown = JSON.parse(infoText);
    if (!isRecord(m) || !isRecord(d)) throw new Error('not-record');
    manifest = m; info = d;
  } catch { throw new Error('teacher-distillation-dataset-manifest-json-invalid'); }
  if (manifest.schemaVersion !== 1 || manifest.format !== 'llamafactory-sharegpt' ||
      manifest.datasetFingerprint !== input.expectedFingerprint || !isDigest(manifest.manifestFingerprint) ||
      manifest.holdoutExported !== false || !Number.isSafeInteger(manifest.withheldHoldoutExampleCount) ||
      Number(manifest.withheldHoldoutExampleCount) < 0 ||
      !Number.isSafeInteger(manifest.trainingRows) || Number(manifest.trainingRows) < 1 ||
      !Number.isSafeInteger(manifest.validationRows) || Number(manifest.validationRows) < 1) {
    throw new Error('teacher-distillation-dataset-manifest-invalid');
  }
  if (sha256(trainText) !== manifest.trainSha256 ||
      sha256(validationText) !== manifest.validationSha256 ||
      sha256(trainProofText) !== manifest.trainProvenanceSha256 ||
      sha256(validationProofText) !== manifest.validationProvenanceSha256 ||
      sha256(JSON.stringify(info)) !== manifest.datasetInfoSha256) {
    throw new Error('teacher-distillation-dataset-file-hash-mismatch');
  }
  for (const [name, fileName] of [['nk1_teacher_student_train', 'train.jsonl'], ['nk1_teacher_student_validation', 'validation.jsonl']] as const) {
    const entry = info[name];
    if (!isRecord(entry) || entry.file_name !== fileName || entry.formatting !== 'sharegpt' ||
        !isRecord(entry.columns) || entry.columns.messages !== 'conversations' ||
        !isRecord(entry.tags) || entry.tags.role_tag !== 'from' || entry.tags.content_tag !== 'value' ||
        entry.tags.user_tag !== 'human' || entry.tags.assistant_tag !== 'gpt') {
      throw new Error('teacher-distillation-dataset-info-invalid');
    }
  }
  const train = parseJsonl(trainText);
  const validation = parseJsonl(validationText);
  const trainProof = parseJsonl(trainProofText);
  const validationProof = parseJsonl(validationProofText);
  if (train.length !== manifest.trainingRows || validation.length !== manifest.validationRows ||
      train.length !== trainProof.length || validation.length !== validationProof.length) {
    throw new Error('teacher-distillation-dataset-row-count-mismatch');
  }
  const seenExamples = new Set<string>();
  const seenArtifacts = new Set<string>();
  const verifyRows = (examples: unknown[], proofs: unknown[]) => {
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const row = proofs[i];
      if (!isRecord(example) || !Array.isArray(example.conversations) || example.conversations.length !== 2 ||
          !isRecord(example.conversations[0]) || !isRecord(example.conversations[1]) ||
          example.conversations[0].from !== 'human' || typeof example.conversations[0].value !== 'string' ||
          example.conversations[1].from !== 'gpt' || typeof example.conversations[1].value !== 'string' ||
          (example.system !== undefined && typeof example.system !== 'string') ||
          !isRecord(row) || !isSafeText(row.exampleId, 256) || !isSafeText(row.taskId, 256) ||
          !isSafeText(row.taskVersion, 180) || !isSafeText(row.family, 180) ||
          !isSafeText(row.teacherId, 180) || !isSafeText(row.teacherModel, 256) ||
          !isSafeText(row.teacherRevision, 128) || !isSafeText(row.verifierId, 256) ||
          !Number.isSafeInteger(row.seed) || row.seed < 0 || !isDigest(row.evidenceRefDigest) ||
          !isDigest(row.artifactFingerprint) || seenExamples.has(String(row.exampleId))) {
        throw new Error('teacher-distillation-dataset-row-invalid');
      }
      const artifact = row.signedArtifact;
      if (!isRecord(artifact) || !isRecord(artifact.payload) ||
          typeof artifact.signature !== 'string' || artifact.signature.length < 40) {
        throw new Error('teacher-distillation-provenance-artifact-invalid');
      }
      const p = artifact.payload;
      const prompt = String(example.conversations[0].value);
      const completion = String(example.conversations[1].value);
      const system = String(example.system ?? '');
      if (p.schemaVersion !== 1 || p.manifestFingerprint !== manifest.manifestFingerprint ||
          p.taskId !== row.taskId || p.taskVersion !== row.taskVersion ||
          p.teacherId !== row.teacherId || p.teacherModel !== row.teacherModel ||
          p.teacherRevision !== row.teacherRevision || p.seed !== row.seed ||
          p.verifierId !== row.verifierId || p.authority !== row.authority ||
          p.promptFingerprint !== normalizedPromptFingerprint(prompt) ||
          p.systemFingerprint !== textFingerprint(system) ||
          p.completionFingerprint !== textFingerprint(completion) ||
          p.evidenceRefDigest !== row.evidenceRefDigest ||
          teacherDistillationPayloadFingerprint(p as never) !== row.artifactFingerprint ||
          seenArtifacts.has(String(p.artifactId))) {
        throw new Error('teacher-distillation-provenance-binding-mismatch');
      }
      const publicKey = input.trustedKeys.get(String(p.verifierId));
      if (!publicKey) throw new Error('teacher-distillation-provenance-verifier-untrusted');
      let valid = false;
      try {
        valid = verifySignature(null, Buffer.from(canonicalTeacherDistillationPayload(p as never), 'utf8'),
          publicKey, Buffer.from(artifact.signature, 'base64'));
      } catch { valid = false; }
      if (!valid) throw new Error('teacher-distillation-provenance-signature-invalid');
      seenExamples.add(String(row.exampleId));
      seenArtifacts.add(String(p.artifactId));
    }
  };
  verifyRows(train, trainProof);
  verifyRows(validation, validationProof);
  return { manifestFingerprint: String(manifest.manifestFingerprint), rowCount: train.length + validation.length };
}

export interface RunTeacherStudentDistillationTrainingInput {
  /** Directory which owns the exported dataset and trainer config. */
  workspaceDirectory: string;
  /** Relative YAML config path, constrained to workspaceDirectory. */
  configPath: string;
  /** Fingerprint returned by createLlamaFactorySftConfig(). */
  expectedConfigFingerprint: string;
  /** Fingerprint returned by TeacherStudentDistillationDataset.snapshot(). */
  datasetFingerprint: string;
  /** Host-pinned command. Defaults to llamafactory-cli; no shell is ever used. */
  executable?: string;
  runRoot: string;
  surviveDirectory: string;
  seed?: number;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

/**
 * Executes a pinned LLaMA Factory config through NK1's existing learning supervisor.
 * The supervisor receipt proves process execution only, not model quality or promotion.
 */
export async function runTeacherStudentDistillationTraining(
  input: RunTeacherStudentDistillationTrainingInput,
): Promise<LearningProcessResult> {
  if (!input || !isSafeText(input.workspaceDirectory) || !isSafeText(input.configPath) ||
      !isDigest(input.expectedConfigFingerprint) || !isDigest(input.datasetFingerprint) ||
      !isSafeText(input.runRoot) || !isSafeText(input.surviveDirectory) ||
      (input.executable !== undefined && !isSafeText(input.executable, 512)) ||
      (input.seed !== undefined && (!Number.isSafeInteger(input.seed) || input.seed < 0)) ||
      (input.timeoutMs !== undefined && (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 3_600_000)) ||
      (input.maxOutputBytes !== undefined && (!Number.isSafeInteger(input.maxOutputBytes) || input.maxOutputBytes < 1 || input.maxOutputBytes > 16_777_216))) {
    throw new Error('teacher-distillation-training-input-invalid');
  }
  if (input.signal?.aborted) throw new Error('teacher-distillation-training-cancelled-before-start');

  const workspace = await realpath(path.resolve(input.workspaceDirectory));
  const unresolvedConfig = path.resolve(workspace, input.configPath);
  const config = await realpath(unresolvedConfig);
  const relative = path.relative(workspace, config);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('teacher-distillation-config-path-outside-workspace');
  }
  const metadata = await lstat(unresolvedConfig);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error('teacher-distillation-config-must-be-regular-file');
  }
  const configText = await readFile(config, 'utf8');
  if (sha256(configText) !== input.expectedConfigFingerprint) {
    throw new Error('teacher-distillation-config-fingerprint-mismatch');
  }
  const hasTrain = /^dataset:\s*nk1_teacher_student_train\s*$/m.test(configText);
  const hasValidation = /^eval_dataset:\s*nk1_teacher_student_validation\s*$/m.test(configText);
  const hasLora = /^finetuning_type:\s*lora\s*$/m.test(configText);
  if (!hasTrain || !hasValidation || !hasLora || /\bholdout\b/i.test(configText)) {
    throw new Error('teacher-distillation-config-split-contract-invalid');
  }

  const planFingerprint = sha256(JSON.stringify({
    datasetFingerprint: input.datasetFingerprint,
    configFingerprint: input.expectedConfigFingerprint,
    executable: input.executable ?? 'llamafactory-cli',
    arguments: ['train', relative.split(path.sep).join('/')],
  }));
  const runId = randomUUID();
  return runLearningProcess({
    runId,
    manifestFingerprint: input.datasetFingerprint,
    taskId: 'teacher-student-distillation',
    taskVersion: '1',
    seed: input.seed ?? 1,
    arm: 'candidate',
    method: 'llamafactory-sft-lora',
  }, planFingerprint, {
    executable: input.executable ?? 'llamafactory-cli',
    args: ['train', config],
    cwd: workspace,
    runRoot: input.runRoot,
    surviveDir: input.surviveDirectory,
    timeoutMs: input.timeoutMs ?? 3_600_000,
    maxOutputBytes: input.maxOutputBytes ?? 2_097_152,
    // Deliberately inherit only non-secret runtime/toolchain paths and device selectors.
    // Credentials such as HF_TOKEN must be passed by an explicit host secret capability,
    // never inherited implicitly from an arbitrary parent process environment.
    inheritEnv: ['PATH', 'HOME', 'TMPDIR', 'CUDA_VISIBLE_DEVICES', 'CUDA_HOME',
      'LD_LIBRARY_PATH', 'HF_HOME', 'HF_HUB_CACHE', 'TRANSFORMERS_CACHE', 'TORCH_HOME'],
    signal: input.signal,
  });
}
