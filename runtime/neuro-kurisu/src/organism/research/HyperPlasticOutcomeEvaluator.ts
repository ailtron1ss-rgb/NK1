import { createHash } from 'node:crypto';
import { hasAuthenticatedOutcomeEvidence } from '../learning/VerifiedOutcomeArtifact.ts';
import { VerifiedOutcomeLedger, type TaskManifestEntry, type VerifiedTaskOutcome } from '../learning/VerifiedOutcomeLedger.ts';
import type { HyperPlasticLoRAAdapter } from './HyperPlasticNetwork.ts';

export interface HyperPlasticSignedEvaluationConfig {
  ledger: VerifiedOutcomeLedger;
  manifest: readonly TaskManifestEntry[];
  adapter: HyperPlasticLoRAAdapter;
  baseModelFingerprint: string;
  taskFamily: string;
  minimumPairedSeeds?: number;
  maxLatencyOverhead01?: number;
}

export interface HyperPlasticSignedSplitMeasurement {
  split: 'validation' | 'holdout';
  splitFingerprint: string;
  evidenceFingerprint: string;
  baseModelFingerprint: string;
  adapterFingerprint: string;
  baselineMethod: string;
  adapterMethod: string;
  pairedSeedCount: number;
  baselineScore01: number;
  adapterScore01: number;
  meanGain01: number;
  lowerConfidenceBound95OneSided01: number;
  meanLatencyOverhead01: number;
  maxLatencyOverhead01: number;
  safetyRegressions: number;
  evidenceRefs: string[];
  seedMeasurements: Array<{
    seed: number;
    baselineScore01: number;
    adapterScore01: number;
    gain01: number;
    baselineLatencyMs: number;
    adapterLatencyMs: number;
    latencyOverhead01: number;
  }>;
}

export interface HyperPlasticSignedPromotionResult {
  eligible: boolean;
  reasons: string[];
  permit: object | null;
  validation?: HyperPlasticSignedSplitMeasurement;
  holdout?: HyperPlasticSignedSplitMeasurement;
}

interface PreparedAuthority {
  ledger: VerifiedOutcomeLedger;
  manifest: TaskManifestEntry[];
  manifestById: Map<string, TaskManifestEntry>;
  manifestFingerprint: string;
  adapter: HyperPlasticLoRAAdapter;
  baseModelFingerprint: string;
  taskFamily: string;
  baselineMethod: string;
  adapterMethod: string;
  minimumPairedSeeds: number;
  maxLatencyOverhead01: number;
}

const permits = new WeakMap<object, {
  adapterFingerprint: string;
  baseModelFingerprint: string;
  validationEvidenceFingerprint: string;
  holdoutEvidenceFingerprint: string;
}>();

const isBoundedIdentity = (value: unknown, max = 180): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max &&
  value === value.normalize('NFKC').trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value);

const isSha256ModelFingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value);

const sha256 = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function hyperPlasticMethodIdentity(
  kind: 'baseline' | 'adapter',
  baseModelFingerprint: string,
  adapterFingerprint?: string,
): string {
  if (!isSha256ModelFingerprint(baseModelFingerprint)) throw new RangeError('ome26-model-fingerprint-invalid');
  if (kind === 'baseline') {
    if (adapterFingerprint !== undefined) throw new RangeError('ome26-baseline-must-not-bind-adapter');
    return `ome26-baseline-${sha256({ schema: 1, baseModelFingerprint })}`;
  }
  if (!isBoundedIdentity(adapterFingerprint, 256)) throw new RangeError('ome26-adapter-fingerprint-invalid');
  return `ome26-adapter-${sha256({ schema: 1, baseModelFingerprint, adapterFingerprint })}`;
}

