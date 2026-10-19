import assert from 'node:assert/strict';
import { pollUntilReady, timeoutWithinDeadline } from '../scripts/server-smoke-poll.mjs';

let clock = 0;
let probeCount = 0;
const ready = await pollUntilReady({
  timeoutMs: 1000,
  intervalMs: 100,
  now: () => clock,
  sleep: async (ms) => { clock += ms; },
  probe: async () => { probeCount += 1; return probeCount === 3; },
});
assert.equal(ready.ready, true);
assert.equal(ready.attempts, 3);
assert.equal(ready.elapsedMs, 200);
assert.equal(ready.childExited, false);

let exitedProbeCalled = false;
const exited = await pollUntilReady({
  isChildExited: () => true,
  now: () => 0,
  probe: async () => { exitedProbeCalled = true; return false; },
});
assert.equal(exited.ready, false);
assert.equal(exited.childExited, true);
assert.equal(exited.attempts, 0);
assert.equal(exitedProbeCalled, false);

clock = 0;
const timeout = await pollUntilReady({
  timeoutMs: 350,
  intervalMs: 100,
  probeTimeoutMs: 50,
  now: () => clock,
  sleep: async (ms) => { clock += ms; },
  probe: async () => false,
});
assert.equal(timeout.ready, false);
assert.equal(timeout.childExited, false);
assert.ok(timeout.elapsedMs <= 350);
assert.equal(timeout.attempts, 4);

clock = 0;
const probeFailure = await pollUntilReady({
  timeoutMs: 10,
  intervalMs: 5,
  now: () => clock,
  sleep: async (ms) => { clock += ms; },
  probe: async () => { const error = new Error('private detail'); error.code = 'ECONNREFUSED'; throw error; },
});
assert.equal(probeFailure.ready, false);
assert.equal(probeFailure.lastError, 'ECONNREFUSED');
assert.ok(!JSON.stringify(probeFailure).includes('private detail'));


assert.equal(timeoutWithinDeadline(10_000, 4_000, 6_000), 4_000);
assert.equal(timeoutWithinDeadline(7_000, 4_000, 6_000), 1_000);
assert.equal(timeoutWithinDeadline(6_000, 4_000, 6_000), 0);
assert.equal(timeoutWithinDeadline(Number.NaN, 4_000, 0), 0);
console.log('SERVER_SMOKE_POLL=PASS bounded-startup child-exit global-deadline deadline-safe-probe-errors');
