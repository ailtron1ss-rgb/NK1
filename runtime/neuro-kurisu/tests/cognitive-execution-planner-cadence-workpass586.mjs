import assert from 'node:assert/strict';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { organismSystemContracts } from '../src/organism/core/OrganismSystemContract.ts';

const domains = {
  self: true, world: true, memory: true, agency: true,
  embodiment: true, research: true, governance: true,
};
const frame = {
  version: 1,
  tick: 8,
  at: 2_000_000_000_000,
  externalInput: false,
  signalMask: 0,
  domains,
  dirtyDomains: { ...domains },
  attentionBudget01: .9,
  deepDemand01: .2,
  surprise01: .1,
  novelty01: .2,
  predictionError01: .2,
  uncertainty01: .3,
  goalPressure01: .2,
  energy01: .9,
  cognitiveCapacity01: .9,
  thermal01: .1,
  ramPressure01: .1,
  complexity01: .35,
  expectedInformationGain01: .4,
  wakeMask: 0,
  reason: 'cadence-weight-regression',
};
const spine = {
  mode: 'balanced',
  run: { research: true, 'world-rollout': true, shadow: true, project: true },
  cadence: { research: 8, 'world-rollout': 3, shadow: 2, project: 2 },
  reason: 'fixture',
};
const contracts = organismSystemContracts();
const compileWithResearchCadence = cadenceCycles => {
  const planner = new CognitiveExecutionPlanner();
  const adjustedContracts = contracts.map(contract => ({
    ...contract,
    cadenceCycles: contract.name === 'research' ? cadenceCycles : contract.cadenceCycles,
  }));
  return planner.compile(frame, spine, .8, undefined, adjustedContracts);
};

const everyTickResearch = compileWithResearchCadence(1);
const everyEighthTickResearch = compileWithResearchCadence(8);
const fastShare = everyTickResearch.metabolism.research.budgetShare01;
const slowShare = everyEighthTickResearch.metabolism.research.budgetShare01;

assert.ok(fastShare > slowShare,
  'a domain scheduled once every eight cycles must receive a lower metabolism share than an every-cycle domain');
assert.ok(fastShare - slowShare > .01,
  'cadence discount must materially change domain budgeting rather than being a no-op');
for (const plan of [everyTickResearch, everyEighthTickResearch]) {
  const totalShare = Object.values(plan.metabolism).reduce((sum, item) => sum + item.budgetShare01, 0);
  assert.ok(Math.abs(totalShare - 1) < 1e-6, 'cadence weighting must preserve normalized domain budget shares');
}
assert.equal(everyTickResearch.tick, everyEighthTickResearch.tick);
console.log('COGNITIVE_EXECUTION_PLANNER_CADENCE=PASS', JSON.stringify({ fastShare, slowShare }));
