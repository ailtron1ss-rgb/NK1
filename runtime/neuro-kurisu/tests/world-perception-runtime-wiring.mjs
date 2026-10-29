import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtimeUrl = new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url);
const source = await readFile(runtimeUrl, 'utf8');

assert.ok(source.includes("import { PerceptionEngine } from '../cognition/PerceptionEngine.ts';"), 'runtime must own the canonical perception engine');
assert.ok(source.includes('private readonly perceptionEngine = new PerceptionEngine();'), 'perception state must be owned by the runtime composition');

const importIndex = source.indexOf("import { normalizeWorldContext } from './WorldContextNormalizer.ts';");
const normalizationIndex = source.indexOf('normalizeWorldContext(rawObservation.worldContext');
const observationBindingIndex = source.indexOf('const observation = { ...rawObservation, worldContext: normalizedWorldContext };');
const boundaryValidationIndex = source.indexOf("assertCognitiveCycleBoundaryInput(observation, 'full');", normalizationIndex);
const perceptionCallIndex = source.indexOf('this.perceptionEngine.perceive({', boundaryValidationIndex);
const perceptionEvidenceIndex = source.indexOf("source: 'perception-engine'", perceptionCallIndex);
const perceptionModalityIndex = source.indexOf('modality: perceptionModality', perceptionCallIndex);
const observeIndex = source.indexOf('this.core.observe({', boundaryValidationIndex);

assert.ok(importIndex >= 0, 'runtime must import the canonical world-context normalizer');
assert.ok(normalizationIndex > importIndex, 'world normalization must happen in the live runtime path');
assert.ok(observationBindingIndex > normalizationIndex, 'the normalized world must replace the raw world context');
assert.ok(boundaryValidationIndex > observationBindingIndex, 'cognitive boundary checks must validate the normalized observation');
assert.ok(observeIndex > boundaryValidationIndex, 'the normalized observation must flow into the canonical core.observe call');
assert.ok(perceptionCallIndex > boundaryValidationIndex, 'perception must run only after normalized input reaches the runtime boundary');
assert.ok(perceptionEvidenceIndex > perceptionCallIndex, 'salient perception events must be published to the evidence bus');
assert.ok(perceptionModalityIndex > perceptionCallIndex, 'salient non-social perception events must be passed into the multimodal workspace');
assert.equal(source.includes('this.core.observe({\n      ...rawObservation'), false, 'raw observation must not bypass normalization');

console.log('WORLD_PERCEPTION_RUNTIME_WIRING=PASS');
