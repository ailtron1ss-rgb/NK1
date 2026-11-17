import { createHash, sign as signSignature, verify as verifySignature } from 'node:crypto';
import { link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { snapshotPlainData } from './LearningTrustBoundary.ts';

export type TeacherDistillationSplit = 'train' | 'validation' | 'holdout';
export type TeacherVerificationAuthority = 'independent-verifier' | 'human-review';

export interface TeacherDistillationTaskInput {
  taskId: string;
  taskVersion: string;
  family: string;
  split: TeacherDistillationSplit;
  prompt: string;
  systemPrompt?: string;
  verifierId: string;
}

interface TeacherDistillationTask extends TeacherDistillationTaskInput {
  promptFingerprint: string;
  systemFingerprint: string;
}

export interface SignedTeacherDistillationPayload {
  schemaVersion: 1;
  artifactId: string;
  runId: string;
  manifestFingerprint: string;
  taskId: string;
  taskVersion: string;
  teacherId: string;
  teacherModel: string;
  teacherRevision: string;
  seed: number;
  promptFingerprint: string;
  systemFingerprint: string;
  completionFingerprint: string;
  evidenceRefDigest: string;
  authority: TeacherVerificationAuthority;
  verifierId: string;
  verifiedAt: number;
}

export interface SignedTeacherDistillationArtifact {
  payload: SignedTeacherDistillationPayload;
  signature: string;
}

export interface TeacherDistillationCompletionInput {
  taskId: string;
  prompt: string;
  systemPrompt?: string;
  completion: string;
  teacherId: string;
  teacherModel: string;
  teacherRevision: string;
  seed: number;
  evidenceRef: string;
  artifact: SignedTeacherDistillationArtifact;
}

export interface TeacherDistillationExample {
  schemaVersion: 1;
  exampleId: string;
  taskId: string;
  taskVersion: string;
  family: string;
  split: TeacherDistillationSplit;
  prompt: string;
  systemPrompt?: string;
  completion: string;
  teacherId: string;
  teacherModel: string;
  teacherRevision: string;
  seed: number;
  verifierId: string;
  authority: TeacherVerificationAuthority;
  evidenceRefDigest: string;
  artifactFingerprint: string;
  verifiedAt: number;
}

export interface TeacherDistillationDatasetSnapshot {
  schemaVersion: 1;
  manifestFingerprint: string;
  datasetFingerprint: string;
  training: TeacherDistillationExample[];
  validation: TeacherDistillationExample[];
  /** Count only: no holdout prompt, response, identity, or per-example result is exposed. */
  withheldHoldoutExampleCount: number;
  rejectionCounts: Record<string, number>;
}

export interface TeacherDistillationExport {
  schemaVersion: 1;
  manifestFingerprint: string;
  datasetFingerprint: string;
  files: {
    'train.jsonl': string;
    'validation.jsonl': string;
    'dataset_info.json': string;
    'manifest.json': string;
  };
}

const MAX_TASKS = 20_000;
const MAX_EXAMPLES = 100_000;
const MAX_PROMPT_CHARS = 32_000;
const MAX_SYSTEM_CHARS = 16_000;
const MAX_COMPLETION_CHARS = 64_000;
const MAX_VARIANTS_PER_TASK_TEACHER = 8;
const FLOATING_REVISIONS = new Set(['latest', 'main', 'master', 'stable', 'nightly', 'head']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSafeIdentity = (value: unknown, max = 256): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value.trim() === value && value.normalize('NFKC') === value &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);

const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('teacher-distillation-non-json-value');
    return encoded;
  }
  if (ancestors.has(value)) throw new Error('teacher-distillation-circular-value');
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) throw new Error('teacher-distillation-array-prototype-invalid');
    ancestors.add(value);
    try {
      return '[' + value.map(item => canonical(item, ancestors)).join(',') + ']';
    } finally {
      ancestors.delete(value);
    }
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('teacher-distillation-object-prototype-invalid');
  }
  ancestors.add(value);
  try {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(record[key], ancestors)).join(',') + '}';
  } finally {
    ancestors.delete(value);
  }
}

function normalizedPromptFingerprint(value: string): string {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
  return sha256(normalized);
}

function textFingerprint(value: string): string {
  return sha256(value.normalize('NFC'));
}

