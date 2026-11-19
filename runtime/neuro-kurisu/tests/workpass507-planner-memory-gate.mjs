import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(resolve(packageRoot, 'src/organism/core/OrganismCore.ts'), 'utf8');

// First-pass user-text recall is the baseline contract the advanced path must preserve.
const initialStart = core.indexOf(
  'const cognitionMemoryItems = observation.text && cognitiveExecutionPlan.run.memory',
);
assert.notEqual(initialStart, -1, 'the initial recall must be explicitly gated by the cognitive memory plan');
const initialEnd = core.indexOf('const retrieved = cognitionMemoryItems.slice(0, 4);', initialStart);
assert.notEqual(initialEnd, -1, 'the initial recall packet must have a visible boundary');
const initialRecall = core.slice(initialStart, initialEnd);
assert.match(initialRecall, /await this\.memorySubsystem\.fabric\.retrieveForCognition\(/,
  'the initial cognitive recall must use the bounded async MemoryFabric adapter');
assert.doesNotMatch(initialRecall, /this\.memorySubsystem\.fabric\.retrieve\(/,
  'the initial cognitive recall must not bypass the adapter');

// Internal-goal and empty-input fallback is part of the same cycle, so it must obey
// the same budget gate and the same semantic/lexical bounded retrieval boundary.
const queryMarker = "const memoryQuery = observation.text || activeGoalPressureFallback(this.persisted.goals) || 'current context';";
const advancedStart = core.indexOf(queryMarker);
assert.notEqual(advancedStart, -1, 'the advanced recall query must remain anchored to the current observation/goals');
const advancedEnd = core.indexOf('const adaptiveMemoryStrategyFrame =', advancedStart);
assert.notEqual(advancedEnd, -1, 'advanced recall must end before memory-strategy evaluation');
const advancedRecall = core.slice(advancedStart, advancedEnd);
assert.match(advancedRecall,
  /const advancedRetrieved = !cognitiveExecutionPlan\.run\.memory\s*\?\s*\[\]\s*:/,
  'a planner decision to skip memory must produce an empty advanced recall packet');
assert.match(advancedRecall, /cognitionMemoryItems\.slice\(0,\s*4\)/,
  'same-query recall must reuse the already budgeted initial packet');
assert.match(advancedRecall, /await this\.memorySubsystem\.fabric\.retrieveForCognition\(/,
  'a distinct internal-goal fallback query must use bounded cognitive retrieval');
assert.doesNotMatch(advancedRecall, /this\.memorySubsystem\.fabric\.retrieve\(/,
  'the advanced recall path must not bypass the async adapter or its lexical fallback');
assert.equal((advancedRecall.match(/const advancedRetrieved\s*=/g) ?? []).length, 1,
  'the advanced recall packet must be computed once per cognitive cycle');

console.log('WorkPass507 planner memory-gate contract: PASS');
