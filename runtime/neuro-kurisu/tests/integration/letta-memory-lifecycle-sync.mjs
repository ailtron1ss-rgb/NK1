import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../../src/organism/core/MemorySubsystemRuntime.ts';

function makeClient() {
  const state = { createOptions: [], sessionOptions: [], prompts: [], closedSessions: 0 };
  const client = {
    async createAgent(options) {
      state.createOptions.push(options);
      return 'agent-lifecycle-test';
    },
    resumeSession(agentId, options = {}) {
      assert.equal(agentId, 'agent-lifecycle-test');
      state.sessionOptions.push(options);
      return {
        async ready() {},
        async send(prompt) { state.prompts.push(prompt); },
        async *stream() { yield { type: 'assistant', content: 'Fake provider acknowledged this request; no durability is implied.' }; },
        async close() { state.closedSessions += 1; },
      };
    },
  };
  return { client, state };
}

const { client, state } = makeClient();
const runtime = new MemorySubsystemRuntime({ letta: { enabled: true, client } });

// Restore is intentionally suppressed from mirroring: boot-time compatibility
// reconstruction must not bulk-export historical memories to an external store.
runtime.restoreFromPersisted({ memory: {}, advanced: {} });
assert.equal(state.prompts.length, 0);

const item = runtime.fabric.encode({
  content: 'Kurisu retained a controlled memory lifecycle test.',
  kind: 'episodic',
  tags: ['integration-test'],
  context: { testRun: 'workpass328' },
  salience: 0.7,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.1,
  socialRelevance: 0.0,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  source: 'unit-test',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
});
assert.ok(item?.id);
await runtime.flushLettaMemorySync();
assert.equal(state.createOptions.length, 1);
assert.deepEqual(state.createOptions[0].baseTools, []);
assert.ok(state.sessionOptions[0].allowedTools.includes('Write'));
assert.equal(state.sessionOptions[0].filesystemConfinement, 'memory');
assert.ok(state.prompts.some((prompt) => prompt.includes('NK1_MEMORY_RECORD_JSON:')));
assert.ok(state.prompts.some((prompt) => prompt.includes('Kurisu retained a controlled memory lifecycle test.')));
assert.equal(runtime.lettaBridge.snapshot().metrics.lifecycleUpserts, 1);

const canonicalCountBeforeRecall = runtime.memoryOS.size();
const hybridRecall = await runtime.retrieveForCognitionWithLettaCandidates('controlled memory lifecycle test', { limit: 3 });
assert.ok(Array.isArray(hybridRecall.canonicalRecords));
assert.equal(hybridRecall.externalStatus.status, 'candidate-available');
assert.equal(hybridRecall.externalCandidate.trust, 'untrusted-candidate');
assert.equal(hybridRecall.externalCandidate.evidence, 'agent-response-unverified');
assert.equal(runtime.memoryOS.size(), canonicalCountBeforeRecall, 'Letta recall must not write into canonical memory');
assert.equal(state.prompts.length, 2);

// An explicit non-event write remains native-only and does not leak to Letta.
runtime.fabric.encode({
  content: 'This deliberately suppresses lifecycle notification.',
  kind: 'episodic',
  tags: [],
  context: {},
  salience: 0.4,
  emotionalWeight: 0.0,
  identityRelevance: 0.0,
  goalRelevance: 0.0,
  socialRelevance: 0.0,
  predictionError: 0.0,
  confidence: 0.8,
  epistemicStatus: 'fact',
  source: 'unit-test',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
}, { emitEvent: false });
await runtime.flushLettaMemorySync();
assert.equal(state.prompts.length, 2);

assert.equal(runtime.fabric.forgetById(item.id, 'test-forget'), true);
await runtime.flushLettaMemorySync();
assert.equal(state.prompts.length, 3);
assert.ok(state.prompts[2].includes('Canonical NK1 memory lifecycle event: FORGET.'));
assert.ok(state.prompts[2].includes(item.id));
assert.equal(runtime.lettaBridge.snapshot().metrics.forgetRequests, 1);
assert.equal(runtime.lettaBridge.snapshot().metrics.forgetResponsesReceived, 1);

await runtime.close();
console.log('LETTA_MEMORY_LIFECYCLE_SYNC=PASS');
