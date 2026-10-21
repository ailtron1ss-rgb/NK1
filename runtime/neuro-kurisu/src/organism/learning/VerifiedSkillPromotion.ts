import { createHash } from 'node:crypto';
import type { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';
import { hasAuthenticatedOutcomeEvidence } from './VerifiedOutcomeArtifact.ts';
import { evaluateSkillRevision, type SkillRevisionGateOptions, type SkillRevisionGateResult } from './SkillRevisionGate.ts';

export interface VerifiedSkillPromotionOptions extends SkillRevisionGateOptions {
  /** Optional second, independent requirement for the number of complete paired seeds. */
  minCompleteSeeds?: number;
}
export interface VerifiedSkillPromotionProposal {
  schemaVersion: 1;
  proposalId: string;
  manifestFingerprint: string;
  outcomeFingerprint: string;
  baselineMethod: string;
  candidateMethod: string;
  evaluatedAt: number;
  outcomeRowsSeen: number;
  authenticatedEvidenceRows: number;
  unauthenticatedEvidenceRows: number;
  pairedTaskSeedN: number;
  uniquePairedTasks: number;
  completePairedSeeds: number;
  gate: SkillRevisionGateResult;
  seedClusteredEvaluation: ReturnType<VerifiedOutcomeLedger['comparePairedBySeed']>;
  familyEvaluation: ReturnType<VerifiedOutcomeLedger['comparePairedByFamilyAndSeed']>;
  canActivateAutomatically: false;
  activationRequirements: string[];
}
const authenticProposals = new WeakSet<object>();

/** True only for the exact proposal object emitted by this module in this process. */
export function isAuthenticVerifiedSkillPromotionProposal(value: unknown): value is VerifiedSkillPromotionProposal {
  return value !== null && typeof value === 'object' && authenticProposals.has(value as object);
}

const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value!))) : fallback;

