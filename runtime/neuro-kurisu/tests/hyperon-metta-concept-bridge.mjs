import assert from 'node:assert/strict';
import { NeuroSymbolicConceptCompiler } from '../src/organism/cognition/NeuroSymbolicConceptCompiler.ts';

const compiler = new NeuroSymbolicConceptCompiler();
compiler.compile({ label: 'zeta', latent: [0.2, 0.4, 0.8], outcome01: 0.9, novelty01: 0.3 });
compiler.compile({ label: 'alpha "quoted" \\ path\nnext', latent: [0.1, 0.3, 0.5], outcome01: 0.7, novelty01: 0.2 });

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
