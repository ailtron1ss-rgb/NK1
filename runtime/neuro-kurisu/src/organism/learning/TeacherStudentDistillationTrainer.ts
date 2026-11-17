import { createHash, randomUUID, verify as verifySignature } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  canonicalTeacherDistillationPayload,
  fingerprintTeacherDistillationDataset,
  teacherDistillationPayloadFingerprint,
  type SignedTeacherDistillationArtifact,
  type SignedTeacherDistillationPayload,
  type TeacherDistillationExample,
  type TeacherVerificationAuthority,
} from './TeacherStudentDistillation.ts';
import { runLearningProcess, type LearningProcessResult } from './LearningProcessSupervisor.ts';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/iu.test(value);
const isSafeText = (value: unknown, maximum = 4096): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maximum &&
  value.trim() === value && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const isContentText = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maximum &&
  !/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizedPromptFingerprint = (value: string) =>
  sha256(value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'));
const textFingerprint = (value: string) => sha256(value.normalize('NFC'));

const MAX_DATASET_ROWS = 100_000;
const MAX_DATASET_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_DATASET_FILE_BYTES = 256 * 1024 * 1024;
const MAX_JSONL_LINE_CHARS = 256_000;
const MAX_PROMPT_CHARS = 32_000;
const MAX_SYSTEM_CHARS = 16_000;
const MAX_COMPLETION_CHARS = 64_000;
const MAX_VARIANTS_PER_TASK_TEACHER = 8;
const FLOATING_REVISIONS = new Set(['latest', 'main', 'master', 'stable', 'nightly', 'head']);

function parseJsonl(value: string): unknown[] {
  const lines = value.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0 || lines.length > MAX_DATASET_ROWS ||
      lines.some(line => line.length === 0 || line.length > MAX_JSONL_LINE_CHARS)) {
    throw new Error('teacher-distillation-dataset-jsonl-invalid');
  }
  try {
    return lines.map(line => JSON.parse(line) as unknown);
  } catch {
    throw new Error('teacher-distillation-dataset-jsonl-invalid');
  }
}

async function readRegularTextFile(
  filename: string,
  maximumBytes: number,
  errorCode: string,
): Promise<{ content: string; size: number }> {
  const before = await lstat(filename);
  if (before.isSymbolicLink() || !before.isFile() || before.size > maximumBytes) {
    throw new Error(errorCode);
  }
  // O_NOFOLLOW prevents a symlink swap between lstat() and open() on POSIX.
  // The supervisor currently targets Linux; Darwin's flag differs. Windows relies
  // on the post-open inode/device check because Node does not expose O_NOFOLLOW there.
  const handle = process.platform === 'linux'
    ? await open(filename, 0x20000)
    : process.platform === 'darwin'
      ? await open(filename, 0x100)
      : await open(filename, 'r');
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino ||
        opened.size > maximumBytes || opened.size !== before.size) {
      throw new Error(errorCode);
    }
    const content = await handle.readFile({ encoding: 'utf8' });
    const after = await handle.stat();
    if (!after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino ||
        after.size !== opened.size || after.mtimeMs !== opened.mtimeMs ||
        after.ctimeMs !== opened.ctimeMs || Buffer.byteLength(content, 'utf8') !== after.size) {
      throw new Error(errorCode);
    }
    return { content, size: after.size };
  } finally {
    await handle.close();
  }
}

function parseFlatTrainerConfig(configText: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of configText.split(/\r?\n/u)) {
    if (line === '') continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*?)[ \t]*$/u.exec(line);
    if (!match) throw new Error('teacher-distillation-config-format-invalid');
    const key = match[1]!;
    if (values.has(key)) throw new Error('teacher-distillation-config-duplicate-key');
    values.set(key, match[2]!);
  }
  const allowed = new Set([
    'model_name_or_path', 'model_revision', 'stage', 'do_train', 'do_eval',
    'finetuning_type', 'lora_rank', 'lora_target', 'dataset_dir', 'dataset',
    'eval_dataset', 'template', 'cutoff_len', 'output_dir', 'learning_rate',
    'num_train_epochs', 'per_device_train_batch_size', 'gradient_accumulation_steps',
    'overwrite_output_dir', 'save_total_limit', 'quantization_bit',
  ]);
  if ([...values.keys()].some(key => !allowed.has(key))) {
    throw new Error('teacher-distillation-config-option-not-allowed');
  }
  return values;
}

