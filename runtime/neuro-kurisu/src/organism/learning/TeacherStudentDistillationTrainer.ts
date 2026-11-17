import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { runLearningProcess, type LearningProcessResult } from './LearningProcessSupervisor.ts';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const isSafeText = (value: unknown, max = 4096): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;

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
    signal: input.signal,
  });
}
