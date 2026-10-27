import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const engine = await readFile(new URL('../src/organism/learning/P23LearningEngine.ts', import.meta.url), 'utf8');
assert.match(engine, /import\s+\{\s*selectCausalReplayBatch\s*\}\s+from\s+['"]\.\/CausalReplaySampler\.ts['"]/,
  'P23LearningEngine must import the causal replay sampler');

const replayAt = engine.indexOf('replayPending(traces:OrganismDecisionTrace[],policy:AdaptivePolicyEngine)');
assert.notEqual(replayAt, -1, 'production replayPending method must exist');
const samplerAt = engine.indexOf('selectCausalReplayBatch(causalCandidates', replayAt);
const finalSelectorAt = engine.indexOf('selectReplayBatch(causalCandidatesSelected,options)', replayAt);
assert.ok(samplerAt > replayAt, 'causal selection must run in the production replayPending path');
assert.ok(finalSelectorAt > samplerAt, 'the adaptive multi-signal selector must remain the final selector');
const vectorAt = engine.indexOf('policyFeatures01:[', replayAt);
assert.ok(vectorAt > replayAt && vectorAt < samplerAt, 'causal sampler candidates must be grounded in state/outcome features before sampling');
const vectorEnd = engine.indexOf('],', vectorAt);
assert.ok(vectorEnd > vectorAt, 'causal feature vector must be closed');
const vector = engine.slice(vectorAt, vectorEnd);
assert.match(vector, /needs\.energy/);
assert.match(vector, /needs\.goalPressure/);
assert.match(vector, /trace\.outcome\?\.success/);
assert.match(engine.slice(samplerAt, finalSelectorAt), /maxBatchSize:/,
  'causal prefilter must have an explicit bounded capacity');

console.log('causal-replay-runtime-wiring: ok');
