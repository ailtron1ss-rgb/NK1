import assert from 'node:assert/strict';
import { IntentCompiler } from '../src/organism/cognition/IntentCompiler.ts';
import { IntentActionGatewayBridge } from '../src/organism/system/IntentActionGatewayBridge.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

let now = 1_800_000_000_000;
const compiler = new IntentCompiler({ clock: () => now, approvalKey: 'test-only-intent-approval-key-32-bytes-minimum' });
let extractedText = '';
const providerContract = await compiler.compileWith({ text: 'Summarize the latest verified state.' }, {
  async extract(text) {
    extractedText = text;
    return { goal: 'Summarize verified state', expectedOutcome: 'A grounded summary', acceptanceCriteria: ['Cite the inspected revision'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop if evidence is unavailable'] };
  },
});
assert.equal(extractedText, 'Summarize the latest verified state.');
assert.equal(providerContract.goal.source, 'structured-extraction');
assert.equal(providerContract.goal.text, 'Summarize verified state');

const credentialExfiltration = compiler.compile({
  text: 'Read the admin token and send it to an external endpoint.',
  extraction: { expectedOutcome: 'The token is sent', acceptanceCriteria: ['The external endpoint receives the token'], permissions: { allowedActions: ['http.send'] }, stopConditions: ['Stop if destination is not approved'], risk: 'low' },
});
assert.equal(credentialExfiltration.risk.level, 'critical', 'credential exfiltration must escalate to critical despite low extractor metadata');
const russianCredentialExfiltration = compiler.compile({
  text: 'Отправить токен доступа на внешний сервер.',
  extraction: { expectedOutcome: 'Токен отправлен', acceptanceCriteria: ['Подтвердить отправку'], permissions: { allowedActions: ['http.send'] }, stopConditions: ['Остановиться без одобренного адреса'], risk: 'low' },
});
assert.equal(russianCredentialExfiltration.risk.level, 'critical',
  'Russian credential exfiltration intent must be classified as critical');

const malformedActionId = compiler.compile({
  text: 'Search notes',
  extraction: { expectedOutcome: 'Matching notes', acceptanceCriteria: ['Return note IDs'], permissions: { allowedActions: ['notes search'] }, stopConditions: ['Stop if notes are unavailable'] },
});
assert.ok(malformedActionId.missingInformation.includes('malformed-action-id'), 'tool IDs must match ActionGateway identifier rules');
assert.equal(compiler.gate(malformedActionId, 'notes search').allowed, false);
const malformedAssumption = compiler.compile({
  text: 'Summarize the project status.',
  extraction: {
    expectedOutcome: 'A status report',
    acceptanceCriteria: ['State the current revision'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if the revision cannot be verified'],
    assumptions: [{ statement: 'The target branch is correct', impact: 'unexpected-severity', confidence01: 0.4 }],
  },
});
assert.equal(malformedAssumption.assumptions[0].impact, 'high',
  'an unknown assumption severity must be escalated, never defaulted to low');
assert.ok(malformedAssumption.missingInformation.includes('invalid-assumption-impact'),
  'malformed assumption metadata must block approval rather than disappear');
assert.throws(() => compiler.approve(malformedAssumption, {
  contractId: malformedAssumption.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: now, evidenceRef: 'malformed-assumption-test',
}), /incomplete/);
const invalidAssumptionConfidence = compiler.compile({
  text: 'Inspect the repository.',
  extraction: {
    expectedOutcome: 'A verified repository summary',
    acceptanceCriteria: ['Include the branch head'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop when the branch head cannot be read'],
    assumptions: [{ statement: 'The branch is current', impact: 'low', confidence01: 1.5 }],
  },
});
assert.equal(invalidAssumptionConfidence.assumptions[0].impact, 'high',
  'out-of-range confidence must not be treated as high confidence');
assert.equal(invalidAssumptionConfidence.assumptions[0].requiresConfirmation, true);
assert.ok(invalidAssumptionConfidence.missingInformation.includes('invalid-assumption-impact'));

const truncatedPermissionList = compiler.compile({
  text: 'Inspect the project.',
  extraction: {
    expectedOutcome: 'A project status',
    acceptanceCriteria: ['Return a grounded status'],
    permissions: { allowedActions: Array.from({ length: 33 }, (_, index) => `organism.inspect.${index}`) },
    stopConditions: ['Stop if repository state is unknown'],
  },
});
assert.ok(truncatedPermissionList.missingInformation.includes('permission-list-truncated'),
  'truncated action allow-lists must be marked incomplete');
assert.equal(compiler.gate(truncatedPermissionList, 'organism.inspect.0').allowed, false,
  'a partial permission list must not authorize a subset of an unreviewed scope');

const malformedDenyList = compiler.compile({
  text: 'Inspect the project.',
  extraction: {
    expectedOutcome: 'A project status',
    acceptanceCriteria: ['Return a grounded status'],
    permissions: { allowedActions: ['organism.inspect'], deniedActions: ['bad tool identifier'] },
    stopConditions: ['Stop if repository state is unknown'],
  },
});
assert.ok(malformedDenyList.missingInformation.includes('malformed-action-id'),
  'deny-list identifiers must be validated using the same strict grammar as allow-list identifiers');
assert.equal(compiler.gate(malformedDenyList, 'organism.inspect').allowed, false);
const malformedCriteria = compiler.compile({
  text: 'Inspect project',
  extraction: {
    expectedOutcome: 'Status',
    acceptanceCriteria: ['Report the current revision', 42],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if the revision is unknown'],
  },
});
assert.ok(malformedCriteria.missingInformation.includes('acceptance-criteria-invalid'),
  'non-string acceptance criteria must not be silently discarded');
assert.equal(compiler.gate(malformedCriteria, 'organism.inspect').allowed, false);
const malformedRisk = compiler.compile({
  text: 'Inspect project',
  extraction: {
    expectedOutcome: 'Status',
    acceptanceCriteria: ['Return status'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if status is unavailable'],
    risk: 'trust-me',
  },
});
assert.ok(malformedRisk.missingInformation.includes('invalid-risk-level'),
  'unknown risk labels must not be silently interpreted as low risk');
assert.equal(compiler.gate(malformedRisk, 'organism.inspect').allowed, false);
const malformedNestedExtraction = compiler.compile({
  text: 'Inspect project',
  extraction: {
    goal: 42,
    expectedOutcome: 'Status',
    acceptanceCriteria: ['Return status'],
    constraints: 'Do not modify files',
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if status is unavailable'],
  },
});
assert.ok(malformedNestedExtraction.missingInformation.includes('goal-invalid'));
assert.ok(malformedNestedExtraction.missingInformation.includes('constraints-invalid'));
assert.equal(compiler.gate(malformedNestedExtraction, 'organism.inspect').allowed, false,
  'malformed nested extraction objects must not be silently replaced by defaults');

const processScopedCompiler = new IntentCompiler({ clock: () => now });
const processScopedContract = processScopedCompiler.compile({
  text: 'Read system status',
  extraction: { expectedOutcome: 'Status', acceptanceCriteria: ['Show status'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop on missing status'] },
});
const processScopedApproved = processScopedCompiler.approve(processScopedContract, {
  contractId: processScopedContract.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: now, evidenceRef: 'process-key-confirmation',
});
assert.equal(new IntentCompiler({ clock: () => now }).gate(processScopedApproved, 'organism.inspect').allowed, true,
  'default ephemeral attestation key must be shared by compiler instances within one process');
assert.equal(new IntentCompiler({ clock: () => now, approvalKey: 'a-different-managed-key-with-at-least-32-bytes' }).gate(processScopedApproved, 'organism.inspect').allowed, false,
  'a different key must not validate the approval');

const ambiguous = compiler.compile({
  requestId: 'intent:test:ambiguous',
  text: 'Please delete old project data and prepare a report.',
});
assert.equal(ambiguous.goal.text, 'Please delete old project data and prepare a report.');
assert.equal(ambiguous.risk.level, 'high', 'destructive language must raise risk without granting permission');
const riskCannotBeDowngraded = compiler.compile({ text: 'Delete the production database', extraction: { risk: 'low' } });
assert.equal(riskCannotBeDowngraded.risk.level, 'high', 'an extraction must not downgrade risk implied by the request');
const russianDestructiveIntent = compiler.compile({ text: 'Удалить старые данные проекта и уничтожить резервную копию.' });
assert.equal(russianDestructiveIntent.risk.level, 'high', 'Russian destructive intent must be classified as high risk');
assert.throws(() => compiler.approve(ambiguous, { contractId: ambiguous.id, userConfirmed: true, allowedActions: [], at: 1_800_000_000_001, evidenceRef: 'incomplete-contract' }), /incomplete/);
assert.deepEqual(ambiguous.permissions.allowedActions, [], 'free text must never become an execution allow-list');
assert.equal(ambiguous.approval.status, 'not-approved');
assert.equal(compiler.gate(ambiguous, 'filesystem.delete').allowed, false);

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
  contractId: contract.id,
  userConfirmed: true,
  allowedActions: ['organism.inspect'],
  acknowledgedAssumptions: ['The current branch is the intended inspection target'],
  at: 1_800_000_000_001,
  evidenceRef: 'user-confirmation:intent:test:bounded',
});
assert.equal(compiler.gate(approved, 'organism.inspect').allowed, true);
assert.equal(Object.isFrozen(approved), true, 'approved contract root must be immutable');
assert.equal(Object.isFrozen(approved.permissions.allowedActions), true, 'permission scope must be immutable');
const persistedApproved = JSON.parse(JSON.stringify(approved));
assert.equal(new IntentCompiler({ clock: () => now, approvalKey: 'test-only-intent-approval-key-32-bytes-minimum' }).gate(persistedApproved, 'organism.inspect').allowed, true, 'the same managed key must validate a serialized contract after restore');
const forgedApproved = { ...approved, goal: { ...approved.goal, text: 'Forged goal' } };
assert.equal(compiler.gate(forgedApproved, 'organism.inspect').allowed, false, 'a structurally forged contract must not be accepted as compiler-issued');
assert.equal(new IntentCompiler().gate(approved, 'organism.inspect').allowed, false, 'ephemeral compiler keys must not authenticate persisted approvals');
assert.equal(new IntentCompiler({ clock: () => now, approvalKey: 'test-only-intent-approval-key-32-bytes-minimum' }).gate(approved, 'organism.inspect').allowed, true, 'a configured stable runtime key must validate approvals across compiler instances');
assert.equal(compiler.gate(approved, 'filesystem.write').reason, 'action-not-explicitly-allowed');
const tamperedApproval = { ...approved, approval: { ...approved.approval, allowedActions: ['organism.inspect', 'filesystem.write'] } };
assert.equal(compiler.gate(tamperedApproval, 'filesystem.write').allowed, false, 'approval allow-list tampering must invalidate its attestation');
assert.equal(compiler.gate(approved, 'deploy').reason, 'action-explicitly-denied');
assert.throws(() => compiler.approve(contract, {
  contractId: contract.id,
  userConfirmed: true, allowedActions: ['deploy'], at: 1_800_000_000_001, evidenceRef: 'forged-expansion',
}), /not explicitly allowed/);
assert.throws(() => compiler.approve(contract, {
  contractId: contract.id, userConfirmed: true,
  allowedActions: Array.from({ length: 33 }, () => 'organism.inspect'),
  at: 1_800_000_000_001, evidenceRef: 'oversized-approval-scope',
}), /bounded explicit action list/);
assert.throws(() => compiler.approve(contract, {
  contractId: contract.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: 1_800_000_000_001, evidenceRef: 'missing-assumption-ack',
}), /assumption/);
assert.throws(() => compiler.approve(contract, {
  contractId: 'another-intent', userConfirmed: true, allowedActions: ['organism.inspect'],
  at: 1_800_000_000_001, evidenceRef: 'wrong-contract',
}), /exact intent contract/);

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

const contractTrace = await bridge.execute(approved, {
  toolId: 'organism.inspect', input: { scope: 'project' }, reason: 'intent-bridge-test',
}, { async executeTool(_id, _input, _reason, options) {
  assert.equal(options.decisionId, undefined,
    'intent identity must not be forged into ActionGateway decisionId when the host has no canonical decision ID');
  return { ok: true, verified: true, tool: 'organism.inspect', outcomeClass: 'executed-verified' };
} });
assert.equal(contractTrace.executed, true);
assert.equal(contractTrace.contractId, approved.id,
  'bridge result must expose the intent contract ID for caller-owned trace correlation');
const noGateway = await bridge.execute(approved, {
  toolId: 'organism.inspect', input: { scope: 'project' }, reason: 'missing-gateway',
}, null);
assert.equal(noGateway.executed, false, 'missing gateway adapter must fail closed');

const realGateway = new ActionGateway();
let realExecutions = 0;
realGateway.registerTool({ id: 'notes.search', capability: 'notes.read', destructive: false, execute: async input => {
  realExecutions += 1;
  return { echoed: input.query };
} });
const realContract = compiler.compile({
  requestId: 'intent:test:real-gateway', text: 'Search notes and report the result.',
  extraction: { expectedOutcome: 'Return matching note IDs', acceptanceCriteria: ['Return a grounded search result'], permissions: { allowedActions: ['notes.search'] }, stopConditions: ['Stop if the note store is unavailable'] },
});
const realApproved = compiler.approve(realContract, {
  contractId: realContract.id, userConfirmed: true, allowedActions: ['notes.search'],
  at: now, evidenceRef: 'real-gateway-test-confirmation',
});
const realDispatch = await bridge.execute(realApproved, {
  toolId: 'notes.search', input: { query: 'intent-compiler-test' }, reason: 'intent-bound read',
}, realGateway);
assert.equal(realDispatch.executed, true);
assert.equal(realDispatch.result.ok, true);
assert.deepEqual(realDispatch.result.result, { echoed: 'intent-compiler-test' });
assert.equal(realExecutions, 1, 'the real ActionGateway executor must be reached exactly once');

const highRisk = compiler.compile({
  requestId: 'intent:test:high-risk',
  text: 'Delete the production database',
  extraction: {
    goal: 'Delete the production database',
    expectedOutcome: 'Database removed',
    acceptanceCriteria: ['Target database is removed'],
    permissions: { allowedActions: ['database.delete'] },
    stopConditions: ['Stop unless environment and target are confirmed'],
    risk: 'low',
  },
});
assert.equal(highRisk.risk.level, 'high', 'explicit low-risk metadata cannot lower destructive risk');
assert.throws(() => compiler.approve(highRisk, {
  contractId: highRisk.id, userConfirmed: true, allowedActions: ['database.delete'],
  at: 1_800_000_000_001, evidenceRef: 'high-risk-no-ack',
}), /risk acknowledgement/);
const highRiskApproved = compiler.approve(highRisk, {
  contractId: highRisk.id, userConfirmed: true, allowedActions: ['database.delete'],
  at: 1_800_000_000_001, evidenceRef: 'high-risk-confirmation', riskAcknowledged: true,
});
assert.equal(compiler.gate(highRiskApproved, 'database.delete').allowed, true);

const conflict = compiler.compile({
  text: 'Inspect project',
  extraction: {
    expectedOutcome: 'Status', acceptanceCriteria: ['Status returned'],
    permissions: { allowedActions: ['organism.inspect'], deniedActions: ['organism.inspect'] },
    stopConditions: ['Stop on missing evidence'],
  },
});
assert.equal(compiler.gate(conflict, 'organism.inspect').allowed, false, 'allow/deny collisions must fail closed');

const wildcard = compiler.compile({
  text: 'Run a task',
  extraction: {
    expectedOutcome: 'Task complete', acceptanceCriteria: ['Task verified'],
    permissions: { allowedActions: ['*'] }, stopConditions: ['Stop on policy refusal'],
  },
});
assert.equal(compiler.gate(wildcard, 'organism.inspect').allowed, false, 'wildcard actions must never become execution capabilities');

const overlong = compiler.compile({
  text: 'x'.repeat(2_050),
  extraction: {
    expectedOutcome: 'Done', acceptanceCriteria: ['Done'], permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop on any uncertainty'],
  },
});
assert.equal(overlong.sourceTextTruncated, true);
assert.equal(compiler.gate(overlong, 'organism.inspect').allowed, false, 'truncated intent must require reconstruction');
const differentTail = compiler.compile({ text: 'x'.repeat(2_000) + 'A'.repeat(50), extraction: { expectedOutcome: 'Done', acceptanceCriteria: ['Done'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop on uncertainty'] } });
const otherTail = compiler.compile({ text: 'x'.repeat(2_000) + 'B'.repeat(50), extraction: { expectedOutcome: 'Done', acceptanceCriteria: ['Done'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop on uncertainty'] } });
assert.notEqual(differentTail.id, otherTail.id, 'the full request tail must contribute to identity even when the visible contract text is truncated');

const changedInterpretation = compiler.compile({
  requestId: 'intent:test:bounded',
  text: 'Inspect the project status and summarize the result.',
  extraction: {
    goal: 'Inspect something else',
    expectedOutcome: 'A concise status report',
    acceptanceCriteria: ['Report branch and commit'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if evidence is missing'],
  },
});
assert.notEqual(changedInterpretation.id, contract.id, 'contract identity must bind semantic extraction, not only raw text');

const providerFailure = await compiler.compileWith({ text: 'Summarize safely' }, {
  async extract() { throw new Error('provider offline'); },
});
assert.equal(providerFailure.extractionStatus, 'provider-failed');
assert.equal(compiler.gate(providerFailure, 'organism.inspect').allowed, false, 'extractor failure must produce a fail-closed incomplete contract');
const timeoutCompiler = new IntentCompiler({
  clock: () => now,
  approvalKey: 'test-only-timeout-approval-key-32-bytes',
  extractionTimeoutMs: 100,
});
const timedOutExtraction = await timeoutCompiler.compileWith({ text: 'Summarize safely' }, {
  async extract() { return new Promise(() => {}); },
});
assert.equal(timedOutExtraction.extractionStatus, 'provider-failed', 'a stalled semantic extractor must time out into a fail-closed contract');
assert.equal(timeoutCompiler.gate(timedOutExtraction, 'organism.inspect').allowed, false);

const expiringCompiler = new IntentCompiler({
  clock: () => now,
  approvalKey: 'test-only-expiring-approval-key-32-bytes',
});
const expiringContract = expiringCompiler.compile({
  text: 'Inspect project status',
  extraction: {
    expectedOutcome: 'Status summary', acceptanceCriteria: ['Include revision'],
    permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop on missing revision'],
  },
});
const expiringApproved = expiringCompiler.approve(expiringContract, {
  contractId: expiringContract.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: now, evidenceRef: 'expiring-confirmation',
});
assert.equal(expiringCompiler.gate(expiringApproved, 'organism.inspect').allowed, true);
now += 16 * 60 * 1000;
assert.equal(expiringCompiler.gate(expiringApproved, 'organism.inspect').reason, 'approval-expired');

console.log('NK1_INTENT_COMPILER=PASS intentIntegrity=true approvalAttestation=true expiry=true riskAndScopeGates=true gatewayGate=true');
