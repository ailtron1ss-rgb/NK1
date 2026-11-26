import type { JsonStateStore, StateStoreMetrics } from '../persistence/FileStateStore.ts';
import type { PersistedOrganism } from './OrganismCore.ts';
import type {
  CognitiveModuleRuntime,
  CognitiveModuleStateEnvelopeV1,
  CognitiveModuleStateStore,
} from './CognitiveModuleRuntime.ts';

export interface CognitiveModuleCheckpointCaptureResult {
  captured: string[];
  failed: Array<{ id: string; reason: string }>;
}

interface CognitiveModuleCheckpointEnvelopeV1 {
  schemaVersion: 1;
  capturedAt: number;
  modules: CognitiveModuleStateEnvelopeV1[];
  snapshotFailures: Array<{ id: string; reason: string }>;
}

type SnapshotProvider = () => Promise<CognitiveModuleCheckpointCaptureResult>;
const CHECKPOINT_FIELD = 'cognitiveModuleRuntime';
const MAX_MODULES = 256;
const MAX_FAILURES = 32;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

interface OwnDataProperty {
  present: boolean;
  valid: boolean;
  value?: unknown;
}

/** Inspect persisted metadata without invoking user-defined getters/setters. */
function ownDataProperty(record: Record<string, unknown>, key: string): OwnDataProperty {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor) return { present: false, valid: true };
    if (!descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return { present: true, valid: false };
    }
    return { present: true, valid: true, value: descriptor.value };
  } catch {
    return { present: true, valid: false };
  }
}

function safeArrayItem(value: unknown[], index: number): OwnDataProperty {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return { present: Boolean(descriptor), valid: false };
    }
    return { present: true, valid: true, value: descriptor.value };
  } catch {
    return { present: true, valid: false };
  }
}

/**
 * Bridges per-module snapshots into the organism's existing canonical
 * PersistedOrganism.system checkpoint. The module adapter is memory-only:
 * the enclosing organism store remains the sole durable writer and backup owner.
 */
export class CognitiveModuleCheckpointStore implements JsonStateStore<PersistedOrganism> {
  private readonly moduleStates = new Map<string, CognitiveModuleStateEnvelopeV1>();
  private snapshotProvider?: SnapshotProvider;
  private lastSnapshotFailures: Array<{ id: string; reason: string }> = [];
  private checkpointLoadError: string | null = null;
  private lastCheckpointSaveError: string | null = null;
  private lastCapturedAt = 0;
  private readonly delegate: JsonStateStore<PersistedOrganism>;
  private readonly clock: () => number;

  readonly moduleStateStore: CognitiveModuleStateStore = {
    load: async (moduleId) => {
      if (this.checkpointLoadError) {
        throw new Error(`cognitive-module-checkpoint-restore-failed:${this.checkpointLoadError}`);
      }
      const envelope = this.moduleStates.get(moduleId);
      // Runtime validates and bounded-clones the envelope before restore; avoid
      // an unbounded duplicate allocation at this adapter boundary.
      return envelope ?? null;
    },
    save: async (envelope) => {
      if (!envelope || typeof envelope.moduleId !== 'string' || !envelope.moduleId) {
        throw new Error('cognitive-module-checkpoint-envelope-invalid');
      }
      if (!this.moduleStates.has(envelope.moduleId) && this.moduleStates.size >= MAX_MODULES) {
        throw new Error('cognitive-module-checkpoint-capacity-exceeded');
      }
      // Runtime snapshot and stop paths already produce bounded immutable
      // envelopes. Retain the owned snapshot reference until the canonical
      // store serializes it, avoiding another potentially large object graph copy.
      this.moduleStates.set(envelope.moduleId, envelope);
    },
  };

  constructor(
    delegate: JsonStateStore<PersistedOrganism>,
    clock: () => number = Date.now,
  ) {
    this.delegate = delegate;
    this.clock = clock;
  }

  bindSnapshotProvider(provider: SnapshotProvider): void {
    if (this.snapshotProvider) throw new Error('cognitive-module-checkpoint-provider-already-bound');
    if (typeof provider !== 'function') throw new Error('cognitive-module-checkpoint-provider-invalid');
    this.snapshotProvider = provider;
  }

