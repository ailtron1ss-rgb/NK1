import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { claimTask, listClaims, normalizeClaimPath, releaseTask } from './neurok-os-coordinator.mjs';

const sha = 'a'.repeat(40);
async function fixture(fn) {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'neurok-os-claims-'));
  try { await fn(stateDir); } finally { await rm(stateDir, { recursive: true, force: true }); }
}
const request = (taskId, agentId, paths, extra = {}) => ({
  taskId, agentId, baseSha: sha, paths, ttlMs: 60_000, ...extra
});

test('claim path normalization rejects traversal and absolute paths', () => {
  assert.equal(normalizeClaimPath('runtime/core/file.ts'), 'runtime/core/file.ts');
  for (const unsafe of ['../secret', 'runtime/../secret', '/etc/passwd', 'C:/secret', 'runtime\\secret', 'runtime//file.ts']) {
    assert.throws(() => normalizeClaimPath(unsafe));
  }
});

test('claim is durable, idempotently renewable, and owner-releasable', async () => fixture(async stateDir => {
  const first = await claimTask(request('TASK-1', 'agent-a', ['src/a.ts']), { stateDir });
  assert.equal(first.renewed, false);
  const renewed = await claimTask(request('TASK-1', 'agent-a', ['src/a.ts']), { stateDir });
  assert.equal(renewed.renewed, true);
  assert.equal((await listClaims({ stateDir })).length, 1);
  await assert.rejects(() => releaseTask({ taskId: 'TASK-1', agentId: 'agent-b' }, { stateDir }), /owning agent/);
  assert.equal((await releaseTask({ taskId: 'TASK-1', agentId: 'agent-a' }, { stateDir })).released, true);
  assert.equal((await listClaims({ stateDir })).length, 0);
}));

test('rejects overlapping paths, including parent-child collisions', async () => fixture(async stateDir => {
  await claimTask(request('TASK-1', 'agent-a', ['src/organism']), { stateDir });
  await assert.rejects(() => claimTask(request('TASK-2', 'agent-b', ['src/organism/memory/Memory.ts']), { stateDir }), /path conflict/);
}));

test('parallel claims for the same path admit exactly one owner', async () => fixture(async stateDir => {
  const results = await Promise.allSettled([
    claimTask(request('TASK-A', 'agent-a', ['src/shared.ts']), { stateDir }),
    claimTask(request('TASK-B', 'agent-b', ['src/shared.ts']), { stateDir })
  ]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter(item => item.status === 'rejected').length, 1);
  assert.equal((await listClaims({ stateDir })).length, 1);
}));

test('expired claims stop blocking new work', async () => fixture(async stateDir => {
  await claimTask(request('TASK-OLD', 'agent-a', ['src/a.ts'], { ttlMs: 1000 }), { stateDir, now: 1000 });
  const result = await claimTask(request('TASK-NEW', 'agent-b', ['src/a.ts']), { stateDir, now: 2501 });
  assert.equal(result.taskId, 'TASK-NEW');
  assert.equal((await listClaims({ stateDir, now: 2501 })).length, 1);
}));

test('same task cannot be rebound to another source SHA or scope', async () => fixture(async stateDir => {
  await claimTask(request('TASK-1', 'agent-a', ['src/a.ts']), { stateDir });
  await assert.rejects(() => claimTask(request('TASK-1', 'agent-a', ['src/b.ts']), { stateDir }), /different contract/);
}));