function readQuotedConfigString(values: Map<string, string>, key: string): string {
  const raw = values.get(key);
  if (raw === undefined) throw new Error('teacher-distillation-config-' + key + '-invalid');
  try {
    const value: unknown = JSON.parse(raw);
    if (!isSafeText(value)) throw new Error('not-string');
    return value;
  } catch {
    throw new Error('teacher-distillation-config-' + key + '-invalid');
  }
}

function pathIsWithin(parent: string, candidate: string, allowEqual = false): boolean {
  const relative = path.relative(parent, candidate);
  if (relative === '') return allowEqual;
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function requireConfigScalar(values: Map<string, string>, key: string, expected: string): void {
  if (values.get(key) !== expected) {
    throw new Error('teacher-distillation-config-' + key + '-invalid');
  }
}

async function prepareSafeOutputDirectory(
  workspace: string,
  outputDirectory: string,
  datasetDirectory: string,
): Promise<string> {
  if (!pathIsWithin(workspace, outputDirectory) || outputDirectory === workspace ||
      (datasetDirectory !== workspace &&
        (pathIsWithin(datasetDirectory, outputDirectory, true) ||
          pathIsWithin(outputDirectory, datasetDirectory, true)))) {
    throw new Error('teacher-distillation-output-path-invalid');
  }
  const relative = path.relative(workspace, outputDirectory);
  const parts = relative.split(path.sep).filter(Boolean);
  if (!parts.length) throw new Error('teacher-distillation-output-path-invalid');

  let current = workspace;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
      if (code !== 'EEXIST') throw new Error('teacher-distillation-output-directory-create-failed');
    }
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error('teacher-distillation-output-path-invalid');
    }
    const resolved = await realpath(current);
    if (!pathIsWithin(workspace, resolved, true)) {
      throw new Error('teacher-distillation-output-path-invalid');
    }
    if (index === parts.length - 1 && (await readdir(current)).length !== 0) {
      throw new Error('teacher-distillation-output-directory-not-empty');
    }
  }
  return outputDirectory;
}

