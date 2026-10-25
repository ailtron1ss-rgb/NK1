import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Guard the *live* orchestration path, not just the kernel in isolation.
const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');

assert.match(
  runtime,
  /import\s+\{\s*CanonicalCognitiveKernel\s*\}\s+from\s+['"]\.\/CanonicalCognitiveKernel\.ts['"]/,
  'OrganismRuntime must import the canonical cognitive kernel',
);
assert.match(
  runtime,
  /new CanonicalCognitiveKernel\(this\.cognitiveEventFabric,\s*this\.unifiedCycle\)/,
  'the kernel must own the existing runtime ledgers rather than creating a parallel state store',
);
assert.match(runtime, /this\.canonicalCognitiveKernel\.beginDecisionCycle\(/,
  'the live runtime must send decision stages through the canonical kernel');
assert.match(runtime, /this\.canonicalCognitiveKernel\.completeCycle\(/,
  'the live runtime must close the action with outcome, learning and self-update stages');
assert.match(runtime, /const cycleLineage = cycleCompletion\.cycleLineage;/,
  'the runtime must consume causal verification from the same kernel completion');
assert.match(runtime, /cycleCompletion\.cycleResult \?\? \{/,
  'missing kernel completion must fail closed rather than invent a completed cycle');
assert.doesNotMatch(runtime, /this\.cognitiveEventFabric\.recordOperationalCycle\(/,
  'the live path must not retain the parallel manual stage writer');
assert.doesNotMatch(runtime, /this\.unifiedCycle\.evaluate\(/,
  'the live path must not independently evaluate a second cycle');

console.log('canonical-cognitive-kernel-runtime-wiring: PASS');
