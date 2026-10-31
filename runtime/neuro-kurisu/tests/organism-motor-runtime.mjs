import assert from 'node:assert/strict';
import { OrganismMotorRuntime } from '../src/organism/body/OrganismMotorRuntime.ts';
import { createCognitiveMotorGoalCandidate } from '../src/organism/system/CognitiveMotorIntentMapper.ts';

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

// Approved semantic motor candidates must pass through the runtime-owned arbiter
// and publish through the same canonical MotorFrame channel as continuous ticks.
const governed = new OrganismMotorRuntime();
governed.configureSkeleton([{
  id: 'head-yaw', minAngleRad: -1, maxAngleRad: 1, restAngleRad: 0,
  maxSpeedRadPerSec: 2,
}]);
const governedFrames = [];
governed.subscribe((frame) => governedFrames.push(frame), false);
const arbitration = governed.arbitrateApprovedGoals([{
  id: 'candidate-look-left',
  goal: {
    id: 'goal-look-left', action: 'look-left', source: 'organism', priority: 50,
    confidence01: .95, createdAtMs: 100, expiresAtMs: 5000,
    targetJointAnglesRad: { 'head-yaw': .35 }, reason: 'approved cognitive gesture',
  },
  corticalValue01: .95, predictedUtility01: .9, confidence01: .95, effort01: .05,
  goalFit01: .95, conflict01: .02,
}], {
  tick: 1, nowMs: 100, dopamine01: .95, predictionError01: .05,
  uncertainty01: .05, novelty01: .25, energy01: .95, thermal01: .05,
  cognitiveCapacity01: .95, conflict01: .02, goalPressure01: .95,
  minimumGate01: .05,
});
assert.equal(arbitration.accepted, true, JSON.stringify(arbitration));
assert.equal(arbitration.selectedAction, 'look-left');
assert.equal(arbitration.motorFrame.goalId, 'goal-look-left');
assert.equal(governedFrames.length, 1, 'arbiter output must publish to the shared frame channel');
assert.equal(governed.latestFrame().goalId, 'goal-look-left');
assert.equal(governed.diagnostics().controllerTick, governed.latestFrame().tick);

// Renderer profiles are projections over one canonical controller, not replacement skeletons.
const calibration = {
  status: 'calibrated', evidenceId: 'rig.calibration.runtime-test',
  calibratedAt: '2026-10-30T12:00:00.000Z', verifierVersion: 'runtime-test-v1',
};
function rendererProfile(renderer, modelId) {
  const live2d = renderer === 'live2d';
  const depth2d = renderer === 'depth2d';
  return {
    schemaVersion: 1, profileId: 'kurisu.' + renderer + '.' + modelId, modelId, revision: 1, renderer,
    coordinateFrame: { handedness: 'right', upAxis: 'y', forwardAxis: '-z',
      positionUnit: renderer === 'vrm3d' ? 'meters' : 'normalized', angleUnit: 'radians' },
    calibration: structuredClone(calibration),
    joints: [{
      id: 'shoulder', role: 'left.shoulder.pitch', parentId: null,
      minAngleRad: -1, maxAngleRad: 1, restAngleRad: 0,
      maxSpeedRadPerSec: 2, maxAccelerationRadPerSec2: 8, maxJerkRadPerSec3: 80,
      ...(live2d ? {} : { geometry: { offset: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 1, z: 0 } } }),
      binding: {
        targetId: live2d ? 'ParamBodyAngleX' : 'left-arm', targetKind: live2d ? 'cubism-parameter' : depth2d ? 'depth-rig-node' : 'humanoid-bone',
        component: live2d ? 'value' : depth2d ? 'rotation' : 'x',
        scale: depth2d ? 90 : 1, offset: 0, minValue: depth2d ? -90 : -1,
        maxValue: depth2d ? 90 : 1, fidelity: live2d ? 'approximate' : 'direct', requiredInFrame: true,
      },
    }],
  };
}
const batchedRegistry = new OrganismMotorRuntime();
const rendererProfiles = [
  rendererProfile('live2d', 'kurisu.live-test'),
  rendererProfile('depth2d', 'kurisu.depth-batch-test'),
  rendererProfile('vrm3d', 'kurisu.vrm-batch-test'),
];
batchedRegistry.registerRendererRigProfiles(rendererProfiles);
assert.equal(batchedRegistry.diagnostics().configured, true);
assert.equal(batchedRegistry.diagnostics().registeredProfiles.length, 3,
  'host initialization must register all three renderer profiles as one calibrated set');
const invalidInitialBatch = new OrganismMotorRuntime();
const mismatchedProfile = {
  ...rendererProfile('vrm3d', 'kurisu.vrm-invalid-test'),
  joints: [{ ...rendererProfile('vrm3d', 'kurisu.vrm-invalid-test').joints[0], maxAngleRad: 0.9 }],
};
assert.throws(() => invalidInitialBatch.registerRendererRigProfiles([
  rendererProfile('live2d', 'kurisu.live-invalid-test'),
  mismatchedProfile,
]), /canonical-skeleton-mismatch/);
assert.equal(invalidInitialBatch.diagnostics().configured, false,
  'a failed batch must not leave a partially configured controller');
