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
    if (!persisted) return null;

    const system = asRecord((persisted as unknown as Record<string, unknown>).system);
    if (!system || !Object.prototype.hasOwnProperty.call(system, CHECKPOINT_FIELD)) return persisted;
    const raw = asRecord(system[CHECKPOINT_FIELD]);
    if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.modules) || raw.modules.length > MAX_MODULES) {
      this.quarantineCheckpoint('cognitive-module-checkpoint-invalid');
      return persisted;
    }

    try {
      const seen = new Set<string>();
      for (const candidate of raw.modules) {
        const envelope = asRecord(candidate);
        const moduleId = typeof envelope?.moduleId === 'string' ? envelope.moduleId : '';
        if (!moduleId || seen.has(moduleId)) {
          throw new Error('cognitive-module-checkpoint-duplicate-or-invalid-id');
        }
        seen.add(moduleId);
        this.moduleStates.set(moduleId, candidate as CognitiveModuleStateEnvelopeV1);
      }

      if (Array.isArray(raw.snapshotFailures)) {
        this.lastSnapshotFailures = raw.snapshotFailures
          .slice(0, MAX_FAILURES)
          .flatMap((item) => {
            const row = asRecord(item);
            if (typeof row?.id !== 'string' || typeof row.reason !== 'string') return [];
            return [{ id: row.id.slice(0, 120), reason: row.reason.slice(0, 180) }];
          });
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
      throw new Error('cognitive-module-checkpoint-organism-state-invalid');
    }

    if (this.checkpointLoadError) {
      // Keep the untrusted extension payload untouched for forensic recovery.
      // Core state may continue checkpointing; module restore remains fail-closed.
      await this.delegate.save(value);
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
        throw new Error('cognitive-module-checkpoint-snapshot-incomplete:*');
      }

      this.lastSnapshotFailures = Array.isArray(result?.failed)
        ? result.failed.slice(0, MAX_FAILURES).map(row => ({
            id: String(row.id ?? '').slice(0, 120),
            reason: String(row.reason ?? 'snapshot-failed').slice(0, 180),
          }))
        : [];
      if (this.lastSnapshotFailures.length > 0) {
        const failedIds = this.lastSnapshotFailures.map(row => row.id).join(',');
        throw new Error(`cognitive-module-checkpoint-snapshot-incomplete:${failedIds}`);
      }
    }

    const capturedAt = this.clock();
    if (!Number.isFinite(capturedAt) || capturedAt < 0) {
      throw new Error('cognitive-module-checkpoint-time-invalid');
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
    await this.delegate.save(value);
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
  } {
    return {
      moduleCount: this.moduleStates.size,
      capturedAt: this.clock(),
      snapshotFailures: this.lastSnapshotFailures.map(row => ({ ...row })),
      checkpointLoadError: this.checkpointLoadError,
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
