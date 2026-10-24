import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const boundary = await readFile(new URL('../src/organism/core/CognitiveCycleBoundary.ts', import.meta.url), 'utf8');

assert.match(runtime, /import\s+\{\s*normalizeCognitiveCycleBoundaryInput\s*\}\s+from\s+['"]\.\/CognitiveCycleBoundary\.ts['"]/,
  'OrganismRuntime must consume the normalized snapshot boundary');
const observationAt = runtime.indexOf("const observation = normalizeCognitiveCycleBoundaryInput(");
assert.notEqual(observationAt, -1, 'runtime must detach an observation before invoking Core');
const laterNestedRead = runtime.indexOf('observation.worldContext.facts', observationAt);
assert.ok(laterNestedRead > observationAt,
  'all downstream runtime/core work must read the normalized observation value');
assert.ok(runtime.indexOf('this.core.observe({', observationAt) > observationAt,
  'the same normalized observation must flow into the full cognitive cycle');
assert.match(boundary, /observation\s*===\s*null\s*\|\|\s*typeof observation !== 'object'\s*\|\|\s*Array\.isArray\(observation\)/,
  'the boundary must reject null, primitives, and arrays at runtime');
assert.match(boundary, /resultMode !== 'full' && resultMode !== 'operational'/,
  'the boundary must constrain the mode to the supported public contract');
assert.match(boundary, /return snapshotPlainData/,
  'the normalizer must return a detached bounded plain-data snapshot');

console.log('cognitive-cycle-boundary-runtime-wiring: ok');
