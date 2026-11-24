import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';
import { ContinualReplayBuffer, trainWithExperienceReplay } from '../src/organism/learning/ContinualReplayBuffer.ts';

// Evaluation protocol inspired by CleanRL's emphasis on repeatable evaluation
// across independent seeds. This is a compact diagnostic, not a benchmark claim.
const TASKS = Array.from({ length: 6 }, (_, index) => ({
  id: `task-${index}`,
  feature: index,
  target: index % 2 === 0 ? 0.9 : 0.1,
}));
const makeRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const makeExperience = (task) => {
  const features = new Array(15).fill(0);
  features[task.feature] = 1;
  return { taskId: task.id, features, action: 'respond', target01: task.target, learningRate01: 0.12 };
};
const shuffledTasks = (seed) => {
  const rng = makeRng(seed);
  const tasks = [...TASKS];
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }
  return tasks;
};
function run(seed, strategy) {
  const rng = makeRng(seed * 17 + 5);
  const learner = new ParametricPolicyLearner();
  const buffer = strategy === 'none' ? null : new ContinualReplayBuffer(36, undefined, rng);
  for (const task of shuffledTasks(seed)) {
    const experience = makeExperience(task);
    for (let step = 0; step < 35; step++) {
      if (strategy === 'none') {
        learner.trainFeatures(experience);
      } else {
        trainWithExperienceReplay(learner, buffer, [experience], 4, {
          strategy,
          random: rng,
        });
      }
    }
  }
  const errors = TASKS.map((task) => {
    const prediction = learner.predictFromFeatures(makeExperience(task).features, 'respond');
    return Math.abs(prediction - task.target);
  });
  return {
    seed,
    strategy,
    meanAbsoluteError: errors.reduce((sum, error) => sum + error, 0) / errors.length,
    maxAbsoluteError: Math.max(...errors),
    updates: learner.snapshot().updates,
  };
}
const rows = [];
for (const seed of [11, 23, 37, 53, 71]) {
  for (const strategy of ['none', 'balanced', 'prioritized']) rows.push(run(seed, strategy));
}
const summarize = (strategy) => {
  const values = rows.filter((row) => row.strategy === strategy).map((row) => row.meanAbsoluteError);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { strategy, seeds: values.length, meanMAE: Number(mean.toFixed(6)), stdMAE: Number(Math.sqrt(variance).toFixed(6)) };
};
const summary = ['none', 'balanced', 'prioritized'].map(summarize);
assert.equal(rows.length, 15);
assert.ok(rows.every((row) => Number.isFinite(row.meanAbsoluteError) && row.meanAbsoluteError >= 0 && row.meanAbsoluteError <= 1));
assert.ok(summary.every((row) => row.seeds === 5 && Number.isFinite(row.stdMAE)));
console.log('P26_REPLAY_ABLATION=' + JSON.stringify({ protocol: '5-seed paired task-order diagnostic', summary, runs: rows }));
