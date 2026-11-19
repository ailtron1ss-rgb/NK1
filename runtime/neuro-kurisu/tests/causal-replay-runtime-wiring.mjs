import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const engine = await readFile(new URL('../src/organism/learning/P23LearningEngine.ts', import.meta.url), 'utf8');
assert.match(engine, /import\s+\{\s*selectCausalReplayBatch\s*\}\s+from\s+['"]\.\/CausalReplaySampler\.ts['"]/,
  'P23LearningEngine must import the causal replay sampler');

const replayAt = engine.indexOf('replayPending(traces:OrganismDecisionTrace[],policy:AdaptivePolicyEngine)');
assert.notEqual(replayAt, -1, 'production replayPending method must exist');

// Current production wiring derives a bounded feature vector from the immutable
// experience snapshot, with a compatibility fallback to the matched trace state.
// Assert semantics rather than requiring a brittle inline-array literal.
const candidateAt = engine.indexOf('const causalCandidates=ranked.map(item=>{', replayAt);
assert.ok(candidateAt > replayAt, 'ranked experiences must be converted into causal replay candidates');
const capacityAt = engine.indexOf('const adaptiveCapacity=', candidateAt);
assert.ok(capacityAt > candidateAt, 'causal candidate feature construction must finish before selection');
const builder = engine.slice(candidateAt, capacityAt);

assert.match(builder, /const exp=item\.experience;/);
assert.match(builder, /const trace=item\.trace;/);
assert.match(builder, /const needs=trace\.stateBefore\.needs;/);
assert.match(builder, /const policyFeatures01=exp\.replayFeatures01\s*\?\?\s*\[/,
  'new experiences must use their immutable stored replay feature snapshot');
assert.match(builder, /needs\.energy/);
assert.match(builder, /needs\.cognitiveLoad/);
assert.match(builder, /needs\.uncertainty/);
assert.match(builder, /needs\.socialNeed/);
assert.match(builder, /needs\.novelty/);
assert.match(builder, /needs\.identityCoherence/);
assert.match(builder, /needs\.goalPressure/);
assert.match(builder, /trace\.stateBefore\.predictionError/);
assert.match(builder, /trace\.stateBefore\.attentionBudget/);
assert.match(builder, /trace\.stateBefore\.autonomyScore/);
assert.match(builder, /trace\.stateBefore\.selfPredictionError/);
assert.match(builder, /trace\.stateBefore\.lastPredictionConfidence/);
assert.match(builder, /exp\.success/);
assert.match(builder, /exp\.reward/);
assert.match(builder, /exp\.surprise/);
assert.match(builder, /learningQuality/);
assert.match(builder, /policyFeatures01:policyFeatures01\.map\(clamp\)/,
  'the feature vector must be normalized before the sampler sees it');

const samplerAt = engine.indexOf('selectCausalReplayBatch(causalCandidates,{', capacityAt);
const finalSelectorAt = engine.indexOf('selectReplayBatch(causalCandidatesSelected,options)', samplerAt);
assert.ok(samplerAt > capacityAt, 'grounded candidates must be assembled before causal selection');
assert.ok(finalSelectorAt > samplerAt, 'the adaptive multi-signal selector must remain the final selector');
assert.match(engine.slice(capacityAt, finalSelectorAt), /maxBatchSize:/,
  'causal prefilter must have an explicit bounded capacity');
assert.match(engine.slice(capacityAt, finalSelectorAt), /recentQuota:/,
  'causal prefilter must preserve a bounded recency quota');

console.log('causal-replay-runtime-wiring: ok immutableSnapshot=true stateOutcomeGrounding=true boundedPrefilter=true adaptiveFinalSelector=true');
