import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = await readFile(path.join(root, 'src/organism/core/OrganismCore.ts'), 'utf8');
const fabric = await readFile(path.join(root, 'src/organism/memory/MemoryFabric.ts'), 'utf8');

const primaryStart = core.indexOf('const cognitionMemoryItems = observation.text && cognitiveExecutionPlan.run.memory');
assert.notEqual(primaryStart, -1, 'primary cognitive observation must be gated by the execution plan');
const retrievedStart = core.indexOf('const retrieved = cognitionMemoryItems.slice(0, 4);', primaryStart);
assert.ok(retrievedStart > primaryStart, 'the primary retrieval result must feed the cognition packet');
assert.match(core.slice(primaryStart, retrievedStart), /await this\.memorySubsystem\.fabric\.retrieveForCognition\(/,
  'primary observation retrieval must use the budgeted semantic adapter');

const queryStart = core.indexOf('const memoryQuery = observation.text || activeGoalPressureFallback');
assert.notEqual(queryStart, -1, 'cognition must derive a memory query from observation or active goal');
const strategyStart = core.indexOf('const adaptiveMemoryStrategyFrame =', queryStart);
assert.ok(strategyStart > queryStart, 'retrieval must produce the memory frame consumed by cognition');
const retrievalBlock = core.slice(queryStart, strategyStart);
assert.match(retrievalBlock, /!cognitiveExecutionPlan\.run\.memory\s*\?\s*\[\]/,
  'disabled memory execution must return an empty retrieval packet');
assert.match(retrievalBlock, /cognitionMemoryItems\.slice\(0,\s*4\)/,
  'an observation with a precomputed packet must reuse that packet rather than perform a second search');
assert.match(retrievalBlock, /await this\.memorySubsystem\.fabric\.retrieveForCognition\(/,
  'goal/fallback retrieval must use the same budgeted semantic adapter');
assert.doesNotMatch(retrievalBlock, /this\.memorySubsystem\.fabric\.retrieve\(/,
  'no synchronous MemoryFabric.retrieve bypass is allowed inside the cognitive retrieval block');

const methodStart = fabric.indexOf('async retrieveForCognition(');
assert.notEqual(methodStart, -1, 'MemoryFabric must own the semantic cognitive retrieval boundary');
const methodEnd = fabric.indexOf('\n  retrieve(query:', methodStart);
assert.ok(methodEnd > methodStart, 'semantic retrieval must end before the canonical synchronous fallback');
const method = fabric.slice(methodStart, methodEnd);
assert.match(method, /NK_EMBEDDINGS_RUNTIME_ENABLED/, 'semantic runtime use must remain explicit opt-in');
assert.match(method, /this\.memoryOS\.previewRetrieveWithEmbeddings\(/, 'semantic recall must use the canonical MemoryOS2 embedding adapter');
assert.match(method, /NK_EMBEDDINGS_RUNTIME_BUDGET_MS/, 'semantic work must have a bounded foreground budget');
assert.match(method, /outcome\.kind!=='complete'.*return fallback/s, 'timeout, busy, or failed semantic retrieval must preserve the lexical fallback');

console.log('WORKPASS497_SEMANTIC_RETRIEVAL_ROUTE=PASS', JSON.stringify({
  primaryAndGoalPathsUseCanonicalAdapter: true,
  disabledMemoryPlanFailsClosed: true,
  synchronousBypassRemoved: true,
  boundedSemanticOptInAndFallbackPreserved: true,
}));
