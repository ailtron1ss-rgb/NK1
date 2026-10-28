import assert from 'node:assert/strict';
import { RuntimeClockScheduler } from '../src/organism/system/RuntimeClockScheduler.ts';

const scheduler = new RuntimeClockScheduler();
let calls = 0;
scheduler.register({ id: 'cognitive', initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: true }), task: () => { calls += 1; } });
scheduler.register({ id: 'embodiment', initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: false }), task: () => { calls += 100; } });
scheduler.register({ id: 'reflection', initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: false }), task: () => { calls += 1000; } });
scheduler.start();
await new Promise(r => setTimeout(r, 25));
scheduler.stop();
assert.ok(calls >= 1);
assert.ok(scheduler.snapshot().cognitive.executions >= 1);
assert.ok(scheduler.snapshot().embodiment.skipped >= 1);
// A clock whose task repeatedly throws must back off instead of running every
// few milliseconds under an ordinary short cadence. Success after a failure
// clears the streak so future independent failures start at the base delay.
const failureScheduler = new RuntimeClockScheduler();
let attempts = 0;
let observedErrors = 0;
failureScheduler.register({
  id: 'cognitive',
  initialDelayMs: 0,
  decide: () => ({ delayMs: 10, reason: 'short-normal-cadence', run: true }),
  task: () => {
    attempts += 1;
    throw new Error('synthetic persistent clock failure');
  },
  onError: () => { observedErrors += 1; },
});
failureScheduler.start('cognitive');
try {
  const firstDeadline = Date.now() + 250;
  while (attempts === 0 && Date.now() < firstDeadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(attempts, 1, 'the first scheduled task should execute');
  assert.ok(failureScheduler.snapshot().cognitive.failures >= 1);
  assert.ok(failureScheduler.snapshot().cognitive.lastDelayMs >= 1000,
    'the first task failure must impose the 1-second minimum retry floor');

  const secondDeadline = Date.now() + 1400;
  while (attempts < 2 && Date.now() < secondDeadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(attempts, 2, 'the second attempt should happen after the first backoff');
  assert.ok(failureScheduler.snapshot().cognitive.lastDelayMs >= 2000,
    'repeated task failure must double the retry floor instead of hot-looping');
  assert.equal(observedErrors, 2, 'each failed task should reach the clock error reporter');
} finally {
  failureScheduler.stop();
  await failureScheduler.drain();
}

console.log('Runtime clock tests passed.');