  async load(): Promise<PersistedOrganism | null> {
    const persisted = await this.delegate.load();
    this.moduleStates.clear();
    this.lastSnapshotFailures = [];
    this.checkpointLoadError = null;
    this.lastCheckpointSaveError = null;
    this.lastCapturedAt = 0;
    if (!persisted) return null;

    const persistedRecord = asRecord(persisted);
    if (!persistedRecord) return persisted;
    const systemProperty = ownDataProperty(persistedRecord, 'system');
    if (!systemProperty.valid) {
      this.quarantineCheckpoint('cognitive-module-checkpoint-system-accessor-rejected');
      return persisted;
    }
    const system = asRecord(systemProperty.value);
    if (!system) return persisted;

    const checkpointProperty = ownDataProperty(system, CHECKPOINT_FIELD);
    if (!checkpointProperty.valid) {
      this.quarantineCheckpoint('cognitive-module-checkpoint-metadata-accessor-rejected');
      return persisted;
    }
    if (!checkpointProperty.present) return persisted;

    const raw = asRecord(checkpointProperty.value);
    if (!raw) {
      this.quarantineCheckpoint('cognitive-module-checkpoint-invalid');
      return persisted;
    }

    const schemaProperty = ownDataProperty(raw, 'schemaVersion');
    const capturedAtProperty = ownDataProperty(raw, 'capturedAt');
    const modulesProperty = ownDataProperty(raw, 'modules');
    const failuresProperty = ownDataProperty(raw, 'snapshotFailures');
    const allowedKeys = new Set(['schemaVersion', 'capturedAt', 'modules', 'snapshotFailures']);
    let unknownKey = false;
    try {
      unknownKey = Reflect.ownKeys(raw).some(key => typeof key !== 'string' || !allowedKeys.has(key));
    } catch {
      unknownKey = true;
    }
    const capturedAt = capturedAtProperty.value;
    const modules = modulesProperty.value;
    if (
      unknownKey ||
      !schemaProperty.valid || schemaProperty.value !== 1 ||
      !capturedAtProperty.valid || typeof capturedAt !== 'number' ||
      !Number.isFinite(capturedAt) || capturedAt < 0 ||
      !modulesProperty.valid || !Array.isArray(modules) ||
      modules.length > MAX_MODULES ||
      !failuresProperty.valid
    ) {
      this.quarantineCheckpoint('cognitive-module-checkpoint-invalid-or-accessor-rejected');
      return persisted;
    }
    this.lastCapturedAt = capturedAt;

    try {
      const seen = new Set<string>();
      for (let index = 0; index < modules.length; index += 1) {
        const item = safeArrayItem(modules, index);
        const envelope = asRecord(item.value);
        const idProperty = envelope ? ownDataProperty(envelope, 'moduleId') : { present: false, valid: false };
        const moduleId = idProperty.value;
        if (!item.valid || !envelope || !idProperty.valid ||
            typeof moduleId !== 'string' || !moduleId || seen.has(moduleId)) {
          throw new Error('cognitive-module-checkpoint-module-envelope-invalid-or-accessor-rejected');
        }
        seen.add(moduleId);
        this.moduleStates.set(moduleId, item.value as CognitiveModuleStateEnvelopeV1);
      }

      if (failuresProperty.present) {
        if (!Array.isArray(failuresProperty.value)) {
          throw new Error('cognitive-module-checkpoint-snapshot-failures-invalid');
        }
        const rows = failuresProperty.value;
        const nextFailures: Array<{ id: string; reason: string }> = [];
        for (let index = 0; index < Math.min(rows.length, MAX_FAILURES); index += 1) {
          const item = safeArrayItem(rows, index);
          const row = asRecord(item.value);
          const id = row ? ownDataProperty(row, 'id') : { present: false, valid: false };
          const reason = row ? ownDataProperty(row, 'reason') : { present: false, valid: false };
          if (!item.valid || !row || !id.valid || !reason.valid ||
              typeof id.value !== 'string' || typeof reason.value !== 'string') {
            throw new Error('cognitive-module-checkpoint-snapshot-failure-row-invalid');
          }
          nextFailures.push({ id: id.value.slice(0, 120), reason: reason.value.slice(0, 180) });
        }
        this.lastSnapshotFailures = nextFailures;
      }
    } catch (error) {
      this.quarantineCheckpoint(
        String(error instanceof Error ? error.message : error).slice(0, 180),
      );
    }
    return persisted;
  }

  private quarantineCheckpoint(reason: string): void {
    this.moduleStates.clear();
    this.checkpointLoadError = String(reason || 'checkpoint-invalid').slice(0, 180);
    this.lastSnapshotFailures = [{
      id: '*',
      reason: this.checkpointLoadError,
    }];
  }