async function verifySignedDataset(input: {
  workspace: string;
  datasetDirectory: string;
  expectedFingerprint: string;
  trustedKeys: ReadonlyMap<string, string>;
}): Promise<{ manifestFingerprint: string; rowCount: number }> {
  const unresolvedRoot = path.resolve(input.workspace, input.datasetDirectory);
  const root = await realpath(unresolvedRoot);
  if (!pathIsWithin(input.workspace, root, true)) {
    throw new Error('teacher-distillation-dataset-path-outside-workspace');
  }
  const directoryStat = await lstat(unresolvedRoot);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new Error('teacher-distillation-dataset-directory-invalid');
  }

  const names = [
    'manifest.json',
    'train.jsonl',
    'validation.jsonl',
    'dataset_info.json',
    'train-provenance.jsonl',
    'validation-provenance.jsonl',
  ] as const;
  const inspected = await Promise.all(names.map(async name => {
    const originalPath = path.join(root, name);
    const stat = await lstat(originalPath);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_DATASET_FILE_BYTES) {
      throw new Error('teacher-distillation-dataset-file-not-regular');
    }
    const resolved = await realpath(originalPath);
    if (path.dirname(resolved) !== root) {
      throw new Error('teacher-distillation-dataset-file-outside-root');
    }
    return { name, path: resolved, size: stat.size };
  }));
  if (inspected.reduce((sum, file) => sum + file.size, 0) > MAX_DATASET_TOTAL_BYTES) {
    throw new Error('teacher-distillation-dataset-total-size-exceeded');
  }
  const fileContents = await Promise.all(inspected.map(async file => {
    const result = await readRegularTextFile(
      file.path, MAX_DATASET_FILE_BYTES, 'teacher-distillation-dataset-file-changed-or-invalid',
    );
    if (result.size !== file.size) throw new Error('teacher-distillation-dataset-file-changed-or-invalid');
    return [file.name, result.content] as const;
  }));
  const contents = new Map<string, string>(fileContents);
  const manifestText = contents.get('manifest.json')!;
  const trainText = contents.get('train.jsonl')!;
  const validationText = contents.get('validation.jsonl')!;
  const infoText = contents.get('dataset_info.json')!;
  const trainProofText = contents.get('train-provenance.jsonl')!;
  const validationProofText = contents.get('validation-provenance.jsonl')!;

  let manifest: Record<string, unknown>;
  let info: Record<string, unknown>;
  try {
    const parsedManifest: unknown = JSON.parse(manifestText);
    const parsedInfo: unknown = JSON.parse(infoText);
    if (!isRecord(parsedManifest) || !isRecord(parsedInfo)) throw new Error('not-record');
    manifest = parsedManifest;
    info = parsedInfo;
  } catch {
    throw new Error('teacher-distillation-dataset-manifest-json-invalid');
  }
  if (manifest.schemaVersion !== 1 || manifest.format !== 'llamafactory-sharegpt' ||
      manifest.datasetFingerprint !== input.expectedFingerprint ||
      !isDigest(manifest.manifestFingerprint) || manifest.holdoutExported !== false ||
      !Number.isSafeInteger(manifest.withheldHoldoutExampleCount) ||
      Number(manifest.withheldHoldoutExampleCount) < 0 ||
      !Number.isSafeInteger(manifest.trainingRows) || Number(manifest.trainingRows) < 1 ||
      Number(manifest.trainingRows) > MAX_DATASET_ROWS ||
      !Number.isSafeInteger(manifest.validationRows) || Number(manifest.validationRows) < 1 ||
      Number(manifest.validationRows) > MAX_DATASET_ROWS) {
    throw new Error('teacher-distillation-dataset-manifest-invalid');
  }
  if (sha256(trainText) !== manifest.trainSha256 ||
      sha256(validationText) !== manifest.validationSha256 ||
      sha256(trainProofText) !== manifest.trainProvenanceSha256 ||
      sha256(validationProofText) !== manifest.validationProvenanceSha256 ||
      sha256(JSON.stringify(info)) !== manifest.datasetInfoSha256) {
    throw new Error('teacher-distillation-dataset-file-hash-mismatch');
  }

  const datasetNames = Object.keys(info).sort();
  if (datasetNames.join('|') !== 'nk1_teacher_student_train|nk1_teacher_student_validation') {
    throw new Error('teacher-distillation-dataset-info-unexpected-dataset');
  }
  for (const [name, fileName] of [
    ['nk1_teacher_student_train', 'train.jsonl'],
    ['nk1_teacher_student_validation', 'validation.jsonl'],
  ] as const) {
    const entry = info[name];
    if (!isRecord(entry) || entry.file_name !== fileName || entry.formatting !== 'sharegpt' ||
        !isRecord(entry.columns) || entry.columns.messages !== 'conversations' ||
        !isRecord(entry.tags) || entry.tags.role_tag !== 'from' ||
        entry.tags.content_tag !== 'value' || entry.tags.user_tag !== 'human' ||
        entry.tags.assistant_tag !== 'gpt' || entry.tags.system_tag !== 'system') {
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
  if (train.length + validation.length > MAX_DATASET_ROWS) {
    throw new Error('teacher-distillation-dataset-row-count-exceeded');
  }

  const seenExamples = new Set<string>();
  const seenArtifacts = new Set<string>();
  const seenSamples = new Set<string>();
  const seenContent = new Set<string>();
  const variantCounts = new Map<string, number>();
  const familySplits = new Map<string, 'train' | 'validation'>();
  const promptSplits = new Map<string, 'train' | 'validation'>();

  const verifyRows = (
    examples: unknown[],
    proofs: unknown[],
    split: 'train' | 'validation',
  ): TeacherDistillationExample[] => {
    const verified: TeacherDistillationExample[] = [];
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const row = proofs[i];
      if (!isRecord(example) || !Array.isArray(example.conversations) ||
          example.conversations.length !== 2 ||
          !isRecord(example.conversations[0]) || !isRecord(example.conversations[1]) ||
          example.conversations[0].from !== 'human' ||
          !isContentText(example.conversations[0].value, MAX_PROMPT_CHARS) ||
          example.conversations[1].from !== 'gpt' ||
          !isContentText(example.conversations[1].value, MAX_COMPLETION_CHARS) ||
          (example.system !== undefined && !isContentText(example.system, MAX_SYSTEM_CHARS)) ||
          !isRecord(row) || !isSafeText(row.exampleId, 256) ||
          !isSafeText(row.taskId, 256) || !isSafeText(row.taskVersion, 180) ||
          !isSafeText(row.family, 180) || !isSafeText(row.teacherId, 180) ||
          !isSafeText(row.teacherModel, 256) || !isSafeText(row.teacherRevision, 128) ||
          FLOATING_REVISIONS.has(String(row.teacherRevision).toLowerCase()) ||
          !isSafeText(row.verifierId, 256) ||
          !['independent-verifier', 'human-review'].includes(String(row.authority)) ||
          !Number.isSafeInteger(row.seed) || Number(row.seed) < 0 ||
          !isDigest(row.evidenceRefDigest) || !isDigest(row.artifactFingerprint) ||
          seenExamples.has(String(row.exampleId))) {
        throw new Error('teacher-distillation-dataset-row-invalid');
      }

      const artifact = row.signedArtifact;
      if (!isRecord(artifact) || !isRecord(artifact.payload) ||
          typeof artifact.signature !== 'string' ||
          !/^[A-Za-z0-9+/]+={0,2}$/u.test(artifact.signature)) {
        throw new Error('teacher-distillation-provenance-artifact-invalid');
      }
      const signatureBytes = Buffer.from(artifact.signature, 'base64');
      if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== artifact.signature) {
        throw new Error('teacher-distillation-provenance-artifact-invalid');
      }

      const payload = artifact.payload;
      const prompt = String(example.conversations[0].value);
      const completion = String(example.conversations[1].value);
      const system = String(example.system ?? '');
      const artifactId = String(payload.artifactId ?? '');
      const sampleIdentity = JSON.stringify([
        row.taskId, row.teacherId, row.teacherModel, row.teacherRevision, row.seed,
      ]);
      const variantIdentity = JSON.stringify([
        row.taskId, row.teacherId, row.teacherModel, row.teacherRevision,
      ]);
      const contentIdentity = JSON.stringify([
        normalizedPromptFingerprint(prompt), textFingerprint(system), row.teacherModel,
        row.teacherRevision, textFingerprint(completion),
      ]);
      if (payload.schemaVersion !== 2 ||
          !isSafeText(payload.artifactId, 256) || !isSafeText(payload.runId, 256) ||
          payload.manifestFingerprint !== manifest.manifestFingerprint ||
          payload.taskId !== row.taskId || payload.taskVersion !== row.taskVersion ||
          payload.family !== row.family || payload.split !== split ||
          payload.teacherId !== row.teacherId || payload.teacherModel !== row.teacherModel ||
          payload.teacherRevision !== row.teacherRevision ||
          FLOATING_REVISIONS.has(String(payload.teacherRevision).toLowerCase()) ||
          payload.seed !== row.seed || payload.verifierId !== row.verifierId ||
          !['independent-verifier', 'human-review'].includes(String(payload.authority)) ||
          payload.authority !== row.authority ||
          !Number.isFinite(payload.verifiedAt) || Number(payload.verifiedAt) <= 0 ||
          payload.promptFingerprint !== normalizedPromptFingerprint(prompt) ||
          payload.systemFingerprint !== textFingerprint(system) ||
          payload.completionFingerprint !== textFingerprint(completion) ||
          payload.evidenceRefDigest !== row.evidenceRefDigest ||
          teacherDistillationPayloadFingerprint(payload as unknown as SignedTeacherDistillationPayload) !==
            row.artifactFingerprint ||
          sha256(JSON.stringify([row.artifactFingerprint, row.taskId, row.teacherId])) !== row.exampleId ||
          seenArtifacts.has(artifactId) || seenSamples.has(sampleIdentity) || seenContent.has(contentIdentity)) {
        throw new Error('teacher-distillation-provenance-binding-mismatch');
      }

      const familySplit = familySplits.get(String(row.family));
      if (familySplit && familySplit !== split) {
        throw new Error('teacher-distillation-family-cross-split-leakage');
      }
      familySplits.set(String(row.family), split);
      const promptFingerprint = normalizedPromptFingerprint(prompt);
      const previousPromptSplit = promptSplits.get(promptFingerprint);
      if (previousPromptSplit && previousPromptSplit !== split) {
        throw new Error('teacher-distillation-prompt-cross-split-leakage');
      }
      promptSplits.set(promptFingerprint, split);

      const nextVariants = (variantCounts.get(variantIdentity) ?? 0) + 1;
      if (nextVariants > MAX_VARIANTS_PER_TASK_TEACHER) {
        throw new Error('teacher-distillation-per-task-variant-limit');
      }
      variantCounts.set(variantIdentity, nextVariants);

      const publicKey = input.trustedKeys.get(String(payload.verifierId));
      if (!publicKey) throw new Error('teacher-distillation-provenance-verifier-untrusted');
      let signatureValid = false;
      try {
        signatureValid = verifySignature(
          null,
          Buffer.from(canonicalTeacherDistillationPayload(payload as unknown as SignedTeacherDistillationPayload), 'utf8'),
          publicKey,
          signatureBytes,
        );
      } catch {
        signatureValid = false;
      }
      if (!signatureValid) throw new Error('teacher-distillation-provenance-signature-invalid');

      seenExamples.add(String(row.exampleId));
      seenArtifacts.add(artifactId);
      seenSamples.add(sampleIdentity);
      seenContent.add(contentIdentity);
      verified.push({
        schemaVersion: 1,
        exampleId: String(row.exampleId),
        taskId: String(row.taskId),
        taskVersion: String(row.taskVersion),
        family: String(row.family),
        split,
        prompt,
        ...(example.system !== undefined ? { systemPrompt: system } : {}),
        completion,
        teacherId: String(row.teacherId),
        teacherModel: String(row.teacherModel),
        teacherRevision: String(row.teacherRevision),
        seed: Number(row.seed),
        verifierId: String(row.verifierId),
        authority: String(row.authority) as TeacherVerificationAuthority,
        evidenceRefDigest: String(row.evidenceRefDigest),
        artifactFingerprint: String(row.artifactFingerprint),
        signedArtifact: artifact as unknown as SignedTeacherDistillationArtifact,
        verifiedAt: Number(payload.verifiedAt),
      });
    }
    return verified;
  };

  const verifiedTraining = verifyRows(train, trainProof, 'train');
  const verifiedValidation = verifyRows(validation, validationProof, 'validation');
  const recomputedTeacherModels = [...new Set(
    [...verifiedTraining, ...verifiedValidation].map(row => row.teacherModel + '@' + row.teacherRevision),
  )].sort();
  if (!Array.isArray(manifest.teacherModels) ||
      JSON.stringify(manifest.teacherModels) !== JSON.stringify(recomputedTeacherModels)) {
    throw new Error('teacher-distillation-dataset-teacher-models-mismatch');
  }

  const recomputedFingerprint = fingerprintTeacherDistillationDataset({
    schemaVersion: 1,
    manifestFingerprint: String(manifest.manifestFingerprint),
    training: verifiedTraining,
    validation: verifiedValidation,
  });
  if (recomputedFingerprint !== input.expectedFingerprint) {
    throw new Error('teacher-distillation-dataset-fingerprint-mismatch');
  }
  return {
    manifestFingerprint: String(manifest.manifestFingerprint),
    rowCount: train.length + validation.length,
  };
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
      (input.timeoutMs !== undefined &&
        (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 3_600_000)) ||
      (input.maxOutputBytes !== undefined &&
        (!Number.isSafeInteger(input.maxOutputBytes) || input.maxOutputBytes < 1 || input.maxOutputBytes > 16_777_216))) {
    throw new Error('teacher-distillation-training-input-invalid');
  }
  if (input.signal?.aborted) {
    throw new Error('teacher-distillation-training-cancelled-before-start');
  }
  const trustedVerifierKeys = new Map(input.trustedVerifierKeys);
  if ([...trustedVerifierKeys].some(([id, key]) =>
    !isSafeText(id, 256) || typeof key !== 'string' || key.trim().length === 0)) {
    throw new Error('teacher-distillation-training-verifier-keys-invalid');
  }

  const workspace = await realpath(path.resolve(input.workspaceDirectory));
  if (path.isAbsolute(input.configPath)) {
    throw new Error('teacher-distillation-config-path-outside-workspace');
  }
  const unresolvedConfig = path.resolve(workspace, input.configPath);
  if (!pathIsWithin(workspace, unresolvedConfig) || unresolvedConfig === workspace) {
    throw new Error('teacher-distillation-config-path-outside-workspace');
  }
  const configStat = await lstat(unresolvedConfig);
  if (configStat.isSymbolicLink() || !configStat.isFile()) {
    throw new Error('teacher-distillation-config-must-be-regular-file');
  }
  const config = await realpath(unresolvedConfig);
  if (!pathIsWithin(workspace, config)) {
    throw new Error('teacher-distillation-config-path-outside-workspace');
  }
  const configFile = await readRegularTextFile(
    config, 1_048_576, 'teacher-distillation-config-must-be-regular-file',
  );
  const configText = configFile.content;
  if (sha256(configText) !== input.expectedConfigFingerprint) {
    throw new Error('teacher-distillation-config-fingerprint-mismatch');
  }

  const values = parseFlatTrainerConfig(configText);
  const allowedRequired = [
    ['stage', 'sft'],
    ['do_train', 'true'],
    ['do_eval', 'true'],
    ['finetuning_type', 'lora'],
    ['lora_target', 'all'],
    ['dataset', 'nk1_teacher_student_train'],
    ['eval_dataset', 'nk1_teacher_student_validation'],
    ['overwrite_output_dir', 'false'],
    ['save_total_limit', '2'],
  ] as const;
  for (const [key, expected] of allowedRequired) requireConfigScalar(values, key, expected);
  if (values.has('holdout') || /\bholdout\b/iu.test(configText)) {
    throw new Error('teacher-distillation-config-split-contract-invalid');
  }

  const modelName = readQuotedConfigString(values, 'model_name_or_path');
  const modelRevision = readQuotedConfigString(values, 'model_revision');
  const template = readQuotedConfigString(values, 'template');
  const outputDirectory = readQuotedConfigString(values, 'output_dir');
  if (!isSafeText(modelName, 512) || !isSafeText(template, 128) ||
      FLOATING_REVISIONS.has(modelRevision.toLowerCase())) {
    throw new Error('teacher-distillation-config-model-pin-invalid');
  }

  const datasetDirectory = readQuotedConfigString(values, 'dataset_dir');
  const resolvedDatasetPath = path.resolve(workspace, datasetDirectory);
  const verifiedDataset = await verifySignedDataset({
    workspace,
    datasetDirectory,
    expectedFingerprint: input.datasetFingerprint,
    trustedKeys: trustedVerifierKeys,
  });
  const resolvedOutputDirectory = path.resolve(workspace, outputDirectory);
  if (input.signal?.aborted) {
    throw new Error('teacher-distillation-training-cancelled-before-start');
  }
  await prepareSafeOutputDirectory(workspace, resolvedOutputDirectory, resolvedDatasetPath);

  const relativeConfig = path.relative(workspace, config);
  const planFingerprint = sha256(JSON.stringify({
    datasetFingerprint: input.datasetFingerprint,
    manifestFingerprint: verifiedDataset.manifestFingerprint,
    verifiedRows: verifiedDataset.rowCount,
    configFingerprint: input.expectedConfigFingerprint,
    modelName,
    modelRevision,
    template,
    outputDirectory: resolvedOutputDirectory,
    executable: input.executable ?? 'llamafactory-cli',
    arguments: ['train', relativeConfig.split(path.sep).join('/')],
  }));
  const runId = randomUUID();
  return runLearningProcess({
    runId,
    manifestFingerprint: verifiedDataset.manifestFingerprint,
    taskId: 'teacher-student-distillation',
    taskVersion: '2',
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
    // Credentials such as HF_TOKEN are not inherited from an arbitrary parent process.
    inheritEnv: [
      'PATH', 'HOME', 'TMPDIR', 'CUDA_VISIBLE_DEVICES', 'CUDA_HOME',
      'LD_LIBRARY_PATH', 'HF_HOME', 'HF_HUB_CACHE', 'TRANSFORMERS_CACHE', 'TORCH_HOME',
    ],
    signal: input.signal,
  });
}