function prepareAuthority(config: HyperPlasticSignedEvaluationConfig): PreparedAuthority {
  if (!config || !(config.ledger instanceof VerifiedOutcomeLedger) || !Array.isArray(config.manifest) ||
      !config.adapter || config.adapter.schema !== 'nk1-lora-v1' ||
      !isSha256ModelFingerprint(config.baseModelFingerprint) ||
      config.adapter.baseModelFingerprint !== config.baseModelFingerprint ||
      !isBoundedIdentity(config.adapter.fingerprint, 256) ||
      !isBoundedIdentity(config.taskFamily, 96)) {
    throw new RangeError('ome26-signed-evaluation-config-invalid');
  }
  const minimumPairedSeeds = config.minimumPairedSeeds ?? 5;
  const maxLatencyOverhead01 = config.maxLatencyOverhead01 ?? 0.20;
  if (!Number.isSafeInteger(minimumPairedSeeds) || minimumPairedSeeds < 5 || minimumPairedSeeds > 128 ||
      !Number.isFinite(maxLatencyOverhead01) || maxLatencyOverhead01 <= 0 || maxLatencyOverhead01 > 1) {
    throw new RangeError('ome26-signed-evaluation-limits-invalid');
  }
  let manifest: TaskManifestEntry[];
  try { manifest = structuredClone(config.manifest) as TaskManifestEntry[]; }
  catch { throw new RangeError('ome26-signed-evaluation-manifest-not-cloneable'); }
  const manifestValidator = new VerifiedOutcomeLedger(manifest);
  const manifestFingerprint = manifestValidator.manifestFingerprint();
  if (manifestFingerprint !== config.ledger.manifestFingerprint()) {
    throw new RangeError('ome26-signed-evaluation-manifest-mismatch');
  }
  const canonicalManifest = manifestValidator.snapshot().manifest as TaskManifestEntry[];
  return {
    ledger: config.ledger,
    manifest: canonicalManifest,
    manifestById: new Map(canonicalManifest.map(task => [task.taskId, task] as const)),
    manifestFingerprint,
    adapter: config.adapter,
    baseModelFingerprint: config.baseModelFingerprint,
    taskFamily: config.taskFamily,
    baselineMethod: hyperPlasticMethodIdentity('baseline', config.baseModelFingerprint),
    adapterMethod: hyperPlasticMethodIdentity('adapter', config.baseModelFingerprint, config.adapter.fingerprint),
    minimumPairedSeeds,
    maxLatencyOverhead01,
  };
}

const T95_ONE_SIDED_BY_DF = [
  0, 0, 0, 0, 2.132, 2.015, 1.943, 1.895, 1.860, 1.833,
  1.812, 1.796, 1.782, 1.771, 1.761, 1.753, 1.746, 1.740, 1.734, 1.729,
  1.725, 1.721, 1.717, 1.714, 1.711, 1.708, 1.706, 1.703, 1.701, 1.699,
  1.697,
];

function lowerConfidenceBound95OneSided(values: number[]): number {
  if (values.length < 5) return Number.NEGATIVE_INFINITY;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);
  const standardError = Math.sqrt(variance / values.length);
  const df = values.length - 1;
  const critical = df < T95_ONE_SIDED_BY_DF.length ? T95_ONE_SIDED_BY_DF[df]! : 1.645;
  return mean - critical * standardError;
}

