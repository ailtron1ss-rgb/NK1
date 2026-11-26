import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const prediction = {
  action: 'respond',
  utility01: 0.82,
  confidence01: 0.88,
  uncertainty01: 0.16,
};

test('AURORA requests a bounded observation when the canonical world is unresolved', () => {
  const runtime = new WorldSubsystemRuntime();
  const decision = runtime.evaluateAuroraDecision({
    prediction,
    budget: { attention01: 0.8, energy01: 0.8, privacyTolerance01: 0.2, maxObservationCost01: 0.6 },
    observations: [{
      id: 'recheck-world', kind: 'observe', informationGain01: 0.96,
      cost01: 0.18, privacyRisk01: 0.05, latencyCost01: 0.08, interruptCost01: 0.02,
    }],
  });

  assert.equal(decision.directive, 'observe');
  assert.equal(decision.selectedObservationId, 'recheck-world');
  assert.equal(decision.worldRevision, 0);
  assert.equal(runtime.auroraKernel.snapshot().observed, 1);
});

test('the canonical decision prediction carries AURORA confidence and planning guidance', () => {
  const runtime = new WorldSubsystemRuntime();
  const result = runtime.predictForDecision('respond', 0.8, 0.2);

  assert.equal(result.action, 'respond');
  assert.ok(Number.isFinite(result.utility));
  assert.ok(Number.isFinite(result.confidence));
  assert.ok(Number.isFinite(result.recommendedHorizon));
  assert.ok(result.auroraDecision);
  assert.ok(result.reasons.some(reason => reason.startsWith('aurora-')));
  const ticket = runtime.unifiedLatentWorldState.snapshot().predictions.find(item => item.id === result.predictionId);
  assert.ok(ticket);
  assert.equal(ticket.horizon, result.recommendedHorizon);
  assert.equal(ticket.sourcePredictionId, result.sourcePredictionId);
  assert.equal(runtime.auroraKernel.snapshot().decisions, 1);
});

test('AURORA telemetry survives the existing WorldSubsystemRuntime persistence boundary', () => {
  const source = new WorldSubsystemRuntime();
  source.evaluateAuroraDecision({ prediction, observations: [] });
  const persisted = source.snapshot();
  assert.equal(persisted.auroraKernel.decisions, 1);

  const restored = new WorldSubsystemRuntime();
  restored.restoreFromPersisted({ advanced: persisted });
  assert.equal(restored.auroraKernel.snapshot().decisions, 1);
  assert.equal(restored.auroraKernel.snapshot().lastDirective, 'abstain');
});