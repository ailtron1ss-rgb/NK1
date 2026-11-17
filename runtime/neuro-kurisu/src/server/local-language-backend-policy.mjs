/**
 * Resolve language backend priority and temporarily cool down a local endpoint
 * after repeated failures. Configuration selects preference, not health.
 */
export class LocalLanguageBackendPolicy {
  constructor({ baseCooldownMs = 15_000, maxCooldownMs = 300_000 } = {}) {
    this.baseCooldownMs = Math.max(250, Math.min(300_000, Math.floor(Number(baseCooldownMs) || 15_000)));
    this.maxCooldownMs = Math.max(this.baseCooldownMs, Math.min(900_000, Math.floor(Number(maxCooldownMs) || 300_000)));
    this.consecutiveFailures = 0;
    this.cooldownUntil = 0;
  }

  select({ localLlamaConfigured, ecologyPreferredBackend, now = Date.now() }) {
    if (localLlamaConfigured === true && now >= this.cooldownUntil) return 'llama.cpp';
    return String(ecologyPreferredBackend || 'local-fallback');
  }

  observe({ backend = '', failures = [], now = Date.now() }) {
    if (String(backend).startsWith('llama.cpp:')) {
      this.consecutiveFailures = 0;
      this.cooldownUntil = 0;
      return this.snapshot({ now });
    }
    const localFailure = Array.isArray(failures) && failures.some(value => String(value).startsWith('llama.cpp:'));
    if (localFailure) {
      this.consecutiveFailures += 1;
      const exponent = Math.min(10, this.consecutiveFailures - 1);
      this.cooldownUntil = now + Math.min(this.maxCooldownMs, this.baseCooldownMs * (2 ** exponent));
    }
    return this.snapshot({ now });
  }

  snapshot({ now = Date.now() } = {}) {
    return {
      consecutiveFailures: this.consecutiveFailures,
      cooldownUntil: this.cooldownUntil,
      coolingDown: this.cooldownUntil > now,
    };
  }
}


const hyperPlasticPromotionPermits = new WeakSet();
const HYPER_PLASTIC_MIN_SEEDS = 5;
const HYPER_PLASTIC_HOLDOUT_T_CRITICAL_95_ONE_SIDED = 2.132;

function normalizeHyperPlasticReports(reports, expected, splitName) {
  if (!Array.isArray(reports) || reports.length < HYPER_PLASTIC_MIN_SEEDS) {
    return { valid: false, reason: `${splitName}-requires-at-least-five-paired-seeds` };
  }
  const seeds = new Set();
  const datasets = new Set();
  const gains = [];
  const latencyOverheads = [];
  for (const report of reports) {
    if (!report || !Number.isSafeInteger(report.seed) || seeds.has(report.seed)) {
      return { valid: false, reason: `${splitName}-seed-missing-or-duplicated` };
    }
    seeds.add(report.seed);
    if (report.baseModelFingerprint !== expected.baseModelFingerprint
      || report.adapterFingerprint !== expected.adapterFingerprint
      || typeof report.datasetFingerprint !== 'string' || !report.datasetFingerprint.trim()) {
      return { valid: false, reason: `${splitName}-provenance-mismatch` };
    }
    datasets.add(report.datasetFingerprint);
    const numeric = [
      report.baselineScore, report.adaptedScore,
      report.baselineLatencyMs, report.adaptedLatencyMs,
    ];
    if (numeric.some((value) => typeof value !== 'number' || !Number.isFinite(value))
      || report.baselineScore < 0 || report.baselineScore > 1
      || report.adaptedScore < 0 || report.adaptedScore > 1
      || report.baselineLatencyMs <= 0 || report.adaptedLatencyMs <= 0
      || !Number.isSafeInteger(report.safetyRegressionCount) || report.safetyRegressionCount < 0) {
      return { valid: false, reason: `${splitName}-metric-invalid` };
    }
    if (report.safetyRegressionCount !== 0) {
      return { valid: false, reason: `${splitName}-safety-regression` };
    }
    gains.push(report.adaptedScore - report.baselineScore);
    latencyOverheads.push((report.adaptedLatencyMs - report.baselineLatencyMs) / report.baselineLatencyMs);
  }
  if (datasets.size !== 1) return { valid: false, reason: `${splitName}-dataset-fingerprint-not-constant` };
  return {
    valid: true,
    seeds,
    datasetFingerprint: [...datasets][0],
    gains,
    latencyOverheads,
  };
}

/**
 * Research-only evidence gate. Reports must be produced by a paired evaluator;
 * the returned permit is an in-process object capability, not a signed artifact.
 */
