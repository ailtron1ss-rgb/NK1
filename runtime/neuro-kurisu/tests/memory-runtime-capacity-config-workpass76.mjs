import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { P75MemoryContinuumOS } from '../src/organism/developmental/P75MemoryContinuumOS.ts';
import { P70MemoryLifecycleGovernor } from '../src/organism/developmental/P70MemoryLifecycleGovernor.ts';
import { CanonicalMemoryLifecycleAuthority } from '../src/organism/memory/CanonicalMemoryLifecycleAuthority.ts';

const originalCap = process.env.NEURO_MEMORY_ITEM_CAP;
const originalBytes = process.env.NEURO_MEMORY_BYTE_BUDGET;

function configured(cap, bytes) {
  if (cap === null) delete process.env.NEURO_MEMORY_ITEM_CAP;
  else process.env.NEURO_MEMORY_ITEM_CAP = cap;
  if (bytes === null) delete process.env.NEURO_MEMORY_BYTE_BUDGET;
  else process.env.NEURO_MEMORY_BYTE_BUDGET = bytes;
  const runtime = new MemorySubsystemRuntime();
  return {
    itemCap: runtime.memoryItemCap,
    byteBudget: runtime.memoryByteBudget,
    diagnosticCap: runtime.memoryOS.capacityDiagnostics().hardCap,
  };
}

try {
  assert.deepEqual(configured(null, null), {
    itemCap: 1_600, byteBudget: 1_048_576, diagnosticCap: 1_600,
  }, 'the default organism profile must remain 1,600 rows / 1 MiB');

  assert.deepEqual(configured('10000', null), {
    itemCap: 10_000, byteBudget: 7_200_000, diagnosticCap: 10_000,
  }, 'an explicit 10k profile must scale the canonical byte budget to 7.2 MB');

  assert.deepEqual(configured('10000', '6000000'), {
    itemCap: 10_000, byteBudget: 6_000_000, diagnosticCap: 10_000,
  }, 'operators may explicitly choose a lower bounded byte budget');

  assert.deepEqual(configured('50000', '99999999'), {
    itemCap: 10_000, byteBudget: 8_388_608, diagnosticCap: 10_000,
  }, 'both host limits must clamp to their documented maximums');

  assert.deepEqual(configured('64', '1'), {
    itemCap: 128, byteBudget: 262_144, diagnosticCap: 128,
  }, 'both host limits must clamp to safe minimums');

  assert.deepEqual(configured('not-a-number', 'not-a-number'), {
    itemCap: 1_600, byteBudget: 1_048_576, diagnosticCap: 1_600,
  }, 'invalid host values must fail back to the default profile');

  const p70 = new P70MemoryLifecycleGovernor();
  const lifecycleInput = {
    tick: 1, at: 1, traces: 0, events: 0, goals: 0, memories: 0,
    semanticItems: 0, workingSet01: 0, energy01: 1, pressure01: 0,
  };
  const p70Default = p70.plan(lifecycleInput);
  assert.equal(p70Default.budgets.memories, 440,
    'P70 must preserve its historical 440-row normal-pressure default');
  const p70Expanded = p70.plan({ ...lifecycleInput, canonicalCapacity: 10_000 });
  assert.ok(p70Expanded.budgets.memories > 8_000,
    'P70 must preserve expanded canonical memory instead of silently forcing the legacy 640-row budget');
  assert.ok(p70Expanded.budgets.memories <= 10_000,
    'P70 must never exceed the validated 10k canonical cap');
  const p70Clamped = p70.plan({ ...lifecycleInput, canonicalCapacity: 50_000 });
  assert.ok(p70Clamped.budgets.memories <= 10_000,
    'P70 must clamp unsafe capacity values');

  let observedMaintenance;
  const authority = new CanonicalMemoryLifecycleAuthority(
    { maintain: (options) => { observedMaintenance = options; return { skipped: false, changed: 0 }; } },
    p70,
    {},
  );
  authority.run({
    ...lifecycleInput,
    canonicalCapacity: 10_000,
    byteBudget: 7_200_000,
  });
  assert.equal(observedMaintenance.maxItems, p70Expanded.budgets.memories);
  assert.equal(observedMaintenance.byteBudget, 7_200_000,
    'the lifecycle authority must forward the configured byte budget to MemoryFabric');

  const p75 = new P75MemoryContinuumOS();
  const defaultPlan = p75.plan({
    tick: 1, pressure01: 0, recentEpisodes: 32, semanticNodes: 10_000,
    activeGoals: 100, energy01: 1, textPresent: true,
    experienceHot: 96, experienceWarm: 320, experienceCold: 1_024,
  });
  assert.ok(defaultPlan.canonicalBudget <= 1_600,
    'P75 must retain its historical default cap when no capacity profile is supplied');

  const expandedPlan = p75.plan({
    tick: 2, pressure01: 0, recentEpisodes: 32, semanticNodes: 10_000,
    activeGoals: 100, energy01: 1, textPresent: true,
    experienceHot: 96, experienceWarm: 320, experienceCold: 1_024,
    canonicalCapacity: 10_000,
  });
  assert.ok(expandedPlan.canonicalBudget > 1_600,
    'P75 must honor an explicit expanded canonical capacity');
  assert.ok(expandedPlan.canonicalBudget <= 10_000,
    'P75 canonical budget must never exceed the validated host cap');

  const clampedPlan = p75.plan({
    tick: 3, pressure01: 0, recentEpisodes: 32, semanticNodes: 10_000,
    activeGoals: 100, energy01: 1, textPresent: true,
    experienceHot: 96, experienceWarm: 320, experienceCold: 1_024,
    canonicalCapacity: 50_000,
  });
  assert.ok(clampedPlan.canonicalBudget <= 10_000,
    'P75 must clamp unsafe expanded capacities');
} finally {
  if (originalCap === undefined) delete process.env.NEURO_MEMORY_ITEM_CAP;
  else process.env.NEURO_MEMORY_ITEM_CAP = originalCap;
  if (originalBytes === undefined) delete process.env.NEURO_MEMORY_BYTE_BUDGET;
  else process.env.NEURO_MEMORY_BYTE_BUDGET = originalBytes;
}

console.log('MEMORY_RUNTIME_CAPACITY_CONFIG_WORKPASS76=PASS', JSON.stringify({
  default: { itemCap: 1_600, byteBudget: 1_048_576 },
  explicit10k: { itemCap: 10_000, derivedByteBudget: 7_200_000 },
  explicitByteBudget: 6_000_000,
  maximum: { itemCap: 10_000, byteBudget: 8_388_608 },
  minimum: { itemCap: 128, byteBudget: 262_144 },
  invalidFallback: { itemCap: 1_600, byteBudget: 1_048_576 },
  env: ['NEURO_MEMORY_ITEM_CAP', 'NEURO_MEMORY_BYTE_BUDGET'],
  canonicalOwner: 'MemorySubsystemRuntime.memoryOS',
  p75CapacityPropagation: true,
  p70LifecycleCapacityPropagation: true,
  canonicalLifecycleByteBudgetForwarding: true,
}));