const existingProfiles = batchedRegistry.diagnostics().registeredProfiles.length;
assert.throws(() => batchedRegistry.registerRendererRigProfiles([
  ...rendererProfiles,
  rendererProfile('live2d', 'kurisu.live-test'),
]), /renderer-model-profile-already-registered/);
assert.equal(batchedRegistry.diagnostics().registeredProfiles.length, existingProfiles,
  'a failed update must preserve the existing complete renderer registry');

motor.configureRigProfile(rendererProfile('depth2d', 'kurisu.depth-test'));
motor.configureRigProfile(rendererProfile('vrm3d', 'kurisu.vrm-test'));
const depthCommands = motor.rendererCommandsForFrame(moving, 'depth2d', 'kurisu.depth-test');
assert.equal(depthCommands.ok, true);
assert.equal(depthCommands.batch.commands[0].valueUnit, 'degrees');
assert.equal(depthCommands.batch.renderer, 'depth2d');
const vrmCommands = motor.rendererCommandsForFrame(moving, 'vrm3d', 'kurisu.vrm-test');
assert.equal(vrmCommands.ok, true);
assert.equal(vrmCommands.batch.commands[0].valueUnit, 'radians');
assert.equal(vrmCommands.batch.renderer, 'vrm3d');
assert.equal(motor.rendererCommandsForFrame(moving).reason, 'renderer-profile-selection-ambiguous');
assert.equal(motor.diagnostics().registeredProfiles.length, 2);
const profileCopy = motor.rendererProfileFor('depth2d', 'kurisu.depth-test');
profileCopy.joints[0].binding.scale = 999;
assert.equal(motor.rendererProfileFor('depth2d', 'kurisu.depth-test').joints[0].binding.scale, 90,
  'renderer profile reads must be defensive copies');
assert.throws(() => motor.configureRigProfile({
  ...rendererProfile('live2d', 'kurisu.live-test'),
  joints: [{ ...rendererProfile('live2d', 'kurisu.live-test').joints[0], maxAngleRad: 0.9 }],
}), /canonical-skeleton-mismatch/, 'a renderer cannot silently alter the controller skeleton');

console.log('Organism motor runtime integration: single controller, multi-renderer profile registry and fail-closed selection passed.');

// Cognitive action -> bounded semantic gesture mapping is explicit and profile-bound.
const motorProfileJoints = [
  { id: 'head-pitch-joint', role: 'head.pitch', minAngleRad: -0.4, maxAngleRad: 0.4, restAngleRad: 0 },
  { id: 'head-yaw-joint', role: 'head.yaw', minAngleRad: -0.5, maxAngleRad: 0.5, restAngleRad: 0 },
  { id: 'neck-pitch-joint', role: 'neck.pitch', minAngleRad: -0.3, maxAngleRad: 0.3, restAngleRad: 0 },
];
const respondIntent = createCognitiveMotorGoalCandidate({
  action: 'respond', tick: 7, nowMs: 1000, joints: motorProfileJoints,
  score01: .9, predictedUtility01: .85, confidence01: .92, effort01: .08,
  conflict01: .02, goalFit01: .9, novelty01: .2,
});
assert.ok(respondIntent, 'approved response action should produce a semantic gesture candidate');
assert.equal(respondIntent.goal.action, 'embodied.respond');
assert.equal(respondIntent.goal.source, 'organism');
assert.equal(respondIntent.goal.createdAtMs, 1000);
assert.equal(respondIntent.goal.expiresAtMs, 2200);
assert.ok(respondIntent.goal.targetJointAnglesRad['head-pitch-joint'] < 0);
assert.ok(Math.abs(respondIntent.goal.targetJointAnglesRad['head-pitch-joint']) <= .08);
const exploreA = createCognitiveMotorGoalCandidate({
  action: 'explore', tick: 8, nowMs: 1100, joints: motorProfileJoints,
  score01: .8, predictedUtility01: .8, confidence01: .8, effort01: .1,
  conflict01: 0, goalFit01: .8, novelty01: .9,
});
const exploreB = createCognitiveMotorGoalCandidate({
  action: 'explore', tick: 9, nowMs: 1200, joints: motorProfileJoints,
  score01: .8, predictedUtility01: .8, confidence01: .8, effort01: .1,
  conflict01: 0, goalFit01: .8, novelty01: .9,
});
assert.notEqual(exploreA.goal.targetJointAnglesRad['head-yaw-joint'], exploreB.goal.targetJointAnglesRad['head-yaw-joint'],
  'exploration scan direction alternates deterministically instead of drifting one-sided');
assert.equal(createCognitiveMotorGoalCandidate({
  action: 'reflect', tick: 10, nowMs: 1300, joints: motorProfileJoints,
  score01: .9, predictedUtility01: .9, confidence01: .9, effort01: 0,
  conflict01: 0, goalFit01: .9, novelty01: .1,
}), null, 'purely cognitive actions must not invent a physical gesture');
assert.equal(createCognitiveMotorGoalCandidate({
  action: 'respond', tick: 11, nowMs: 1400, joints: [],
  score01: .9, predictedUtility01: .9, confidence01: .9, effort01: 0,
  conflict01: 0, goalFit01: .9, novelty01: .1,
}), null, 'missing calibrated joint roles must fail closed');
console.log('Cognitive motor intent mapping: bounded, profile-bound action gestures passed.');
