export type CognitiveModuleStatus =
  | 'registered'
  | 'initializing'
  | 'active'
  | 'quiescing'
  | 'stopped'
  | 'failed';

export interface CognitiveModuleManifestV1 {
  schemaVersion: 1;
  id: string;
  version: string;
  runtimeApiVersion: number;
  stateSchemaVersion: number;
  dependencies: readonly string[];
  capabilities: readonly string[];
}

export interface CognitiveModuleContext {
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly grantedCapabilities: readonly string[];
  hasCapability(capability: string): boolean;
  requireCapability(capability: string): void;
}

export interface CognitiveModuleHealth {
  healthy: boolean;
  reason?: string;
}

export interface CognitiveModule {
  initialize(context: CognitiveModuleContext): void | Promise<void>;
  health(): CognitiveModuleHealth | boolean | Promise<CognitiveModuleHealth | boolean>;
  snapshot(): unknown | Promise<unknown>;
  restore(state: unknown, fromSchemaVersion?: number): void | Promise<void>;
  migrateState?(
    state: unknown,
    fromSchemaVersion: number,
    toSchemaVersion: number,
  ): unknown | Promise<unknown>;
  quiesce(context: CognitiveModuleContext): void | Promise<void>;
  resume(context: CognitiveModuleContext): void | Promise<void>;
  shutdown(context: CognitiveModuleContext): void | Promise<void>;
}

export interface CognitiveModuleStateEnvelopeV1 {
  schemaVersion: 1;
  moduleId: string;
  moduleVersion: string;
  stateSchemaVersion: number;
  capturedAt: number;
  state: unknown;
}

export interface CognitiveModuleStateStore {
  load(moduleId: string): Promise<CognitiveModuleStateEnvelopeV1 | null>;
  save(envelope: CognitiveModuleStateEnvelopeV1): Promise<void>;
}

export interface CognitiveModuleRegistration {
  manifest: CognitiveModuleManifestV1;
  /** The host supplies trusted code. Manifests never resolve or execute code paths. */
  factory: () => CognitiveModule;
}

export interface CognitiveModuleRuntimeOptions {
  hostApiVersion?: number;
  grants?: Record<string, readonly string[]>;
  stateStore?: CognitiveModuleStateStore;
  clock?: () => number;
}

interface ModuleRecord {
  manifest: CognitiveModuleManifestV1;
  factory: () => CognitiveModule;
  module: CognitiveModule | null;
  context: CognitiveModuleContext;
  status: CognitiveModuleStatus;
  lastError?: string;
}

export interface CognitiveModuleListItem {
  manifest: CognitiveModuleManifestV1;
  status: CognitiveModuleStatus;
  lastError?: string;
}

export interface CognitiveModuleHealthRow {
  id: string;
  status: CognitiveModuleStatus;
  healthy: boolean;
  reason?: string;
}

export interface CognitiveModuleRuntimeHealth {
  ok: boolean;
  modules: CognitiveModuleHealthRow[];
}

const MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function fail(code: string, detail?: string): Error {
  return new Error(detail ? `${code}:${detail}` : code);
}

function clonePlainData(value: unknown, path = '$', seen = new Set<object>()): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw fail('module-state-not-json-safe', path);
    return value;
  }

  if (typeof value !== 'object') {
    throw fail('module-state-not-json-safe', path);
  }

  const object = value as object;
  if (seen.has(object)) throw fail('module-state-cycle', path);
  seen.add(object);

  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) {
        throw fail('module-state-symbol-key-rejected', path);
      }
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1) {
        throw fail('module-state-array-shape-invalid', path);
      }
      const out: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
          throw fail('module-state-array-element-invalid', `${path}[${index}]`);
        }
        Object.defineProperty(out, String(index), {
          value: clonePlainData(descriptor.value, `${path}[${index}]`, seen),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return out;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw fail('module-state-non-plain-object', path);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw fail('module-state-symbol-key-rejected', path);
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const out: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!descriptor.enumerable) {
        throw fail('module-state-nonenumerable-key-rejected', `${path}.${key}`);
      }
      if ('get' in descriptor || 'set' in descriptor) {
        throw fail('module-state-accessor-rejected', `${path}.${key}`);
      }
      Object.defineProperty(out, key, {
        value: clonePlainData(descriptor.value, `${path}.${key}`, seen),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('module-state-')) throw error;
    throw fail('module-state-inspection-failed', path);
  } finally {
    seen.delete(object);
  }
}

