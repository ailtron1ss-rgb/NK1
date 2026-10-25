import assert from 'node:assert/strict';
import { defaultMemoryOS2, MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const makeMemory = () => new MemoryOS2({
  signalFusionProfile: 'balanced',
  embeddingProvider: null,
});

// Malformed persisted budgets must never become NaN and disable future eviction.
const poisoned = makeMemory();
poisoned.restore({ ...defaultMemoryOS2(), byteBudget: Number.NaN });
assert.equal(poisoned.budgetDiagnostics().byteBudget, 524288);
assert.ok(Number.isFinite(poisoned.budgetDiagnostics().byteBudget));

const malformedText = makeMemory();
malformedText.restore({ ...defaultMemoryOS2(), byteBudget: 'not-a-budget' });
assert.equal(malformedText.budgetDiagnostics().byteBudget, 524288);

const infinitePersisted = makeMemory();
infinitePersisted.restore({ ...defaultMemoryOS2(), byteBudget: Number.POSITIVE_INFINITY });
assert.equal(infinitePersisted.budgetDiagnostics().byteBudget, 524288);

// Invalid per-call overrides should fall back to the valid stored budget.
const storedBudget = makeMemory();
storedBudget.restore({ ...defaultMemoryOS2(), byteBudget: 32768 });
assert.equal(storedBudget.enforceByteBudget({ maxBytes: Number.POSITIVE_INFINITY }).budget, 32768);
assert.equal(storedBudget.enforceByteBudget({ maxBytes: Number.NaN }).budget, 32768);
assert.equal(storedBudget.enforceByteBudget({ maxBytes: Number.NEGATIVE_INFINITY }).budget, 32768);
assert.equal(storedBudget.budgetDiagnostics().byteBudget, 32768);

// Finite but too-small values still respect the minimum supported memory budget.
const minimumBudget = makeMemory();
minimumBudget.restore({ ...defaultMemoryOS2(), byteBudget: -1 });
assert.equal(minimumBudget.budgetDiagnostics().byteBudget, 16384);

// Regression: a NaN override previously made (estimatedBytes > budget) false,
// silently skipping eviction even while the stored budget was exceeded.
const overBudget = makeMemory();
const now = Date.now();
overBudget.encode({
  id: 'memory-budget-overflow-fixture',
  content: 'memory budget boundary payload '.repeat(1600),
  kind: 'semantic',
  source: 'memory-budget-restore-integrity-test',
  tags: [],
  context: {},
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.3,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 1000,
  observedAt: now - 500,
});
const snapshot = overBudget.snapshot();
snapshot.byteBudget = 16384;
overBudget.restore(snapshot);
assert.ok(overBudget.budgetDiagnostics().estimatedBytes > 16384,
  'fixture must exceed the stored budget before enforcement');
const enforced = overBudget.enforceByteBudget({ maxBytes: Number.NaN });
assert.equal(enforced.budget, 16384);
assert.ok(enforced.evicted.length > 0,
  'invalid override must fall back to stored budget and preserve eviction behavior');
assert.equal(overBudget.budgetDiagnostics().byteBudget, 16384);
assert.ok(Number.isFinite(overBudget.budgetDiagnostics().utilization01));

console.log('MEMORY_BUDGET_RESTORE_INTEGRITY=PASS', JSON.stringify({
  malformedPersistedBudget: poisoned.budgetDiagnostics().byteBudget,
  invalidOverrideFallback: enforced.budget,
  evictions: enforced.evicted.length,
}));
