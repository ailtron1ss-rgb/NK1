import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
assert.match(runtime, /import\s+\{\s*resolveCognitiveRoutingPolicy\s*\}\s+from\s+['"]\.\/CognitiveRoutingPolicy\.ts['"]/,
  'OrganismRuntime must import the canonical bounded routing policy');
assert.match(runtime, /resolveCognitiveRoutingPolicy\(dependencyState,\s*resourceAllocation\.maxCounterfactualBranches\)/,
  'the policy must consume the live dependency state and upstream resource budget');
assert.match(runtime, /simBudget\s*=\s*routingPolicy\.maxCounterfactualBranches\s*>\s*0\s*\?/,
  'a zero routed budget must avoid reserving simulation work');
assert.match(runtime, /counterfactuals\.imagine\([^\n]+routingPolicy\.maxCounterfactualBranches/,
  'speculative branch generation must use the reduced routed budget');
assert.match(runtime, /routingPolicy\.allowMatchedCounterfactual\s*\?/,
  'optional matched alternate projections must obey routing admission');
assert.match(runtime, /id:\s*'cognitive',\s*initialDelayMs:\s*0,[\s\S]{0,700}resolveCognitiveRoutingPolicy\(this\.cognitiveDependencyGraph\.snapshot\(\),\s*3\)/,
  'the live cognitive clock must consult the last resolved dependency graph');
assert.match(runtime, /p\.nextDelayMs\s*\*\s*cognitiveRouting\.cognitiveCycleDelayMultiplier01/,
  'non-resource interrupts must be able to shorten the next cognitive cycle');
assert.match(runtime, /'cognitive-interrupt'/,
  'interrupt-accelerated cycles must explain the scheduler reason');
assert.match(runtime, /const worldAction\s*=\s*plan\.steps\[0\]\?\.environmentAction\s*\?\?\s*'observe'/,
  'the route adapter must not replace canonical planned action selection');

console.log('Cognitive routing policy runtime wiring: PASS');
