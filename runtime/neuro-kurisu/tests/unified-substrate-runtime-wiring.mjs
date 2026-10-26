import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  UnifiedCognitiveSubstrate,
  defaultUnifiedCognitiveSubstrate,
  resolveUnifiedCognitiveWorkPolicy,
} from '../src/organism/core/UnifiedCognitiveSubstrate.ts';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
assert.ok(runtime.includes("import { UnifiedCognitiveSubstrate, type UnifiedCognitiveSubstrateState, resolveUnifiedCognitiveWorkPolicy } from './UnifiedCognitiveSubstrate.ts'"));
assert.match(runtime, /private readonly unifiedCognitiveSubstrate = new UnifiedCognitiveSubstrate\(\)/);
assert.match(runtime, /FileStateStore<UnifiedCognitiveSubstrateState>\(\x60\$\{config\.stateFile\}\.cognitive-substrate\.json\x60\)/);
assert.match(runtime, /unifiedCognitiveSubstrate\.restore\(await this\.unifiedCognitiveSubstrateStore\.load\(\) \?\? undefined\)/);
assert.match(runtime, /unifiedCognitiveSubstrate\.integrate\(/);
assert.match(runtime, /unifiedCognitiveSubstrateStore\.save\(substrateState\)/);
assert.match(runtime, /unifiedCognitiveSubstrateStore\.save\(this\.unifiedCognitiveSubstrate\.snapshot\(\)\)/);
assert.match(runtime, /runtime\.unified-cognitive-substrate\.restore-failed/);
assert.match(runtime, /runtime\.unified-cognitive-substrate\.integrate-rejected/);
assert.match(runtime, /substrateWorkPolicy\.maxCounterfactualBranches/);
assert.match(runtime, /substrateWorkPolicy\.allowMatchedCounterfactual/);
assert.match(runtime, /unifiedCognitiveSubstrateSnapshot\(\)/);
assert.ok(!runtime.includes('substrateWorkPolicy.maxCounterfactualBranches, internalAction'));

const fallback = resolveUnifiedCognitiveWorkPolicy(defaultUnifiedCognitiveSubstrate(), 3);
assert.ok(fallback.maxCounterfactualBranches <= 1);
assert.equal(fallback.allowMatchedCounterfactual, false);
const grounded = new UnifiedCognitiveSubstrate();
const frame = grounded.integrate({
  tick: 1,
  self: { continuity01: .9, coherence01: .9, agency01: .9, realityAlignment01: .9, mode: 'plan', lastAction: 'verify' },
  world: { confidence01: .9, uncertainty01: .2, entityCount: 8, eventCount: 10, relationCount: 6, conflict01: .1, newEntityRate01: .2 },
  prediction: { error01: .1, openCount: 1, agingCount: 0, expiredCount: 0, priority01: .2 },
  resources: { battery01: .9, thermal01: .2, ramPressure01: .2, computeCapacity01: .9, scarcity01: .1, efficiency01: .9 },
  memoryPressure01: .2, evidenceCoverage01: .9, realObservationCoverage01: .8, unknown01: .1,
});
const policy = resolveUnifiedCognitiveWorkPolicy(frame, 3);
assert.equal(policy.maxCounterfactualBranches, 3);
assert.equal(policy.allowMatchedCounterfactual, true);
console.log('UNIFIED_SUBSTRATE_RUNTIME_WIRING=PASS');
