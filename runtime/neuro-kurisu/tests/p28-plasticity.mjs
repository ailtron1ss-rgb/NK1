import assert from 'node:assert/strict';
import { P28PlasticitySubstrate } from '../src/organism/learning/P28PlasticitySubstrate.ts';

const p = new P28PlasticitySubstrate();
const base = [0.82,0.21,0.14,0.66,0.31,0.42,0.18,0.77,0.88,0.69,0.22,0.14,0.09,0.55,0.81,0.1];
for (let i=0;i<24;i++) {
  p.observe({ vector:base.map((x,j)=>x + ((i%3)-1)*0.01*(j%4)), modality:'vision', source:'camera-local', tick:i+1, trust01:.9, predictionError01:.2, action:'explore' });
}
const before = p.snapshot();
assert.ok(before.prototypes.length >= 1);
assert.equal(before.quarantinedObservations,0);
const bound = p.bindAction('explore',30);
assert.ok(bound >= 0);
const credit = p.credit(.96,.72,'explore',31);
assert.ok(credit.activeTraces >= 0);
const positiveBias = p.bias('explore');
assert.ok(positiveBias >= 0);

const q = p.observe({ vector:base, modality:'text', source:'untrusted-user', tick:32, trust01:.2, predictionError01:.8, action:'respond' });
assert.equal(q.quarantined,true);
assert.ok(p.snapshot().quarantinedObservations >= 1);

p.observe({ vector:base.map(x=>-x), modality:'audio', source:'mic', tick:33, trust01:.9, predictionError01:.7, action:'verify' });
p.bindAction('verify',34);
p.credit(.08,.95,'verify',35);
const negativeBias = p.bias('verify');
assert.ok(negativeBias <= 0);

const restored = new P28PlasticitySubstrate();
restored.restore(p.snapshot());
assert.deepEqual(restored.snapshot(), p.snapshot());
console.log('P28_PLASTICITY=PASS', JSON.stringify({
  prototypes: p.snapshot().prototypes.length,
  associations: p.snapshot().associations.length,
  quarantined: p.snapshot().quarantinedObservations,
  positiveBias: Number(positiveBias.toFixed(5)),
  negativeBias: Number(negativeBias.toFixed(5)),
}));
