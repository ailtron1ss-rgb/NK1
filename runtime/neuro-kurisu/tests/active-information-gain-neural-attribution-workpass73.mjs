import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const utilities = Object.fromEntries(actions.map(action => [action, .5]));
const inputFor = tick => Array.from({ length: 64 }, (_, index) =>
  Math.sin(tick * .061 + index * .17) * .5 + .5);
const sensorsFor = (tick, id) => ({
  [id]: { tick, values: [.2, .4, .8], freshness01: .12, confidence01: .2, ageTicks: 88, source: 'workpass73-fixture' },
});

function runExperiment(branch, firstTick, sensorId) {
  for (let tick = firstTick; tick < firstTick + 12; tick += 1) {
    const input = inputFor(tick);
    const sensors = sensorsFor(tick, sensorId);
    const result = branch.beforeDecision({
      tick, input, baseUtilities: utilities, predictionError01: .78, novelty01: .7, uncertainty01: .84,
      homeostasis01: .2, identityGap01: .2, goalPressure01: .5,
      embodied: { sensors, sensorFeatures: input, sensorFreshness01: .82, thermalStrain01: .1, battery01: .95, cpuLoad01: .15, ramPressure01: .2 },
    });
    const live = branch.continuityMetrics().activeInformationGain;
    const informationAction = result.embodied.activeExperimentAction;
    const action = informationAction ?? 'respond';
    branch.commitAction(action, utilities);
    branch.afterOutcome({
      tick, action, reward01: .9, predictionError01: .08, verified01: .95,
      nextInput: input.map(value => value * .97), identityGap01: .2, goalPressure01: .5,
      embodied: { sensors, sensorFreshness01: .82 },
    });
    if (informationAction && live.selectedHypothesis === sensorId) {
      const after = branch.continuityMetrics().activeInformationGain;
      assert.equal(after.hypotheses.find(row => row.id === sensorId)?.evidence, 1,
        `the ${sensorId} experiment must learn from its own completed outcome`);
      return { tick, action, after };
    }
  }
  assert.fail(`no active information experiment was selected for ${sensorId} within 12 ticks`);
}

const firstProcess = new NeuralExperienceBranch();
const decisionA = runExperiment(firstProcess, 1, 'camera');
const persisted = firstProcess.snapshot();
const resumed = new NeuralExperienceBranch();
resumed.restore(persisted);
assert.equal(resumed.continuityMetrics().activeInformationGain.selectedHypothesis, 'camera');

// The next serial decision selects a different sensor hypothesis. The controller's
// live pending decision becomes 'motion', but the public mirror is still the last
// snapshot ('camera') until another snapshot is taken.
const decisionB = runExperiment(resumed, decisionA.tick + 1, 'motion');
const motion = decisionB.after.hypotheses.find(row => row.id === 'motion');
assert.equal(motion?.evidence, 1,
  'decision B outcome must update the B hypothesis, not be rejected by the stale A snapshot mirror');
assert.equal(decisionB.after.modelUpdates, decisionA.after.modelUpdates + 1,
  'decision B must produce exactly one additional hypothesis model update');

console.log('ACTIVE_INFORMATION_GAIN_NEURAL_ATTRIBUTION_WORKPASS73=PASS');