  async save(value: PersistedOrganism): Promise<void> {
    if (!value || typeof value !== 'object' || !asRecord((value as unknown as Record<string, unknown>).system)) {
      const error = new Error('cognitive-module-checkpoint-organism-state-invalid');
      this.lastCheckpointSaveError = error.message;
      throw error;
    }

    if (this.checkpointLoadError) {
      // Keep the untrusted extension payload untouched for forensic recovery.
      // Core state may continue checkpointing; module restore remains fail-closed.
      try {
        await this.delegate.save(value);
        this.lastCheckpointSaveError = null;
      } catch (error) {
        this.lastCheckpointSaveError =
          String(error instanceof Error ? error.message : error).slice(0, 180);
        throw error;
      }
      return;
    }

    if (this.snapshotProvider) {
      let result: CognitiveModuleCheckpointCaptureResult;
      try {
        result = await this.snapshotProvider();
      } catch (error) {
        this.lastSnapshotFailures = [{
          id: '*',
          reason: String(error instanceof Error ? error.message : error).slice(0, 180),
        }];
        this.lastCheckpointSaveError =
          'cognitive-module-checkpoint-snapshot-incomplete:*';
        throw new Error(this.lastCheckpointSaveError);
      }

      this.lastSnapshotFailures = Array.isArray(result?.failed)
        ? result.failed.slice(0, MAX_FAILURES).map(row => ({
            id: String(row.id ?? '').slice(0, 120),
            reason: String(row.reason ?? 'snapshot-failed').slice(0, 180),
          }))
        : [];
      if (this.lastSnapshotFailures.length > 0) {
        const failedIds = this.lastSnapshotFailures.map(row => row.id).join(',');
        this.lastCheckpointSaveError =
          `cognitive-module-checkpoint-snapshot-incomplete:${failedIds}`.slice(0, 180);
        throw new Error(this.lastCheckpointSaveError);
      }
    }

    const capturedAt = this.clock();
    if (!Number.isFinite(capturedAt) || capturedAt < 0) {
      this.lastCheckpointSaveError = 'cognitive-module-checkpoint-time-invalid';
      throw new Error(this.lastCheckpointSaveError);
    }
    const system = (value as unknown as { system: Record<string, unknown> }).system;
    const checkpoint: CognitiveModuleCheckpointEnvelopeV1 = {
      schemaVersion: 1,
      capturedAt,
      modules: [...this.moduleStates.values()]
        .sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
      snapshotFailures: this.lastSnapshotFailures.map(row => ({ ...row })),
    };
    // OrganismCore stamps and validates the canonical organism before invoking
    // its store. This extension lives under system, which is excluded from the
    // organism's content hash, and is written atomically with the same payload.
    system[CHECKPOINT_FIELD] = checkpoint;
    try {
      await this.delegate.save(value);
    } catch (error) {
      this.lastCheckpointSaveError =
        String(error instanceof Error ? error.message : error).slice(0, 180);
      throw error;
    }
    this.lastCheckpointSaveError = null;
    this.lastCapturedAt = capturedAt;
  }

  metrics(): StateStoreMetrics {
    return this.delegate.metrics?.() ?? {
      saves: 0,
      bytesWritten: 0,
      lastPayloadBytes: 0,
      lastSaveMs: 0,
      backupCopies: 0,
      fsyncs: 0,
      lastSavedAt: 0,
      skippedUnchangedSaves: 0,
    };
  }

  diagnostics(): {
    moduleCount: number;
    capturedAt: number;
    snapshotFailures: Array<{ id: string; reason: string }>;
    checkpointLoadError: string | null;
    checkpointSaveError: string | null;
  } {
    return {
      moduleCount: this.moduleStates.size,
      // Zero means no module checkpoint has been durably captured yet.
      capturedAt: this.lastCapturedAt,
      snapshotFailures: this.lastSnapshotFailures.map(row => ({ ...row })),
      checkpointLoadError: this.checkpointLoadError,
      checkpointSaveError: this.lastCheckpointSaveError,
    };
  }
}


/** The narrow host surface needed to bind module state to the canonical organism store. */
export type CognitiveModuleRuntimeHost = Pick<
  CognitiveModuleRuntime,
  'bindStateStore' | 'snapshotAll' | 'activateAll' | 'health' | 'stopAll' | 'list' |
  'connectCanonicalCheckpointStore'
>;

/**
 * Assemble the module checkpoint adapter once, before OrganismRuntime.init().
 * The organism's existing store remains the only durable writer.
 */
export function connectCognitiveModuleRuntimeCheckpoint(
  runtime: CognitiveModuleRuntimeHost,
  delegate: JsonStateStore<PersistedOrganism>,
): CognitiveModuleCheckpointStore {
  const checkpoint = new CognitiveModuleCheckpointStore(delegate);
  runtime.bindStateStore(checkpoint.moduleStateStore);
  checkpoint.bindSnapshotProvider(() => runtime.snapshotAll());
  return checkpoint;
}
