import assert from 'node:assert/strict';
import { OrganismMotorRuntime } from '../src/organism/body/OrganismMotorRuntime.ts';

const motor = new OrganismMotorRuntime();
assert.equal(motor.submitApprovedGoal({
  id: 'goal-before-config', action: 'raise-arm', source: 'organism', priority: 40,
  confidence01: .9, createdAtMs: 0, targetJointAnglesRad: { shoulder: .5 }, reason: 'test',
}, 0).accepted, false);
assert.throws(() => motor.advance(0), /skeleton-not-configured/);

motor.configureSkeleton([{
  id: 'shoulder', minAngleRad: -1, maxAngleRad: 1, restAngleRad: 0,
  maxSpeedRadPerSec: 2, maxAccelerationRadPerSec2: 8, maxJerkRadPerSec3: 80,
}]);

const observed = [];
const dispose = motor.subscribe((frame) => observed.push(frame), false);
const idle = motor.advance(0);
assert.equal(idle.phase, 'idle');
assert.equal(idle.goalId, null, 'runtime must not synthesize a goal from ambient state');
assert.equal(observed.length, 1);

const accepted = motor.submitApprovedGoal({
  id: 'goal-arm-01', action: 'raise-arm', source: 'organism', priority: 40,
  confidence01: .9, createdAtMs: 0, expiresAtMs: 5000,
  targetJointAnglesRad: { shoulder: .5 }, reason: 'approved test intent',
}, 0);
assert.deepEqual(accepted, { accepted: true, reason: 'goal-accepted' });

const moving = motor.advance(100);
assert.equal(moving.goalId, 'goal-arm-01');
assert.equal(moving.phase, 'moving');
assert.ok(moving.joints.shoulder.angleRad > 0);
assert.equal(observed.at(-1).tick, moving.tick);
assert.equal(motor.latestFrame().tick, moving.tick);

const copy = motor.latestFrame();
copy.joints.shoulder.angleRad = -99;
assert.notEqual(motor.latestFrame().joints.shoulder.angleRad, -99, 'channel snapshots must be defensive');

assert.throws(() => motor.advance(99), /monotonic/);
motor.cancelGoal('test-cancel');
const held = motor.advance(200);
assert.equal(held.phase, 'idle');
assert.equal(held.goalId, null);
assert.equal(motor.diagnostics().channel.published, 3);
dispose();
assert.equal(motor.diagnostics().channel.listenerCount, 0);

const continuous = new OrganismMotorRuntime();
continuous.configureSkeleton([{
  id: 'head-yaw', minAngleRad: -0.8, maxAngleRad: 0.8, restAngleRad: 0,
  maxSpeedRadPerSec: 1.5,
}]);
let monotonic = 0;
continuous.startContinuous(20, () => { monotonic += 20; return monotonic; });
await new Promise((resolve) => setTimeout(resolve, 115));
continuous.stopContinuous();
const stoppedTick = continuous.latestFrame()?.tick ?? 0;
assert.ok(stoppedTick >= 3, 'continuous loop must advance independently of cognitive steps');
assert.equal(continuous.diagnostics().continuousLoopRunning, false);
await new Promise((resolve) => setTimeout(resolve, 55));
assert.equal(continuous.latestFrame()?.tick, stoppedTick, 'stop must prevent further motor ticks');
assert.equal(continuous.diagnostics().continuousLoopErrors, 0);

console.log('Organism motor runtime integration: 15 assertions passed.');
