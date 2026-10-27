import assert from 'node:assert/strict';
import { RuntimeClockScheduler } from '../src/organism/system/RuntimeClockScheduler.ts';

const scheduler = new RuntimeClockScheduler();
let calls = 0;
scheduler.register({ id: 'cognitive', initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: true }), task: () => { calls += 1; } });
scheduler.register({ id: 'embodiment', initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: false }), task: () => { calls += 100; } });
scheduler.register({ id: 'reflection', initialDelayMs: 1, decide: () => ({ delayMs: 10, reason: 'test', run: false }), task: () => { calls += 1000; } });
scheduler.register({ id: 'p23-compound-repair-revision', initialDelayMs: 60_000, decide: () => ({ delayMs: 60_000, reason: 'test-deferred', run: false }), task: () => { calls += 10_000; } });
assert.ok(scheduler.snapshot()['p23-compound-repair-revision'], 'the compound-repair clock must be registered in the runtime scheduler allowlist');
scheduler.start();
await new Promise(r => setTimeout(r, 25));
scheduler.stop();
assert.ok(calls >= 1);
assert.ok(scheduler.snapshot().cognitive.executions >= 1);
assert.ok(scheduler.snapshot().embodiment.skipped >= 1);
console.log('Runtime clock tests passed.');
