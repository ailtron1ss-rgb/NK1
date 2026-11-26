import type { JsonStateStore, StateStoreMetrics } from '../persistence/FileStateStore.ts';
import type { PersistedOrganism } from './OrganismCore.ts';
import type {
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

  readonly moduleStateStore: CognitiveModuleStateStore = {
    load: async (moduleId) => {
      const envelope = this.moduleStates.get(moduleId);
      return envelope ? structuredClone(envelope) : null;
    },
    save: async (envelope) => {
      if (!envelope || typeof envelope.moduleId !== 'string' || !envelope.moduleId) {
        throw new Error('cognitive-module-checkpoint-envelope-invalid');
      }
      if (!this.moduleStates.has(envelope.moduleId) && this.moduleStates.size >= MAX_MODULES) {
        throw new Error('cognitive-module-checkpoint-capacity-exceeded');
      }
      this.moduleStates.set(envelope.moduleId, structuredClone(envelope));
    },
  };

  constructor(
    private readonly delegate: JsonStateStore<PersistedOrganism>,
    private readonly clock: () => number = Date.now,
  ) {}

  bindSnapshotProvider(provider: SnapshotProvider): void {
    if (this.snapshotProvider) throw new Error('cognitive-module-checkpoint-provider-already-bound');
    if (typeof provider !== 'function') throw new Error('cognitive-module-checkpoint-provider-invalid');
    this.snapshotProvider = provider;
  }

  async load(): Promise<PersistedOrganism | null> {
    const persisted = await this.delegate.load();
    this.moduleStates.clear();
    this.lastSnapshotFailures = [];
    if (!persisted) return null;

    const system = asRecord((persisted as unknown as Record<string, unknown>).system);
    const raw = asRecord(system?.[CHECKPOINT_FIELD]);
    if (!raw) return persisted;

    if (raw.schemaVersion !== 1 || !Array.isArray(raw.modules) || raw.modules.length > MAX_MODULES) {
      throw new Error('cognitive-module-checkpoint-invalid');
    }

    const seen = new Set<string>();
    for (const candidate of raw.modules) {
      const envelope = asRecord(candidate);
      const moduleId = typeof envelope?.moduleId === 'string' ? envelope.moduleId : '';
      if (!moduleId || seen.has(moduleId)) throw new Error('cognitive-module-checkpoint-duplicate-or-invalid-id');
      seen.add(moduleId);
      this.moduleStates.set(moduleId, structuredClone(candidate) as CognitiveModuleStateEnvelopeV1);
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
    return persisted;
  }

  async save(value: PersistedOrganism): Promise<void> {
    if (!value || typeof value !== 'object' || !asRecord((value as unknown as Record<string, unknown>).system)) {
      throw new Error('cognitive-module-checkpoint-organism-state-invalid');
    }

    if (this.snapshotProvider) {
      try {
        const result = await this.snapshotProvider();
        this.lastSnapshotFailures = Array.isArray(result?.failed)
          ? result.failed.slice(0, MAX_FAILURES).map(row => ({
              id: String(row.id ?? '').slice(0, 120),
              reason: String(row.reason ?? 'snapshot-failed').slice(0, 180),
            }))
          : [];
      } catch (error) {
        this.lastSnapshotFailures = [{
          id: '*',
          reason: String(error instanceof Error ? error.message : error).slice(0, 180),
        }];
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
        .sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        .map(envelope => structuredClone(envelope)),
      snapshotFailures: this.lastSnapshotFailures.map(row => ({ ...row })),
    };
    // OrganismCore stamps and validates the canonical organism before invoking
    // its store. This extension lives under system, which is excluded from the
    // organism's content hash, and is written atomically with the same payload.
    system[CHECKPOINT_FIELD] = checkpoint;
    await this.delegate.save(value);
  }

  metrics(): StateStoreMetrics | undefined {
    return this.delegate.metrics?.();
  }

  diagnostics(): {
    moduleCount: number;
    capturedAt: number;
    snapshotFailures: Array<{ id: string; reason: string }>;
  } {
    return {
      moduleCount: this.moduleStates.size,
      capturedAt: this.clock(),
      snapshotFailures: this.lastSnapshotFailures.map(row => ({ ...row })),
    };
  }
}
