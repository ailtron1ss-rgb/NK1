import assert from 'node:assert/strict';
import { B2513FutureSelfProjectionField, defaultB2513State } from '../src/organism/cognition/B2513FutureSelfProjectionField.ts';
import { B2514MemoryNeedPrioritizer, defaultB2514State } from '../src/organism/cognition/B2514MemoryNeedPrioritizer.ts';
import { B2517SelfAuthoredRuleCompiler, defaultB2517State } from '../src/organism/cognition/B2517SelfAuthoredRuleCompiler.ts';
import { B2519LongHorizonCounterfactualPlanner, defaultB2519State } from '../src/organism/cognition/B2519LongHorizonCounterfactualPlanner.ts';
import { B2520SensorimotorImagination, defaultB2520State } from '../src/organism/cognition/B2520SensorimotorImagination.ts';
import { B2521LearnedGenerativeOrganismLoop, defaultB2521State } from '../src/organism/cognition/B2521LearnedGenerativeOrganismLoop.ts';

/**
 * WorkPass72 — B2513..B2521 self-world model family restore integrity. Each
 * merged a persisted snapshot with a bare spread or structuredClone, letting
 * NaN/hostile values reach action utilities, memory-need scores, compiled rules,
 * plan values, imagination reliability and the generative transition model.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B2513FutureSelfProjectionField -----------------------------------------
{
  const m = new B2513FutureSelfProjectionField();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, rollouts: -1, learningUpdates: NaN, horizon: 99, identityContinuity01: 9, goalConsistency01: -1, futureCoherence01: NaN, predictionError01: 9, actionUtility: { respond: 9, bogus: -1 }, projectionLatent: [9, -1, NaN], counterfactualDiversity01: 9, verifiedProjection01: -1, lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2513 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2513 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2513 NaN cycles -> 0');
  assert.equal(st.horizon, 6, 'b2513 over-range horizon -> 6');
  assert.equal(st.identityContinuity01, 1, 'b2513 over-1 -> 1');
  assert.equal(st.goalConsistency01, 0, 'b2513 negative -> 0');
  assert.equal(st.futureCoherence01, .6, 'b2513 NaN -> default');
  assert.equal(st.actionUtility.respond, 1, 'b2513 over-1 utility -> 1');
  assert.equal(st.actionUtility.bogus, undefined, 'b2513 drops unknown utility key');
  assert.equal(st.projectionLatent.length, 24, 'b2513 projection fixed length 24');
  assert.equal(st.projectionLatent[0], 1, 'b2513 over-1 latent -> 1');
  assert.equal(st.projectionLatent[1], 0, 'b2513 negative latent -> 0');
  assert.equal(st.projectionLatent[2], 0, 'b2513 NaN latent -> 0');
  assert.equal(st.lesionFraction01, 1, 'b2513 over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('actionUtility')));
  const d = defaultB2513State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2513 default round-trips');
}

// --- B2514MemoryNeedPrioritizer ---------------------------------------------
{
  const m = new B2514MemoryNeedPrioritizer();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, ranked: -1, replaySelections: NaN, semanticSelections: -1, meanNeed01: 9, coverage01: -1, budget01: 9, memoryItems: { k1: { key: 5, salience01: 9, surprise01: -1, novelty01: NaN, goalRelevance01: 9, identityRelevance01: -1, predictionError01: NaN, verified01: 9, lastTick: -1, need01: 9, accesses: -1 }, bad: 'x' } });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2514 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2514 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2514 NaN cycles -> 0');
  assert.equal(st.meanNeed01, 1, 'b2514 over-1 need -> 1');
  assert.equal(st.coverage01, 0, 'b2514 negative coverage -> 0');
  assert.equal(st.budget01, 1, 'b2514 over-1 budget -> 1');
  assert.equal(st.memoryItems.k1.key, 'k1', 'b2514 non-string key -> map key');
  assert.equal(st.memoryItems.k1.salience01, 1, 'b2514 over-1 salience -> 1');
  assert.equal(st.memoryItems.k1.surprise01, 0, 'b2514 negative surprise -> 0');
  assert.equal(st.memoryItems.k1.novelty01, .2, 'b2514 NaN novelty -> default');
  assert.equal(st.memoryItems.k1.lastTick, 0, 'b2514 negative lastTick -> 0');
  assert.equal(st.memoryItems.k1.accesses, 0, 'b2514 negative accesses -> 0');
  assert.ok(!('bad' in st.memoryItems), 'b2514 drops non-object item');
  assert.doesNotThrow(() => m.restore(hostile('memoryItems')));
  const d = defaultB2514State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2514 default round-trips');
}

// --- B2517SelfAuthoredRuleCompiler ------------------------------------------
{
  const m = new B2517SelfAuthoredRuleCompiler();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, learningUpdates: -1, consolidations: NaN, rulesCompiled: -1, rules: { r1: { key: 5, action: 'bogus', strength11: 9, evidence01: -1, stability01: NaN, uses: -1, verified: NaN, lastTick: -1 }, bad: 'x' }, selfAuthorship01: 9, ruleReliability01: -1, identitySafety01: NaN, actionBias: { respond: 9, bogus: -1 }, lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2517 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2517 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2517 NaN cycles -> 0');
  assert.equal(st.selfAuthorship01, 1, 'b2517 over-1 -> 1');
  assert.equal(st.ruleReliability01, 0, 'b2517 negative -> 0');
  assert.equal(st.identitySafety01, 1, 'b2517 NaN -> default');
  assert.equal(st.actionBias.respond, .075, 'b2517 bias clamped to .075');
  assert.equal(st.actionBias.bogus, undefined, 'b2517 drops unknown bias key');
  assert.equal(st.rules.r1.key, 'r1', 'b2517 non-string rule key -> map key');
  assert.equal(st.rules.r1.action, 'wait', 'b2517 unknown rule action -> wait');
  assert.equal(st.rules.r1.strength11, 1, 'b2517 over-1 strength -> 1');
  assert.equal(st.rules.r1.evidence01, 0, 'b2517 negative evidence -> 0');
  assert.equal(st.rules.r1.stability01, 0, 'b2517 NaN stability -> 0');
  assert.equal(st.rules.r1.uses, 0, 'b2517 negative uses -> 0');
  assert.ok(!('bad' in st.rules), 'b2517 drops non-object rule');
  assert.doesNotThrow(() => m.restore(hostile('rules')));
  const d = defaultB2517State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2517 default round-trips');
}

// --- B2519LongHorizonCounterfactualPlanner ----------------------------------
{
  const m = new B2519LongHorizonCounterfactualPlanner();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, rollouts: -1, learningUpdates: NaN, horizon: 99, planningConfidence01: 9, counterfactualDiversity01: -1, actionBias: { respond: 9, bogus: -1 }, lastValues: { respond: 9, bogus: -1 }, lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2519 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2519 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2519 NaN cycles -> 0');
  assert.equal(st.horizon, 7, 'b2519 over-range horizon -> 7');
  assert.equal(st.planningConfidence01, 1, 'b2519 over-1 -> 1');
  assert.equal(st.counterfactualDiversity01, 0, 'b2519 negative -> 0');
  assert.equal(st.actionBias.respond, .06, 'b2519 bias clamped to .06');
  assert.equal(st.actionBias.bogus, undefined, 'b2519 drops unknown bias key');
  assert.equal(st.lastValues.respond, 1, 'b2519 over-1 value -> 1');
  assert.equal(st.lastValues.bogus, undefined, 'b2519 drops unknown value key');
  assert.equal(st.lesionFraction01, 1, 'b2519 over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('lastValues')));
  const d = defaultB2519State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2519 default round-trips');
}

// --- B2520SensorimotorImagination -------------------------------------------
{
  const m = new B2520SensorimotorImagination();
  m.restore({ version: 1, enabled: 'no', tick: -1, cycles: NaN, imaginations: -1, learningUpdates: NaN, actionBias: { respond: 9, bogus: -1 }, predictionError01: 9, sensorimotorReliability01: -1, energyCost01: NaN, lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2520 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2520 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2520 NaN cycles -> 0');
  assert.equal(st.imaginations, 0, 'b2520 negative imaginations -> 0');
  assert.equal(st.actionBias.respond, .06, 'b2520 bias clamped to .06');
  assert.equal(st.actionBias.bogus, undefined, 'b2520 drops unknown bias key');
  assert.equal(st.predictionError01, 1, 'b2520 over-1 -> 1');
  assert.equal(st.sensorimotorReliability01, 0, 'b2520 negative -> 0');
  assert.equal(st.energyCost01, .12, 'b2520 NaN cost -> default');
  assert.equal(st.lesionFraction01, 1, 'b2520 over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('actionBias')));
  const d = defaultB2520State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2520 default round-trips');
}

// --- B2521LearnedGenerativeOrganismLoop -------------------------------------
{
  const m = new B2521LearnedGenerativeOrganismLoop();
  m.restore({ version: 2, enabled: 'no', tick: -1, cycles: NaN, rollouts: -1, learningUpdates: NaN, modelUpdates: -1, modelCoverage01: 9, localCoverage01: -1, prototypeCoverage01: NaN, globalCoverage01: 9, transitionConfidence01: -1, generativeAccuracy01: NaN, counterfactualUse01: 9, transitions: -1, recoveryCount: NaN, transitionsTransferred: -1, actionBias: { respond: 9, bogus: -1 }, model: { t1: { n: -1, action: 'bogus', fromKey: 5, toKey: 5, reward01: 9, error01: -1, verified01: NaN, confidence01: 9, lastTick: -1, delta: [9, -1, NaN], from: [9, -1], to: 5 }, bad: 'x' }, lastKey: 5, lastPredicted: [9, -1, NaN], lesionFraction01: 9 });
  const st = m.snapshot();
  assert.equal(st.enabled, true, 'b2521 non-false enabled -> true');
  assert.equal(st.tick, 0, 'b2521 negative tick -> 0');
  assert.equal(st.cycles, 0, 'b2521 NaN cycles -> 0');
  assert.equal(st.modelCoverage01, 1, 'b2521 over-1 coverage -> 1');
  assert.equal(st.localCoverage01, 0, 'b2521 negative local -> 0');
  assert.equal(st.prototypeCoverage01, 0, 'b2521 NaN prototype -> 0');
  assert.equal(st.transitions, 1, 'b2521 recomputes transitions from model');
  assert.equal(st.recoveryCount, 0, 'b2521 NaN recovery -> 0');
  assert.equal(st.actionBias.respond, .10, 'b2521 bias clamped to .10');
  assert.equal(st.actionBias.bogus, undefined, 'b2521 drops unknown bias key');
  assert.equal(st.model.t1.action, 'wait', 'b2521 unknown transition action -> wait');
  assert.equal(st.model.t1.reward01, 1, 'b2521 over-1 reward -> 1');
  assert.equal(st.model.t1.error01, 0, 'b2521 negative error -> 0');
  assert.equal(st.model.t1.verified01, 0, 'b2521 NaN verified -> 0');
  assert.equal(st.model.t1.n, 0, 'b2521 negative n -> 0');
  assert.equal(st.model.t1.fromKey, '', 'b2521 non-string fromKey -> empty');
  assert.equal(st.model.t1.delta.length, 16, 'b2521 delta fixed length 16');
  assert.equal(st.model.t1.delta[0], 1, 'b2521 over-1 delta -> 1');
  assert.equal(st.model.t1.delta[2], 0, 'b2521 NaN delta -> 0');
  assert.deepEqual(st.model.t1.from, [1, 0], 'b2521 from vector sanitized');
  assert.equal(st.model.t1.to, undefined, 'b2521 non-array to -> undefined');
  assert.ok(!('bad' in st.model), 'b2521 drops non-object transition');
  assert.equal(st.lastKey, 'root', 'b2521 non-string lastKey -> default');
  assert.deepEqual(st.lastPredicted, [1, 0, 0], 'b2521 lastPredicted sanitized');
  assert.equal(st.lesionFraction01, 1, 'b2521 over-1 lesion -> 1');
  assert.doesNotThrow(() => m.restore(hostile('model')));
  const d = defaultB2521State();
  m.restore(d);
  assert.deepEqual(m.snapshot(), d, 'b2521 default round-trips');
}

console.log('WORKPASS72_SELFWORLD_PROJECTION_MEMORYNEED_RULES_PLANNER_IMAGINATION_GENERATIVE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B2513FutureSelfProjectionField', 'B2514MemoryNeedPrioritizer', 'B2517SelfAuthoredRuleCompiler', 'B2519LongHorizonCounterfactualPlanner', 'B2520SensorimotorImagination', 'B2521LearnedGenerativeOrganismLoop'] }));
