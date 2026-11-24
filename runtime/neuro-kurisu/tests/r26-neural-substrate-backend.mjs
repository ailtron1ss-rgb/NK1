import assert from 'node:assert/strict';
import { NeuralSubstrateBackend, defaultNeuralSubstrateBackend } from '../src/organism/cognition/NeuralSubstrateBackend.ts';

const backend = new NeuralSubstrateBackend();
backend.restore(defaultNeuralSubstrateBackend());

const vector = Array.from({length:16},(_,i)=>Math.sin(i*.31));
const first = backend.step({vector,tick:1,learningEnabled:false});
assert.equal(first.backend,'canonical');
assert.equal(first.hidden.length, backend.canonicalDiagnostics().dimension);
assert.ok(first.prediction01 >= 0 && first.prediction01 <= 1);

backend.setMode('mlstm-shadow');
const second = backend.step({vector:vector.map((x,i)=>x+(i===0?.1:0)),tick:2,learningEnabled:false});
assert.ok(second.shadow);
assert.ok(Number.isFinite(second.shadow.prediction01));
assert.ok(second.shadow.hidden.every(Number.isFinite));
const comparison = backend.lastShadowComparisonSnapshot();
assert.equal(comparison?.tick,2);
assert.ok((comparison?.predictionGap01 ?? 1) >= 0 && (comparison?.predictionGap01 ?? 1) <= 1);

const snapshot = backend.fullSnapshot();
const restored = new NeuralSubstrateBackend();
restored.restore(snapshot);
restored.setMode('mlstm-shadow');
const replayA = restored.step({vector,tick:3,learningEnabled:false});
const restored2 = new NeuralSubstrateBackend();
restored2.restore(snapshot);
restored2.setMode('mlstm-shadow');
const replayB = restored2.step({vector,tick:3,learningEnabled:false});
assert.deepEqual(replayA.hidden,replayB.hidden);
assert.deepEqual(replayA.shadow?.hidden,replayB.shadow?.hidden);
assert.equal(replayA.prediction01,replayB.prediction01);
assert.equal(replayA.shadow?.prediction01,replayB.shadow?.prediction01);

console.log(JSON.stringify({
  pass:true,
  canonicalDimension:backend.canonicalDiagnostics().dimension,
  mlstmDimension:backend.shadowDiagnostics().dimension,
  predictionGap01:comparison?.predictionGap01 ?? null,
  canonicalCycles:backend.canonicalDiagnostics().cycles,
  mlstmCycles:backend.shadowDiagnostics().cycles,
  persistedMode:snapshot.mode,
}));