function hasCredentialLikeMaterial(value: string): boolean {
  return /(?:sk-[A-Za-z0-9_-]{20,}|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/iu.test(value);
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum &&
    !/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

function safeSnapshot<T>(value: unknown, errorCode: string): T {
  try {
    return snapshotPlainData(value) as T;
  } catch {
    throw new Error(errorCode);
  }
}

export function canonicalTeacherDistillationPayload(payload: SignedTeacherDistillationPayload): string {
  return canonical(payload);
}

export function teacherDistillationPayloadFingerprint(payload: SignedTeacherDistillationPayload): string {
  return sha256(canonicalTeacherDistillationPayload(payload));
}

/** Test/fixture helper only. Production signing keys must remain outside NK1 runtime. */
export function signTeacherDistillationPayloadForFixture(
  payload: SignedTeacherDistillationPayload,
  privateKeyPem: string,
): SignedTeacherDistillationArtifact {
  return {
    payload,
    signature: signSignature(null, Buffer.from(canonicalTeacherDistillationPayload(payload), 'utf8'), privateKeyPem)
      .toString('base64'),
  };
}

/** Builds a content-bound verifier payload; this helper does not confer verification trust. */
export function createTeacherDistillationPayload(input: {
  artifactId: string;
  runId: string;
  manifestFingerprint: string;
  taskId: string;
  taskVersion: string;
  teacherId: string;
  teacherModel: string;
  teacherRevision: string;
  seed: number;
  prompt: string;
  systemPrompt?: string;
  completion: string;
  evidenceRef: string;
  authority: TeacherVerificationAuthority;
  verifierId: string;
  verifiedAt: number;
}): SignedTeacherDistillationPayload {
  const snapshot = safeSnapshot<typeof input>(input, 'teacher-distillation-payload-boundary-rejected');
  return {
    schemaVersion: 1,
    artifactId: snapshot.artifactId,
    runId: snapshot.runId,
    manifestFingerprint: snapshot.manifestFingerprint,
    taskId: snapshot.taskId,
    taskVersion: snapshot.taskVersion,
    teacherId: snapshot.teacherId,
    teacherModel: snapshot.teacherModel,
    teacherRevision: snapshot.teacherRevision,
    seed: snapshot.seed,
    promptFingerprint: normalizedPromptFingerprint(snapshot.prompt),
    systemFingerprint: textFingerprint(snapshot.systemPrompt ?? ''),
    completionFingerprint: textFingerprint(snapshot.completion),
    evidenceRefDigest: sha256(snapshot.evidenceRef),
    authority: snapshot.authority,
    verifierId: snapshot.verifierId,
    verifiedAt: snapshot.verifiedAt,
  };
}

export interface TeacherDistillationRejection {
  code: string;
  taskId: string;
}

export class TeacherStudentDistillationDataset {
  private readonly manifest = new Map<string, TeacherDistillationTask>();
  private readonly examples = new Map<string, TeacherDistillationExample>();
  private readonly artifactIds = new Set<string>();
  private readonly sampleIdentities = new Map<string, string>();
  private readonly dedupeKeys = new Set<string>();
  private readonly rejections = new Map<string, number>();
  private readonly familySplits = new Map<string, TeacherDistillationSplit>();
  private readonly promptOwners = new Map<string, string>();

  constructor(rawTasks: readonly TeacherDistillationTaskInput[]) {
    const tasks = safeSnapshot<TeacherDistillationTaskInput[]>(
      rawTasks, 'teacher-distillation-manifest-data-boundary-rejected',
    );
    if (!Array.isArray(tasks) || tasks.length < 3 || tasks.length > MAX_TASKS) {
      throw new Error('teacher-distillation-manifest-task-count-invalid');
    }
    for (const raw of tasks) {
      if (!isRecord(raw) || !isSafeIdentity(raw.taskId) || !isSafeIdentity(raw.taskVersion) ||
          !isSafeIdentity(raw.family, 180) || !isSafeIdentity(raw.verifierId) ||
          !['train', 'validation', 'holdout'].includes(String(raw.split)) ||
          !validText(raw.prompt, MAX_PROMPT_CHARS) ||
          (raw.systemPrompt !== undefined && !validText(raw.systemPrompt, MAX_SYSTEM_CHARS))) {
        throw new Error('teacher-distillation-manifest-entry-invalid');
      }
      if (this.manifest.has(raw.taskId)) throw new Error('teacher-distillation-duplicate-task-id');
      const familySplit = this.familySplits.get(raw.family);
      if (familySplit && familySplit !== raw.split) {
        throw new Error('teacher-distillation-family-cross-split-leakage');
      }
      this.familySplits.set(raw.family, raw.split as TeacherDistillationSplit);
      const promptFingerprint = normalizedPromptFingerprint(raw.prompt);
      const priorPromptOwner = this.promptOwners.get(promptFingerprint);
      if (priorPromptOwner) {
        const previous = this.manifest.get(priorPromptOwner)!;
        if (previous.split !== raw.split) throw new Error('teacher-distillation-prompt-cross-split-leakage');
      }
      this.promptOwners.set(promptFingerprint, raw.taskId);
      const task: TeacherDistillationTask = Object.freeze({
        taskId: raw.taskId,
        taskVersion: raw.taskVersion,
        family: raw.family,
        split: raw.split as TeacherDistillationSplit,
        prompt: raw.prompt,
        ...(raw.systemPrompt !== undefined ? { systemPrompt: raw.systemPrompt } : {}),
        verifierId: raw.verifierId,
        promptFingerprint,
        systemFingerprint: textFingerprint(raw.systemPrompt ?? ''),
      });
      this.manifest.set(task.taskId, task);
    }
    const splits = new Set([...this.manifest.values()].map(task => task.split));
    if (!['train', 'validation', 'holdout'].every(split => splits.has(split as TeacherDistillationSplit))) {
      throw new Error('teacher-distillation-all-three-splits-required');
    }
  }

  manifestFingerprint(): string {
    const rows = [...this.manifest.values()].map(task => ({
      taskId: task.taskId,
      taskVersion: task.taskVersion,
      family: task.family,
      split: task.split,
      promptFingerprint: task.promptFingerprint,
      systemFingerprint: task.systemFingerprint,
      verifierId: task.verifierId,
    })).sort((a, b) => a.taskId.localeCompare(b.taskId));
    return sha256(canonical(rows));
  }

  private reject(code: string, taskId = ''): { accepted: false; rejection: TeacherDistillationRejection } {
    this.rejections.set(code, (this.rejections.get(code) ?? 0) + 1);
    return { accepted: false, rejection: { code, taskId } };
  }

  ingestSignedExample(
    rawRecord: TeacherDistillationCompletionInput,
    trustedVerifierKeys: ReadonlyMap<string, string>,
  ): { accepted: true; exampleId: string; split: TeacherDistillationSplit } |
     { accepted: false; rejection: TeacherDistillationRejection } {
    if (this.examples.size >= MAX_EXAMPLES) return this.reject('dataset-capacity-exceeded');
    let record: TeacherDistillationCompletionInput;
    try {
      record = snapshotPlainData(rawRecord) as TeacherDistillationCompletionInput;
    } catch {
      return this.reject('record-data-boundary-rejected');
    }
    if (!isRecord(record) || !isSafeIdentity(record.taskId) ||
        !validText(record.prompt, MAX_PROMPT_CHARS) ||
        (record.systemPrompt !== undefined && !validText(record.systemPrompt, MAX_SYSTEM_CHARS)) ||
        !validText(record.completion, MAX_COMPLETION_CHARS) ||
        !isSafeIdentity(record.teacherId, 180) || !isSafeIdentity(record.teacherModel, 256) ||
        !isSafeIdentity(record.teacherRevision, 128) ||
        FLOATING_REVISIONS.has(String(record.teacherRevision).toLowerCase()) ||
        !Number.isSafeInteger(record.seed) || record.seed < 0 ||
        !isSafeIdentity(record.evidenceRef, 1024) ||
        hasCredentialLikeMaterial(record.prompt) || hasCredentialLikeMaterial(record.systemPrompt ?? '') ||
        hasCredentialLikeMaterial(record.completion)) {
      return this.reject('record-fields-invalid', typeof record?.taskId === 'string' ? record.taskId : '');
    }
    const task = this.manifest.get(record.taskId);
    if (!task) return this.reject('unknown-task', record.taskId);
    if (normalizedPromptFingerprint(record.prompt) !== task.promptFingerprint ||
        textFingerprint(record.systemPrompt ?? '') !== task.systemFingerprint) {
      return this.reject('prompt-or-system-mismatch', record.taskId);
    }
    const payload = record.artifact?.payload;
    if (!isRecord(payload) || payload.schemaVersion !== 1 ||
        payload.taskId !== record.taskId || payload.taskVersion !== task.taskVersion ||
        payload.manifestFingerprint !== this.manifestFingerprint() ||
        payload.teacherId !== record.teacherId || payload.teacherModel !== record.teacherModel ||
        payload.teacherRevision !== record.teacherRevision || payload.seed !== record.seed ||
        payload.promptFingerprint !== task.promptFingerprint ||
        payload.systemFingerprint !== task.systemFingerprint ||
        payload.completionFingerprint !== textFingerprint(record.completion) ||
        payload.evidenceRefDigest !== sha256(record.evidenceRef) ||
        !isSafeIdentity(payload.artifactId, 256) || !isSafeIdentity(payload.runId, 256) ||
        !['independent-verifier', 'human-review'].includes(String(payload.authority)) ||
        payload.verifierId !== task.verifierId ||
        !Number.isFinite(payload.verifiedAt) || Number(payload.verifiedAt) <= 0) {
      return this.reject('artifact-payload-mismatch', record.taskId);
    }
    if (this.artifactIds.has(String(payload.artifactId))) return this.reject('duplicate-artifact', record.taskId);
    const publicKey = trustedVerifierKeys.get(String(payload.verifierId));
    if (!publicKey) return this.reject('untrusted-verifier', record.taskId);
    const signature = record.artifact.signature;
    if (typeof signature !== 'string' || signature.length < 40 || signature.length > 4096) {
      return this.reject('signature-invalid', record.taskId);
    }
    let signatureValid = false;
    try {
      signatureValid = verifySignature(
        null,
        Buffer.from(canonicalTeacherDistillationPayload(payload as SignedTeacherDistillationPayload), 'utf8'),
        publicKey,
        Buffer.from(signature, 'base64'),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) return this.reject('signature-invalid', record.taskId);

    const artifactFingerprint = teacherDistillationPayloadFingerprint(payload as SignedTeacherDistillationPayload);
    const sampleIdentity = JSON.stringify([
      record.taskId, record.teacherId, record.teacherModel, record.teacherRevision, record.seed,
    ]);
    const existing = this.sampleIdentities.get(sampleIdentity);
    if (existing) {
      return this.reject(existing === artifactFingerprint ? 'duplicate-sample' : 'conflicting-sample', record.taskId);
    }
    const dedupeKey = JSON.stringify([
      task.promptFingerprint, task.systemFingerprint, record.teacherModel,
      record.teacherRevision, textFingerprint(record.completion),
    ]);
    if (this.dedupeKeys.has(dedupeKey)) return this.reject('duplicate-content', record.taskId);
    const variantPrefix = JSON.stringify([record.taskId, record.teacherModel, record.teacherRevision]).slice(0, -1) + ',';
    const variants = [...this.sampleIdentities.keys()].filter(key => key.startsWith(variantPrefix)).length;
    if (variants >= MAX_VARIANTS_PER_TASK_TEACHER) return this.reject('per-task-variant-limit', record.taskId);

    const exampleId = sha256(JSON.stringify([artifactFingerprint, task.taskId, record.teacherId]));
    const example: TeacherDistillationExample = Object.freeze({
      schemaVersion: 1,
      exampleId,
      taskId: task.taskId,
      taskVersion: task.taskVersion,
      family: task.family,
      split: task.split,
      prompt: task.prompt,
      ...(task.systemPrompt !== undefined ? { systemPrompt: task.systemPrompt } : {}),
      completion: record.completion,
      teacherId: record.teacherId,
      teacherModel: record.teacherModel,
      teacherRevision: record.teacherRevision,
      seed: record.seed,
      verifierId: task.verifierId,
      authority: payload.authority as TeacherVerificationAuthority,
      evidenceRefDigest: sha256(record.evidenceRef),
      artifactFingerprint,
      verifiedAt: Number(payload.verifiedAt),
    });
    this.artifactIds.add(String(payload.artifactId));
    this.sampleIdentities.set(sampleIdentity, artifactFingerprint);
    this.dedupeKeys.add(dedupeKey);
    this.examples.set(exampleId, example);
    return { accepted: true, exampleId, split: task.split as TeacherDistillationSplit };
  }

  snapshot(): TeacherDistillationDatasetSnapshot {
    const sort = (rows: TeacherDistillationExample[]) => rows.sort((a, b) =>
      a.taskId.localeCompare(b.taskId) || a.teacherModel.localeCompare(b.teacherModel) ||
      a.seed - b.seed || a.exampleId.localeCompare(b.exampleId));
    const training = sort([...this.examples.values()].filter(row => row.split === 'train'));
    const validation = sort([...this.examples.values()].filter(row => row.split === 'validation'));
    const holdoutCount = [...this.examples.values()].filter(row => row.split === 'holdout').length;
    const datasetIdentity = {
      schemaVersion: 1 as const,
      manifestFingerprint: this.manifestFingerprint(),
      training,
      validation,
    };
    const datasetFingerprint = sha256(canonical(datasetIdentity));
    return {
      ...datasetIdentity,
      datasetFingerprint,
      withheldHoldoutExampleCount: holdoutCount,
      rejectionCounts: Object.fromEntries([...this.rejections.entries()].sort(([a], [b]) => a.localeCompare(b))),
    };
  }

  exportLlamaFactoryShareGPT(): TeacherDistillationExport {
    const snapshot = this.snapshot();
    if (!snapshot.training.length) throw new Error('teacher-distillation-training-data-empty');
    if (!snapshot.validation.length) throw new Error('teacher-distillation-validation-data-empty');
    const toJsonl = (rows: TeacherDistillationExample[]) => rows.map(row => {
      const conversations = [
        { from: 'human', value: row.prompt },
        { from: 'gpt', value: row.completion },
      ];
      return JSON.stringify({
        conversations,
        ...(row.systemPrompt ? { system: row.systemPrompt } : {}),
      });
    }).join('\n') + '\n';
    const train = toJsonl(snapshot.training);
    const validation = toJsonl(snapshot.validation);
    const datasetInfo = {
      nk1_teacher_student_train: {
        file_name: 'train.jsonl',
        formatting: 'sharegpt',
        columns: { messages: 'conversations' },
        tags: {
          role_tag: 'from', content_tag: 'value',
          user_tag: 'human', assistant_tag: 'gpt',
          system_tag: 'system',
        },
      },
      nk1_teacher_student_validation: {
        file_name: 'validation.jsonl',
        formatting: 'sharegpt',
        columns: { messages: 'conversations' },
        tags: {
          role_tag: 'from', content_tag: 'value',
          user_tag: 'human', assistant_tag: 'gpt',
          system_tag: 'system',
        },
      },
    };
    const manifest = {
      schemaVersion: 1,
      manifestFingerprint: snapshot.manifestFingerprint,
      datasetFingerprint: snapshot.datasetFingerprint,
      format: 'llamafactory-sharegpt',
      trainingRows: snapshot.training.length,
      validationRows: snapshot.validation.length,
      withheldHoldoutExampleCount: snapshot.withheldHoldoutExampleCount,
      holdoutExported: false,
      trainSha256: sha256(train),
      validationSha256: sha256(validation),
      datasetInfoSha256: sha256(JSON.stringify(datasetInfo)),
      teacherModels: [...new Set([...snapshot.training, ...snapshot.validation]
        .map(row => row.teacherModel + '@' + row.teacherRevision))].sort(),
    };
    return {
      schemaVersion: 1,
      manifestFingerprint: snapshot.manifestFingerprint,
      datasetFingerprint: snapshot.datasetFingerprint,
      files: {
        'train.jsonl': train,
        'validation.jsonl': validation,
        'dataset_info.json': JSON.stringify(datasetInfo, null, 2) + '\n',
        'manifest.json': JSON.stringify(manifest, null, 2) + '\n',
      },
    };
  }
}

/** Writes a complete export without replacing existing files; collisions fail closed. */
export async function writeTeacherDistillationExport(
  outputDirectory: string,
  exported: TeacherDistillationExport,
): Promise<Record<keyof TeacherDistillationExport['files'], string>> {
  if (!isSafeIdentity(outputDirectory, 4096) || !exported || exported.schemaVersion !== 1) {
    throw new Error('teacher-distillation-export-write-input-invalid');
  }
  const target = path.resolve(outputDirectory);
  await mkdir(target, { recursive: true, mode: 0o700 });
  const temp = await mkdtemp(path.join(target, '.nk1-distillation-'));
  const names = Object.keys(exported.files) as Array<keyof TeacherDistillationExport['files']>;
  const created: string[] = [];
  const paths = {} as Record<keyof TeacherDistillationExport['files'], string>;
  try {
    for (const name of names) {
      await writeFile(path.join(temp, name), exported.files[name], {
        encoding: 'utf8', mode: 0o600, flag: 'wx',
      });
    }
    for (const name of names) {
      const destination = path.join(target, name);
      await link(path.join(temp, name), destination);
      created.push(destination);
      paths[name] = destination;
    }
    return paths;
  } catch (error) {
    await Promise.all(created.map(file => rm(file, { force: true })));
    throw error;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export interface LlamaFactorySftConfigInput {
  modelNameOrPath: string;
  modelRevision: string;
  datasetDirectory: string;
  outputDirectory: string;
  template: string;
  cutoffLen: number;
  loraRank: number;
  learningRate: number;
  numTrainEpochs: number;
  perDeviceTrainBatchSize: number;
  gradientAccumulationSteps: number;
  quantizationBit?: 4 | 8;
}

/** Emits a pinned SFT/LoRA config. Train and validation are explicit; holdout is absent. */
export function createLlamaFactorySftConfig(raw: LlamaFactorySftConfigInput): {
  yaml: string;
  fingerprint: string;
} {
  const input = safeSnapshot<LlamaFactorySftConfigInput>(
    raw, 'teacher-distillation-training-config-boundary-rejected',
  );
  if (!isSafeIdentity(input.modelNameOrPath, 512) || !isSafeIdentity(input.modelRevision, 128) ||
      FLOATING_REVISIONS.has(input.modelRevision.toLowerCase()) ||
      !isSafeIdentity(input.datasetDirectory, 4096) || !isSafeIdentity(input.outputDirectory, 4096) ||
      !isSafeIdentity(input.template, 128) ||
      !Number.isSafeInteger(input.cutoffLen) || input.cutoffLen < 128 || input.cutoffLen > 65_536 ||
      !Number.isSafeInteger(input.loraRank) || input.loraRank < 4 || input.loraRank > 256 ||
      !Number.isFinite(input.learningRate) || input.learningRate <= 0 || input.learningRate > 0.01 ||
      !Number.isFinite(input.numTrainEpochs) || input.numTrainEpochs <= 0 || input.numTrainEpochs > 100 ||
      !Number.isSafeInteger(input.perDeviceTrainBatchSize) || input.perDeviceTrainBatchSize < 1 ||
      input.perDeviceTrainBatchSize > 128 ||
      !Number.isSafeInteger(input.gradientAccumulationSteps) || input.gradientAccumulationSteps < 1 ||
      input.gradientAccumulationSteps > 1024 ||
      (input.quantizationBit !== undefined && ![4, 8].includes(input.quantizationBit))) {
    throw new Error('teacher-distillation-training-config-invalid');
  }
  const q = (value: string) => JSON.stringify(value);
  const lines = [
    'model_name_or_path: ' + q(input.modelNameOrPath),
    'model_revision: ' + q(input.modelRevision),
    'stage: sft',
    'do_train: true',
    'do_eval: true',
    'finetuning_type: lora',
    'lora_rank: ' + input.loraRank,
    'lora_target: all',
    'dataset_dir: ' + q(input.datasetDirectory),
    'dataset: nk1_teacher_student_train',
    'eval_dataset: nk1_teacher_student_validation',
    'template: ' + q(input.template),
    'cutoff_len: ' + input.cutoffLen,
    'output_dir: ' + q(input.outputDirectory),
    'learning_rate: ' + input.learningRate,
    'num_train_epochs: ' + input.numTrainEpochs,
    'per_device_train_batch_size: ' + input.perDeviceTrainBatchSize,
    'gradient_accumulation_steps: ' + input.gradientAccumulationSteps,
    'overwrite_output_dir: false',
    'save_total_limit: 2',
    ...(input.quantizationBit !== undefined ? ['quantization_bit: ' + input.quantizationBit] : []),
  ];
  const yaml = lines.join('\n') + '\n';
  return { yaml, fingerprint: sha256(yaml) };
}
