import type { HyperPlasticLoRAAdapter } from './HyperPlasticNetwork.ts';

export interface HyperPlasticAdapterLoader {
  readonly providerId: string;
  readonly baseModelFingerprint: string;
  readonly supportedLowRankTargets: readonly string[];
  loadAdapter(adapter: HyperPlasticLoRAAdapter): Promise<unknown>;
}

export interface HyperPlasticBackendCapabilities {
  readonly schema: 'nk1.hyper-plastic-backend-capability.v1';
  readonly providerId: string;
  readonly supportsLowRankAdapters: boolean;
  readonly baseModelFingerprint: string | null;
  readonly supportedLowRankTargets: readonly string[];
  readonly reason?: string;
  readonly loader: HyperPlasticAdapterLoader | null;
}

const trustedCapabilities = new WeakSet<object>();
const SHA256_MODEL_FINGERPRINT = /^sha256:[a-f0-9]{64}$/i;
const validProviderId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{1,119}$/i.test(value);

export function createUnsupportedHyperPlasticAdapterCapabilities(
  providerId: string,
  reason: string,
): HyperPlasticBackendCapabilities {
  if (!validProviderId(providerId) || typeof reason !== 'string' || reason.length < 8 || reason.length > 180) {
    throw new RangeError('ome26-backend-capability-identity-invalid');
  }
  const capabilities: HyperPlasticBackendCapabilities = Object.freeze({
    schema: 'nk1.hyper-plastic-backend-capability.v1',
    providerId,
    supportsLowRankAdapters: false,
    baseModelFingerprint: null,
    supportedLowRankTargets: Object.freeze([]),
    reason,
    loader: null,
  });
  trustedCapabilities.add(capabilities);
  return capabilities;
}

/**
 * Trusted host adapter registration. A provider must expose an actual loader
 * with a pinned base model, exact target layers and a load function.
 * This is an in-process host capability, not a crypto signature/sandbox.
 */
export function createTrustedHyperPlasticAdapterCapabilities(
  loader: HyperPlasticAdapterLoader,
): HyperPlasticBackendCapabilities {
  if (!loader || !validProviderId(loader.providerId) ||
      !SHA256_MODEL_FINGERPRINT.test(loader.baseModelFingerprint) ||
      !Array.isArray(loader.supportedLowRankTargets) ||
      loader.supportedLowRankTargets.length < 1 || loader.supportedLowRankTargets.length > 64 ||
      loader.supportedLowRankTargets.some(target =>
        typeof target !== 'string' || !/^[a-z0-9_.:/-]{1,160}$/i.test(target)) ||
      new Set(loader.supportedLowRankTargets).size !== loader.supportedLowRankTargets.length ||
      typeof loader.loadAdapter !== 'function') {
    throw new RangeError('ome26-backend-adapter-loader-contract-invalid');
  }
  const targets = Object.freeze([...loader.supportedLowRankTargets]);
  const capabilities: HyperPlasticBackendCapabilities = Object.freeze({
    schema: 'nk1.hyper-plastic-backend-capability.v1',
    providerId: loader.providerId,
    supportsLowRankAdapters: true,
    baseModelFingerprint: loader.baseModelFingerprint,
    supportedLowRankTargets: targets,
    loader,
  });
  trustedCapabilities.add(capabilities);
  return capabilities;
}

export function isTrustedHyperPlasticBackendCapabilities(
  value: unknown,
): value is HyperPlasticBackendCapabilities {
  return Boolean(value && typeof value === 'object' && trustedCapabilities.has(value as object));
}
