import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const runtime = await readFile(resolve('src/organism/core/OrganismRuntime.ts'), 'utf8');
const core = await readFile(resolve('src/organism/core/OrganismCore.ts'), 'utf8');
assert.match(runtime, /new HyperPlasticRuntimeBridge\(new HyperPlasticNetwork\(research\.network\)\)/);
assert.match(runtime, /this\.core\.b292CognitiveStateBusSnapshot\(\)/);
assert.match(runtime, /hyperPlasticBudgetPortFromCore\(this\.core\)/);
assert.match(runtime, /proposeHyperPlasticShadowCandidate\(cycle, internalAction, Boolean\(externalText\)\)/);
assert.match(runtime, /activation: 'shadow-only'/);
assert.match(core, /cognitiveBudgetEstimateCost\(/);
assert.match(core, /b292CognitiveStateBusSnapshot\(\)/);
assert.match(runtime, /hyperPlasticResearch\?\.enabled === true/);
assert.match(runtime, /ome26-requires-real-sha256-base-model-fingerprint/);
assert.match(runtime, /cadenceTicks < 8/);
assert.match(runtime, /cadenceTicks % 2 !== 0/);
assert.match(runtime, /b292\.tick !== cycle\.state\.tick/);
assert.match(runtime, /expectedTick: cycle\.state\.tick/);
assert.match(runtime, /minNovelty01/);
console.log('OME26_RUNTIME_INTEGRATION=PASS', JSON.stringify({
  canonicalB292:true, canonicalBudgetOwner:true, disabledByDefault:true, cycleHook:true, liveActivation:false,
}));
