import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtimeUrl = new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url);
const source = await readFile(runtimeUrl, 'utf8');

assert.equal(source.includes("import { PerceptionEngine } from '../cognition/PerceptionEngine.ts';"), false, 'runtime must not construct a second perception owner');
assert.equal(source.includes('new PerceptionEngine()'), false, 'the canonical engine is owned by OrganismCore');

const importIndex = source.indexOf("import { normalizeWorldContext } from './WorldContextNormalizer.ts';");
const normalizationIndex = source.indexOf('normalizeWorldContext(rawObservation.worldContext');
const observationBindingIndex = source.indexOf('const observation = { ...rawObservation, worldContext: normalizedWorldContext };');
const boundaryValidationIndex = source.indexOf("assertCognitiveCycleBoundaryInput(observation, 'full');", normalizationIndex);
const perceptionBeforeIndex = source.indexOf('const perceptionBefore = this.core.perceptionSnapshot();', boundaryValidationIndex);
const observeIndex = source.indexOf('this.core.observe({', perceptionBeforeIndex);
const perceptionAfterIndex = source.indexOf('const perceptionAfter = this.core.perceptionSnapshot();', observeIndex);
const perceptionEvidenceIndex = source.indexOf("source: 'perception-engine'", perceptionAfterIndex);

assert.ok(importIndex >= 0, 'runtime must import the canonical world-context normalizer');
assert.ok(normalizationIndex > importIndex, 'world normalization must happen in the live runtime path');
assert.ok(observationBindingIndex > normalizationIndex, 'the normalized world must replace the raw world context');
assert.ok(boundaryValidationIndex > observationBindingIndex, 'cognitive boundary checks must validate the normalized observation');
assert.ok(perceptionBeforeIndex > boundaryValidationIndex, 'the canonical perception snapshot must be captured before core.observe');
assert.ok(observeIndex > perceptionBeforeIndex, 'the normalized observation must flow into the canonical core.observe call');
assert.ok(perceptionAfterIndex > observeIndex, 'the canonical perception event must be read after core.observe');
assert.ok(perceptionEvidenceIndex > perceptionAfterIndex, 'the same core event must be published to the evidence bus');
assert.equal(source.includes('this.core.observe({\n      ...rawObservation'), false, 'raw observation must not bypass normalization');

console.log('WORLD_PERCEPTION_RUNTIME_WIRING=PASS');
