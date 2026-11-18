import type { NeuroPlasticAdapterRegistry } from '../../learning/NeuroPlasticAdapterRegistry.ts';
import type {
  LocalChatCompletionRequest,
  LocalChatCompletionResponse,
  OpenAICompatibleLocalChatProvider,
} from './OpenAICompatibleLocalChatProvider.ts';

export interface NeuroPlasticInferenceRoute {
  domain: string;
  backendId: string;
  baseModelFingerprint: string;
  baseModelAlias: string;
  backendSupportsModelAliases: boolean;
  confidence01: number;
  risk01: number;
  /** Optional policy pin from P25; canonical selection must return this exact active adapter. */
  expectedAdapterId?: string;
}

export interface NeuroPlasticInferenceResponse extends LocalChatCompletionResponse {
  adapter: {
    used: boolean;
    adapterId: string | null;
    fallbackReason: string | null;
  };
}

function safeBaseAlias(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value)) {
    throw new Error('neuro-plastic-base-model-alias-invalid');
  }
  return value;
}

function isCallerCancellation(error: unknown, request: LocalChatCompletionRequest): boolean {
  return Boolean(request.signal?.aborted) ||
    (error instanceof Error && error.message === 'llama.cpp-request-aborted');
}

/**
 * Bridges the P40 backend ecology and the approved Neuro-Plastic registry.
 * Adapter aliases are attempted only for a configured local backend with an
 * exact base-model fingerprint. Any adapter fault disables the candidate and
 * retries the same request through the unchanged base model.
 */
export class NeuroPlasticInferenceAdapter {
  private readonly registry: NeuroPlasticAdapterRegistry;
  private readonly backendReady: (backendId: string) => boolean;
  private readonly provider: OpenAICompatibleLocalChatProvider;
  private readonly verifyArtifact: (manifest: import('../../learning/NeuroPlasticAdapterRegistry.ts').NeuroPlasticAdapterManifest) => boolean | Promise<boolean>;
  private readonly onRegistryChanged: (() => Promise<void> | void) | null;

  constructor(
    registry: NeuroPlasticAdapterRegistry,
    backendReady: (backendId: string) => boolean,
    provider: OpenAICompatibleLocalChatProvider,
    verifyArtifact: (manifest: import('../../learning/NeuroPlasticAdapterRegistry.ts').NeuroPlasticAdapterManifest) => boolean | Promise<boolean>,
    onRegistryChanged?: () => Promise<void> | void,
  ) {
    this.registry = registry;
    this.backendReady = backendReady;
    this.provider = provider;
    this.verifyArtifact = verifyArtifact;
    this.onRegistryChanged = onRegistryChanged ?? null;
  }

  async generate(
    request: LocalChatCompletionRequest,
    route: NeuroPlasticInferenceRoute,
  ): Promise<NeuroPlasticInferenceResponse> {
    if (!this.provider.configured()) throw new Error('llama.cpp-not-configured');
    const baseModelAlias = safeBaseAlias(route.baseModelAlias);
    const localBackendReady = this.backendReady(route.backendId) === true;
    const expectedAdapterId = route.expectedAdapterId;
    if (expectedAdapterId !== undefined &&
        (typeof expectedAdapterId !== 'string' ||
          !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(expectedAdapterId))) {
      throw new Error('neuro-plastic-expected-adapter-id-invalid');
    }
    const selection = this.registry.select({
      domain: route.domain,
      backendId: route.backendId,
      baseModelAlias,
      baseModelFingerprint: route.baseModelFingerprint,
      backendSupportsModelAliases: route.backendSupportsModelAliases && localBackendReady,
      confidence01: route.confidence01,
      risk01: route.risk01,
    });

    // P25 is a policy layer, never an artifact authority. If its chosen adapter
    // is absent or does not match the currently active, signed canonical registry
    // row for this exact backend/base-model route, do not substitute another
    // active adapter. Use the unchanged base alias and leave the canonical
    // artifact's health/approval state untouched.
    if (expectedAdapterId !== undefined &&
        (!selection.useAdapter || selection.adapterId !== expectedAdapterId)) {
      const response = await this.provider.generate({ ...request, model: baseModelAlias });
      return {
        ...response,
        adapter: {
          used: false,
          adapterId: selection.adapterId,
          fallbackReason: 'p25-canonical-selection-mismatch',
        },
      };
    }

    if (!selection.useAdapter || !selection.adapterId || !selection.modelAlias) {
      const response = await this.provider.generate({ ...request, model: baseModelAlias });
      return {
        ...response,
        adapter: { used: false, adapterId: null, fallbackReason: localBackendReady ? selection.reason : 'local-backend-not-ready' },
      };
    }

    let artifactVerified = false;
    try {
      artifactVerified = await this.verifyArtifact(this.registry.getManifest(selection.adapterId));
    } catch {
      artifactVerified = false;
    }
    if (!artifactVerified) {
      this.registry.recordRuntimeFailure(selection.adapterId, 'adapter-artifact-integrity-failure');
      try { await this.onRegistryChanged?.(); } catch { /* Persist failure must not suppress base-model recovery. */ }
      const response = await this.provider.generate({ ...request, model: baseModelAlias });
      return {
        ...response,
        adapter: { used: false, adapterId: selection.adapterId, fallbackReason: 'adapter-artifact-integrity-failure' },
      };
    }

    try {
      const response = await this.provider.generate({ ...request, model: selection.modelAlias });
      if (response.model !== selection.modelAlias) {
        throw new Error('adapter-model-alias-not-honored');
      }
      return {
        ...response,
        adapter: { used: true, adapterId: selection.adapterId, fallbackReason: null },
      };
    } catch (error) {
      if (isCallerCancellation(error, request)) throw error;
      this.registry.recordRuntimeFailure(selection.adapterId, 'adapter-runtime-failure');
      try { await this.onRegistryChanged?.(); } catch { /* Persist failure must not suppress base-model recovery. */ }
      const response = await this.provider.generate({ ...request, model: baseModelAlias });
      return {
        ...response,
        adapter: { used: false, adapterId: selection.adapterId, fallbackReason: 'adapter-runtime-failure' },
      };
    }
  }
}