function measureSplit(
  authority: PreparedAuthority,
  split: 'validation' | 'holdout',
): HyperPlasticSignedSplitMeasurement | null {
  const tasks = authority.manifest
    .filter(task => task.split === split && task.family === authority.taskFamily)
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
  if (tasks.length === 0) return null;
  const splitFingerprint = sha256({
    manifestFingerprint: authority.manifestFingerprint,
    split,
    tasks: tasks.map(task => ({
      taskId: task.taskId,
      family: task.family,
      promptFingerprint: task.promptFingerprint,
      verifierId: task.verifierId,
      version: task.version,
    })),
  });
  const taskIds = tasks.map(task => task.taskId);
  const snapshot = authority.ledger.snapshot();
  if (authority.ledger.manifestFingerprint() !== authority.manifestFingerprint) return null;

  const bySeed = new Map<number, Map<string, Map<string, VerifiedTaskOutcome>>>();
  let unsafeAdapterSafetyRegressionCount = 0;
  const unsafeAdapterEvidenceRefs: string[] = [];
  for (const outcome of snapshot.outcomes) {
    if (outcome.attempt !== 1 || outcome.authority !== 'independent-verifier' ||
        (outcome.method !== authority.baselineMethod && outcome.method !== authority.adapterMethod) ||
        !hasAuthenticatedOutcomeEvidence(authority.ledger, outcome.evidenceRef)) continue;
    const task = authority.manifestById.get(outcome.taskId);
    if (!task || task.split !== split || task.family !== authority.taskFamily ||
        task.version !== outcome.taskVersion || task.verifierId !== outcome.verifierId) continue;
    if (outcome.method === authority.adapterMethod &&
        (outcome.metrics?.safetyRegressionCount ?? 0) > 0) {
      unsafeAdapterSafetyRegressionCount += outcome.metrics!.safetyRegressionCount;
      unsafeAdapterEvidenceRefs.push(outcome.evidenceRef);
    }
    const seedRows = bySeed.get(outcome.seed) ?? new Map<string, Map<string, VerifiedTaskOutcome>>();
    const methodRows = seedRows.get(task.taskId) ?? new Map<string, VerifiedTaskOutcome>();
    if (methodRows.has(outcome.method)) return null;
    methodRows.set(outcome.method, outcome);
    seedRows.set(task.taskId, methodRows);
    bySeed.set(outcome.seed, seedRows);
  }

  if (unsafeAdapterSafetyRegressionCount > 0) {
    const evidenceRefs = [...new Set(unsafeAdapterEvidenceRefs)].sort();
    return {
      split,
      splitFingerprint,
      evidenceFingerprint: sha256({ splitFingerprint, unsafeAdapterSafetyRegressionCount, evidenceRefs }),
      baseModelFingerprint: authority.baseModelFingerprint,
      adapterFingerprint: authority.adapter.fingerprint,
      baselineMethod: authority.baselineMethod,
      adapterMethod: authority.adapterMethod,
      pairedSeedCount: 0,
      baselineScore01: 0,
      adapterScore01: 0,
      meanGain01: 0,
      lowerConfidenceBound95OneSided01: Number.NEGATIVE_INFINITY,
      meanLatencyOverhead01: Number.POSITIVE_INFINITY,
      maxLatencyOverhead01: Number.POSITIVE_INFINITY,
      safetyRegressions: unsafeAdapterSafetyRegressionCount,
      evidenceRefs,
      seedMeasurements: [],
    };
  }
  const seeds: HyperPlasticSignedSplitMeasurement['seedMeasurements'] = [];
  const evidenceRefs: string[] = [];
  for (const [seed, taskRows] of [...bySeed.entries()].sort((a, b) => a[0] - b[0])) {
    const complete = taskIds.every(taskId => {
      const rows = taskRows.get(taskId);
      return rows?.has(authority.baselineMethod) && rows.has(authority.adapterMethod);
    });
    if (!complete) continue;
    const baselineRows = taskIds.map(taskId => taskRows.get(taskId)!.get(authority.baselineMethod)!);
    const adapterRows = taskIds.map(taskId => taskRows.get(taskId)!.get(authority.adapterMethod)!);
    const rows = [...baselineRows, ...adapterRows];
    if (rows.some(row => !row.metrics || row.metrics.durationMs <= 0 ||
        !Number.isFinite(row.metrics.durationMs) || !Number.isSafeInteger(row.metrics.safetyRegressionCount))) {
      continue;
    }
    const safetyRegressions = adapterRows.reduce((sum, row) => sum + (row.metrics?.safetyRegressionCount ?? 0), 0);
    const baselineLatencyMs = baselineRows.reduce((sum, row) => sum + row.metrics!.durationMs, 0) / tasks.length;
    const adapterLatencyMs = adapterRows.reduce((sum, row) => sum + row.metrics!.durationMs, 0) / tasks.length;
    const baselineScore01 = baselineRows.filter(row => row.passed).length / tasks.length;
    const adapterScore01 = adapterRows.filter(row => row.passed).length / tasks.length;
    seeds.push({
      seed,
      baselineScore01,
      adapterScore01,
      gain01: adapterScore01 - baselineScore01,
      baselineLatencyMs,
      adapterLatencyMs,
      latencyOverhead01: (adapterLatencyMs - baselineLatencyMs) / baselineLatencyMs,
    });
    evidenceRefs.push(...rows.map(row => row.evidenceRef));
    if (safetyRegressions > 0) {
      return {
        split, splitFingerprint, evidenceFingerprint: sha256({ splitFingerprint, unsafeSeed: seed, evidenceRefs }),
        baseModelFingerprint: authority.baseModelFingerprint,
        adapterFingerprint: authority.adapter.fingerprint,
        baselineMethod: authority.baselineMethod,
        adapterMethod: authority.adapterMethod,
        pairedSeedCount: seeds.length,
        baselineScore01, adapterScore01, meanGain01: adapterScore01 - baselineScore01,
        lowerConfidenceBound95OneSided01: Number.NEGATIVE_INFINITY,
        meanLatencyOverhead01: Number.POSITIVE_INFINITY,
        maxLatencyOverhead01: Number.POSITIVE_INFINITY,
        safetyRegressions,
        evidenceRefs: [...new Set(evidenceRefs)].sort(),
        seedMeasurements: seeds,
      };
    }
  }
  if (seeds.length < authority.minimumPairedSeeds) return null;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const gains = seeds.map(seed => seed.gain01);
  const latency = seeds.map(seed => seed.latencyOverhead01);
  return {
    split,
    splitFingerprint,
    evidenceFingerprint: sha256({
      splitFingerprint,
      baseModelFingerprint: authority.baseModelFingerprint,
      adapterFingerprint: authority.adapter.fingerprint,
      baselineMethod: authority.baselineMethod,
      adapterMethod: authority.adapterMethod,
      seeds,
      evidenceRefs: [...new Set(evidenceRefs)].sort(),
    }),
    baseModelFingerprint: authority.baseModelFingerprint,
    adapterFingerprint: authority.adapter.fingerprint,
    baselineMethod: authority.baselineMethod,
    adapterMethod: authority.adapterMethod,
    pairedSeedCount: seeds.length,
    baselineScore01: mean(seeds.map(seed => seed.baselineScore01)),
    adapterScore01: mean(seeds.map(seed => seed.adapterScore01)),
    meanGain01: mean(gains),
    lowerConfidenceBound95OneSided01: split === 'holdout'
      ? lowerConfidenceBound95OneSided(gains)
      : Number.NaN,
    meanLatencyOverhead01: mean(latency),
    maxLatencyOverhead01: Math.max(...latency),
    safetyRegressions: 0,
    evidenceRefs: [...new Set(evidenceRefs)].sort(),
    seedMeasurements: seeds,
  };
}

