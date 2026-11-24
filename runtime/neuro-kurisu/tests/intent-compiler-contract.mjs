import assert from 'node:assert/strict';
import { IntentCompiler } from '../src/organism/cognition/IntentCompiler.ts';
import { IntentActionGatewayBridge } from '../src/organism/system/IntentActionGatewayBridge.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { IntentExecutionRuntime } from '../src/organism/system/IntentExecutionRuntime.ts';

let now = 1_800_000_000_000;
const verifyTestApproval = (_contract, approval) => approval.evidenceRef.startsWith('test-host-attested:');
const compiler = new IntentCompiler({ clock: () => now, approvalKey: 'test-only-intent-approval-key-32-bytes-minimum', approvalVerifier: verifyTestApproval });
let extractedText = '';
const noHostVerifier = new IntentCompiler({ clock: () => now, approvalKey: 'test-only-no-host-verifier-key-32-bytes' });
const noHostVerifierDraft = noHostVerifier.compile({
  text: 'Inspect a status page',
  extraction: { expectedOutcome: 'A status summary', acceptanceCriteria: ['Show current status'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop without current evidence'] },
});
assert.throws(() => noHostVerifier.approve(noHostVerifierDraft, {
  contractId: noHostVerifierDraft.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: now, evidenceRef: 'forged-client-boolean',
}), /host approval verifier/, 'a boolean and caller-chosen evidence string must not mint approval without a trusted host verifier');

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
  at: now, evidenceRef: 'test-host-attested:malformed-assumption-test',
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

const sparseCriteria = new Array(2);
sparseCriteria[0] = 'Return the current status';
const sparseCriteriaContract = compiler.compile({
  text: 'Inspect project status',
  extraction: {
    expectedOutcome: 'Current status',
    acceptanceCriteria: sparseCriteria,
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if status evidence is unavailable'],
  },
});
assert.equal(compiler.gate(sparseCriteriaContract, 'organism.inspect').allowed, false,
  'sparse arrays must not be treated as complete extraction data');

const decoratedCriteria = ['Return the current status'];
Object.defineProperty(decoratedCriteria, 'unreviewedScope', { value: 'also delete data', enumerable: true });
const decoratedCriteriaContract = compiler.compile({
  text: 'Inspect project status',
  extraction: {
    expectedOutcome: 'Current status',
    acceptanceCriteria: decoratedCriteria,
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if status evidence is unavailable'],
  },
});
assert.equal(compiler.gate(decoratedCriteriaContract, 'organism.inspect').allowed, false,
  'arrays carrying unreviewed enumerable properties must fail closed');
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

const processScopedCompiler = new IntentCompiler({ clock: () => now, approvalVerifier: verifyTestApproval });
const processScopedContract = processScopedCompiler.compile({
  text: 'Read system status',
  extraction: { expectedOutcome: 'Status', acceptanceCriteria: ['Show status'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop on missing status'] },
});
const processScopedApproved = processScopedCompiler.approve(processScopedContract, {
  contractId: processScopedContract.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: now, evidenceRef: 'test-host-attested:process-key-confirmation',
});
assert.equal(new IntentCompiler({ clock: () => now }).gate(processScopedApproved, 'organism.inspect').allowed, true,
  'default ephemeral attestation key must be shared by compiler instances within one process');
assert.equal(new IntentCompiler({ clock: () => now, approvalKey: 'a-different-managed-key-with-at-least-32-bytes' }).gate(processScopedApproved, 'organism.inspect').allowed, false,
  'a different key must not validate the approval');
const byteKey = new TextEncoder().encode('test-only-byte-approval-key-material-32-bytes');
const byteKeyCompiler = new IntentCompiler({ clock: () => now, approvalKey: byteKey, approvalVerifier: verifyTestApproval });
const byteKeyContract = byteKeyCompiler.compile({
  text: 'Read system status',
  extraction: { expectedOutcome: 'Status', acceptanceCriteria: ['Show status'], permissions: { allowedActions: ['organism.inspect'] }, stopConditions: ['Stop on missing status'] },
});
const byteKeyApproved = byteKeyCompiler.approve(byteKeyContract, {
  contractId: byteKeyContract.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: now, evidenceRef: 'test-host-attested:byte-key-confirmation',
});
assert.equal(byteKeyCompiler.gate(byteKeyApproved, 'organism.inspect').allowed, true,
  'a byte-backed secret-manager key must support the same HMAC attestation path');

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
assert.throws(() => compiler.approve(ambiguous, { contractId: ambiguous.id, userConfirmed: true, allowedActions: [], at: 1_800_000_000_001, evidenceRef: 'test-host-attested:incomplete-contract' }), /incomplete/);
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
  evidenceRef: 'test-host-attested:user-confirmation:intent:test:bounded',
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
assert.equal(compiler.gate(approved, 'filesystem.write').reason, 'action-explicitly-denied', 'explicit denials must dominate absence from the allow-list');
const tamperedApproval = { ...approved, approval: { ...approved.approval, allowedActions: ['organism.inspect', 'filesystem.write'] } };
assert.equal(compiler.gate(tamperedApproval, 'filesystem.write').allowed, false, 'approval allow-list tampering must invalidate its attestation');
assert.equal(compiler.gate(approved, 'deploy').reason, 'action-explicitly-denied');
const freshApprovalDraft = () => compiler.compile({
  requestId: 'intent:test:bounded-negative-approval',
  text: 'Inspect the project status and summarize the result.',
  extraction: {
    goal: 'Inspect project status and summarize it.',
    expectedOutcome: 'A concise status report',
    acceptanceCriteria: ['Report branch and commit'],
    permissions: { allowedActions: ['organism.inspect'], deniedActions: ['filesystem.write', 'deploy'] },
    assumptions: [{ statement: 'The current branch is the intended inspection target', impact: 'medium', confidence01: 0.6 }],
    stopConditions: ['Stop if the source branch cannot be identified'],
  },
});
const expansionDraft = freshApprovalDraft();
assert.throws(() => compiler.approve(expansionDraft, {
  contractId: expansionDraft.id,
  userConfirmed: true, allowedActions: ['deploy'], at: 1_800_000_000_001, evidenceRef: 'test-host-attested:forged-expansion',
}), /not explicitly allowed/);
const oversizedDraft = freshApprovalDraft();
assert.throws(() => compiler.approve(oversizedDraft, {
  contractId: oversizedDraft.id, userConfirmed: true,
  allowedActions: Array.from({ length: 33 }, () => 'organism.inspect'),
  at: 1_800_000_000_001, evidenceRef: 'test-host-attested:oversized-approval-scope',
}), /bounded explicit action list/);
const missingAckDraft = freshApprovalDraft();
assert.throws(() => compiler.approve(missingAckDraft, {
  contractId: missingAckDraft.id, userConfirmed: true, allowedActions: ['organism.inspect'],
  at: 1_800_000_000_001, evidenceRef: 'test-host-attested:missing-assumption-ack',
}), /assumption/);
const wrongContractDraft = freshApprovalDraft();
assert.throws(() => compiler.approve(wrongContractDraft, {
  contractId: 'another-intent', userConfirmed: true, allowedActions: ['organism.inspect'],
  at: 1_800_000_000_001, evidenceRef: 'test-host-attested:wrong-contract',
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
  toolId: 'organism.inspect', input: { scope: 'project' }, reason: 'intent-bridge-test', options: {},
}, { async executeTool(_id, _input, _reason, options) {
  assert.equal(options.decisionId, undefined,
    'intent identity must not be forged into ActionGateway decisionId when the host has no canonical decision ID');
  return { ok: true, verified: true, tool: 'organism.inspect', outcomeClass: 'executed-verified' };
} });
assert.equal(contractTrace.executed, true);
assert.equal(contractTrace.contractId, approved.id,
  'bridge result must expose the intent contract ID for caller-owned trace correlation');
const forwardedFinalizationKeys = [];
const finalizationContextDispatch = await bridge.execute(approved, {
  toolId: 'organism.inspect', input: { scope: 'compound-skill' },
  reason: 'intent-finalization-context-test',
  finalizationContextKeys: ['contextKey', 'skillRunId'],
}, { async executeTool(_id, _input, _reason, _options, keys) {
  forwardedFinalizationKeys.push(...(keys ?? []));
  return { ok: true, verified: true, tool: 'organism.inspect', outcomeClass: 'executed-verified' };
} });
assert.equal(finalizationContextDispatch.executed, true);
assert.deepEqual(forwardedFinalizationKeys, ['contextKey', 'skillRunId'],
  'Intent bridge must preserve Core finalization context for compound skills');
const reconciliationGateway = {
  executeCalls: 0,
  reconciliationCalls: 0,
  reconciliationStarted: null,
  releaseReconciliation: null,
  async executeTool(id) {
    this.executeCalls += 1;
    return {
      ok: false, verified: false, executionId: 'exec-intent-reconcile-lock', tool: id, capability: 'notes.read',
      result: { error: 'pending-receipt' }, audit: { accepted: false }, verification: { verified: false, basis: 'none', confidence01: 0 },
      outcomeClass: 'idempotency-recovery-required', idempotencyStatus: 'recovery-required',
    };
  },
  async reconcileToolExecution(id) {
    this.reconciliationCalls += 1;
    this.reconciliationStarted?.();
    await new Promise(resolve => { this.releaseReconciliation = resolve; });
    return {
      ok: true, verified: true, executionId: 'exec-intent-reconcile-lock', tool: id, capability: 'notes.read',
      result: { receipt: 'found' }, audit: { accepted: true }, verification: { verified: true, basis: 'tool-contract', confidence01: 1 },
      outcomeClass: 'executed-verified', idempotencyStatus: 'reconciled',
    };
  },
};
const reconcileRuntime = new IntentExecutionRuntime(reconciliationGateway, {
  approvalKey: 'test-only-intent-reconcile-lock-key-32-bytes',
  autonomousDecisionVerifier: () => true,
});
const reconcileDraft = reconcileRuntime.compile({
  requestId: 'intent:test:reconcile-lock',
  text: 'Inspect the notes index and report its state.',
  extraction: {
    goal: 'Inspect the notes index.',
    expectedOutcome: 'A notes index status',
    acceptanceCriteria: ['Return a bounded status'],
    permissions: { allowedActions: ['notes.search'] },
    stopConditions: ['Stop if the notes index is unavailable'],
    assumptions: [],
  },
});
const reconcileApproved = reconcileRuntime.approveFromTrustedPlanner(reconcileDraft, {
  allowedActions: ['notes.search'], acknowledgedAssumptions: [],
}, {});
const reconcileAction = {
  toolId: 'notes.search', input: { query: 'status' }, reason: 'intent-reconcile-lock-test',
  options: { idempotencyKey: 'intent:reconcile-lock:01', decisionId: 'decision:reconcile-lock' },
};
const pendingIntentDispatch = await reconcileRuntime.execute(reconcileApproved, reconcileAction, reconciliationGateway);
assert.equal(pendingIntentDispatch.executed, true);
assert.equal(pendingIntentDispatch.result.outcomeClass, 'idempotency-recovery-required');
let signalReconciliationStarted;
const reconciliationStarted = new Promise(resolve => { signalReconciliationStarted = resolve; });
reconciliationGateway.reconciliationStarted = signalReconciliationStarted;
const firstReconciliation = reconcileRuntime.reconcile(reconcileApproved, reconcileAction, reconciliationGateway);
await reconciliationStarted;
const duplicateReconciliation = await reconcileRuntime.reconcile(reconcileApproved, reconcileAction, reconciliationGateway);
assert.equal(duplicateReconciliation.attempted, false,
  'a concurrent duplicate receipt lookup must be blocked while the first read-only reconciliation is in flight');
assert.equal(duplicateReconciliation.reason, 'intent-execution-in-progress');
assert.equal(reconciliationGateway.reconciliationCalls, 1);
reconciliationGateway.releaseReconciliation();
const firstReconciliationResult = await firstReconciliation;
assert.equal(firstReconciliationResult.attempted, true);
assert.equal(firstReconciliationResult.result.idempotencyStatus, 'reconciled');
assert.equal(reconciliationGateway.reconciliationCalls, 1);

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
  at: now, evidenceRef: 'test-host-attested:real-gateway-test-confirmation',
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
  at: 1_800_000_000_001, evidenceRef: 'test-host-attested:high-risk-no-ack',
}), /risk acknowledgement/);
const highRiskApproved = compiler.approve(highRisk, {
  contractId: highRisk.id, userConfirmed: true, allowedActions: ['database.delete'],
  at: 1_800_000_000_001, evidenceRef: 'test-host-attested:high-risk-confirmation', riskAcknowledged: true,
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
  approvalVerifier: verifyTestApproval,
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
  at: now, evidenceRef: 'test-host-attested:expiring-confirmation',
});
assert.equal(expiringCompiler.gate(expiringApproved, 'organism.inspect').allowed, true);
now += 16 * 60 * 1000;
assert.equal(expiringCompiler.gate(expiringApproved, 'organism.inspect').reason, 'approval-expired');
assert.equal(expiringCompiler.gate(expiringApproved, 'organism.inspect', 'reconcile').allowed, true,
  'authentic expired intent may only authorize read-only receipt reconciliation, never a new execution');

let expiryExecutionCalls = 0;
let expiryReconcileCalls = 0;
const expiryGateway = {
  async executeTool() { expiryExecutionCalls += 1; throw new Error('expired intent must not execute'); },
  async reconcileToolExecution(id, input, reason, options) {
    expiryReconcileCalls += 1;
    assert.equal(id, 'organism.inspect');
    assert.deepEqual(input, { scope: 'status' });
    assert.equal(reason, 'intent-expiry-reconcile');
    assert.equal(options.idempotencyKey, 'intent:expired:receipt');
    return { ok: false, verified: false, executionId: 'exec-expired-reconcile-01', tool: id, capability: 'fixture',
      result: { error: 'no-pending-receipt' }, audit: { at: now, action: 'tool', tool: id, accepted: false, mode: 'dry-run', reason: 'no-pending-receipt' },
      verification: { verified: false, basis: 'none', confidence01: 0, externalObservation: false, notes: 'fixture' }, outcomeClass: 'idempotency-recovery-required' };
  },
};
const expiryBridge = new IntentActionGatewayBridge(expiringCompiler);
const expiredExecute = await expiryBridge.execute(expiringApproved, {
  toolId: 'organism.inspect', input: { scope: 'status' }, reason: 'expired-execute',
}, expiryGateway);
assert.equal(expiredExecute.executed, false, 'expired intent must not authorize a new tool action');
const expiredReconcile = await expiryBridge.reconcile(expiringApproved, {
  toolId: 'organism.inspect', input: { scope: 'status' }, reason: 'intent-expiry-reconcile',
  options: { idempotencyKey: 'intent:expired:receipt' },
}, expiryGateway);
assert.equal(expiredReconcile.attempted, true, 'expired but authentic intent may reach the read-only reconciliation route');
assert.equal(expiryExecutionCalls, 0, 'reconciliation must never invoke executeTool');
assert.equal(expiryReconcileCalls, 1, 'reconciliation must invoke only the read-only receipt lookup once');



const autonomousGateway = new ActionGateway();
const autonomousReceipt = {
  source: 'autonomous-resource-tool-life',
  decisionId: 'cef:autonomous-tool-plan:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  tick: 42,
  plannerToolId: 'organism.inspect',
  toolId: 'organism.inspect',
  intentHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  reason: 'autonomous-resource-tool-life:inspect-current-state',
  sourceText: 'autonomous-resource-tool-life:inspect-current-state\\nTool: organism.inspect\\nDecision: cef:autonomous-tool-plan:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};
const autonomousRuntime = new IntentExecutionRuntime(autonomousGateway, {
  clock: () => now,
  approvalKey: 'test-autonomous-planner-approval-key-32bytes',
  autonomousDecisionVerifier: (candidate, evidence) =>
    evidence.source === autonomousReceipt.source &&
    evidence.decisionId === autonomousReceipt.decisionId &&
    evidence.intentHash === autonomousReceipt.intentHash &&
    candidate.sourceText === autonomousReceipt.sourceText &&
    candidate.goal.text === autonomousReceipt.reason,
});
const autonomousDraft = autonomousRuntime.compile({
  requestId: 'autonomous-resource-tool-life:' + autonomousReceipt.decisionId,
  text: autonomousReceipt.sourceText,
  extraction: {
    goal: autonomousReceipt.reason,
    expectedOutcome: 'A bounded ActionGateway result for organism.inspect',
    acceptanceCriteria: ['Return the correlated inspect result'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if the planner receipt is missing or mismatched'],
    assumptions: [],
  },
});
const autonomousApproved = autonomousRuntime.approveFromTrustedPlanner(autonomousDraft, {
  allowedActions: ['organism.inspect'], acknowledgedAssumptions: [], riskAcknowledged: false,
}, autonomousReceipt);
assert.equal(autonomousApproved.approval.authority, 'autonomous-planner',
  'trusted planner approval must be distinct from a human approval');
assert.equal(autonomousApproved.approval.userConfirmed, undefined,
  'autonomous planner approval must never claim a human confirmed it');
assert.equal(autonomousRuntime.getContract(autonomousApproved.id)?.id, autonomousApproved.id);
const autonomousDispatch = await autonomousRuntime.execute(autonomousApproved, {
  toolId: 'organism.inspect', input: {}, reason: autonomousReceipt.reason,
  options: { decisionId: autonomousReceipt.decisionId, idempotencyKey: 'autonomous:intent:receipt' },
}, {
  async executeTool(id, input, reason, options) {
    assert.equal(id, 'organism.inspect');
    assert.equal(reason, autonomousReceipt.reason);
    assert.equal(options.decisionId, autonomousReceipt.decisionId);
    return {
      ok: true, verified: false, executionId: 'exec-autonomous-intent-01', tool: id, capability: 'core.read',
      result: { tick: 42 },
      audit: { at: now, executionId: 'exec-autonomous-intent-01', action: 'tool', tool: id, accepted: true, mode: 'dry-run', reason: 'read' },
      verification: { verified: false, basis: 'none', confidence01: 0, externalObservation: false, notes: 'read-only fixture' },
      outcomeClass: 'executed-unverified',
    };
  },
});
assert.equal(autonomousDispatch.executed, true,
  'an internally verified, low-risk CEF decision may pass the exact bounded action through the gateway');

const noVerifierRuntime = new IntentExecutionRuntime(new ActionGateway(), {
  clock: () => now,
  approvalKey: 'test-no-autonomous-verifier-key-32bytes',
});
const noVerifierDraft = noVerifierRuntime.compile({
  requestId: 'autonomous-resource-tool-life:no-verifier',
  text: 'Inspect current state',
  extraction: {
    expectedOutcome: 'State summary',
    acceptanceCriteria: ['Return state'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if unavailable'],
  },
});
assert.throws(() => noVerifierRuntime.approveFromTrustedPlanner(noVerifierDraft, {
  allowedActions: ['organism.inspect'], acknowledgedAssumptions: [], riskAcknowledged: false,
}, autonomousReceipt), /trusted autonomous planner decision receipt was not verified/,
'autonomous planner approvals must fail closed without a host-injected verifier');

const untrustedAutonomousRuntime = new IntentExecutionRuntime(new ActionGateway(), {
  clock: () => now,
  approvalKey: 'test-untrusted-planner-approval-key-32b',
  autonomousDecisionVerifier: () => false,
});
const untrustedDraft = untrustedAutonomousRuntime.compile({
  requestId: 'autonomous-resource-tool-life:untrusted',
  text: 'Inspect current state',
  extraction: {
    expectedOutcome: 'State summary',
    acceptanceCriteria: ['Return state'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if unavailable'],
  },
});
assert.throws(() => untrustedAutonomousRuntime.approveFromTrustedPlanner(untrustedDraft, {
  allowedActions: ['organism.inspect'], acknowledgedAssumptions: [], riskAcknowledged: false,
}, { ...autonomousReceipt, decisionId: 'cef:forged' }),
/trusted autonomous planner decision receipt was not verified/);

const autonomousHighRisk = autonomousRuntime.compile({
  requestId: 'autonomous-resource-tool-life:dangerous',
  text: 'Delete the production database',
  extraction: {
    expectedOutcome: 'Database deleted',
    acceptanceCriteria: ['Database deletion completed'],
    permissions: { allowedActions: ['database.delete'] },
    stopConditions: ['Stop unless the explicit target has been confirmed'],
  },
});
assert.equal(autonomousHighRisk.risk.level, 'high');
assert.throws(() => autonomousRuntime.approveFromTrustedPlanner(autonomousHighRisk, {
  allowedActions: ['database.delete'], acknowledgedAssumptions: [], riskAcknowledged: false,
}, { ...autonomousReceipt, toolId: 'database.delete', plannerToolId: 'database.delete' }),
/risk acknowledgement|autonomous planner cannot self-approve/);

console.log('NK1_INTENT_COMPILER=PASS intentIntegrity=true approvalAttestation=true expiry=true riskAndScopeGates=true gatewayGate=true');
