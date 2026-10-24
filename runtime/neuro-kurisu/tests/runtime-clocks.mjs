import assert from 'node:assert/strict';
import { RuntimeClockScheduler, RUNTIME_CLOCK_IDS } from '../src/organism/system/RuntimeClockScheduler.ts';
assert.equal(RUNTIME_CLOCK_IDS.p23CompoundRepairRevision, 'p23-compound-repair-revision',
  'the P23 runtime clock ID remains a canonical scheduler contract');

const scheduler = new RuntimeClockScheduler();
let calls = 0;
scheduler.register({ id: RUNTIME_CLOCK_IDS.cognitive, initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: true }), task: () => { calls += 1; } });
scheduler.register({ id: RUNTIME_CLOCK_IDS.embodiment, initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: false }), task: () => { calls += 100; } });
scheduler.register({ id: RUNTIME_CLOCK_IDS.reflection, initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: false }), task: () => { calls += 1000; } });
scheduler.register({
  id: RUNTIME_CLOCK_IDS.p23CompoundRepairRevision,
  initialDelayMs: 1,
  decide: () => ({ delayMs: 10, reason: 'p23-background-repair-test', run: true }),
  task: () => { calls += 10; },
});
scheduler.start();
await new Promise(r => setTimeout(r, 25));
scheduler.stop();
assert.ok(calls >= 1);
assert.ok(scheduler.snapshot().cognitive.executions >= 1);
assert.ok(scheduler.snapshot().embodiment.skipped >= 1);
assert.ok(scheduler.snapshot()['p23-compound-repair-revision'].executions >= 1,
  'P23 background repair clock must be accepted and execute by its production runtime clock ID');
console.log('Runtime clock tests passed.');
