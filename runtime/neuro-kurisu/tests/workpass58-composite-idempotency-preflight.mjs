import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await core.init();
let readCalls = 0;
let mutationCalls = 0;
core.registerActionTool({
  id: 'test.skill-read', capability: 'test.read', destructive: false, projectAllowed: false,
  execute: async () => { readCalls++; return { ok: true, value: 'read-result' }; },
  verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .96, externalObservation: false, notes: 'read-fixture' }),
});
core.registerActionTool({
  id: 'test.mutate-state', capability: 'test.mutate-state', destructive: false, projectAllowed: true,
  execute: async () => { mutationCalls++; return { ok: true, state: 'updated' }; },
  verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .96, externalObservation: false, notes: 'mutation-fixture' }),
});

const compiled = core.compileCompoundSkill({
  projectId: 'workpass58-composite-preflight', name: 'Composite mutation preflight', origin: 'intrinsic',
  steps: [
    { id: 'read-first', action: 'explore', toolId: 'test.skill-read', input: {} },
    { id: 'mutate-second', action: 'apply', toolId: 'test.mutate-state', input: {} },
  ],
});
assert.ok(compiled, 'fixture skill compiles');
for (let i = 0; i < 6; i++) {
  core.recordCompoundSkillExecution(compiled.id, { success01: 1, verified: true, independent: true, context: `workpass58 preflight history ${i}` });
}
const reusable = core.compoundSkillsSnapshot(32).find(row => row.id === compiled.id && row.status === 'reusable');
assert.ok(reusable, 'fixture skill promoted to reusable');

const beforeNoKey = await core.executeReusableSkill(reusable.id, {}, 'wp58-no-key', {});
assert.equal(beforeNoKey.outcomeClass, 'idempotency-key-required');
assert.equal(beforeNoKey.idempotencyRequired, true);
assert.equal(beforeNoKey.blockedAtStep, 'mutate-second');
assert.equal(readCalls, 0, 'the skill must preflight all steps before executing even the earlier read-only step');
assert.equal(mutationCalls, 0, 'no side effect starts without a durable parent idempotency key');

const options = { idempotencyKey: 'wp58:composite-invocation:001', decisionId: 'decision:wp58:operator-request', autonomous: true };
const first = await core.executeReusableSkill(reusable.id, { contextKey: 'same input' }, 'wp58-keyed', options);
assert.equal(first.ok, true, 'a valid parent key permits the skill to proceed under the normal gateway rules');
assert.equal(readCalls, 1);
assert.equal(mutationCalls, 1);
const ledger = core.snapshot().system.actionExecutionLedger.records;
const stepReceipts = ledger.filter(row => row.toolId === 'test.skill-read' || row.toolId === 'test.mutate-state');
assert.equal(stepReceipts.length, 2, 'each keyed step records its own durable receipt');
assert.ok(stepReceipts.every(row => typeof row.decisionId === 'string' && row.decisionId.startsWith('decision:skill-step:')),
  'the caller decision is projected into deterministic per-step decision IDs');
assert.ok(stepReceipts.every(row => row.autonomous === true), 'host asserted autonomous attribution propagates to each receipt');

const replay = await core.executeReusableSkill(reusable.id, { contextKey: 'same input' }, 'wp58-keyed-retry', options);
assert.equal(replay.ok, true);
assert.equal(replay.idempotentReplay, true);
assert.equal(readCalls, 1, 'replaying the same parent key must not rerun read step');
assert.equal(mutationCalls, 1, 'replaying the same parent key must not duplicate the mutation');
const replayLedger = core.snapshot().system.actionExecutionLedger.records.filter(row => row.toolId === 'test.skill-read' || row.toolId === 'test.mutate-state');
assert.equal(replayLedger.length, 2, 'replay does not append duplicate per-step receipts');

// Exercise the real project executor path: a missing key is rejected before budget spend or tool call.
const proposedProject = core.agencySubsystem.selfProjects.propose({
  intrinsicOverall: .9, dominant: 'competence', uncertainty: .8, predictionError: .3,
  identityDrift: .1, unresolvedExperiments: 0, activeGoals: [],
});
assert.ok(proposedProject);
const activeProject = core.agencySubsystem.selfProjects.selectProject(proposedProject.id);
assert.ok(activeProject);
core.agencySubsystem.projectExecutor.ensure({ id: activeProject.id, origin: activeProject.origin });
const executorSnapshot = core.agencySubsystem.projectExecutor.snapshot();
executorSnapshot.steps[0].preferredTool = 'test.mutate-state';
executorSnapshot.steps[0].toolInput = {};
core.agencySubsystem.projectExecutor.restore(executorSnapshot);
const projectBudgetBefore = JSON.stringify(core.agencySubsystem.budget.snapshot());
const projectNoKey = await core.executeProjectTool('test.mutate-state', {}, 'wp58-project-no-key', {});
assert.equal(projectNoKey.idempotencyRequired, true);
assert.equal(projectNoKey.outcomeClass, 'idempotency-key-required');
assert.equal(mutationCalls, 1, 'project preflight must block the mutation before its executor starts');
assert.equal(JSON.stringify(core.agencySubsystem.budget.snapshot()), projectBudgetBefore, 'missing-key preflight must not spend project execution budget');

const projectRun = await core.executeProjectTool('test.mutate-state', {}, 'wp58-project-keyed', {
  idempotencyKey: 'wp58:project-invocation:001', decisionId: 'decision:wp58:project', autonomous: true,
});
assert.equal(projectRun.ok, true);
const projectReceipt = core.snapshot().system.actionExecutionLedger.records.find(row => row.toolId === 'test.mutate-state' && row.autonomous === true && row.decisionId === 'decision:wp58:project');
assert.ok(projectReceipt, 'project tool preserves caller decision identity and host autonomous attribution into the durable receipt');

console.log('WORKPASS58_COMPOSITE_IDEMPOTENCY_PREFLIGHT=PASS', JSON.stringify({ blockedBeforeExecution: true, stepReceipts: stepReceipts.length, readCalls, mutationCalls, replay: replay.idempotentReplay, projectPreflight: true, projectDecisionPropagated: Boolean(projectReceipt) }));
