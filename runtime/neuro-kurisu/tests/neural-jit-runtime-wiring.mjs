import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const runtime = new OrganismRuntime({ stateFile: '/tmp/neural-jit-runtime-wiring.json' });
const diagnostics = runtime.neuralJitDiagnostics();
assert.equal(diagnostics.mode, 'shadow');
assert.equal(diagnostics.activationCaptureAuthorityConfigured, false);
assert.equal(diagnostics.liveInferenceEnabled, false);
assert.equal(diagnostics.activeCandidates, 0);
assert.equal(diagnostics.fallback, 'base-inference-path');
await assert.rejects(
  runtime.compileNeuralJitCandidate({ taskFamily: 'memory-retrieval', modelFingerprint: 'a'.repeat(64) }),
  /organism-runtime-not-initialized/,
  'candidate compilation must not run before runtime initialization',
);
await assert.rejects(
  runtime.evaluateNeuralJitCandidate('a'.repeat(64)),
  /organism-runtime-not-initialized/,
  'holdout evaluation must not run before runtime initialization',
);
console.log('NEURAL_JIT_RUNTIME_WIRING=PASS');
