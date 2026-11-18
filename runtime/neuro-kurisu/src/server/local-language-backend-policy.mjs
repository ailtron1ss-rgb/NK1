import { isTrustedHyperPlasticPromotionPermit } from '../organism/research/HyperPlasticOutcomeEvaluator.ts';
import { isTrustedHyperPlasticBackendCapabilities } from '../organism/research/HyperPlasticBackendCapabilities.ts';

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

  routeHyperPlasticAdapter(input = {}) {
    return resolveHyperPlasticAdapterRoute(input);
  }

  snapshot({ now = Date.now() } = {}) {
    return {
      consecutiveFailures: this.consecutiveFailures,
      cooldownUntil: this.cooldownUntil,
      coolingDown: this.cooldownUntil > now,
    };
  }
}


/**
 * Caller-supplied score arrays are diagnostic input only. They have no
 * cryptographic provenance and must never mint an activation permit.
 */
export function evaluateHyperPlasticPromotion() {
  return {
    eligible: false,
    reasons: ['signed-outcome-evidence-required'],
    permit: null,
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
  if (!isTrustedHyperPlasticBackendCapabilities(backendCapabilities)) {
    return baseline('backend-capability-not-provider-issued');
  }
  if (!backendCapabilities.supportsLowRankAdapters || !backendCapabilities.loader) {
    return baseline('backend-adapter-capability-unavailable');
  }
  if (backendCapabilities.baseModelFingerprint !== baseModelFingerprint) {
    return baseline('backend-base-model-fingerprint-mismatch');
  }
  if (!adapter || adapter.schema !== 'nk1-lora-v1') return baseline('adapter-missing-or-invalid');
  if (!isTrustedHyperPlasticPromotionPermit(promotionPermit, {
    adapterFingerprint: adapter.fingerprint,
    baseModelFingerprint,
  })) {
    return baseline('promotion-permit-not-issued-by-signed-ledger');
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
