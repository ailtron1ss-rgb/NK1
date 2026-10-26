/**
 * Canonical item ceiling owned by MemoryOS2.
 *
 * Import adapters must preflight against this contract because MemoryOS2 evicts the
 * tail when an insertion crosses the limit; compensating the new rows cannot restore
 * an older row that was evicted as a side effect.
 */
export const CANONICAL_MEMORY_CAPACITY = 1600;
