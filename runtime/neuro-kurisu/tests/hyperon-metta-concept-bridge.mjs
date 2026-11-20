import assert from 'node:assert/strict';
import { NeuroSymbolicConceptCompiler } from '../src/organism/cognition/NeuroSymbolicConceptCompiler.ts';

const compiler = new NeuroSymbolicConceptCompiler();
compiler.compile({ label: 'zeta', latent: [0.2, 0.4, 0.8], outcome01: 0.9, novelty01: 0.3 });
// Different vector dimensionality deliberately forces a second concept prototype.
compiler.compile({ label: 'alpha "quoted" \\ path\nnext', latent: [0.1, 0.3], outcome01: 0.7, novelty01: 0.2 });

const before = JSON.stringify(compiler.snapshot());
const exported = compiler.exportMeTTaFacts();
assert.equal(exported.format, 'metta');
assert.equal(exported.conceptCount, 2);
assert.equal(exported.facts.length, 4);
assert.equal(exported.text, exported.facts.join('\n'));
assert.ok(exported.facts[0].startsWith('(NK1Concept "alpha'));
assert.ok(exported.facts[0].includes('\\\"quoted\\\"'));
assert.ok(exported.facts[0].includes('\\\\ path next'));
assert.ok(exported.facts.every((fact) => fact.startsWith('(NK1Concept')));
assert.equal(JSON.stringify(compiler.snapshot()), before, 'serialization must not mutate canonical compiler state');
assert.deepEqual(compiler.exportMeTTaFacts(), exported, 'export must be deterministic');

assert.equal(compiler.exportMeTTaFacts(1).conceptCount, 1, 'caller limit is honored');
assert.equal(compiler.exportMeTTaFacts(1000).conceptCount, 2, 'hard cap does not drop valid concepts');
assert.equal(compiler.exportMeTTaFacts(-1).conceptCount, 0, 'negative limit safely exports nothing');
assert.equal(compiler.exportMeTTaFacts(Number.NaN).conceptCount, 2, 'invalid limit falls back to bounded default');

const restored = new NeuroSymbolicConceptCompiler();
restored.restore({
  concepts: {
    hostile: {
      label: 'hostile',
      centroid: [Number.NaN, Number.POSITIVE_INFINITY, 0.5],
      confidence01: Number.NaN,
      uses: -5,
      success01: Number.POSITIVE_INFINITY,
    },
  },
});
const hostileExport = restored.exportMeTTaFacts();
assert.equal(hostileExport.conceptCount, 1);
assert.ok(hostileExport.facts[0].includes('0.0000 0 0.0000'));
assert.ok(hostileExport.facts[1].includes('(Vector 0.0000 0.0000 0.5000)'));

console.log('PASS: bounded deterministic MeTTa export, escaping, state isolation and malformed-state clamping');


const reservedKeys = new NeuroSymbolicConceptCompiler();
reservedKeys.compile({ label: '__proto__', latent: [0.1], outcome01: 0.8, novelty01: 0.2 });
reservedKeys.compile({ label: 'constructor', latent: [0.2, 0.3], outcome01: 0.7, novelty01: 0.1 });
assert.deepEqual(Object.keys(reservedKeys.snapshot().concepts).sort(), ['__proto__', 'constructor'],
  'prototype-shaped labels must remain ordinary concept keys');
assert.equal(reservedKeys.exportMeTTaFacts().conceptCount, 2);
const reservedRoundTrip = new NeuroSymbolicConceptCompiler();
reservedRoundTrip.restore(reservedKeys.snapshot());
assert.deepEqual(Object.keys(reservedRoundTrip.snapshot().concepts).sort(), ['__proto__', 'constructor'],
  'reserved concept keys must survive a sanitized restore');

let rootGetterCalls = 0;
const rootGetterSnapshot = Object.defineProperty({}, 'concepts', {
  enumerable: true,
  get() { rootGetterCalls++; return { hidden: { label: 'hidden', centroid: [0.1] } }; },
});
const rootGetterRestore = new NeuroSymbolicConceptCompiler();
rootGetterRestore.restore(rootGetterSnapshot);
assert.equal(rootGetterCalls, 0, 'restore must inspect own descriptors instead of executing root getters');
assert.equal(rootGetterRestore.summary().concepts, 0, 'accessor-backed root snapshots fail closed');

let nestedGetterCalls = 0;
const nestedGetterConcept = Object.defineProperties({}, {
  label: { value: 'nested-getter', enumerable: true },
  centroid: { value: [0.2], enumerable: true },
  confidence01: { enumerable: true, get() { nestedGetterCalls++; return 1; } },
  uses: { value: 1, enumerable: true },
  success01: { value: 0.5, enumerable: true },
});
const nestedGetterConcepts = Object.create(null);
nestedGetterConcepts['nested-getter'] = nestedGetterConcept;
const nestedGetterRestore = new NeuroSymbolicConceptCompiler();
nestedGetterRestore.restore({ concepts: nestedGetterConcepts });
assert.equal(nestedGetterCalls, 0, 'restore must not execute nested concept getters');
assert.equal(nestedGetterRestore.summary().concepts, 0, 'accessor-backed concept rows are rejected');

let vectorGetterCalls = 0;
const accessorVector = [0.2];
Object.defineProperty(accessorVector, '0', {
  enumerable: true,
  configurable: true,
  get() { vectorGetterCalls++; return 0.9; },
});
const accessorVectorConcepts = Object.create(null);
accessorVectorConcepts.safe = {
  label: 'safe',
  centroid: accessorVector,
  confidence01: 0.8,
  uses: 1,
  success01: 0.5,
};
const accessorVectorRestore = new NeuroSymbolicConceptCompiler();
accessorVectorRestore.restore({ concepts: accessorVectorConcepts });
assert.equal(vectorGetterCalls, 0, 'restore must not execute centroid element getters');
assert.equal(accessorVectorRestore.summary().concepts, 0, 'accessor-backed centroid rows are rejected');

let proxyTrapCalls = 0;
const hostileProxy = new Proxy({}, {
  get() { proxyTrapCalls++; throw new Error('proxy get trap executed'); },
  ownKeys() { proxyTrapCalls++; throw new Error('proxy ownKeys trap executed'); },
  getOwnPropertyDescriptor() { proxyTrapCalls++; throw new Error('proxy descriptor trap executed'); },
});
const proxyRestore = new NeuroSymbolicConceptCompiler();
proxyRestore.restore(hostileProxy);
assert.equal(proxyTrapCalls, 0, 'restore must reject proxies before invoking traps');
assert.equal(proxyRestore.summary().cycles, 0);
assert.equal(proxyRestore.summary().concepts, 0);

console.log('PASS: bounded, prototype-safe and accessor-free concept restore');