function cloneManifest(manifest: CognitiveModuleManifestV1): CognitiveModuleManifestV1 {
  return {
    schemaVersion: 1,
    id: manifest.id,
    version: manifest.version,
    runtimeApiVersion: manifest.runtimeApiVersion,
    stateSchemaVersion: manifest.stateSchemaVersion,
    dependencies: [...manifest.dependencies],
    capabilities: [...manifest.capabilities],
  };
}

function validateManifest(
  manifest: CognitiveModuleManifestV1,
  hostApiVersion: number,
): CognitiveModuleManifestV1 {
  if (!manifest || typeof manifest !== 'object') throw fail('invalid-module-manifest');
  if (manifest.schemaVersion !== 1) throw fail('unsupported-module-manifest-schema');
  if (typeof manifest.id !== 'string' || !MODULE_ID_PATTERN.test(manifest.id)) {
    throw fail('invalid-module-id');
  }
  if (typeof manifest.version !== 'string' || !SEMVER_PATTERN.test(manifest.version)) {
    throw fail('invalid-module-version');
  }
  if (!Number.isSafeInteger(manifest.runtimeApiVersion) || manifest.runtimeApiVersion < 1) {
    throw fail('invalid-module-runtime-api-version');
  }
  if (manifest.runtimeApiVersion !== hostApiVersion) {
    throw fail('module-runtime-api-incompatible', manifest.id);
  }
  if (!Number.isSafeInteger(manifest.stateSchemaVersion) || manifest.stateSchemaVersion < 1) {
    throw fail('invalid-module-state-schema-version', manifest.id);
  }
  for (const [label, values] of [
    ['dependencies', manifest.dependencies],
    ['capabilities', manifest.capabilities],
  ] as const) {
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) {
      throw fail('invalid-module-manifest-list', `${manifest.id}:${label}`);
    }
    if (new Set(values).size !== values.length) {
      throw fail('duplicate-module-manifest-entry', `${manifest.id}:${label}`);
    }
    const pattern = label === 'dependencies' ? MODULE_ID_PATTERN : CAPABILITY_PATTERN;
    if (values.some(value => !pattern.test(value))) {
      throw fail('invalid-module-manifest-entry', `${manifest.id}:${label}`);
    }
  }
  if (manifest.dependencies.includes(manifest.id)) {
    throw fail('module-self-dependency', manifest.id);
  }
  return cloneManifest(manifest);
}

function validateEnvelope(
  envelope: CognitiveModuleStateEnvelopeV1 | null,
  moduleId: string,
): CognitiveModuleStateEnvelopeV1 | null {
  if (envelope == null) return null;
  if (typeof envelope !== 'object' || envelope.schemaVersion !== 1) {
    throw fail('module-state-envelope-invalid', moduleId);
  }
  if (envelope.moduleId !== moduleId) throw fail('module-state-owner-mismatch', moduleId);
  if (typeof envelope.moduleVersion !== 'string' || !SEMVER_PATTERN.test(envelope.moduleVersion)) {
    throw fail('module-state-version-invalid', moduleId);
  }
  if (!Number.isSafeInteger(envelope.stateSchemaVersion) || envelope.stateSchemaVersion < 1) {
    throw fail('module-state-schema-invalid', moduleId);
  }
  if (!Number.isFinite(envelope.capturedAt) || envelope.capturedAt < 0) {
    throw fail('module-state-time-invalid', moduleId);
  }
  return {
    schemaVersion: 1,
    moduleId,
    moduleVersion: envelope.moduleVersion,
    stateSchemaVersion: envelope.stateSchemaVersion,
    capturedAt: envelope.capturedAt,
    state: clonePlainData(envelope.state),
  };
}

