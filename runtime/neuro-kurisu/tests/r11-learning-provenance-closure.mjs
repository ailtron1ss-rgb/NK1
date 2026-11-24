import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';

const gate = new RealityLearningGate();
const makeGate = (source) => gate.decide({
  source,
  evidence01: source === 'external' ? .96 : .12,
  verified01: source === 'external' ? 1 : 0,
  independent01: source === 'external' ? 1 : 0,
  consequence01: source === 'external' ? .92 : .12,
  predictionError01: .9,
  surprise01: .9,
  reward01: 1,
  success01: 1,
  actuation: false,
  resource01: .8,
});

async function capture(source) {
  const core = new OrganismCore(new MemoryStateStore(), {
    enableLanguage: false,
    performanceProfile: 'mobile',
    cycleResultMode: 'operational',
    checkpointMinIntervalMs: 60_000,
  });
  await core.init();
  await core.observe({
    text: 'R11 provenance closure integration test: choose and evaluate one action.',
    novelty: .4,
    surprise: .3,
  }, 'operational');

  const learning = makeGate(source);
  const captured = { p31: null, p33: null, p34: null };
  const p31 = core.selfSubsystem.p31Consciousness;
  const p33 = core.selfSubsystem.p33Personhood;
  const p34 = core.selfSubsystem.p34Personhood;
  const p31Original = p31.observeOutcome.bind(p31);
  const p33Original = p33.observeOutcome.bind(p33);
  const p34Original = p34.integrateOutcome.bind(p34);
  p31.observeOutcome = (input) => { captured.p31 = input; return p31Original(input); };
  p33.observeOutcome = (input) => { captured.p33 = input; return p33Original(input); };
  p34.integrateOutcome = (input) => { captured.p34 = input; return p34Original(input); };

  await core.feedback({
    success: 1,
    reward: 1,
    surprise: .9,
    evidenceSource: source === 'external' ? 'external-api' : 'unknown',
    learning,
  });
  return { learning, captured };
}

const simulation = await capture('simulation');
const external = await capture('external');

for (const key of ['p31', 'p33', 'p34']) {
  assert(simulation.captured[key], `${key} simulation capture missing`);
  assert(external.captured[key], `${key} external capture missing`);
}

assert.equal(simulation.captured.p31.reward01, simulation.learning.reward01);
assert.equal(simulation.captured.p31.success01, simulation.learning.success01);
assert.equal(simulation.captured.p31.surprise01, simulation.learning.surprise01);
assert.equal(external.captured.p31.reward01, external.learning.reward01);
assert.equal(external.captured.p33.reward01, external.learning.reward01);
assert.equal(external.captured.p34.reward01, external.learning.reward01);
assert.equal(external.captured.p33.success01, external.learning.success01);
assert.equal(external.captured.p34.success01, external.learning.success01);
assert(simulation.captured.p31.reward01 < external.captured.p31.reward01, 'simulation reward gate should be weaker');
assert(simulation.captured.p33.reward01 < external.captured.p33.reward01, 'simulation personhood reward gate should be weaker');
assert(simulation.captured.p34.evidenceWeight01 < external.captured.p34.evidenceWeight01, 'simulation personhood evidence gate should be weaker');

console.log(JSON.stringify({
  pass: true,
  simulation: {
    reward01: simulation.learning.reward01,
    success01: simulation.learning.success01,
    surprise01: simulation.learning.surprise01,
    p34Evidence01: simulation.captured.p34.evidenceWeight01,
  },
  external: {
    reward01: external.learning.reward01,
    success01: external.learning.success01,
    surprise01: external.learning.surprise01,
    p34Evidence01: external.captured.p34.evidenceWeight01,
  },
}, null, 2));
