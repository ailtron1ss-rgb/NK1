import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const boundary = await readFile(new URL('../src/organism/core/CognitiveCycleBoundary.ts', import.meta.url), 'utf8');

assert.match(runtime, /import\s+\{\s*assertCognitiveCycleBoundaryInput\s*\}\s+from\s+['"]\.\/CognitiveCycleBoundary\.ts['"]/,
  'OrganismRuntime must import the runtime boundary validator');
const rawObservationAt = runtime.indexOf('const rawObservation = this.environment.toOrganismObservation();');
assert.notEqual(rawObservationAt, -1, 'runtime must materialize an observation before invoking Core');
const normalizeAt = runtime.indexOf('normalizeWorldContext(rawObservation.worldContext', rawObservationAt);
assert.ok(normalizeAt > rawObservationAt, 'runtime must normalize the materialized world observation before Core');
const observationAt = runtime.indexOf('const observation = { ...rawObservation, worldContext: normalizedWorldContext };', normalizeAt);
assert.ok(observationAt > normalizeAt, 'Core input must be the normalized observation, not the raw one');
const validateAt = runtime.indexOf("assertCognitiveCycleBoundaryInput(observation, 'full');", observationAt);
assert.ok(validateAt > observationAt, 'normalized observation must be checked before it is consumed');
const laterNestedRead = runtime.indexOf('observation.worldContext.facts', observationAt);
assert.ok(laterNestedRead === -1 || validateAt < laterNestedRead,
  'boundary validation must happen before dereferencing nested observation fields');
assert.match(boundary, /observation\s*===\s*null\s*\|\|\s*typeof observation !== 'object'\s*\|\|\s*Array\.isArray\(observation\)/,
  'the boundary must reject null, primitives, and arrays at runtime');
assert.match(boundary, /resultMode !== 'full' && resultMode !== 'operational'/,
  'the boundary must constrain the mode to the supported public contract');

console.log('cognitive-cycle-boundary-runtime-wiring: ok');
