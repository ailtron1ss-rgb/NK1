import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

test('NeuroCore memory system has exactly one writable MemoryOS2 owner', () => {
  const subsystem = new MemorySubsystemRuntime();

  assert.ok(subsystem.memoryOS instanceof MemoryOS2);
  assert.ok(subsystem.fabric instanceof MemoryFabric);

  // These are the same object references passed in MemorySubsystemRuntime's constructor.
  // This prevents a hidden second store from appearing behind MemoryFabric.
  assert.equal(subsystem.fabric.memoryOS, subsystem.memoryOS);
  assert.equal(subsystem.fabric.events, subsystem.events);
  assert.equal(subsystem.fabric.multiTimescale, subsystem.memories);
  assert.equal(subsystem.fabric.substrate, subsystem.memorySubstrate);
  assert.equal(subsystem.fabric.unifiedMemory, subsystem.unifiedMemory);
  assert.equal(subsystem.fabric.p62, subsystem.p62MemoryFabric);
  assert.equal(subsystem.fabric.semanticMemory, subsystem.semanticMemory);
});

test('organism composition exposes the canonical memory runtime, not a parallel one', () => {
  const fabricSource = readFileSync(path.join(root, 'runtime/neuro-kurisu/src/organism/core/OrganismSystemFabric.ts'), 'utf8');
  const coreSource = readFileSync(path.join(root, 'runtime/neuro-kurisu/src/organism/core/OrganismCore.ts'), 'utf8');

  assert.ok(fabricSource.includes('new MemorySubsystemRuntime(this.hexisAdaptation)'));
  assert.ok(coreSource.includes('private readonly organismSystems = new OrganismSystemFabric()'));
  assert.ok(coreSource.includes('private get memorySubsystem() { return this.organismSystems.memory; }'));
  assert.equal((coreSource.match(/new MemorySubsystemRuntime\s*\(/g) ?? []).length, 0,
    'OrganismCore must not instantiate a second MemorySubsystemRuntime');
});

test('the imported composition is a real OrganismSystemFabric instance', () => {
  assert.equal(typeof OrganismSystemFabric, 'function');
  const systems = new OrganismSystemFabric();
  assert.ok(systems.memory instanceof MemorySubsystemRuntime);
  assert.equal(systems.memory.fabric.memoryOS, systems.memory.memoryOS);
});
