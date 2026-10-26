export type HmxAtomicImportOutcome = 'committed' | 'rolled-back' | 'rollback-incomplete';

export interface HmxAtomicImportResult {
  outcome: HmxAtomicImportOutcome;
  created: number;
  reused: number;
  /** IDs emitted only for a successful commit; provisional IDs are discarded on clean rollback. */
  createdIds: string[];
  reason?: 'encode-failed' | 'rollback-failed';
}

export interface HmxAtomicImportOperation<TInput> {
  input: TInput;
  commandId: string;
}

export interface HmxAtomicImportPorts<TMemoryState, TLifecycleState, TInput, TMemory extends { id: string }> {
  snapshotMemory(): TMemoryState;
  restoreMemory(snapshot: TMemoryState): void;
  snapshotLifecycle(): TLifecycleState;
  restoreLifecycle(snapshot: TLifecycleState): void;
  encode(input: TInput, commandId: string): TMemory;
}

/**
 * Apply a synchronous canonical-memory batch as one recoverable operation.
 * Per-row events/compatibility projections must be disabled by the encode
 * adapter until this function reports committed; callers can then persist one
 * durable stage receipt. IDs provided by existingIds are from before the batch
 * and classify returned rows; they are not used to skip validation.
 */
export function applyHmxMemoryBatchAtomically<
  TMemoryState,
  TLifecycleState,
  TInput,
  TMemory extends { id: string },
>(
  ports: HmxAtomicImportPorts<TMemoryState, TLifecycleState, TInput, TMemory>,
  operations: readonly HmxAtomicImportOperation<TInput>[],
  existingIds: Iterable<string>,
): HmxAtomicImportResult {
  if (operations.length === 0) return { outcome: 'committed', created: 0, reused: 0, createdIds: [] };

  // Snapshot before the first side effect. Snapshot failure therefore cannot
  // leave a partial batch and is allowed to propagate to the caller.
  const memoryBefore = ports.snapshotMemory();
  const lifecycleBefore = ports.snapshotLifecycle();
  const preexistingIds = new Set([...existingIds].map(String));
  const createdIds = new Set<string>();
  let created = 0;
  let reused = 0;

  try {
    for (const operation of operations) {
      const item = ports.encode(operation.input, operation.commandId);
      const id = String(item.id);
      if (preexistingIds.has(id) || createdIds.has(id)) {
        reused += 1;
      } else {
        created += 1;
        createdIds.add(id);
      }
    }
    return { outcome: 'committed', created, reused, createdIds: [...createdIds] };
  } catch {
    let memoryRestored = true;
    let lifecycleRestored = true;
    try {
      ports.restoreMemory(memoryBefore);
    } catch {
      memoryRestored = false;
    }
    try {
      ports.restoreLifecycle(lifecycleBefore);
    } catch {
      lifecycleRestored = false;
    }
    if (memoryRestored && lifecycleRestored) {
      return { outcome: 'rolled-back', created: 0, reused: 0, createdIds: [], reason: 'encode-failed' };
    }
    return { outcome: 'rollback-incomplete', created, reused, createdIds: [...createdIds], reason: 'rollback-failed' };
  }
}
