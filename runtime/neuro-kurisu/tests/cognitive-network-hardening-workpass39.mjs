import assert from 'node:assert/strict';
import { CognitiveNetworkBus, affectWorkspaceActionBias } from '../src/organism/cognition/CognitiveNetworkBus.ts';

const bus = new CognitiveNetworkBus();
const broadcast = bus.stimulate([
  { specialist: 'memory', score: .72, confidence: .8, target: 'recall user preference', evidence: ['fact:1'], energyCost: .12 },
  { specialist: 'memory', score: .91, confidence: .7, target: 'stronger memory candidate', evidence: ['fact:2'], energyCost: .24 },
  { specialist: 'language', score: Number.NaN, confidence: Number.POSITIVE_INFINITY, target: 'invalid numbers', evidence: ['bad'], energyCost: Number.NaN },
  { specialist: 'unknown-plugin', score: 1, confidence: 1, target: 'untrusted', evidence: ['should be dropped'], energyCost: 0 },
  { specialist: 'executive', score: .81, confidence: .84, target: 'plan next safe step', evidence: Array.from({ length: 50 }, (_, index) => `evidence-${index}`), energyCost: .2 },
], 5, Number.NaN);
assert.ok(Number.isFinite(broadcast.broadcastGain));
assert.ok(broadcast.broadcastGain >= 0 && broadcast.broadcastGain <= 1);
assert.equal(broadcast.selected.filter(x => x.specialist === 'memory').length, 1, 'duplicate specialist signals are collapsed');
assert.equal(broadcast.selected.some(x => x.specialist === ('unknown-plugin')), false, 'unknown specialist is rejected');
for (const signal of broadcast.selected) {
  assert.ok(Number.isFinite(signal.score));
  assert.ok(Number.isFinite(signal.confidence));
  assert.ok(Number.isFinite(signal.energyCost));
  assert.ok(signal.evidence.length <= 12);
  assert.ok(signal.evidence.every(text => text.length <= 240));
}
const snapshot = bus.snapshot();
snapshot.capacity = Number.NaN;
snapshot.tick = Number.POSITIVE_INFINITY;
snapshot.totalIgnitions = Number.NaN;
snapshot.lastBroadcast.weights.memory = Number.NaN;
snapshot.lastBroadcast.selected = [
  { specialist: 'memory', score: .32, confidence: .4, target: 'old weak', evidence: ['weak'], energyCost: .1 },
  { specialist: 'memory', score: .93, confidence: .9, target: 'strong evidence', evidence: ['strong'], energyCost: .02 },
  { specialist: 'executive', score: .61, confidence: .8, target: 'execute', evidence: [], energyCost: .1 },
];
snapshot.lastBroadcast.winner = 'social'; // invalid for the restored selected set; derive from selected signals.
snapshot.history.push({ id: 'bad', winner: 'bad', selected: [{ specialist: 'nope', score: Infinity }], weights: { memory: NaN } });
const restored = new CognitiveNetworkBus();
restored.restore(snapshot);
const normalized = restored.snapshot();
assert.ok(Number.isFinite(normalized.tick));
assert.ok(normalized.capacity >= 1 && normalized.capacity <= 5);
assert.ok(Number.isFinite(normalized.totalIgnitions));
assert.equal(normalized.history.some(row => row.winner === 'bad'), false);
assert.equal(new Set(normalized.lastBroadcast?.selected.map(signal => signal.specialist)).size, normalized.lastBroadcast?.selected.length, 'restoration must remove duplicate specialist signal records');
assert.equal(normalized.lastBroadcast?.selected.find(signal => signal.specialist === 'memory')?.target, 'strong evidence', 'restoration must retain the strongest duplicate evidence');
assert.equal(normalized.lastBroadcast?.winner, 'memory', 'winner must belong to the normalized selected set');
for (const value of Object.values(normalized.lastBroadcast?.weights ?? {})) assert.ok(Number.isFinite(value));
// Confidence and energy are first-class contributors to global attention, not decorative fields.
const appraisalBus = new CognitiveNetworkBus();
const confidenceBroadcast = appraisalBus.stimulate([
  { specialist: 'executive', score: .84, confidence: .10, target: 'high-score-low-confidence', evidence: [], energyCost: 0 },
  { specialist: 'memory', score: .75, confidence: .98, target: 'slightly-lower-score-high-confidence', evidence: [], energyCost: .05 },
], 6, 1);
assert.equal(confidenceBroadcast.winner, 'memory', 'calibrated confidence can beat a slightly higher but poorly grounded score');
const energyBus = new CognitiveNetworkBus();
const energyBroadcast = energyBus.stimulate([
  { specialist: 'executive', score: .83, confidence: 1, target: 'expensive-plan', evidence: [], energyCost: 1 },
  { specialist: 'memory', score: .77, confidence: 1, target: 'lower-cost-alternative', evidence: [], energyCost: 0 },
], 7, 1);
assert.equal(energyBroadcast.winner, 'memory', 'high energy cost is penalized while remaining a soft constraint');
assert.ok(confidenceBroadcast.rationale.some(item => item.includes('confidence')));

const affectBroadcast = appraisalBus.stimulate([
  { specialist: 'affect', score: .94, confidence: .86, target: 'anxiety', evidence: ['tendency=verify'], energyCost: .08 },
  { specialist: 'executive', score: .78, confidence: .78, target: 'safest next step', evidence: [], energyCost: .08 },
], 8, 1);
assert.ok(affectBroadcast.selected.some(signal => signal.specialist === 'affect'));
assert.ok(affectWorkspaceActionBias(affectBroadcast, 'verify', 'verify') > 0, 'broadcast affect may contribute a bounded tendency-compatible action prior');
assert.equal(affectWorkspaceActionBias(affectBroadcast, 'verify', 'explore'), 0, 'affect prior cannot push an unrelated action');
assert.equal(affectWorkspaceActionBias({ ...affectBroadcast, selected: affectBroadcast.selected.filter(signal => signal.specialist !== 'affect') }, 'verify', 'verify'), 0, 'unselected affect signal cannot influence action scoring');
assert.ok(affectWorkspaceActionBias(affectBroadcast, 'verify', 'verify') <= .035);
console.log('COGNITIVE_NETWORK_HARDENING_WORKPASS39=PASS finite-inputs=PASS dedupe=PASS confidence-ranking=PASS energy-ranking=PASS restore-normalization=PASS affect-action-coupling=PASS');
