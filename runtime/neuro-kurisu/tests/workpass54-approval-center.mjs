import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideActionApproval,
  getActionApprovalSnapshot,
  subscribeActionApprovals,
  waitForActionApproval,
} from '../../../app/src/neuro-kurisu/action-approval-broker.ts';

function challenge(id, execute, overrides = {}) {
  return waitForActionApproval({
    id, toolId: 'http.files.write', permissionClass: 'filesystem', operation: 'direct',
    reasonCode: 'file-write', expiresAt: Date.now() + 60_000, createdAt: Date.now(),
    inputKeys: ['path', 'content'], inputPreview: { path: 'notes.md', content: '[redacted]' },
    requestPath: '/api/organism/example/write', label: 'Write a protected file', execute,
    ...overrides,
  });
}

test('approval center publishes safe request and resumes the exact continuation once', async () => {
  const id = 'approval-broker-test-1';
  let calls = 0;
  let notices = 0;
  const unsubscribe = subscribeActionApprovals(() => notices++);
  const pending = challenge(id, async (approved) => {
    assert.equal(approved, true);
    calls++;
    return { ok: true, marker: 'same-request' };
  });
  const card = getActionApprovalSnapshot().find((row) => row.id === id);
  assert.ok(card);
  assert.equal(card.stage, 'pending');
  assert.equal(card.inputPreview.content, '[redacted]');
  assert.ok(!Object.hasOwn(card, 'body'));
  await decideActionApproval(id, true);
  assert.deepEqual(await pending, { ok: true, marker: 'same-request' });
  assert.equal(calls, 1);
  assert.equal(getActionApprovalSnapshot().find((row) => row.id === id)?.stage, 'completed');
  assert.ok(notices >= 2);
  unsubscribe();
});

test('decline is terminal and cannot execute the captured operation', async () => {
  const id = 'approval-broker-test-2';
  let calls = 0;
  const pending = challenge(id, async (approved) => { calls++; assert.equal(approved, false); });
  await decideActionApproval(id, false);
  await assert.rejects(pending, /declined by the owner/);
  assert.equal(calls, 1); // only the decision callback ran; it must not execute on false.
  assert.equal(getActionApprovalSnapshot().find((row) => row.id === id)?.stage, 'declined');
  await decideActionApproval(id, true);
  assert.equal(calls, 1);
});

test('same ticket cannot be bound to two live continuations', async () => {
  const id = 'approval-broker-test-3';
  const pending = challenge(id, async () => 'first');
  await assert.rejects(challenge(id, async () => 'second'), /already waiting/);
  await decideActionApproval(id, true);
  assert.equal(await pending, 'first');
});

test('expired approval does not enter the UI queue', async () => {
  await assert.rejects(challenge('approval-broker-test-expired', async () => true, { expiresAt: Date.now() - 1 }), /expired/);
  assert.equal(getActionApprovalSnapshot().some((row) => row.id === 'approval-broker-test-expired'), false);
});

test('a pending continuation is automatically discarded when its ticket expires', async () => {
  const id = 'approval-broker-auto-expiry';
  let calls = 0;
  const pending = challenge(id, async () => { calls++; return true; }, { expiresAt: Date.now() + 20 });
  const rejection = assert.rejects(pending, /approval expired/);
  await new Promise((resolve) => setTimeout(resolve, 35));
  await rejection;
  assert.equal(calls, 0);
  assert.equal(getActionApprovalSnapshot().find((row) => row.id === id)?.stage, 'failed');
});
