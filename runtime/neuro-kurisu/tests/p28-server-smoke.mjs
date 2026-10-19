import assert from 'node:assert/strict';
import { P28PlasticitySubstrate } from '../src/organism/learning/P28PlasticitySubstrate.ts';

const p = new P28PlasticitySubstrate();
const r = p.observe({ vector:new Array(16).fill(.1), modality:'sensor', source:'device', tick:1, trust01:.9, predictionError01:.1 });
assert.equal(r.quarantined,false);
assert.equal(p.snapshot().prototypes.length,1);
const qBefore=p.snapshot().prototypeUpdates;
p.observe({ vector:new Array(16).fill(.2), modality:'text', source:'user', tick:2, trust01:.2, predictionError01:.8 });
assert.equal(p.snapshot().quarantinedObservations,1);
assert.equal(p.snapshot().prototypeUpdates,qBefore);
console.log('P28_SERVER_TRUTH=PASS', JSON.stringify({prototypeUpdates:p.snapshot().prototypeUpdates,quarantined:p.snapshot().quarantinedObservations}));