function isModule(value: unknown): value is CognitiveModule {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return [
    'initialize', 'health', 'snapshot', 'restore',
    'quiesce', 'resume', 'shutdown',
  ].every(key => typeof candidate[key] === 'function') &&
    (candidate.migrateState == null || typeof candidate.migrateState === 'function');
}

export class CognitiveModuleRuntime {
  private readonly hostApiVersion: number;
  private readonly grants: Map<string, ReadonlySet<string>>;
  private stateStore?: CognitiveModuleStateStore;
  private readonly clock: () => number;
  private readonly records = new Map<string, ModuleRecord>();

  constructor(options: CognitiveModuleRuntimeOptions = {}) {
    this.hostApiVersion = options.hostApiVersion ?? 1;
    if (!Number.isSafeInteger(this.hostApiVersion) || this.hostApiVersion < 1) {
      throw fail('invalid-host-api-version');
    }
    this.grants = new Map(
      Object.entries(options.grants ?? {}).map(([id, capabilities]) => [
        id,
        new Set(Array.isArray(capabilities) ? capabilities : []),
      ]),
    );
    this.stateStore = options.stateStore;
    this.clock = options.clock ?? Date.now;
  }

  /**
   * Bind the host to the canonical persistence owner before any module starts.
   * Rebinding after activation is rejected to prevent split-brain module state.
   */
  bindStateStore(stateStore: CognitiveModuleStateStore): void {
    if (!stateStore || typeof stateStore.load !== 'function' || typeof stateStore.save !== 'function') {
      throw fail('invalid-module-state-store');
    }
    if ([...this.records.values()].some(record => record.status !== 'registered')) {
      throw fail('module-state-store-already-in-use');
    }
    this.stateStore = stateStore;
  }

  register(registration: CognitiveModuleRegistration): CognitiveModuleListItem {
    if (!registration || typeof registration.factory !== 'function') {
      throw fail('invalid-module-factory');
    }
    const manifest = validateManifest(registration.manifest, this.hostApiVersion);
    if (this.records.has(manifest.id)) throw fail('duplicate-module-id', manifest.id);

    const hostGrant = this.grants.get(manifest.id) ?? new Set<string>();
    // Least privilege: modules see only the capabilities they requested and
    // the host explicitly approved, never every grant attached to their ID.
    const grantedCapabilities = Object.freeze(
      manifest.capabilities.filter(capability => hostGrant.has(capability)).sort(),
    );

    const context: CognitiveModuleContext = Object.freeze({
      moduleId: manifest.id,
      moduleVersion: manifest.version,
      grantedCapabilities,
      hasCapability: (capability: string) => grantedCapabilities.includes(capability),
      requireCapability: (capability: string) => {
        if (!grantedCapabilities.includes(capability)) {
          throw fail('module-capability-not-granted', `${manifest.id}:${capability}`);
        }
      },
    });

    const record: ModuleRecord = {
      manifest,
      factory: registration.factory,
      module: null,
      context,
      status: 'registered',
    };
    this.records.set(manifest.id, record);
    return this.toListItem(record);
  }

  list(): CognitiveModuleListItem[] {
    return [...this.records.values()].map(record => this.toListItem(record));
  }

