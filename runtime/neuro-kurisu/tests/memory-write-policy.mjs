import assert from 'node:assert/strict';
import { MemoryWritePolicy, resolveMemoryWritePolicyMode } from '../src/organism/system/MemoryWritePolicy.ts';

const quiet = { mode: 'shadow' };

// --- mode resolution ---
{
  assert.equal(resolveMemoryWritePolicyMode(undefined), 'shadow');
  assert.equal(resolveMemoryWritePolicyMode('ACTIVE'), 'active');
  assert.equal(resolveMemoryWritePolicyMode('off'), 'off');
  assert.equal(resolveMemoryWritePolicyMode('nonsense'), 'shadow');
}

// --- shadow mode records decisions but stays inside the bounded gain window ---
{
  const policy = new MemoryWritePolicy(quiet);
  for (let tick = 1; tick <= 20; tick++) {
    const decision = policy.decide({ tick, id: `mem-${tick}`, salience01: 0.5, predictionError01: tick % 2 ? 0.1 : 0.8, dormant: false });
    assert.equal(decision.mode, 'shadow');
    assert.ok(decision.writeGain01 >= 0.75 && decision.writeGain01 <= 1.25, `gain out of bounds: ${decision.writeGain01}`);
    assert.ok(decision.reliability01 >= 0 && decision.reliability01 <= 1);
    policy.observeOutcome({ tick, id: `mem-${tick}`, success01: 0.6, predictionError01: tick % 2 ? 0.1 : 0.8, retentionScore01: 0.5 });
  }
  const diagnostics = policy.diagnostics();
  assert.equal(diagnostics.decisions, 20);
  assert.equal(diagnostics.activeDecisions, 0);
  assert.equal(diagnostics.shadowDecisions, 20);
  assert.ok(diagnostics.meanWriteGain01 >= 0.75 && diagnostics.meanWriteGain01 <= 1.25);
  assert.ok(diagnostics.regimeShifts > 0, 'alternating error levels must register as a regime shift');
  assert.equal(diagnostics.hippo.order, 8);
}

// --- off mode: no decisions, no growth ---
{
  const policy = new MemoryWritePolicy({ mode: 'off' });
  for (let tick = 1; tick <= 5; tick++) policy.decide({ tick, id: `m-${tick}`, salience01: 0.4, predictionError01: 0.3 });
  const diagnostics = policy.diagnostics();
  assert.equal(diagnostics.decisions, 0);
  assert.equal(diagnostics.recent.length, 0);
}

// --- active mode applies and counts separately ---
{
  const policy = new MemoryWritePolicy({ mode: 'active' });
  const decision = policy.decide({ tick: 1, id: 'a-1', salience01: 0.6, predictionError01: 0.2 });
  assert.equal(decision.mode, 'active');
  assert.equal(policy.diagnostics().activeDecisions, 1);
  assert.equal(policy.diagnostics().shadowDecisions, 0);
}

// --- revival requires evidence: enough observations and a stable error/update history ---
{
  const policy = new MemoryWritePolicy({ mode: 'active' });
  const first = policy.decide({ tick: 1, id: 'revive', salience01: 0.6, predictionError01: 0.1, dormant: true });
  assert.equal(first.promote, false, 'a memory with no history must not be revived');

  for (let tick = 2; tick <= 10; tick++) {
    policy.observeOutcome({ tick, id: 'revive', success01: 0.7, predictionError01: 0.05, retentionScore01: 0.6 });
  }
  const second = policy.decide({ tick: 11, id: 'revive', salience01: 0.6, predictionError01: 0.05, dormant: true });
  assert.equal(second.promote, true, 'a stable, repeatedly observed memory may be revived');
  assert.equal(second.reason, 'revived-stable-memory');
  assert.ok(policy.diagnostics().promotions >= 1);

  const noisy = new MemoryWritePolicy({ mode: 'active' });
  for (let tick = 1; tick <= 10; tick++) noisy.observeOutcome({ tick, id: 'noisy', success01: 0.5, predictionError01: 0.95, retentionScore01: 0.6 });
  assert.equal(noisy.decide({ tick: 11, id: 'noisy', salience01: 0.6, predictionError01: 0.95, dormant: true }).promote, false, 'an unstable error history must block revival');
}

// --- snapshot/restore round-trip, bounded tracking, garbage tolerance ---
{
  const policy = new MemoryWritePolicy({ mode: 'active', perIdLimit: 16, recentLimit: 8 });
  for (let tick = 1; tick <= 40; tick++) {
    policy.decide({ tick, id: `bounded-${tick}`, salience01: 0.5, predictionError01: 0.2 });
    policy.observeOutcome({ tick, id: `bounded-${tick}`, success01: 0.5, predictionError01: 0.2, retentionScore01: 0.5 });
  }
  const snapshot = policy.snapshot();
  assert.ok(Object.keys(snapshot.perId).length <= 16, 'per-memory tracking must stay bounded');
  assert.ok(snapshot.recent.length <= 8, 'recent decisions must stay bounded');

  const restored = new MemoryWritePolicy({ mode: 'active', perIdLimit: 16, recentLimit: 8 });
  restored.restore(snapshot);
  const before = policy.diagnostics();
  const after = restored.diagnostics();
  assert.equal(after.decisions, before.decisions);
  assert.equal(after.promotions, before.promotions);
  assert.equal(after.hippo.stateNorm.toFixed(9), before.hippo.stateNorm.toFixed(9));
  assert.equal(restored.getMode(), 'active');

  const dirty = new MemoryWritePolicy();
  dirty.restore({ version: 1, decisions: -10, meanWriteGain01: 99, perId: { x: { observations: -1, lastError01: 42 } }, recent: 'nope' });
  const diagnostics = dirty.diagnostics();
  assert.equal(diagnostics.decisions, 0);
  assert.ok(diagnostics.meanWriteGain01 <= 1.25);
  assert.equal(diagnostics.recent.length, 0);
}

console.log('MEMORY_WRITE_POLICY=PASS');
