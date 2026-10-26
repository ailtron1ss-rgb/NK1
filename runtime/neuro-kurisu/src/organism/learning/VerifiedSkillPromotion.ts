import { createHash } from 'node:crypto';
import type { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';
import { hasAuthenticatedOutcomeEvidence } from './VerifiedOutcomeArtifact.ts';
import { evaluateSkillRevision, type SkillRevisionGateOptions, type SkillRevisionGateResult } from './SkillRevisionGate.ts';
import { buildVerifiedSessionDataset } from './VerifiedSessionDataset.ts';

export interface VerifiedSkillPromotionOptions extends SkillRevisionGateOptions {
  /** Optional second, independent requirement for the number of complete paired seeds. */
  minCompleteSeeds?: number;
  /**
   * Optional hard floors for task-family gains. Configure this for the skill's
   * intended scope; omitting a family does not silently make a specialized skill
   * fail merely because it is not a general-purpose learner.
   */
  minimumFamilyGainByFamily?: Record<string, number>;
  /** Minimum number of distinct paired holdout tasks required within each configured family. */
  minimumFamilyTasksByFamily?: Record<string, number>;
}
export interface VerifiedSkillPromotionProposal {
  schemaVersion: 1;
  proposalId: string;
  manifestFingerprint: string;
  outcomeFingerprint: string;
  /** Stable identity of the verified train/validation data and privacy-filtered holdout aggregates. */
  datasetFingerprint: string;
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
  /** Exact evaluation criteria bound into proposalId and authenticated proposal contents. */
  evaluationPolicy: {
    minPairedTasks: number;
    minAbsoluteGain: number;
    maxFamilyRegression: number;
    minCompleteSeeds: number;
    minimumFamilyGainByFamily: Record<string, number>;
    minimumFamilyTasksByFamily: Record<string, number>;
  };
  /** Count of distinct attempt-1 paired holdout tasks measured inside each family. */
  familyTaskCoverage: Record<string, number>;
  seedClusteredEvaluation: ReturnType<VerifiedOutcomeLedger['comparePairedBySeed']>;
  familyEvaluation: ReturnType<VerifiedOutcomeLedger['comparePairedByFamilyAndSeed']>;
  canActivateAutomatically: false;
  activationRequirements: string[];
}
const authenticProposals = new WeakMap<object, string>();

function canonicalProposalValue(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite proposal value');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error('unsupported proposal value');
  if (ancestors.has(value)) throw new Error('cyclic proposal value');
  if (Array.isArray(value)) {
    ancestors.add(value);
    const encoded = '[' + value.map(item => canonicalProposalValue(item, ancestors)).join(',') + ']';
    ancestors.delete(value);
    return encoded;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('proposal values must be plain objects');
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).filter(key => descriptors[key]?.enumerable).sort();
  const fields = keys.map(key => {
    const descriptor = descriptors[key]!;
    if (!('value' in descriptor)) throw new Error('proposal accessors are not permitted');
    return JSON.stringify(key) + ':' + canonicalProposalValue(descriptor.value, ancestors);
  });
  ancestors.delete(value);
  return '{' + fields.join(',') + '}';
}

function proposalDigest(value: unknown): string {
  return createHash('sha256').update(canonicalProposalValue(value)).digest('hex');
}

/** True only for the exact proposal object emitted by this module in this process. */
export function isAuthenticVerifiedSkillPromotionProposal(value: unknown): value is VerifiedSkillPromotionProposal {
  if (value === null || typeof value !== 'object') return false;
  const expected = authenticProposals.get(value as object);
  if (!expected) return false;
  try { return proposalDigest(value) === expected; } catch { return false; }
}

const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value!))) : fallback;

