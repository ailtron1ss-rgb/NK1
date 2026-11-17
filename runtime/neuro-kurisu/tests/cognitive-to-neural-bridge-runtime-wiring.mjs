import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('../src/organism/core/OrganismRuntime.ts',import.meta.url),'utf8');
const language=await readFile(new URL('../src/organism/language/LanguageOrgan.ts',import.meta.url),'utf8');
const invocationCount=[...runtime.matchAll(/this\.applyCognitiveToNeuralControl\(request,\s*cycle\)/g)].length;
assert.equal(invocationCount,2,'both cognitive-proposal and response generation must pass through the bridge');
assert.match(runtime,/cognitiveToNeuralBridge\?\.enabled\s*===\s*false/,'runtime must expose an emergency bypass');
assert.match(runtime,/activationSteeringApplied:\s*false/,'telemetry must not claim activation steering was executed');
assert.match(runtime,/residualBlockApplied:\s*false/,'telemetry must not claim a residual block was executed');
assert.match(language,/cognitiveControl\?:\s*CognitiveNeuralControlProfile/,'LanguageRequest must carry the typed bridge profile');
console.log('COGNITIVE_TO_NEURAL_RUNTIME_WIRING_PASS');
