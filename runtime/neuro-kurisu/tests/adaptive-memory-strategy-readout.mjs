import assert from 'node:assert/strict';
import { AdaptiveMemoryStrategyReadout, deriveVerifiedStrategyPattern } from '../src/organism/learning/AdaptiveMemoryStrategyReadout.ts';

const item = (overrides = {}) => ({
  id: 'strategy-1',
  content: 'For memory continuity questions, verify the latest persisted state before answering.',
  tags: ['nk:strategy', 'strategy:verify'],
  context: { strategyAction: 'verify', strategyActionBias01: 0.8 },
  kind: 'procedural', createdAt: 100, lastAccessAt: 100, salience: 0.9,
  emotionalWeight: 0, identityRelevance: 0, goalRelevance: 0, socialRelevance: 0,
  predictionError: 0, temperature01: 0.5, confidence: 0.9,
  epistemicStatus: 'fact', source: 'nk:strategy:verify', entities: [], semanticLinks: [],
  temporalLinks: [], causalLinks: [], revisionHistory: [], dormant: false,
  retrievalCount: 0, semanticVector: [], sourceAuthority01: 0.9,
  ...overrides,
});

const readout = new AdaptiveMemoryStrategyReadout();
const prepared = readout.prepare({ items: [item()], query: 'verify latest persisted memory continuity', tick: 7, at: 100 });
assert.equal(prepared.tick, 7);
assert.ok(readout.biasForAction('verify', 7) > 0);
assert.ok(Math.abs(readout.biasForAction('verify', 7)) <= 0.03);
assert.equal(readout.biasForAction('verify', 8), 0, 'stale decision frame must not leak into later ticks');

const withoutMarker = new AdaptiveMemoryStrategyReadout();
withoutMarker.prepare({ items: [item({ tags: ['strategy:verify'], source: 'user', context: { strategyAction: 'verify', strategyActionBias01: 1 } })], query: 'verify persisted memory', tick: 1, at: 100 });
assert.equal(withoutMarker.biasForAction('verify', 1), 0, 'ordinary memories must not influence policy');

const nonIndependent = readout.recordOutcome({ tick: 7, action: 'verify', reward01: 1, verified: true, independent: false, at: 110 });
assert.equal(nonIndependent.accepted, false, 'self-reported outcomes must not update strategies');
const independent = readout.recordOutcome({ tick: 7, action: 'verify', reward01: 1, verified: true, independent: true, at: 120 });
assert.equal(independent.accepted, true);
assert.equal(independent.updated, 1, 'verified outcome updates only the strategy memory linked to the selected action');

const restore = new AdaptiveMemoryStrategyReadout();
restore.restore(readout.snapshot());
assert.equal(restore.diagnostics().owner, 'MemoryOS2');
assert.equal(restore.diagnostics().policyOwner, 'PolicyAuthorityLedger');
assert.ok(restore.diagnostics().maxAbsoluteBias01 <= 0.03);

const independentPatternRows = Array.from({ length: 3 }, (_, index) => ({
  action: 'verify', reward01: 0.78 + index * 0.02, causalStrength01: 0.72,
  learningQuality01: 0.82, stateGrounded: true, provenance: 'external', replayEligible: true,
}));
const promotedPattern = deriveVerifiedStrategyPattern(independentPatternRows);
assert.equal(promotedPattern?.action, 'verify', 'three grounded independent positive outcomes may create a strategy memory');
assert.equal(promotedPattern?.supportCount, 3);
assert.equal(deriveVerifiedStrategyPattern(independentPatternRows.map(row => ({ ...row, provenance: 'runtime-outcome' }))), null,
  'ordinary runtime outcomes cannot mint a verified strategy memory');
assert.equal(deriveVerifiedStrategyPattern(independentPatternRows.map((row, index) => ({ ...row, action: index === 2 ? 'explore' : 'verify' }))), null,
  'mixed action evidence cannot mint a dominant strategy');
assert.equal(deriveVerifiedStrategyPattern(independentPatternRows.map(row => ({ ...row, reward01: 0.54 }))), null,
  'weak outcome reward cannot mint a positive strategy memory');

const bounded = new AdaptiveMemoryStrategyReadout();
for (let batch = 0; batch < 3; batch++) {
  const items = Array.from({ length: 100 }, (_, index) => item({
    id: `strategy-${batch}-${index}`,
    createdAt: 100 + batch,
    source: 'nk:strategy:verify',
  }));
  bounded.prepare({ items, query: 'verify latest persisted memory continuity', tick: batch + 1, at: 100 + batch });
}
assert.ok(bounded.snapshot().entries && Object.keys(bounded.snapshot().entries).length <= 192,
  'strategy readout state must stay bounded across many unique memories');
console.log('ADAPTIVE_MEMORY_STRATEGY_READOUT=PASS');
