import assert from 'node:assert/strict';
import { IntentCompiler } from '../src/organism/system/IntentCompiler.ts';

const compiler = new IntentCompiler();
const extraction = {
  goal: 'Create a concise project status report',
  context: 'NeuroCore development',
  constraints: ['Do not merge or publish'],
  priorities: ['Accuracy', 'Traceability'],
  expectedResult: 'A Markdown report with evidence links',
  acceptanceCriteria: ['Includes current commit', 'Separates implemented from tested'],
  allowedToolIds: ['repo.read'],
  forbiddenToolIds: ['repo.write', 'release.publish'],
  stopConditions: ['Stop if repository evidence is unavailable'],
  assumptions: ['The working source branch is authoritative for this task'],
  risk: 'low',
};
const compiled = compiler.compile('Inspect the project and prepare a report', extraction, 1234);
assert.equal(compiled.executable, true);
assert.equal(compiled.contract.status, 'ready');
assert.equal(compiled.contract.createdAt, 1234);
assert.deepEqual(compiled.contract.assumptions, extraction.assumptions);

const unclear = compiler.compile('Do the thing', {
  goal: '', expectedResult: '', acceptanceCriteria: [], allowedToolIds: [],
  stopConditions: [], unresolvedQuestions: ['Which repository?'],
});
assert.equal(unclear.executable, false);
assert.equal(unclear.contract.status, 'needs-clarification');
assert.equal(unclear.contract.risk, 'high');
assert.equal(unclear.contract.requiresConfirmation, true);

const conflict = compiler.compile('Do something', {
  ...extraction, allowedToolIds: ['repo.read'], forbiddenToolIds: ['repo.read'],
});
assert.equal(conflict.contract.status, 'blocked');
assert.ok(conflict.contract.diagnostics.includes('allow-deny-list-conflict'));

let calls = 0;
let received;
const gateway = {
  async executeTool(...args) {
    calls += 1;
    received = args;
    return { ok: true, verified: true, executionId: 'exec-1', tool: args[0], capability: 'read', result: {}, audit: {}, verification: {}, outcomeClass: 'executed-verified' };
  },
};
const notAllowed = await compiler.executeTool(gateway, compiled.contract, 'repo.write', {}, 'test');
assert.equal(notAllowed.ok, false);
assert.equal(notAllowed.reason, 'tool-not-explicitly-allowed');
assert.equal(calls, 0);

const allowed = await compiler.executeTool(gateway, compiled.contract, 'repo.read', {}, 'test', { idempotencyKey: 'stable-key' });
assert.equal(allowed.ok, true);
assert.equal(calls, 1);
assert.equal(received[3].decisionId, compiled.contract.id);
assert.equal(received[3].idempotencyKey, 'stable-key');

const highRisk = compiler.compile('Delete data', { ...extraction, risk: 'critical' });
const unconfirmed = await compiler.executeTool(gateway, highRisk.contract, 'repo.read', {}, 'test');
assert.equal(unconfirmed.ok, false);
assert.equal(unconfirmed.reason, 'intent-confirmation-required');
assert.equal(calls, 1);
const confirmed = await compiler.executeTool(gateway, highRisk.contract, 'repo.read', {}, 'test', { confirmedIntentId: highRisk.contract.id });
assert.equal(confirmed.ok, true);
assert.equal(calls, 2);

console.log('NK1_INTENT_COMPILER=PASS compile=bounded gate=fail-closed confirmation=separate-from-tool-approval');
