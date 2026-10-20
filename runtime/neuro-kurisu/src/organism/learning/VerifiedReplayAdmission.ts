import type { EvaluationSplit, TaskManifestEntry, VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';
import { selectReplayBatch, type ReplayCandidate, type ReplaySelectionOptions } from './ReplaySelectionPolicy.ts';

export interface ReplayExperienceReference extends ReplayCandidate {
  /** Stable identity in the versioned task manifest. */
  taskId: string;
  taskVersion: string;
  method: string;
  seed: number;
  attempt: number;
  /** Must match an accepted outcome's evidence reference exactly. */
  evidenceRef: string;
}

export interface VerifiedReplayExperience<T extends ReplayExperienceReference = ReplayExperienceReference> {
  experience: T;
  outcome: Pick<VerifiedTaskOutcome, 'passed' | 'authority' | 'verifierId' | 'evidenceRef' | 'observedAt'>;
  manifestFingerprint: string;
}

export interface ReplayAdmissionRejection {
  experienceId: string;
  code: 'invalid-reference' | 'unknown-task' | 'wrong-split' | 'task-version-mismatch' |
    'outcome-not-found' | 'evidence-reference-mismatch' | 'duplicate-experience-id';
}

export interface VerifiedReplayAdmissionResult<T extends ReplayExperienceReference = ReplayExperienceReference> {
  split: EvaluationSplit;
  manifestFingerprint: string;
  eligibleOutcomeCount: number;
  admittedCount: number;
  selectedCount: number;
  admitted: Array<VerifiedReplayExperience<T>>;
  selected: Array<VerifiedReplayExperience<T>>;
  rejected: ReplayAdmissionRejection[];
}

const tuple = (...parts: Array<string | number>): string => JSON.stringify(parts);

/**
 * The evidence-gated bridge between verified outcomes and replay selection.
 *
 * This function does not execute a verifier or train a model. It only admits an
 * experience when the versioned ledger already contains a matching accepted
 * outcome with the same task/version/method/seed/attempt/evidence reference.
 * Both success and failure are retained: verified failures can teach recovery.
 * Holdout is never replayed by default; callers must explicitly choose a split.
 */
export function selectVerifiedReplayExperiences<T extends ReplayExperienceReference>(
  ledger: VerifiedOutcomeLedger,
  experiences: readonly T[],
  options: ReplaySelectionOptions & { split?: EvaluationSplit } = {},
): VerifiedReplayAdmissionResult<T> {
  const split = options.split ?? 'train';
  const snapshot = ledger.snapshot();
  const manifest = snapshot.manifest as TaskManifestEntry[];
  const outcomes = snapshot.outcomes as VerifiedTaskOutcome[];
  const manifestFingerprint = ledger.manifestFingerprint();
  const manifestByTask = new Map(manifest.map(task => [task.taskId, task]));
  const outcomeByIdentity = new Map<string, VerifiedTaskOutcome>();
  for (const outcome of outcomes) {
    outcomeByIdentity.set(tuple(outcome.taskId, outcome.method, outcome.seed, outcome.attempt), outcome);
  }

  const rejected: ReplayAdmissionRejection[] = [];
  const admitted: Array<VerifiedReplayExperience<T>> = [];
  const seenIds = new Set<string>();
  for (const experience of experiences) {
    const id = typeof experience?.id === 'string' ? experience.id : '';
    const reject = (code: ReplayAdmissionRejection['code']) => rejected.push({ experienceId: id, code });
    if (!experience || typeof experience !== 'object' || !id || typeof experience.taskId !== 'string' ||
        typeof experience.taskVersion !== 'string' || typeof experience.method !== 'string' ||
        !experience.method.trim() || !Number.isSafeInteger(experience.seed) || experience.seed < 0 ||
        !Number.isSafeInteger(experience.attempt) || experience.attempt < 1 ||
        typeof experience.evidenceRef !== 'string' || !experience.evidenceRef.trim()) {
      reject('invalid-reference');
      continue;
    }
    if (seenIds.has(id)) { reject('duplicate-experience-id'); continue; }
    seenIds.add(id);
    const task = manifestByTask.get(experience.taskId);
    if (!task) { reject('unknown-task'); continue; }
    if (task.split !== split) { reject('wrong-split'); continue; }
    if (task.version !== experience.taskVersion) { reject('task-version-mismatch'); continue; }
    const outcome = outcomeByIdentity.get(tuple(experience.taskId, experience.method, experience.seed, experience.attempt));
    if (!outcome) { reject('outcome-not-found'); continue; }
    if (outcome.evidenceRef !== experience.evidenceRef) { reject('evidence-reference-mismatch'); continue; }
    admitted.push({
      experience,
      outcome: {
        passed: outcome.passed,
        authority: outcome.authority,
        verifierId: outcome.verifierId,
        evidenceRef: outcome.evidenceRef,
        observedAt: outcome.observedAt,
      },
      manifestFingerprint,
    });
  }

  const selected = selectReplayBatch(admitted.map(item => ({
    ...item.experience,
    // Include provenance in the selection object; it remains attached through selection.
    _verifiedReplay: item,
  })), options).map(item => item._verifiedReplay);

  return {
    split,
    manifestFingerprint,
    eligibleOutcomeCount: outcomes.filter(outcome => manifestByTask.get(outcome.taskId)?.split === split).length,
    admittedCount: admitted.length,
    selectedCount: selected.length,
    admitted,
    selected,
    rejected,
  };
}
