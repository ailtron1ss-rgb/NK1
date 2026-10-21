import { createHash } from 'node:crypto';
import type { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';
import { evaluateSkillRevision, type SkillRevisionGateOptions, type SkillRevisionGateResult } from './SkillRevisionGate.ts';

export interface VerifiedSkillPromotionOptions extends SkillRevisionGateOptions {
  /** Optional second, independent requirement for the number of complete paired seeds. */
  minCompleteSeeds?: number;
}

export interface VerifiedSkillPromotionProposal {
  schemaVersion: 1;
  proposalId: string;
  manifestFingerprint: string;
  baselineMethod: string;
  candidateMethod: string;
  evaluatedAt: number;
  outcomeRowsSeen: number;
  pairedTaskSeedN: number;
  completePairedSeeds: number;
  gate: SkillRevisionGateResult;
  /** Always false: proposal generation never changes the active skill library. */
  canActivateAutomatically: false;
  activationRequirements: string[];
}

/**
 * Convert the canonical, already-validated ledger into a reproducible revision
 * proposal. This deliberately has no skill-store dependency and cannot activate
 * a candidate; a separate approval/rollback controller must own that side effect.
 */
export function proposeVerifiedSkillPromotion(
  ledger: VerifiedOutcomeLedger,
  baselineMethod: string,
  candidateMethod: string,
  options: VerifiedSkillPromotionOptions = {},
): VerifiedSkillPromotionProposal {
  if (!baselineMethod?.trim() || !candidateMethod?.trim() || baselineMethod === candidateMethod) {
    throw new Error('two distinct method names are required');
  }
  const snapshot = ledger.snapshot();
  const taskById = new Map(snapshot.manifest.map(task => [task.taskId, task]));
  const observations = snapshot.outcomes.flatMap(outcome => {
    const task = taskById.get(outcome.taskId);
    if (!task || task.version !== outcome.taskVersion || task.split !== 'holdout' ||
        (outcome.method !== baselineMethod && outcome.method !== candidateMethod)) return [];
    return [{
      taskId: outcome.taskId,
      family: task.family,
      split: task.split,
      method: outcome.method,
      seed: outcome.seed,
      attempt: outcome.attempt,
      passed: outcome.passed,
      authority: outcome.authority,
      verifierId: outcome.verifierId,
      expectedVerifierId: task.verifierId,
      evidenceRef: outcome.evidenceRef,
    }];
  });
  const gate = evaluateSkillRevision(observations, baselineMethod, candidateMethod, options);
  const taskSeedPairs = new Set(observations.map(row => JSON.stringify([row.taskId, row.seed, row.attempt])));
  const holdoutTasks = snapshot.manifest.filter(task => task.split === 'holdout').map(task => task.taskId);
  const bySeed = new Map<number, Set<string>>();
  for (const row of observations) {
    const set = bySeed.get(row.seed) ?? new Set<string>();
    set.add(row.taskId + '\u0000' + row.method);
    bySeed.set(row.seed, set);
  }
  const completePairedSeeds = [...bySeed.entries()].filter(([, seen]) =>
    holdoutTasks.length > 0 && holdoutTasks.every(taskId =>
      seen.has(taskId + '\u0000' + baselineMethod) && seen.has(taskId + '\u0000' + candidateMethod),
    ),
  ).length;
  const minCompleteSeeds = Math.max(1, Math.min(1000, Math.floor(options.minCompleteSeeds ?? 1)));
  const seedCoverageOkay = completePairedSeeds >= minCompleteSeeds;
  const finalGate: SkillRevisionGateResult = seedCoverageOkay ? gate : {
    ...gate,
    accepted: false,
    reason: 'insufficient-complete-holdout-seed-coverage',
  };
  const manifestFingerprint = ledger.manifestFingerprint();
  const evaluatedAt = Date.now();
  const identity = JSON.stringify({
    manifestFingerprint, baselineMethod, candidateMethod,
    pairedN: finalGate.pairedN, absoluteGain: finalGate.absoluteGain,
    familyGains: finalGate.familyGains, completePairedSeeds, evaluatedAt,
  });
  const proposalId = createHash('sha256').update(identity).digest('hex');
  return {
    schemaVersion: 1,
    proposalId,
    manifestFingerprint,
    baselineMethod,
    candidateMethod,
    evaluatedAt,
    outcomeRowsSeen: snapshot.outcomes.length,
    pairedTaskSeedN: taskSeedPairs.size,
    completePairedSeeds,
    gate: finalGate,
    canActivateAutomatically: false,
    activationRequirements: [
      'Revalidate the manifest fingerprint and ledger snapshot at review time.',
      'Require explicit human approval or a separately authenticated promotion authority.',
      'Run candidate in shadow/canary mode and compare task-family outcomes.',
      'Persist the prior skill version and provide an atomic rollback path.',
    ],
  };
}
