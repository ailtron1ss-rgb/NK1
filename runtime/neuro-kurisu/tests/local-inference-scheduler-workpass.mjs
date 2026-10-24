import assert from 'node:assert/strict';
import { LocalInferenceScheduler, localEndpointResourceKey } from '../src/server/LocalInferenceScheduler.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const scheduler = new LocalInferenceScheduler({
  maxConcurrentPerGroup: 1,
  maxQueuedPerGroup: 2,
  queueTimeoutMs: 500,
});
let active = 0;
let maximumActive = 0;
const firstGate = deferred();
const order = [];
const task = (label, gate) => async () => {
  active++;
  maximumActive = Math.max(maximumActive, active);
  order.push(`start:${label}`);
  if (gate) await gate.promise;
  order.push(`end:${label}`);
  active--;
  return label;
};

const first = scheduler.run('same-endpoint', task('first', firstGate));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(active, 1);

const second = scheduler.run('same-endpoint', task('second'));
const third = scheduler.run('same-endpoint', task('third'));
await assert.rejects(
  () => scheduler.run('same-endpoint', task('overflow')),
  /local-inference-queue-full/,
  'the bounded queue must reject excess work rather than grow without limit',
);
firstGate.resolve();
assert.deepEqual(await Promise.all([first, second, third]), ['first', 'second', 'third']);
assert.equal(maximumActive, 1, 'one endpoint must never exceed its configured concurrency');
const sameEndpointConcurrencyBounded = maximumActive === 1;
assert.deepEqual(order, ['start:first', 'end:first', 'start:second', 'end:second', 'start:third', 'end:third']);

const blocker = deferred();
const running = scheduler.run('cancel-lane', task('blocker', blocker));
await new Promise((resolve) => setImmediate(resolve));
const controller = new AbortController();
const cancelled = scheduler.run('cancel-lane', task('cancelled'), { signal: controller.signal });
controller.abort();
await assert.rejects(() => cancelled, /local-inference-aborted/);
blocker.resolve();
assert.equal(await running, 'blocker');
assert.ok(scheduler.snapshot().groups.some((row) => row.cancelled === 1));

const timeoutGate = deferred();
const timeoutRunning = scheduler.run('timeout-lane', task('timeout-blocker', timeoutGate));
await new Promise((resolve) => setImmediate(resolve));
await assert.rejects(
  () => scheduler.run('timeout-lane', task('never-started'), { queueTimeoutMs: 120 }),
  /local-inference-queue-timeout/,
);
timeoutGate.resolve();
assert.equal(await timeoutRunning, 'timeout-blocker');

const separateGate = deferred();
const independentGate = deferred();
let separateStarted = false;
const busy = scheduler.run('busy-lane', task('busy', separateGate));
await new Promise((resolve) => setImmediate(resolve));
const independent = scheduler.run('independent-lane', async () => {
  separateStarted = true;
  active++;
  maximumActive = Math.max(maximumActive, active);
  await independentGate.promise;
  active--;
  return 'independent';
});
await new Promise((resolve) => setImmediate(resolve));
assert.equal(separateStarted, true, 'a free local endpoint must not wait behind another endpoint queue');
assert.equal(active, 2, 'separate resource lanes can run concurrently');
independentGate.resolve();
assert.equal(await independent, 'independent', 'independent endpoints must remain independently schedulable');
separateGate.resolve();
await busy;

const resourceA = localEndpointResourceKey({ baseUrl: new URL('http://127.0.0.1:11434/api/embed') }, 'embeddings');
const resourceB = localEndpointResourceKey({ baseUrl: 'http://127.0.0.1:11434/v1/chat/completions' }, 'language');
const resourceC = localEndpointResourceKey({ baseUrl: 'http://127.0.0.1:8080/v1' }, 'classifier');
assert.equal(resourceA, resourceB, 'different local routes on one host should share a resource group');
assert.notEqual(resourceA, resourceC, 'different local endpoint origins should have independent lanes');

const snapshot = scheduler.snapshot();
assert.equal(snapshot.maxConcurrentPerGroup, 1);
assert.equal(snapshot.pending, 0);
assert.ok(snapshot.groups.every((row) => !('endpoint' in row) && !('url' in row)));
assert.equal(JSON.stringify(snapshot).includes('127.0.0.1'), false, 'diagnostics must not reveal endpoint addresses');
assert.equal(snapshot.privacy.endpointKeysExposed, false);
assert.ok(snapshot.groups.reduce((sum, row) => sum + row.rejected, 0) >= 1);
assert.ok(snapshot.groups.reduce((sum, row) => sum + row.timedOut, 0) >= 1);

console.log('LOCAL_INFERENCE_SCHEDULER=PASS', JSON.stringify({
  boundedConcurrency: sameEndpointConcurrencyBounded,
  fifoOrder: true,
  boundedQueue: true,
  queuedCancellation: true,
  queueDeadline: true,
  endpointGrouping: true,
  aggregateOnlyDiagnostics: true,
}));
