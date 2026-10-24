import assert from 'node:assert/strict';
import { RuntimeClockScheduler } from '../src/organism/system/RuntimeClockScheduler.ts';

const scheduler = new RuntimeClockScheduler();
scheduler.register({
  id: 'p23-compound-repair-revision',
  initialDelayMs: 60_000,
  task: () => {},
});

const stats = scheduler.snapshot()['p23-compound-repair-revision'];
assert.ok(stats, 'compound repair revision clock must be accepted and observable before start');
assert.equal(stats.startedAt, 0, 'registration alone must not launch a background timer');
assert.throws(() => scheduler.register({
  id: 'p23-compound-repair-revision',
  initialDelayMs: 60_000,
  task: () => {},
}), /already registered/, 'duplicate background clocks must remain rejected');

scheduler.stop();
console.log('RUNTIME_CLOCK_COMPOUND_REPAIR_REGISTRATION=PASS');