export function measureHyperPlasticSignedSplit(
  split: 'validation' | 'holdout',
  config: HyperPlasticSignedEvaluationConfig,
): HyperPlasticSignedSplitMeasurement | null {
  return measureSplit(prepareAuthority(config), split);
}

export function evaluateHyperPlasticSignedPromotion(
  config: HyperPlasticSignedEvaluationConfig,
): HyperPlasticSignedPromotionResult {
  const reject = (reason: string): HyperPlasticSignedPromotionResult =>
    ({ eligible: false, reasons: [reason], permit: null });
  let authority: PreparedAuthority;
  try { authority = prepareAuthority(config); }
  catch { return reject('signed-evaluation-config-invalid'); }
  const validation = measureSplit(authority, 'validation');
  if (validation?.safetyRegressions) return reject('validation-safety-regression');
  if (!validation || validation.pairedSeedCount < authority.minimumPairedSeeds) {
    return reject('validation-signed-paired-evidence-insufficient');
  }
  const holdout = measureSplit(authority, 'holdout');
  if (holdout?.safetyRegressions) return reject('holdout-safety-regression');
  if (!holdout || holdout.pairedSeedCount < authority.minimumPairedSeeds) {
    return reject('holdout-signed-paired-evidence-insufficient');
  }
  if (validation.splitFingerprint === holdout.splitFingerprint) return reject('validation-holdout-split-overlap');
  if (validation.adapterFingerprint !== holdout.adapterFingerprint ||
      validation.baseModelFingerprint !== holdout.baseModelFingerprint) {
    return reject('validation-holdout-model-identity-mismatch');
  }
  const validationSeeds = new Set(validation.seedMeasurements.map(row => row.seed));
  if (validationSeeds.size !== holdout.seedMeasurements.length ||
      holdout.seedMeasurements.some(row => !validationSeeds.has(row.seed))) {
    return reject('validation-holdout-seed-pairing-mismatch');
  }
  if (validation.meanGain01 <= 0) return reject('validation-gain-not-positive');
  if (holdout.lowerConfidenceBound95OneSided01 <= 0) {
    return reject('holdout-gain-not-statistically-positive');
  }
  if (holdout.seedMeasurements.some(row => row.gain01 < -0.01)) {
    return reject('holdout-regression-exceeds-tolerance');
  }
  if (holdout.meanLatencyOverhead01 > authority.maxLatencyOverhead01 ||
      holdout.maxLatencyOverhead01 > authority.maxLatencyOverhead01) {
    return reject('holdout-latency-overhead-exceeds-limit');
  }
  const permit = Object.freeze({
    schema: 'nk1.hyper-plastic-signed-promotion.v1',
    adapterFingerprint: authority.adapter.fingerprint,
    baseModelFingerprint: authority.baseModelFingerprint,
    validationEvidenceFingerprint: validation.evidenceFingerprint,
    holdoutEvidenceFingerprint: holdout.evidenceFingerprint,
    pairedSeedCount: holdout.pairedSeedCount,
  });
  permits.set(permit, {
    adapterFingerprint: authority.adapter.fingerprint,
    baseModelFingerprint: authority.baseModelFingerprint,
    validationEvidenceFingerprint: validation.evidenceFingerprint,
    holdoutEvidenceFingerprint: holdout.evidenceFingerprint,
  });
  return { eligible: true, reasons: [], permit, validation, holdout };
}

export function isTrustedHyperPlasticPromotionPermit(
  value: unknown,
  expected: { adapterFingerprint: string; baseModelFingerprint: string },
): boolean {
  if (!value || typeof value !== 'object') return false;
  const trusted = permits.get(value as object);
  return Boolean(trusted && expected &&
    trusted.adapterFingerprint === expected.adapterFingerprint &&
    trusted.baseModelFingerprint === expected.baseModelFingerprint);
}
