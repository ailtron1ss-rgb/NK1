import {
  NekoPluginManifestPolicyRegistry,
  type NekoPluginAuthorizationManifest,
  type NekoPluginManifestPolicySnapshot,
  type NekoPluginManifestRegistrationResult,
} from './NekoPluginManifestPolicyRegistry.ts';
import {
  PluginGatewayAdapter,
  type PluginGatewayAdapterOptions,
  type PluginGatewayAdapterResponse,
} from './PluginGatewayAdapter.ts';

/**
 * Host composition options for the N.E.K.O. transport boundary.
 *
 * The caller must supply the canonical NK1 ActionGateway and a non-empty,
 * host-owned protocol allowlist. Plugin manifests can narrow this set but
 * cannot expand it.
 */
export type NekoPluginGatewayRuntimeOptions = Omit<PluginGatewayAdapterOptions, 'authorize'>;

/**
 * Composes declarative plugin authorization with the existing ActionGateway.
 *
 * This class is deliberately not an executor, plugin loader or network server.
 * Every accepted request follows:
 *
 *   host protocol allowlist
 *     -> manifest policy (enabled + protocol + tool/action + live descriptor)
 *       -> PluginGatewayAdapter input/output boundary
 *         -> canonical ActionGateway approval/idempotency/verification
 *
 * No plugin-supplied field can grant authority or bypass ActionGateway.
 */
export class NekoPluginGatewayRuntime {
  private readonly policyRegistry: NekoPluginManifestPolicyRegistry;
  private readonly adapter: PluginGatewayAdapter;

  constructor(options: NekoPluginGatewayRuntimeOptions) {
    if (!options || !options.gateway) {
      throw new Error('neko-plugin-runtime-action-gateway-required');
    }

    this.policyRegistry = new NekoPluginManifestPolicyRegistry(options.gateway);
    this.adapter = new PluginGatewayAdapter({
      ...options,
      authorize: this.policyRegistry.asAuthorizer(),
    });
  }

  /** Register a host-reviewed manifest against live canonical gateway tools. */
  registerManifest(rawManifest: unknown): NekoPluginManifestRegistrationResult {
    return this.policyRegistry.register(rawManifest);
  }

  /** Replace a manifest explicitly; callers should review this as a policy change. */
  replaceManifest(rawManifest: unknown): NekoPluginManifestRegistrationResult {
    return this.policyRegistry.replace(rawManifest);
  }

  /** Enable/disable is host-owned and takes effect on the next request. */
  setPluginEnabled(pluginId: string, enabled: boolean): boolean {
    return this.policyRegistry.setEnabled(pluginId, enabled);
  }

  removeManifest(pluginId: string): boolean {
    return this.policyRegistry.remove(pluginId);
  }

  getManifest(pluginId: string): NekoPluginAuthorizationManifest | null {
    return this.policyRegistry.get(pluginId);
  }

  listManifests(): NekoPluginAuthorizationManifest[] {
    return this.policyRegistry.list();
  }

  /** Host persistence can store this policy snapshot; it is not persisted implicitly. */
  snapshotPolicy(): NekoPluginManifestPolicySnapshot {
    return this.policyRegistry.snapshot();
  }

  /** Restores only schema-validated declarations; invalid snapshots fail closed. */
  restorePolicy(snapshot: unknown): number {
    return this.policyRegistry.restore(snapshot);
  }

  /** Normalize and authorize one plugin request, then delegate to ActionGateway. */
  handle(rawRequest: unknown): Promise<PluginGatewayAdapterResponse> {
    return this.adapter.handle(rawRequest);
  }
}
