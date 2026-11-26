import assert from 'node:assert/strict';
import { HippoLegsCredit } from '../src/organism/system/HippoLegsCredit.ts';
import { UncertaintyWriteGate } from '../src/organism/system/UncertaintyWriteGate.ts';
import { FastSlowConsolidationGate } from '../src/organism/system/FastSlowConsolidationGate.ts';
import { DeepWorkSelector } from '../src/organism/system/DeepWorkSelector.ts';

// --- HiPPO-LegS history state (ported from neurocore-v143 hippo_credit.py) ---
{
  const hippo = new HippoLegsCredit({ order: 8, dt: 0.1 });
  for (let i = 0; i < 160; i++) hippo.update(1);
  assert.ok(Math.abs(hippo.read() - 1) < 0.02, `constant input must be reconstructed, got ${hippo.read()}`);
  assert.ok(hippo.stateNorm() <= Math.sqrt(8) * 4 + 1e-6, 'state must stay inside the clip bound');

  const zero = new HippoLegsCredit({ order: 8 });
  for (let i = 0; i < 20; i++) zero.update(0);
  assert.equal(zero.read(), 0);

  const a = new HippoLegsCredit({ order: 6 });
  const b = new HippoLegsCredit({ order: 6 });
  for (let i = 0; i < 40; i++) { const signal = Math.sin(i / 5); assert.equal(a.update(signal), b.update(signal)); }
  assert.ok(Number.isFinite(a.read()));

  const restored = new HippoLegsCredit({ order: 6 });
  restored.restore(a.snapshot());
  assert.equal(restored.read(), a.read());
  assert.equal(restored.stateNorm().toFixed(9), a.stateNorm().toFixed(9));

  assert.throws(() => a.update(Number.NaN), /hippo-legs-non-finite-signal/);
  const wrongOrder = new HippoLegsCredit({ order: 4 });
  wrongOrder.restore(a.snapshot());
  assert.equal(wrongOrder.read(), 0, 'order mismatch must reset instead of corrupting state');
}

// --- Uncertainty write gate (ported from neurocore-v143 uncertainty_write.py) ---
{
  const gate = new UncertaintyWriteGate({ varianceDecay01: 0.8 });
  for (let i = 0; i < 30; i++) gate.observe('stable', 0.02);
  for (let i = 0; i < 30; i++) gate.observe('noisy', 0.9);
  assert.ok(gate.gain('stable') > gate.gain('noisy'), 'a reliable channel must out-gain a noisy channel');
  assert.ok(gate.gain('stable') <= 1.5 && gate.gain('stable') >= 0.25);
  assert.ok(gate.gain('noisy') >= 0.25 && gate.gain('noisy') <= 1.5);
  assert.ok(gate.reliability01('stable') >= 0 && gate.reliability01('stable') <= 1);
  assert.equal(gate.gain('unseen'), 1);

  const snapshot = gate.snapshot();
  const restored = new UncertaintyWriteGate({ varianceDecay01: 0.8 });
  restored.restore(snapshot);
  assert.equal(restored.gain('stable'), gate.gain('stable'));
  assert.equal(restored.gain('noisy'), gate.gain('noisy'));
  assert.equal(restored.diagnostics().observations, gate.diagnostics().observations);

  const dirty = new UncertaintyWriteGate();
  dirty.restore({ version: 1, channels: [], variance: { x: -5, y: Number.NaN }, gain: { x: 99 }, observations: -3 });
  assert.ok(dirty.gain('x') <= 1.5, 'restore must clamp out-of-range gains');
  assert.equal(dirty.diagnostics().observations, 0);
}

// --- Fast/slow consolidation gate (ported from neurocore-v143 fast_consolidation.py) ---
{
  const gate = new FastSlowConsolidationGate({ minimumUpdates: 4, maximumErrorNorm: 0.2, maximumUpdateNorm: 0.05 });
  assert.equal(gate.decide({ updateCount: 2, fastNorm: 0.5, lastErrorNorm: 0.01, lastUpdateNorm: 0.01 }).reason, 'insufficient-updates');
  assert.equal(gate.decide({ updateCount: 9, fastNorm: 0.001, lastErrorNorm: 0.01, lastUpdateNorm: 0.01 }).reason, 'fast-norm-too-small');
  assert.equal(gate.decide({ updateCount: 9, fastNorm: 0.5, lastErrorNorm: 0.9, lastUpdateNorm: 0.01 }).reason, 'error-not-stable');
  assert.equal(gate.decide({ updateCount: 9, fastNorm: 0.5, lastErrorNorm: 0.01, lastUpdateNorm: 0.9 }).reason, 'update-not-stable');
  assert.equal(gate.decide({ updateCount: 9, fastNorm: 0.5, lastErrorNorm: 0.01, lastUpdateNorm: 0.01, fast: [1, 2], slow: [1] }).reason, 'shape-mismatch');

  const stable = gate.decide({ updateCount: 9, fastNorm: 0.5, lastErrorNorm: 0.01, lastUpdateNorm: 0.01, fast: [1, 1], slow: [0, 0] });
  assert.equal(stable.promote, true);
  assert.equal(stable.reason, 'promoted');

  const promoted = gate.promote({ updateCount: 9, lastErrorNorm: 0.01, lastUpdateNorm: 0.01, fast: [1, 1], slow: [0, 0], importance: [0, 10] });
  assert.equal(promoted.promoted, true);
  assert.ok(promoted.slow[0] > promoted.slow[1], 'a low-importance coordinate must absorb more of the fast state');
  assert.ok(promoted.slow[0] <= 0.05 + 1e-9, 'blend must stay bounded by the configured blend');

  const blocked = gate.promote({ updateCount: 1, lastErrorNorm: 0, lastUpdateNorm: 0, fast: [1], slow: [0] });
  assert.deepEqual(blocked.slow, [0], 'no promotion may mutate the slow vector');
}

// --- Bounded deep-work selector (ported from neurocore-v143 adaptive_compute.py) ---
{
  const selector = new DeepWorkSelector({ shallowThreshold01: 0.22, minimumDeepFraction01: 0.25, maximumDeepFraction01: 0.5 });
  assert.deepEqual(selector.select([]), { mask: [], deepCount: 0, deepFraction01: 0, reason: 'empty' });
  assert.equal(selector.select([0.1, 0.2, 0.21, 0.2]).reason, 'raised-to-minimum');
  assert.equal(selector.select([0.1, 0.2, 0.21, 0.2]).deepCount, 1);
  assert.equal(selector.select([0.3, 0.1, 0.1, 0.1]).reason, 'threshold');
  assert.equal(selector.select([0.9, 0.9, 0.9, 0.9]).reason, 'capped-at-maximum');
  assert.equal(selector.select([0.9, 0.9, 0.9, 0.9]).deepCount, 2);
  assert.deepEqual(selector.select([0.5, 0.5], { forceDeep: true }).mask, [true, true]);

  const tie = selector.select([0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(tie.mask, [true, true, false, false], 'ties must break by index for reproducibility');

  const difficulty = selector.difficulty({ deltaMagnitude: 10, updateClip: 1, routeEntropy: 0, rank: 2 });
  assert.ok(difficulty >= 0 && difficulty <= 1);
  assert.equal(selector.difficulty({ deltaMagnitude: 0, updateClip: 1, routeEntropy: 0, rank: 2 }), 0);
  const bounds = selector.diagnostics();
  assert.ok(bounds.minimumDeepFraction01 <= bounds.maximumDeepFraction01);
}

console.log('MEMORY_WRITE_PRIMITIVES=PASS');
