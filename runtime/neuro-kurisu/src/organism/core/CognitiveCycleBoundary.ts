import { snapshotPlainData } from './PlainDataSnapshot.ts';
/**
 * Runtime validation at the public cognitive-cycle boundary.
 * TypeScript types do not protect callers at runtime (HTTP, plugins, JS and restored data).
 */
export type CognitiveCycleMode = 'full' | 'operational';

export function normalizeCognitiveCycleBoundaryInput(
  observation: unknown,
  resultMode: unknown,
): Record<string, unknown> {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError('cognitive-cycle-observation-must-be-object');
  }
  if (resultMode !== 'full' && resultMode !== 'operational') {
    throw new TypeError('cognitive-cycle-mode-must-be-full-or-operational');
  }
  try {
    return snapshotPlainData<Record<string, unknown>>(observation, {
      allowNonFiniteNumbers: true, maxDepth: 64, maxNodes: 100_000, maxStringUnits: 4 * 1024 * 1024,
    });
  } catch {
    throw new TypeError('cognitive-cycle-observation-must-be-plain-data');
  }
}

export function assertCognitiveCycleBoundaryInput(
  observation: unknown,
  resultMode: unknown,
): asserts observation is Record<string, unknown> {
  normalizeCognitiveCycleBoundaryInput(observation, resultMode);
}
