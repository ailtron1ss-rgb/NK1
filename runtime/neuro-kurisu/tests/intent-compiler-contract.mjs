import assert from 'node:assert/strict';
import { IntentCompiler } from '../src/organism/cognition/IntentCompiler.ts';
import { IntentActionGatewayBridge } from '../src/organism/system/IntentActionGatewayBridge.ts';

const compiler = new IntentCompiler({ clock: () => 1_800_000_000_000 });
let extractedText = '';
const providerContract = await compiler.compileWith({ text: 'Summarize the latest verified state.' }, {
  async extract(text) {
    extractedText = text;
    return { goal: 'Summarize verified state', expectedOutcome: 'A grounded summary', acceptanceCriteria: ['Cite the inspected revision'], permissions: { allowedActions: ['organism.inspect'] } };
  },
});
assert.equal(extractedText, 'Summarize the latest verified state.');
assert.equal(providerContract.goal.source, 'structured-extraction');
assert.equal(providerContract.goal.text, 'Summarize verified state');
const ambiguous = compiler.compile({
  requestId: 'intent:test:ambiguous',
  text: 'Please delete old project data and prepare a report.',
});
assert.equal(ambiguous.goal.text, 'Please delete old project data and prepare a report.');
assert.equal(ambiguous.risk.level, 'high', 'destructive language must raise risk without granting permission');
const riskCannotBeDowngraded = compiler.compile({ text: 'Delete the production database', extraction: { risk: 'low' } });
assert.equal(riskCannotBeDowngraded.risk.level, 'high', 'an extraction must not downgrade risk implied by the request');
assert.throws(() => compiler.approve(ambiguous, { userConfirmed: true, allowedActions: [], at: 1_800_000_000_001, evidenceRef: 'incomplete-contract' }), /incomplete/);
assert.deepEqual(ambiguous.permissions.allowedActions, [], 'free text must never become an execution allow-list');
assert.equal(ambiguous.approval.status, 'not-approved');
assert.equal(compiler.gate(ambiguous, 'filesystem.delete').allowed, false);
assert.throws(() => compiler.approve(ambiguous, { userConfirmed: true, allowedActions: [], at: 1_800_000_000_001, evidenceRef: 'incomplete' }), /incomplete/);
const riskCannotBeDowngraded = compiler.compile({ text: 'Delete the production database', extraction: { risk: 'low' } });
assert.equal(riskCannotBeDowngraded.risk.level, 'high', 'semantic extraction must not downgrade deterministic high-risk signals');

const contract = compiler.compile({
  requestId: 'intent:test:bounded',
  text: 'Inspect the project status and summarize the result.',
  extraction: {
    goal: 'Inspect project status and summarize it.',
    context: ['NK1 working tree'],
    constraints: { must: ['Do not modify files'], mustNot: ['Do not publish or deploy'] },
    priorities: ['Correctness', 'Preserve source branch'],
    expectedOutcome: 'A concise status report',
    acceptanceCriteria: ['Report branch and commit', 'Do not change repository state'],
    permissions: { allowedActions: ['organism.inspect'], deniedActions: ['filesystem.write', 'deploy'] },
    assumptions: [{ statement: 'The current branch is the intended inspection target', impact: 'medium', confidence01: 0.6 }],
    stopConditions: ['Stop if the source branch cannot be identified'],
    risk: 'low',
  },
});
assert.equal(contract.goal.text, 'Inspect project status and summarize it.');
assert.equal(contract.goal.source, 'structured-extraction');
assert.equal(contract.assumptions[0].requiresConfirmation, true);
assert.equal(compiler.gate(contract, 'organism.inspect').reason, 'contract-not-approved');

const approved = compiler.approve(contract, {
  userConfirmed: true,
  allowedActions: ['organism.inspect'],
  at: 1_800_000_000_001,
  evidenceRef: 'user-confirmation:intent:test:bounded',
});
assert.equal(compiler.gate(approved, 'organism.inspect').allowed, true);
assert.equal(compiler.gate(approved, 'filesystem.write').reason, 'action-not-explicitly-allowed');
assert.equal(compiler.gate(approved, 'deploy').reason, 'action-explicitly-denied');
assert.throws(() => compiler.approve(contract, {
  userConfirmed: true, allowedActions: ['deploy'], at: 1_800_000_000_001, evidenceRef: 'forged-expansion',
}), /not explicitly allowed/);

let calls = 0;
const decisionIds = [];
const gateway = {
  async executeTool(id, input, reason, options) {
    calls += 1;
    assert.equal(id, 'organism.inspect');
    assert.deepEqual(input, { scope: 'project' });
    assert.equal(reason, 'intent-bridge-test');
    decisionIds.push(options.decisionId);
    if (calls === 1) assert.equal(options.decisionId, 'decision:intent:test');
    return { ok: true, verified: true, tool: id, outcomeClass: 'executed-verified' };
  },
};
const bridge = new IntentActionGatewayBridge(compiler);
const denied = await bridge.execute(contract, { toolId: 'organism.inspect', input: {}, reason: 'denied' }, gateway);
assert.equal(denied.executed, false);
assert.equal(calls, 0, 'unapproved contracts must not reach ActionGateway');

const executed = await bridge.execute(approved, {
  toolId: 'organism.inspect', input: { scope: 'project' }, reason: 'intent-bridge-test',
  options: { decisionId: 'decision:intent:test' },
}, gateway);
assert.equal(executed.executed, true);
assert.equal(executed.result.ok, true);
assert.equal(calls, 1, 'approved allowed actions must pass through ActionGateway exactly once');

const defaultLineage = await bridge.execute(approved, {
  toolId: 'organism.inspect', input: { scope: 'project' }, reason: 'intent-bridge-test',
}, { async executeTool(_id, _input, _reason, options) {
  assert.equal(options.decisionId, approved.id, 'bridge must bind gateway decision lineage to the intent contract');
  return { ok: true, verified: true, tool: 'organism.inspect', outcomeClass: 'executed-verified' };
} });
assert.equal(defaultLineage.executed, true);

console.log('NK1_INTENT_COMPILER=PASS conservativePermissions=true explicitApproval=true gatewayGate=true');
