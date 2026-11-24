/**
 * Runtime validation at the public cognitive-cycle boundary.
 * TypeScript types do not protect callers at runtime (HTTP, plugins, JS and restored data).
 */
export type CognitiveCycleMode = 'full' | 'operational';

export function assertCognitiveCycleBoundaryInput(
  observation: unknown,
  resultMode: unknown,
): asserts observation is Record<string, unknown> {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError('cognitive-cycle-observation-must-be-object');
  }
  if (resultMode !== 'full' && resultMode !== 'operational') {
    throw new TypeError('cognitive-cycle-mode-must-be-full-or-operational');
  }
}