/** Create a proposal from authenticated, manifest-bound evidence; never mutate the live skill library. */
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
  const relevantOutcomes = snapshot.outcomes.filter(outcome => {
    const task = taskById.get(outcome.taskId);
    return task && task.version === outcome.taskVersion && task.split === 'holdout' &&
      (outcome.method === baselineMethod || outcome.method === candidateMethod);
  });
  const authenticatedOutcomes = relevantOutcomes.filter(outcome =>
    hasAuthenticatedOutcomeEvidence(ledger, outcome.evidenceRef));
  const unauthenticatedEvidenceRows = relevantOutcomes.length - authenticatedOutcomes.length;
  const observations = authenticatedOutcomes.flatMap(outcome => {
    const task = taskById.get(outcome.taskId);
    if (!task) return [];
    return [{
      taskId: outcome.taskId, family: task.family, split: task.split, method: outcome.method,
      seed: outcome.seed, attempt: outcome.attempt, passed: outcome.passed, authority: outcome.authority,
      verifierId: outcome.verifierId, expectedVerifierId: task.verifierId, evidenceRef: outcome.evidenceRef,
    }];
  });
  const gate = evaluateSkillRevision(observations, baselineMethod, candidateMethod, options);
  const holdoutTasks = snapshot.manifest.filter(task => task.split === 'holdout').map(task => task.taskId);
  const pairedMethodsByTaskSeed = new Map<string, Set<string>>();
  for (const row of observations.filter(item => item.attempt === 1)) {
    const key = JSON.stringify([row.taskId, row.seed, row.attempt]);
    const methods = pairedMethodsByTaskSeed.get(key) ?? new Set<string>();
    methods.add(row.method);
    pairedMethodsByTaskSeed.set(key, methods);
  }
  const uniquePairedTasks = new Set(observations.filter(row => row.attempt === 1 &&
    pairedMethodsByTaskSeed.get(JSON.stringify([row.taskId, row.seed, row.attempt]))?.has(baselineMethod) &&
    pairedMethodsByTaskSeed.get(JSON.stringify([row.taskId, row.seed, row.attempt]))?.has(candidateMethod)
  ).map(row => row.taskId)).size;
  const bySeed = new Map<number, Set<string>>();
  for (const row of observations.filter(item => item.attempt === 1)) {
    const set = bySeed.get(row.seed) ?? new Set<string>();
    set.add(row.taskId + '\u0000' + row.method);
    bySeed.set(row.seed, set);
  }
  const completePairedSeeds = [...bySeed.entries()].filter(([, seen]) =>
    holdoutTasks.length > 0 && holdoutTasks.every(taskId =>
      seen.has(taskId + '\u0000' + baselineMethod) && seen.has(taskId + '\u0000' + candidateMethod),
    ),
  ).length;
  const minCompleteSeeds = boundedInteger(options.minCompleteSeeds, 3, 3, 1000);
  const seedClusteredEvaluation = ledger.comparePairedBySeed(baselineMethod, candidateMethod, 'holdout');
  const familyEvaluation = ledger.comparePairedByFamilyAndSeed(baselineMethod, candidateMethod, 'holdout');
  const seedCoverageOkay = completePairedSeeds >= minCompleteSeeds && seedClusteredEvaluation.pairedN >= minCompleteSeeds;
  const minAbsoluteGain = Math.max(0, Math.min(1, Number.isFinite(options.minAbsoluteGain) ? options.minAbsoluteGain! : 0.02));
  const seedClusteredGainOkay = seedClusteredEvaluation.absoluteGain >= minAbsoluteGain &&
    seedClusteredEvaluation.approximate95CI !== null && seedClusteredEvaluation.approximate95CI[0] > 0 &&
    seedClusteredEvaluation.bootstrap95CI !== null && seedClusteredEvaluation.bootstrap95CI !== undefined &&
    seedClusteredEvaluation.bootstrap95CI[0] > 0;
  const maxFamilyRegression = Math.max(0, Math.min(1, Number.isFinite(options.maxFamilyRegression) ? options.maxFamilyRegression! : 0.10));
  const familyRegression = familyEvaluation.find(row => row.pairedN >= minCompleteSeeds && row.absoluteGain < -maxFamilyRegression);
  const minPairedTasks = boundedInteger(options.minPairedTasks, 8, 2, 10000);
  const finalGate: SkillRevisionGateResult = unauthenticatedEvidenceRows > 0 ? {
    ...gate, accepted: false, reason: 'unauthenticated-outcome-evidence',
  } : uniquePairedTasks < minPairedTasks ? {
    ...gate, accepted: false, reason: 'insufficient-independent-heldout-task-coverage',
  } : !seedCoverageOkay ? {
    ...gate, accepted: false, reason: 'insufficient-complete-holdout-seed-coverage',
  } : familyRegression ? {
    ...gate, accepted: false, reason: 'seed-clustered-family-regression',
  } : !seedClusteredGainOkay ? {
    ...gate, accepted: false, reason: 'seed-clustered-gain-not-statistically-supported',
  } : gate;
  const manifestFingerprint = ledger.manifestFingerprint();
  const canonicalOutcomes = [...snapshot.outcomes].sort((a, b) =>
    JSON.stringify([a.taskId, a.method, a.seed, a.attempt]).localeCompare(JSON.stringify([b.taskId, b.method, b.seed, b.attempt])),
  );
  const outcomeFingerprint = createHash('sha256').update(JSON.stringify(canonicalOutcomes)).digest('hex');
  const identity = JSON.stringify({
    manifestFingerprint, outcomeFingerprint, baselineMethod, candidateMethod,
    pairedN: finalGate.pairedN, absoluteGain: finalGate.absoluteGain,
    familyGains: finalGate.familyGains, completePairedSeeds, uniquePairedTasks,
    authenticatedEvidenceRows: authenticatedOutcomes.length, unauthenticatedEvidenceRows,
    seedClusteredEvaluation, familyEvaluation,
  });
  const proposalId = createHash('sha256').update(identity).digest('hex');
  const proposal: VerifiedSkillPromotionProposal = {
    schemaVersion: 1, proposalId, manifestFingerprint, outcomeFingerprint, baselineMethod, candidateMethod,
    evaluatedAt: Date.now(), outcomeRowsSeen: snapshot.outcomes.length,
    authenticatedEvidenceRows: authenticatedOutcomes.length, unauthenticatedEvidenceRows,
    pairedTaskSeedN: finalGate.pairedN, uniquePairedTasks, completePairedSeeds,
    gate: finalGate, seedClusteredEvaluation, familyEvaluation,
    canActivateAutomatically: false,
    activationRequirements: [
      'Revalidate the manifest fingerprint and ledger snapshot at review time.',
      'Require explicit human approval or a separately authenticated promotion authority.',
      'Run candidate in shadow/canary mode and compare task-family outcomes.',
      'Persist the prior skill version and provide an atomic rollback path.',
      'Re-ingest and re-verify signed outcome artifacts after process restart; restored ledger rows alone are not trusted.',
    ],
  };
  authenticProposals.add(proposal);
  return proposal;
}
