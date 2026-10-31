import { createHash } from 'node:crypto';
import { VerifiedOutcomeLedger, type EvaluationSplit, type TaskManifestEntry, type VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';

export interface LearningExperimentArm {
  arm: 'P' | 'C' | `R(${number})`;
  method: string;
}
export interface LearningExperimentRun {
  runId: string;
  manifestFingerprint: string;
  split: EvaluationSplit;
  taskId: string;
  taskVersion: string;
  family: string;
  verifierId: string;
  seed: number;
  arm: LearningExperimentArm['arm'];
  method: string;
  orderWithinSeed: number;
}
export interface LearningExperimentPlan {
  protocol: 'nk1-matched-reset-retention';
  protocolVersion: 1;
  manifestFingerprint: string;
  planFingerprint: string;
  split: EvaluationSplit;
  seedIds: number[];
  arms: LearningExperimentArm[];
  runs: LearningExperimentRun[];
  counts: { tasks: number; seeds: number; arms: number; runs: number };
  boundaries: string[];
}
export interface LearningExperimentPlanOptions {
  split?: EvaluationSplit;
  seeds: number[];
  resetEvery: number[];
  priorMethod: string;
  continuousMethod: string;
  resetMethodPrefix: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}
function parseResetArm(value: string): number | null {
  const match = /^R\(([1-9]\d*)\)$/.exec(value);
  return match ? Number(match[1]) : null;
}
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Builds a deterministic, matched experimental schedule. It does not execute
 * the learner or simulate process resets: the caller must run each scheduled
 * arm and record independently verified outcomes in VerifiedOutcomeLedger.
 */
export function createLearningExperimentPlan(
  manifest: TaskManifestEntry[],
  options: LearningExperimentPlanOptions,
): LearningExperimentPlan {
  if (!Array.isArray(manifest) || !manifest.length) throw new Error('manifest must be non-empty');
  const split = options.split ?? 'holdout';
  if (!['train', 'validation', 'holdout'].includes(split)) throw new Error('invalid evaluation split');
  if (!Array.isArray(options.seeds) || !options.seeds.length) throw new Error('seeds must be non-empty');
  const seeds = [...options.seeds];
  if (new Set(seeds).size !== seeds.length || seeds.some(seed => !Number.isSafeInteger(seed) || seed < 0)) {
    throw new Error('seeds must be distinct non-negative safe integers');
  }
  if (!Array.isArray(options.resetEvery) || !options.resetEvery.length) throw new Error('resetEvery must be non-empty');
  const resetEvery = [...options.resetEvery];
  if (new Set(resetEvery).size !== resetEvery.length || resetEvery.some(k => !Number.isSafeInteger(k) || k < 1)) {
    throw new Error('resetEvery values must be distinct positive safe integers');
  }
  if (![options.priorMethod, options.continuousMethod, options.resetMethodPrefix].every(nonEmpty)) {
    throw new Error('method names must be non-empty');
  }
  const arms: LearningExperimentArm[] = [
    { arm: 'P', method: options.priorMethod },
    { arm: 'C', method: options.continuousMethod },
    ...resetEvery.map(k => ({ arm: `R(${k})` as const, method: `${options.resetMethodPrefix}${k}` })),
  ];
  if (new Set(arms.map(arm => arm.arm)).size !== arms.length ||
      new Set(arms.map(arm => arm.method)).size !== arms.length) {
    throw new Error('arm labels and method names must be unique');
  }
  // The canonical ledger constructor validates task identity and cross-split leakage.
  const ledger = new VerifiedOutcomeLedger(manifest);
  const manifestFingerprint = ledger.manifestFingerprint();
  const tasks = manifest.filter(task => task.split === split).sort((a, b) => a.taskId.localeCompare(b.taskId));
  if (!tasks.length) throw new Error(`no manifest tasks for split ${split}`);

  const runs: LearningExperimentRun[] = [];
  for (const seed of [...seeds].sort((a, b) => a - b)) {
    const pending = tasks.flatMap(task => arms.map(arm => ({
      task, arm,
      orderKey: sha256(`${manifestFingerprint}|order|v1|${seed}|${task.taskId}|${arm.arm}`),
    }))).sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    pending.forEach((item, orderWithinSeed) => {
      const payload = {
        manifestFingerprint, split, taskId: item.task.taskId, seed,
        arm: item.arm.arm, method: item.arm.method, protocolVersion: 1,
      };
      runs.push({
        runId: sha256(canonical(payload)),
        manifestFingerprint,
        split,
        taskId: item.task.taskId,
        taskVersion: item.task.version,
        family: item.task.family,
        verifierId: item.task.verifierId,
        seed,
        arm: item.arm.arm,
        method: item.arm.method,
        orderWithinSeed,
      });
    });
  }
  const runIds = new Set(runs.map(run => run.runId));
  if (runIds.size !== runs.length) throw new Error('internal plan collision: duplicate run IDs');
  const planPayload = {
    protocol: 'nk1-matched-reset-retention', protocolVersion: 1,
    manifestFingerprint, split, seedIds: [...seeds].sort((a, b) => a - b), arms, runs,
  };
  return {
    protocol: 'nk1-matched-reset-retention',
    protocolVersion: 1,
    manifestFingerprint,
    planFingerprint: sha256(canonical(planPayload)),
    split,
    seedIds: [...seeds].sort((a, b) => a - b),
    arms,
    runs,
    counts: { tasks: tasks.length, seeds: seeds.length, arms: arms.length, runs: runs.length },
    boundaries: [
      'A plan is not an execution receipt and must never be recorded as an outcome.',
      'The caller must perform real learner runs and hard process restarts for R(k) arms.',
      'Outcome authority and evidence must be independently verified by the canonical ledger.',
      'Use holdout only for final evaluation; do not tune methods against holdout results.',
    ],
  };
}

/** Verify a saved plan against the exact manifest and reject edited run schedules. */
export function validateLearningExperimentPlan(
  plan: LearningExperimentPlan,
  manifest: TaskManifestEntry[],
): { valid: true; runCount: number } {
  if (!plan || plan.protocol !== 'nk1-matched-reset-retention' || plan.protocolVersion !== 1) {
    throw new Error('unsupported experiment plan');
  }
  if (!['train', 'validation', 'holdout'].includes(plan.split)) {
    throw new Error('plan split must be train, validation or holdout');
  }
  if (!Array.isArray(plan.seedIds) || !plan.seedIds.length ||
      plan.seedIds.some(seed => !Number.isSafeInteger(seed) || seed < 0) ||
      new Set(plan.seedIds).size !== plan.seedIds.length ||
      plan.seedIds.some((seed, i) => i > 0 && plan.seedIds[i - 1]! >= seed)) {
    throw new Error('plan seed IDs must be unique, non-negative, and sorted');
  }
  if (!Array.isArray(plan.arms) || plan.arms.length < 3 ||
      !plan.arms.some(arm => arm.arm === 'P') || !plan.arms.some(arm => arm.arm === 'C')) {
    throw new Error('plan must contain prior, continuous and reset arms');
  }
  const armLabels = plan.arms.map(arm => arm.arm);
  const methodNames = plan.arms.map(arm => arm.method);
  if (new Set(armLabels).size !== armLabels.length || new Set(methodNames).size !== methodNames.length ||
      plan.arms.some(arm => !nonEmpty(arm.method) ||
        (arm.arm !== 'P' && arm.arm !== 'C' && parseResetArm(arm.arm) === null))) {
    throw new Error('plan arms must have valid unique labels and methods');
  }
  if (!plan.counts || plan.counts.seeds !== plan.seedIds.length ||
      plan.counts.arms !== plan.arms.length ||
      plan.counts.tasks !== manifest.filter(task => task.split === plan.split).length) {
    throw new Error('plan summary counts do not match its manifest, seeds and arms');
  }
  const expectedManifest = new VerifiedOutcomeLedger(manifest).manifestFingerprint();
  if (expectedManifest !== plan.manifestFingerprint) throw new Error('manifest fingerprint mismatch');
  if (!Array.isArray(plan.runs) || plan.runs.length !== plan.counts.runs) throw new Error('plan run count mismatch');
  const seen = new Set<string>();
  for (const run of plan.runs) {
    if (run.manifestFingerprint !== plan.manifestFingerprint || run.split !== plan.split ||
        !plan.seedIds.includes(run.seed) || !plan.arms.some(arm => arm.arm === run.arm && arm.method === run.method)) {
      throw new Error('run does not match plan identity');
    }
    if (seen.has(run.runId)) throw new Error('duplicate run ID');
    seen.add(run.runId);
    const expected = sha256(canonical({
      manifestFingerprint: plan.manifestFingerprint, split: run.split, taskId: run.taskId,
      seed: run.seed, arm: run.arm, method: run.method, protocolVersion: plan.protocolVersion,
    }));
    if (run.runId !== expected) throw new Error('run ID fingerprint mismatch');
    const task = manifest.find(entry => entry.taskId === run.taskId);
    if (!task || task.split !== plan.split || task.version !== run.taskVersion ||
        task.family !== run.family || task.verifierId !== run.verifierId) {
      throw new Error('run task metadata does not match manifest');
    }
  }
  const expectedCount = manifest.filter(task => task.split === plan.split).length * plan.seedIds.length * plan.arms.length;
  if (plan.runs.length !== expectedCount) throw new Error('plan has incomplete matched coverage');
  const cellKeys = plan.runs.map(run => JSON.stringify([run.taskId, run.seed, run.arm]));
  if (new Set(cellKeys).size !== cellKeys.length) throw new Error('duplicate task/seed/arm run');
  const planPayload = {
    protocol: plan.protocol, protocolVersion: plan.protocolVersion,
    manifestFingerprint: plan.manifestFingerprint, split: plan.split,
    seedIds: plan.seedIds, arms: plan.arms, runs: plan.runs,
  };
  if (sha256(canonical(planPayload)) !== plan.planFingerprint) throw new Error('plan fingerprint mismatch');
  return { valid: true, runCount: plan.runs.length };
}


/**
 * Stricter acceptance gate for claims about durable learning improvement.
 * The ordinary planner remains useful for smoke/validation experiments with
 * fewer seeds; this gate is mandatory before interpreting a holdout experiment
 * as research-grade evidence. It validates schedule coverage only, not outcomes.
 */
export function validateResearchGradeLearningExperimentPlan(
  plan: LearningExperimentPlan,
  manifest: TaskManifestEntry[],
): { valid: true; runCount: number; seedCount: number; familyCount: number; minimumSeeds: 5 } {
  const validated = validateLearningExperimentPlan(plan, manifest);
  if (plan.split !== 'holdout') {
    throw new Error('research-grade learning evidence requires an independent holdout split');
  }
  if (plan.seedIds.length < 5) {
    throw new Error('research-grade learning evidence requires at least five paired seeds');
  }
  const families = new Set(manifest
    .filter(task => task.split === 'holdout')
    .map(task => task.family));
  if (families.size === 0 || [...families].some(family =>
    !plan.runs.some(run => run.family === family))) {
    throw new Error('research-grade learning plan has incomplete task-family coverage');
  }
  return {
    valid: true,
    runCount: validated.runCount,
    seedCount: plan.seedIds.length,
    familyCount: families.size,
    minimumSeeds: 5,
  };
}

/**
 * Records one actual result only if it corresponds to a scheduled run. This
 * binds the outcome to the plan's exact task/version/method/seed/verifier and
 * rejects duplicate planned cells. It cannot authenticate external evidence;
 * the ledger's verifier policy remains authoritative.
 */
export function recordPlannedLearningOutcome(
  ledger: VerifiedOutcomeLedger,
  plan: LearningExperimentPlan,
  runId: string,
  outcome: Omit<VerifiedTaskOutcome, 'taskId' | 'taskVersion' | 'method' | 'seed' | 'verifierId'> & {
    taskId?: string;
    taskVersion?: string;
    method?: string;
    seed?: number;
    verifierId?: string;
  },
): { accepted: boolean; rejection?: ReturnType<VerifiedOutcomeLedger['record']>['rejection'] } {
  const snapshot = ledger.snapshot();
  const manifest = snapshot.manifest as TaskManifestEntry[];
  validateLearningExperimentPlan(plan, manifest);
  if (ledger.manifestFingerprint() !== plan.manifestFingerprint) throw new Error('plan is bound to a different ledger manifest');
  const run = plan.runs.find(item => item.runId === runId);
  if (!run) throw new Error('runId is not present in experiment plan');
  if ((outcome.taskId !== undefined && outcome.taskId !== run.taskId) ||
      (outcome.taskVersion !== undefined && outcome.taskVersion !== run.taskVersion) ||
      (outcome.method !== undefined && outcome.method !== run.method) ||
      (outcome.seed !== undefined && outcome.seed !== run.seed) ||
      (outcome.verifierId !== undefined && outcome.verifierId !== run.verifierId)) {
    throw new Error('outcome metadata does not match scheduled run');
  }
  const prior = (snapshot.outcomes as VerifiedTaskOutcome[]).some(item =>
    item.taskId === run.taskId && item.taskVersion === run.taskVersion &&
    item.method === run.method && item.seed === run.seed);
  if (prior) throw new Error('scheduled task/method/seed already has an outcome');
  return ledger.record({
    ...outcome,
    taskId: run.taskId,
    taskVersion: run.taskVersion,
    method: run.method,
    seed: run.seed,
    verifierId: run.verifierId,
  } as VerifiedTaskOutcome);
}
