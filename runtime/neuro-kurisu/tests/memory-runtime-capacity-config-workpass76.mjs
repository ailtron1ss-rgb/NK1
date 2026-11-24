import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

const original = process.env.NEURO_MEMORY_ITEM_CAP;
function configured(value) {
  if (value === null) delete process.env.NEURO_MEMORY_ITEM_CAP;
  else process.env.NEURO_MEMORY_ITEM_CAP = value;
  return new MemorySubsystemRuntime().memoryOS.capacityDiagnostics().hardCap;
}

try {
  assert.equal(configured(null), 1_600,
    'the canonical organism memory owner must retain the 1,600-row default');
  assert.equal(configured('10000'), 10_000,
    'the canonical owner must honor the explicit 10k host profile');
  assert.equal(configured('50000'), 10_000,
    'host configuration must be clamped to the supported 10k maximum');
  assert.equal(configured('64'), 128,
    'host configuration must be clamped to the safe minimum');
  assert.equal(configured('not-a-number'), 1_600,
    'invalid host configuration must fail back to the safe default');
} finally {
  if (original === undefined) delete process.env.NEURO_MEMORY_ITEM_CAP;
  else process.env.NEURO_MEMORY_ITEM_CAP = original;
}

console.log('MEMORY_RUNTIME_CAPACITY_CONFIG_WORKPASS76=PASS', JSON.stringify({
  default: 1_600,
  explicit: 10_000,
  maximum: 10_000,
  minimum: 128,
  invalidFallback: 1_600,
  env: 'NEURO_MEMORY_ITEM_CAP',
  canonicalOwner: 'MemorySubsystemRuntime.memoryOS',
}));
