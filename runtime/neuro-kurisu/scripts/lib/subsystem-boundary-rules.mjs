// W1-012 — cross-subsystem import ratchet.
//
// `src/organism` is organised into named domain subsystems. A domain may depend
// on another domain only where an edge was reviewed and frozen below; any *new*
// domain->domain import fails the gate. This does not try to remove the existing
// 43 edges (that is a separate, larger refactor) — it stops the boundary from
// silently degrading while that work happens.

export const DOMAIN_SUBSYSTEMS = [
  'body', 'brain_fusion', 'cognition', 'core', 'developmental', 'integration',
  'language', 'learning', 'memory', 'persistence', 'research', 'system',
  'verification', 'world',
];

const DOMAIN_SET = new Set(DOMAIN_SUBSYSTEMS);

// Frozen at WorkPass70 baseline (35.90.0). Sorted for stable diffs. `research` has
// no inbound canonical edges by design; a new `* -> research` edge is therefore
// reported here as well as by audit-architecture.
export const FROZEN_CROSS_SUBSYSTEM_EDGES = new Set([
  'brain_fusion -> cognition',
  'cognition -> core',
  'cognition -> language',
  'cognition -> system',
  'core -> body',
  'core -> cognition',
  'core -> developmental',
  'core -> integration',
  'core -> language',
  'core -> learning',
  'core -> memory',
  'core -> persistence',
  'core -> system',
  'core -> world',
  'developmental -> body',
  'developmental -> cognition',
  'developmental -> core',
  'developmental -> learning',
  'developmental -> system',
  'developmental -> world',
  'integration -> core',
  'integration -> memory',
  'language -> system',
  'learning -> core',
  'learning -> system',
  'memory -> core',
  'memory -> developmental',
  'memory -> system',
  'persistence -> body',
  'persistence -> cognition',
  'persistence -> core',
  'persistence -> developmental',
  'persistence -> integration',
  'persistence -> learning',
  'persistence -> memory',
  'persistence -> system',
  'persistence -> world',
  'system -> body',
  'system -> cognition',
  'system -> core',
  'system -> language',
  'system -> memory',
  'world -> core',
]);

export function isDomain(name) {
  return DOMAIN_SET.has(name);
}

export function edgeKey(from, to) {
  return `${from} -> ${to}`;
}

// Given every observed domain->domain edge, return the ones not yet frozen.
// Same-domain edges and edges touching a non-domain are the caller's concern.
export function newCrossSubsystemEdges(edges) {
  const fresh = new Set();
  for (const key of edges) {
    if (FROZEN_CROSS_SUBSYSTEM_EDGES.has(key)) continue;
    fresh.add(key);
  }
  return [...fresh].sort();
}
