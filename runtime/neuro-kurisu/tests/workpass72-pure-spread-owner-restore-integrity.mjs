import assert from 'node:assert/strict';
import { P70MemoryLifecycleGovernor, defaultP70 } from '../src/organism/developmental/P70MemoryLifecycleGovernor.ts';
import { PersistenceProjectionGovernor, defaultPersistenceProjectionState } from '../src/organism/persistence/PersistenceProjectionGovernor.ts';
import { HybridCausalPlasticityCompiler } from '../src/organism/system/HybridCausalPlasticityCompiler.ts';
import { SubstratePortabilityEngine } from '../src/organism/system/SubstratePortabilityEngine.ts';
import { SensorimotorCoSimulationEngine } from '../src/organism/system/SensorimotorCoSimulationEngine.ts';
import { LongitudinalOrganismBenchmarkEngine } from '../src/organism/system/LongitudinalOrganismBenchmarkEngine.ts';
import { SandboxedSelfRewriteEngine } from '../src/organism/system/SandboxedSelfRewriteEngine.ts';

/**
 * WorkPass72 — remaining pure-spread restore owners (memory lifecycle,
 * persistence, plasticity, portability, sensorimotor, longitudinal benchmark,
 * self-rewrite). Each previously merged the persisted snapshot with a bare
 * spread, so NaN reached EMA scalars, counts went negative and enum-like fields
 * took arbitrary values. The self-rewrite and persistence owners are directly on
 * the durable-state and self-improvement boundary.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const poisoned = { version: 1, cycles: NaN, samples: NaN, proposals: NaN, commits: NaN, blocked: NaN, assessments: NaN, simulations: NaN, episodes: NaN, maintenanceRuns: -3, prunedRecords: -1, compactions: Infinity, hotCheckpoints: -5, fullCheckpoints: NaN, dirtyCyclesSinceFull: -2, meanHotLoad01: NaN, meanPressure01: Infinity, meanConfidence01: NaN, meanPortability01: NaN, stateFidelity01: 9, drift01: -1, meanPrediction01: NaN, meanEmbodimentGap01: Infinity, transfer01: -1, meanStability01: NaN, meanTransfer01: 9, identityRetention01: -1, holdout01: NaN, lastAction: 'nonsense', lastDecision: 'nonsense', lastOutcome: 'nonsense', lastTarget: 7, lastAt: -1 };

// --- P70MemoryLifecycleGovernor --------------------------------------------
{
  const g = new P70MemoryLifecycleGovernor();
  const d = defaultP70();
  g.restore({ ...poisoned });
  const st = g.snapshot();
  finite(st.meanHotLoad01, 'P70 hotLoad'); assert.equal(st.meanHotLoad01, d.meanHotLoad01, 'P70 NaN hotLoad falls back');
  finite(st.meanPressure01, 'P70 pressure');
  assert.equal(st.cycles, 0, 'P70 NaN cycles -> 0');
  assert.equal(st.prunedRecords, 0, 'P70 negative pruned -> 0');
  finite(st.compactions, 'P70 compactions');
  assert.equal(st.lastAction, d.lastAction, 'P70 unknown lastAction falls back');
  assert.doesNotThrow(() => g.restore({ get meanHotLoad01() { throw new Error('hostile'); } }));
  g.plan({ tick: 1, at: 10, traces: 0, events: 0, goals: 0, memories: 0, semanticItems: 0, workingSet01: .5, energy01: .5, pressure01: .3 });
  finite(g.snapshot().meanHotLoad01, 'P70 EMA after poisoned restore');
}

// --- PersistenceProjectionGovernor -----------------------------------------
{
  const g = new PersistenceProjectionGovernor();
  const d = defaultPersistenceProjectionState();
  g.restore({ ...poisoned });
  const st = g.snapshot();
  assert.equal(st.hotCheckpoints, 0, 'persistence negative hot -> 0');
  assert.equal(st.fullCheckpoints, 0, 'persistence NaN full -> 0');
  assert.equal(st.dirtyCyclesSinceFull, 0, 'persistence negative dirty -> 0');
  assert.equal(st.lastDecision, d.lastDecision, 'persistence unknown lastDecision falls back');
  assert.equal(st.lastAt, 0, 'persistence negative lastAt -> 0');
  assert.doesNotThrow(() => g.restore({ get hotCheckpoints() { throw new Error('hostile'); } }));
}

// --- HybridCausalPlasticityCompiler ----------------------------------------
{
  const h = new HybridCausalPlasticityCompiler();
  h.restore({ ...poisoned });
  const st = h.summary();
  finite(st.meanConfidence01, 'hybrid confidence'); assert.equal(st.meanConfidence01, .5, 'hybrid NaN confidence falls back');
  assert.equal(st.cycles, 0, 'hybrid NaN cycles -> 0');
  assert.equal(st.commits, 0, 'hybrid NaN commits -> 0');
  assert.equal(st.lastDecision, 'block', 'hybrid unknown lastDecision falls back');
  assert.doesNotThrow(() => h.restore({ get meanConfidence01() { throw new Error('hostile'); } }));
  h.compile({ causal01: .7, localCredit01: .6, stability01: .8, plasticity01: .5, holdout01: .7, phaseFreeze01: .2 });
  finite(h.summary().meanConfidence01, 'hybrid EMA after poisoned restore');
}

// --- SubstratePortabilityEngine --------------------------------------------
{
  const s = new SubstratePortabilityEngine();
  s.restore({ ...poisoned });
  const st = s.summary();
  finite(st.meanPortability01, 'portability mean'); assert.equal(st.meanPortability01, .5, 'portability NaN mean falls back');
  finite(st.stateFidelity01, 'portability fidelity'); assert.ok(st.stateFidelity01 <= 1, 'portability fidelity clamped');
  assert.equal(st.drift01, 0, 'portability negative drift clamps');
  assert.equal(st.lastTarget, 'phone-cpu', 'portability non-string target falls back');
  assert.doesNotThrow(() => s.restore({ get meanPortability01() { throw new Error('hostile'); } }));
}

// --- SensorimotorCoSimulationEngine ----------------------------------------
{
  const s = new SensorimotorCoSimulationEngine();
  s.restore({ ...poisoned });
  const st = s.summary();
  finite(st.meanPrediction01, 'sensorimotor prediction'); assert.equal(st.meanPrediction01, .5, 'sensorimotor NaN prediction falls back');
  finite(st.meanEmbodimentGap01, 'sensorimotor gap');
  assert.equal(st.transfer01, 0, 'sensorimotor negative transfer clamps');
  assert.doesNotThrow(() => s.restore({ get meanPrediction01() { throw new Error('hostile'); } }));
}

// --- LongitudinalOrganismBenchmarkEngine -----------------------------------
{
  const l = new LongitudinalOrganismBenchmarkEngine();
  l.restore({ ...poisoned });
  const st = l.summary();
  finite(st.meanStability01, 'longitudinal stability'); assert.equal(st.meanStability01, .5, 'longitudinal NaN stability falls back');
  finite(st.meanTransfer01, 'longitudinal transfer'); assert.ok(st.meanTransfer01 <= 1, 'longitudinal transfer clamped');
  assert.equal(st.identityRetention01, 0, 'longitudinal negative identity clamps');
  finite(st.holdout01, 'longitudinal holdout');
  assert.doesNotThrow(() => l.restore({ get meanStability01() { throw new Error('hostile'); } }));
}

// --- SandboxedSelfRewriteEngine --------------------------------------------
{
  const s = new SandboxedSelfRewriteEngine();
  s.restore({ ...poisoned });
  const st = s.summary();
  assert.equal(st.cycles, 0, 'self-rewrite NaN cycles -> 0');
  assert.equal(st.proposals, 0, 'self-rewrite NaN proposals -> 0');
  assert.equal(st.rollbacks, 0, 'self-rewrite NaN rollbacks -> 0');
  assert.equal(st.lastOutcome, 'idle', 'self-rewrite unknown outcome falls back');
  finite(st.holdout01, 'self-rewrite holdout');
  assert.doesNotThrow(() => s.restore({ get lastOutcome() { throw new Error('hostile'); } }));
  const valid = { version: 1, cycles: 4, proposals: 3, validated: 1, rejected: 1, rollbacks: 1, lastOutcome: 'validated', holdout01: .7 };
  s.restore(valid);
  assert.deepEqual(s.summary(), valid, 'self-rewrite valid snapshot round-trips');
}

console.log('WORKPASS72_PURE_SPREAD_OWNER_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P70MemoryLifecycleGovernor', 'PersistenceProjectionGovernor', 'HybridCausalPlasticityCompiler', 'SubstratePortabilityEngine', 'SensorimotorCoSimulationEngine', 'LongitudinalOrganismBenchmarkEngine', 'SandboxedSelfRewriteEngine'] }));
