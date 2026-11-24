import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { ToolExecutionUncertainError } from '../src/organism/system/ActionGateway.ts';

process.env.ACTIONS_LIVE = 'false';
const core = new OrganismCore(new MemoryStateStore(), {
  cycleResultMode: 'operational',
  checkpointMinIntervalMs: 0,
});
await core.init();

const counts = () => {
  const state = core.snapshot();
  const graph = core.causalAccountabilitySnapshot();
  return {
    outcomes: state.system.outcomeVerification?.records?.length ?? 0,
    actionNodes: graph.nodes.filter(row => row.kind === 'action').length,
    outcomeNodes: graph.nodes.filter(row => row.kind === 'outcome').length,
    toolAudit: state.facets.embodiment.toolAudit?.length ?? 0,
  };
};
const assertNoFalseAction = (before, label) => {
  const after = counts();
  assert.equal(after.outcomes, before.outcomes, `${label}: no outcome-cognition record for a pre-execution result`);
  assert.equal(after.actionNodes, before.actionNodes, `${label}: no causal action node for a pre-execution result`);
  assert.equal(after.outcomeNodes, before.outcomeNodes, `${label}: no causal outcome node for a pre-execution result`);
  assert.ok(after.toolAudit >= before.toolAudit, `${label}: gateway audit stays observable`);
};

// Permission denial must remain an approval workflow, not become evidence of action failure.
let calls = 0;
core.registerActionTool({
  id: 'device.read-workpass59', capability: 'device.read', destructive: false,
  execute: async () => { calls++; return { ok: true, value: 'should-not-run' }; },
});
let before = counts();
const approval = await core.executeTool('device.read-workpass59', {}, 'wp59-permission-gate');
assert.equal(approval.outcomeClass, 'approval-required');
assert.equal(calls, 0);
assertNoFalseAction(before, 'approval-required');

// A missing prerequisite does not become an unsuccessful execution either.
core.registerActionTool({
  id: 'organism.unavailable-workpass59', capability: 'read-only', destructive: false,
  availability: () => ({ available: false, reason: 'fixture-device-offline' }),
  execute: async () => { calls++; return { ok: true }; },
});
before = counts();
const unavailable = await core.executeTool('organism.unavailable-workpass59', {}, 'wp59-availability-gate');
assert.equal(unavailable.outcomeClass, 'unavailable');
assertNoFalseAction(before, 'unavailable');

// A keyed destructive call refused by dry-run policy enters no executor.
core.registerActionTool({
  id: 'organism.destructive-workpass59', capability: 'controlled-write', destructive: true,
  execute: async () => { calls++; return { ok: true }; },
});
before = counts();
const refused = await core.executeTool('organism.destructive-workpass59', {}, 'wp59-policy-gate', {
  idempotencyKey: 'workpass59:policy-refusal:1',
  decisionId: 'decision:workpass59:policy-refusal:1',
});
assert.equal(refused.outcomeClass, 'policy-refused');
assertNoFalseAction(before, 'policy-refused');

// An ambiguous outcome is not terminal action evidence; it awaits reconciliation.
core.registerActionTool({
  id: 'organism.uncertain-workpass59', capability: 'read-only', destructive: false,
  execute: async () => { calls++; throw new ToolExecutionUncertainError('fixture-effect-may-have-happened'); },
});
before = counts();
const uncertain = await core.executeTool('organism.uncertain-workpass59', {}, 'wp59-ambiguous-execution');
assert.equal(uncertain.outcomeClass, 'idempotency-recovery-required');
assertNoFalseAction(before, 'idempotency-recovery-required');

// Real executor entry followed by a thrown failure must still be causally recorded.
core.registerActionTool({
  id: 'organism.executed-failure-workpass59', capability: 'read-only', destructive: false,
  execute: async () => { calls++; throw new Error('fixture-executor-entered-and-failed'); },
});
before = counts();
const failed = await core.executeTool('organism.executed-failure-workpass59', {}, 'wp59-real-execution-failure');
assert.equal(failed.outcomeClass, 'execution-failed');
const afterFailure = counts();
assert.equal(afterFailure.outcomes, before.outcomes + 1, 'entered executor failures remain causal experience');
assert.equal(afterFailure.actionNodes, before.actionNodes + 1, 'real execution failure creates an action node');
assert.equal(afterFailure.outcomeNodes, before.outcomeNodes + 1, 'real execution failure creates an outcome node');
assert.equal(calls, 2, 'only the uncertain and real failure executors ran; all guarded cases were blocked before execution');

console.log('WORKPASS59_PREEXECUTION_OUTCOME_FIREWALL=PASS approval availability policy ambiguity entered-execution-failure');
