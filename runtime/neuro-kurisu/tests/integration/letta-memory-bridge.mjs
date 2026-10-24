import assert from 'node:assert/strict';
import { LettaMemoryBridge } from '../../src/organism/integration/letta/LettaMemoryBridge.ts';

function fakeClient() {
  const calls = { created: [], sessionOptions: [], prompts: [], closedSessions: 0, clientClosed: 0 };
  let nextResponse = 'Memory record accepted by test fake.';
  const client = {
    async createAgent(options) {
      calls.created.push(options);
      return 'agent-nk1-test';
    },
    resumeSession(agentId, options = {}) {
      assert.equal(agentId, 'agent-nk1-test');
      calls.sessionOptions.push(options);
      return {
        async ready() {},
        async send(prompt) {
          calls.prompts.push(prompt);
          nextResponse = prompt.includes('NK1_MEMORY_QUERY_JSON:')
            ? 'Candidate: record-1; source=unit-test; uncertainty=low.'
            : 'Stored at memory/experience/record-1.md';
        },
        async *stream() {
          yield { type: 'user', content: 'not a final answer' };
          yield { type: 'assistant', content: nextResponse };
        },
        async close() { calls.closedSessions += 1; },
      };
    },
    async close() { calls.clientClosed += 1; },
  };
  return { client, calls };
}

const { client, calls } = fakeClient();
const bridge = new LettaMemoryBridge({ enabled: true, client });

const initialRecall = await bridge.recall('initial query');
assert.equal(initialRecall.ok, true);
assert.equal(initialRecall.trust, 'untrusted-candidate');
assert.equal(calls.created.length, 1);
assert.equal(calls.created[0].memfs, true);
assert.deepEqual(calls.created[0].baseTools, []);
assert.deepEqual(calls.created[0].skillSources, []);
assert.equal(calls.created[0].hidden, true);
assert.equal(calls.created[0].systemInfoReminder, false);
assert.match(calls.created[0].systemPrompt, /persistent memory filesystem/i);
assert.deepEqual(calls.sessionOptions[0].allowedTools, ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'LS']);
assert.equal(calls.sessionOptions[0].permissionMode, 'acceptEdits');
assert.equal(calls.sessionOptions[0].filesystemConfinement, 'memory');
assert.deepEqual(calls.sessionOptions[0].skillSources, []);
assert.equal(calls.sessionOptions[0].systemInfoReminder, false);

const written = await bridge.recordExperience({
  id: 'record-1',
  source: 'unit-test',
  kind: 'observation',
  summary: 'Observed state transition; api_key=supersecretvalue123',
  confidence01: 0.7,
  tags: ['runtime'],
});
assert.equal(written.ok, true);
assert.equal(written.redacted, true);
assert.ok(!calls.prompts.at(-1).includes('supersecretvalue123'));
assert.ok(calls.prompts.at(-1).includes('[REDACTED_SECRET]'));
assert.equal(calls.created.length, 1, 'reuses persisted agent identity');
assert.equal(calls.closedSessions, 2);

const recalled = await bridge.recall('what happened in the test?', { maxResults: 3 });
assert.equal(recalled.ok, true);
assert.equal(recalled.trust, 'untrusted-candidate');
assert.equal(recalled.evidence, 'agent-response-unverified');
assert.match(recalled.response, /record-1/);
assert.ok(!recalled.response.includes('recallsecretvalue123'));
assert.ok(recalled.response.includes('[REDACTED_SECRET]'));
assert.equal(recalled.redacted, true);

const rejectedId = await bridge.recordExperience({
  id: 'api_key=secretvalue123',
  source: 'test',
  kind: 'observation',
  summary: 'id must not be rewritten to a shared redaction placeholder',
});
assert.equal(rejectedId.ok, false);
assert.equal(rejectedId.reason, 'sensitive-memory-id-rejected');

const snapshot = bridge.snapshot();
assert.equal(snapshot.agentId, 'agent-nk1-test');
assert.equal(snapshot.metrics.recordsSubmitted, 1);
const restored = new LettaMemoryBridge({ enabled: true, client });
restored.restore(snapshot);
assert.equal(restored.snapshot().agentId, 'agent-nk1-test');
assert.equal(restored.snapshot().metrics.recordsSubmitted, 1);

const disabled = new LettaMemoryBridge({ enabled: false, client });
const refused = await disabled.recordExperience({
  id: 'off', source: 'test', kind: 'observation', summary: 'must not connect',
});
assert.deepEqual(refused, { ok: false, reason: 'letta-disabled' });

await bridge.close();
assert.equal(calls.clientClosed, 0, 'does not close a caller-owned client');
console.log('LETTA_MEMORY_BRIDGE=PASS');