export function evaluateHyperPlasticPromotion({ adapter, calibrationReports, holdoutReports } = {}) {
  const reject = (reason) => ({ eligible: false, reasons: [reason], permit: null });
  if (!adapter || adapter.schema !== 'nk1-lora-v1'
    || typeof adapter.fingerprint !== 'string' || !adapter.fingerprint
    || typeof adapter.baseModelFingerprint !== 'string' || !adapter.baseModelFingerprint) {
    return reject('adapter-identity-invalid');
  }
  const expected = {
    adapterFingerprint: adapter.fingerprint,
    baseModelFingerprint: adapter.baseModelFingerprint,
  };
  const calibration = normalizeHyperPlasticReports(calibrationReports, expected, 'calibration');
  if (!calibration.valid) return reject(calibration.reason);
  const holdout = normalizeHyperPlasticReports(holdoutReports, expected, 'holdout');
  if (!holdout.valid) return reject(holdout.reason);
  if (calibration.datasetFingerprint === holdout.datasetFingerprint) {
    return reject('calibration-holdout-dataset-overlap');
  }
  if (calibration.seeds.size !== holdout.seeds.size
    || [...calibration.seeds].some((seed) => !holdout.seeds.has(seed))) {
    return reject('calibration-holdout-seed-pairing-mismatch');
  }
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const calibrationGain = mean(calibration.gains);
  const holdoutGain = mean(holdout.gains);
  const sampleVariance = holdout.gains.reduce((sum, value) =>
    sum + ((value - holdoutGain) ** 2), 0) / Math.max(1, holdout.gains.length - 1);
  const standardError = Math.sqrt(sampleVariance / holdout.gains.length);
  const lowerConfidenceBound95 = holdoutGain
    - HYPER_PLASTIC_HOLDOUT_T_CRITICAL_95_ONE_SIDED * standardError;
  const meanLatencyOverhead01 = mean(holdout.latencyOverheads);
  if (calibrationGain <= 0) return reject('calibration-gain-not-positive');
  if (lowerConfidenceBound95 <= 0) return reject('holdout-gain-not-statistically-positive');
  if (Math.min(...holdout.gains) < -0.01) return reject('holdout-regression-exceeds-tolerance');
  if (meanLatencyOverhead01 > 0.20) return reject('latency-overhead-exceeds-twenty-percent');

  const permit = Object.freeze({
    schema: 'nk1.hyper-plastic-promotion-permit.v1',
    adapterFingerprint: adapter.fingerprint,
    baseModelFingerprint: adapter.baseModelFingerprint,
    calibrationDatasetFingerprint: calibration.datasetFingerprint,
    holdoutDatasetFingerprint: holdout.datasetFingerprint,
    seedCount: holdout.gains.length,
    meanHoldoutGain: holdoutGain,
    lowerConfidenceBound95,
    meanLatencyOverhead01,
  });
  hyperPlasticPromotionPermits.add(permit);
  return {
    eligible: true,
    reasons: [],
    permit,
    summary: {
      seedCount: holdout.gains.length,
      calibrationGain,
      meanHoldoutGain: holdoutGain,
      lowerConfidenceBound95,
      meanLatencyOverhead01,
      safetyRegressions: 0,
    },
  };
}

/**
 * Fail-closed selection seam. Unknown capability, copied permits, mismatched
 * model fingerprints or unsupported target layers all force the baseline path.
 */
export function resolveHyperPlasticAdapterRoute({
  backendCapabilities = {},
  baseModelFingerprint = '',
  adapter = null,
  promotionPermit = null,
} = {}) {
  const baseline = (reason) => ({ mode: 'baseline', reason });
  if (backendCapabilities?.supportsLowRankAdapters !== true) {
    return baseline('backend-adapter-capability-unavailable');
  }
  if (!adapter || adapter.schema !== 'nk1-lora-v1') return baseline('adapter-missing-or-invalid');
  if (!hyperPlasticPromotionPermits.has(promotionPermit)) {
    return baseline('promotion-permit-not-issued-by-gate');
  }
  if (adapter.baseModelFingerprint !== baseModelFingerprint
    || promotionPermit.baseModelFingerprint !== baseModelFingerprint) {
    return baseline('base-model-fingerprint-mismatch');
  }
  if (promotionPermit.adapterFingerprint !== adapter.fingerprint) {
    return baseline('adapter-promotion-fingerprint-mismatch');
  }
  const supportedTargets = backendCapabilities.supportedLowRankTargets;
  if (!Array.isArray(supportedTargets) || !supportedTargets.includes(adapter.target?.layer)) {
    return baseline('backend-target-layer-unavailable');
  }
  return {
    mode: 'adapter',
    reason: 'holdout-qualified',
    adapterFingerprint: adapter.fingerprint,
  };
}