/** Normalize family requirements as explicit, auditable policy rather than hidden global assumptions. */
function normalizeMinimumFamilyGainByFamily(value: unknown): Record<string, number> {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('minimum-family-gain-policy-must-be-a-plain-object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('minimum-family-gain-policy-must-be-a-plain-object');
  }
  if (Object.getOwnPropertySymbols(value).some(symbol => Object.prototype.propertyIsEnumerable.call(value, symbol))) {
    throw new TypeError('minimum-family-gain-policy-symbol-keys-are-not-supported');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const normalizedEntries: Array<[string, number]> = [];
  for (const key of Object.keys(descriptors).filter(key => descriptors[key]?.enumerable).sort((a, b) => a.localeCompare(b))) {
    const descriptor = descriptors[key]!;
    if (!('value' in descriptor)) throw new TypeError('minimum-family-gain-policy-accessors-are-not-supported');
    if (!key || key !== key.trim() || key.length > 128 ||
        Array.from(key).some(character => {
          const code = character.codePointAt(0) ?? 0;
          return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
        })) {
      throw new TypeError('minimum-family-gain-policy-family-name-invalid');
    }
    const gain = descriptor.value;
    if (typeof gain !== 'number' || !Number.isFinite(gain) || gain < 0 || gain > 1) {
      throw new RangeError(`minimum-family-gain-policy-threshold-invalid:${key}`);
    }
    normalizedEntries.push([key, gain]);
  }
  return Object.fromEntries(normalizedEntries);
}

/** Normalize family task floors; configured gain families default to two distinct tasks if no floor is supplied. */
function normalizeMinimumFamilyTasksByFamily(value: unknown, gainFamilies: readonly string[]): Record<string, number> {
  if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    throw new TypeError('minimum-family-task-policy-must-be-a-plain-object');
  }
  const record = (value ?? {}) as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('minimum-family-task-policy-must-be-a-plain-object');
  }
  if (Object.getOwnPropertySymbols(record).some(symbol => Object.prototype.propertyIsEnumerable.call(record, symbol))) {
    throw new TypeError('minimum-family-task-policy-symbol-keys-are-not-supported');
  }
  const descriptors = Object.getOwnPropertyDescriptors(record);
  const normalized = new Map<string, number>();
  for (const key of Object.keys(descriptors).filter(key => descriptors[key]?.enumerable).sort((a, b) => a.localeCompare(b))) {
    const descriptor = descriptors[key]!;
    if (!('value' in descriptor)) throw new TypeError('minimum-family-task-policy-accessors-are-not-supported');
    if (!key || key !== key.trim() || key.length > 128 ||
        Array.from(key).some(character => {
          const code = character.codePointAt(0) ?? 0;
          return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
        })) {
      throw new TypeError('minimum-family-task-policy-family-name-invalid');
    }
    if (!gainFamilies.includes(key)) {
      throw new TypeError(`minimum-family-task-policy-without-family-gain-floor:${key}`);
    }
    const count = descriptor.value;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 2 || count > 10000) {
      throw new RangeError(`minimum-family-task-policy-threshold-invalid:${key}`);
    }
    normalized.set(key, count);
  }
  for (const family of gainFamilies) {
    if (!normalized.has(family)) normalized.set(family, 2);
  }
  return Object.fromEntries([...normalized.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

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
  const minimumFamilyGainByFamily = normalizeMinimumFamilyGainByFamily(options.minimumFamilyGainByFamily);
  const minimumFamilyTasksByFamily = normalizeMinimumFamilyTasksByFamily(
    options.minimumFamilyTasksByFamily,
    Object.keys(minimumFamilyGainByFamily),
  );
  const evaluationPolicy = {
    minPairedTasks: boundedInteger(options.minPairedTasks, 8, 2, 10000),
    minAbsoluteGain: Math.max(0, Math.min(1, Number.isFinite(options.minAbsoluteGain) ? options.minAbsoluteGain! : 0.02)),
    maxFamilyRegression: Math.max(0, Math.min(1, Number.isFinite(options.maxFamilyRegression) ? options.maxFamilyRegression! : 0.10)),
    minCompleteSeeds: boundedInteger(options.minCompleteSeeds, 3, 3, 1000),
    minimumFamilyGainByFamily,
    minimumFamilyTasksByFamily,
  };
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
  const gate = evaluateSkillRevision(observations, baselineMethod, candidateMethod, {
    minPairedTasks: evaluationPolicy.minPairedTasks,
    minAbsoluteGain: evaluationPolicy.minAbsoluteGain,
    maxFamilyRegression: evaluationPolicy.maxFamilyRegression,
  });
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

  // Count distinct manifest tasks per family that have an attempt-1 paired
  // baseline/candidate result. Repeated seeds do not inflate task breadth.
  const pairedTaskIdsByFamily = new Map<string, Set<string>>();
  for (const row of observations.filter(item => item.attempt === 1)) {
    const methods = pairedMethodsByTaskSeed.get(JSON.stringify([row.taskId, row.seed, row.attempt]));
    if (!methods?.has(baselineMethod) || !methods.has(candidateMethod)) continue;
    const task = taskById.get(row.taskId);
    if (!task) continue;
    const tasks = pairedTaskIdsByFamily.get(task.family) ?? new Set<string>();
    tasks.add(task.taskId);
    pairedTaskIdsByFamily.set(task.family, tasks);
  }
  const familyTaskCoverage = Object.fromEntries(
    [...pairedTaskIdsByFamily.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([family, tasks]) => [family, tasks.size]),
  );
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
  const { minCompleteSeeds, minAbsoluteGain, maxFamilyRegression, minPairedTasks } = evaluationPolicy;
  const seedClusteredEvaluation = ledger.comparePairedBySeed(baselineMethod, candidateMethod, 'holdout');
  const familyEvaluation = ledger.comparePairedByFamilyAndSeed(baselineMethod, candidateMethod, 'holdout');
  const seedCoverageOkay = completePairedSeeds >= minCompleteSeeds && seedClusteredEvaluation.pairedN >= minCompleteSeeds;
  const seedClusteredGainOkay = seedClusteredEvaluation.absoluteGain >= minAbsoluteGain &&
    seedClusteredEvaluation.approximate95CI !== null && seedClusteredEvaluation.approximate95CI[0] > 0 &&
    seedClusteredEvaluation.bootstrap95CI !== null && seedClusteredEvaluation.bootstrap95CI !== undefined &&
    seedClusteredEvaluation.bootstrap95CI[0] > 0;
  const familyRegression = familyEvaluation.find(row => row.pairedN >= minCompleteSeeds && row.absoluteGain < -maxFamilyRegression);
  const requiredFamilyFailure = Object.entries(evaluationPolicy.minimumFamilyGainByFamily).map(([family, minimumGain]) => {
    const evidence = familyEvaluation.find(row => row.family === family);
    if (!evidence || evidence.pairedN < minCompleteSeeds) {
      return { family, reason: `required-family-evidence-insufficient:${family}` };
    }
    if (evidence.absoluteGain < minimumGain) {
      return { family, reason: `required-family-gain-below-threshold:${family}` };
    }
    return null;
  }).find((failure): failure is { family: string; reason: string } => failure !== null);
  const requiredFamilyTaskFailure = Object.entries(evaluationPolicy.minimumFamilyTasksByFamily).map(([family, minimumTasks]) =>
    (familyTaskCoverage[family] ?? 0) < minimumTasks
      ? { family, reason: `required-family-task-coverage-insufficient:${family}` }
      : null,
  ).find((failure): failure is { family: string; reason: string } => failure !== null);
  const finalGate: SkillRevisionGateResult = unauthenticatedEvidenceRows > 0 ? {
    ...gate, accepted: false, reason: 'unauthenticated-outcome-evidence',
  } : uniquePairedTasks < minPairedTasks ? {
    ...gate, accepted: false, reason: 'insufficient-independent-heldout-task-coverage',
  } : !seedCoverageOkay ? {
    ...gate, accepted: false, reason: 'insufficient-complete-holdout-seed-coverage',
  } : requiredFamilyFailure ? {
    ...gate, accepted: false, reason: requiredFamilyFailure.reason,
  } : requiredFamilyTaskFailure ? {
    ...gate, accepted: false, reason: requiredFamilyTaskFailure.reason,
  } : familyRegression ? {
    ...gate, accepted: false, reason: 'seed-clustered-family-regression',
  } : !seedClusteredGainOkay ? {
    ...gate, accepted: false, reason: 'seed-clustered-gain-not-statistically-supported',
  } : gate;
  const manifestFingerprint = ledger.manifestFingerprint();
  const datasetFingerprint = buildVerifiedSessionDataset(ledger, snapshot).datasetFingerprint;
  const canonicalOutcomes = [...snapshot.outcomes].sort((a, b) =>
    JSON.stringify([a.taskId, a.method, a.seed, a.attempt]).localeCompare(JSON.stringify([b.taskId, b.method, b.seed, b.attempt])),
  );
  const outcomeFingerprint = createHash('sha256').update(JSON.stringify(canonicalOutcomes)).digest('hex');
  const identity = JSON.stringify({
    manifestFingerprint, outcomeFingerprint, datasetFingerprint, baselineMethod, candidateMethod,
    evaluationPolicy,
    accepted: finalGate.accepted, reason: finalGate.reason,
    pairedN: finalGate.pairedN, absoluteGain: finalGate.absoluteGain,
    familyGains: finalGate.familyGains, completePairedSeeds, uniquePairedTasks, familyTaskCoverage,
    authenticatedEvidenceRows: authenticatedOutcomes.length, unauthenticatedEvidenceRows,
    seedClusteredEvaluation, familyEvaluation,
  });
  const proposalId = createHash('sha256').update(identity).digest('hex');
  const proposal: VerifiedSkillPromotionProposal = {
    schemaVersion: 1, proposalId, manifestFingerprint, outcomeFingerprint, datasetFingerprint, baselineMethod, candidateMethod,
    evaluatedAt: Date.now(), outcomeRowsSeen: snapshot.outcomes.length,
    authenticatedEvidenceRows: authenticatedOutcomes.length, unauthenticatedEvidenceRows,
    pairedTaskSeedN: finalGate.pairedN, uniquePairedTasks, completePairedSeeds,
    gate: finalGate, evaluationPolicy, seedClusteredEvaluation, familyEvaluation, familyTaskCoverage,
    canActivateAutomatically: false,
    activationRequirements: [
      'Revalidate the manifest fingerprint and ledger snapshot at review time.',
      'Require explicit human approval or a separately authenticated promotion authority.',
      'Run candidate in shadow/canary mode and compare task-family outcomes.',
      'Persist the prior skill version and provide an atomic rollback path.',
      'Re-ingest and re-verify signed outcome artifacts after process restart; restored ledger rows alone are not trusted.',
    ],
  };
  authenticProposals.set(proposal, proposalDigest(proposal));
  return proposal;
}
