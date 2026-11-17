import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';

const fabric = new OrganismSystemFabric();

assert.equal(
  typeof fabric.developmentalGenome,
  'function',
  'OrganismSystemFabric must expose a genome derived from its live system contracts'
);

const genome = fabric.developmentalGenome();
assert.equal(genome.schemaVersion, 1);
assert.equal(genome.modules.length, 7);
assert.equal(genome.activation, 'NOT_APPLIED');
assert.equal(fabric.snapshot().developmentalGenome.digest, genome.digest);

console.log('DEVELOPMENTAL_GENOME_FABRIC_BOUNDARY=PASS');
