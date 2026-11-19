import assert from 'node:assert/strict';
import test from 'node:test';
import { SelfSubsystemRuntime } from '../src/organism/core/SelfSubsystemRuntime.ts';

test('SelfSubsystemRuntime owns the Dyadic Mind workspace', () => {
  const self = new SelfSubsystemRuntime();
  assert.ok(self.dyadicCollaboration, 'the self subsystem must own the collaboration workspace');
});

test('system proposals remain unconfirmed until a human accepts them', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const proposal = workspace.recordItem({
    actor: 'system', kind: 'goal', title: 'Prepare a release evidence pack',
    detail: 'Collect test results and release provenance.', sourceRef: 'turn:proposal:1',
    tick: 12, sensitivity: 'low-risk',
  });
  assert.equal(proposal.accepted, true);
  assert.equal(proposal.item.status, 'proposed');
  assert.match(workspace.promptContext(), /awaiting human confirmation/i);
  assert.doesNotMatch(workspace.promptContext(), /jointly accepted goal: prepare/i);

  const accepted = workspace.confirmProposal({
    id: proposal.item.id, actor: 'human', evidenceRef: 'turn:human:accept:1', tick: 13,
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.item.status, 'accepted');
  assert.match(workspace.promptContext(), /jointly accepted/i);
});

test('human-authored context is accepted while duplicate evidence cannot create a second item', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const first = workspace.recordItem({
    actor: 'human', kind: 'agreement', title: 'Keep the source branch separate',
    sourceRef: 'chat:agreement:1', tick: 4, sensitivity: 'low-risk',
  });
  assert.equal(first.accepted, true);
  assert.equal(first.item.status, 'accepted');

  const duplicate = workspace.recordItem({
    actor: 'human', kind: 'agreement', title: 'Different title',
    sourceRef: 'chat:agreement:1', tick: 5, sensitivity: 'low-risk',
  });
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, 'duplicate-evidence');
  assert.equal(workspace.snapshot().items.length, 1);
});

test('system cannot mark a joint task complete without human confirmation', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const task = workspace.recordItem({
    actor: 'human', kind: 'task', title: 'Run the release checks',
    sourceRef: 'chat:task:1', tick: 20, sensitivity: 'low-risk',
  });
  assert.equal(task.accepted, true);

  const blocked = workspace.updateTaskProgress({
    id: task.item.id, actor: 'system', progress: 'completed',
    evidenceRef: 'runtime:completion:1', tick: 21,
  });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, 'human-confirmation-required');
  assert.equal(workspace.snapshot().items[0].progress, 'not-started');

  const completed = workspace.updateTaskProgress({
    id: task.item.id, actor: 'human', progress: 'completed',
    evidenceRef: 'chat:completion:1', tick: 22,
  });
  assert.equal(completed.accepted, true);
  assert.equal(completed.item.progress, 'completed');
});

test('only a human may correct accepted shared context', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const item = workspace.recordItem({
    actor: 'human', kind: 'success-criteria', title: 'Tests pass',
    sourceRef: 'chat:criteria:1', tick: 2, sensitivity: 'low-risk',
  });
  const denied = workspace.correctItem({
    id: item.item.id, actor: 'system', title: 'All tests pass',
    evidenceRef: 'runtime:correction:1', tick: 3,
  });
  assert.equal(denied.accepted, false);
  assert.equal(denied.reason, 'human-authority-required');

  const corrected = workspace.correctItem({
    id: item.item.id, actor: 'human', title: 'Relevant tests and typecheck pass',
    evidenceRef: 'chat:correction:1', tick: 4,
  });
  assert.equal(corrected.accepted, true);
  assert.equal(corrected.item.title, 'Relevant tests and typecheck pass');
  assert.equal(corrected.item.updatedBy, 'human');
});

test('sensitive or unclassified context is rejected before it enters shared state', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const sensitive = workspace.recordItem({
    actor: 'human', kind: 'decision', title: 'API token = secret-value',
    sourceRef: 'chat:sensitive:1', tick: 1, sensitivity: 'low-risk',
  });
  assert.equal(sensitive.accepted, false);
  assert.equal(sensitive.reason, 'sensitive-content');
  assert.equal(workspace.snapshot().items.length, 0);

  const unclassified = workspace.recordItem({
    actor: 'human', kind: 'decision', title: 'Use the new workflow',
    sourceRef: 'chat:unknown:1', tick: 2, sensitivity: 'unknown',
  });
  assert.equal(unclassified.accepted, false);
  assert.equal(unclassified.reason, 'sensitivity-not-allowed');
});

test('snapshot restore preserves accepted items and ignores accessor-backed state', () => {
  const source = new SelfSubsystemRuntime().dyadicCollaboration;
  source.recordItem({
    actor: 'human', kind: 'question', title: 'Which evaluation gate is next?',
    sourceRef: 'chat:question:1', tick: 7, sensitivity: 'low-risk',
  });
  const snapshot = source.snapshot();
  const subsystemSnapshot = new SelfSubsystemRuntime();
  subsystemSnapshot.dyadicCollaboration.recordItem({
    actor: 'human', kind: 'agreement', title: 'Persist coordination separately',
    sourceRef: 'chat:restore-subsystem:1', tick: 8, sensitivity: 'low-risk',
  });
  const persistedSelf = subsystemSnapshot.snapshot();
  const persistedRestore = new SelfSubsystemRuntime();
  persistedRestore.restoreFromPersisted({ advanced: { dyadicCollaboration: persistedSelf.dyadicCollaboration } });
  assert.deepEqual(persistedRestore.dyadicCollaboration.snapshot(), persistedSelf.dyadicCollaboration);

  const restored = new SelfSubsystemRuntime().dyadicCollaboration;
  restored.restore(snapshot);
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.match(restored.promptContext(), /which evaluation gate is next/i);

  const hostile = {};
  Object.defineProperty(hostile, 'items', { enumerable: true, get() { throw new Error('getter executed'); } });
  const safe = new SelfSubsystemRuntime().dyadicCollaboration;
  assert.doesNotThrow(() => safe.restore(hostile));
  assert.equal(safe.snapshot().items.length, 0);
});

test('proposal rejection cannot leave the item in the prompt projection', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const proposal = workspace.recordItem({
    actor: 'system', kind: 'decision', title: 'Change the canonical memory owner',
    sourceRef: 'runtime:proposal:reject', tick: 8, sensitivity: 'low-risk',
  });
  const rejected = workspace.rejectProposal({
    id: proposal.item.id, actor: 'human', evidenceRef: 'chat:reject:1', tick: 9,
  });
  assert.equal(rejected.accepted, true);
  assert.equal(rejected.item.status, 'rejected');
  assert.doesNotMatch(workspace.promptContext(), /change the canonical memory owner/i);
});


test('stale task updates cannot roll shared progress backwards', () => {
  const workspace = new SelfSubsystemRuntime().dyadicCollaboration;
  const task = workspace.recordItem({
    actor: 'human', kind: 'task', title: 'Keep progress monotonic',
    sourceRef: 'chat:monotonic-task:1', tick: 10, sensitivity: 'low-risk',
  });
  const advanced = workspace.updateTaskProgress({
    id: task.item.id, actor: 'system', progress: 'in-progress',
    evidenceRef: 'runtime:monotonic:1', tick: 12,
  });
  assert.equal(advanced.accepted, true);
  const stale = workspace.updateTaskProgress({
    id: task.item.id, actor: 'human', progress: 'blocked',
    evidenceRef: 'chat:monotonic:stale', tick: 11,
  });
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, 'stale-event');
  assert.equal(workspace.snapshot().items[0].progress, 'in-progress');
});
