import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = await readFile(path.join(root, 'src/organism/core/OrganismCore.ts'), 'utf8');
const fabric = await readFile(path.join(root, 'src/organism/memory/MemoryFabric.ts'), 'utf8');

const queryStart = core.indexOf('const memoryQuery = observation.text');
assert.notEqual(queryStart, -1, 'live observation cycle must derive the canonical memory query');
const strategyStart = core.indexOf('const adaptiveMemoryStrategyFrame', queryStart);
assert.notEqual(strategyStart, -1, 'the cognition cycle must consume a bounded memory packet');
const retrievalBlock = core.slice(queryStart, strategyStart);
assert.match(retrievalBlock, /await this\.memorySubsystem\.fabric\.retrieveForCognition\(/,
  'the live cognitive cycle must call the async, budgeted semantic-retrieval adapter');
const firstRetrievalStart = core.indexOf('const cognitionMemoryItems = observation.text && cognitiveExecutionPlan.run.memory');
assert.notEqual(firstRetrievalStart, -1, 'the first text recall must also respect the planner memory gate');
assert.match(retrievalBlock, /const advancedRetrieved = !cognitiveExecutionPlan\.run\.memory\s*\?\s*\[\]\s*:/,
  'when the planner disables memory, the advanced/fallback recall path must return an empty packet');
assert.doesNotMatch(retrievalBlock, /this\.memorySubsystem\.fabric\.retrieve\(/,
  'the live cycle must not bypass the semantic-retrieval adapter with the synchronous path');

const methodStart = fabric.indexOf('async retrieveForCognition(');
assert.notEqual(methodStart, -1, 'MemoryFabric must own the semantic cognitive retrieval boundary');
const methodEnd = fabric.indexOf('\n  retrieve(query:', methodStart);
assert.notEqual(methodEnd, -1, 'semantic retrieval must end before the canonical synchronous fallback');
const method = fabric.slice(methodStart, methodEnd);
assert.match(method, /NK_EMBEDDINGS_RUNTIME_ENABLED/,
  'semantic runtime use must remain explicit opt-in');
assert.match(method, /this\.memoryOS\.previewRetrieveWithEmbeddings\(/,
  'semantic recall must use the canonical MemoryOS2 embedding adapter');
assert.match(method, /NK_EMBEDDINGS_RUNTIME_BUDGET_MS/,
  'semantic work must have a bounded foreground budget');
assert.match(method, /outcome\.kind!=='complete'.*return fallback/s,
  'slow, busy, or failed semantic retrieval must preserve deterministic lexical fallback');

console.log('WORKPASS502_LIVE_COGNITIVE_SEMANTIC_RETRIEVAL=PASS', JSON.stringify({
  observeRoutesThroughSemanticAdapter: true,
  semanticRuntimeOptIn: true,
  boundedForegroundBudget: true,
  lexicalFallbackPreserved: true,
}));
