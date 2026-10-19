/**
 * Resolve language backend priority and temporarily cool down a local endpoint
 * after repeated failures. Configuration selects preference, not health.
 */
export function chooseLanguageBackend({ localLlamaConfigured, ecologyPreferredBackend }) {
  if (localLlamaConfigured === true) return 'llama.cpp';
  return String(ecologyPreferredBackend || 'local-fallback');
}

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
      return this.snapshot();
    }
    const localFailure = Array.isArray(failures) && failures.some(value => String(value).startsWith('llama.cpp:'));
    if (localFailure) {
      this.consecutiveFailures += 1;
      const exponent = Math.min(10, this.consecutiveFailures - 1);
      this.cooldownUntil = now + Math.min(this.maxCooldownMs, this.baseCooldownMs * (2 ** exponent));
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      consecutiveFailures: this.consecutiveFailures,
      cooldownUntil: this.cooldownUntil,
      coolingDown: this.cooldownUntil > Date.now(),
    };
  }
}
