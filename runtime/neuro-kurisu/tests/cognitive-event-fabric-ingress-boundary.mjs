import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const fabric = new CognitiveEventFabric(128);
fabric.append({ id: 'obs-1', tick: 1, stage: 'observation', source: 'test', confidence01: 0.7, payload: { signal: 'x' } });
const before = fabric.snapshot();
for (const invalid of [
  { tick: Number.NaN, stage: 'prediction', source: 'test' },
  { tick: -1, stage: 'prediction', source: 'test' },
  { tick: 2, stage: 'not-a-stage', source: 'test' },
  { tick: 2, stage: 'prediction', source: 'test', confidence01: 2 },
  { tick: 2, stage: 'prediction', source: 'test', parentIds: ['bad\nparent'] },
  { tick: 2, stage: 'prediction', source: 'test', payload: Object.defineProperty({}, 'secret', { enumerable: true, get() { throw new Error('getter invoked'); } }) },
]) assert.throws(() => fabric.append(invalid), /invalid-cognitive-event|cognitive-event/);
let getterCalls = 0;
const accessorEnvelope = { stage: 'prediction', source: 'test' };
Object.defineProperty(accessorEnvelope, 'tick', { enumerable: true, get() { getterCalls += 1; return 2; } });
assert.throws(() => fabric.append(accessorEnvelope), /cognitive-event-accessor-rejected/);
assert.equal(getterCalls, 0);
assert.equal(fabric.snapshot().total, before.total, 'invalid ingress must not mutate the ledger');
assert.equal(fabric.recent().length, 1);
console.log('cognitive event fabric ingress boundary: ok');
