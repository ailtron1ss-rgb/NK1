import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore());
assert.equal(
  typeof core.omeStroRegistry,
  'function',
  'OrganismCore must expose the canonical OmeStro registry through its runtime composition',
);

console.log('OMESTRO_CORE_RUNTIME=PASS');