  topologicalOrder(): string[] {
    const order: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw fail('module-dependency-cycle', id);
      const record = this.records.get(id);
      if (!record) throw fail('missing-module-dependency', id);
      visiting.add(id);
      for (const dependency of record.manifest.dependencies) {
        if (!this.records.has(dependency)) {
          throw fail('missing-module-dependency', `${id}:${dependency}`);
        }
        visit(dependency);
      }
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of this.records.keys()) visit(id);
    return order;
  }

  async activate(id: string): Promise<CognitiveModuleListItem> {
    const record = this.records.get(id);
    if (!record) throw fail('unknown-cognitive-module', id);
    if (record.status === 'active') return this.toListItem(record);
    if (record.status === 'initializing' || record.status === 'quiescing') {
      throw fail('module-lifecycle-busy', id);
    }

    for (const dependency of record.manifest.dependencies) {
      const dependencyRecord = this.records.get(dependency);
      if (!dependencyRecord) throw fail('missing-module-dependency', `${id}:${dependency}`);
      if (dependencyRecord.status !== 'active') {
        throw fail('module-dependency-not-active', `${id}:${dependency}`);
      }
    }

    const granted = this.grants.get(id) ?? new Set<string>();
    for (const capability of record.manifest.capabilities) {
      if (!granted.has(capability)) {
        record.status = 'failed';
        record.lastError = `capability-not-granted:${capability}`;
        throw fail('capability-not-granted', capability);
      }
    }

    record.status = 'initializing';
    record.lastError = undefined;
    let created: CognitiveModule | null = null;
    try {
      created = record.factory();
      if (!isModule(created)) throw fail('invalid-cognitive-module', id);
      record.module = created;

      if (this.stateStore) {
        let stored: CognitiveModuleStateEnvelopeV1 | null;
        try {
          stored = validateEnvelope(await this.stateStore.load(id), id);
        } catch (error) {
          throw fail('module-state-load-failed', error instanceof Error ? error.message : id);
        }

        if (stored) {
          let state = stored.state;
          if (stored.stateSchemaVersion > record.manifest.stateSchemaVersion) {
            throw fail('module-state-schema-ahead', id);
          }
          if (stored.stateSchemaVersion < record.manifest.stateSchemaVersion) {
            if (typeof created.migrateState !== 'function') {
              throw fail('module-state-migration-required', id);
            }
            try {
              state = clonePlainData(await created.migrateState(
                state,
                stored.stateSchemaVersion,
                record.manifest.stateSchemaVersion,
              ));
            } catch (error) {
              throw fail('module-state-migration-failed', error instanceof Error ? error.message : id);
            }
          }
          await created.restore(state, record.manifest.stateSchemaVersion);
        }
      }

      await created.initialize(record.context);
      record.status = 'active';
      return this.toListItem(record);
    } catch (error) {
      record.status = 'failed';
      record.lastError = error instanceof Error ? error.message : String(error);
      try {
        await created?.shutdown(record.context);
      } catch {
        // A failed module remains quarantined; cleanup is best-effort only.
      }
      record.module = null;
      throw error;
    }
  }

  async activateAll(): Promise<CognitiveModuleListItem[]> {
    const order = this.topologicalOrder();
    const activated: string[] = [];
    try {
      for (const id of order) {
        if (this.records.get(id)?.status === 'active') continue;
        await this.activate(id);
        activated.push(id);
      }
      return this.list();
    } catch (error) {
      for (const id of activated.reverse()) {
        try {
          await this.deactivate(id);
        } catch {
          // Preserve the original activation failure; each failed stop remains visible.
        }
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<CognitiveModuleStateEnvelopeV1 | null> {
    const record = this.records.get(id);
    if (!record) throw fail('unknown-cognitive-module', id);
    if (record.status !== 'active' || !record.module) {
      if (record.status === 'stopped' || record.status === 'registered') return null;
      throw fail('module-not-active', id);
    }

    for (const candidate of this.records.values()) {
      if (
        candidate.status === 'active' &&
        candidate.manifest.dependencies.includes(id)
      ) {
        throw fail('active-dependent', candidate.manifest.id);
      }
    }

    const module = record.module;
    record.status = 'quiescing';
    let quiesceAttempted = false;
    let shutdownStarted = false;
    let envelope: CognitiveModuleStateEnvelopeV1 | null = null;
    try {
      quiesceAttempted = true;
      try {
        await module.quiesce(record.context);
      } catch (error) {
        throw fail('module-quiesce-failed', error instanceof Error ? error.message : id);
      }

      const state = clonePlainData(await module.snapshot());
      envelope = {
        schemaVersion: 1,
        moduleId: id,
        moduleVersion: record.manifest.version,
        stateSchemaVersion: record.manifest.stateSchemaVersion,
        capturedAt: this.clock(),
        state,
      };
      if (!Number.isFinite(envelope.capturedAt) || envelope.capturedAt < 0) {
        throw fail('module-state-time-invalid', id);
      }
      if (this.stateStore) {
        try {
          await this.stateStore.save(envelope);
        } catch (error) {
          throw fail('module-state-save-failed', error instanceof Error ? error.message : id);
        }
      }

      shutdownStarted = true;
      try {
        await module.shutdown(record.context);
      } catch (error) {
        throw fail('module-shutdown-failed', error instanceof Error ? error.message : id);
      }
      record.module = null;
      record.status = 'stopped';
      record.lastError = undefined;
      return envelope;
    } catch (error) {
      // Once shutdown has begun its partial effects are unknowable. Keep the
      // durable snapshot, quarantine the instance and never report it active.
      if (shutdownStarted) {
        record.module = null;
        record.status = 'failed';
        record.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      }

      // Quiesce may have partially suspended work even if it rejected.
      if (quiesceAttempted) {
        try {
          await module.resume(record.context);
          record.status = 'active';
        } catch (resumeError) {
          record.module = null;
          record.status = 'failed';
          record.lastError = resumeError instanceof Error ? resumeError.message : String(resumeError);
          throw fail('module-resume-after-stop-failure', record.lastError);
        }
      } else {
        record.status = 'active';
      }
      if (record.status === 'active') {
        record.lastError = error instanceof Error ? error.message : String(error);
      }
      throw error;
    }
  }

  async stopAll(): Promise<CognitiveModuleListItem[]> {
    const order = this.topologicalOrder().reverse();
    for (const id of order) {
      if (this.records.get(id)?.status === 'active') await this.deactivate(id);
    }
    return this.list();
  }

  /**
   * Capture active module state into the configured store without quiescing or
   * stopping modules. Each module is isolated: a failed snapshot is reported
   * while the last successfully persisted envelope remains available.
   */
  async snapshotAll(): Promise<{ captured: string[]; failed: Array<{ id: string; reason: string }> }> {
    const captured: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const id of this.topologicalOrder()) {
      const record = this.records.get(id);
      if (record?.status !== 'active' || !record.module) continue;
      try {
        const state = clonePlainData(await record.module.snapshot());
        const capturedAt = this.clock();
        if (!Number.isFinite(capturedAt) || capturedAt < 0) {
          throw fail('module-state-time-invalid', id);
        }
        const envelope: CognitiveModuleStateEnvelopeV1 = {
          schemaVersion: 1,
          moduleId: record.manifest.id,
          moduleVersion: record.manifest.version,
          stateSchemaVersion: record.manifest.stateSchemaVersion,
          capturedAt,
          state,
        };
        if (this.stateStore) await this.stateStore.save(envelope);
        captured.push(id);
      } catch (error) {
        failed.push({
          id,
          reason: String(error instanceof Error ? error.message : error).slice(0, 180),
        });
      }
    }
    return { captured, failed };
  }

  async health(): Promise<CognitiveModuleRuntimeHealth> {
    const modules: CognitiveModuleHealthRow[] = [];
    for (const record of this.records.values()) {
      if (record.status !== 'active' || !record.module) {
        modules.push({
          id: record.manifest.id,
          status: record.status,
          healthy: record.status === 'registered' || record.status === 'stopped',
          reason: record.lastError,
        });
        continue;
      }
      try {
        const result = await record.module.health();
        const healthy = typeof result === 'boolean' ? result : result?.healthy === true;
        modules.push({
          id: record.manifest.id,
          status: record.status,
          healthy,
          reason: typeof result === 'object' ? result.reason : undefined,
        });
      } catch {
        modules.push({
          id: record.manifest.id,
          status: record.status,
          healthy: false,
          reason: 'health-probe-failed',
        });
      }
    }
    return { ok: modules.every(row => row.healthy), modules };
  }

  private toListItem(record: ModuleRecord): CognitiveModuleListItem {
    return {
      manifest: cloneManifest(record.manifest),
      status: record.status,
      ...(record.lastError ? { lastError: record.lastError } : {}),
    };
  }
}
