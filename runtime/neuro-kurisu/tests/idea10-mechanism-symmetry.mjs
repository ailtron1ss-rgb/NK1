import assert from 'node:assert/strict';
import { MechanismSerendipityEngine } from '../src/organism/research/MechanismSerendipityEngine.ts';

const problem = {
  id: 'target-runtime',
  title: 'Bounded context flow controller',
  domain: 'cognitive-runtime',
  actors: [
    { id: 'p', role: 'producer' },
    { id: 'q', role: 'queue' },
    { id: 'c', role: 'consumer' },
    { id: 'k', role: 'controller' },
  ],
  flows: [
    { id: 'f1', fromRole: 'producer', toRole: 'queue', kind: 'request' },
    { id: 'f2', fromRole: 'queue', toRole: 'consumer', kind: 'request' },
    { id: 'f3', fromRole: 'consumer', toRole: 'controller', kind: 'signal' },
    { id: 'f4', fromRole: 'controller', toRole: 'producer', kind: 'control' },
  ],
  constraints: [
    { id: 'c1', kind: 'capacity', onRole: 'queue' },
    { id: 'c2', kind: 'latency', onRole: 'queue' },
  ],
  feedbackLoops: [
    { id: 'b1', sourceRole: 'consumer', targetRole: 'controller', polarity: 'negative' },
    { id: 'b2', sourceRole: 'controller', targetRole: 'producer', polarity: 'negative' },
  ],
  resources: [
    { id: 'r1', kind: 'compute' },
    { id: 'r2', kind: 'memory' },
    { id: 'r3', kind: 'time' },
  ],
  dynamics: { regimes: ['saturation', 'recovery'], timescale: 'fast' },
};

const reference = structuredClone(problem);
reference.id = 'reference-with-extra-capability';
reference.title = 'Reference includes extra mechanism';
reference.domain = 'distributed-systems';
reference.flows.push({
  id: 'extra-flow',
  fromRole: 'consumer',
  toRole: 'queue',
  kind: 'signal',
});

const result = new MechanismSerendipityEngine([reference]).analyze(problem);
assert.equal(result.status, 'matched');
assert.equal(result.discoveries.length, 1);
assert.ok(
  result.discoveries[0].breakpoints.some(x => x.kind === 'reference-only-flow'),
  'the engine must report extra source-mechanism flows absent from the target problem',
);
assert.ok(
  result.discoveries[0].transferability01 < result.discoveries[0].similarity01,
  'unmatched reference-side structure must reduce transferability',
);

console.log('IDEA10_MECHANISM_SYMMETRY=PASS', JSON.stringify({
  similarity01: result.discoveries[0].similarity01,
  transferability01: result.discoveries[0].transferability01,
  breakpoints: result.discoveries[0].breakpoints.map(x => x.kind),
}));
