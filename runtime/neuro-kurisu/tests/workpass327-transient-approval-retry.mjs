import assert from 'node:assert/strict';
import { retryTransientApprovalStorage } from '../src/server/transient-approval-storage-retry.mjs';

const busy = { ok: false, error: 'approval-storage-busy' };
const isBusy = result => result?.error === 'approval-storage-busy';

let now = 0;
const sleeps = [];
let calls = 0;
const recovered = await retryTransientApprovalStorage(
  async () => (++calls <= 3 ? busy : { ok: true, ticketId: 'approved-ticket' }),
  isBusy,
  {
    timeoutMs: 1_000,
    initialDelayMs: 25,
    maxDelayMs: 100,
    now: () => now,
    sleep: async ms => { sleeps.push(ms); now += ms; },
  },
);
assert.deepEqual(recovered.result, { ok: true, ticketId: 'approved-ticket' });
assert.equal(recovered.exhausted, false);
assert.equal(recovered.attempts, 4);
assert.deepEqual(sleeps, [25, 50, 100]);

now = 0;
const exhaustedSleeps = [];
calls = 0;
const exhausted = await retryTransientApprovalStorage(
  async () => { calls += 1; return busy; },
  isBusy,
  {
    timeoutMs: 90,
    initialDelayMs: 25,
    maxDelayMs: 50,
    now: () => now,
    sleep: async ms => { exhaustedSleeps.push(ms); now += ms; },
  },
);
assert.equal(exhausted.result, busy);
assert.equal(exhausted.exhausted, true);
assert.equal(exhausted.attempts, 4);
assert.deepEqual(exhaustedSleeps, [25, 50, 15], 'retry delay must never sleep beyond the remaining budget');

calls = 0;
const permanent = await retryTransientApprovalStorage(
  async () => { calls += 1; return { ok: false, error: 'approval-storage-failed' }; },
  isBusy,
  { timeoutMs: 100, now: () => now, sleep: async () => { throw new Error('must not sleep'); } },
);
assert.equal(permanent.exhausted, false);
assert.equal(permanent.attempts, 1);
assert.equal(calls, 1, 'permanent storage errors are not retried');

calls = 0;
await assert.rejects(
  retryTransientApprovalStorage(
    async () => { calls += 1; throw new Error('unexpected-operation-error'); },
    isBusy,
    { timeoutMs: 100 },
  ),
  /unexpected-operation-error/,
);
assert.equal(calls, 1, 'unexpected errors must propagate instead of being retried');

console.log('WORKPASS327_TRANSIENT_APPROVAL_RETRY=PASS scenarios=4');
