import assert from 'node:assert/strict';
import { AdaptiveMemoryPolicy, defaultAdaptiveMemoryPolicy } from '../src/organism/developmental/AdaptiveMemoryPolicy.ts';
import { AutonomousRelationshipManager, defaultAutonomousRelationship } from '../src/organism/system/AutonomousRelationshipManager.ts';
import { CapabilitySelfModelGraph, defaultCapabilitySelfModel } from '../src/organism/system/CapabilitySelfModelGraph.ts';
import { HybridNeuroCognitiveLoop, defaultHybridNeuroCognitive } from '../src/organism/system/HybridNeuroCognitiveLoop.ts';
import { PlasticityHomeostasisGovernor, defaultPlasticityHomeostasis } from '../src/organism/system/PlasticityHomeostasisGovernor.ts';

/**
 * WorkPass72 — residual spread-restore cluster: adaptive memory policy,
 * autonomous relationship manager, capability self-model graph, hybrid
 * neuro-cognitive loop and plasticity homeostasis governor. These were the last
 * owners merging a persisted snapshot with a bare/partial spread, letting
 * NaN/negative/hostile values reach policy weights, contact maps, capability
 * nodes and homeostasis scalars.
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- AdaptiveMemoryPolicy ---------------------------------------------------
{
  const m = new AdaptiveMemoryPolicy();
  m.restore({ version: 2, weights: { semantic: 9, hybrid: 'x' }, trials: { semantic: -1 },
    reward: { causal: 9 }, lastPolicy: 'bogus', lastContextKey: 5, cooldownUntil: 'x',
    contextValue: { k: { semantic: 9, hybrid: 'x' } }, contextTrials: { k: { causal: -1 } } });
  const st = m.snapshot();
  assert.equal(st.weights.semantic, 1, 'amp over-1 weight -> 1');
  assert.equal(st.weights.hybrid, .5, 'amp non-number weight -> default');
  assert.equal(st.trials.semantic, 0, 'amp negative trials -> 0');
  assert.equal(st.reward.causal, 1, 'amp over-1 reward -> 1');
  assert.equal(st.lastPolicy, 'balanced', 'amp unknown policy -> default');
  assert.equal(typeof st.lastContextKey, 'string', 'amp non-string context key -> default');
  assert.equal(st.contextValue.k.semantic, 1, 'amp over-1 context value -> 1');
  assert.equal(st.contextTrials.k.causal, 0, 'amp negative context trials -> 0');
  assert.doesNotThrow(() => m.restore(hostile('contextValue')));
  m.restore(defaultAdaptiveMemoryPolicy().snapshot());
  assert.deepEqual(m.snapshot(), defaultAdaptiveMemoryPolicy().snapshot(), 'amp default round-trips');
}

// --- AutonomousRelationshipManager ------------------------------------------
{
  const m = new AutonomousRelationshipManager();
  m.restore({ version: 1, cycles: -1, meanSocialNeed01: 9,
    contacts: { a: { trust01: 9, interactions: -1, pendingFollowUp: 'yes' }, b: 'x' } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'arm negative cycles -> 0');
  assert.equal(st.meanSocialNeed01, 1, 'arm over-1 social need -> 1');
  assert.ok(st.contacts.a, 'arm keeps object contact');
  assert.equal(st.contacts.a.trust01, 1, 'arm over-1 trust -> 1');
  assert.equal(st.contacts.a.interactions, 0, 'arm negative interactions -> 0');
  assert.equal(st.contacts.a.pendingFollowUp, false, 'arm non-boolean followUp -> false');
  assert.equal(st.contacts.b, undefined, 'arm drops non-object contacts');
  assert.doesNotThrow(() => m.restore(hostile('contacts')));
  m.restore(defaultAutonomousRelationship());
  assert.deepEqual(m.snapshot(), defaultAutonomousRelationship(), 'arm default round-trips');
}

// --- CapabilitySelfModelGraph -----------------------------------------------
{
  const m = new CapabilitySelfModelGraph();
  m.restore({ version: 1, cycles: -1, calibration01: 9, lastGap: 5,
    nodes: { prediction: { competence01: 9, attempts: -1 }, bad: 'x' } });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'csmg negative cycles -> 0');
  assert.equal(st.calibration01, 1, 'csmg over-1 calibration -> 1');
  assert.equal(typeof st.lastGap, 'string', 'csmg non-string lastGap -> default');
  assert.ok(st.nodes.prediction, 'csmg keeps object node');
  assert.equal(st.nodes.prediction.competence01, 1, 'csmg over-1 competence -> 1');
  assert.equal(st.nodes.prediction.attempts, 0, 'csmg negative attempts -> 0');
  assert.equal(st.nodes.bad, undefined, 'csmg drops non-object nodes');
  assert.doesNotThrow(() => m.restore(hostile('nodes')));
  m.restore(defaultCapabilitySelfModel());
  assert.deepEqual(m.snapshot(), defaultCapabilitySelfModel(), 'csmg default round-trips');
}

// --- HybridNeuroCognitiveLoop -----------------------------------------------
{
  const m = new HybridNeuroCognitiveLoop();
  m.restore({ version: 1, cycles: -1, fusion01: 9, lastDomain: 5 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'hncl negative cycles -> 0');
  assert.equal(st.fusion01, 1, 'hncl over-1 fusion -> 1');
  assert.equal(typeof st.lastDomain, 'string', 'hncl non-string domain -> default');
  assert.doesNotThrow(() => m.restore(hostile('fusion01')));
  m.restore(defaultHybridNeuroCognitive());
  assert.deepEqual(m.snapshot(), defaultHybridNeuroCognitive(), 'hncl default round-trips');
}

// --- PlasticityHomeostasisGovernor ------------------------------------------
{
  const m = new PlasticityHomeostasisGovernor();
  m.restore({ version: 1, cycles: -1, plasticity01: 9, lastPressure01: 9 });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'phg negative cycles -> 0');
  assert.equal(st.plasticity01, 1, 'phg over-1 plasticity -> 1');
  assert.equal(st.lastPressure01, 1, 'phg over-1 pressure -> 1');
  assert.doesNotThrow(() => m.restore(hostile('plasticity01')));
  m.restore(defaultPlasticityHomeostasis());
  assert.deepEqual(m.snapshot(), defaultPlasticityHomeostasis(), 'phg default round-trips');
}

console.log('WORKPASS72_AMP_ARM_CSMG_HNCL_PHG_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['AdaptiveMemoryPolicy', 'AutonomousRelationshipManager', 'CapabilitySelfModelGraph', 'HybridNeuroCognitiveLoop', 'PlasticityHomeostasisGovernor'] }));
