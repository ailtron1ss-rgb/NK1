import assert from 'node:assert/strict';
import { UnifiedCognitiveLoop } from '../src/organism/brain_fusion/UnifiedCognitiveLoop.ts';

const loop = new UnifiedCognitiveLoop(2);
const event = { id: 'evt-1', novelty: 0.8, predictionError: 0.6, importance: 0.7, timestamp: 100 };
const result = loop.process(event);
assert.equal(result.phase, 'adaptation');
assert.equal(loop.getHistorySize(), 1);
assert.ok(result.learningSignal >= 0 && result.learningSignal <= 1);

for (const invalid of [
  { ...event, novelty: Number.NaN },
  { ...event, importance: Infinity },
  { ...event, predictionError: -0.1 },
  { ...event, timestamp: -1 },
  { ...event, id: ' bad-id ' },
]) {
  assert.throws(() => loop.process(invalid), /cognitive-event-invalid/);
  assert.equal(loop.getHistorySize(), 1, 'invalid ingress must not mutate the cognitive history');
}
const hostile = {};
Object.defineProperty(hostile, 'id', { enumerable: true, get() { throw new Error('getter must not run'); } });
assert.throws(() => loop.process(hostile), /cognitive-event-invalid/);
assert.equal(loop.getHistorySize(), 1);
loop.process({ ...event, id: 'evt-2' });
loop.process({ ...event, id: 'evt-3' });
assert.equal(loop.getHistorySize(), 2, 'history remains bounded');
assert.throws(() => new UnifiedCognitiveLoop(Number.NaN).process(event), /cognitive-event-invalid/);
console.log('UNIFIED_COGNITIVE_LOOP_INGRESS=PASS invalidInputsRejectedBeforeMutation=true boundedHistory=true');
