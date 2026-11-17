import type { P40ModelEcologyEngine } from '../../learning/P40ModelEcology.ts';
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
  private readonly ecology: P40ModelEcologyEngine;
  private readonly provider: OpenAICompatibleLocalChatProvider;

  constructor(
    registry: NeuroPlasticAdapterRegistry,
    ecology: P40ModelEcologyEngine,
    provider: OpenAICompatibleLocalChatProvider,
  ) {
    this.registry = registry;
    this.ecology = ecology;
    this.provider = provider;
  }

  async generate(
    request: LocalChatCompletionRequest,
    route: NeuroPlasticInferenceRoute,
  ): Promise<NeuroPlasticInferenceResponse> {
    if (!this.provider.configured()) throw new Error('llama.cpp-not-configured');
    const baseModelAlias = safeBaseAlias(route.baseModelAlias);
    const state = this.ecology.snapshot();
    const backend = state.profiles.find(profile => profile.id === route.backendId);
    const localBackendReady = Boolean(backend && backend.local && backend.configured && backend.available);
    const selection = this.registry.select({
      domain: route.domain,
      backendId: route.backendId,
      baseModelFingerprint: route.baseModelFingerprint,
      backendSupportsModelAliases: route.backendSupportsModelAliases && localBackendReady,
      confidence01: route.confidence01,
      risk01: route.risk01,
    });

    if (!selection.useAdapter || !selection.adapterId || !selection.modelAlias) {
      const response = await this.provider.generate({ ...request, model: baseModelAlias });
      return {
        ...response,
        adapter: { used: false, adapterId: null, fallbackReason: localBackendReady ? selection.reason : 'local-backend-not-ready' },
      };
    }

    try {
      const response = await this.provider.generate({ ...request, model: selection.modelAlias });
      return {
        ...response,
        adapter: { used: true, adapterId: selection.adapterId, fallbackReason: null },
      };
    } catch (error) {
      if (isCallerCancellation(error, request)) throw error;
      this.registry.recordRuntimeFailure(selection.adapterId, 'adapter-runtime-failure');
      const response = await this.provider.generate({ ...request, model: baseModelAlias });
      return {
        ...response,
        adapter: { used: false, adapterId: selection.adapterId, fallbackReason: 'adapter-runtime-failure' },
      };
    }
  }
}
